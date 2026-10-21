// الدخول (كلمة مرور + رمز تطبيق التحقق)، تفعيل التحقق بخطوتين، الخروج، ونشاط الحساب.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { AppError, wrap } from "../lib/errors.js";
import {
  bumpSessions, changeOwnPassword, clearFailures, consumeRecovery, enableTotp, getUser, isLocked, lockMessage,
  pendingTotpOf, publicUser, recordFailure, saveTotpStep, setPendingTotp, setRecovery, totpSecretOf, updateOwnProfile,
  verifyLogin,
} from "../lib/users.js";
import {
  clearSession, issueMfaTicket, issueSession, readMfaTicket, requireAuth, requireReady,
} from "../lib/session.js";
import { getSettings } from "../lib/settings.js";
import { getUsage } from "../lib/usage.js";
import { MODELS } from "../lib/models.js";
import { roleById } from "../lib/roles.js";
import { vaultSize } from "../lib/vault.js";
import { matchRecoveryCode, newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from "../lib/totp.js";
import { audit, readAudit } from "../lib/audit.js";
import { readActivity } from "../lib/activity.js";

const r = Router();

const limiter = (limit, minutes, msg, key) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: key,
    message: { error: msg },
  });

const loginLimiter = limiter(10, 15, "محاولات كثيرة — حاول بعد 15 دقيقة", (req) => `${req.ip}|${String(req.body?.username || "").toLowerCase()}`);
const mfaLimiter = limiter(15, 15, "محاولات كثيرة — حاول بعد 15 دقيقة", (req) => req.ip);

// ===== الدخول =====
r.post("/login", loginLimiter, wrap(async (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  let result;
  try {
    result = await verifyLogin(username, req.body?.password);
  } catch (err) {
    if (err.status === 401 || err.status === 423) {
      audit(err.lockedNow ? "login_locked" : "login_failed", { req, uid: err.uid || null, username, detail: err.status === 423 ? "الحساب مقفل" : "" });
    }
    throw err;
  }
  const { user, dek } = result;
  clearFailures(user.id);
  if (user.totp) {
    // كلمة المرور صحيحة — يبقى رمز التطبيق
    return res.json({ mfaRequired: true, ticket: issueMfaTicket(user, dek) });
  }
  // لم يفعّل التحقق بعد: جلسة محدودة لا تفتح إلا شاشة التفعيل (إلزامي للجميع)
  issueSession(res, user, dek, { mfa: false });
  audit("login_success", { req, uid: user.id, username, detail: "بانتظار تفعيل التحقق بخطوتين" });
  res.json({ ok: true, enroll: true });
}));

r.post("/2fa", mfaLimiter, wrap(async (req, res) => {
  const { user, dek, burn } = readMfaTicket(req.body?.ticket);
  if (isLocked(user)) throw new AppError(lockMessage(user), 423);
  const code = String(req.body?.code || "").trim();
  const useRecovery = Boolean(req.body?.recovery);
  let ok = false;
  if (useRecovery) {
    const idx = matchRecoveryCode(user.totp?.recovery, code);
    if (idx >= 0) {
      consumeRecovery(user.id, idx);
      ok = true;
      audit("recovery_used", { req, uid: user.id, username: user.username, detail: `متبقٍّ ${user.totp.recovery.length - 1}` });
    }
  } else {
    const step = verifyTotp(totpSecretOf(user), code, user.totp?.lastStep || 0);
    if (step) {
      saveTotpStep(user.id, step);
      ok = true;
    }
  }
  if (!ok) {
    const lockedNow = recordFailure(user.id);
    audit(lockedNow ? "login_locked" : "mfa_failed", { req, uid: user.id, username: user.username });
    throw new AppError(lockedNow ? lockMessage(getUser(user.id)) : useRecovery ? "رمز الاسترداد غير صحيح" : "الرمز غير صحيح — تأكد من الرمز الحالي في التطبيق", 401);
  }
  burn();
  clearFailures(user.id);
  issueSession(res, getUser(user.id), dek, { mfa: true });
  audit("login_success", { req, uid: user.id, username: user.username });
  res.json({ ok: true });
}));

