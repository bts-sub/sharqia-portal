// ===========================================================================
// routes/settings.js — حالة الاتصال ووضع الاختبار (لشاشة الإعدادات)
//   GET  /api/settings               → { testMode, connection, odoo }
//   POST /api/settings/test-mode     { enabled }        (مدير النظام فقط)
//   POST /api/settings/test-connection                  فحص فعلي للاتصال
//   POST /api/settings/disconnect                       مسح بيانات أودو والعودة للاختبار
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getSettings, setTestMode, isTestMode } from "../lib/settings.js";
import { connectionStatus, testConnection, clearUidCache } from "../lib/odooClient.js";
import { maskCreds, clearCreds } from "../lib/odooCreds.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();
router.use(requireAuth);

router.get("/settings", (req, res) => {
  res.json({
    ...getSettings(),
    odoo: maskCreds(), // { url, db, user, hasPassword, source } — بدون باسورد
    connection: isTestMode()
      ? { connected: false, mode: "test", odooVersion: FX_VERSION }
      : { ...connectionStatus(), mode: "odoo" },
  });
});

router.post("/settings/test-mode", requireRole("admin"), (req, res) => {
  const enabled = setTestMode(!!req.body?.enabled);
  clearUidCache();
  res.json({ testMode: enabled });
});

router.post("/settings/test-connection", requireRole("admin", "hr"), async (req, res, next) => {
  try {
    if (isTestMode()) return res.json({ ok: true, mode: "test", odooVersion: FX_VERSION });
    const r = await testConnection();
    res.json({ ok: true, mode: "odoo", odooVersion: r.odooVersion });
  } catch (e) { next(e); }
});

// فصل أودو: مسح البيانات المحفوظة والعودة لوضع الاختبار
router.post("/settings/disconnect", requireRole("admin"), (req, res) => {
  clearCreds();
  clearUidCache();
  setTestMode(true);
  res.json({ ok: true, testMode: true, odoo: maskCreds() });
});

export default router;
