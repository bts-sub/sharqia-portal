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
export function setTestMode(v) {
  const s = load();
  s.testMode = !!v;
  writeAll(KEY, s);
  cache = s;
  return s.testMode;
}
