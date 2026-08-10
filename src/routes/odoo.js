// ===========================================================================
// routes/odoo.js — عمليات Odoo + إعداد الاتصال
//   POST /api/odoo/connect  { serverUrl?, database?, login, password }
//     - لو أُرسلت بيانات خادم كاملة → تُختبر وتُحفظ (إعداد أولي من الواجهة)
//     - لو أُرسل login/password فقط → يُصادَق على أودو ببيانات الخادم المحفوظة
//   POST /api/odoo/test     فحص اتصال
//   POST /api/odoo          { action, params }   (محمي)
//   POST /api/read/:model   قراءة عامة (محمي)
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import * as odoo from "../lib/odooClient.js";
import { isTestMode, setTestMode } from "../lib/settings.js";
import { saveCreds, maskCreds, getEffectiveCreds, hasStoredCreds } from "../lib/odooCreds.js";
import { signToken, setSessionCookie } from "../lib/jwt.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();

// فحص اتصال (عام)
router.post("/odoo/test", async (req, res) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const u = serverUrl || url;
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

// ربط أودو / تسجيل دخول عبر أودو
router.post("/odoo/connect", async (req, res) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const sentUrl = serverUrl || url;
    const sentDb = database || db;
    const userName = login || user;

    if (!userName || !password) {
      return res.status(400).json({ ok: false, error: "يرجى إدخال المستخدم وكلمة المرور" });
    }

    // حدّد بيانات الخادم: المُرسَلة من الواجهة أولًا، وإلا المحفوظة على الخادم
    const stored = getEffectiveCreds();
    const finalUrl = sentUrl || stored.url;
    const finalDb = sentDb || stored.db;

    if (!finalUrl || !finalDb) {
      return res.status(400).json({
        ok: false,
        error: "بيانات خادم أودو غير مضبوطة. اطلب من مدير النظام ضبط رابط الخادم وقاعدة البيانات أولًا.",
      });
    }

    // اختبر البيانات فعليًا على أودو
    const r = await odoo.testCreds({ url: finalUrl, db: finalDb, user: userName, password });

    // احفظ بيانات الاتصال (تصبح مصدر الاتصال الفعّال) واطفِ وضع الاختبار
    saveCreds({ url: finalUrl, db: finalDb, user: userName, password });
    setTestMode(false);
    odoo.clearUidCache();

    // افتح جلسة للمستخدم (JWT cookie) — دوره يُحدَّد لاحقًا من أودو
    const token = signToken({ sub: `odoo:${userName}`, role: "employee", login: userName });
    setSessionCookie(res, token);

    res.json({ ok: true, uid: r.uid, odooVersion: r.odooVersion, connection: maskCreds() });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// محمي بتسجيل الدخول
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
