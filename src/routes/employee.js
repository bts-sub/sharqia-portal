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

// GET /api/employee/completion → نسبة اكتمال الملف وأقسامه وما ينقصه
// GET /api/employee/colleagues → دليل الزملاء (اسم ووظيفة وقسم)
//   تحتاجه مهمّة العمل: من يرافقك فيها؟ والدليل الداخلي ليس سرًّا — الأسماء
//   والأقسام معروفة في المنشأة، ولا يخرج منه راتبٌ ولا رقم هوية.
router.get("/employee/colleagues", async (req, res, next) => {
  try {
    const { data } = await runAction("employee.colleagues", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/employee/completion", async (req, res, next) => {
  try {
    const { data } = await runAction("employee.completion",
      { fresh: req.query.fresh === "1" }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/custody/:id/ack → إقرار الموظف باستلام عهدته
router.post("/custody/:id/ack", async (req, res, next) => {
  try {
    const { data } = await runAction("custody.ack", { id: req.params.id }, { user: req.user });
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


// GET /api/custody/:id/receipt → محضر استلام العهدة PDF بتصميم المنشأة
router.get("/custody/:id/receipt", async (req, res, next) => {
  try {
    const { data } = await runAction("custody.receiptPdf",
      { id: req.params.id }, { user: req.user });
    const buf = Buffer.from(data.base64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    // المستند نفسه لا يتغيّر ما دام مفتوحًا: تخزينٌ خاصّ بالمتصفّح دقائقَ
    // يجعل إعادة فتحه فوريّة، ولا يُشارَك مع مستخدمٍ آخر (private).
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(data.name)}`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
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
