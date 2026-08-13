// ===========================================================================
// odooBridge.js — الجسر العكسي: backend → Odoo (/sharqia_portal/user_event)
//   كان الجسر أحادي الاتجاه (Odoo → backend فقط)، فحقل «آخر دخول» في منصّة
//   التحكّم يبقى فارغًا للأبد رغم أن المسار في الأدون مكتمل وصحيح.
//   نداء «أطلق وانسَ»: لا يُنتظَر فلا يؤخّر تسجيل الدخول ولا يُفشله إن كان
//   أودو متوقفًا. كل الأخطاء تُبتلع إلى السجل.
// ===========================================================================
import { getEffectiveCreds } from "./odooCreds.js";
import { config } from "../config.js";

export function notifyOdooUserEvent(login, event = "login") {
  const url = getEffectiveCreds().url;      // نفس مضيف JSON-RPC هو مضيف الـ controller
  const token = config.integrationToken;
  if (!url || !token || !login) return;     // الجسر غير مضبوط — تجاهل بصمت
  fetch(`${url}/sharqia_portal/user_event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    // ⚠️ بلا status عمدًا: الـ controller يكتب ما يصله فوق حالة أودو، فإرسالها
    //    يمسح قرار إيقاف اتّخذته الموارد البشرية من داخل أودو.
    body: JSON.stringify({ login, event }),
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => {
      // 404 = لا يوجد sharqia.portal.user بهذا الدخول (مثل الأدمن المحلي) — ليس خطأً
      if (!r.ok && r.status !== 404) {
        console.warn(`⚠️ أودو رفض حدث الدخول (${r.status}) للمستخدم ${login}`);
      }
    })
    .catch((e) => console.warn("⚠️ تعذّر إبلاغ أودو بحدث الدخول:", e.message));
}
