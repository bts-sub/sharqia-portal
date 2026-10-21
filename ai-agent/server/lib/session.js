// الجلسة: كوكي httpOnly يحمل JWT موقّعًا فيه مفتاح بيانات المستخدم مغلّفًا
// بمفتاح السيرفر. سرقة القرص وحدها لا تكفي لقراءة البيانات (تلزم الكوكي)،
// وسرقة الكوكي وحدها لا تكفي (يلزم مفتاح السيرفر).
//
// التحقق بخطوتين إلزامي: الجلسة تحمل mfa=true فقط بعد إدخال رمز التطبيق.
// قبل ذلك لا يُسمح إلا بمسارات التفعيل وتغيير كلمة المرور.
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { IS_PROD, SESSION_DAYS } from "../config.js";
import { openB64, sealB64, subKey } from "./crypto.js";
import { getUser } from "./users.js";
import { Vault } from "./vault.js";
import { AppError } from "./errors.js";

export const COOKIE = "sq_ai";
const jwtSecret = () => subKey("jwt");
const ticketSecret = () => subKey("mfa-ticket");

export function issueSession(res, user, dek, { mfa = false } = {}) {
  const k = sealB64(subKey("session-dek"), dek, user.id);
  const token = jwt.sign({ sub: user.id, tv: user.tv, k, mfa: Boolean(mfa) }, jwtSecret(), {
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
    return { user, dek, mfa: p.mfa === true };
  } catch {
    return null;
  }
}

// تذكرة قصيرة العمر بين «كلمة المرور صحيحة» و«رمز التحقق صحيح» (5 دقائق، 5 محاولات)
const ticketTries = new Map();
export function issueMfaTicket(user, dek) {
  const n = randomBytes(9).toString("base64url");
  ticketTries.set(n, 0);
  setTimeout(() => ticketTries.delete(n), 6 * 60 * 1000).unref?.();
  const k = sealB64(subKey("mfa-dek"), dek, `${user.id}:${n}`);
  return jwt.sign({ sub: user.id, tv: user.tv, k, n }, ticketSecret(), { algorithm: "HS256", expiresIn: "5m" });
}

export function readMfaTicket(ticket) {
  let p;
  try {
    p = jwt.verify(String(ticket || ""), ticketSecret(), { algorithms: ["HS256"] });
  } catch {
    throw new AppError("انتهت مهلة التحقق — سجّل الدخول من جديد", 401);
  }
  const tries = ticketTries.get(p.n);
  if (tries === undefined || tries >= 5) throw new AppError("محاولات كثيرة — سجّل الدخول من جديد", 401);
  ticketTries.set(p.n, tries + 1);
  const user = getUser(p.sub);
  if (!user || user.disabled || user.tv !== p.tv) throw new AppError("انتهت مهلة التحقق — سجّل الدخول من جديد", 401);
  const dek = openB64(subKey("mfa-dek"), p.k, `${user.id}:${p.n}`);
  return { user, dek, burn: () => ticketTries.delete(p.n) };
}

export function requireAuth(req, res, next) {
  const s = readSession(req);
  if (!s) return next(new AppError("انتهت الجلسة — سجّل الدخول من جديد", 401));
  req.user = s.user;
  req.dek = s.dek;
  req.mfa = s.mfa;
  req.vault = new Vault(s.user.id, s.dek);
  next();
}

// لا وصول للمحادثات والملفات والإدارة قبل: تغيير كلمة المرور المؤقتة + التحقق بخطوتين
export function requireReady(req, res, next) {
  if (req.user.mustChangePassword) return next(new AppError("يجب تغيير كلمة المرور أولًا", 403));
  if (!req.mfa) return next(new AppError("يجب تفعيل التحقق بخطوتين أولًا", 403));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new AppError("هذه الصفحة للإدارة فقط", 403));
  next();
}
