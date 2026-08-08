// ===========================================================================
// routes/odoo.js — نقطة الدخول الموحّدة لكل عمليات Odoo + توافق مع الواجهة الحالية
//   POST /api/odoo          { action, params }         (الطبقة الموحّدة)
//   POST /api/odoo/test     { serverUrl }              (فحص الاتصال — الواجهة)
//   POST /api/odoo/connect  { ... }                    (توافق قديم — يرجّع uid)
//   POST /api/read/:model   { domain, fields, ... }    (قراءة عامة محمية)
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import * as odoo from "../lib/odooClient.js";
import { isTestMode } from "../lib/settings.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();

// كل مسارات Odoo محمية بتسجيل الدخول
router.use(requireAuth);

// الطبقة الموحّدة
router.post("/odoo", async (req, res, next) => {
  try {
    const { action, params } = req.body || {};
    if (!action) return res.status(400).json({ error: "action مطلوب" });
    const result = await runAction(action, params || {}, { user: req.user });
    res.json(result);
  } catch (e) { next(e); }
});

// فحص الاتصال (الواجهة تنادي /api/odoo/test)
router.post("/odoo/test", async (req, res, next) => {
  try {
    if (isTestMode()) return res.json({ odooVersion: FX_VERSION });
    const r = await odoo.testConnection();
    res.json({ odooVersion: r.odooVersion });
  } catch (e) { next(e); }
});

// توافق قديم: الواجهة القديمة كانت ترسل بيانات الاتصال وتتوقّع uid
router.post("/odoo/connect", async (req, res) => {
  // الإعدادات الحقيقية محفوظة في .env — لا نقبل أسرارًا من الواجهة.
  res.json({ uid: isTestMode() ? 17 : 1, note: "الاتصال يُدار من الخادم عبر .env" });
});

// قراءة عامة (تُستخدم لـ /api/read/hr.leave وغيرها) — محمية
router.post("/read/:model", async (req, res, next) => {
  try {
    const { model } = req.params;
    const { domain = [], fields = [], limit, order, offset } = req.body || {};
    if (isTestMode()) return res.json({ records: [] }); // في الاختبار: استخدم actions المخصّصة بدل القراءة الخام
    const records = await odoo.searchRead(model, domain, fields, { limit, order, offset });
    res.json({ records });
  } catch (e) { next(e); }
});

export default router;
