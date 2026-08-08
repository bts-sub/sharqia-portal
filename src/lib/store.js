// ===========================================================================
// store.js — مخزن JSON بسيط على القرص (قابل للترقية لقاعدة بيانات لاحقًا)
// كل "مجموعة" ملف JSON مستقل داخل مجلد data/. الكتابة ذرّية (ملف مؤقت ثم rename).
// عند الترقية لـ Postgres: استبدل هذا الملف بواجهة نفس الدوال (readAll/insert/update...).
// ===========================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readAll(name, fallback = []) {
  ensureDir();
  const f = fileFor(name);
  if (!fs.existsSync(f)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeAll(name, data) {
  ensureDir();
  const f = fileFor(name);
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, f); // كتابة ذرّية تمنع تلف الملف عند التوقف المفاجئ
  return data;
}

// عمليات مساعدة على مجموعة من السجلات ذات حقل id
export function insert(name, record) {
  const all = readAll(name);
  all.unshift(record);
  writeAll(name, all);
  return record;
}
export function updateById(name, id, patch) {
  const all = readAll(name);
  let updated = null;
  const next = all.map((r) => {
    if (r.id !== id) return r;
    updated = typeof patch === "function" ? patch(r) : { ...r, ...patch };
    return updated;
  });
  writeAll(name, next);
  return updated;
}
export function findById(name, id) {
  return readAll(name).find((r) => r.id === id) || null;
}
