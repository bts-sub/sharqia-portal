// ===========================================================================
// routes/users.js — مستخدمو التطبيق كما هم في أودو (شاشة «إدارة المستخدمين»)
//   GET   /api/users        → قائمة sharqia.portal.user الحقيقية
//   POST  /api/users        → إنشاء مستخدم في أودو
//   PATCH /api/users/:id    → تغيير الدور أو الحالة أو الموظف المرتبط
//
// أودو هو مصدر الحقيقة للمستخدمين والأدوار (roleSync يقرأ منه عند كل دخول)،
// فالشاشة تقرأ منه وتكتب فيه مباشرة — لا نسخة ثانية تتباعد عنه بمرور الوقت.
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { runAction, PORTAL_ROLES, ROLE_LABEL_AR } from "../odooActions.js";

const router = Router();
router.use(requireAuth);

// قائمة المستخدمين + الأدوار المتاحة (لتبني الواجهة قوائمها من المصدر لا من ثوابت)
router.get("/users", requireRole("admin", "hr"), async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("portalUser.list", {}, { user: req.user });
    res.json({
      ...(data || { records: [] }),
      roles: PORTAL_ROLES.map((key) => ({ key, label: ROLE_LABEL_AR[key] })),
      odooSource: source,
      ...(warning ? { warning } : {}),
    });
  } catch (e) { next(e); }
});

// إنشاء مستخدم — admin فقط: إنشاء مستخدم يمنح صلاحية دخول للنظام
router.post("/users", requireRole("admin"), async (req, res, next) => {
  try {
    const { data } = await runAction("portalUser.create", req.body || {}, { user: req.user });
    res.status(201).json({ ok: true, user: data });
  } catch (e) { next(e); }
});

router.patch("/users/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { data } = await runAction("portalUser.update",
      { ...(req.body || {}), id: req.params.id }, { user: req.user });
    res.json({ ok: true, user: data });
  } catch (e) { next(e); }
});

export default router;
