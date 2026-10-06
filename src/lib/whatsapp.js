// ===========================================================================
// whatsapp.js — إرسالُ رسالةِ واتساب من الخادم.
//
// ⚠️ واتساب لا يُرسَل من كودٍ وحده: لا بدّ من بوّابةٍ لها حسابٌ ومفتاح.
// وكلُّ ما في هذا النظام قبل اليوم كان يفتح رابط wa.me في متصفّح المستخدم
// ليضغط «إرسال» بيده — وذاك لا ينفع في بلاغٍ يصل ليلًا ولا أحد عند الشاشة.
//
// فالمرسِلُ هنا مهيّأٌ لبوّابتين، يُختار بينهما بمتغيّر بيئة:
//
//   WA_PROVIDER=ultramsg      ← الأسهل: اشتراكٌ شهريٌّ وربطُ جوّالٍ بمسح رمز
//     WA_INSTANCE=instance123
//     WA_TOKEN=xxxxxxxx
//
//   WA_PROVIDER=meta          ← الرسميّ: حسابُ Meta Business وقوالبُ معتمَدة
//     WA_PHONE_ID=123456789
//     WA_TOKEN=EAAG...
//
// وبلا إعدادٍ لا يُرمى خطأ ولا يُكسر شيء: تُردّ «غير مهيّأة» ويُكتب في
// السجلّ مرّةً واحدة — فالبلاغُ يصل هيلب ديسك سواءٌ أوصلت الرسالةُ أم لا.
// ===========================================================================

const PROVIDER = (process.env.WA_PROVIDER || "").trim().toLowerCase();
const TOKEN = (process.env.WA_TOKEN || "").trim();
const INSTANCE = (process.env.WA_INSTANCE || "").trim();
const PHONE_ID = (process.env.WA_PHONE_ID || "").trim();
// مفتاحُ الدولة لمن كتب رقمه محليًّا («05…») — السعودية افتراضًا
const CC = (process.env.WA_COUNTRY_CODE || "966").replace(/\D/g, "");

let warned = false;

export function waConfigured() {
  if (PROVIDER === "ultramsg") return !!(TOKEN && INSTANCE);
  if (PROVIDER === "meta") return !!(TOKEN && PHONE_ID);
  return false;
}

/** يحوّل رقمًا محليًّا إلى صيغةٍ دولية بلا + ولا صفرٍ بادئ. */
export function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  // رقمٌ محليٌّ يبدأ بصفر: يُبدَّل الصفرُ بمفتاح الدولة
  if (d.startsWith("0")) d = CC + d.slice(1);
  // تسعةُ أرقامٍ تبدأ بـ5: جوّالٌ سعوديٌّ كُتب بلا صفرٍ ولا مفتاح
  else if (d.length === 9 && d.startsWith("5")) d = CC + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

/**
 * يُرسل رسالةً نصّية. يردّ { ok, reason? } ولا يرمي أبدًا:
 * تعذُّرُ رسالةٍ لا يُبطل الإجراء الذي أُرسلت لأجله.
 */
export async function sendWhatsApp(to, text) {
  const num = waNumber(to);
  if (!num) return { ok: false, reason: "رقم غير صالح" };
  if (!waConfigured()) {
    if (!warned) {
      warned = true;
      console.warn("⚠️ واتساب غير مهيّأ (WA_PROVIDER/WA_TOKEN) — تُتجاوَز الرسائل.");
    }
    return { ok: false, reason: "not-configured" };
  }
  const body = String(text || "").slice(0, 3500);
  try {
    if (PROVIDER === "ultramsg") {
      const r = await fetch(`https://api.ultramsg.com/${encodeURIComponent(INSTANCE)}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: TOKEN, to: num, body }),
        signal: AbortSignal.timeout(12000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) return { ok: false, reason: j?.error || `HTTP ${r.status}` };
      return { ok: true, id: j?.id || "" };
    }
    if (PROVIDER === "meta") {
      const r = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: num,
          type: "text", text: { preview_url: false, body },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, reason: j?.error?.message || `HTTP ${r.status}` };
      return { ok: true, id: j?.messages?.[0]?.id || "" };
    }
    return { ok: false, reason: "مزوّدٌ غير معروف: " + PROVIDER };
  } catch (e) {
    return { ok: false, reason: e?.message || "تعذّر الاتصال بالبوّابة" };
  }
}

/** يُرسل إلى عدّة أرقام ويردّ كم نجح. */
export async function sendWhatsAppMany(numbers, text) {
  const list = [...new Set((numbers || []).map(waNumber).filter(Boolean))];
  if (!list.length) return { sent: 0, total: 0 };
  const res = await Promise.all(list.map((n) => sendWhatsApp(n, text)));
  return { sent: res.filter((r) => r.ok).length, total: list.length };
}
