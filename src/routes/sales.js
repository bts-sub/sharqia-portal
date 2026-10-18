// ===========================================================================
// sales.js — واجهة المبيعات الحقيقية مع Odoo (المنتجات/العملاء/أوامر البيع + لينك الدفع)
//
//   يخدم تطبيق المبيعات على pos.sharqiaa-tech.net. كلّه تحت /api/sales/*.
//   الأمان طبقتان:
//     1) host-gate في server.js: نطاق pos لا يصل إلا /api/sales/*.
//     2) مفتاح X-Sales-Key يحقنه Nginx الأمامي (لا يظهر في جافاسكربت العميل).
//   يعيد استخدام عميل Odoo الجاهز (نفس اعتماد البوابة) — لا سرّ للفرونت إطلاقًا.
// ===========================================================================
import { Router } from "express";
import { searchRead, create, callButton, unlink, execKw } from "../lib/odooClient.js";
import { sendWhatsApp, waConfigured } from "../lib/whatsapp.js";

const r = Router();
const KEY = (process.env.SALES_API_KEY || "").trim();
// رابط بوّابة Odoo الذي يُبنى عليه لينك الدفع (نفس web.base.url على السيرفر)
const ODOO_BASE = (process.env.ODOO_PORTAL_BASE || process.env.ODOO_URL || "https://test.sharqiaa-tech.net").replace(/\/+$/, "");

// بوّابة المفتاح لكل مسارات المبيعات
r.use("/api/sales", (req, res, next) => {
  if (req.path === "/api/sales/health") return next();
  if (!KEY) return res.status(503).json({ error: "خدمة المبيعات غير مُهيّأة على الخادم (SALES_API_KEY مفقود)" });
  if ((req.get("x-sales-key") || "") !== KEY) return res.status(401).json({ error: "غير مصرّح" });
  next();
});

const m2o = (v) => (Array.isArray(v) ? { id: v[0], name: v[1] } : null);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

r.get("/api/sales/health", (req, res) => res.json({ ok: true, odooBase: ODOO_BASE }));

// ───────────────────────── المنتجات ─────────────────────────
r.get("/api/sales/products", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(num(req.query.limit, 40), 100);
    const offset = Math.max(num(req.query.offset, 0), 0);
    const domain = [["sale_ok", "=", true]];
    if (q) domain.push("|", "|", ["name", "ilike", q], ["default_code", "ilike", q], ["barcode", "ilike", q]);
    const rows = await searchRead(
      "product.product",
      domain,
      ["name", "default_code", "barcode", "list_price", "qty_available", "uom_id"],
      { limit, offset, order: "name" }
    );
    res.json(rows.map((p) => ({
      id: p.id, name: p.name, code: p.default_code || "", barcode: p.barcode || "",
      price: p.list_price, qty: p.qty_available, uom: m2o(p.uom_id)?.name || "",
    })));
  } catch (e) { next(e); }
});

// ───────────────────────── العملاء ─────────────────────────
r.get("/api/sales/customers", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(num(req.query.limit, 30), 100);
    const domain = [];
    if (q) domain.push("|", ["name", "ilike", q], ["phone", "ilike", q]);
    const rows = await searchRead("res.partner", domain, ["name", "phone", "email", "city"], { limit, order: "name" });
    res.json(rows.map((p) => ({ id: p.id, name: p.name, phone: p.phone || "", email: p.email || "", city: p.city || "" })));
  } catch (e) { next(e); }
});

r.post("/api/sales/customers", async (req, res, next) => {
  try {
    const { name, phone, email, city } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "اسم العميل مطلوب" });
    const id = await create("res.partner", {
      name: String(name).trim(), phone: phone || false, email: email || false, city: city || false, customer_rank: 1,
    });
    res.json({ id, name: String(name).trim() });
  } catch (e) { next(e); }
});

// ───────────────────────── أوامر البيع ─────────────────────────
r.get("/api/sales/orders", async (req, res, next) => {
  try {
    const limit = Math.min(num(req.query.limit, 25), 50);
    const rows = await searchRead("sale.order", [], ["name", "partner_id", "state", "amount_total", "date_order"], { limit, order: "id desc" });
    res.json(rows.map((o) => ({ id: o.id, name: o.name, partner: m2o(o.partner_id), state: o.state, amount_total: o.amount_total, date: o.date_order })));
  } catch (e) { next(e); }
});

r.get("/api/sales/orders/:id", async (req, res, next) => {
  try {
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
  } catch (e) { next(e); }
});

// إنشاء عرض سعر (مسودّة) — آمن: لا يؤكّد الطلب تلقائيًا
r.post("/api/sales/orders", async (req, res, next) => {
  try {
    const { partner_id, lines, note } = req.body || {};
    if (!partner_id) return res.status(400).json({ error: "اختر العميل" });
    if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ error: "أضف منتجًا واحدًا على الأقل" });
    const order_line = lines.map((l) => {
      const vals = { product_id: num(l.product_id), product_uom_qty: num(l.qty, 1) || 1 };
      if (l.price_unit != null && l.price_unit !== "") vals.price_unit = num(l.price_unit);
      return [0, 0, vals];
    });
    const vals = { partner_id: num(partner_id), order_line, require_payment: true };
    if (note) vals.note = String(note);
    const id = await create("sale.order", vals);
    res.json({ id });
  } catch (e) { next(e); }
});

// تأكيد الطلب (مسودّة → أمر بيع مؤكّد)
r.post("/api/sales/orders/:id/confirm", async (req, res, next) => {
  try { await callButton("sale.order", "action_confirm", [num(req.params.id)]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// لينك الدفع/المعاينة (نفس زرار Preview في أمر البيع)
r.get("/api/sales/orders/:id/payment-link", async (req, res, next) => {
  try {
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
  } catch (e) { next(e); }
});

// إرسال لينك الدفع عبر واتساب (بوّابة الخادم إن كانت مُهيّأة) + دائمًا يرجّع رابط wa.me للمشاركة اليدوية
r.post("/api/sales/orders/:id/send-link", async (req, res, next) => {
  try {
    const id = num(req.params.id);
    const to = String((req.body && req.body.phone) || "").trim();
    const rel = await execKw("sale.order", "get_portal_url", [[id]]);
    const o = (await searchRead("sale.order", [["id", "=", id]], ["name", "amount_total"]))[0];
    if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
    const link = ODOO_BASE + rel;
    const msg = `طلبكم من بيت العباءة الشرقية ${o.name}\nالإجمالي: ${o.amount_total} ر.س\nلمراجعة الطلب والدفع:\n${link}`;
    let sent = false, error = null;
    if (to && waConfigured()) {
      try { await sendWhatsApp(to, msg); sent = true; } catch (e) { error = e.message; }
    }
    const waUrl = `https://wa.me/${to.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
    res.json({ sent, error, link, message: msg, waUrl, gateway: waConfigured() });
  } catch (e) { next(e); }
});

// حذف مسودّة (للتنظيف/الاختبار — لا يحذف طلبًا مؤكَّدًا)
r.delete("/api/sales/orders/:id", async (req, res, next) => {
  try {
    const id = num(req.params.id);
    const o = (await searchRead("sale.order", [["id", "=", id]], ["state"]))[0];
    if (!o) return res.status(404).json({ error: "الطلب غير موجود" });
    if (!["draft", "sent", "cancel"].includes(o.state)) return res.status(400).json({ error: "لا يمكن حذف طلب مؤكَّد — ألغِه من أودو" });
    await unlink("sale.order", [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
