// ===========================================================================
// push.js — إشعارات الدفع (Web Push) إلى أجهزة الموظفين.
//
// قبل هذا كان الإشعار لا يصل إلا والتطبيقُ مفتوح: استطلاعٌ كل ثلاثين ثانية.
// والموظف المستدعى للتحقيق يُغلق تطبيقه كما يُغلقه الناس، فلا يعلم بمحضرٍ
// ولا بموعدٍ حتى يفتحه — والمهل تجري وهو لا يدري. الدفع يصل والتطبيق مغلق،
// فيُبلَّغ ساعةَ صدور الإجراء لا ساعةَ فتحه التطبيق.
//
// المفاتيح (VAPID) تُولَّد مرّةً وتُحفظ في data/ — وهو مجلّدٌ دائم خارج
// الصورة. ولو وُلِّدت في كل إقلاع لبطلت كل الاشتراكات المسجّلة على الأجهزة.
// ===========================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import { readAll, writeAll } from "./store.js";
import { sendFcm, fcmConfigured } from "./fcm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS_FILE = path.resolve(__dirname, "../../data/push-keys.json");
const SUBJECT = process.env.PUSH_SUBJECT || "mailto:hr@sharqia.sa";

let keys = null;

function loadKeys() {
  if (keys) return keys;
  // المفتاحان من البيئة أوّلًا (لمن يديرهما بسرّ منصّة)، وإلا من القرص
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else if (fs.existsSync(KEYS_FILE)) {
    try { keys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")); } catch { keys = null; }
  }
  if (!keys?.publicKey || !keys?.privateKey) {
    keys = webpush.generateVAPIDKeys();
    try {
      fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
      fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), "utf8");
    } catch { /* القرص للقراءة فقط: تعمل الجلسة الحالية ثم تُولَّد من جديد */ }
  }
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

export function publicKey() {
  return loadKeys().publicKey;
}

/** تسجيل جهاز. المفتاح هو endpoint: الجهاز الواحد لا يتكرّر مهما أُعيد الاشتراك. */
export function saveSubscription(userId, sub, meta = {}) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw new Error("اشتراك غير صالح");
  }
  const all = readAll("pushSubs");
  const rest = all.filter((s) => s.endpoint !== sub.endpoint);
  rest.unshift({
    endpoint: sub.endpoint, keys: sub.keys, userId,
    ua: String(meta.ua || "").slice(0, 200),
    at: new Date().toISOString(),
  });
  writeAll("pushSubs", rest);
  return true;
}

export function removeSubscription(endpoint) {
  const all = readAll("pushSubs");
  const rest = all.filter((s) => s.endpoint !== endpoint);
  if (rest.length !== all.length) writeAll("pushSubs", rest);
  return all.length - rest.length;
}

// ── توكنات FCM للتطبيق الأصلي (Android) ──
// الغلاف الأصلي لا يشترك بـ Web Push، بل يسجّل توكن FCM. التوكن هو المفتاح:
// الجهاز الواحد لا يتكرّر مهما أُعيد التسجيل.
export function saveFcmToken(userId, token, meta = {}) {
  if (!token || typeof token !== "string") throw new Error("توكن FCM غير صالح");
  const all = readAll("fcmTokens");
  const rest = all.filter((t) => t.token !== token);
  rest.unshift({
    token, userId,
    ua: String(meta.ua || "").slice(0, 200),
    at: new Date().toISOString(),
  });
  writeAll("fcmTokens", rest);
  return true;
}

export function removeFcmToken(token) {
  const all = readAll("fcmTokens");
  const rest = all.filter((t) => t.token !== token);
  if (rest.length !== all.length) writeAll("fcmTokens", rest);
  return all.length - rest.length;
}

export function countFor(userId) {
  return readAll("pushSubs").filter((s) => s.userId === userId).length
    + readAll("fcmTokens").filter((t) => t.userId === userId).length;
}

/** يُرسل إلى كل أجهزة الموظف، ويحذف ما ردّ الخادمُ بأنه لم يعد قائمًا. */
export async function sendToUser(userId, payload) {
  loadKeys();
  // لا خروجَ مبكّر إن خلت اشتراكات Web Push: قد يكون للموظف توكن FCM (التطبيق
  // الأصلي) بلا اشتراك متصفّح — فالخروج هنا كان يمنع إشعار التطبيق الأصلي.
  const subs = readAll("pushSubs").filter((s) => s.userId === userId);
  const body = JSON.stringify(payload);
  let sent = 0;
  const gone = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys }, body,
        { TTL: 60 * 60 * 24, urgency: "high" });
      sent++;
    } catch (e) {
      // 404/410: الاشتراك انتهى (حُذف التطبيق أو أُعيد ضبط المتصفح)
      if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);
    }
  }));
  if (gone.length) {
    const all = readAll("pushSubs");
    writeAll("pushSubs", all.filter((s) => !gone.includes(s.endpoint)));
  }
  // FCM: أجهزة التطبيق الأصلي (Android) تصلها الإشعارات عبر خدمة جوجل
  // والتطبيق مغلق. يُرسَل إلى كل توكنات الموظف، ويُحذف المنتهي منها.
  let fcm = 0;
  if (fcmConfigured()) {
    const toks = readAll("fcmTokens").filter((t) => t.userId === userId);
    const goneT = [];
    await Promise.all(toks.map(async (t) => {
      const r = await sendFcm(t.token, payload).catch(() => ({ ok: false, gone: false }));
      if (r.ok) fcm++;
      else if (r.gone) goneT.push(t.token);
    }));
    if (goneT.length) {
      const all = readAll("fcmTokens");
      writeAll("fcmTokens", all.filter((t) => !goneT.includes(t.token)));
    }
  }
  return { sent, gone: gone.length, fcm };
}
