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

// POST /api/employee/photo → تغيير صورة الموظف في Odoo من داخل التطبيق
//   الموظف يغيّر صورته هو فقط: معرّف الموظف يُشتق من الجلسة ولا يُقبل من العميل.
router.post("/employee/photo", async (req, res, next) => {
  try {
    const { data } = await runAction("employee.photo",
      { image: req.body?.image }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/custody → عهد الموظف الحالي (من Open HRMS Custody إن كان مثبّتًا)
router.get("/custody", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("custody.list", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

// GET /api/loans → سلف الموظف الحالي من نظام القروض في Odoo
router.get("/loans", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("loan.list", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

// GET /api/team → الفريق المباشر لصاحب الجلسة (يغذّي شاشات المدير)
router.get("/team", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("team.list", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

export default router;
