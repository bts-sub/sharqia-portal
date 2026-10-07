// routes/join.js — الموقع العامّ لملفّ الموظف الذاتي.
//
// ⚠️ هذا البابُ الوحيد المفتوح بلا حساب في البوابة كلها، فحدودُه مشدودة:
//   • لا يقرأ شيئًا — يكتب فقط. فلا يُستخرج منه اسمُ موظفٍ ولا رقمُه.
//   • يُحدّ بعنوان الإنترنت: ملفّان في الساعة من العنوان الواحد. من أراد
//     إغراق أودو بملفّاتٍ وهمية لا يجد بابًا مفتوحًا.
//   • الحجمُ مسقوف: ملفٌّ بصورٍ أربع لا يتجاوز ٢٤ ميجابايت.
//   • وما يصل لا يصير موظفًا: يُنشأ سجلًّا مؤرشفًا لا يُفعَّل إلا باعتمادين.
import { Router } from "express";
import { runAction } from "../odooActions.js";
import { badRequest, tooMany } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { putFile, takeFile } from "../lib/joinUploads.js";

const router = Router();

// ---------------------------------------------------------------------------
// الموظف القائم: يفتحها من التطبيق ببياناته مُعبّأة فيصحّحها، ولا يُنشأ له
// سجلٌّ ثانٍ — ملفُّه يُربط بسجلّه، والاعتمادان يُحدّثانه لا يُنشئانه.
// ---------------------------------------------------------------------------
router.get("/me/intake", requireAuth, async (req, res, next) => {
  try {
    const { data } = await runAction("intake.mine", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e?.status ? e : badRequest(e?.message || "تعذّرت القراءة")); }
});

router.post("/me/intake", requireAuth, async (req, res, next) => {
  try {
    const vals = buildIntakeVals(req.body || {});
    const { data } = await runAction("intake.submitMine", { vals }, { user: req.user });
    res.json(data);
  } catch (e) { next(e?.status ? e : badRequest(e?.message || "تعذّر إرسال الملف")); }
});


// ---------------------------------------------------------------------------
// رفعُ مرفقٍ واحد — قبل إرسال الملف وبعد اختياره مباشرةً.
//   ⚠️ الرفعُ ملفًّا ملفًّا يُنجّي البقيّة: طلبٌ واحدٌ يحمل عشرين ميجابايت
//   على شبكة جوّالٍ متوسّطة ينقطع في منتصفه فيسقط كلُّ شيء، ولا يدري صاحبُه
//   أيُّ ملفٍّ أعجزه. وهنا ما وصل بقي، وما انقطع يُعاد وحده.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// استعادةُ ملفٍّ أُعيد للتصحيح — من أيّ جهاز.
//   ⚠️ لا يُفتح إلا لملفٍّ أعادته الموارد البشرية، وبرمز رابطه أو برقمه مع
//   رقم الهوية معًا. وبلا هذا القيد يصير الرابطُ العامُّ بابًا لقراءة بيانات
//   موظفٍ بمعرفة رقم هويته.
// ---------------------------------------------------------------------------
const RES_RATE = new Map();
function resOk(ip) {
  const now = Date.now();
  const hits = (RES_RATE.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= 10) return false;
  hits.push(now); RES_RATE.set(ip, hits);
  return true;
}

router.get("/join/resume/:token", async (req, res, next) => {
  try {
    const { data } = await runAction("intake.resume",
      { token: req.params.token }, { user: null });
    res.json(data || { ok: false });
  } catch (e) { next(badRequest(e?.message || "تعذّرت الاستعادة")); }
});

router.post("/join/resume", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!resOk(ip)) throw tooMany("محاولاتٌ كثيرة — انتظر ساعةً أو راجع الموارد البشرية.");
    const { data } = await runAction("intake.resumeByRef",
      { value: req.body?.value || req.body?.ref || req.body?.idNumber }, { user: null });
    res.json(data || { ok: false });
  } catch (e) { next(e?.status ? e : badRequest(e?.message || "تعذّرت الاستعادة")); }
});

