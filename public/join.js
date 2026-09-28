// ===========================================================================
// join.js — بوابة بيانات الموظفين: معالجٌ من سبع مراحل، بحفظٍ تلقائي
// ومراجعةٍ قبل الإرسال.
//
// بلا مكتباتٍ خارجية: الصفحة تُفتح من جوّال موظفٍ قد يكون على شبكةٍ ضعيفة،
// وكلُّ مكتبةٍ تُحمَّل تأخيرٌ قبل أول حقلٍ يراه. والمكوّنات هنا دوالُّ تُعيد
// عُقدًا — يُعاد استعمالها في كل قسم.
// ===========================================================================
(function () {
  "use strict";

  var token = new URLSearchParams(location.search).get("t")
    || location.pathname.split("/").filter(Boolean).pop() || "open";
  // «me»: موظفٌ قائم فتحها من التطبيق بجلسته — يصحّح بياناته لا يكتبها من فراغ
  var MINE = token === "me";
  var LS = "sq.intake." + (MINE ? "me" : token);

  var $ = function (s) { return document.querySelector(s); };
  var el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  };

  // ─────────────────────── الترجمة ───────────────────────
  var L = "ar";
  var T = {
    ar: {
      brand: "بيت العباءة الشرقية", brandSub: "بوابة بيانات الموظفين",
      eyebrow: "بيت العباءة الشرقية", h1: "بوابة بيانات الموظفين",
      lede: "مرحبًا بك، يرجى تحديث بياناتك لضمان دقة معلوماتك الوظيفية.",
      note: "يستغرق إكمال البيانات حوالي ٥ دقائق.", startBtn: "ابدأ الآن",
      f1t: "سبع خطوات مرتّبة", f1s: "تنتقل بينها وتعود لأيّها متى شئت.",
      f2t: "يُحفظ تلقائيًّا", f2s: "تُكمل لاحقًا من الجهاز نفسه بلا فقد.",
      f3t: "بياناتك محفوظة", f3s: "لا تُنشر ولا تُستعمل إلا في ملفّك الوظيفي.",
      progT: "اكتمال الملف", prevBtn: "السابق", nextBtn: "التالي",
      reqNo: "رقم الطلب", reqDate: "تاريخ التحديث", homeBtn: "العودة للرئيسية",
      hrNote: "في حال وجود أي استفسار، يرجى التواصل مع قسم الموارد البشرية.",
      foot: "بيت العباءة الشرقية — المملكة العربية السعودية",
      saved: "حُفظ تلقائيًّا", submit: "تأكيد وإرسال البيانات", sending: "جارٍ الإرسال…",
    },
    en: {
      brand: "Abaya Sharqiaa", brandSub: "Employee Data Portal",
      eyebrow: "Abaya Sharqiaa", h1: "Employee Data Portal",
      lede: "Welcome. Please update your details so your employment record stays accurate.",
      note: "Takes about 5 minutes to complete.", startBtn: "Start now",
      f1t: "Seven clear steps", f1s: "Move between them and return to any one.",
      f2t: "Saved automatically", f2s: "Finish later on the same device — nothing is lost.",
      f3t: "Your data is protected", f3s: "Never published; used only in your employment file.",
      progT: "Profile completion", prevBtn: "Back", nextBtn: "Next",
      reqNo: "Reference", reqDate: "Submitted on", homeBtn: "Back to start",
      hrNote: "For any question, please contact Human Resources.",
      foot: "Abaya Sharqiaa — Kingdom of Saudi Arabia",
      saved: "Saved automatically", submit: "Confirm and submit", sending: "Sending…",
    },
  };
  function t(k) { return (T[L] && T[L][k]) || T.ar[k] || k; }
  function paintStatic() {
    document.querySelectorAll("[data-t]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-t"));
    });
    document.documentElement.lang = L;
    document.documentElement.dir = L === "ar" ? "rtl" : "ltr";
    $("#lang").textContent = L === "ar" ? "English" : "العربية";
  }

  // ─────────────────────── وصف الأقسام ───────────────────────
  // كلُّ حقلٍ يُوصف مرّةً واحدة: اسمُه ونوعه وتسميته وتحقّقه — ومنه تُبنى
  // الشاشة والمراجعة والتحقّق معًا، فلا تفترق ثلاثتها.
  var SEC = [
    {
      id: "personal", n: "٠١", nEn: "01",
      title: { ar: "البيانات الشخصية", en: "Personal details" },
      sub: { ar: "كما هي في الهوية أو الإقامة.", en: "Exactly as on your ID or Iqama." },
      fields: [
        // ⚠️ الأسماءُ حروفٌ لا أرقام: رقمٌ في خانة الاسم يخرج في خطابٍ رسميّ
        { k: "name_first", ar: "الاسم الأول", en: "First name", req: true, rule: "letters" },
        { k: "name_father", ar: "اسم الأب", en: "Father's name", req: true, rule: "letters" },
        // اسمُ الجد إجباريّ: الاسمُ الرباعيّ هو ما تعرفه الجهاتُ الرسمية
        { k: "name_grand", ar: "اسم الجد", en: "Grandfather's name", req: true, rule: "letters" },
        { k: "name_family", ar: "اسم العائلة", en: "Family name", req: true, rule: "letters" },
        { k: "full_name_en", ar: "الاسم بالإنجليزية (كما في الجواز)", en: "Name in English (as in passport)",
          dir: "ltr", full: true, rule: "lettersEn",
          help: { ar: "حروفٌ لاتينية فقط.", en: "Latin letters only." } },
        { k: "id_type", ar: "نوع الهوية", en: "ID type", req: true, opts: [
          { v: "national", ar: "هوية وطنية", en: "National ID" },
          { v: "iqama", ar: "إقامة", en: "Iqama" }] },
        { k: "id_number", ar: "رقم الهوية / الإقامة", en: "ID / Iqama number", req: true,
          dir: "ltr", mode: "numeric", max: 10, digitsOnly: true, rule: "id" },
        { k: "id_expiry", ar: "تاريخ انتهاء الهوية", en: "ID expiry date", type: "date" },
        { k: "passport_no", ar: "رقم جواز السفر", en: "Passport number", dir: "ltr" },
        // الجنسيةُ قائمةٌ من أودو، وتُملأ «السعودية» وحدها متى كانت الهوية وطنية
        { k: "nationality_txt", ar: "الجنسية", en: "Nationality", src: "nationalities", req: true,
          search: true,
          help: { ar: "اكتب أوّل حرفين ثمّ اختر من القائمة.",
                  en: "Type the first letters, then pick from the list." } },
        { k: "gender", ar: "الجنس", en: "Gender", opts: [
          { v: "male", ar: "ذكر", en: "Male" }, { v: "female", ar: "أنثى", en: "Female" }] },
        { k: "birthday", ar: "تاريخ الميلاد", en: "Date of birth", type: "date", rule: "birth18",
          help: { ar: "ثمانيةَ عشرَ عامًا فأكثر.", en: "18 years or older." } },
        { k: "marital", ar: "الحالة الاجتماعية", en: "Marital status", req: true, opts: [
          { v: "single", ar: "أعزب / عزباء", en: "Single" },
          { v: "married", ar: "متزوج / متزوجة", en: "Married" },
          { v: "divorced", ar: "مطلّق / مطلّقة", en: "Divorced" },
          { v: "widower", ar: "أرمل / أرملة", en: "Widowed" }] },
        // ⚠️ لا تُسأل الأعزبُ عن أبنائه: سؤالٌ لا محلّ له يُربك ويُملأ بصفرٍ
        // لا معنى له. يظهر متى كانت الحالةُ تحتمله.
        { k: "children", ar: "عدد الأبناء", en: "Children", type: "number", min: 0, max: 20,
          mode: "numeric", digitsOnly: true,
          when: function (d) { return ["married", "divorced", "widower"].indexOf(d.marital) >= 0; } },
      ],
    },
    {
      id: "contact", n: "٠٢", nEn: "02",
      title: { ar: "بيانات التواصل", en: "Contact details" },
      sub: { ar: "نتواصل معك عبرها — تأكّد من صحّتها.", en: "We will reach you here — please verify." },
      fields: [
        { k: "mobile", ar: "رقم الجوال", en: "Mobile number", req: true, phone: true, rule: "mobile",
          help: { ar: "اختر كود الدولة ثمّ اكتب الأرقام. السعوديُّ يبدأ بـ05، وغيرُه بلا صفرٍ أوّل.",
                  en: "Pick the country code, then type digits. Saudi numbers start with 05." } },
        // البريدُ أساسيٌّ: بيانات الدخول والخطاباتُ تصل عليه
        { k: "email", ar: "البريد الإلكتروني", en: "Email", req: true, type: "email", dir: "ltr", rule: "email" },
        { k: "city", ar: "المدينة", en: "City", rule: "letters" },
        // العنوانُ الوطنيّ المختصر بدل الحيّ والشارع: ثمانِ خاناتٍ تُعرّف
        // الموقعَ تعريفًا قاطعًا في العنوان الوطني، ولا تحتمل اجتهادًا.
        { k: "address", ar: "العنوان الوطني المختصر", en: "Short national address",
          dir: "ltr", full: true, max: 8, rule: "shortAddr", upper: true, mask: "addr4x4",
          help: { ar: "أربعةُ حروفٍ ثمّ أربعةُ أرقام — كما في تطبيق العنوان الوطني.",
                  en: "Four letters then four digits, as in the National Address app." } },
        { k: "emergency_name", ar: "اسم شخص للطوارئ", en: "Emergency contact name", rule: "letters" },
        { k: "emergency_phone", ar: "جوال الطوارئ", en: "Emergency contact mobile",
          phone: true, rule: "mobileOpt" },
        // ⚠️ لغير السعوديّ رقمٌ في بلده: يُرجَع إليه إن انقطع خبرُه أو وقعت
        // حادثة، ولا يُسأل عنه السعوديّ فلا محلّ له.
        { k: "home_phone", ar: "رقم تواصل في البلد الأم", en: "Home-country contact number",
          phone: true, rule: "intlOpt",
          when: function (d) { return d.id_type === "iqama"; } },
      ],
    },
    {
      id: "job", n: "٠٣", nEn: "03",
      title: { ar: "البيانات الوظيفية", en: "Employment details" },
      sub: { ar: "ما تعرفه عن وظيفتك — وتصحّحه الموارد البشرية عند الحاجة.",
             en: "What you know; HR will refine it if needed." },
      fields: [
        // القسمُ أوّلًا ثمّ المسمّى: المسمّياتُ تُرشَّح بحسبه
        { k: "department_txt", ar: "القسم", en: "Department", src: "departments" },
        { k: "job_title", ar: "المسمى الوظيفي", en: "Job title", src: "jobs",
          help: { ar: "اختر القسم أوّلًا لتظهر مسمّياته.",
                  en: "Pick the department first to see its titles." } },
        { k: "branch", ar: "الفرع", en: "Branch" },
        { k: "hire_date", ar: "تاريخ المباشرة", en: "Start date", type: "date" },
        { k: "contract_type", ar: "نوع العقد", en: "Contract type", opts: [
          { v: "full", ar: "دوام كامل", en: "Full time" },
          { v: "part", ar: "دوام جزئي", en: "Part time" },
          { v: "temp", ar: "مؤقّت", en: "Temporary" },
          { v: "train", ar: "تدريب", en: "Training" }] },
      ],
    },
    {
      id: "edu", n: "٠٤", nEn: "04",
      title: { ar: "المؤهلات والخبرات", en: "Qualifications & experience" },
      sub: { ar: "اترك ما لا ينطبق عليك فارغًا.", en: "Leave anything that does not apply blank." },
      fields: [
        { k: "qualification", ar: "المؤهل", en: "Qualification", opts: [
          { v: "دون الثانوية", ar: "دون الثانوية", en: "Below secondary" },
          { v: "ثانوية عامة", ar: "ثانوية عامة", en: "Secondary" },
          { v: "دبلوم", ar: "دبلوم", en: "Diploma" },
          { v: "بكالوريوس", ar: "بكالوريوس", en: "Bachelor's" },
          { v: "ماجستير", ar: "ماجستير", en: "Master's" },
          { v: "دكتوراه", ar: "دكتوراه", en: "Doctorate" },
          { v: "أخرى", ar: "أخرى", en: "Other" }] },
        { k: "specialization", ar: "التخصص", en: "Field of study" },
        { k: "university", ar: "الجامعة / الجهة التعليمية", en: "University / institution", full: true },
        { k: "experience_years", ar: "سنوات الخبرة", en: "Years of experience",
          type: "number", min: 0, max: 60, mode: "numeric", digitsOnly: true },
      ],
    },
    {
      id: "bank", n: "٠٥", nEn: "05",
      title: { ar: "البيانات البنكية", en: "Bank details" },
      sub: { ar: "يُحوَّل راتبك إليها — راجع الآيبان حرفًا حرفًا.", en: "Your salary goes here — check the IBAN carefully." },
      fields: [
        // ⚠️ البياناتُ البنكية أساسيةٌ كلُّها: ملفٌّ بلا آيبانٍ لا يُصرف عليه
        // راتب، فيُستكمل بعد المباشرة برسائلَ ومكالمات.
        { k: "bank_name", ar: "اسم البنك", en: "Bank name", req: true, rule: "letters" },
        { k: "bank_holder", ar: "اسم صاحب الحساب", en: "Account holder name", req: true, rule: "letters" },
        { k: "iban", ar: "رقم الآيبان", en: "IBAN", dir: "ltr", full: true, req: true,
          prefix: "SA", digits: 22, mode: "numeric", rule: "iban",
          ph: { ar: "٢٢ رقمًا", en: "22 digits" },
          help: { ar: "أدخل الـ٢٢ رقمًا فقط — SA مكتوبةٌ لك.", en: "Enter the 22 digits only — SA is fixed." } },
      ],
    },
    {
      id: "files", n: "٠٦", nEn: "06",
      title: { ar: "المرفقات", en: "Attachments" },
      sub: { ar: "صوّر بجوالك ولا تهتمّ بالحجم — نُصغّر الصور تلقائيًّا. والحدّ ١٠ ميجابايت للملف و٤٠ للمجموع — ويُرفع كلُّ ملفٍّ فورَ اختياره.",
             en: "Shoot with your phone — images are shrunk automatically. Limit: 10 MB per file, 40 MB in total; each file uploads as soon as you pick it." },
      files: [
        // شهادةُ الآيبان وحدها إجبارية: عليها يُبنى تحويل الراتب، وخطأُ رقمٍ
        // فيها يُرجع الحوالة. وصورةُ الهوية تُطلب ولا تُشترط.
        { k: "iban_copy", ar: "شهادة الآيبان", en: "IBAN letter", req: true },
        { k: "id_copy", ar: "الهوية / الإقامة", en: "ID / Iqama" },
        { k: "cv_copy", ar: "السيرة الذاتية", en: "CV / Résumé" },
        { k: "qual_copy", ar: "المؤهل العلمي", en: "Qualification certificate" },
        { k: "certs_copy", ar: "الشهادات", en: "Certificates" },
        { k: "photo", ar: "صورة شخصية", en: "Personal photo" },
        { k: "other_copy", ar: "مرفقات أخرى", en: "Other attachments" },
      ],
    },
    {
      id: "sign", n: "٠٧", nEn: "07",
      title: { ar: "التوقيع", en: "Signature" },
      sub: { ar: "وقّع بإصبعك أو بالفأرة — توقيعُك إقرارٌ بما كتبت.",
             en: "Sign with your finger or mouse — your signature confirms what you entered." },
      sign: true,
    },
    {
      id: "review", n: "٠٨", nEn: "08",
      title: { ar: "المراجعة والتأكيد", en: "Review & confirm" },
      sub: { ar: "راجع ما كتبت قبل الإرسال — بعده يُراجَع في الموارد البشرية.", en: "Check everything before sending — HR reviews it next." },
      review: true,
    },
  ];

  // ⚠️ الحدُّ يُقاس بعد التصغير: صورةُ الكاميرا تُصغَّر فتمرّ، وملفٌّ لا
  // يُصغَّر (PDF غالبًا) أكبرُ من خمسة ميجابايت يُردّ فورًا برسالةٍ تقول
  // حجمَه — لا يُترك ليُرفع فينقطع في منتصفه فيظنّ صاحبُه العطبَ عندنا.
  var FILE_MAX = 10 * 1024 * 1024;
  var TOTAL_MAX = 40 * 1024 * 1024;   // واسعٌ: كلُّ ملفٍّ يُرفع وحده فلا ينقطع
  var state = { data: {}, files: {}, step: 0, ack: false, sign: "" };
  var dirty = false;
  // أقسامُ المنشأة ومسمّياتها — تُجلب مرّةً وتُملأ بها القوائم
  var OPTS = { departments: [], jobs: [], jobsByDept: {}, nationalities: [] };

  // ─────────────────────── الحفظ التلقائي ───────────────────────
  // المرفقات لا تُحفظ محليًّا: صورتان تتجاوزان سعة التخزين فيسقط الحفظ كله
  // ويضيع ما كُتب. تبقى في الذاكرة حتى الإرسال.
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ data: state.data, step: state.step, at: Date.now() }));
      var n = $("#saveNote"); if (n) n.textContent = t("saved");
    } catch (e) { /* التخزين ممتلئ أو محظور — لا يُوقف التعبئة */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || !o.data) return false;
      if (Date.now() - (o.at || 0) > 30 * 864e5) { localStorage.removeItem(LS); return false; }
      state.data = o.data; state.step = Math.min(o.step || 0, SEC.length - 1);
      return Object.keys(o.data).length > 0;
    } catch (e) { return false; }
  }

  // ─────────────────────── التحقق ───────────────────────
  var RULES = {
    // ⚠️ الحقلُ يطلب جنسه: حروفٌ في خانة الاسم وأرقامٌ في خانة الرقم. وكان
    // يُقبل كلُّ شيءٍ في كلّ خانة، فيصل الاسمُ مكتوبًا بالأرقام أو الجوالُ
    // بحروفٍ عربية، فتُردّ البيانات بعد أسبوع.
    letters: function (v) {
      if (!v) return "";
      return /\d/.test(v)
        ? (L === "ar" ? "هذا الحقل حروفٌ لا أرقام." : "Letters only — no digits.") : "";
    },
    lettersEn: function (v) {
      if (!v) return "";
      return /^[A-Za-z\s.'-]+$/.test(v) ? ""
        : (L === "ar" ? "حروفٌ لاتينية فقط، كما في الجواز." : "Latin letters only, as in the passport.");
    },
    // العنوانُ الوطنيّ المختصر: أربعةُ حروفٍ ثمّ أربعةُ أرقام
    shortAddr: function (v) {
      if (!v) return "";
      return /^[A-Za-z]{4}\d{4}$/.test(String(v).replace(/\s/g, "")) ? ""
        : (L === "ar" ? "الصيغة: أربعةُ حروفٍ ثمّ أربعةُ أرقام."
                      : "Format: four letters then four digits.");
    },
    intlOpt: function (v) {
      if (!v) return "";
      var d = String(v).replace(/[\s()-]/g, "");
      return /^\+?\d{7,15}$/.test(d) ? ""
        : (L === "ar" ? "رقمٌ غير صحيح — اكتبه بأرقامه ورمز دولته."
                      : "Invalid number — digits and country code only.");
    },
    id: function (v) {
      var d = (v || "").replace(/\D/g, "");
      return d.length === 10 ? "" : (L === "ar" ? "رقم الهوية أو الإقامة عشرة أرقام."
        : "ID number must be exactly 10 digits.");
    },
    mobile: function (v) {
      var s = String(v || "");
      // ⚠️ السعوديُّ بصيغته المحلية، وغيرُه دوليٌّ بكوده — ومن لم يُقم في
      // السعودية بعدُ لا رقمَ سعوديًّا له.
      if (/^\+\d{8,15}$/.test(s)) return "";
      var d = s.replace(/\D/g, "");
      return /^05\d{8}$/.test(d) ? "" : (L === "ar"
        ? "الرقم السعودي يبدأ بـ05 ويتكوّن من عشرة أرقام — أو اختر كود دولةٍ أخرى."
        : "Saudi numbers start with 05 (10 digits) — or pick another country code.");
    },
    email: function (v) {
      if (!v) return "";
      return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) ? ""
        : (L === "ar" ? "بريدٌ غير صحيح." : "Invalid email address.");
    },
    iban: function (v) {
      if (!v) return "";
      // ⚠️ لا تُطلب منه SA: هي مكتوبةٌ له في الصندوق المجاور، وذكرُها في
      // رسالة الخطأ يُوهمه أنّ عليه كتابتها فيكتبها مرّةً أخرى. يُقال له
      // كم رقمًا كتب وكم بقي — وهذا كلُّ ما يعنيه.
      var d = String(v).replace(/^SA/i, "").replace(/\D/g, "");
      if (d.length === 22) return "";
      return L === "ar"
        ? (d.length < 22
            ? "أدخل ٢٢ رقمًا — كتبتَ " + d.length + " وبقي " + (22 - d.length) + "."
            : "الأرقام أكثر من ٢٢ — احذف " + (d.length - 22) + ".")
        : "Enter 22 digits — you typed " + d.length + ".";
    },
    past: function (v) {
      if (!v) return "";
      return v < new Date().toISOString().slice(0, 10) ? ""
        : (L === "ar" ? "التاريخ يجب أن يكون في الماضي." : "Date must be in the past.");
    },
    // ⚠️ لا يُوظَّف من دون الثامنة عشرة نظامًا، ومن جاوز الثمانين فالتاريخُ
    // خطأُ كتابةٍ غالبًا — يُسأل عنه قبل أن يمضي الملفّ.
    birth18: function (v) {
      if (!v) return "";
      var p = RULES.past(v); if (p) return p;
      var age = (Date.now() - new Date(v + "T00:00:00").getTime()) / 31557600000;
      if (age < 18) return L === "ar" ? "العمرُ دون الثامنة عشرة — راجع التاريخ."
                                      : "Age is under 18 — check the date.";
      if (age > 80) return L === "ar" ? "راجع تاريخ الميلاد." : "Please check the date of birth.";
      return "";
    },
  };

  // حقلٌ لا يُسأل عنه صاحبُه لا يُحسب عليه: الشرطُ واحدٌ في العرض والتحقّق
  // والنسبة والمراجعة، فلا يُخفى في الشاشة ويُطالَب به عند الإرسال.
  // ⚠️ حاملُ الهوية الوطنية سعوديٌّ بالضرورة، فلا يُسأل عن جنسيّته ولا
  // تُترك لاجتهاده: تُملأ له وتبقى قابلةً للتعديل إن غيّر نوع هويّته.
  function onPivot(k) {
    if (k === "id_type") {
      if (state.data.id_type === "national") state.data.nationality_txt = "السعودية";
      else if (state.data.nationality_txt === "السعودية") state.data.nationality_txt = "";
    }
    save(); render(); paintProgress(); paintTabs();
  }

  function shown(f) {
    return typeof f.when !== "function" || !!f.when(state.data);
  }
  function fieldsOf(s) {
    return (s.fields || []).filter(shown);
  }
  function fieldError(f) {
    if (!shown(f)) return "";
    var v = (state.data[f.k] || "").toString().trim();
    if (f.req && !v) return L === "ar" ? "هذا الحقل مطلوب." : "This field is required.";
    if (f.rule && RULES[f.rule]) return RULES[f.rule](v);
    return "";
  }
  function secDone(s) {
    if (s.review) return state.ack;
    if (s.sign) return !!state.sign;
    if (s.files) return (s.files || []).every(function (f) { return !f.req || state.files[f.k]; });
    return fieldsOf(s).every(function (f) { return !fieldError(f); });
  }
  function percent() {
    var all = [], done = 0;
    SEC.forEach(function (s) {
      fieldsOf(s).forEach(function (f) { all.push(!!(state.data[f.k] || "").toString().trim()); });
      (s.files || []).forEach(function (f) { all.push(!!state.files[f.k]); });
      if (s.sign) all.push(!!state.sign);
    });
    all.forEach(function (x) { if (x) done++; });
    return all.length ? Math.round((done / all.length) * 100) : 0;
  }
  function label(f) {
    var lb = el("label", { for: "fld-" + f.k, text: f[L] || f.ar });
    if (f.req) lb.appendChild(el("em", { text: " *" }));
    return lb;
  }
  // قائمةٌ من أودو مع بابٍ للكتابة: من لم يجد قسمه أو مسمّاه كتبه بيده،
  // ولا يُحبَس على قائمةٍ ناقصة — والموارد البشرية تُسوّيه عند المراجعة.
  function pickNode(f) {
    var wrap = el("div", { class: "fld" + (f.full ? " full" : ""), "data-k": f.k });
    wrap.appendChild(label(f));
    var list = (OPTS[f.src] || []);
    // ⚠️ حاملُ الهوية الوطنية سعوديٌّ بالضرورة: قائمتُه قائمةٌ بواحدة، ولا
    // بابَ للكتابة. ومن يحمل إقامةً تُفتح له القائمة كاملةً إلا السعودية —
    // فحاملُ الإقامة ليس سعوديًّا، واختيارُها يُخرج خطاباتٍ وتأميناتٍ خطأ.
    var lock = f.k === "nationality_txt" && state.data.id_type === "national";
    if (lock) list = ["السعودية"];
    else if (f.k === "nationality_txt" && state.data.id_type === "iqama") {
      list = list.filter(function (n) { return !/^(السعودية|سعودي)/.test(n); });
    }
    // المسمّياتُ تتبع القسم المختار: من اختار «التقني» لا يُعرض عليه
    // «مشغل ماكينة تطريز». ومن لم يختر قسمًا بعدُ تُعرض عليه القائمة كلُّها.
    if (f.src === "jobs") {
      var dept = (state.data.department_txt || "").toString();
      var byDept = (OPTS.jobsByDept || {})[dept];
      if (dept && byDept && byDept.length) list = byDept;
    }
    // ⚠️ المسمّى لا يُفتح قبل القسم: قائمةُ الأربعين مسمًّى تُربك من لم
    // يحدّد قسمَه، ويختار منها ما ليس من عمله. فيُقفل الحقلُ ويُقال له
    // السبب، ويُفتح فور اختيار القسم.
    var needDept = f.src === "jobs" && !(state.data.department_txt || "").toString().trim();
    if (needDept) {
      var lockSel = el("select", { id: "fld-" + f.k, disabled: true });
      lockSel.appendChild(el("option", { text: L === "ar" ? "اختر القسم أوّلًا…" : "Pick the department first…" }));
      wrap.appendChild(lockSel);
      wrap.appendChild(el("div", { class: "help",
        text: L === "ar" ? "المسمّيات تُعرض بحسب القسم الذي تختاره."
                         : "Titles are listed for the department you pick." }));
      wrap.appendChild(el("div", { class: "hint" }));
      return wrap;
    }
    var cur = (state.data[f.k] || "").toString();
    var known = cur && list.indexOf(cur) >= 0;
    // ⚠️ قائمةٌ بمئتين وخمسين جنسية لا تُقلَّب بالإصبع: تُكتب فيها أحرفٌ
    // فتُرشَّح. وdatalist يفعلها بلا مكتبةٍ ولا شفرةٍ إضافية، ويقبل ما ليس
    // فيها أيضًا — فمن لم يجد جنسيّته كتبها.
    if (f.search) {
      var dlId = "dl-" + f.k;
      var inp = el("input", {
        type: "text", id: "fld-" + f.k, list: dlId, autocomplete: "off",
        placeholder: L === "ar" ? "اكتب أول حرفين للبحث…" : "Type to search…",
      });
      inp.value = cur;
      var dl = el("datalist", { id: dlId });
      list.forEach(function (v) { dl.appendChild(el("option", { value: v })); });
      inp.addEventListener("input", function () {
        state.data[f.k] = inp.value.trim();
        dirty = true;
        if (wrap.classList.contains("err")) checkOne(f, wrap);
        save(); paintProgress(); paintTabs();
      });
      inp.addEventListener("blur", function () { checkOne(f, wrap); });
      wrap.appendChild(inp);
      wrap.appendChild(dl);
      if (f.help) wrap.appendChild(el("div", { class: "help", text: f.help[L] || f.help.ar }));
      wrap.appendChild(el("div", { class: "hint" }));
      return wrap;
    }
    var sel = el("select", { id: "fld-" + f.k });
    sel.appendChild(el("option", { value: "", text: L === "ar" ? "اختر…" : "Select…" }));
    list.forEach(function (v) { sel.appendChild(el("option", { value: v, text: v })); });
    if (!lock) sel.appendChild(el("option", { value: "__other", text: L === "ar" ? "أخرى — أكتبه بنفسك" : "Other — type it yourself" }));
    sel.value = known ? cur : (cur ? "__other" : "");
    // خانةُ الكتابة تقول ما يُكتب فيها: «أخرى» بلا إرشادٍ تُترك فارغة
    var free = el("input", {
      type: "text", style: "margin-top:8px",
      placeholder: (f.ph && typeof f.ph === "object" ? (f.ph[L] || f.ph.ar) : f.ph)
        || (L === "ar" ? "اكتب " + (f.ar || "") + " كما هو" : "Type it as it is"),
      hidden: known || !cur ? true : false,
    });
    free.value = known ? "" : cur;
    function sync() {
      var v = sel.value === "__other" ? free.value.trim() : sel.value;
      state.data[f.k] = v; dirty = true; save(); paintProgress(); paintTabs();
      // ⚠️ تبديلُ القسم يُعيد بناء الشاشة: قائمةُ المسمّيات تتبعه، فلو بقيت
      // كما هي عُرضت على من اختار «التقني» مسمّياتُ المصنع.
      if (f.k === "department_txt") {
        if (state.data.job_title && !(OPTS.jobsByDept || {})[v]) { /* يبقى ما كُتب */ }
        render();
      }
    }
    sel.addEventListener("change", function () {
      free.hidden = sel.value !== "__other";
      if (sel.value !== "__other") free.value = "";
      else setTimeout(function () { free.focus(); }, 30);
      sync();
    });
    free.addEventListener("input", sync);
    wrap.appendChild(sel);
    wrap.appendChild(free);
    if (!list.length) {
      // القائمة لم تصل بعد (أو تعذّرت): الحقل يبقى صالحًا للكتابة
      free.hidden = false; sel.hidden = true;
    }
    if (lock) { free.hidden = true; free.value = ""; }
    wrap.appendChild(el("div", { class: "hint" }));
    return wrap;
  }

  // أكواد الدول الأكثر ورودًا في ملفّات المنشأة، والبقيّةُ تُكتب بعد «أخرى».
  var DIAL = [
    { c: "966", ar: "السعودية +966" }, { c: "20", ar: "مصر +20" },
    { c: "91", ar: "الهند +91" }, { c: "92", ar: "باكستان +92" },
    { c: "880", ar: "بنغلاديش +880" }, { c: "63", ar: "الفلبين +63" },
    { c: "249", ar: "السودان +249" }, { c: "967", ar: "اليمن +967" },
    { c: "962", ar: "الأردن +962" }, { c: "963", ar: "سوريا +963" },
    { c: "964", ar: "العراق +964" }, { c: "212", ar: "المغرب +212" },
    { c: "216", ar: "تونس +216" }, { c: "213", ar: "الجزائر +213" },
    { c: "90", ar: "تركيا +90" }, { c: "94", ar: "سريلانكا +94" },
    { c: "251", ar: "إثيوبيا +251" }, { c: "256", ar: "أوغندا +256" },
    { c: "254", ar: "كينيا +254" }, { c: "62", ar: "إندونيسيا +62" },
    { c: "971", ar: "الإمارات +971" }, { c: "965", ar: "الكويت +965" },
    { c: "973", ar: "البحرين +973" }, { c: "974", ar: "قطر +974" },
    { c: "968", ar: "عُمان +968" },
  ];

  // ⚠️ الرقمُ يُخزَّن كما يُقرأ: السعوديُّ بصيغته المحلية (05…) لأنّ أنظمة
  // المنشأة كلَّها تعرفه بها، وغيرُه بكود دولته (+…) — فيُتّصل به فعلًا.
  function splitPhone(v) {
    var s = String(v || "").trim();
    if (!s) return { code: "966", num: "" };
    if (s.charAt(0) === "+") {
      for (var i = 0; i < DIAL.length; i++) {
        var c = DIAL[i].c;
        if (s.slice(1, 1 + c.length) === c) return { code: c, num: s.slice(1 + c.length) };
      }
      return { code: "other", num: s.slice(1) };
    }
    return { code: "966", num: s };
  }
  function joinPhone(code, num) {
    var d = String(num || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    if (code === "966") return d;                 // 05xxxxxxxx كما هو
    // ⚠️ الصفرُ الأوّل محليٌّ لا يُكتب مع كود الدولة: «+964 0771…» رقمٌ لا
    // يُطلب. يُحذف كما يفعل كلُّ مُتّصلٍ دوليٍّ بيده.
    d = d.replace(/^0+/, "");
    return "+" + String(code).replace(/[^0-9]/g, "") + d;
  }

  function phoneNode(f) {
    var wrap = el("div", { class: "fld" + (f.full ? " full" : ""), "data-k": f.k });
    wrap.appendChild(label(f));
    var cur = splitPhone(state.data[f.k]);
    var row = el("div", { class: "pfxrow" });
    var sel = el("select", { class: "dial", id: "fld-" + f.k + "-code" });
    DIAL.forEach(function (d) {
      sel.appendChild(el("option", { value: d.c, text: d.ar }));
    });
    sel.appendChild(el("option", { value: "other", text: "أخرى +" }));
    sel.value = cur.code;
    var free = el("input", { type: "tel", inputmode: "numeric", class: "dialfree",
      placeholder: "الكود", hidden: cur.code !== "other", maxlength: 4,
      value: cur.code === "other" ? "" : "" });
    var inp = el("input", {
      type: "tel", inputmode: "numeric", id: "fld-" + f.k, name: f.k, dir: "ltr",
      maxlength: 15,
      placeholder: cur.code === "966" ? "05xxxxxxxx" : "أرقام الجوال بلا صفرٍ أوّل",
    });
    inp.value = cur.num;
    function sync() {
      var code = sel.value === "other" ? free.value : sel.value;
      inp.value = inp.value.replace(/[^0-9]/g, "");
      // الشرحُ يتبع الكود: من اختار دولةً أخرى لا يُطالَب بـ05
      inp.placeholder = sel.value === "966" ? "05xxxxxxxx" : "أرقام الجوال بلا صفرٍ أوّل";
      state.data[f.k] = joinPhone(code, inp.value);
      dirty = true;
      if (wrap.classList.contains("err")) checkOne(f, wrap);
      save(); paintProgress(); paintTabs();
    }
    sel.addEventListener("change", function () {
      free.hidden = sel.value !== "other";
      sync();
    });
    free.addEventListener("input", sync);
    inp.addEventListener("input", sync);
    inp.addEventListener("blur", function () { checkOne(f, wrap); });
    row.appendChild(sel); row.appendChild(free); row.appendChild(inp);
    wrap.appendChild(row);
    if (f.help) wrap.appendChild(el("div", { class: "help", text: f.help[L] || f.help.ar }));
    wrap.appendChild(el("div", { class: "hint" }));
    return wrap;
  }

  function fieldNode(f) {
    if (f.phone) return phoneNode(f);
    if (f.src) return pickNode(f);
    var wrap = el("div", { class: "fld" + (f.full ? " full" : ""), "data-k": f.k });
    wrap.appendChild(label(f));
    var input;
    if (f.opts) {
      input = el("select", { id: "fld-" + f.k, name: f.k });
      input.appendChild(el("option", { value: "", text: L === "ar" ? "اختر…" : "Select…" }));
      f.opts.forEach(function (o) {
        input.appendChild(el("option", { value: o.v, text: o[L] || o.ar }));
      });
    } else {
      input = el("input", {
        id: "fld-" + f.k, name: f.k, type: f.type || "text",
        placeholder: (f.ph && typeof f.ph === "object" ? (f.ph[L] || f.ph.ar) : f.ph) || "",
        dir: f.dir || null, maxlength: f.prefix ? f.digits : (f.max || null),
        min: f.min != null ? f.min : null, max: f.type === "number" ? f.max : null,
        inputmode: f.mode || null, autocomplete: "on",
      });
    }
    var stored = state.data[f.k] != null ? String(state.data[f.k]) : "";
    input.value = f.prefix
      ? stored.replace(new RegExp("^" + f.prefix, "i"), "")
      : stored;
    input.addEventListener("input", function () {
      if (f.prefix) {
        // الأرقامُ وحدها تُقبل، والبادئة تُلصق في الحفظ لا في الشاشة
        var d = input.value.replace(/[^0-9]/g, "").slice(0, f.digits);
        if (input.value !== d) input.value = d;
        state.data[f.k] = d ? f.prefix + d : "";
      } else {
        // ⚠️ الخانةُ تمنع ما ليس من جنسها وقتَ الكتابة لا بعد الإرسال:
        // خانةُ رقمٍ لا تقبل حرفًا، والعنوانُ المختصر يُرفع إلى الكبير.
        var v = input.value;
        if (f.digitsOnly) v = v.replace(/[^0-9]/g, "");
        // العنوانُ الوطنيّ المختصر: أربعةُ حروفٍ ثمّ أربعةُ أرقام — تُفرض
        // خانةً خانة، فلا يُكتب رقمٌ في موضع حرفٍ ولا العكس.
        if (f.mask === "addr4x4") {
          v = v.toUpperCase().replace(/[^A-Z0-9]/g, "").split("").filter(function (c, i) {
            return i < 4 ? /[A-Z]/.test(c) : /[0-9]/.test(c);
          }).join("").slice(0, 8);
        }
        if (f.upper) v = v.toUpperCase();
        if (f.max) v = v.slice(0, f.max);
        if (v !== input.value) { var p = input.selectionStart; input.value = v; try { input.setSelectionRange(p, p); } catch (e) {} }
        state.data[f.k] = v;
      }
      dirty = true;
      if (wrap.classList.contains("err")) checkOne(f, wrap);
      // حقولٌ يتغيّر بتغيّرها ما يُعرض: الحالةُ الاجتماعية تُظهر عدد
      // الأبناء، ونوعُ الهوية يُظهر رقمَ البلد الأم ويملأ الجنسية.
      if (f.k === "marital" || f.k === "id_type") { onPivot(f.k); return; }
      save(); paintProgress(); paintTabs();
    });
    input.addEventListener("blur", function () { checkOne(f, wrap); });
    if (f.prefix) {
      var row = el("div", { class: "pfxrow" });
      row.appendChild(el("span", { class: "pfx", text: f.prefix }));
      row.appendChild(input);
      wrap.appendChild(row);
    } else {
      wrap.appendChild(input);
    }
    if (f.help) wrap.appendChild(el("div", { class: "help", text: f.help[L] || f.help.ar }));
    wrap.appendChild(el("div", { class: "hint" }));
    return wrap;
  }
  function checkOne(f, wrap) {
    var e = fieldError(f);
    wrap.classList.toggle("err", !!e);
    var h = wrap.querySelector(".hint"); if (h) h.textContent = e;
    return !e;
  }

  function human(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }
  /** فتحُ ملفٍّ محفوظٍ في الحالة (base64) في تبويبٍ جديد — بلا رفعٍ ولا شبكة. */
  function openStored(got) {
    try {
      var bin = atob(got.data || "");
      var buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([buf], { type: got.type || "application/octet-stream" }));
      var w = window.open(url, "_blank");
      if (!w) msg("bad", L === "ar" ? "المتصفّح منع فتح النافذة — اسمح بالنوافذ المنبثقة."
        : "Your browser blocked the pop-up.");
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
      msg("bad", L === "ar" ? "تعذّر عرض الملف." : "Could not open the file.");
    }
  }

  // ⚠️ الصورةُ تُصغَّر في الجهاز قبل الرفع: كاميرا الجوال تُخرج ٣–٨ ميجابايت،
  // ورفعُها على شبكةٍ متوسّطة يطول حتى ينقطع في منتصفه — وهو ما كان يقع:
  // طلباتٌ تموت قبل أن تصل الخادم. وشهادةُ الآيبان تُقرأ في صورةٍ عرضُها
  // ١٨٠٠ بكسل قراءةً تامّة، وحجمُها بعدها نحو ثلث ميجابايت.
  var SHRINK_OVER = 500 * 1024;      // ما دونها لا يستحقّ إعادة الترميز
  // ١٤٠٠ بكسل: الشهادةُ والهويةُ تُقرآن كلمةً كلمة، والحجمُ نحو ١٥٠ كيلوبايت
  var MAX_SIDE = 1400;

  function shrinkImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpe?g|png|webp)$/i.test(file.type) || file.size <= SHRINK_OVER)
        return resolve(null);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var cv = document.createElement("canvas");
          cv.width = cw; cv.height = ch;
          cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
          cv.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob || blob.size >= file.size) return resolve(null);
            resolve(new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"),
              { type: "image/jpeg" }));
          }, "image/jpeg", 0.74);
        } catch (e) { URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function fileNode(f) {
    var box = el("div", { class: "file" + (state.files[f.k] ? " has" : "") });
    var pick = el("input", { type: "file", class: "pick",
      accept: f.k === "photo" ? "image/*" : "image/*,application/pdf" });
    var top = el("div", { class: "top" }, [
      el("span", { class: "nm", html: "<span>" + (f[L] || f.ar) + (f.req ? " <em style='color:var(--bad)'>*</em>" : "")
        + "</span><small>" + (state.files[f.k]
            ? (L === "ar" ? "اضغط للاستبدال" : "Tap to replace")
            : (L === "ar" ? "اضغط للاختيار — حتى ١٠ ميجابايت" : "Tap to choose — up to 10 MB")) + "</small>" }),
    ]);
    box.appendChild(pick); box.appendChild(top);

    var got = state.files[f.k];
    if (got) {
      var thumb = got.preview
        ? el("img", { class: "thumb", src: got.preview, alt: "" })
        : el("span", { class: "thumb", text: "📄" });
      box.appendChild(el("div", { class: "meta" }, [
        thumb,
        el("span", { class: "fi", html: "<b>" + got.name.replace(/[<>&]/g, "") + "</b><span>"
          + human(got.size) + " · "
          // حالةُ الرفع تُقرأ في البطاقة: «رُفع» يعني وصل الخادمَ فعلًا،
          // فلا يُفاجأ صاحبُه عند الإرسال بملفٍّ لم يصل.
          + (got.fid ? (L === "ar" ? "رُفع ✓" : "uploaded ✓")
             : got.up === "fail" ? (L === "ar" ? "لم يُرفع — أعد اختياره" : "not uploaded")
             : (L === "ar" ? "جارٍ الرفع…" : "uploading…"))
          + "</span>" }),
        el("button", { class: "rm see", type: "button", text: L === "ar" ? "عرض" : "View",
          onclick: function (ev) {
            // ما أُرفق يُرى قبل الإرسال: كانت البطاقة تعرض الاسم والحجم فقط،
            // فلا يدري المرسِل أصوّر الوجه الصحيح أم ورقةً أخرى.
            ev.preventDefault(); ev.stopPropagation();
            openStored(got);
          } }),
        el("button", { class: "rm", type: "button", text: L === "ar" ? "حذف" : "Remove",
          onclick: function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            delete state.files[f.k]; dirty = true; render(); paintProgress(); paintTabs();
          } }),
      ]));
    }
    async function take(raw) {
      if (!raw) return;
      // التصغيرُ أوّلًا، فالحدُّ يُقاس على ما يُرفع فعلًا لا على ما اختاره
      var small = null;
      try { small = await shrinkImage(raw); } catch (e) { small = null; }
      var file = small || raw;
      if (small) msg("ok", L === "ar"
        ? "صُغّرت «" + raw.name + "» من " + human(raw.size) + " إلى " + human(small.size) + " قبل الرفع."
        : "“" + raw.name + "” was shrunk from " + human(raw.size) + " to " + human(small.size) + ".");
      // ⚠️ الردُّ في البطاقة نفسِها لا في أعلى الصفحة وحده: من يُرفق من
      // جواله لا يرى شريطًا فوق الشاشة وقد تجاوزه بالتمرير — فيظنّ الملفّ
      // أُرفق. والرسالةُ تقول حجمَه وحدَّه معًا، لا «كبير» مجرّدة.
      if (file.size > FILE_MAX) {
        var why = L === "ar"
          ? "الملف كبير: «" + file.name + "» حجمه " + human(file.size)
            + " والحدّ ١٠ ميجابايت للملف الواحد — صغّره أو اختر نسخةً أخفّ."
          : "File too large: “" + file.name + "” is " + human(file.size) + "; the limit is 6 MB.";
        msg("bad", why);
        box.classList.add("bad");
        var w0 = box.querySelector(".warn");
        if (!w0) { w0 = el("div", { class: "warn" }); box.appendChild(w0); }
        w0.textContent = why;
        return;
      }
      box.classList.remove("bad");
      var w1 = box.querySelector(".warn"); if (w1) w1.remove();
      // ومجموعُ ما أُرفق يُحسب قبل القبول: الحدُّ الأعلى للطلب كلِّه ٢٠م
      var sum = file.size;
      Object.keys(state.files).forEach(function (k) {
        if (k !== f.k) sum += (state.files[k].size || 0);
      });
      if (sum > TOTAL_MAX) {
        msg("bad", L === "ar"
          ? "مجموع المرفقات يتجاوز ٤٠ ميجابايت (" + (sum / 1048576).toFixed(1)
            + ") — احذف مرفقًا أو صغّره قبل إضافة هذا."
          : "Attachments would exceed 20 MB (" + (sum / 1048576).toFixed(1) + ").");
        return;
      }
      var r = new FileReader();
      r.onload = async function () {
        var url = String(r.result);
        var b64 = url.split(",")[1] || "";
        state.files[f.k] = {
          name: file.name, size: file.size, type: file.type || "",
          data: b64, fid: "", up: "jar",
          preview: /^image\//.test(file.type) ? url : "",
        };
        dirty = true; msg(""); render(); paintProgress(); paintTabs();
        // ⚠️ يُرفع فورَ اختياره لا مع الإرسال: طلبٌ واحدٌ يحمل المرفقات كلَّها
        // ينقطع في منتصفه على شبكةٍ متوسّطة فيسقط كلُّ شيء. وهنا يُرفع كلُّ
        // ملفٍّ وحده، فما وصل بقي وما انقطع يُعاد وحده.
        try {
          var res = await fetch("/api/join/" + encodeURIComponent(token) + "/file", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: b64, name: file.name }),
          });
          var out = await res.json().catch(function () { return {}; });
          if (!res.ok || !out.fid) throw new Error(out.error || "تعذّر الرفع");
          var cur = state.files[f.k];
          if (cur && cur.name === file.name) {
            cur.fid = out.fid; cur.up = "ok"; cur.data = "";   // البايتات لم تعد لازمة
            render(); paintProgress();
          }
        } catch (e) {
          var c2 = state.files[f.k];
          if (c2 && c2.name === file.name) { c2.up = "fail"; render(); }
          msg("bad", L === "ar"
            ? "تعذّر رفع «" + file.name + "» — اضغط البطاقة لإعادة اختياره، أو تحقّق من الشبكة."
            : "Could not upload “" + file.name + "”. Tap the card to pick it again.");
        }
      };
      r.readAsDataURL(file);
    }
    pick.addEventListener("change", function () { take(pick.files && pick.files[0]); });
    ["dragenter", "dragover"].forEach(function (evt) {
      box.addEventListener(evt, function (e) { e.preventDefault(); box.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      box.addEventListener(evt, function (e) { e.preventDefault(); box.classList.remove("over"); });
    });
    box.addEventListener("drop", function (e) {
      take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    return box;
  }

  // ─────────────────────── التوقيع ───────────────────────
  // توقيعُ صاحب البيانات يُرسل معها: الإقرارُ بصحّتها لا يكفيه مربّعٌ يُعلَّم،
  // والموارد البشرية تعتمد ملفًّا موقَّعًا لا مجرَّد إدخالٍ من متصفّح.
  function signNode() {
    var wrap = el("div", { class: "signwrap" });
    var cv = el("canvas", { class: "signpad", width: 900, height: 320 });
    var ctx = cv.getContext("2d");
    var drawn = false, drawing = false;

    function paintBg() {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#1C1917";
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    paintBg();
    if (state.sign) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, cv.width, cv.height); drawn = true; };
      img.src = state.sign;
    }
    function pos(e) {
      var r = cv.getBoundingClientRect();
      var p = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (cv.width / r.width),
               y: (p.clientY - r.top) * (cv.height / r.height) };
    }
    function start(e) { e.preventDefault(); drawing = true; var q = pos(e); ctx.beginPath(); ctx.moveTo(q.x, q.y); }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var q = pos(e); ctx.lineTo(q.x, q.y); ctx.stroke(); drawn = true;
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      if (!drawn) return;
      state.sign = cv.toDataURL("image/png");
      dirty = true; paintTabs(); paintActions(); paintProgress(); msg("");
    }
    ["mousedown", "touchstart"].forEach(function (n) { cv.addEventListener(n, start, { passive: false }); });
    ["mousemove", "touchmove"].forEach(function (n) { cv.addEventListener(n, move, { passive: false }); });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(function (n) { cv.addEventListener(n, end); });

    wrap.appendChild(cv);
    wrap.appendChild(el("div", { class: "signrow" }, [
      el("button", { class: "btn o", type: "button", text: L === "ar" ? "مسح والإعادة" : "Clear",
        onclick: function () {
          paintBg(); drawn = false; state.sign = "";
          paintTabs(); paintActions(); paintProgress();
        } }),
      el("span", { class: "help", text: L === "ar"
        ? "وقّع داخل المربّع — التوقيع يُرسل مع بياناتك ويظهر في ملفّك."
        : "Sign inside the box — it is sent with your data and appears on your file." }),
    ]));
    return wrap;
  }

  function reviewNode() {
    var frag = document.createDocumentFragment();
    SEC.forEach(function (s, i) {
      if (s.review) return;
      var rows = el("dl", {});
      if (s.sign) {
        rows.appendChild(el("div", { class: "r" }, [
          el("dt", { text: L === "ar" ? "التوقيع" : "Signature" }),
          el("dd", { class: state.sign ? "" : "empty",
            text: state.sign ? (L === "ar" ? "موقَّع" : "Signed")
                             : (L === "ar" ? "— لم يُوقَّع" : "— not signed") }),
        ]));
      }
      fieldsOf(s).forEach(function (f) {
        var v = (state.data[f.k] || "").toString().trim();
        if (f.opts && v) {
          var o = f.opts.filter(function (x) { return x.v === v; })[0];
          if (o) v = o[L] || o.ar;
        }
        rows.appendChild(el("div", { class: "r" }, [
          el("dt", { text: f[L] || f.ar }),
          el("dd", { class: v ? "" : "empty", text: v || (L === "ar" ? "— لم يُملأ" : "— empty") }),
        ]));
      });
      (s.files || []).forEach(function (f) {
        var g = state.files[f.k];
        rows.appendChild(el("div", { class: "r" }, [
          el("dt", { text: f[L] || f.ar }),
          el("dd", { class: g ? "" : "empty",
            text: g ? g.name + " · " + human(g.size) : (L === "ar" ? "— لم يُرفَق" : "— none") }),
        ]));
      });
      frag.appendChild(el("section", { class: "rev" }, [
        el("h3", {}, [
          el("span", { text: (L === "ar" ? s.n : s.nEn) + " — " + (s.title[L] || s.title.ar) }),
          el("button", { type: "button", text: L === "ar" ? "تعديل" : "Edit",
            onclick: function () { go(i); } }),
        ]),
        rows,
      ]));
    });

    var chk = el("input", { type: "checkbox", id: "ackBox" });
    chk.checked = !!state.ack;
    chk.addEventListener("change", function () {
      state.ack = chk.checked; paintTabs(); paintActions();
    });
    frag.appendChild(el("label", { class: "ack", for: "ackBox" }, [
      chk,
      el("span", { text: L === "ar"
        ? "أقرّ بأن البيانات المدخلة صحيحة، وأتحمّل مسؤولية ما ورد فيها."
        : "I confirm the information above is correct and I take responsibility for it." }),
    ]));
    return frag;
  }

  // ─────────────────────── الرسم ───────────────────────
  function msg(kind, text) {
    var m = $("#msg");
    m.className = "msg" + (kind ? " " + kind : "");
    m.textContent = text || "";
    if (kind) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function paintProgress() {
    var p = percent();
    $("#pct").textContent = p + "%";
    $("#bar").style.width = p + "%";
  }
  function paintTabs() {
    var box = $("#tabs"); box.innerHTML = "";
    SEC.forEach(function (s, i) {
      var done = secDone(s);
      var b = el("button", { type: "button",
        class: "tab" + (i === state.step ? " on" : "") + (done ? " done" : ""),
        onclick: function () { go(i); } }, [
        el("b", { text: L === "ar" ? s.n : s.nEn }),
        el("span", { text: s.title[L] || s.title.ar }),
      ]);
      if (done) b.appendChild(el("span", { class: "ck", text: "✓" }));
      box.appendChild(b);
    });
  }
  function paintActions() {
    var last = state.step === SEC.length - 1;
    $("#prev").disabled = state.step === 0;
    var nx = $("#next");
    nx.textContent = last ? t("submit") : t("nextBtn");
    nx.className = "btn " + (last ? "gold" : "g");
    nx.disabled = last && !state.ack;
  }
  function render() {
    var s = SEC[state.step];
    var pane = $("#pane"); pane.innerHTML = "";
    pane.appendChild(el("header", {}, [
      el("div", { class: "n", text: (L === "ar" ? s.n : s.nEn) }),
      el("h2", { text: s.title[L] || s.title.ar }),
      el("p", { text: s.sub[L] || s.sub.ar }),
    ]));
    if (s.review) pane.appendChild(reviewNode());
    else if (s.files) {
      var g = el("div", { class: "files" });
      s.files.forEach(function (f) { g.appendChild(fileNode(f)); });
      pane.appendChild(g);
    } else if (s.sign) pane.appendChild(signNode());
    else {
      var grid = el("div", { class: "grid" });
      fieldsOf(s).forEach(function (f) { grid.appendChild(fieldNode(f)); });
      pane.appendChild(grid);
    }
    paintTabs(); paintActions(); paintProgress();
  }
  function go(i) {
    if (i > state.step && !validateStep()) return;
    state.step = Math.max(0, Math.min(i, SEC.length - 1));
    save(); render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function validateStep() {
    var s = SEC[state.step], bad = null;
    if (s.fields) {
      fieldsOf(s).forEach(function (f) {
        var w = $('.fld[data-k="' + f.k + '"]');
        if (w && !checkOne(f, w) && !bad) bad = w;
      });
    }
    if (s.sign && !state.sign) {
      msg("bad", L === "ar" ? "وقّع في المربّع قبل المتابعة." : "Please sign before continuing.");
      return false;
    }
    if (s.files) {
      var missing = (s.files || []).filter(function (f) { return f.req && !state.files[f.k]; });
      if (missing.length) {
        msg("bad", (L === "ar" ? "مرفقٌ مطلوب: " : "Required attachment: ")
          + missing.map(function (f) { return f[L] || f.ar; }).join("، "));
        return false;
      }
    }
    if (bad) {
      msg("bad", L === "ar" ? "راجع الحقول المعلَّمة بالأحمر." : "Please check the highlighted fields.");
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      var inp = bad.querySelector("input,select"); if (inp) inp.focus({ preventScroll: true });
      return false;
    }
    msg("");
    return true;
  }

  // ─────────────────────── الإرسال ───────────────────────
  function confirmModal() {
    return new Promise(function (resolve) {
      var box = el("div", { class: "box" }, [
        el("h3", { text: L === "ar" ? "تأكيد الإرسال" : "Confirm submission" }),
        el("p", { text: L === "ar"
          ? "بعد الإرسال تُراجع بياناتك في الموارد البشرية، ولا تستطيع تعديلها حتى يُبتّ فيها."
          : "After sending, HR reviews your data; you cannot edit it until they respond." }),
        el("div", { class: "row" }, [
          el("button", { class: "btn o", type: "button", text: L === "ar" ? "رجوع" : "Cancel",
            onclick: function () { m.remove(); resolve(false); } }),
          el("button", { class: "btn gold", type: "button", text: L === "ar" ? "إرسال" : "Send",
            onclick: function () { m.remove(); resolve(true); } }),
        ]),
      ]);
      var m = el("div", { class: "modal" }, [box]);
      m.addEventListener("click", function (e) { if (e.target === m) { m.remove(); resolve(false); } });
      document.body.appendChild(m);
    });
  }

  async function submit() {
    // كلُّ الأقسام تُتحقَّق لا الظاهر وحده: من قفز بينها قد يترك ناقصًا
    for (var i = 0; i < SEC.length; i++) {
      var s = SEC[i];
      if (s.review) continue;
      var bad = fieldsOf(s).filter(function (f) { return fieldError(f); });
      var noFile = (s.files || []).filter(function (f) { return f.req && !state.files[f.k]; });
      if (bad.length || noFile.length || (s.sign && !state.sign)) {
        go(i);
        msg("bad", L === "ar" ? "أكمل هذا القسم قبل الإرسال." : "Complete this section first.");
        return;
      }
    }
    if (!state.ack) return;
    if (!(await confirmModal())) return;

    var btn = $("#next");
    btn.disabled = true;
    btn.innerHTML = '<span class="sk"></span>' + t("sending");
    var body = {};
    Object.keys(state.data).forEach(function (k) {
      var v = state.data[k];
      if (v !== "" && v != null) body[k] = typeof v === "string" ? v.trim() : v;
    });
    if (body.mobile) body.mobile = body.mobile.replace(/\D/g, "");
    if (body.emergency_phone) body.emergency_phone = body.emergency_phone.replace(/\D/g, "");
    if (body.id_number) body.id_number = body.id_number.replace(/\D/g, "");
    if (body.iban) body.iban = body.iban.replace(/\s/g, "").toUpperCase();
    body.full_name_ar = [body.name_first, body.name_father, body.name_grand, body.name_family]
      .filter(Boolean).join(" ");
    // ⚠️ المجموعُ يُقاس قبل الإرسال: من أرفق صورًا كبيرةً يُردّ من الخادم
    // برسالةٍ إنجليزيةٍ غامضة («request entity too large»)، وقد انتظر رفعها
    // كلَّها. والقياسُ هنا يقول له ما يحذف قبل أن ينتظر.
    var tot = 0;
    Object.keys(state.files).forEach(function (k) { tot += (state.files[k].size || 0); });
    if (state.sign) tot += Math.round(String(state.sign).length * 0.75);
    if (tot > TOTAL_MAX) {
      msg("bad", L === "ar"
        ? "مجموعُ المرفقات " + (tot / 1048576).toFixed(1) + " ميجابايت، والحدّ ٤٠ — احذف أو صغّر بعضها ثمّ أعد الإرسال."
        : "Attachments total " + (tot / 1048576).toFixed(1) + " MB; the limit is 40 MB.");
      btn.disabled = false; btn.textContent = t("submit");
      go(SEC.findIndex(function (s) { return s.files; }));
      return;
    }
    body.ack = true;
    // التوقيعُ يُرسل صورةً كالمرفقات، فيُحفظ في ملفّ الموظف ويظهر في نموذجه
    if (state.sign) body.signature = String(state.sign).split(",")[1] || "";
    Object.keys(state.files).forEach(function (k) {
      var g = state.files[k];
      // المرفوعُ سلفًا يُرسَل بمعرّفه لا ببايتاته: الطلبُ يبقى صغيرًا فلا ينقطع
      if (g.fid) body[k + "_fid"] = g.fid; else body[k] = g.data;
      body[k + "_name"] = g.name;
    });

    // ⚠️ مهلةٌ للإرسال: بلا مهلةٍ يبقى الزرُّ «جارٍ الإرسال» إلى الأبد إن
    // تعثّر أودو (بناءٌ جارٍ أو بطء)، فيظنّ صاحبُه التطبيقَ معلَّقًا ويُغلق
    // الصفحة — وقد وصل ملفُّه أو لم يصل ولا يدري. والمهلةُ تقطع الشكّ.
    var ctrl = null, timer = null;
    try { ctrl = new AbortController(); timer = setTimeout(function () { ctrl.abort(); }, 75000); } catch (e) {}
    try {
      var res = await fetch(MINE ? "/api/me/intake" : "/api/join/" + encodeURIComponent(token), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      var out = await res.json().catch(function () { return {}; });
      if (res.status === 413) throw new Error(L === "ar"
        ? "المرفقات أكبر ممّا يقبله الخادم — احذف أو صغّر بعضها ثمّ أعد الإرسال."
        : "Attachments are too large for the server — remove or shrink some.");
      if (!res.ok) throw new Error(out.error || (L === "ar" ? "تعذّر الإرسال — حاول مرّةً أخرى." : "Could not send."));
      dirty = false;
      try { localStorage.removeItem(LS); } catch (e) {}
      $("#wiz").hidden = true; $("#acts").hidden = true; $("#succ").hidden = false;
      $("#succRef").textContent = out.ref || "—";
      $("#succDate").textContent = new Date().toLocaleDateString(
        L === "ar" ? "ar-SA" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
      if (MINE) {
        $("#succT").textContent = L === "ar" ? "شكرًا لك، وصل تصحيحك" : "Thank you — your update was received";
        $("#succP").textContent = L === "ar"
          ? "تراجعه الموارد البشرية ثم يُعتمد نهائيًّا، وعندها تُحدَّث بياناتك."
          : "HR will review it, then it is finally approved and your record is updated.";
      }
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (timer) clearTimeout(timer);
      // الانقطاعُ بالمهلة: قد يكون الملفُّ وصل والردُّ تأخّر، فلا يُقال له
      // «أعد الإرسال» بإطلاق — يُسأل الموارد البشرية قبل أن يُرسل ثانيًا.
      if (err && err.name === "AbortError") {
        msg("bad", L === "ar"
          ? "طال انتظارُ الردّ فقُطع. بياناتك محفوظةٌ هنا — انتظر دقيقةً ثمّ أعد «إرسال»، وإن تكرّر فاتصل بالموارد البشرية قبل الإرسال مرّةً أخرى."
          : "The response took too long and was cancelled. Your data is saved here — wait a minute and press Send again.");
        btn.disabled = false; btn.textContent = t("submit");
        return;
      }
      // ⚠️ «Failed to fetch» رسالةُ متصفّحٍ لا تقول شيئًا لمن يقرؤها: تقع
      // حين ينقطع الاتصال أو يُعاد تشغيل الخادم أثناء الإرسال. وبياناتُ
      // صاحبها محفوظةٌ في جهازه، فيُطمأَن ويُعاد المحاولة لا أن يبدأ من أول.
      var raw = String((err && err.message) || "");
      var net = /failed to fetch|networkerror|load failed|network request failed/i.test(raw);
      msg("bad", net
        ? (L === "ar"
            ? "انقطع الاتصال قبل أن يصل الملف. بياناتك محفوظةٌ في هذا الجهاز — تحقّق من الشبكة واضغط «إرسال» مرّةً أخرى."
            : "The connection dropped before your file was sent. Your data is saved on this device — check your network and press Send again.")
        : raw);
      btn.disabled = false; btn.textContent = t("submit");
    }
  }

  // ─────────────────────── التشغيل ───────────────────────
  function startWizard() {
    // الصورةُ تُكتم عند بدء التعبئة: أثرٌ خلف الورق لا مزاحمةٌ للحقول
    document.body.classList.remove("landing");
    $("#land").hidden = true;
    $("#wiz").hidden = false;
    $("#acts").hidden = false;
    render();
    window.scrollTo({ top: 0 });
  }

  $("#start").addEventListener("click", startWizard);
  $("#prev").addEventListener("click", function () { go(state.step - 1); });
  $("#next").addEventListener("click", function () {
    if (state.step === SEC.length - 1) submit();
    else go(state.step + 1);
  });
  $("#home").addEventListener("click", function () {
    $("#succ").hidden = true; $("#land").hidden = false;
    document.body.classList.add("landing");
    state = { data: {}, files: {}, step: 0, ack: false };
  });
  $("#lang").addEventListener("click", function () {
    L = L === "ar" ? "en" : "ar";
    paintStatic();
    if (!$("#wiz").hidden) render();
  });

  // خروجٌ قبل الإرسال: التنبيه يقع مرّةً واحدة — والمتصفّح يملك نصَّه
  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault(); e.returnValue = "";
  });

  paintStatic();

  // القوائم تُجلب مبكّرًا فتكون جاهزةً قبل أن يبلغ القسم الوظيفي
  fetch("/api/join/options")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      OPTS = { departments: j.departments || [], jobs: j.jobs || [],
               jobsByDept: j.jobsByDept || {}, nationalities: j.nationalities || [] };
      if (!$("#wiz").hidden && SEC[state.step] && SEC[state.step].id === "job") render();
    })
    .catch(function () { /* تبقى الحقول كتابةً حرّة */ });

  if (MINE) {
    document.querySelector("[data-t='h1']").textContent = "تحديث ملفّي الوظيفي";
    fetch("/api/me/intake", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) { msg("bad", "افتح الصفحة من داخل التطبيق بعد تسجيل الدخول."); return; }
        if (j.pending) {
          $("#land").hidden = true; $("#succ").hidden = false;
          document.body.classList.remove("landing");
          $("#succT").textContent = "لك ملفٌّ قيد المراجعة";
          $("#succP").textContent = "انتظر البتّ فيه قبل إرسال تصحيحٍ جديد.";
          $("#succRef").textContent = j.pending.ref;
          $("#succDate").textContent = "—";
          return;
        }
        // بياناتُ أودو تملأ ما لم يُكتب — ولا تدهس ما كتبه الموظف في مسودّته
        var had = restore();
        Object.keys(j.data || {}).forEach(function (k) {
          if (!had || !state.data[k]) state.data[k] = j.data[k];
        });
        if (state.data.full_name_ar && !state.data.name_first) {
          var p = String(state.data.full_name_ar).trim().split(/\s+/);
          state.data.name_first = p[0] || ""; state.data.name_father = p[1] || "";
          state.data.name_grand = p[2] || ""; state.data.name_family = p.slice(3).join(" ") || "";
        }
        paintProgress();
      })
      .catch(function () { msg("bad", "تعذّر جلب بياناتك — أعد فتح الصفحة."); });
  } else if (restore()) {
    // ⚠️ المسودّةُ تُستأنف ولا تُفرض: من ترك التعبئةَ أمسِ يُكمل من حيث
    // وقف، ومن أراد البدءَ من جديد يجد زرًّا يقوله — وكان الاستئنافُ
    // يقع صامتًا فيظنّ من يفتح الرابط أنّ بياناته ضاعت أو أنّها بيانات
    // غيره.
    startWizard();
    var pc = percent();
    var bar = el("div", { class: "resume" }, [
      el("span", { text: "استأنفنا من حيث توقّفت — اكتمال ملفّك " + pc + "٪، وبياناتك محفوظةٌ على هذا الجهاز." }),
      el("button", { class: "btn o", type: "button", text: "ابدأ من جديد",
        onclick: function () {
          if (!window.confirm("سيُمسح ما كتبتَه على هذا الجهاز ويبدأ الملفُّ من أوّله. متأكّد؟")) return;
          try { localStorage.removeItem(LS); } catch (e) {}
          state.data = {}; state.files = {}; state.sign = ""; state.ack = false; state.step = 0;
          dirty = false;
          location.reload();
        } }),
    ]);
    var pane = $("#pane");
    if (pane && pane.parentNode) pane.parentNode.insertBefore(bar, pane);
    msg("");
  }
})();
