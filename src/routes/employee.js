// routes/employee.js — بيانات الموظف الحالي (توافق مع getEmployee في الواجهة)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { config } from "../config.js";

const router = Router();
router.use(requireAuth);

// GET /api/employee/me → كائن الموظف بالشكل الذي تتوقّعه الواجهة
router.get("/employee/me", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("employee.me", {}, { user: req.user });
    // appVersion يُعرض في أسفل شاشة «حسابي» — ليعرف الموظف أي نسخة يستخدم
    // فعلًا، وتُقارن بما هو منشور عند تشخيص أي مشكلة.
    // source/warning يوضّحان مصدر البيانات (odoo / session-fallback / test)
    res.json({ ...(data || {}), appVersion: config.version, source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

// GET /api/custody → عهد الموظف الحالي (من Open HRMS Custody إن كان مثبّتًا)
router.get("/custody", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("custody.list", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

export default router;
