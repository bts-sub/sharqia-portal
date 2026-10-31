// ===========================================================================
// sales.js — واجهة تطبيق المبيعات (pos.sharqiaa-tech.net) مع Odoo
//
//   كلّه تحت /api/sales/*. الأمان ثلاث طبقات:
//     1) host-gate في server.js: نطاق pos لا يصل إلا /api/sales/*.
//     2) مفتاح X-Sales-Key يحقنه Nginx الأمامي (لا يظهر في جافاسكربت العميل).
//     3) جلسة البائع: يدخل باسمه ورمزه السرّي (أدون «تطبيق المبيعات» في أودو — sharqia_sales_app)،
//        وكل طلبٍ يحمل رمز جلسته (Bearer). الصلاحيات تُفرض في أودو نفسه (sales.app.api)،
//        وهنا فقط ما لا يمرّ بها (عروض الأسعار).
//   يعيد استخدام عميل Odoo الجاهز (اعتماد البوابة) — لا سرّ للفرونت إطلاقًا.
// ===========================================================================
import { Router } from "express";
import { searchRead, create, callButton, unlink, execKw } from "../lib/odooClient.js";
import { badRequest, forbidden, tooMany, unauthorized, upstream } from "../lib/errors.js";

const r = Router();
const KEY = (process.env.SALES_API_KEY || "").trim();
// رابط بوّابة Odoo الذي يُبنى عليه لينك عرض السعر (نفس web.base.url على السيرفر)
const ODOO_BASE = (process.env.ODOO_PORTAL_BASE || process.env.ODOO_URL || "https://test.sharqiaa-tech.net").replace(/\/+$/, "");
const APP = "sales.app.api";
const MF = "myfatoorah.payment";

const pathOf = (req) => req.originalUrl.split("?")[0];
const m2o = (v) => (Array.isArray(v) ? { id: v[0], name: v[1] } : null);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// أخطاء أودو ← حالة مناسبة (الرسالة نفسها عربية للبائع)
function odooError(e) {
  const m = String((e && e.message) || "");
  if (/انتهت الجلسة/.test(m)) return Object.assign(unauthorized(m), { auth: true });
  if (/لا صلاحية/.test(m)) return forbidden(m);
  if (/sales\.app\.api|doesn't exist|does not exist/i.test(m)) return upstream("أدون «تطبيق المبيعات» غير مثبّت في أودو بعد");
  if (/Odoo|الاتصال|خادم/.test(m)) return upstream(m);
  return badRequest(m);
}
const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { const err = e.status ? e : odooError(e); if (err.auth) sessions.delete(req.appToken); next(err); }
};

// ── طبقة 2: مفتاح Nginx ──
r.use("/api/sales", (req, res, next) => {
  if (pathOf(req) === "/api/sales/health") return next();
  if (!KEY) return res.status(503).json({ error: "خدمة المبيعات غير مُهيّأة على الخادم (SALES_API_KEY مفقود)" });
  if ((req.get("x-sales-key") || "") !== KEY) return res.status(401).json({ error: "غير مصرّح" });
  next();
});

