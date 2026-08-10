// ===========================================================================
// routes/odoo.js — عمليات Odoo + إعداد الاتصال من الواجهة
//   POST /api/odoo          { action, params }     (الطبقة الموحّدة — محمي)
//   POST /api/odoo/test     { serverUrl, ... }     (فحص اتصال بدون حفظ)
//   POST /api/odoo/connect  { serverUrl, database, login, password }
//                            يختبر ويحفظ بيانات أودو ويطفّي وضع الاختبار
//   POST /api/read/:model   { domain, fields }     (قراءة عامة محمية)
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import * as odoo from "../lib/odooClient.js";
import { isTestMode, setTestMode } from "../lib/settings.js";
import { saveCreds, maskCreds } from "../lib/odooCreds.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();

// ----- فحص اتصال بدون حفظ (عام، لأنه يُستخدم قبل الدخول من شاشة الإعداد) -----
// يقبل serverUrl/database/login/password ويجرّبها فعليًا على أودو
router.post("/odoo/test", async (req, res, next) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const u = serverUrl || url;
    // لو أرسلت بيانات كاملة: اختبرها فعليًا. وإلا افحص الاتصال الحالي.
    if (u && (login || user) && password) {
      const r = await odoo.testCreds({ url: u, db: database || db, user: login || user, password });
      return res.json({ ok: true, odooVersion: r.odooVersion });
    }
    if (isTestMode()) return res.json({ ok: true, odooVersion: FX_VERSION, testMode: true });
    const r = await odoo.testConnection();
    res.json({ ok: true, odooVersion: r.odooVersion });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ----- ربط أودو: يختبر البيانات، يحفظها، ويطفّي وضع الاختبار -----
router.post("/odoo/connect", async (req, res) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const u = serverUrl || url;
    const dbName = database || db;
    const userName = login || user;
    if (!u || !dbName || !userName || !password) {
      return res.status(400).json({ ok: false, error: "يرجى إدخال: عنوان الخادم، قاعدة البيانات، المستخدم، كلمة المرور" });
    }
    // 1) اختبر البيانات فعليًا على أودو
    const r = await odoo.testCreds({ url: u, db: dbName, user: userName, password });
    // 2) احفظها على الخادم (تصبح مصدر الاتصال الفعّال)
    saveCreds({ url: u, db: dbName, user: userName, password });
    // 3) اطفِ وضع الاختبار وامسح كاش الـ uid
    setTestMode(false);
    odoo.clearUidCache();
    res.json({ ok: true, uid: r.uid, odooVersion: r.odooVersion, connection: maskCreds() });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ----- ما يلي محمي بتسجيل الدخول -----
router.use(requireAuth);

router.post("/odoo", async (req, res, next) => {
  try {
    const { action, params } = req.body || {};
    if (!action) return res.status(400).json({ error: "action مطلوب" });
    const result = await runAction(action, params || {}, { user: req.user });
    res.json(result);
  } catch (e) { next(e); }
});

router.post("/read/:model", async (req, res, next) => {
  try {
    const { model } = req.params;
    const { domain = [], fields = [], limit, order, offset } = req.body || {};
    if (isTestMode()) return res.json({ records: [] });
    const records = await odoo.searchRead(model, domain, fields, { limit, order, offset });
    res.json({ records });
  } catch (e) { next(e); }
});

export default router;
