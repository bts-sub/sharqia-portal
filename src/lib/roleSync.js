// ===========================================================================
// roleSync.js — مزامنة دور المستخدم وربطه بالموظف من Odoo عند الحاجة
//   المشكلة التي يحلّها: users.json يُحدَّث فقط حين يضغط أحدهم «مزامنة» في
//   Odoo. فترقية موظف إلى «مدير قسم» في Odoo لا تصل الباك إند إطلاقًا:
//   يستمر النظام يعامله كموظف عادي — فلا صندوق وارد ولا اعتماد — بينما
//   إشعارات Odoo تصله (لأنها تُبنى داخل Odoo من شجرة الموظفين مباشرة).
//   النتيجة المُربكة: «يصلني إشعار بطلب ولا أجده في طلباتي».
// ===========================================================================
import { runAction } from "../odooActions.js";
import { findByLogin, updateByLogin } from "./users.js";

const TTL_MS = 5 * 60 * 1000;
const lastCheck = new Map();   // login → timestamp

/**
 * يوائم دور المستخدم وربطه بالموظف مع Odoo. لا يرمي أبدًا ولا يبطئ الطلب
 * أكثر من نداء واحد كل خمس دقائق لكل مستخدم.
 * @returns {object|null} المستخدم بعد التحديث (أو null إن لم يتغيّر شيء)
 */
export async function syncRoleFromOdoo(login, { force = false } = {}) {
  if (!login) return null;
  const key = String(login).toLowerCase();
  const last = lastCheck.get(key) || 0;
  if (!force && Date.now() - last < TTL_MS) return null;
  lastCheck.set(key, Date.now());
  try {
    const { data } = await runAction("portalUser.get", { login });
    if (!data) return null;
    const cur = findByLogin(login);
    if (!cur) return null;
    const patch = {};
    if (data.role && data.role !== cur.role) patch.role = data.role;
    if (data.odooEmployeeId && data.odooEmployeeId !== cur.odooEmployeeId) {
      patch.odooEmployeeId = data.odooEmployeeId;
    }
    if (data.status && data.status !== cur.status) patch.status = data.status;
    if (!Object.keys(patch).length) return null;
    console.log(`↻ حُدِّث المستخدم ${login} من Odoo: ${JSON.stringify(patch)}`);
    return updateByLogin(login, patch);
  } catch (e) {
    console.warn("⚠️ تعذّرت مزامنة الدور من Odoo:", e.message);
    return null;
  }
}