// ── طبقة 3: جلسة البائع ──
const PUBLIC = [/^\/api\/sales\/health$/, /^\/api\/sales\/login$/, /^\/api\/sales\/products\/\d+\/image$/];
const sessions = new Map();          // رمز ← {user, at}: كاش دقيقة كي لا يُسأل أودو مع كل طلب
const SESSION_TTL = 60_000;
const tokenOf = (req) => String(req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

async function sessionUser(token) {
  if (!token) return null;
  const hit = sessions.get(token);
  if (hit && Date.now() - hit.at < SESSION_TTL) return hit.user;
  const out = await execKw(APP, "app_check", [token]);
  if (!out || !out.ok) { sessions.delete(token); return null; }
  sessions.set(token, { user: out.user, at: Date.now() });
  if (sessions.size > 1000) sessions.delete(sessions.keys().next().value);
  return out.user;
}

r.use("/api/sales", async (req, res, next) => {
  const p = pathOf(req);
  if (PUBLIC.some((rx) => rx.test(p))) return next();
  try {
    const token = tokenOf(req);
    const user = await sessionUser(token);
    if (!user) return res.status(401).json({ error: "سجّل الدخول من جديد", auth: true });
    req.appUser = user;
    req.appToken = token;
    next();
  } catch (e) { next(odooError(e)); }
});
const perm = (name) => (req, res, next) =>
  (req.appUser && req.appUser.perms && req.appUser.perms[name]) ? next() : next(forbidden("لا صلاحية لك لهذا الإجراء"));

r.get("/api/sales/health", (req, res) => res.json({ ok: true, odooBase: ODOO_BASE }));

// ───────────────────────── الدخول ─────────────────────────
// حدٌّ لكل عنوان IP فوق قفل أودو لكل بائع: يصدّ تجريب أسماء دخولٍ كثيرة.
const loginHits = new Map();
function loginLimited(ip) {
  const now = Date.now(), win = 10 * 60_000;
  const hits = (loginHits.get(ip) || []).filter((t) => now - t < win);
  hits.push(now); loginHits.set(ip, hits);
  if (loginHits.size > 5000) loginHits.delete(loginHits.keys().next().value);
  return hits.length > 20;
}

r.post("/api/sales/login", run(async (req, res) => {
  const { login, pin, device } = req.body || {};
  if (!login || !pin) throw badRequest("اكتب اسم الدخول والرمز");
  if (loginLimited(req.ip)) throw tooMany("محاولات دخول كثيرة — انتظر 10 دقائق");
  const out = await execKw(APP, "app_login", [String(login), String(pin), String(device || req.get("user-agent") || "").slice(0, 120)]);
  if (!out || !out.ok) return res.status(401).json({ error: (out && out.error) || "تعذّر الدخول" });
  sessions.set(out.token, { user: out.user, at: Date.now() });
  res.json({ token: out.token, user: out.user });
}));

r.get("/api/sales/me", (req, res) => res.json(req.appUser));

r.post("/api/sales/logout", run(async (req, res) => {
  await execKw(APP, "app_logout", [req.appToken]);
  sessions.delete(req.appToken);
  res.json({ ok: true });
}));

// ───────────────────────── المنتجات ─────────────────────────
const PRODUCT_FIELDS = ["name", "default_code", "barcode", "list_price", "qty_available", "uom_id"];
// أسعار شاملة الضريبة من أودو؛ وإن تعذّر: فارغة (الواجهة تعرض السعر الأساسي).
async function mfPrices(ids) {
  if (!ids.length) return {};
  try { return (await execKw(MF, "mf_app_prices", [ids])) || {}; } catch { return {}; }
}
async function productsOut(rows) {
  const incl = await mfPrices(rows.map((p) => p.id));
  return rows.map((p) => ({
    id: p.id, name: p.name, code: p.default_code || "", barcode: p.barcode || "",
    price: p.list_price, qty: p.qty_available, uom: m2o(p.uom_id)?.name || "",
    price_incl: incl[String(p.id)] ?? null,     // ما يدفعه العميل في لينك ماي فاتورة
  }));
}

r.get("/api/sales/products", run(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(num(req.query.limit, 40), 100);
  const offset = Math.max(num(req.query.offset, 0), 0);
  // ?scope=pos: منتجات نقطة بيع الموظف بكميات مخزونها (أودو يحدّد نقطته من جلسته)
  if (req.query.scope === "pos") {
    return res.json(await execKw(APP, "app_pos_products", [req.appToken, q, limit, offset, req.query.stock === "1"]));
  }
  const domain = [["sale_ok", "=", true], ["type", "!=", "service"]];
  if (q) domain.push("|", "|", ["name", "ilike", q], ["default_code", "ilike", q], ["barcode", "ilike", q]);
  const rows = await searchRead("product.product", domain, PRODUCT_FIELDS,
    { limit, offset, order: q ? "name" : "id desc" });   // بلا بحث: الأحدث أولًا
  res.json(await productsOut(rows));
}));

// منتجٌ بالباركود أو الكود (مسح كاميرا الجوال) — مطابقة تامّة
r.get("/api/sales/products/by-code/:code", run(async (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) throw badRequest("الكود فارغ");
  if (req.query.scope === "pos") return res.json(await execKw(APP, "app_pos_product_by_code", [req.appToken, code]));
  const rows = await searchRead("product.product",
    [["sale_ok", "=", true], "|", ["barcode", "=", code], ["default_code", "=", code]], PRODUCT_FIELDS, { limit: 2 });
  if (!rows.length) return res.status(404).json({ error: `لا منتج بهذا الكود: ${code}` });
  const [p] = await productsOut([rows[0]]);
  res.json({ ...p, more: rows.length > 1 });
}));

