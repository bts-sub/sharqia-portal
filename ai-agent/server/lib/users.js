// الحسابات: المدير العام يفتح حسابات الموظفين ويحدّد لكل واحد دوره وحدوده.
// كلمة المرور تُخزَّن كهاش (bcrypt) للتحقق، وتشتق منها مفتاحًا يغلّف مفتاح
// بيانات المستخدم — فإعادة تعيينها من الإدارة تعني بيانات جديدة فارغة.
import bcrypt from "bcryptjs";
import { usersStore } from "./store.js";
import { deriveKek, newDek, newSalt, open, openB64, seal, sealB64, subKey } from "./crypto.js";
import { newId, wipeVault } from "./vault.js";
import { MODELS } from "./models.js";
import { ROLES } from "./roles.js";
import { dropUsage } from "./usage.js";
import { AppError } from "./errors.js";

const DUMMY_HASH = bcrypt.hashSync("dummy-password", 11);
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const GENDERS = ["male", "female"];
const DIALECTS = ["ar-SA", "ar-EG", "en-US"];

export const DEFAULT_LIMITS = {
  monthlyUsd: 20,
  dailyMessages: 0, // 0 = بلا حد
  storageMb: 300,
  models: Object.keys(MODELS),
  features: { voice: true, files: true, folder: true, web: false, whatsapp: false, gmail: false },
  allowCustomize: true, // يسمح للموظف بتغيير اسم المساعد وصوته
};

export function checkPassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) throw new AppError("كلمة المرور يجب ألا تقل عن 8 أحرف", 400);
  if (pw.length > 128) throw new AppError("كلمة المرور طويلة جدًا", 400);
}

const all = () => usersStore.get().users;
export const listUsers = () => all();
export const getUser = (id) => all().find((u) => u.id === id) || null;
export const findByUsername = (username) =>
  all().find((u) => u.username === String(username || "").trim().toLowerCase()) || null;

async function wrapNewKeys(password) {
  const kdfSalt = newSalt();
  const kek = await deriveKek(password, kdfSalt);
  const dek = newDek();
  return {
    passHash: await bcrypt.hash(password, 11),
    kdfSalt,
    wrappedDek: seal(kek, dek, "dek").toString("base64"),
    dek,
  };
}

function cleanAgent(a = {}, base = {}) {
  const out = { ...base };
  if (typeof a.name === "string" && a.name.trim()) out.name = a.name.trim().slice(0, 30);
  if (GENDERS.includes(a.gender)) out.gender = a.gender;
  if (ROLES.some((r) => r.id === a.role)) out.role = a.role;
  if (typeof a.customTitle === "string") out.customTitle = a.customTitle.trim().slice(0, 60);
  if (typeof a.customInstructions === "string") out.customInstructions = a.customInstructions.trim().slice(0, 6000);
  return out;
}

function cleanLimits(l = {}, base = DEFAULT_LIMITS) {
  const out = structuredClone(base);
  const num = (v, max) => (Number.isFinite(+v) && +v >= 0 ? Math.min(+v, max) : undefined);
  if (num(l.monthlyUsd, 10000) !== undefined) out.monthlyUsd = num(l.monthlyUsd, 10000);
  if (num(l.dailyMessages, 100000) !== undefined) out.dailyMessages = Math.floor(num(l.dailyMessages, 100000));
  if (num(l.storageMb, 20000) !== undefined) out.storageMb = Math.floor(num(l.storageMb, 20000));
  if (Array.isArray(l.models)) {
    const ms = l.models.filter((m) => MODELS[m]);
    if (ms.length) out.models = ms;
  }
  if (l.features && typeof l.features === "object") {
    for (const k of Object.keys(DEFAULT_LIMITS.features)) {
      if (typeof l.features[k] === "boolean") out.features[k] = l.features[k];
    }
  }
  if (typeof l.allowCustomize === "boolean") out.allowCustomize = l.allowCustomize;
  return out;
}

export function cleanPrefs(p = {}, base = {}) {
  const out = { ...base };
  if (DIALECTS.includes(p.speechLang)) out.speechLang = p.speechLang;
  if (typeof p.autoSpeak === "boolean") out.autoSpeak = p.autoSpeak;
  if (typeof p.personalNotes === "string") out.personalNotes = p.personalNotes.trim().slice(0, 2000);
  if (typeof p.browserVoice === "string") out.browserVoice = p.browserVoice.slice(0, 120);
  if (typeof p.voiceRate === "number" && p.voiceRate >= 0.6 && p.voiceRate <= 1.6) out.voiceRate = p.voiceRate;
  return out;
}

