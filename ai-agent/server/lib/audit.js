// سجل الأمان: أحداث الدخول والتغييرات الإدارية (بلا أي محتوى محادثات).
// المدير يرى سجل المنظمة كله، وكل مستخدم يرى أحداث حسابه فقط.
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "../config.js";

const FILE = resolve(DATA_DIR, "audit.log");
const MAX_BYTES = 3 * 1024 * 1024;

export const LABELS = {
  login_success: "دخول ناجح",
  login_failed: "محاولة دخول فاشلة",
  login_locked: "قفل الحساب مؤقتًا (محاولات كثيرة)",
  mfa_failed: "رمز تحقق خاطئ",
  mfa_success: "تحقق بخطوتين ناجح",
  recovery_used: "دخول برمز استرداد",
  mfa_enabled: "تفعيل التحقق بخطوتين",
  mfa_reset: "إعادة ضبط التحقق بخطوتين (من الإدارة)",
  recovery_regenerated: "إنشاء رموز استرداد جديدة",
  password_changed: "تغيير كلمة المرور",
  password_reset: "إعادة تعيين كلمة المرور (من الإدارة)",
  logout_all: "تسجيل خروج من كل الأجهزة",
  user_created: "إنشاء حساب",
  user_updated: "تعديل حساب",
  user_disabled: "إيقاف حساب",
  user_enabled: "تفعيل حساب",
  user_deleted: "حذف حساب",
  settings_changed: "تغيير إعدادات المنظمة",
  whatsapp_linked: "ربط واتساب",
  whatsapp_unlinked: "إلغاء ربط واتساب",
  gmail_linked: "ربط جيميل",
  gmail_unlinked: "إلغاء ربط جيميل",
  phone_agent_synced: "تجهيز/تحديث وكيل المكالمات",
  phone_linked: "ربط رقم المكالمات",
  phone_unlinked: "إلغاء الرد على المكالمات",
};

export function device(ua = "") {
  const os = /iPhone|iPad/.test(ua) ? "آيفون" : /Android/.test(ua) ? "أندرويد" : /Windows/.test(ua) ? "ويندوز" : /Mac OS/.test(ua) ? "ماك" : /Linux/.test(ua) ? "لينكس" : "جهاز";
  const br = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

// req اختياري (لعنوان IP والجهاز). actor = من قام بالفعل، uid = الحساب المتأثر
export function audit(event, { req, uid = null, username = null, actor = null, detail = "" } = {}) {
  const row = {
    ts: new Date().toISOString(),
    event,
    uid,
    username,
    actor,
    ip: req?.ip || null,
    device: req ? device(req.headers["user-agent"]) : null,
    detail: String(detail || "").slice(0, 300),
  };
  try {
    appendFileSync(FILE, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    if (statSync(FILE).size > MAX_BYTES) {
      const lines = readFileSync(FILE, "utf8").trim().split("\n");
      writeFileSync(FILE, `${lines.slice(-Math.floor(lines.length / 2)).join("\n")}\n`, { mode: 0o600 });
    }
  } catch (err) {
    console.warn("[audit]", err.message);
  }
}

export function readAudit({ uid = null, limit = 200 } = {}) {
  if (!existsSync(FILE)) return [];
  const rows = readFileSync(FILE, "utf8").trim().split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const mine = uid ? rows.filter((r) => r.uid === uid) : rows;
  return mine.slice(-limit).reverse().map((r) => ({ ...r, label: LABELS[r.event] || r.event }));
}
