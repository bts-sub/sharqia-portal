// التشفير: كل مستخدم له مفتاح بيانات (DEK) عشوائي يشفّر محادثاته وملفاته.
// الـDEK نفسه مغلّف بمفتاح مشتقّ من كلمة مرور المستخدم (scrypt) — فلا المدير
// ولا من يملك القرص يقدر يقرأ البيانات بدون كلمة مرور صاحبها.
// أثناء الجلسة يُحمل الـDEK داخل كوكي الجلسة مغلّفًا بمفتاح السيرفر.
import {
  createCipheriv, createDecipheriv, hkdfSync, randomBytes, scrypt,
} from "node:crypto";
import { MASTER_KEY } from "../config.js";

const VERSION_BYTE = 1;
// N=2^14,r=8 ≈ 16MB لكل اشتقاق — مناسب لحاوية بذاكرة صغيرة.
const SCRYPT_OPTS = { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function newSalt() {
  return randomBytes(16).toString("base64");
}

export function newDek() {
  return randomBytes(32);
}

export function deriveKek(password, saltB64) {
  return new Promise((ok, fail) =>
    scrypt(String(password).normalize("NFKC"), Buffer.from(saltB64, "base64"), 32, SCRYPT_OPTS,
      (err, key) => (err ? fail(err) : ok(key))),
  );
}

// [نسخة 1][iv 12][tag 16][ciphertext]
export function seal(key, plain, aad) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from([VERSION_BYTE]), iv, c.getAuthTag(), ct]);
}

export function open(key, buf, aad) {
  if (!buf || buf.length < 29 || buf[0] !== VERSION_BYTE) throw new Error("صيغة تشفير غير معروفة");
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(29)), d.final()]);
}

export const sealB64 = (key, plain, aad) => seal(key, Buffer.from(plain), aad).toString("base64url");
export const openB64 = (key, b64, aad) => open(key, Buffer.from(b64, "base64url"), aad);

// مفاتيح فرعية من المفتاح الرئيسي لكل غرض (فصل الاستخدامات)
const subKeys = new Map();
export function subKey(purpose) {
  if (!subKeys.has(purpose)) {
    subKeys.set(purpose, Buffer.from(hkdfSync("sha256", MASTER_KEY, "sharqia-ai", purpose, 32)));
  }
  return subKeys.get(purpose);
}

// أسرار الإعدادات (مفتاح Claude/Azure) — مشفّرة بمفتاح السيرفر
export const encryptSecret = (text) => sealB64(subKey("settings"), text, "settings");
export const decryptSecret = (b64) => (b64 ? openB64(subKey("settings"), b64, "settings").toString("utf8") : "");
