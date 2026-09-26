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

const router = Router();

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

router.post("/join/:token", async (req, res, next) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "—";
    if (!rateOk(ip)) {
      throw tooMany("أُرسل ملفّان من هذا الجهاز خلال ساعة. "
        + "إن كنت تُصحّح ملفًّا أرسلته فاتصل بالموارد البشرية.");
    }
    const b = req.body || {};
    const idNumber = clean(b.id_number, 10).replace(/\D/g, "");
    const mobile = clean(b.mobile, 15).replace(/\D/g, "");
    if (!clean(b.full_name_ar)) throw badRequest("الاسم بالعربية مطلوب");
    if (idNumber.length !== 10) throw badRequest("رقم الهوية أو الإقامة عشرة أرقام");
    if (!/^05\d{8}$/.test(mobile)) throw badRequest("رقم الجوال يبدأ بـ05 ويتكوّن من عشرة أرقام");

    const payload = {
      token: clean(req.params.token, 64),
      full_name_ar: clean(b.full_name_ar),
      full_name_en: clean(b.full_name_en),
      id_type: b.id_type === "iqama" ? "iqama" : "national",
      id_number: idNumber,
      id_expiry: clean(b.id_expiry, 10),
      passport_no: clean(b.passport_no, 30),
      birthday: clean(b.birthday, 10),
      gender: ["male", "female"].includes(b.gender) ? b.gender : "",
      marital: ["single", "married", "divorced", "widower"].includes(b.marital) ? b.marital : "",
      children: Math.max(0, Math.min(20, Number(b.children) || 0)),
      mobile,
      email: clean(b.email, 120),
      address: clean(b.address, 200),
      emergency_name: clean(b.emergency_name),
      emergency_phone: clean(b.emergency_phone, 15),
      job_title: clean(b.job_title),
      hire_date: clean(b.hire_date, 10),
      bank_name: clean(b.bank_name),
      iban: clean(b.iban, 34).replace(/\s/g, ""),
      files: {},
    };

    // المرفقات: base64 بلا ترويسة، وبسقفٍ لكلٍّ منها وللمجموع
    let total = 0;
    for (const key of ["photo", "id_copy", "iban_copy", "cv_copy"]) {
      const raw = typeof b[key] === "string" ? b[key] : "";
      if (!raw) continue;
      const data = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      if (!/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 120))) continue;
      const bytes = Math.round(data.length * 0.75);
      if (bytes > 6 * 1024 * 1024) throw badRequest(`الملف «${key}» أكبر من ٦ ميجابايت`);
      total += bytes;
      if (total > 24 * 1024 * 1024) throw badRequest("مجموع المرفقات أكبر من ٢٤ ميجابايت");
      payload.files[key] = { data, name: clean(b[`${key}_name`], 80) };
    }

    const { data } = await runAction("intake.submit", payload, { user: null });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر إرسال الملف"));
  }
});

export default router;