const UP_RATE = new Map();
function upOk(ip) {
  const now = Date.now();
  const hits = (UP_RATE.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  // ⚠️ ومثلُه حدُّ المرفقات: مئتا موظفٍ بأربعة مرفقاتٍ لكلٍّ = ثمانمئة
  //   رفعة، وستّون منها تُوقف الرابطَ عند الموظف الخامس عشر.
  if (hits.length >= 1500) return false;          // ألفٌ وخمسمئة مرفقٍ في الساعة
  hits.push(now); UP_RATE.set(ip, hits);
  if (UP_RATE.size > 3000) {
    for (const [k, v] of UP_RATE) if (!v.some((t) => now - t < 36e5)) UP_RATE.delete(k);
  }
  return true;
}

router.post("/join/:token/file", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!upOk(ip)) throw tooMany("مرفقاتٌ كثيرة من هذا الجهاز خلال ساعة.");
    const { base64, name } = req.body || {};
    const saved = await putFile({ base64, name });
    res.json({ ok: true, fid: saved.fid, bytes: saved.bytes });
  } catch (e) {
    // ⚠️ يُكتب في السجلّ باسمه وحجمه: مرفقٌ يُردّ ولا أثرَ له في الخادم
    //   يُبحث عن سببه في جهاز الموظف — وهو هنا.
    console.warn("⚠️ تعذّر رفع مرفق «%s» (%s بايت): %s",
      String(req.body?.name || "—").slice(0, 80),
      String(req.body?.base64 || "").length, e?.message || e);
    next(e?.status ? e : badRequest(e?.message || "تعذّر رفع المرفق"));
  }
});

// ذاكرةُ المعدّل: عنوان → أوقات الإرسال. تُنظَّف من القديم في كل نداء،
// فلا تنمو بلا حدّ ولا تحتاج مهمّةً مجدولة.
// ⚠️ الحدُّ على العنوان يفترض أنّ وراءه رجلًا واحدًا — وهذا يسقط في
// المنشأة: مئتا موظفٍ على شبكة المصنع يخرجون كلُّهم بعنوانٍ واحد، فيمرّ
// الأوّلُ والثاني ويُردّ الباقون بـ«أُرسل ملفّان من هذا الجهاز خلال
// ساعة» — وهم لم يُرسلوا شيئًا.
//
// فرُفع إلى مئتين في الساعة: يسع قسمًا كاملًا يُعبّئ في جلسةٍ واحدة،
// ويبقى سدًّا أمام نصٍّ آليٍّ يُغرق البوابة بآلاف الطلبات.
const RATE = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 200;

function rateOk(ip) {
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return false;
  hits.push(now);
  RATE.set(ip, hits);
  if (RATE.size > 5000) {
    for (const [k, v] of RATE) if (!v.some((t) => now - t < WINDOW_MS)) RATE.delete(k);
  }
  return true;
}

const clean = (v, max = 120) => String(v == null ? "" : v).trim().slice(0, max);

