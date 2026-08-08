// ===========================================================================
// routes/integration.js — جسر Odoo → backend (منصّة التحكّم في المستخدمين)
//   محمي بالمفتاح المشترك فقط (ليس بجلسة مستخدم). يستقبل إجراءات من موديول Odoo:
//   إنشاء/تحديث مستخدم، تفعيل/إيقاف، تصفير كلمة مرور، وإرسال إشعارات.
// ===========================================================================
import { Router } from "express";
import { requireIntegrationToken } from "../middleware/integrationAuth.js";
import { upsertFromOdoo, updateByLogin, setPassword, findByLogin } from "../lib/users.js";
import { insert } from "../lib/store.js";
import { badRequest, notFound } from "../lib/errors.js";

const router = Router();
router.use("/integration", requireIntegrationToken);

router.get("/integration/health", (req, res) => res.json({ ok: true, bridge: "up" }));

// إنشاء/تحديث مستخدم التطبيق وربطه بموظف Odoo
router.post("/integration/users/upsert", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.login) throw badRequest("login مطلوب");
    const user = await upsertFromOdoo(b);
    res.json({ ok: true, id: user.id, login: user.login });
  } catch (e) { next(e); }
});

// تفعيل/إيقاف مستخدم
router.post("/integration/users/:login/status", (req, res, next) => {
  try {
    const status = req.body?.status === "suspended" ? "suspended" : "active";
    const u = updateByLogin(req.params.login, { status });
    if (!u) throw notFound("المستخدم غير موجود");
    res.json({ ok: true, status });
  } catch (e) { next(e); }
});

// تصفير كلمة المرور (تأتي مؤقتة من Odoo — تُخزَّن bcrypt فقط)
router.post("/integration/users/:login/reset-password", async (req, res, next) => {
  try {
    if (!req.body?.password) throw badRequest("password مطلوب");
    if (!findByLogin(req.params.login)) throw notFound("المستخدم غير موجود");
    await setPassword(req.params.login, req.body.password);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// إرسال إشعار لمستخدم (يظهر في التطبيق عبر /api/notifications)
router.post("/integration/notifications", (req, res, next) => {
  try {
    const { login, title, body = "", type = "system" } = req.body || {};
    if (!login || !title) throw badRequest("login و title مطلوبان");
    const user = findByLogin(login);
    if (!user) throw notFound("المستخدم غير موجود");
    const notif = insert("notifs", {
      id: Date.now() + Math.floor(Math.random() * 1000),
      userId: user.id, type, title, body, read: false,
      at: new Date().toISOString(), source: "odoo",
    });
    res.json({ ok: true, id: notif.id });
  } catch (e) { next(e); }
});

export default router;
