// ===========================================================================
// routes/support.js — بلاغاتُ الدعم الفني من صفحةٍ عامّة
//   GET  /api/support/options → الأقسامُ والمواقع لقوائم الصفحة
//   POST /api/support         → تذكرةٌ في هيلب ديسك (فريق التقنية)
//
// صفحةٌ بلا دخول: الموظف الذي تعطّل حاسبُه أو شبكتُه لا يستطيع فتح
// التطبيق أصلًا — فاشتراطُ الجلسة يُغلق البابَ في الحال الذي فُتح لأجله.
// ولأنها مفتوحة، كلُّ ما يصل منها يُعامَل كمجهول: يُقصّ، ويُحدّ طولُه،
// ويُحدّ عددُ ما يُرسل من العنوان الواحد في الساعة.
// ===========================================================================
import { Router } from "express";
import { runAction } from "../odooActions.js";
import { badRequest, tooMany } from "../lib/errors.js";
import { findByLogin } from "../lib/users.js";
import { sendToUser } from "../lib/push.js";
import { sendWhatsAppMany, waConfigured } from "../lib/whatsapp.js";

const router = Router();

// ⚠️ القوائمُ تُخبَّأ وتُردّ فورًا ولو كانت قديمة: الأقسامُ والمواقعُ
// تتغيّر مرّةً في الشهر، وانتظارُ أودو ثانيتين قبل أن تُملأ قائمةٌ
// انتظارٌ لا يفهمه من يبلّغ عن عطل.
let OPTS = { at: 0, data: { departments: [], locations: [] } };
let BUSY = false;
async function refresh() {
  if (BUSY) return;
  BUSY = true;
  try {
    const { data } = await runAction("support.options", {}, { user: null });
    if (data && (data.departments?.length || data.locations?.length)) {
      OPTS = { at: Date.now(), data };
    }
  } catch (e) {
    console.warn("⚠️ تعذّر تحديث قوائم الدعم الفني:", e.message);
  } finally { BUSY = false; }
}

// ⚠️ الاستعلامُ بالرقمين معًا: أرقامُ التذاكر متسلسلة، فمن يعرف واحدًا
//    يعرف ما قبله وما بعده — ويقرأ بلاغات الناس وأماكنهم وجوّالاتهم.
//    والجوّالُ هو ما يملكه صاحبُ البلاغ وحده، فهو كلمةُ السرّ.
const LOOKUPS = new Map();
function lookupOk(ip) {
  const now = Date.now();
  const list = (LOOKUPS.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (list.length >= 20) { LOOKUPS.set(ip, list); return false; }
  list.push(now);
  LOOKUPS.set(ip, list);
  if (LOOKUPS.size > 5000) LOOKUPS.clear();
  return true;
}

router.get("/support/status", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!lookupOk(ip)) throw tooMany("محاولاتٌ كثيرة — انتظر قليلًا ثمّ أعد.");
    const ref = String(req.query.ref || "").trim().slice(0, 32);
    const phone = String(req.query.phone || "").trim().slice(0, 20);
    if (!ref) throw badRequest("اكتب رقم الطلب");
    if (phone.replace(/\D/g, "").length < 9)
      throw badRequest("اكتب رقم الجوال الذي قدّمت به البلاغ");
    const { data } = await runAction("support.status", { ref, phone }, { user: null });
    res.set("Cache-Control", "no-store");
    res.json(data || { found: false });
  } catch (e) { next(e); }
});

router.get("/support/options", async (req, res) => {
  const empty = !OPTS.data || !(OPTS.data.departments || []).length;
  if (empty) await refresh();
  else if (Date.now() - OPTS.at > 30 * 60 * 1000) refresh();
  res.set("Cache-Control", "public, max-age=120");
  res.json(OPTS.data || { departments: [], locations: [] });
});

// حدُّ الإرسال: ستّةُ بلاغاتٍ من العنوان الواحد في الساعة. وهو أوسعُ من
// حدّ بوابة البيانات عمدًا — العطلُ الواحد قد يُبلَّغ عنه مرّتين، ومكتبٌ
// كاملٌ قد يخرج إلى الإنترنت بعنوانٍ واحد.
const HITS = new Map();
function rateOk(ip) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const list = (HITS.get(ip) || []).filter((t) => now - t < hour);
  if (list.length >= 6) { HITS.set(ip, list); return false; }
  list.push(now);
  HITS.set(ip, list);
  if (HITS.size > 5000) HITS.clear();
  return true;
}