r.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// ===== بيانات «أنا» =====
export function mePayload(user, { mfa = true } = {}) {
  const s = getSettings();
  const role = roleById(user.agent?.role);
  const allowed = user.limits?.models?.length ? user.limits.models : Object.keys(MODELS);
  return {
    user: publicUser(user),
    security: { mfa, totpEnabled: Boolean(user.totp) },
    role: { id: role.id, title: user.agent?.role === "custom" ? user.agent.customTitle || "مساعد مخصّص" : role.title, summary: role.summary },
    usage: getUsage(user.id),
    storageBytes: vaultSize(user.id),
    org: { name: s.orgName, hasKey: s.hasAnthropicKey, cloudVoice: s.hasAzure },
    models: allowed.map((id) => ({ id, label: MODELS[id].label, hint: MODELS[id].hint })),
    defaultModel: allowed.includes(user.model) ? user.model : allowed.includes(s.defaultModel) ? s.defaultModel : allowed[0],
  };
}

r.get("/me", requireAuth, (req, res) => {
  if (req.mfa) {
    try { req.vault.sweepOrphans(); } catch (err) { console.warn("[sweep]", err.message); }
  }
  res.json(mePayload(req.user, { mfa: req.mfa }));
});

// ===== تفعيل التحقق بخطوتين =====
r.post("/2fa/setup", requireAuth, wrap(async (req, res) => {
  if (req.user.totp) throw new AppError("التحقق بخطوتين مفعّل بالفعل", 409);
  if (req.user.mustChangePassword) throw new AppError("غيّر كلمة المرور المؤقتة أولًا", 403);
  const secret = newTotpSecret();
  setPendingTotp(req.user.id, secret);
  const url = otpauthUrl(secret, req.user.username);
  res.json({
    qr: await QRCode.toDataURL(url, { margin: 1, width: 260 }),
    secret: secret.match(/.{1,4}/g).join(" "),
    url,
  });
}));

r.post("/2fa/enable", requireAuth, mfaLimiter, wrap(async (req, res) => {
  if (req.user.totp) throw new AppError("التحقق بخطوتين مفعّل بالفعل", 409);
  const secret = pendingTotpOf(req.user);
  if (!secret) throw new AppError("ابدأ التفعيل من جديد", 400);
  const step = verifyTotp(secret, req.body?.code, 0);
  if (!step) throw new AppError("الرمز غير صحيح — اكتب الرمز الظاهر الآن في التطبيق (يتغيّر كل 30 ثانية)", 400);
  const { codes, hashes } = newRecoveryCodes();
  const user = enableTotp(req.user.id, { secret, step, recovery: hashes });
  issueSession(res, user, req.dek, { mfa: true });
  audit("mfa_enabled", { req, uid: user.id, username: user.username });
  res.json({ ok: true, recoveryCodes: codes });
}));

r.post("/2fa/recovery", requireAuth, requireReady, mfaLimiter, wrap(async (req, res) => {
  const step = verifyTotp(totpSecretOf(req.user), req.body?.code, req.user.totp?.lastStep || 0);
  if (!step) throw new AppError("الرمز غير صحيح", 400);
  saveTotpStep(req.user.id, step);
  const { codes, hashes } = newRecoveryCodes();
  setRecovery(req.user.id, hashes);
  audit("recovery_regenerated", { req, uid: req.user.id, username: req.user.username });
  res.json({ recoveryCodes: codes });
}));

// ===== كلمة المرور والجلسات =====
r.post("/change-password", requireAuth, wrap(async (req, res) => {
  const { user, dek } = await changeOwnPassword(req.user.id, req.body?.oldPassword, req.body?.newPassword);
  issueSession(res, user, dek, { mfa: req.mfa }); // الجلسات الأخرى تُبطَل، وهذه تُجدَّد
  audit("password_changed", { req, uid: user.id, username: user.username });
  res.json({ ok: true });
}));

r.post("/logout-all", requireAuth, requireReady, (req, res) => {
  const user = bumpSessions(req.user.id);
  issueSession(res, user, req.dek, { mfa: true });
  audit("logout_all", { req, uid: user.id, username: user.username });
  res.json({ ok: true });
});

r.get("/activity", requireAuth, requireReady, (req, res) => {
  res.json({ security: readAudit({ uid: req.user.id, limit: 40 }), actions: readActivity(req.user.id, 40) });
});

r.patch("/profile", requireAuth, requireReady, wrap(async (req, res) => {
  const u = updateOwnProfile(req.user.id, { agent: req.body?.agent, prefs: req.body?.prefs });
  res.json(mePayload(u, { mfa: req.mfa }));
}));

export default r;
