// ===========================================================================
// odooClient.js — عميل Odoo عبر JSON-RPC (/jsonrpc) مع كاش للـ uid
//   - service=common, method=authenticate  → للحصول على uid ومصادقة الخادم
//   - service=object,  method=execute_kw    → لكل عمليات القراءة/الكتابة
//   يستخدم fetch المدمج في Node 18+. لا يُرسَل أي سرّ إلى الواجهة إطلاقًا.
// ===========================================================================
import { config } from "../config.js";

let uidCache = { uid: null, at: 0 };
let lastStatus = { connected: false, checkedAt: null, odooVersion: null, error: null };

export function connectionStatus() {
  return { ...lastStatus };
}

async function rpc(service, method, args) {
  if (!config.odoo.url) throw new Error("ODOO_URL غير مضبوط");
  const res = await fetch(config.odoo.url + "/jsonrpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    const msg = data.error?.data?.message || data.error?.message || "خطأ من Odoo";
    throw new Error(msg);
  }
  return data.result;
}

// مصادقة مع كاش الـ uid لتفادي إعادة المصادقة في كل طلب (TTL من الإعدادات)
export async function getUid(force = false) {
  const fresh = uidCache.uid && Date.now() - uidCache.at < config.odoo.uidTtlMs;
  if (fresh && !force) return uidCache.uid;
  const uid = await rpc("common", "authenticate", [config.odoo.db, config.odoo.user, config.odoo.password, {}]);
  if (!uid) throw new Error("فشلت مصادقة مستخدم الخدمة مع Odoo (تحقق من ODOO_DB/USER/PASSWORD)");
  uidCache = { uid, at: Date.now() };
  return uid;
}

// نداء موحّد لأي method على أي model
export async function execKw(model, method, args = [], kwargs = {}) {
  const uid = await getUid();
  return rpc("object", "execute_kw", [config.odoo.db, uid, config.odoo.password, model, method, args, kwargs]);
}

export const searchRead = (model, domain = [], fields = [], opts = {}) =>
  execKw(model, "search_read", [domain, fields], opts);
export const create = (model, values) => execKw(model, "create", [values]);
export const write = (model, ids, values) => execKw(model, "write", [Array.isArray(ids) ? ids : [ids], values]);
export const unlink = (model, ids) => execKw(model, "unlink", [Array.isArray(ids) ? ids : [ids]]);
export const callButton = (model, method, ids, kwargs = {}) => execKw(model, method, [Array.isArray(ids) ? ids : [ids]], kwargs);

// فحص الاتصال + إصدار Odoo (يحدّث lastStatus)
export async function testConnection() {
  try {
    const ver = await rpc("common", "version", []);
    await getUid(true);
    lastStatus = { connected: true, checkedAt: new Date().toISOString(), odooVersion: ver?.server_version || "unknown", error: null };
    return { ok: true, odooVersion: lastStatus.odooVersion };
  } catch (e) {
    lastStatus = { connected: false, checkedAt: new Date().toISOString(), odooVersion: null, error: e.message };
    throw e;
  }
}

export function clearUidCache() { uidCache = { uid: null, at: 0 }; }
