// ===========================================================================
// config.js — تحميل كل الإعدادات من متغيرات البيئة في مكان واحد
// ===========================================================================
import dotenv from "dotenv";
dotenv.config();

const bool = (v, def = false) =>
  v === undefined ? def : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
const int = (v, def) => (v === undefined || v === "" ? def : parseInt(v, 10));

export const config = {
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
  },

  testMode: bool(process.env.TEST_MODE, true),
  frontendFile: process.env.FRONTEND_FILE || "public/index.html",

  // مفتاح مشترك للجسر مع Odoo (يجب أن يطابق sharqia_portal.integration_token في Odoo)
  integrationToken: process.env.INTEGRATION_TOKEN || "",
};

// تحذيرات إعداد مبكّرة (لا توقف التشغيل، فقط للانتباه في اللوق)
export function warnConfig(log = console) {
  if (config.jwtSecret === "dev-insecure-secret-change-me")
    log.warn("⚠️  JWT_SECRET غير مضبوط — استخدم قيمة عشوائية طويلة في الإنتاج.");
  if (!config.testMode && !config.odoo.url)
    log.warn("⚠️  TEST_MODE=false لكن ODOO_URL فارغ — سيسقط النظام لوضع الاختبار عند أول نداء.");
}
