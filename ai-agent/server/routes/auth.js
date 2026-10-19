// الدخول والخروج وبيانات «أنا» وتفضيلات المستخدم.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { wrap } from "../lib/errors.js";
import {
  changeOwnPassword, publicUser, updateOwnProfile, verifyLogin,
} from "../lib/users.js";
import { clearSession, issueSession, requireAuth } from "../lib/session.js";
import { getSettings } from "../lib/settings.js";
import { getUsage } from "../lib/usage.js";
import { MODELS } from "../lib/models.js";
import { roleById } from "../lib/roles.js";
import { vaultSize } from "../lib/vault.js";

const r = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.username || "").toLowerCase()}`,
  message: { error: "محاولات كثيرة — حاول بعد 15 دقيقة" },
});

r.post("/login", loginLimiter, wrap(async (req, res) => {
  const { user, dek } = await verifyLogin(req.body?.username, req.body?.password);
  issueSession(res, user, dek);
  res.json({ ok: true });
}));

r.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

export function mePayload(user) {
  const s = getSettings();
  const role = roleById(user.agent?.role);
  const allowed = user.limits?.models?.length ? user.limits.models : Object.keys(MODELS);
  return {
    user: publicUser(user),
    role: { id: role.id, title: user.agent?.role === "custom" ? user.agent.customTitle || "مساعد مخصّص" : role.title, summary: role.summary },
    usage: getUsage(user.id),
    storageBytes: vaultSize(user.id),
    org: { name: s.orgName, hasKey: s.hasAnthropicKey, cloudVoice: s.hasAzure },
    models: allowed.map((id) => ({ id, label: MODELS[id].label, hint: MODELS[id].hint })),
    defaultModel: allowed.includes(user.model) ? user.model : allowed.includes(s.defaultModel) ? s.defaultModel : allowed[0],
  };
}

r.get("/me", requireAuth, (req, res) => {
  try { req.vault.sweepOrphans(); } catch (err) { console.warn("[sweep]", err.message); }
  res.json(mePayload(req.user));
});

r.post("/change-password", requireAuth, wrap(async (req, res) => {
  const { user, dek } = await changeOwnPassword(req.user.id, req.body?.oldPassword, req.body?.newPassword);
  issueSession(res, user, dek); // الجلسات الأخرى تُبطَل، وهذه تُجدَّد
  res.json({ ok: true });
}));

r.patch("/profile", requireAuth, wrap(async (req, res) => {
  const u = updateOwnProfile(req.user.id, { agent: req.body?.agent, prefs: req.body?.prefs });
  res.json(mePayload(u));
}));

export default r;
