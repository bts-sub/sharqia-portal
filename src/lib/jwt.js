// ===========================================================================
// jwt.js — توقيع/تحقق رموز الجلسة + ضبط/مسح كوكي httpOnly
// ===========================================================================
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const COOKIE_NAME = "sharqia_session";

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.jwtTtlHours}h` });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,               // لا يُقرأ من JavaScript في الواجهة (حماية من XSS)
    secure: config.cookieSecure,  // يُرسَل فقط عبر HTTPS في الإنتاج
    sameSite: "lax",
    maxAge: config.jwtTtlHours * 3600 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