export async function createUser(input, { isAdmin = false } = {}) {
  const username = String(input.username || "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new AppError("اسم الدخول: من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو . _ -", 400);
  }
  if (findByUsername(username)) throw new AppError("اسم الدخول مستخدم بالفعل", 409);
  checkPassword(input.password);
  const displayName = String(input.displayName || "").trim().slice(0, 60);
  if (!displayName) throw new AppError("الاسم الظاهر مطلوب", 400);

  const keys = await wrapNewKeys(input.password);
  const user = {
    id: newId("u"),
    username,
    displayName,
    jobTitle: String(input.jobTitle || "").trim().slice(0, 60),
    isAdmin: Boolean(isAdmin || input.isAdmin),
    disabled: false,
    mustChangePassword: input.mustChangePassword !== false,
    passHash: keys.passHash,
    kdfSalt: keys.kdfSalt,
    wrappedDek: keys.wrappedDek,
    tv: 1, // نسخة الجلسات — زيادتها تُبطل كل الجلسات القديمة
    agent: cleanAgent(input.agent, { name: "مساعد", gender: "male", role: "general" }),
    model: MODELS[input.model] ? input.model : undefined,
    limits: cleanLimits(input.limits),
    prefs: cleanPrefs(input.prefs, { speechLang: "ar-SA", autoSpeak: false }),
    createdAt: new Date().toISOString(),
  };
  usersStore.update((d) => { d.users.push(user); });
  return user;
}

export function updateUserByAdmin(id, patch) {
  let updated = null;
  usersStore.update((d) => {
    const u = d.users.find((x) => x.id === id);
    if (!u) throw new AppError("المستخدم غير موجود", 404);
    if (typeof patch.displayName === "string" && patch.displayName.trim()) u.displayName = patch.displayName.trim().slice(0, 60);
    if (typeof patch.jobTitle === "string") u.jobTitle = patch.jobTitle.trim().slice(0, 60);
    if (typeof patch.isAdmin === "boolean") u.isAdmin = patch.isAdmin;
    if (typeof patch.disabled === "boolean" && patch.disabled !== u.disabled) {
      u.disabled = patch.disabled;
      u.tv += 1; // إيقاف الحساب يُخرجه فورًا من كل الأجهزة
    }
    if (patch.agent) u.agent = cleanAgent(patch.agent, u.agent);
    if (patch.limits) u.limits = cleanLimits(patch.limits, u.limits);
    if (patch.model === null || patch.model === "") delete u.model;
    else if (MODELS[patch.model]) u.model = patch.model;
    updated = u;
  });
  return updated;
}

export function updateOwnProfile(id, { agent, prefs }) {
  let updated = null;
  usersStore.update((d) => {
    const u = d.users.find((x) => x.id === id);
    if (!u) throw new AppError("المستخدم غير موجود", 404);
    if (agent && u.limits?.allowCustomize !== false) {
      u.agent = cleanAgent({ name: agent.name, gender: agent.gender }, u.agent);
    }
    if (prefs) u.prefs = cleanPrefs(prefs, u.prefs);
    updated = u;
  });
  return updated;
}

// قفل مؤقت بعد محاولات خاطئة متتالية (بغضّ النظر عن عنوان IP — يمنع التخمين الموزّع)
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export function lockMessage(u) {
  const mins = Math.max(1, Math.ceil((u.lock.until - Date.now()) / 60000));
  return `الحساب مقفل مؤقتًا بسبب محاولات خاطئة كثيرة — حاول بعد ${mins} دقيقة`;
}
export const isLocked = (u) => Boolean(u?.lock?.until && Date.now() < u.lock.until);

// يسجّل محاولة فاشلة (كلمة مرور أو رمز تحقق) ويرجع true إن قُفل الحساب الآن
export function recordFailure(id) {
  let lockedNow = false;
  usersStore.update((d) => {
    const x = d.users.find((y) => y.id === id);
    if (!x) return;
    const lock = (x.lock ||= { failed: 0, until: 0 });
    lock.failed += 1;
    if (lock.failed >= LOCK_AFTER) {
      lock.until = Date.now() + LOCK_MS;
      lock.failed = 0;
      lockedNow = true;
    }
  });
  return lockedNow;
}

export function clearFailures(id) {
  const u = getUser(id);
  if (!u?.lock?.failed && !u?.lock?.until) return;
  usersStore.update((d) => { const x = d.users.find((y) => y.id === id); if (x) delete x.lock; });
}

