// ===========================================================================
// odooClient.js — عميل Odoo عبر JSON-RPC (/jsonrpc) مع كاش للـ uid
//   بيانات الاتصال تأتي من odooCreds (الواجهة أولًا ثم .env). لا يُرسَل أي سرّ للفرونت.
// ===========================================================================
import { getEffectiveCreds } from "./odooCreds.js";
import { config } from "../config.js";

let uidCache = { uid: null, at: 0, key: "" };
let lastStatus = { connected: false, checkedAt: null, odooVersion: null, error: null };

export function connectionStatus() {
  return { ...lastStatus };
}

// أخطاء الشبكة من fetch تصل كـ "fetch failed" بلا أي دلالة — نترجمها لسبب واضح
// (السبب الحقيقي مدفون في e.cause، وأشهر حالة: تغيّر رابط بِلد Odoo.sh)
const NET_ERRORS = {
  ENOTFOUND: "اسم النطاق غير موجود — تحقّق من ODOO_URL (روابط Odoo.sh للاستيدج تتغيّر مع كل بِلد)",
  EAI_AGAIN: "تعذّر حلّ اسم النطاق (مشكلة DNS مؤقتة)",
  ECONNREFUSED: "الخادم رفض الاتصال — تحقّق من العنوان والمنفذ",
  ECONNRESET: "قُطع الاتصال من الخادم أثناء الطلب",
  ETIMEDOUT: "انتهت مهلة الاتصال بالخادم",
  UND_ERR_CONNECT_TIMEOUT: "انتهت مهلة الاتصال بالخادم",
  CERT_HAS_EXPIRED: "شهادة SSL للخادم منتهية",
  DEPTH_ZERO_SELF_SIGNED_CERT: "شهادة SSL موقّعة ذاتيًا وغير موثوقة",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "تعذّر التحقق من شهادة SSL للخادم",
};

function describeNetError(e, url) {
  const code = e?.cause?.code || e?.code || "";
  const why = NET_ERRORS[code] || e?.cause?.message || e?.message || "سبب غير معروف";
  return new Error(`تعذّر الوصول إلى خادم Odoo (${url}): ${why}${code ? ` [${code}]` : ""}`);
}

async function rpcTo(url, service, method, args) {
  if (!url) throw new Error("عنوان خادم Odoo غير مضبوط");
  let res;
  try {
    res = await fetch(url + "/jsonrpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }),
      signal: AbortSignal.timeout(config.odoo.timeoutMs || 20000),
    });
  } catch (e) {
    throw describeNetError(e, url);
  }
  if (!res.ok && res.status >= 500) {
    throw new Error(`خادم Odoo ردّ بخطأ ${res.status} — تحقّق من حالة البِلد على Odoo.sh`);
  }
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    const msg = data.error?.data?.message || data.error?.message || "خطأ من Odoo";
    throw new Error(msg);
  }
  return data.result;
}

export async function getUid(force = false) {
  const c = getEffectiveCreds();
  const key = `${c.url}|${c.db}|${c.user}`;
  const fresh = uidCache.uid && uidCache.key === key && Date.now() - uidCache.at < config.odoo.uidTtlMs;
  if (fresh && !force) return uidCache.uid;
  const uid = await rpcTo(c.url, "common", "authenticate", [c.db, c.user, c.password, {}]);
  if (!uid) throw new Error("فشلت مصادقة المستخدم مع Odoo (تحقق من قاعدة البيانات/المستخدم/كلمة المرور)");
  uidCache = { uid, at: Date.now(), key };
  return uid;
}

export async function execKw(model, method, args = [], kwargs = {}) {
  const c = getEffectiveCreds();
  const uid = await getUid();
  return rpcTo(c.url, "object", "execute_kw", [c.db, uid, c.password, model, method, args, kwargs]);
}

export const searchRead = (model, domain = [], fields = [], opts = {}) =>
  execKw(model, "search_read", [domain, fields], opts);
export const create = (model, values) => execKw(model, "create", [values]);
export const write = (model, ids, values) => execKw(model, "write", [Array.isArray(ids) ? ids : [ids], values]);
export const unlink = (model, ids) => execKw(model, "unlink", [Array.isArray(ids) ? ids : [ids]]);
export const callButton = (model, method, ids, kwargs = {}) => execKw(model, method, [Array.isArray(ids) ? ids : [ids]], kwargs);

// اختبار بيانات اتصال مُعيّنة (قبل الحفظ)
export async function testCreds({ url, db, user, password }) {
  const clean = (url || "").replace(/\/+$/, "");
  const ver = await rpcTo(clean, "common", "version", []);
  const uid = await rpcTo(clean, "common", "authenticate", [db, user, password, {}]);
  if (!uid) throw new Error("بيانات الدخول غير صحيحة (لم تُقبل من Odoo)");
  return { ok: true, uid, odooVersion: ver?.server_version || "unknown" };
}

export async function testConnection() {
  try {
    const c = getEffectiveCreds();
    const ver = await rpcTo(c.url, "common", "version", []);
    await getUid(true);
    lastStatus = { connected: true, checkedAt: new Date().toISOString(), odooVersion: ver?.server_version || "unknown", error: null };
    return { ok: true, odooVersion: lastStatus.odooVersion };
  } catch (e) {
    lastStatus = { connected: false, checkedAt: new Date().toISOString(), odooVersion: null, error: e.message };
    throw e;
  }
}

export function clearUidCache() { uidCache = { uid: null, at: 0, key: "" }; }
