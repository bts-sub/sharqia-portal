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

const KINDS = [
  "حاسب آلي", "شبكة وإنترنت", "طابعة أو ماسح", "برنامج أو نظام",
  "جوال أو تابلت", "بريد إلكتروني", "جهاز البصمة", "كاميرات", "أخرى",
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

    res.json(data);
  } catch (e) { next(e); }
});

export default router;
