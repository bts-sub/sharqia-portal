// تخزين بيانات الربط (واتساب/جيميل/المتابعات) مشفّرةً بمفتاح السيرفر.
// لماذا ليس بمفتاح كلمة مرور المستخدم؟ لأن المساعد يعمل وصاحبه غير متصل:
// يستقبل رسائل واتساب ويردّ في المتابعات ويكتب التقارير — فلا بد أن يقدر
// السيرفر وحده على فكّها. تبقى مع ذلك مشفّرة على القرص، ولا مسار في لوحة
// الإدارة يعرضها، ولا تُرسل لأي طرف غير واتساب/جيميل/Claude.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DATA_DIR } from "../../config.js";
import { open, seal, subKey } from "../crypto.js";

export const CONNECTORS_ROOT = resolve(DATA_DIR, "connectors");
const ROOT = CONNECTORS_ROOT;
const SAFE = /^[a-zA-Z0-9_-]{6,64}$/;

export function userDir(uid, ...parts) {
  if (!SAFE.test(uid)) throw new Error("معرّف مستخدم غير صالح");
  const dir = resolve(ROOT, uid, ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function wipeConnectors(uid) {
  if (SAFE.test(uid)) rmSync(resolve(ROOT, uid), { recursive: true, force: true });
}

const key = () => subKey("connectors");

export function writeSecure(file, data, aad, replacer) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, seal(key(), Buffer.from(JSON.stringify(data, replacer)), aad), { mode: 0o600 });
  renameSync(tmp, file);
}

export function readSecure(file, aad, reviver) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(open(key(), readFileSync(file), aad).toString("utf8"), reviver);
  } catch (err) {
    console.warn("[secure] تعذّر فك", file, err.message);
    return null;
  }
}
