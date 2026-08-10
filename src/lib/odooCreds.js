// ===========================================================================
// odooCreds.js — إدارة بيانات اتصال Odoo المُدخلة من الواجهة (تُحفظ على القرص)
//   الأولوية: البيانات المحفوظة من الواجهة > متغيرات .env
//   الباسورد يُحفظ في data/odoo_creds.json (صلاحياته محظورة) ولا يُرسَل للفرونت أبدًا.
//   عند الترقية لقاعدة بيانات: استبدل readAll/writeAll بنفس الواجهة.
// ===========================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readAll, writeAll } from "./store.js";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const KEY = "odoo_creds";

let cache = null;

// تحميل البيانات المحفوظة (إن وُجدت)
function load() {
  if (cache !== null) return cache;
  const saved = readAll(KEY, null);
  cache =
    saved && typeof saved === "object" && !Array.isArray(saved) && saved.url
      ? saved
      : null;
  return cache;
}

// هل توجد بيانات اتصال مُدخلة من الواجهة؟
export function hasStoredCreds() {
  return !!load();
}

// الحصول على بيانات الاتصال الفعّالة: المحفوظة أولًا ثم .env
export function getEffectiveCreds() {
  const s = load();
  if (s && s.url) {
    return {
      url: (s.url || "").replace(/\/+$/, ""),
      db: s.db || "",
      user: s.user || "",
      password: s.password || "",
      source: "stored",
    };
  }
  return {
    url: config.odoo.url,
    db: config.odoo.db,
    user: config.odoo.user,
    password: config.odoo.password,
    source: "env",
  };
}

// حفظ بيانات اتصال جديدة (بعد التحقق من نجاحها)
export function saveCreds({ url, db, user, password }) {
  const clean = {
    url: (url || "").replace(/\/+$/, ""),
    db: db || "",
    user: user || "",
    password: password || "",
    savedAt: new Date().toISOString(),
  };
  writeAll(KEY, clean);
  cache = clean;
  // تقييد صلاحيات الملف قدر الإمكان (يحوي الباسورد)
  try {
    fs.chmodSync(path.join(DATA_DIR, `${KEY}.json`), 0o600);
  } catch {
    /* تجاهل لو النظام لا يدعم chmod */
  }
  return maskCreds(clean);
}

// حذف البيانات المحفوظة (العودة لـ .env)
export function clearCreds() {
  try {
    fs.unlinkSync(path.join(DATA_DIR, `${KEY}.json`));
  } catch {
    /* الملف غير موجود */
  }
  cache = null;
}

// نسخة آمنة للعرض (بدون باسورد)
export function maskCreds(c = null) {
  const creds = c || getEffectiveCreds();
  return {
    url: creds.url || "",
    db: creds.db || "",
    user: creds.user || "",
    hasPassword: !!creds.password,
    source: creds.source || (load() ? "stored" : "env"),
  };
}
