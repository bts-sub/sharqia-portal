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
        { k: "nationality_txt", ar: "الجنسية", en: "Nationality", src: "nationalities", req: true },
        { k: "gender", ar: "الجنس", en: "Gender", opts: [
          { v: "male", ar: "ذكر", en: "Male" }, { v: "female", ar: "أنثى", en: "Female" }] },
        { k: "birthday", ar: "تاريخ الميلاد", en: "Date of birth", type: "date", rule: "past" },
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
        { k: "mobile", ar: "رقم الجوال", en: "Mobile number", req: true, mode: "tel", max: 10,
          dir: "ltr", digitsOnly: true, rule: "mobile",
          help: { ar: "يبدأ بـ05 وعشرة أرقام.", en: "Starts with 05, ten digits." } },
        // البريدُ أساسيٌّ: بيانات الدخول والخطاباتُ تصل عليه
        { k: "email", ar: "البريد الإلكتروني", en: "Email", req: true, type: "email", dir: "ltr", rule: "email" },
        { k: "city", ar: "المدينة", en: "City", rule: "letters" },
        // العنوانُ الوطنيّ المختصر بدل الحيّ والشارع: ثمانِ خاناتٍ تُعرّف
        // الموقعَ تعريفًا قاطعًا في العنوان الوطني، ولا تحتمل اجتهادًا.
        { k: "address", ar: "العنوان الوطني المختصر", en: "Short national address",
          dir: "ltr", full: true, max: 8, rule: "shortAddr", upper: true,
          help: { ar: "أربعةُ حروفٍ ثمّ أربعةُ أرقام — كما في تطبيق العنوان الوطني (مثال الصيغة: ABCD1234).",
                  en: "Four letters then four digits, as in the National Address app." } },
        { k: "emergency_name", ar: "اسم شخص للطوارئ", en: "Emergency contact name", rule: "letters" },
        { k: "emergency_phone", ar: "جوال الطوارئ", en: "Emergency contact mobile",
          mode: "tel", max: 10, dir: "ltr", digitsOnly: true, rule: "mobileOpt" },
        // ⚠️ لغير السعوديّ رقمٌ في بلده: يُرجَع إليه إن انقطع خبرُه أو وقعت
        // حادثة، ولا يُسأل عنه السعوديّ فلا محلّ له.
        { k: "home_phone", ar: "رقم تواصل في البلد الأم", en: "Home-country contact number",
          dir: "ltr", mode: "tel", max: 20, rule: "intlOpt",
          help: { ar: "مع رمز الدولة.", en: "Include the country code." },
          when: function (d) { return d.id_type === "iqama"; } },
      ],
    },
    {
      id: "edu", n: "٠٣", nEn: "03",
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
      id: "bank", n: "٠٤", nEn: "04",
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
      id: "files", n: "٠٥", nEn: "05",
      title: { ar: "المرفقات", en: "Attachments" },
      sub: { ar: "صورةٌ واضحة من الجوال تكفي — حتى ٦ ميجابايت للملف.", en: "A clear phone photo is enough — up to 6 MB each." },
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
      id: "sign", n: "٠٦", nEn: "06",
      title: { ar: "التوقيع", en: "Signature" },
      sub: { ar: "وقّع بإصبعك أو بالفأرة — توقيعُك إقرارٌ بما كتبت.",
             en: "Sign with your finger or mouse — your signature confirms what you entered." },
      sign: true,
    },
    {
      id: "review", n: "٠٧", nEn: "07",
      title: { ar: "المراجعة والتأكيد", en: "Review & confirm" },
      sub: { ar: "راجع ما كتبت قبل الإرسال — بعده يُراجَع في الموارد البشرية.", en: "Check everything before sending — HR reviews it next." },
      review: true,
    },
  ];

  var FILE_MAX = 6 * 1024 * 1024;
  var state = { data: {}, files: {}, step: 0, ack: false, sign: "" };
  var dirty = false;
  // أقسامُ المنشأة ومسمّياتها — تُجلب مرّةً وتُملأ بها القوائم
  var OPTS = { departments: [], jobs: [], nationalities: [] };

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
      var d = (v || "").replace(/\D/g, "");
      return /^05\d{8}$/.test(d) ? "" : (L === "ar" ? "الجوال يبدأ بـ05 ويتكوّن من عشرة أرقام."
        : "Mobile must start with 05 and be 10 digits.");
    },
    mobileOpt: function (v) { return v ? RULES.mobile(v) : ""; },
    email: function (v) {
      if (!v) return "";
      return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) ? ""
        : (L === "ar" ? "بريدٌ غير صحيح." : "Invalid email address.");
    },
    iban: function (v) {
      if (!v) return "";
      var s = (v || "").replace(/\s/g, "").toUpperCase();
      if (!/^SA\d{22}$/.test(s)) return L === "ar"
        ? "الآيبان يبدأ بـSA ويتكوّن من ٢٤ خانة." : "IBAN must start with SA and be 24 characters.";
      return "";
    },
    past: function (v) {
      if (!v) return "";
      return v < new Date().toISOString().slice(0, 10) ? ""
        : (L === "ar" ? "التاريخ يجب أن يكون في الماضي." : "Date must be in the past.");
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
    var cur = (state.data[f.k] || "").toString();
    var known = cur && list.indexOf(cur) >= 0;
    var sel = el("select", { id: "fld-" + f.k });
    sel.appendChild(el("option", { value: "", text: L === "ar" ? "اختر…" : "Select…" }));
    list.forEach(function (v) { sel.appendChild(el("option", { value: v, text: v })); });
    sel.appendChild(el("option", { value: "__other", text: L === "ar" ? "غير موجود — أكتبه" : "Not listed — type it" }));
    sel.value = known ? cur : (cur ? "__other" : "");
    var free = el("input", {
      type: "text", placeholder: f.ph || "", style: "margin-top:8px",
      hidden: known || !cur ? true : false,
    });
    free.value = known ? "" : cur;
    function sync() {
      var v = sel.value === "__other" ? free.value.trim() : sel.value;
      state.data[f.k] = v; dirty = true; save(); paintProgress(); paintTabs();
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
    wrap.appendChild(el("div", { class: "hint" }));
    return wrap;
  }

  function fieldNode(f) {
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

  function fileNode(f) {
    var box = el("div", { class: "file" + (state.files[f.k] ? " has" : "") });
    var pick = el("input", { type: "file", class: "pick",
      accept: f.k === "photo" ? "image/*" : "image/*,application/pdf" });
    var top = el("div", { class: "top" }, [
      el("span", { class: "nm", html: "<span>" + (f[L] || f.ar) + (f.req ? " <em style='color:var(--bad)'>*</em>" : "")
        + "</span><small>" + (state.files[f.k] ? (L === "ar" ? "اضغط للاستبدال" : "Tap to replace")
          : (L === "ar" ? "اضغط للاختيار أو أفلِت الملف هنا" : "Tap to choose or drop a file")) + "</small>" }),
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
          + human(got.size) + " · " + (got.type || "ملف") + "</span>" }),
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
    function take(file) {
      if (!file) return;
      if (file.size > FILE_MAX) {
        msg("bad", L === "ar" ? "«" + file.name + "» أكبر من ٦ ميجابايت — اختر صورةً أصغر."
          : "“" + file.name + "” is larger than 6 MB.");
        return;
      }
      var r = new FileReader();
      r.onload = function () {
        var url = String(r.result);
        state.files[f.k] = {
          name: file.name, size: file.size, type: file.type || "",
          data: url.split(",")[1],
          preview: /^image\//.test(file.type) ? url : "",
        };
        dirty = true; msg(""); render(); paintProgress(); paintTabs();
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
    body.ack = true;
    // التوقيعُ يُرسل صورةً كالمرفقات، فيُحفظ في ملفّ الموظف ويظهر في نموذجه
    if (state.sign) body.signature = String(state.sign).split(",")[1] || "";
    Object.keys(state.files).forEach(function (k) {
      body[k] = state.files[k].data;
      body[k + "_name"] = state.files[k].name;
    });

    try {
      var res = await fetch(MINE ? "/api/me/intake" : "/api/join/" + encodeURIComponent(token), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      var out = await res.json().catch(function () { return {}; });
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
      msg("bad", err.message);
      btn.disabled = false; btn.textContent = t("submit");
    }
  }

  // ─────────────────────── التشغيل ───────────────────────
  function startWizard() {
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
               nationalities: j.nationalities || [] };
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
    // مسودّةٌ محفوظة: يُستأنف منها بلا أن يُعاد ما كُتب
    startWizard();
    msg("good", "استأنفنا من حيث توقّفت — بياناتك محفوظة على هذا الجهاز.");
  }
})();