/** تنظيفُ ما وصل وبناءُ قيم الملف — بابان يستعملانها فلا يفترق تحقّقهما. */
function buildIntakeVals(b) {
  const idNumber = clean(b.id_number, 10).replace(/\D/g, "");
  // الجوالُ يحتمل «+» للدوليّ: تُحذف المسافاتُ والشَّرطات وحدها
  const mobile = clean(b.mobile, 20).replace(/[^0-9+]/g, "");
  // ⚠️ الاسم الرباعي يُركَّب هنا لا في الواجهة وحدها: النموذج يأخذه أجزاءً،
  // ومن نادى الخادم مباشرةً لا يمرّ بتركيب الصفحة — فيُردّ بلا اسمٍ وهو كتبه.
  const fullAr = clean(b.full_name_ar)
    || [b.name_first, b.name_father, b.name_grand, b.name_family]
      .map((p) => clean(p, 40)).filter(Boolean).join(" ");
  if (!fullAr) throw badRequest("الاسم بالعربية مطلوب");
  if (idNumber.length !== 10) throw badRequest("رقم الهوية أو الإقامة عشرة أرقام");
  // ⚠️ الجوالُ سعوديٌّ بصيغته المحلية (05…) أو دوليٌّ بكود دولته (+…): من
  // لم يُقم في السعودية بعدُ لا رقمَ سعوديًّا له، وحبسُه على 05 يمنعه من
  // إكمال ملفّه أصلًا.
  // ⚠️ حاملُ الإقامة ليس سعوديًّا: الاختيارُ الخاطئ هنا يُخرج خطاباتٍ
  // وتأميناتٍ على جنسيةٍ لا تخصّه، ويُعطّل قيدَه في أنظمة العمل.
  const nationality = clean(b.nationality_txt, 60);
  const isIqama = b.id_type === "iqama";
  if (isIqama && /(السعودية|سعودي|saudi)/i.test(nationality))
    throw badRequest("حاملُ الإقامة ليس سعوديًّا — اختر جنسيّتك من القائمة");

  const mobileOk = /^05\d{8}$/.test(mobile) || /^\+\d{8,15}$/.test(mobile);
  if (!mobileOk) throw badRequest(
    "رقم الجوال: 05 وثمانية أرقامٍ بعدها، أو رقمٌ دوليٌّ يبدأ بكود دولته");

  // ⚠️ ما اشترطناه في الشاشة يُشترط هنا أيضًا: من نادى الخادم مباشرةً لا
  // يمرّ بتحقّق الصفحة، فيصل ملفٌّ بلا بريدٍ ولا آيبان.
  const email = clean(b.email, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))
    throw badRequest("البريد الإلكتروني مطلوب وصحيح");
  const iban = clean(b.iban, 34).replace(/\s/g, "").toUpperCase();
  if (!/^SA\d{22}$/.test(iban)) throw badRequest("رقم الآيبان مطلوب — SA ثمّ ٢٢ رقمًا");
  // ⚠️ جهةُ اتصال الطوارئ إلزامية، وتُفحص هنا لا في الشاشة وحدها: يومَ
  // تقع حادثةٌ لا يُبحث عن أهله في الأوراق. ورقمٌ لا يُتّصل به لا ينفع،
  // فيُقاس كما يُقاس رقمُ صاحبه.
  if (!clean(b.emergency_name).trim())
    throw badRequest("اسم شخصٍ للطوارئ مطلوب");
  const emgDigits = clean(b.emergency_phone, 20).replace(/\D/g, "");
  if (emgDigits.length < 9 || emgDigits.length > 15)
    throw badRequest("جوال الطوارئ مطلوب — رقمٌ صحيحٌ يُتّصل به");
  const shortAddr = clean(b.address, 20).replace(/\s/g, "").toUpperCase();
  if (shortAddr && !/^[A-Z]{4}\d{4}$/.test(shortAddr))
    throw badRequest("العنوان الوطني المختصر: أربعةُ حروفٍ ثمّ أربعةُ أرقام");
  // العمر: لا يُوظَّف من دون الثامنة عشرة نظامًا
  // ⚠️ والتاريخُ مطلوبٌ هنا أيضًا لا في الشاشة وحدها: الشاشةُ تُتجاوَز،
  //    والميلادُ يدخل في سنّ التقاعد ونهاية الخدمة والتأمين.
  const bday = clean(b.birthday, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bday))
    throw badRequest("تاريخ الميلاد مطلوب");
  if (bday && /^\d{4}-\d{2}-\d{2}$/.test(bday)) {
    const age = (Date.now() - new Date(bday + "T00:00:00").getTime()) / 31557600000;
    if (age < 18) throw badRequest("تاريخ الميلاد يدلّ على عمرٍ دون الثامنة عشرة");
    if (age > 80) throw badRequest("راجع تاريخ الميلاد");
  }

  const vals = {
    name_first: clean(b.name_first, 40),
    name_father: clean(b.name_father, 40),
    name_grand: clean(b.name_grand, 40),
    name_family: clean(b.name_family, 40),
    full_name_ar: fullAr,
    full_name_en: clean(b.full_name_en),
    nationality_txt: nationality,
    city: clean(b.city, 60),
    branch: clean(b.branch, 60),
    department_txt: clean(b.department_txt, 60),
    contract_type: ["full", "part", "temp", "train"].includes(b.contract_type) ? b.contract_type : "",
    qualification: clean(b.qualification, 80),
    specialization: clean(b.specialization, 80),
    university: clean(b.university, 120),
    experience_years: Math.max(0, Math.min(60, Number(b.experience_years) || 0)),
    bank_holder: clean(b.bank_holder, 120),
    ack: b.ack === true || b.ack === "true",
    id_type: b.id_type === "iqama" ? "iqama" : "national",
    id_number: idNumber,
    id_expiry: clean(b.id_expiry, 10),
    passport_no: clean(b.passport_no, 30),
    birthday: bday,
    gender: ["male", "female"].includes(b.gender) ? b.gender : "",
    marital: ["single", "married", "divorced", "widower"].includes(b.marital) ? b.marital : "",
    children: Math.max(0, Math.min(20, Number(b.children) || 0)),
    mobile,
    email,
    address: shortAddr,
    home_phone: clean(b.home_phone, 20),
    emergency_name: clean(b.emergency_name),
    emergency_phone: clean(b.emergency_phone, 20).replace(/[^0-9+]/g, ""),
    job_title: clean(b.job_title),
    hire_date: clean(b.hire_date, 10),
    bank_name: clean(b.bank_name),
    iban,
  };

  // المرفقات: base64 بلا ترويسة، بسقفٍ لكلٍّ منها وللمجموع
  let total = 0;
  // أسماءُ المستندات كما يراها الموظف — لتُذكر في الخطأ باسمها لا برمزها
  const DOC_AR = {
    photo: "الصورة الشخصية", id_copy: "صورة الهوية / الإقامة",
    iban_copy: "شهادة الآيبان", cv_copy: "السيرة الذاتية",
    qual_copy: "المؤهل العلمي", certs_copy: "الشهادات",
    other_copy: "مرفقات أخرى", signature: "التوقيع",
  };
  // والتوقيعُ منها: صورةٌ تُحفظ في الملفّ ويُطبع بها نموذجُ الموظف
  for (const key of ["photo", "id_copy", "iban_copy", "cv_copy", "qual_copy",
                     "certs_copy", "other_copy", "signature"]) {
    // المرفقُ يصل بإحدى صورتين: معرّفًا لملفٍّ رُفع قبلُ (الطريقُ المعتاد)،
    // أو base64 في الطلب نفسه (توافقٌ مع نسخةٍ قديمة من الصفحة).
    let data = "";
    const fid = typeof b[`${key}_fid`] === "string" ? b[`${key}_fid`] : "";
    if (fid) data = takeFile(fid);
    if (!data) {
      const raw = typeof b[key] === "string" ? b[key] : "";
      // ⚠️ معرّفٌ أُرسل وملفُّه مفقود: لا يُبتلع في صمت. كان الطلب يمضي
      // بلا مرفقه، فتصل الموارد البشرية خانةٌ فارغةٌ تظنّ صاحبها لم يرفع —
      // وهو رفع ورأى «رُفع ✓». يُقال له أيُّ مستندٍ يُعيده، لا أن يُسكت
      // عنه ويُكتشف بعد أسبوع.
      if (fid && !raw) {
        throw badRequest(
          `انتهت مهلةُ حفظ «${DOC_AR[key] || key}» قبل الإرسال — أعد إرفاقه ثمّ أرسل.`);
      }
      if (!raw) continue;
      data = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    }
    if (!data || !/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 200))) continue;
    const bytes = Math.round(data.length * 0.75);
    if (bytes > 10 * 1024 * 1024) throw badRequest(`الملف «${key}» أكبر من ١٠ ميجابايت`);
    total += bytes;
    if (total > 40 * 1024 * 1024) throw badRequest("مجموع المرفقات أكبر من ٤٠ ميجابايت");
    vals[key] = data;
    if (key !== "photo") vals[`${key}_name`] = clean(b[`${key}_name`], 80) || `${key}.bin`;
  }
  return vals;
}