// صورة المنتج (بروكسي من Odoo — image_256). عامّة: الوسم <img> لا يحمل رمز الجلسة، وصور المنتجات
// منشورة أصلًا في المتجر.
r.get("/api/sales/products/:id/image", async (req, res, next) => {
  try {
    const id = num(req.params.id);
    const rows = await searchRead("product.product", [["id", "=", id]], ["image_256"]);
    const b64 = rows[0] && rows[0].image_256;
    if (!b64) return res.status(404).end();
    const ct = b64.startsWith("/9j/") ? "image/jpeg"
      : b64.startsWith("R0lGOD") ? "image/gif"
      : b64.startsWith("UklGR") ? "image/webp" : "image/png";
    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(b64, "base64"));
  } catch (e) { next(e); }
});

// ───────────────────────── العملاء ─────────────────────────
// أودو يقصر القائمة: الخارجي يراه بائعه فقط، والداخلي (زبون المعرض) لا يكشف عملاء بائعٍ آخر.
r.get("/api/sales/customers", run(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(num(req.query.limit, 30), 100);
  const scope = req.query.scope === "internal" ? "internal" : "external";
  res.json(await execKw(APP, "app_customers", [req.appToken, q, scope, limit]));
}));

// بيانات الجواز تصل نصًّا فقط: الصورة تُقرأ على جوال البائع ولا تُرفع.
r.post("/api/sales/customers", run(async (req, res) => {
  const { name, phone, email, city, passport_no, nationality, birthdate, passport_expiry, gender, scope } = req.body || {};
  if (!name || !String(name).trim()) throw badRequest("اسم العميل مطلوب");
  res.json(await execKw(APP, "app_create_customer", [req.appToken,
    { name, phone, email, city, passport_no, nationality, birthdate, passport_expiry, gender },
    scope === "internal" ? "internal" : "external"]));
}));

// ───────────────────────── الشحن ─────────────────────────
r.get("/api/sales/carriers", run(async (req, res) => {
  res.json(await execKw(APP, "app_carriers", [req.appToken]));
}));

// ───────────────────────── فواتير ولينكات دفع ماي فاتورة ─────────────────────────
//   الفاتورة تُنشأ في أودو بمنتجاتها (وشحنها) باسم البائع، فيصل العميلَ لينكُ ماي فاتورة المعتاد
//   بالأصناف والمبلغ. وبعد الدفع: قيد الإيراد وأمر التسليم من المخزن في أودو تلقائيًا.
function mfMessage(inv) {
  const items = (inv.lines || []).map((l) => `• ${l.name} × ${l.qty} = ${Number(l.subtotal).toFixed(2)} ر.س`).join("\n");
  return `السلام عليكم ${inv.partner || ""}\n`
    + `فاتورتكم من بيت العباءة الشرقية رقم ${inv.invoice_id}:\n${items}\n`
    + `الإجمالي: ${Number(inv.amount).toFixed(2)} ر.س (شامل الضريبة)\n`
    + `للدفع الآمن عبر ماي فاتورة (مدى، فيزا، أبل باي):\n${inv.url}`;
}

r.post("/api/sales/mf-links", run(async (req, res) => {
  const { partner_id, lines, note, shipping } = req.body || {};
  if (!partner_id) throw badRequest("اختر العميل");
  if (!Array.isArray(lines) || !lines.length) throw badRequest("أضف منتجًا واحدًا على الأقل");
  const clean = lines.map((l) => ({
    product_id: num(l.product_id), qty: Math.max(1, num(l.qty, 1)),
    price_unit: l.price_unit == null || l.price_unit === "" ? null : num(l.price_unit),
  }));
  const ship = shipping && shipping.carrier_id
    ? { carrier_id: num(shipping.carrier_id), price: shipping.price == null || shipping.price === "" ? null : num(shipping.price) }
    : null;
  const inv = await execKw(APP, "app_create_link", [req.appToken, num(partner_id), clean, ship, note ? String(note) : false]);
  res.json({ ...inv, message: mfMessage(inv) });
}));

r.get("/api/sales/mf-links", run(async (req, res) => {
  const limit = Math.min(num(req.query.limit, 30), 100);
  res.json(await execKw(APP, "app_list", [req.appToken, limit]));
}));

