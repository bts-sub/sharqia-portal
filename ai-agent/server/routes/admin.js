// لوحة المدير: الحسابات والأدوار والحدود والإعدادات والاستهلاك.
// لا يوجد هنا أي مسار يقرأ محادثات أو ملفات الموظفين — والبيانات مشفّرة
// بكلمات مرورهم أصلًا. الإدارة ترى أرقام الاستهلاك فقط.
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AppError, wrap } from "../lib/errors.js";
import {
  adminResetPassword, clearFailures, createUser, deleteUser, getUser, listUsers, publicUser, resetTotp, updateUserByAdmin,
} from "../lib/users.js";
import { audit, readAudit } from "../lib/audit.js";
import { getSettings, updateSettings } from "../lib/settings.js";
import { getUsage } from "../lib/usage.js";
import { vaultSize } from "../lib/vault.js";
import { MODELS } from "../lib/models.js";
import { ROLES } from "../lib/roles.js";
import { testAzure } from "../lib/speech.js";
import { getClient } from "../lib/claude.js";
import { elTestKey, elVoices } from "../lib/elevenlabs.js";
import { waForget, waLogout, waSession } from "../lib/connectors/whatsapp.js";
import { wipeConnectors } from "../lib/connectors/secure.js";
import { disconnectPhone } from "../lib/phone.js";

// يُنهي ربط واتساب ويمسح بيانات الربط (عند الحذف أو إعادة التعيين)
async function dropConnectors(uid) {
  try { if (waSession(uid).meta.linked) await waLogout(uid); } catch {}
  waForget(uid);
  await disconnectPhone(uid).catch(() => {});
  wipeConnectors(uid);
}

const r = Router();

const row = (u) => ({ ...publicUser(u), usage: getUsage(u.id), storageBytes: vaultSize(u.id) });

r.get("/overview", (req, res) => {
  const users = listUsers().map(row);
  const totals = users.reduce(
    (t, u) => ({ usd: t.usd + u.usage.month.usd, messages: t.messages + u.usage.month.messages }),
    { usd: 0, messages: 0 },
  );
  res.json({
    users,
    totals,
    settings: getSettings(),
    roles: ROLES.map(({ id, title, summary }) => ({ id, title, summary })),
    models: Object.entries(MODELS).map(([id, m]) => ({ id, label: m.label, hint: m.hint, in: m.in, out: m.out })),
  });
});

const by = (req) => req.user.username;

r.post("/users", wrap(async (req, res) => {
  const u = await createUser({ ...req.body, mustChangePassword: true });
  audit("user_created", { req, uid: u.id, username: u.username, actor: by(req), detail: u.isAdmin ? "بصلاحية إدارة" : "" });
  res.json(row(u));
}));

r.patch("/users/:id", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) throw new AppError("المستخدم غير موجود", 404);
  if (target.id === req.user.id && (req.body?.isAdmin === false || req.body?.disabled === true)) {
    throw new AppError("لا يمكنك إيقاف حسابك أو سحب صلاحية الإدارة من نفسك", 400);
  }
  const u = updateUserByAdmin(req.params.id, req.body || {});
  const ev = req.body?.disabled === true && !target.disabled ? "user_disabled"
    : req.body?.disabled === false && target.disabled ? "user_enabled" : "user_updated";
  audit(ev, { req, uid: u.id, username: u.username, actor: by(req), detail: Object.keys(req.body || {}).join("، ") });
  if (req.body?.disabled === false) clearFailures(u.id);
  // إيقاف الحساب أو سحب ميزة واتساب: نفصل الجلسة الحيّة (الربط يبقى ويعود عند إعادة التفعيل)
  const wa = waSession(u.id);
  if (u.disabled || !u.limits?.features?.whatsapp) wa.stop();
  else if (wa.meta.linked && wa.status === "idle") wa.start().catch(() => {});
  res.json(row(u));
});

r.post("/users/:id/reset-password", wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError("غيّر كلمة مرورك من صفحة الإعدادات (تحفظ بياناتك)", 400);
  await dropConnectors(req.params.id);
  const u = await adminResetPassword(req.params.id, req.body?.password);
  audit("password_reset", { req, uid: u.id, username: u.username, actor: by(req) });
  res.json(row(u));
}));

r.delete("/users/:id", wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError("لا يمكنك حذف حسابك", 400);
  if (!getUser(req.params.id)) throw new AppError("المستخدم غير موجود", 404);
  const target = getUser(req.params.id);
  await dropConnectors(req.params.id);
  deleteUser(req.params.id);
  audit("user_deleted", { req, uid: target.id, username: target.username, actor: by(req) });
  res.json({ ok: true });
}));

r.put("/settings", (req, res) => {
  const changed = Object.keys(req.body || {}).filter((k) => req.body[k] !== undefined);
  const out = updateSettings(req.body || {});
  // أسماء الحقول فقط — لا تُسجَّل قيم المفاتيح أبدًا
  audit("settings_changed", { req, uid: req.user.id, username: req.user.username, actor: by(req), detail: changed.join("، ") });
  res.json(out);
});

// فقد الموظف جواله: يُطلب منه تفعيل التحقق من جديد عند الدخول (وتُغلق جلساته)
r.post("/users/:id/reset-2fa", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) throw new AppError("المستخدم غير موجود", 404);
  const u = resetTotp(target.id);
  clearFailures(u.id);
  audit("mfa_reset", { req, uid: u.id, username: u.username, actor: by(req) });
  res.json(row(u));
});

r.post("/users/:id/unlock", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) throw new AppError("المستخدم غير موجود", 404);
  clearFailures(target.id);
  res.json(row(getUser(target.id)));
});

r.get("/eleven/voices", wrap(async (req, res) => {
  res.json({ voices: await elVoices() });
}));

r.get("/audit", (req, res) => {
  res.json({ events: readAudit({ limit: Math.min(Number(req.query.limit) || 200, 1000) }) });
});

r.post("/settings/test", wrap(async (req, res) => {
  const what = req.body?.what;
  if (what === "eleven") {
    const voices = await elVoices();
    return res.json({ ok: true, message: `مفتاح ElevenLabs يعمل — ${voices.length} صوت في حسابك` });
  }
  if (what === "azure") {
    await testAzure();
    return res.json({ ok: true, message: "صوت Azure يعمل" });
  }
  try {
    await getClient().models.list({ limit: 1 });
    res.json({ ok: true, message: "مفتاح Claude يعمل" });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AppError("المفتاح غير صالح", 400);
    if (err instanceof AppError) throw err;
    throw new AppError(`تعذّر الاتصال: ${err.message}`.slice(0, 200), 502);
  }
}));

export default r;
