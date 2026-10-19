// الجلسة: كوكي httpOnly يحمل JWT موقّعًا فيه مفتاح بيانات المستخدم مغلّفًا
// بمفتاح السيرفر. سرقة القرص وحدها لا تكفي لقراءة البيانات (تلزم الكوكي)،
// وسرقة الكوكي وحدها لا تكفي (يلزم مفتاح السيرفر).
import jwt from "jsonwebtoken";
import { IS_PROD, SESSION_DAYS } from "../config.js";
import { openB64, sealB64, subKey } from "./crypto.js";
import { getUser } from "./users.js";
import { Vault } from "./vault.js";
import { AppError } from "./errors.js";

export const COOKIE = "sq_ai";
const jwtSecret = () => subKey("jwt");

export function issueSession(res, user, dek) {
  const k = sealB64(subKey("session-dek"), dek, user.id);
  const token = jwt.sign({ sub: user.id, tv: user.tv, k }, jwtSecret(), {
    algorithm: "HS256", expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 86400 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: "/", httpOnly: true, secure: IS_PROD, sameSite: "strict" });
}

function readSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const p = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
    const user = getUser(p.sub);
    if (!user || user.disabled || user.tv !== p.tv) return null;
    const dek = openB64(subKey("session-dek"), p.k, user.id);
    return { user, dek };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const s = readSession(req);
  if (!s) return next(new AppError("انتهت الجلسة — سجّل الدخول من جديد", 401));
  req.user = s.user;
  req.dek = s.dek;
  req.vault = new Vault(s.user.id, s.dek);
  next();
}

// أثناء «يجب تغيير كلمة المرور» لا يُسمح إلا بمسارات الحساب
export function requireReady(req, res, next) {
  if (req.user.mustChangePassword) return next(new AppError("يجب تغيير كلمة المرور أولًا", 403));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new AppError("هذه الصفحة للإدارة فقط", 403));
  next();
}