// تفاصيل الفاتورة؛ ?refresh=1 يحدّث حالة الدفع من ماي فاتورة الآن (قراءة فقط)
r.get("/api/sales/mf-links/:id", run(async (req, res) => {
  const inv = await execKw(APP, "app_get", [req.appToken, num(req.params.id), req.query.refresh === "1"]);
  res.json({ ...inv, message: mfMessage(inv) });
}));

// ───────────────────────── طلبات عملاء المعرض (إلى كاشير نقطة البيع) ─────────────────────────
//   أودو يفرض كل شيء من جلسة الموظف: نقطته، وأقسام فرعه، وأصنافه هو فقط.
const orderLines = (lines) => (Array.isArray(lines) ? lines : []).map((l) => ({
  product_id: num(l.product_id), qty: Math.max(1, num(l.qty, 1)),
  price_unit: l.price_unit == null || l.price_unit === "" ? null : num(l.price_unit),
}));

r.get("/api/sales/pos-orders", run(async (req, res) => {
  res.json(await execKw(APP, "app_order_list", [req.appToken, String(req.query.box || "open"), Math.min(num(req.query.limit, 40), 100)]));
}));
r.get("/api/sales/pos-orders/counts", run(async (req, res) => {
  res.json(await execKw(APP, "app_order_counts", [req.appToken]));
}));
r.post("/api/sales/pos-orders", run(async (req, res) => {
  const { partner_id, lines, note } = req.body || {};
  res.json(await execKw(APP, "app_order_create", [req.appToken, num(partner_id) || false, orderLines(lines), note ? String(note) : false]));
}));
r.get("/api/sales/pos-orders/:id", run(async (req, res) => {
  res.json(await execKw(APP, "app_order_get", [req.appToken, num(req.params.id)]));
}));
r.put("/api/sales/pos-orders/:id", run(async (req, res) => {
  const { partner_id, lines, note } = req.body || {};
  res.json(await execKw(APP, "app_order_save", [req.appToken, num(req.params.id), orderLines(lines),
    partner_id === undefined ? null : (num(partner_id) || false), note === undefined ? null : String(note || "")]));
}));
// إجراءات الطلب: كل واحدٍ يقابل دالة في أودو تتحقّق من الصلاحية بنفسها
const ORDER_ACTIONS = { open: "app_order_open", release: "app_order_release", receive: "app_order_receive",
  cashier: "app_order_send_cashier", recall: "app_order_recall" };
r.post("/api/sales/pos-orders/:id/:action(open|release|receive|cashier|recall)", run(async (req, res) => {
  res.json(await execKw(APP, ORDER_ACTIONS[req.params.action], [req.appToken, num(req.params.id)]));
}));
r.post("/api/sales/pos-orders/:id/transfer", run(async (req, res) => {
  res.json(await execKw(APP, "app_order_transfer", [req.appToken, num(req.params.id), num((req.body || {}).pos_config_id)]));
}));
r.post("/api/sales/pos-orders/:id/cancel", run(async (req, res) => {
  const reason = String((req.body || {}).reason || "").trim();
  res.json(await execKw(APP, "app_order_cancel", [req.appToken, num(req.params.id), reason || false]));
}));

// ───────────────────────── لوحة مبيعات الموظف ─────────────────────────
r.get("/api/sales/dashboard", run(async (req, res) => {
  res.json(await execKw(APP, "app_dashboard", [req.appToken, String(req.query.period || "month"), num(req.query.user) || false]));
}));

// ───────────────────────── استلام مخزن الفرع واعتماد الجودة (المشرف) ─────────────────────────
r.get("/api/sales/receipts", run(async (req, res) => {
  res.json(await execKw(APP, "app_receipts", [req.appToken]));
}));
r.get("/api/sales/receipts/:id", run(async (req, res) => {
  res.json(await execKw(APP, "app_receipt_get", [req.appToken, num(req.params.id)]));
}));
r.post("/api/sales/receipts/:id/approve", run(async (req, res) => {
  const { lines, note, close } = req.body || {};
  if (!Array.isArray(lines) || !lines.length) throw badRequest("راجع الأصناف أولًا");
  const clean = lines.map((l) => ({ move_id: num(l.move_id), received: num(l.received), rejected: num(l.rejected), note: String(l.note || "") }));
  res.json(await execKw(APP, "app_receipt_approve", [req.appToken, num(req.params.id), clean, note ? String(note) : false, !!close]));
}));

