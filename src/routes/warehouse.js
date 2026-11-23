// ===========================================================================
// warehouse.js — واجهة تطبيق المخازن (warehouse.sharqiaa-tech.net) مع Odoo
//
//   كلّه تحت /api/wh/*. الأمان ثلاث طبقات (نفس تطبيق المبيعات):
//     1) host-gate في server.js: نطاق warehouse لا يصل إلا /api/wh/*.
//     2) مفتاح X-Warehouse-Key يحقنه Nginx الأمامي (بديله X-Sales-Key إن لم يُضبط مفتاحٌ خاص).
//     3) جلسة الموظف: يدخل بنفس حساب تطبيق المبيعات (أدون sales.app.api) — رمز Bearer.
//   العمليات على موديولات المخزون القياسية في أودو (stock.picking / stock.move / stock.quant)
//   عبر عميل البوابة الجاهز — لا أدون جديد ولا ترقية على Odoo.sh.
//
//   الصلاحيات المُعاد استخدامها: receive_stock = الاستلام/التسليم واعتماد الجودة ·
//                                 count        = الجرد والتقارير (شاشة الإدارة).
// ===========================================================================
import { Router } from "express";
import { searchRead, create, write, callButton, execKw } from "../lib/odooClient.js";
import { badRequest, forbidden, tooMany, unauthorized, upstream } from "../lib/errors.js";

const r = Router();
const KEY = (process.env.WAREHOUSE_API_KEY || process.env.SALES_API_KEY || "").trim();
const APP = "sales.app.api"; // نفس أدون حسابات الموظفين (دخول/جلسة/صلاحيات)

const pathOf = (req) => req.originalUrl.split("?")[0];
const m2o = (v) => (Array.isArray(v) ? { id: v[0], name: v[1] } : null);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function odooError(e) {
  const m = String((e && e.message) || "");
  if (/انتهت الجلسة/.test(m)) return Object.assign(unauthorized(m), { auth: true });
  if (/لا صلاحية/.test(m)) return forbidden(m);
  if (/sales\.app\.api|doesn't exist|does not exist/i.test(m)) return upstream("أدون حسابات التطبيق غير مثبّت في أودو بعد");
  if (/Odoo|الاتصال|خادم/.test(m)) return upstream(m);
  return badRequest(m);
}
const run = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { const err = e.status ? e : odooError(e); if (err.auth) sessions.delete(req.appToken); next(err); }
};

// ── طبقة 2: مفتاح Nginx ──
r.use("/api/wh", (req, res, next) => {
  if (pathOf(req) === "/api/wh/health") return next();
  if (!KEY) return res.status(503).json({ error: "خدمة المخازن غير مُهيّأة على الخادم (WAREHOUSE_API_KEY/SALES_API_KEY مفقود)" });
  const got = (req.get("x-warehouse-key") || req.get("x-sales-key") || "");
  if (got !== KEY) return res.status(401).json({ error: "غير مصرّح" });
  next();
});

// ── طبقة 3: جلسة الموظف (نفس أدون المبيعات) ──
const PUBLIC = [/^\/api\/wh\/health$/, /^\/api\/wh\/login$/];
const sessions = new Map();
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

