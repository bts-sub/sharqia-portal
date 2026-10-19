// إعدادات منصّة المساعدين — تُقرأ من البيئة مع قيم افتراضية آمنة.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(here, "..");
export const PORT = parseInt(process.env.PORT || "4200", 10);
export const IS_PROD = process.env.NODE_ENV === "production";
export const DATA_DIR = resolve(process.env.AI_DATA_DIR || resolve(ROOT, "data"));
export const WEB_DIST = resolve(ROOT, "web", "dist");
export const VERSION = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;

mkdirSync(DATA_DIR, { recursive: true });

// المفتاح الرئيسي: يشفّر أسرار الإعدادات (مفاتيح Claude/Azure) ويغلّف مفتاح
// بيانات المستخدم داخل جلسته. الأفضل تمريره من البيئة (AI_MASTER_KEY) حتى لا
// يجتمع مع البيانات على نفس القرص؛ وإلا يُولَّد مرّة ويُحفظ في data/master.key.
function loadMasterKey() {
  const fromEnv = (process.env.AI_MASTER_KEY || "").trim();
  if (fromEnv) {
    const buf = Buffer.from(fromEnv, /^[0-9a-f]{64}$/i.test(fromEnv) ? "hex" : "base64");
    if (buf.length !== 32) throw new Error("AI_MASTER_KEY يجب أن يكون 32 بايت (64 حرف hex)");
    return buf;
  }
  const file = resolve(DATA_DIR, "master.key");
  if (existsSync(file)) return Buffer.from(readFileSync(file, "utf8").trim(), "hex");
  const key = randomBytes(32);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  console.warn("[config] AI_MASTER_KEY غير مضبوط — وُلِّد مفتاح وحُفظ في data/master.key");
  return key;
}

export const MASTER_KEY = loadMasterKey();

// مدة الجلسة: أسبوعان (تطبيق جوال يُفتح يوميًا؛ أقصر من ذلك مزعج).
export const SESSION_DAYS = parseInt(process.env.AI_SESSION_DAYS || "14", 10);

// سقوف الحماية (لحماية سيرفر صغير الذاكرة والقرص)
export const LIMITS = {
  pdfBytes: 20 * 1024 * 1024,
  imageBytes: 5 * 1024 * 1024,
  textBytes: 1.5 * 1024 * 1024,
  convAttachBytes: 32 * 1024 * 1024, // مجموع مرفقات المحادثة الواحدة
  maxToolRounds: 12, // أقصى جولات أدوات في دور واحد
};
