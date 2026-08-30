// ===========================================================================
// config.js — تحميل كل الإعدادات من متغيرات البيئة في مكان واحد
// ===========================================================================
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

// الإصدار من package.json — يُعاد في /api/health للتأكد من النسخة المنشورة فعلًا
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let appVersion = "0.0.0";
try {
  // replace: يزيل علامة ترتيب البايت (BOM) إن كتب أحدهم الملف بمحرّر يضيفها
  // — JSON.parse يرفضها فيصير الإصدار 0.0.0 بلا سبب ظاهر.
  const raw = fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8").replace(/^﻿/, "");
  appVersion = JSON.parse(raw).version || appVersion;
} catch (e) {
  console.warn("⚠️ تعذّرت قراءة رقم الإصدار من package.json:", e.message);
}

const bool = (v, def = false) =>
  v === undefined ? def : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
const int = (v, def) => (v === undefined || v === "" ? def : parseInt(v, 10));

export const config = {
  version: appVersion,
  port: int(process.env.PORT, 4000),
  env: process.env.NODE_ENV || "production",
  isProd: (process.env.NODE_ENV || "production") === "production",
  cookieSecure: bool(process.env.COOKIE_SECURE, true),
  corsOrigin: process.env.CORS_ORIGIN || "",

  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  jwtTtlHours: int(process.env.JWT_TTL_HOURS, 12),

  admin: {
    email: process.env.ADMIN_EMAIL || "admin@sharqia.sa",
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "مدير النظام",
  },

  odoo: {
    url: (process.env.ODOO_URL || "").replace(/\/+$/, ""),
    db: process.env.ODOO_DB || "",
    user: process.env.ODOO_USER || "",
    password: process.env.ODOO_PASSWORD || "",
    uidTtlMs: int(process.env.ODOO_UID_TTL_MIN, 10) * 60 * 1000,
    timeoutMs: int(process.env.ODOO_TIMEOUT_SEC, 20) * 1000,
  },

  testMode: bool(process.env.TEST_MODE, true),
  frontendFile: process.env.FRONTEND_FILE || "public/index.html",

  // مفتاح مشترك للجسر مع Odoo (يجب أن يطابق sharqia_portal.integration_token في Odoo)
  integrationToken: process.env.INTEGRATION_TOKEN || "",

  // مفتاحٌ ضيّقٌ لوكيل البصمة وحده — يخوّل كتابة بصمةٍ خام لا غير. منفصلٌ عن
  // مفتاح التكامل الذي يدير المستخدمين، فبقاؤه على جهاز العميل لا يعرّض شيئًا
  // سواه، وتدويره لا يمسّ بقية التكامل.
  attendanceToken: process.env.ATTENDANCE_TOKEN || "",
};

// تحذيرات إعداد مبكّرة (لا توقف التشغيل، فقط للانتباه في اللوق)
export function warnConfig(log = console) {
  if (config.jwtSecret === "dev-insecure-secret-change-me")
    log.warn("⚠️  JWT_SECRET غير مضبوط — استخدم قيمة عشوائية طويلة في الإنتاج.");
  if (!config.testMode && !config.odoo.url)
    log.warn("⚠️  TEST_MODE=false لكن ODOO_URL فارغ — سيسقط النظام لوضع الاختبار عند أول نداء.");
}
