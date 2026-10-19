// لوحة المدير: الحسابات والأدوار والحدود والإعدادات والاستهلاك.
// لا يوجد هنا أي مسار يقرأ محادثات أو ملفات الموظفين — والبيانات مشفّرة
// بكلمات مرورهم أصلًا. الإدارة ترى أرقام الاستهلاك فقط.
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AppError, wrap } from "../lib/errors.js";
import {
  adminResetPassword, createUser, deleteUser, getUser, listUsers, publicUser, updateUserByAdmin,
} from "../lib/users.js";
import { getSettings, updateSettings } from "../lib/settings.js";
import { getUsage } from "../lib/usage.js";
import { vaultSize } from "../lib/vault.js";
import { MODELS } from "../lib/models.js";
import { ROLES } from "../lib/roles.js";
import { testAzure } from "../lib/speech.js";
import { getClient } from "../lib/agent.js";

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

r.post("/users", wrap(async (req, res) => {
  const u = await createUser({ ...req.body, mustChangePassword: true });
  res.json(row(u));
}));

r.patch("/users/:id", (req, res) => {
  const target = getUser(req.params.id);
  if (!target) throw new AppError("المستخدم غير موجود", 404);
  if (target.id === req.user.id && (req.body?.isAdmin === false || req.body?.disabled === true)) {
    throw new AppError("لا يمكنك إيقاف حسابك أو سحب صلاحية الإدارة من نفسك", 400);
  }
  res.json(row(updateUserByAdmin(req.params.id, req.body || {})));
});

r.post("/users/:id/reset-password", wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new AppError("غيّر كلمة مرورك من صفحة الإعدادات (تحفظ بياناتك)", 400);
  const u = await adminResetPassword(req.params.id, req.body?.password);
  res.json(row(u));
}));

r.delete("/users/:id", (req, res) => {
  if (req.params.id === req.user.id) throw new AppError("لا يمكنك حذف حسابك", 400);
  if (!getUser(req.params.id)) throw new AppError("المستخدم غير موجود", 404);
  deleteUser(req.params.id);
  res.json({ ok: true });
});

r.put("/settings", (req, res) => {
  res.json(updateSettings(req.body || {}));
});

r.post("/settings/test", wrap(async (req, res) => {
  const what = req.body?.what;
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
