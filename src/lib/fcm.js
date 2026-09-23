// ===========================================================================
// fcm.js — إرسال إشعارات الدفع الأصلية عبر Firebase Cloud Messaging (HTTP v1).
//
// الغلاف الأصلي (Capacitor/Android) لا يدعم Web Push، فالإشعار يصل والتطبيق
// مغلق عبر خدمة جوجل (FCM) لا عبر VAPID. لا نستعمل firebase-admin: نوقّع JWT
// بمفتاح حساب الخدمة (RS256 عبر crypto) نحصل به على access_token، ثم نرسل.
//
// مفتاح حساب الخدمة سرّيّ: يُقرأ من data/fcm-sa.json (مجلّد مُثبَّت خارج الصورة،
// بصلاحيات 600) ولا يُكتب في الكود ولا يُطبع.
// ===========================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = process.env.FCM_SA_PATH || path.resolve(__dirname, "../../data/fcm-sa.json");

let sa = null, saTried = false;
let cachedTok = null, cachedExp = 0;

function loadSa() {
  if (saTried) return sa;
  saTried = true;
  try { sa = JSON.parse(fs.readFileSync(SA_PATH, "utf8")); }
  catch { sa = null; }
  return sa;
}

export function fcmConfigured() {
  return !!(loadSa() && sa.client_email && sa.private_key && sa.project_id);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// access_token من مفتاح حساب الخدمة (JWT موقَّع RS256 → token_uri). يُخزَّن مؤقتًا.
async function accessToken() {
  const s = loadSa();
  if (!s) throw new Error("مفتاح FCM غير متوفر");
  const now = Math.floor(Date.now() / 1000);
  if (cachedTok && now < cachedExp - 60) return cachedTok;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: s.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: s.token_uri || "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const input = header + "." + claim;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(input), s.private_key);
  const jwt = input + "." + b64url(sig);
  const res = await fetch(s.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.access_token) throw new Error("تعذّر الحصول على توكن FCM");
  cachedTok = j.access_token;
  cachedExp = now + (j.expires_in || 3600);
  return cachedTok;
}

/**
 * إرسال إشعارٍ إلى توكن جهازٍ واحد.
 * يعيد { ok, gone } — gone=true إن كان التوكن منتهيًا (يُحذف عند المنادي).
 */
export async function sendFcm(token, payload) {
  const s = loadSa();
  if (!s) return { ok: false, gone: false };
  let tok;
  try { tok = await accessToken(); }
  catch { return { ok: false, gone: false }; }
  const data = {};
  for (const [k, v] of Object.entries(payload.data || {})) data[k] = String(v);
  const msg = {
    message: {
      token,
      notification: {
        title: payload.title || "موظفين الشرقية",
        body: payload.body || "",
      },
      data,
      android: { priority: "high", notification: { sound: "default" } },
    },
  };
  let res;
  try {
    res = await fetch(`https://fcm.googleapis.com/v1/projects/${s.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  } catch { return { ok: false, gone: false }; }
  if (res.ok) return { ok: true, gone: false };
  const err = await res.text().catch(() => "");
  const gone = res.status === 404 || /UNREGISTERED|NOT_FOUND|InvalidRegistration|Requested entity was not found/i.test(err);
  return { ok: false, gone };
}