// التحقق من الدخول: يرجع المستخدم ومفتاح بياناته المفكوك.
export async function verifyLogin(username, password) {
  const u = findByUsername(username);
  if (isLocked(u)) throw new AppError(lockMessage(u), 423);
  // مقارنة وهمية عند عدم وجود المستخدم حتى لا يكشف التوقيت وجوده
  const hash = u?.passHash || DUMMY_HASH;
  const ok = await bcrypt.compare(String(password || ""), hash);
  if (!u || !ok) {
    const err = new AppError("اسم الدخول أو كلمة المرور غير صحيحة", 401);
    if (u) {
      err.uid = u.id;
      err.lockedNow = recordFailure(u.id);
      if (err.lockedNow) err.message = lockMessage(getUser(u.id));
    }
    throw err;
  }
  if (u.disabled) throw new AppError("هذا الحساب موقوف — تواصل مع الإدارة", 403);
  const kek = await deriveKek(password, u.kdfSalt);
  const dek = open(kek, Buffer.from(u.wrappedDek, "base64"), "dek");
  return { user: u, dek };
}

// تغيير كلمة المرور بواسطة صاحبها: نفس البيانات، مغلّفة بالكلمة الجديدة.
export async function changeOwnPassword(id, oldPassword, newPassword) {
  checkPassword(newPassword);
  const u = getUser(id);
  if (!u) throw new AppError("المستخدم غير موجود", 404);
  const { dek } = await verifyLogin(u.username, oldPassword).catch(() => {
    throw new AppError("كلمة المرور الحالية غير صحيحة", 400);
  });
  if (oldPassword === newPassword) throw new AppError("اختر كلمة مرور مختلفة عن الحالية", 400);
  const kdfSalt = newSalt();
  const kek = await deriveKek(newPassword, kdfSalt);
  const passHash = await bcrypt.hash(newPassword, 11);
  let updated = null;
  usersStore.update((d) => {
    const x = d.users.find((y) => y.id === id);
    x.passHash = passHash;
    x.kdfSalt = kdfSalt;
    x.wrappedDek = seal(kek, dek, "dek").toString("base64");
    x.mustChangePassword = false;
    x.tv += 1;
    updated = x;
  });
  return { user: updated, dek };
}

// إعادة تعيين من الإدارة: لا يمكن فكّ البيانات القديمة بدون الكلمة القديمة،
// فتُمسح الخزنة ويبدأ المستخدم ببيانات فارغة (هذا هو ضمان الخصوصية).
export async function adminResetPassword(id, newPassword) {
  checkPassword(newPassword);
  const keys = await wrapNewKeys(newPassword);
  wipeVault(id);
  let updated = null;
  usersStore.update((d) => {
    const x = d.users.find((y) => y.id === id);
    if (!x) throw new AppError("المستخدم غير موجود", 404);
    Object.assign(x, {
      passHash: keys.passHash, kdfSalt: keys.kdfSalt, wrappedDek: keys.wrappedDek, mustChangePassword: true,
    });
    x.tv += 1;
    updated = x;
  });
  return updated;
}

export function deleteUser(id) {
  wipeVault(id);
  dropUsage(id);
  usersStore.update((d) => { d.users = d.users.filter((u) => u.id !== id); });
}

// ===== التحقق بخطوتين =====
const totpKey = () => subKey("totp");
export const totpSecretOf = (u) => (u?.totp?.secret ? openB64(totpKey(), u.totp.secret, u.id).toString("utf8") : null);
export const pendingTotpOf = (u) => (u?.totpPending ? openB64(totpKey(), u.totpPending, u.id).toString("utf8") : null);

function patchUser(id, fn) {
  let updated = null;
  usersStore.update((d) => {
    const x = d.users.find((y) => y.id === id);
    if (!x) throw new AppError("المستخدم غير موجود", 404);
    fn(x);
    updated = x;
  });
  return updated;
}

export const setPendingTotp = (id, secret) => patchUser(id, (x) => { x.totpPending = sealB64(totpKey(), secret, id); });

export const enableTotp = (id, { secret, step, recovery }) =>
  patchUser(id, (x) => {
    x.totp = { secret: sealB64(totpKey(), secret, id), lastStep: step, recovery, enabledAt: new Date().toISOString() };
    delete x.totpPending;
  });

export const saveTotpStep = (id, step) => patchUser(id, (x) => { if (x.totp) x.totp.lastStep = step; });
export const consumeRecovery = (id, index) => patchUser(id, (x) => { x.totp?.recovery?.splice(index, 1); });
export const setRecovery = (id, hashes) => patchUser(id, (x) => { if (x.totp) x.totp.recovery = hashes; });

// إعادة ضبط من الإدارة (فقد الجوال): يُطلب التفعيل من جديد، وتُغلق كل الجلسات
export const resetTotp = (id) => patchUser(id, (x) => { delete x.totp; delete x.totpPending; x.tv += 1; });

export const bumpSessions = (id) => patchUser(id, (x) => { x.tv += 1; });

export function publicUser(u) {
  if (!u) return null;
  const { passHash, kdfSalt, wrappedDek, tv, totp, totpPending, lock, ...rest } = u;
  return { ...rest, totpEnabled: Boolean(totp), recoveryLeft: totp?.recovery?.length ?? 0, locked: isLocked(u) };
}
