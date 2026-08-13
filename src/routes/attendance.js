// ===========================================================================
// routes/attendance.js — البصمة (حضور/انصراف) بنطاق جغرافي حقيقي
//   POST /api/attendance/punch  { op:"in"|"out", lat, lng, accuracy, mock, device }
//   GET  /api/attendance/locations → النطاقات المعتمدة (لعرضها في التطبيق)
//   GET  /api/attendance/log       → سجل حضور الموظف الحالي
//   التحقق من النطاق يتم هنا لا في المتصفح — تحقّق الواجهة وحده يُتجاوَز.
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { badRequest } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

router.get("/attendance/locations", async (req, res, next) => {
  try {
    const { data } = await runAction("location.list", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/attendance/log", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("attendance.log", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

// مراقبة مواقع الحضور اليوم — للموارد البشرية والأدمن فقط
router.get("/attendance/monitor", async (req, res, next) => {
  try {
    if (!["hr", "admin"].includes(req.user.role)) return res.json({ records: [] });
    const { data } = await runAction("attendance.monitor", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/attendance/punch", async (req, res, next) => {
  try {
    const { op, lat, lng, accuracy, mock, device } = req.body || {};
    if (!["in", "out"].includes(op)) throw badRequest("op يجب أن تكون in أو out");
    const { data } = await runAction("attendance.punch",
      { op, lat, lng, accuracy, mock, device }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
