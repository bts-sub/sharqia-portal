// ===========================================================================
// routes/settings.js — حالة الاتصال ووضع الاختبار (لشاشة الإعدادات)
//   GET  /api/settings           → { testMode, connection }
//   POST /api/settings/test-mode { enabled }   (مدير النظام فقط)
//   POST /api/settings/test-connection         فحص فعلي للاتصال بأودو
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getSettings, setTestMode, isTestMode } from "../lib/settings.js";
import { connectionStatus, testConnection } from "../lib/odooClient.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();
router.use(requireAuth);

router.get("/settings", (req, res) => {
  res.json({
    ...getSettings(),
    connection: isTestMode()
      ? { connected: false, mode: "test", odooVersion: FX_VERSION }
      : { ...connectionStatus(), mode: "odoo" },
  });
});

router.post("/settings/test-mode", requireRole("admin"), (req, res) => {
  const enabled = setTestMode(!!req.body?.enabled);
  res.json({ testMode: enabled });
});

router.post("/settings/test-connection", requireRole("admin", "hr"), async (req, res, next) => {
  try {
    if (isTestMode()) return res.json({ ok: true, mode: "test", odooVersion: FX_VERSION });
    const r = await testConnection();
    res.json({ ok: true, mode: "odoo", odooVersion: r.odooVersion });
  } catch (e) { next(e); }
});

export default router;
