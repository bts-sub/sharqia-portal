// ===========================================================================
// auth.js — حارس الجلسة: يتحقق من كوكي JWT ويحمّل المستخدم في req.user
//   requireAuth: يمنع الوصول بدون جلسة صالحة.
//   requireRole: يقصر المسار على أدوار معيّنة.
// ===========================================================================
import { verifyToken, COOKIE_NAME } from "../lib/jwt.js";
import { findById } from "../lib/users.js";
import { unauthorized, forbidden } from "../lib/errors.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(unauthorized("الجلسة غير صالحة أو منتهية"));
  const user = findById(payload.sub);
  if (!user || user.status !== "active") return next(unauthorized("الحساب غير فعّال"));
  const { passwordHash, ...safe } = user;
  req.user = safe;
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden("هذه الصفحة تتطلب صلاحية أعلى"));
  next();
};
