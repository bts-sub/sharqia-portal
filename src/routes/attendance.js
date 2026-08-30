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
import * as odoo from "../lib/odooClient.js";

const router = Router();
router.use(requireAuth);

// GET /api/attendance/device-punches?date=YYYY-MM-DD → بصمات الموظف الحالي من
// أجهزة البصمة في يومٍ معيّن (بتوقيت الرياض)، معها العدد والاتجاه والفرع.
router.get("/attendance/device-punches", async (req, res, next) => {
  try {
    const empId = req.user?.odooEmployeeId;
    if (!empId) return res.json({ date: req.query.date || "", count: 0, punches: [] });
    // اليوم بتوقيت الرياض → حدوده بـ UTC (‏00:00 الرياض = 21:00 UTC اليوم السابق)
    const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date : new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const startUtc = new Date(`${day}T00:00:00+03:00`);
    const endUtc = new Date(startUtc.getTime() + 24 * 3600e3);
    const fmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
    const rows = await odoo.searchRead("hr.attendance.raw",
      [["employee_id", "=", empId],
        ["punch_time", ">=", fmt(startUtc)],
        ["punch_time", "<", fmt(endUtc)]],
      ["punch_time", "device_code", "direction"], { order: "punch_time" });
    const devs = await odoo.searchRead("attendance.device", [], ["code", "name"]);
    const devName = Object.fromEntries(devs.map((d) => [d.code, d.name]));
    const punches = rows.map((r, i) => {
      const local = new Date(r.punch_time.replace(" ", "T") + "Z");
      local.setHours(local.getHours() + 3);   // الرياض
      return {
        time: local.toISOString().slice(11, 16),
        branch: devName[r.device_code] || r.device_code || "",
        direction: r.direction || (i % 2 === 0 ? "in" : "out"),
      };
    });
    res.json({ date: day, count: punches.length, punches });
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر جلب البصمات"));
  }
});

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

// حالة اليوم — تبدأ منها شاشة البصمة بدل ذاكرة المتصفح
router.get("/attendance/today", async (req, res, next) => {
  try {
    const { data, warning } = await runAction("attendance.today", {}, { user: req.user });
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ...(data || {}), ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

router.post("/attendance/punch", async (req, res, next) => {
  try {
    const { op, lat, lng, accuracy, mock, device, photo, verify } = req.body || {};
    if (!["in", "out"].includes(op)) throw badRequest("op يجب أن تكون in أو out");
    const { data } = await runAction("attendance.punch",
      { op, lat, lng, accuracy, mock, device, photo, verify }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