// قوائمُ الاختيار: أقسامٌ ومسمّيات من أودو. تُخبَّأ عشر دقائق — قائمةٌ
// تتغيّر مرّةً في الشهر لا تُقرأ مع كل فتحةٍ للصفحة.
let OPTS = { at: 0, data: { departments: [], jobs: [] } };
// ⚠️ القوائمُ تُردّ فورًا ولو كانت قديمة، وتُجدَّد خلفَ الردّ: كان الزائرُ
// الأوّلُ بعد انقضاء المهلة ينتظر أودو (نحو ثانيتين ونصف) قبل أن تُملأ
// قائمتا القسم والمسمّى — وهو انتظارٌ لا يفهمه.
let OPTS_BUSY = false;
async function refreshOptions() {
  if (OPTS_BUSY) return;
  OPTS_BUSY = true;
  try {
    const { data } = await runAction("intake.options", {}, { user: null });
    if (data && (data.departments?.length || data.jobs?.length)) {
      OPTS = { at: Date.now(), data };
    }
  } catch (e) {
    console.warn("⚠️ تعذّر تحديث قوائم النموذج:", e.message);
  } finally { OPTS_BUSY = false; }
}

router.get("/join/options", async (req, res) => {
  const age = Date.now() - OPTS.at;
  const empty = !OPTS.data || !(OPTS.data.departments || []).length;
  // أوّلُ نداءٍ في عمر الخادم ينتظر — وما بعده يُردّ فورًا
  if (empty) await refreshOptions();
  else if (age > 30 * 60 * 1000) refreshOptions();
  // ⚠️ كاشٌ قصير: القوائمُ تتغيّر بتغيّر الأقسام، وكاشٌ نصفَ ساعةٍ يُبقي
  // في المتصفّح قائمةً قديمة — إنجليزيةً بعد التعريب مثلًا.
  res.set("Cache-Control", "public, max-age=120");
  res.json(OPTS.data || { departments: [], jobs: [], nationalities: [] });
});

router.post("/join/:token", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!rateOk(ip)) {
      throw tooMany("أُرسل ملفّان من هذا الجهاز خلال ساعة. "
        + "إن كنت تُصحّح ملفًّا أرسلته فاتصل بالموارد البشرية.");
    }
    const vals = buildIntakeVals(req.body || {});
    // ⚠️ رمزُ الرابط العامّ لا يُحفظ: الصفحةُ تأخذ آخرَ جزءٍ من العنوان،
    // فمن فتح /join وصل رمزُه «join» — كلمةٌ واحدةٌ لكلّ الملفّات. ورمزُ
    // الاستعادة يولّده أودو عند الإعادة للتصحيح وحده.
    const tk = clean(req.params.token, 64);
    if (tk.length >= 16 && !["join", "open", "me", "new"].includes(tk.toLowerCase()))
      vals.token = tk;
    const { data } = await runAction("intake.submit", { vals }, { user: null });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر إرسال الملف"));
  }
});

export default router;