// ⚠️ بنصّها كما في الصفحة حرفًا بحرف: ما خرج عنها يُسجَّل «أخرى» بلا أن
//    يدري المبلِّغ، فيصل الفنيَّ بلاغٌ بلا باب.
const KINDS = [
  "حاسب آلي", "شبكة وإنترنت", "طابعة أو ماسح", "برنامج أو نظام", "أخرى",
];

router.post("/support", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!rateOk(ip)) {
      throw tooMany("أُرسلت بلاغاتٌ كثيرة من هذا الجهاز خلال ساعة. "
        + "إن كان العطلُ قائمًا فاتصل بالدعم الفني مباشرةً.");
    }
    const b = req.body || {};
    const s = (v, n) => String(v ?? "").trim().slice(0, n);

    const name = s(b.name, 80);
    if (name.length < 3) throw badRequest("اكتب اسمك الثلاثي");
    const phone = s(b.phone, 20);
    if (phone.replace(/\D/g, "").length < 9)
      throw badRequest("رقم الجوال مطلوب — يُتّصل به عند متابعة البلاغ");
    const problem = s(b.problem, 4000);
    if (problem.length < 10) throw badRequest("صف المشكلة في جملةٍ على الأقل");
    const spot = s(b.spot, 80);
    if (!spot) throw badRequest("حدّد مكانك — المكتب أو الخط أو الدور");

    const { data } = await runAction("support.create", {
      name, phone, problem, spot,
      empNo: s(b.empNo, 30),
      department: s(b.department, 60),
      email: s(b.email, 120),
      location: s(b.location, 60),
      kind: KINDS.includes(s(b.kind, 40)) ? s(b.kind, 40) : "أخرى",
      priority: s(b.priority, 1),
      attachment: b.attachment && b.attachment.base64 ? {
        name: s(b.attachment.name, 120),
        base64: String(b.attachment.base64).slice(0, 12 * 1024 * 1024),
      } : null,
    }, { user: null });

    // ⚠️ التنبيهُ بعد الردّ لا قبله: البلاغُ وصل هيلب ديسك فعلًا، وتعذُّرُ
    //    إيقاظِ فنيٍّ لا يُبطله ولا يُقال لصاحبه «لم يُرسل».
    res.json(data);
    notifyIt(data, { name, kind: s(b.kind, 40), location: s(b.location, 60),
                     spot, problem, phone })
      .catch((e) => console.warn("⚠️ تعذّر تنبيه فريق التقنية:", e.message));
  } catch (e) { next(e); }
});

/** يوقظ فريقَ التقنية ببلاغٍ جديد: واتسابًا وإشعارًا في التطبيق ودفعًا. */
async function notifyIt(data, info) {
  const title = `بلاغ دعم جديد — ${info.kind || "أخرى"}`;
  const body = [
    `${info.name || "موظف"}${info.location ? " · " + info.location : ""}`,
    info.spot || "",
    data?.ref ? `رقم الطلب: ${data.ref}` : "",
  ].filter(Boolean).join(" — ");

  const { data: res } = await runAction("support.notify",
    { title, body }, { user: null });

  // الدفعُ إلى الجهاز من هنا لا من أودو: اشتراكاتُ الأجهزة في خادم البوابة.
  for (const login of res?.logins || []) {
    const u = findByLogin(login);
    if (!u) continue;
    sendToUser(u.id, { title, body, tag: "support", url: "/" }).catch(() => {});
  }

  // وواتسابٌ إلى جوّالاتهم: الإشعارُ يصل من فتح التطبيق، والواتسابُ يصل
  // من لم يفتحه — والبلاغُ قد يأتي ليلًا ولا أحد عند الشاشة.
  const phones = res?.phones || [];
  if (phones.length) {
    const text = [
      `🛠️ ${title}`,
      body,
      info.problem ? `\n${String(info.problem).slice(0, 600)}` : "",
      info.phone ? `\nجوّال المبلِّغ: ${info.phone}` : "",
    ].filter(Boolean).join("\n");
    const r = await sendWhatsAppMany(phones, text);
    if (r.total && !r.sent && waConfigured())
      console.warn("⚠️ لم تصل رسالةُ واتساب لأيّ فنيّ من", r.total);
  }
}

export default router;
