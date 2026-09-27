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

// ذاكرةُ المعدّل: عنوان → أوقات الإرسال. تُنظَّف من القديم في كل نداء،
// فلا تنمو بلا حدّ ولا تحتاج مهمّةً مجدولة.
const RATE = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 2;

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
  const mobile = clean(b.mobile, 15).replace(/\D/g, "");
  // ⚠️ الاسم الرباعي يُركَّب هنا لا في الواجهة وحدها: النموذج يأخذه أجزاءً،
  // ومن نادى الخادم مباشرةً لا يمرّ بتركيب الصفحة — فيُردّ بلا اسمٍ وهو كتبه.
  const fullAr = clean(b.full_name_ar)
    || [b.name_first, b.name_father, b.name_grand, b.name_family]
      .map((p) => clean(p, 40)).filter(Boolean).join(" ");
  if (!fullAr) throw badRequest("الاسم بالعربية مطلوب");
  if (idNumber.length !== 10) throw badRequest("رقم الهوية أو الإقامة عشرة أرقام");
  if (!/^05\d{8}$/.test(mobile)) throw badRequest("رقم الجوال يبدأ بـ05 ويتكوّن من عشرة أرقام");

  // ⚠️ ما اشترطناه في الشاشة يُشترط هنا أيضًا: من نادى الخادم مباشرةً لا
  // يمرّ بتحقّق الصفحة، فيصل ملفٌّ بلا بريدٍ ولا آيبان.
  const email = clean(b.email, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))
    throw badRequest("البريد الإلكتروني مطلوب وصحيح");
  const iban = clean(b.iban, 34).replace(/\s/g, "").toUpperCase();
  if (!/^SA\d{22}$/.test(iban)) throw badRequest("رقم الآيبان مطلوب — SA ثمّ ٢٢ رقمًا");
  const shortAddr = clean(b.address, 20).replace(/\s/g, "").toUpperCase();
  if (shortAddr && !/^[A-Z]{4}\d{4}$/.test(shortAddr))
    throw badRequest("العنوان الوطني المختصر: أربعةُ حروفٍ ثمّ أربعةُ أرقام");
  // العمر: لا يُوظَّف من دون الثامنة عشرة نظامًا
  const bday = clean(b.birthday, 10);
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
    nationality_txt: clean(b.nationality_txt, 60),
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
    emergency_phone: clean(b.emergency_phone, 15),
    job_title: clean(b.job_title),
    hire_date: clean(b.hire_date, 10),
    bank_name: clean(b.bank_name),
    iban,
  };

  // المرفقات: base64 بلا ترويسة، بسقفٍ لكلٍّ منها وللمجموع
  let total = 0;
  // والتوقيعُ منها: صورةٌ تُحفظ في الملفّ ويُطبع بها نموذجُ الموظف
  for (const key of ["photo", "id_copy", "iban_copy", "cv_copy", "qual_copy",
                     "certs_copy", "other_copy", "signature"]) {
    const raw = typeof b[key] === "string" ? b[key] : "";
    if (!raw) continue;
    const data = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 120))) continue;
    const bytes = Math.round(data.length * 0.75);
    if (bytes > 6 * 1024 * 1024) throw badRequest(`الملف «${key}» أكبر من ٦ ميجابايت`);
    total += bytes;
    if (total > 24 * 1024 * 1024) throw badRequest("مجموع المرفقات أكبر من ٢٤ ميجابايت");
    vals[key] = data;
    if (key !== "photo") vals[`${key}_name`] = clean(b[`${key}_name`], 80) || `${key}.bin`;
  }
  return vals;
}


// قوائمُ الاختيار: أقسامٌ ومسمّيات من أودو. تُخبَّأ عشر دقائق — قائمةٌ
// تتغيّر مرّةً في الشهر لا تُقرأ مع كل فتحةٍ للصفحة.
let OPTS = { at: 0, data: { departments: [], jobs: [] } };
router.get("/join/options", async (req, res, next) => {
  try {
    if (Date.now() - OPTS.at > 10 * 60 * 1000) {
      const { data } = await runAction("intake.options", {}, { user: null });
      OPTS = { at: Date.now(), data: data || { departments: [], jobs: [] } };
    }
    res.set("Cache-Control", "public, max-age=600");
    res.json(OPTS.data);
  } catch (e) { res.json({ departments: [], jobs: [] }); }
});

router.post("/join/:token", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!rateOk(ip)) {
      throw tooMany("أُرسل ملفّان من هذا الجهاز خلال ساعة. "
        + "إن كنت تُصحّح ملفًّا أرسلته فاتصل بالموارد البشرية.");
    }
    const vals = buildIntakeVals(req.body || {});
    vals.token = clean(req.params.token, 64);
    const { data } = await runAction("intake.submit", { vals }, { user: null });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر إرسال الملف"));
  }
});

export default router;
