// سجل أفعال المساعد نيابةً عن المستخدم (رسائل واتساب وإيميلات أُرسلت، متابعات بدأت).
// خاص بصاحب الحساب فقط — مشفّر بمفتاح السيرفر، ولا يظهر في لوحة الإدارة.
import { resolve } from "node:path";
import { readSecure, userDir, writeSecure } from "./connectors/secure.js";

const file = (uid) => resolve(userDir(uid), "activity.enc");
const aad = (uid) => `activity:${uid}`;

export function logActivity(uid, type, detail) {
  try {
    const d = readSecure(file(uid), aad(uid)) || { items: [] };
    d.items.push({ ts: new Date().toISOString(), type, detail: String(detail || "").slice(0, 200) });
    d.items = d.items.slice(-300);
    writeSecure(file(uid), d, aad(uid));
  } catch (err) {
    console.warn("[activity]", err.message);
  }
}

export function readActivity(uid, limit = 50) {
  try {
    return (readSecure(file(uid), aad(uid))?.items || []).slice(-limit).reverse();
  } catch {
    return [];
  }
}