// ───────────────────────── عروض الأسعار (أودو) — لمن له صلاحيتها ─────────────────────────
const quote = perm("create_quotation");

r.get("/api/sales/orders", quote, run(async (req, res) => {
  const limit = Math.min(num(req.query.limit, 25), 50);
  const rows = await searchRead("sale.order", [], ["name", "partner_id", "state", "amount_total", "date_order"], { limit, order: "id desc" });
  res.json(rows.map((o) => ({ id: o.id, name: o.name, partner: m2o(o.partner_id), state: o.state, amount_total: o.amount_total, date: o.date_order })));
}));

r.get("/api/sales/orders/:id", quote, run(async (req, res) => {
  const id = num(req.params.id);
  const o = (await searchRead("sale.order", [["id", "=", id]],
    ["name", "partner_id", "state", "amount_total", "amount_tax", "amount_untaxed", "date_order"]))[0];
  if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
  const lines = await searchRead("sale.order.line", [["order_id", "=", id], ["display_type", "=", false]],
    ["product_id", "name", "product_uom_qty", "price_unit", "price_subtotal", "price_total"], { order: "sequence,id" });
  res.json({
    id: o.id, name: o.name, partner: m2o(o.partner_id), state: o.state,
    amount_total: o.amount_total, amount_tax: o.amount_tax, amount_untaxed: o.amount_untaxed, date: o.date_order,
    lines: lines.map((l) => ({ id: l.id, product: m2o(l.product_id), name: l.name, qty: l.product_uom_qty, price: l.price_unit, subtotal: l.price_subtotal, total: l.price_total })),
  });
}));

// إنشاء عرض سعر (مسودّة) — آمن: لا يؤكّد الطلب تلقائيًا
r.post("/api/sales/orders", quote, run(async (req, res) => {
  const { partner_id, lines, note } = req.body || {};
  if (!partner_id) throw badRequest("اختر العميل");
  if (!Array.isArray(lines) || !lines.length) throw badRequest("أضف منتجًا واحدًا على الأقل");
  const order_line = lines.map((l) => {
    const vals = { product_id: num(l.product_id), product_uom_qty: num(l.qty, 1) || 1 };
    if (l.price_unit != null && l.price_unit !== "") vals.price_unit = num(l.price_unit);
    return [0, 0, vals];
  });
  const vals = { partner_id: num(partner_id), order_line, require_payment: true };
  vals.note = [note ? String(note) : "", `من تطبيق المبيعات — ${req.appUser.name}`].filter(Boolean).join("\n");
  res.json({ id: await create("sale.order", vals) });
}));

r.post("/api/sales/orders/:id/confirm", quote, run(async (req, res) => {
  await callButton("sale.order", "action_confirm", [num(req.params.id)]);
  res.json({ ok: true });
}));

// لينك المعاينة/الدفع في بوّابة أودو (نفس زرار Preview في أمر البيع)
r.get("/api/sales/orders/:id/payment-link", quote, run(async (req, res) => {
  const id = num(req.params.id);
  const rel = await execKw("sale.order", "get_portal_url", [[id]]);
  const o = (await searchRead("sale.order", [["id", "=", id]], ["name", "amount_total", "state", "partner_id"]))[0];
  if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
  let phone = "";
  if (o.partner_id) {
    const p = (await searchRead("res.partner", [["id", "=", o.partner_id[0]]], ["phone"]))[0];
    phone = (p && p.phone) || "";
  }
  res.json({ url: ODOO_BASE + rel, amount_total: o.amount_total, name: o.name, state: o.state, partner: m2o(o.partner_id), phone });
}));

// حذف مسودّة (لا يحذف طلبًا مؤكَّدًا)
r.delete("/api/sales/orders/:id", quote, run(async (req, res) => {
  const id = num(req.params.id);
  const o = (await searchRead("sale.order", [["id", "=", id]], ["state"]))[0];
  if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
  if (!["draft", "sent", "cancel"].includes(o.state)) throw badRequest("لا يمكن حذف طلب مؤكَّد — ألغِه من أودو");
  await unlink("sale.order", [id]);
  res.json({ ok: true });
}));

export default r;