r.use("/api/wh", async (req, res, next) => {
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

// ───────────────────────── الدخول ─────────────────────────
function hitLimited(map, key, max) {
  const now = Date.now(), win = 10 * 60_000;
  const hits = (map.get(key) || []).filter((t) => now - t < win);
  hits.push(now); map.set(key, hits);
  if (map.size > 5000) map.delete(map.keys().next().value);
  return hits.length > max;
}
const loginHits = new Map();

r.get("/api/wh/health", (req, res) => res.json({ ok: true }));

r.post("/api/wh/login", run(async (req, res) => {
  const { login, pin, device } = req.body || {};
  if (!login || !pin) throw badRequest("اكتب اسم الدخول والرمز");
  if (hitLimited(loginHits, req.ip, 20)) throw tooMany("محاولات دخول كثيرة — انتظر 10 دقائق");
  const out = await execKw(APP, "app_login", [String(login), String(pin), String(device || req.get("user-agent") || "").slice(0, 120)]);
  if (!out || !out.ok) return res.status(401).json({ error: (out && out.error) || "تعذّر الدخول" });
  sessions.set(out.token, { user: out.user, at: Date.now() });
  res.json({ token: out.token, user: out.user });
}));

r.get("/api/wh/me", run(async (req, res) => {
  if (req.query.fresh) { sessions.delete(req.appToken); return res.json(await sessionUser(req.appToken)); }
  res.json(req.appUser);
}));

r.post("/api/wh/logout", run(async (req, res) => {
  await execKw(APP, "app_logout", [req.appToken]);
  sessions.delete(req.appToken);
  res.json({ ok: true });
}));

// ───────────────────────── حركات: استلام / تسليم ─────────────────────────
const DIR_CODE = { in: "incoming", out: "outgoing" };
const WAIT_STATES = ["assigned", "confirmed", "waiting"];

// قائمة الحركات المنتظرة
r.get("/api/wh/pickings", perm("receive_stock"), run(async (req, res) => {
  const dir = req.query.dir === "out" ? "out" : "in";
  const dom = [["picking_type_id.code", "=", DIR_CODE[dir]], ["state", "in", WAIT_STATES]];
  const rows = await searchRead("stock.picking", dom,
    ["id", "name", "partner_id", "origin", "scheduled_date", "state", "move_ids", "picking_type_id"],
    { order: "scheduled_date asc, id asc", limit: 200 });
  res.json(rows.map((p) => ({
    id: p.id, name: p.name, dir,
    partner: m2o(p.partner_id), origin: p.origin || "",
    scheduled: p.scheduled_date || "", state: p.state,
    type: m2o(p.picking_type_id), lines: (p.move_ids || []).length,
  })));
}));

// عدّادات للواجهة
r.get("/api/wh/counts", perm("receive_stock"), run(async (req, res) => {
  const cnt = (code) => execKw("stock.picking", "search_count",
    [[["picking_type_id.code", "=", code], ["state", "in", WAIT_STATES]]]);
  const [incoming, outgoing] = await Promise.all([cnt("incoming"), cnt("outgoing")]);
  res.json({ in: incoming, out: outgoing });
}));

// تفاصيل حركة + أصنافها مع أكواد المسح
r.get("/api/wh/pickings/:id", perm("receive_stock"), run(async (req, res) => {
  const id = num(req.params.id);
  const pk = (await searchRead("stock.picking", [["id", "=", id]],
    ["id", "name", "partner_id", "origin", "scheduled_date", "state", "picking_type_id", "note"]))[0];
  if (!pk) throw badRequest("الحركة غير موجودة");
  const dir = (pk.picking_type_id && String(pk.picking_type_id[1]).toLowerCase().includes("delivery")) ||
    (pk.picking_type_id && String(pk.picking_type_id[1]).toLowerCase().includes("pos")) ? "out" : null;
  const moves = await searchRead("stock.move", [["picking_id", "=", id]],
    ["id", "product_id", "product_uom_qty", "quantity", "picked", "product_uom"], { limit: 500 });
  const prodIds = [...new Set(moves.map((mv) => mv.product_id && mv.product_id[0]).filter(Boolean))];
  const prods = prodIds.length
    ? await searchRead("product.product", [["id", "in", prodIds]], ["id", "default_code", "barcode", "name"])
    : [];
  const pmap = Object.fromEntries(prods.map((p) => [p.id, p]));
  const lines = moves.map((mv) => {
    const pp = pmap[(mv.product_id || [])[0]] || {};
    return {
      move_id: mv.id,
      product_id: (mv.product_id || [])[0],
      name: (mv.product_id || [])[1] || pp.name || "",
      code: pp.default_code || "",
      barcode: pp.barcode || "",
      demand: mv.product_uom_qty || 0,
      done: mv.quantity || 0,
      picked: !!mv.picked,
      uom: m2o(mv.product_uom),
    };
  });
  res.json({
    id: pk.id, name: pk.name, state: pk.state,
    dir: pk.picking_type_id && String(pk.picking_type_id[1]).toLowerCase().includes("receipt") ? "in" :
      (pk.picking_type_id && /delivery|pos/i.test(String(pk.picking_type_id[1])) ? "out" : "in"),
    partner: m2o(pk.partner_id), origin: pk.origin || "",
    scheduled: pk.scheduled_date || "", type: m2o(pk.picking_type_id),
    lines,
  });
}));

// نشر ملاحظة جودة + مرفق صورة اختياري على الحركة
async function postQc(pickingId, qc) {
  const ok = qc && qc.pass;
  const title = ok ? "✅ اعتماد الجودة" : "⛔ رفض الجودة";
  const parts = [title];
  if (!ok && qc.reason) parts.push(`السبب: ${qc.reason}`);
  if (qc && qc.note) parts.push(qc.note);
  parts.push(`بواسطة التطبيق`);
  const body = parts.map((t) => String(t)).join("<br/>");
  if (qc && qc.photo) {
    const data = String(qc.photo).replace(/^data:[^,]*,/, "");
    try {
      await create("ir.attachment", {
        name: `جودة-${Date.now()}.jpg`, datas: data,
        res_model: "stock.picking", res_id: pickingId, mimetype: "image/jpeg",
      });
    } catch { /* الصورة اختيارية — لا تُفشل الاعتماد */ }
  }
  await execKw("stock.picking", "message_post", [[pickingId]], { body });
}

// تأكيد الاستلام/التسليم: ضبط الكميات + جودة + ترحيل الحركة في أودو
r.post("/api/wh/pickings/:id/confirm", perm("receive_stock"), run(async (req, res) => {
  const id = num(req.params.id);
  const body = req.body || {};
  const qc = body.qc || {};
  const linesIn = Array.isArray(body.lines) ? body.lines : [];

  const pk = (await searchRead("stock.picking", [["id", "=", id]], ["id", "name", "state"]))[0];
  if (!pk) throw badRequest("الحركة غير موجودة");
  if (pk.state === "done") throw badRequest("الحركة مرحّلة بالفعل");
  if (pk.state === "cancel") throw badRequest("الحركة ملغاة");

  // رفض الجودة: نسجّل الملاحظة ولا نرحّل الحركة — تبقى منتظرة للمراجعة
  if (qc && qc.pass === false) {
    await postQc(id, qc);
    return res.json({ ok: true, status: "rejected", name: pk.name });
  }

  // ضبط الكميات المنفّذة لكل حركة (الافتراضي = المطلوب)
  for (const l of linesIn) {
    const mid = num(l.move_id);
    if (!mid) continue;
    const q = Math.max(0, num(l.quantity, 0));
    await write("stock.move", [mid], { quantity: q, picked: q > 0 });
  }

  // ملاحظة اعتماد الجودة (قبل الترحيل كي تبقى على الحركة)
  await postQc(id, { ...qc, pass: true });

  // ترحيل الحركة. skip_backorder: نُنشئ أمرًا متبقّيًا تلقائيًا للكمية الناقصة
  // (أو — حين backorder=false — لا نُنشئ متبقّيًا).
  const makeBackorder = body.backorder !== false;
  const ctx = makeBackorder
    ? { skip_backorder: true }
    : { skip_backorder: true, picking_ids_not_to_backorder: [id] };
  await execKw("stock.picking", "button_validate", [[id]], { context: ctx });

  const after = (await searchRead("stock.picking", [["id", "=", id]], ["id", "name", "state", "backorder_ids"]))[0] || {};
  const bo = (after.backorder_ids || []).length;
  res.json({ ok: true, status: after.state === "done" ? "done" : (after.state || "pending"), name: pk.name, backorder: bo > 0 });
}));

// مطابقة باركود/كود صنف داخل حركة (للمسح من الواجهة إن احتاجت تأكيدًا من الخادم)
r.get("/api/wh/pickings/:id/match", perm("receive_stock"), run(async (req, res) => {
  const id = num(req.params.id);
  const code = String(req.query.code || "").trim();
  if (!code) throw badRequest("اكتب الكود");
  const prod = (await searchRead("product.product",
    ["|", ["barcode", "=", code], ["default_code", "=", code]], ["id", "name"], { limit: 1 }))[0];
  if (!prod) return res.json({ found: false });
  const mv = (await searchRead("stock.move", [["picking_id", "=", id], ["product_id", "=", prod.id]], ["id"], { limit: 1 }))[0];
  res.json({ found: !!mv, move_id: mv ? mv.id : null, product: { id: prod.id, name: prod.name } });
}));

// ───────────────────────── الجرد (شاشة الإدارة) ─────────────────────────
// رصيد المخزون حسب الصنف (مجمّعًا على المواقع الداخلية)
r.get("/api/wh/inventory", perm("count"), run(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const prodDom = q
    ? ["|", "|", ["product_id.default_code", "ilike", q], ["product_id.barcode", "=", q], ["product_id.name", "ilike", q]]
    : [];
  const dom = [["location_id.usage", "=", "internal"], ["quantity", "!=", 0], ...prodDom];
  const groups = await execKw("stock.quant", "read_group",
    [dom, ["quantity:sum"], ["product_id"]], { limit: 100, orderby: "quantity desc" });
  const prodIds = groups.map((g) => g.product_id && g.product_id[0]).filter(Boolean);
  const prods = prodIds.length
    ? await searchRead("product.product", [["id", "in", prodIds]], ["id", "default_code", "barcode", "name"])
    : [];
  const pmap = Object.fromEntries(prods.map((p) => [p.id, p]));
  res.json(groups.map((g) => {
    const pp = pmap[(g.product_id || [])[0]] || {};
    return {
      product_id: (g.product_id || [])[0],
      name: (g.product_id || [])[1] || pp.name || "",
      code: pp.default_code || "", barcode: pp.barcode || "",
      qty: g.quantity || 0,
    };
  }));
}));

// رصيد صنف بالتفصيل على المواقع (عند فتح صنف في الجرد)
r.get("/api/wh/inventory/:productId", perm("count"), run(async (req, res) => {
  const pid = num(req.params.productId);
  const quants = await searchRead("stock.quant",
    [["product_id", "=", pid], ["location_id.usage", "=", "internal"], ["quantity", "!=", 0]],
    ["id", "location_id", "quantity", "available_quantity"], { limit: 100 });
  res.json(quants.map((q) => ({
    quant_id: q.id, location: m2o(q.location_id),
    qty: q.quantity || 0, available: q.available_quantity || 0,
  })));
}));

// ───────────────────────── التقارير / الداشبورد (الإدارة) ─────────────────────────
r.get("/api/wh/reports", perm("count"), run(async (req, res) => {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.toISOString().slice(0, 19).replace("T", " ");
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19).replace("T", " ");
  const C = (dom) => execKw("stock.picking", "search_count", [dom]);
  const doneToday = (code) => C([["picking_type_id.code", "=", code], ["state", "=", "done"], ["date_done", ">=", today]]);
  const doneWeek = (code) => C([["picking_type_id.code", "=", code], ["state", "=", "done"], ["date_done", ">=", weekAgo]]);
  const waiting = (code) => C([["picking_type_id.code", "=", code], ["state", "in", WAIT_STATES]]);

  const [recvToday, delivToday, recvWeek, delivWeek, waitIn, waitOut] = await Promise.all([
    doneToday("incoming"), doneToday("outgoing"), doneWeek("incoming"), doneWeek("outgoing"),
    waiting("incoming"), waiting("outgoing"),
  ]);

  // إجمالي المخزون (كمية + أصناف متوفّرة)
  const quantAgg = await execKw("stock.quant", "read_group",
    [[["location_id.usage", "=", "internal"], ["quantity", ">", 0]], ["quantity:sum"], []]);
  const totalQty = (quantAgg[0] && quantAgg[0].quantity) || 0;
  const skuAgg = await execKw("stock.quant", "read_group",
    [[["location_id.usage", "=", "internal"], ["quantity", ">", 0]], ["product_id"], ["product_id"], { lazy: false }]);
  const skuCount = Array.isArray(skuAgg) ? skuAgg.length : 0;

  // آخر الحركات المرحّلة
  const recent = await searchRead("stock.picking",
    [["state", "=", "done"], ["picking_type_id.code", "in", ["incoming", "outgoing"]]],
    ["id", "name", "picking_type_id", "partner_id", "date_done", "origin"],
    { order: "date_done desc", limit: 12 });

  res.json({
    received: { today: recvToday, week: recvWeek },
    delivered: { today: delivToday, week: delivWeek },
    waiting: { in: waitIn, out: waitOut },
    stock: { qty: Math.round(totalQty), skus: skuCount },
    recent: recent.map((p) => ({
      id: p.id, name: p.name, dir: /receipt/i.test(String((p.picking_type_id || [])[1])) ? "in" : "out",
      partner: m2o(p.partner_id), when: p.date_done || "", origin: p.origin || "",
    })),
  });
}));

export default r;
