// ===========================================================================
// routes/auth.js — تسجيل الدخول/الخروج والملف الشخصي (مصادقة محلية)
//   POST /api/login   { login, password } → يضبط كوكي الجلسة + يرجّع الملف
//   POST /api/logout  → يمسح الكوكي
//   GET  /api/me      → الملف الشخصي للمستخدم الحالي
// ===========================================================================
import { Router } from "express";
import { findByLogin, verifyPassword, touchLastLogin } from "../lib/users.js";
import { signToken, setSessionCookie, clearSessionCookie } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { notifyOdooUserEvent } from "../lib/odooBridge.js";

const router = Router();

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) throw badRequest("يرجى إدخال اسم المستخدم وكلمة المرور");
    const user = findByLogin(login);
    const ok = user && user.status === "active" && (await verifyPassword(user, password));
    if (!ok) throw unauthorized("بيانات الدخول غير صحيحة");
    touchLastLogin(user.id);
    notifyOdooUserEvent(user.login);   // بلا await — لا يؤخّر الرد ولا يُفشله
    const token = signToken({ sub: user.id, role: user.role, login: user.login });
    setSessionCookie(res, token);
    const { passwordHash, ...safe } = user;
    res.json({ ok: true, user: safe });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
