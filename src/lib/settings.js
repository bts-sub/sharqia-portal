// ===========================================================================
// settings.js — إعدادات وقت التشغيل القابلة للتغيير من واجهة الإعدادات
//   testMode: يُهيّأ من TEST_MODE في .env، ويمكن تبديله يدويًا وحفظه على القرص.
// ===========================================================================
import { readAll, writeAll } from "./store.js";
import { config } from "../config.js";

const KEY = "settings";
let cache = null;

function load() {
  if (cache) return cache;
  const saved = readAll(KEY, null);
  cache = saved && typeof saved === "object" && !Array.isArray(saved)
    ? saved
    : { testMode: config.testMode };
  return cache;
}

export function getSettings() {
  return { ...load() };
}
export function isTestMode() {
  return !!load().testMode;
}
/**
 * شرط اكتمال الملف قبل الطلبات: "block" يمنع، و"warn" يعرض النسبة وما ينقص
 * بلا منع. الافتراضي warn: تشغيل المنع وأغلب الملفات ناقصةٌ من جهة الموارد
 * البشرية يوقف كل الطلبات دفعةً واحدة.
 */
export function profileGateMode() {
  return load().profileGate === "block" ? "block" : "warn";
}
export function setProfileGateMode(mode) {
  const s = load();
  s.profileGate = mode === "block" ? "block" : "warn";
  writeAll(KEY, s);
  cache = s;
  return s.profileGate;
}

export function setTestMode(v) {
  const s = load();
  s.testMode = !!v;
  writeAll(KEY, s);
  cache = s;
  return s.testMode;
}
