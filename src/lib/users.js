// ===========================================================================
// users.js — مستخدمو التطبيق (مصادقة محلية) مخزّنون في data/users.json
// كل مستخدم مربوط بموظف Odoo عبر odooEmployeeId (أو empNo/login كبديل).
// كلمات المرور مخزّنة كـ bcrypt hash فقط — لا يُخزَّن أي نص صريح.
// ===========================================================================
import bcrypt from "bcryptjs";
import { readAll, writeAll } from "./store.js";
import { config } from "../config.js";

const COLLECTION = "users";
const ROLES = ["employee", "manager", "hr", "finance", "it", "admin"];

const genId = (all) => "U" + String(all.reduce((m, u) => Math.max(m, +String(u.id).slice(1) || 0), 0) + 1);

export function listUsers() {
  // لا نُعيد hash كلمة المرور إطلاقًا
  return readAll(COLLECTION).map(({ passwordHash, ...u }) => u);
}
export function findByLogin(login) {
  return readAll(COLLECTION).find((u) => u.login.toLowerCase() === String(login).trim().toLowerCase()) || null;
}
export function findById(id) {
  return readAll(COLLECTION).find((u) => u.id === id) || null;
}

export async function createUser({ login, password, name, role = "employee", odooEmployeeId = null, empNo = null, dept = "", branch = "" }) {
  if (!login || !password) throw new Error("login و password مطلوبان");
  if (!ROLES.includes(role)) throw new Error(`دور غير معروف: ${role} (المتاح: ${ROLES.join(", ")})`);
  const all = readAll(COLLECTION);
  if (all.some((u) => u.login.toLowerCase() === login.toLowerCase())) throw new Error("هذا البريد مستخدم مسبقًا");
  const user = {
    id: genId(all),
    login: login.trim(),
    name: name || login,
    role,
    odooEmployeeId,
    empNo,
    dept,
    branch,
    status: "active",
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
    lastLogin: null,
  };
  all.unshift(user);
  writeAll(COLLECTION, all);
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function setPassword(login, newPassword) {
  const all = readAll(COLLECTION);
  const u = all.find((x) => x.login.toLowerCase() === login.toLowerCase());
  if (!u) throw new Error("المستخدم غير موجود");
  u.passwordHash = await bcrypt.hash(newPassword, 10);
  writeAll(COLLECTION, all);
  return true;
}

export function deleteUser(login) {
  const all = readAll(COLLECTION);
  const next = all.filter((u) => u.login.toLowerCase() !== login.toLowerCase());
  if (next.length === all.length) throw new Error("المستخدم غير موجود");
  writeAll(COLLECTION, next);
  return true;
}

// تحديث حقول مستخدم عبر login (يستخدمه جسر Odoo)
export function updateByLogin(login, patch) {
  const all = readAll(COLLECTION);
  const u = all.find((x) => x.login.toLowerCase() === String(login).toLowerCase());
  if (!u) return null;
  Object.assign(u, patch);
  writeAll(COLLECTION, all);
  const { passwordHash, ...safe } = u;
  return safe;
}

// إنشاء أو تحديث مستخدم قادم من Odoo (منصّة التحكّم). كلمة مرور مؤقتة عند الإنشاء.
export async function upsertFromOdoo({ login, name, role = "employee", status = "active", odooEmployeeId = null, empNo = null, dept = "", branch = "" }) {
  if (!login) throw new Error("login مطلوب");
  const existing = findByLogin(login);
  const st = status === "suspended" ? "suspended" : "active";
  if (existing) {
    return updateByLogin(login, { name: name || existing.name, role, status: st, odooEmployeeId, empNo, dept, branch });
  }
  // إنشاء بكلمة مرور مؤقتة عشوائية (تُصفَّر لاحقًا عبر reset-password من Odoo)
  const bytes = (await import("crypto")).randomBytes(12).toString("base64url");
  const created = await createUser({ login, password: bytes, name, role, odooEmployeeId, empNo, dept, branch });
  if (st === "suspended") updateByLogin(login, { status: "suspended" });
  return created;
}

export function touchLastLogin(id) {
  const all = readAll(COLLECTION);
  const u = all.find((x) => x.id === id);
  if (u) { u.lastLogin = new Date().toISOString(); writeAll(COLLECTION, all); }
}

// إنشاء أول مدير نظام تلقائيًا من متغيرات البيئة إن لم يوجد أي مستخدم
export async function seedAdminIfEmpty(log = console) {
  const all = readAll(COLLECTION);
  if (all.length > 0) return false;
  if (!config.admin.password) {
    log.warn("⚠️  لا يوجد مستخدمون ولم تُضبط ADMIN_PASSWORD — لن يُنشأ حساب أدمن. استخدم: npm run users add");
    return false;
  }
  await createUser({ login: config.admin.email, password: config.admin.password, name: config.admin.name, role: "admin" });
  log.info(`✅ أُنشئ حساب مدير النظام: ${config.admin.email}`);
  return true;
}

export { ROLES };
