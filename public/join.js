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
      // ⚠️ الهنديةُ تُترجَم هنا لا في كلّ موضعٍ على حدة: الصفحةُ فيها
      //   سبعةٌ وستّون شرطًا «عربيٌّ أو إنجليزيّ»، وإضافةُ فرعٍ ثالثٍ
      //   لكلٍّ منها سبعةٌ وستّون موضعَ خطأ. وكلُّ نصٍّ يُعرض يمرّ بهذه
      //   الدالّة — فترجمتُه عندها تكفي، ويبقى الشرطُ ثنائيًّا كما هو.
      else if (k === "html") n.innerHTML = hx(attrs[k]);
      else if (k === "text") n.textContent = hx(attrs[k]);
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  };

  // ─────────────────────── الترجمة ───────────────────────
  // ثلاثُ لغات: العربية والإنجليزية والهندية. والهنديةُ تُبنى على
  // الإنجليزية: ما لم يُترجَم منها يظهر إنجليزيًّا — لا عربيًّا يعجز عن
  // قراءته من اختار الهندية.
  var LANGS = ["ar", "en", "hi"];
  var LANG_NAME = { ar: "العربية", en: "English", hi: "हिन्दी" };
  var L = "ar";
  try { if (LANGS.indexOf(localStorage.getItem("sq.intake.lang")) >= 0) L = localStorage.getItem("sq.intake.lang"); } catch (e) {}

  // قاموسُ الهندية — مفتاحُه النصُّ الإنجليزيّ كما هو في الصفحة.
  var HI = {
    // الترويسةُ والصفحةُ الافتتاحية
    "Abaya Sharqiaa": "अबाया शरकिया",
    "Employee Data Portal": "कर्मचारी डेटा पोर्टल",
    "Welcome. Please update your details so your employment record stays accurate.":
      "आपका स्वागत है। कृपया अपना विवरण अपडेट करें ताकि आपका रोज़गार रिकॉर्ड सही बना रहे।",
    "Takes about 5 minutes to complete.": "पूरा करने में लगभग ५ मिनट लगते हैं।",
    "Start now": "अभी शुरू करें",
    "Seven clear steps": "सात स्पष्ट चरण",
    "Move between them and return to any one.": "इनके बीच आ-जा सकते हैं और किसी भी चरण पर लौट सकते हैं।",
    "Saved automatically": "अपने आप सहेजा गया",
    "Finish later on the same device — nothing is lost.":
      "इसी डिवाइस पर बाद में पूरा करें — कुछ भी नहीं खोएगा।",
    "Your data is protected": "आपका डेटा सुरक्षित है",
    "Never published; used only in your employment file.":
      "कभी प्रकाशित नहीं होता; केवल आपकी रोज़गार फ़ाइल में उपयोग होता है।",
    "Profile completion": "प्रोफ़ाइल पूर्णता",
    "Back": "पिछला", "Next": "अगला",
    "Reference": "अनुरोध संख्या", "Submitted on": "अपडेट की तारीख",
    "Back to start": "मुख्य पृष्ठ पर लौटें",
    "For any question, please contact Human Resources.":
      "किसी भी प्रश्न के लिए कृपया मानव संसाधन विभाग से संपर्क करें।",
    "Abaya Sharqiaa — Kingdom of Saudi Arabia": "अबाया शरकिया — सऊदी अरब साम्राज्य",
    "Confirm and submit": "पुष्टि करें और भेजें", "Sending…": "भेजा जा रहा है…",
    "Thank you — your update was received": "धन्यवाद — आपका अपडेट प्राप्त हुआ",

    // عناوينُ الأقسام
    "Personal details": "व्यक्तिगत विवरण",
    "Exactly as on your ID or Iqama.": "ठीक वैसे ही जैसे आपके आईडी या इक़ामा पर है।",
    "Contact details": "संपर्क विवरण",
    "We will reach you here — please verify.": "हम आपसे यहीं संपर्क करेंगे — कृपया जाँच लें।",
    "Employment details": "रोज़गार विवरण",
    "What you know; HR will refine it if needed.":
      "जो आप जानते हैं; ज़रूरत पड़ने पर मानव संसाधन इसे ठीक कर देगा।",
    "Qualifications & experience": "योग्यता और अनुभव",
    "Leave anything that does not apply blank.": "जो लागू न हो उसे खाली छोड़ दें।",
    "Bank details": "बैंक विवरण",
    "Your salary goes here — check the IBAN carefully.":
      "आपका वेतन यहीं आएगा — आईबैन को ध्यान से जाँचें।",
    "Attachments": "संलग्नक",
    "Shoot with your phone — images are shrunk automatically. Limit: 10 MB per file, 40 MB in total; each file uploads as soon as you pick it.":
      "अपने फ़ोन से फ़ोटो लें — तस्वीरें अपने आप छोटी कर दी जाती हैं। सीमा: प्रति फ़ाइल १० एमबी, कुल ४० एमबी; हर फ़ाइल चुनते ही अपलोड हो जाती है।",
    "Signature": "हस्ताक्षर",
    "Sign with a blue pen on white paper, photograph it and attach — your signature confirms what you entered.":
      "सफ़ेद काग़ज़ पर नीले पेन से हस्ताक्षर करें, उसकी फ़ोटो लें और संलग्न करें — आपका हस्ताक्षर आपकी दी गई जानकारी की पुष्टि है।",
    "Review & confirm": "समीक्षा और पुष्टि",
    "Check everything before sending — HR reviews it next.":
      "भेजने से पहले सब कुछ जाँच लें — इसके बाद मानव संसाधन इसकी समीक्षा करेगा।",

    // الحقول
    "First name": "पहला नाम", "Father's name": "पिता का नाम",
    "Grandfather's name": "दादा का नाम", "Family name": "कुल/वंश का नाम",
    "Name in English (as in passport)": "अंग्रेज़ी में नाम (पासपोर्ट के अनुसार)",
    "Latin letters only.": "केवल अंग्रेज़ी अक्षर।",
    "ID type": "पहचान का प्रकार", "National ID": "राष्ट्रीय पहचान पत्र", "Iqama": "इक़ामा",
    "ID / Iqama number": "पहचान / इक़ामा संख्या",
    "ID expiry date": "पहचान की समाप्ति तिथि",
    "Passport number": "पासपोर्ट संख्या",
    "Nationality": "राष्ट्रीयता",
    "Open the list and type the first letter to jump.":
      "सूची खोलें और पहला अक्षर टाइप करके सीधे पहुँचें।",
    "Gender": "लिंग", "Male": "पुरुष", "Female": "महिला",
    "Date of birth": "जन्म तिथि", "18 years or older.": "१८ वर्ष या अधिक।",
    "Marital status": "वैवाहिक स्थिति",
    "Single": "अविवाहित", "Married": "विवाहित", "Divorced": "तलाकशुदा", "Widowed": "विधुर / विधवा",
    "Children": "बच्चों की संख्या",
    "Mobile number": "मोबाइल नंबर",
    "Pick the country code, then type digits. Saudi numbers start with 05.":
      "देश का कोड चुनें, फिर अंक लिखें। सऊदी नंबर ०५ से शुरू होते हैं।",
    "Email": "ईमेल", "City": "शहर",
    "Short national address": "संक्षिप्त राष्ट्रीय पता",
    "Four letters then four digits, as in the National Address app.":
      "चार अक्षर फिर चार अंक, जैसे राष्ट्रीय पता ऐप में होता है।",
    "Emergency contact name": "आपात संपर्क का नाम",
    "Emergency contact mobile": "आपात संपर्क का मोबाइल",
    "Home-country contact number": "अपने देश का संपर्क नंबर",
    "Department": "विभाग", "Job title": "पद का नाम",
    "Pick the department first to see its titles.":
      "पहले विभाग चुनें ताकि उसके पद दिखें।",
    "Branch": "शाखा", "Start date": "कार्यारंभ तिथि",
    "Contract type": "अनुबंध का प्रकार",
    "Full time": "पूर्णकालिक", "Part time": "अंशकालिक",
    "Seasonal": "मौसमी", "Training": "प्रशिक्षण",
    "Qualification": "शैक्षिक योग्यता",
    "Below secondary": "माध्यमिक से कम", "Secondary": "माध्यमिक",
    "Diploma": "डिप्लोमा", "Bachelor's": "स्नातक",
    "Master's": "स्नातकोत्तर", "Doctorate": "पीएच.डी.", "Other": "अन्य",
    "Field of study": "विशेषज्ञता",
    "University / institution": "विश्वविद्यालय / संस्थान",
    "Years of experience": "अनुभव के वर्ष",
    "Bank name": "बैंक का नाम", "Account holder name": "खाताधारक का नाम",
    "IBAN": "आईबैन", "22 digits": "२२ अंक",
    "Enter the 22 digits only — SA is fixed.":
      "केवल २२ अंक लिखें — SA पहले से लिखा है।",
    "IBAN letter": "आईबैन प्रमाणपत्र", "ID / Iqama": "पहचान / इक़ामा",
    "CV / Résumé": "बायोडाटा", "Qualification certificate": "योग्यता प्रमाणपत्र",
    "Certificates": "प्रमाणपत्र", "Personal photo": "व्यक्तिगत फ़ोटो",
    "Other attachments": "अन्य संलग्नक", "Signature photo": "हस्ताक्षर की फ़ोटो",

    // رسائلُ التحقّق
    "This field is required.": "यह फ़ील्ड आवश्यक है।",
    "Letters only — no digits.": "केवल अक्षर — अंक नहीं।",
    "Latin letters only, as in the passport.": "केवल अंग्रेज़ी अक्षर, पासपोर्ट के अनुसार।",
    "Format: four letters then four digits.": "प्रारूप: चार अक्षर फिर चार अंक।",
    "Invalid number — digits only after the country code.":
      "अमान्य नंबर — देश कोड के बाद केवल अंक।",
    "ID number must be exactly 10 digits.": "पहचान संख्या ठीक १० अंकों की होनी चाहिए।",
    "Saudi numbers start with 05 (10 digits) — or pick another country code.":
      "सऊदी नंबर ०५ से शुरू होते हैं (१० अंक) — या दूसरा देश कोड चुनें।",
    "Invalid email address.": "अमान्य ईमेल पता।",
    "Date must be in the past.": "तारीख बीते समय की होनी चाहिए।",
    "Age is under 18 — check the date.": "आयु १८ वर्ष से कम है — तारीख जाँचें।",
    "Please check the date of birth.": "कृपया जन्म तिथि जाँचें।",
    "Please check the highlighted fields.": "कृपया चिह्नित फ़ील्ड जाँचें।",
    "Complete this section first.": "पहले यह अनुभाग पूरा करें।",
    "Please sign before continuing.": "आगे बढ़ने से पहले हस्ताक्षर करें।",
    "Attach a photo of your signature before continuing.":
      "आगे बढ़ने से पहले अपने हस्ताक्षर की फ़ोटो संलग्न करें।",

    // القوائمُ والمرفقات
    "Select…": "चुनें…", "Other — type it yourself": "अन्य — स्वयं लिखें",
    "Pick the department first…": "पहले विभाग चुनें…",
    "Titles are listed for the department you pick.":
      "पद उसी विभाग के दिखाए जाते हैं जो आप चुनते हैं।",
    "Type it as it is": "जैसा है वैसा लिखें",
    "Tap to replace": "बदलने के लिए दबाएँ",
    "Tap to choose — up to 10 MB": "चुनने के लिए दबाएँ — १० एमबी तक",
    "uploaded ✓": "अपलोड हुआ ✓", "not uploaded": "अपलोड नहीं हुआ",
    "uploading…": "अपलोड हो रहा है…",
    "View": "देखें", "Remove": "हटाएँ",
    "Could not open the file.": "फ़ाइल नहीं खुल सकी।",
    "Your browser blocked the pop-up.": "आपके ब्राउज़र ने पॉप-अप रोक दिया।",
    "Attachments are too large for the server — remove or shrink some.":
      "संलग्नक सर्वर के लिए बहुत बड़े हैं — कुछ हटाएँ या छोटे करें।",
    "Could not send.": "भेजा नहीं जा सका।",
    "The connection dropped before your file was sent. Your data is saved on this device — check your network and press Send again.":
      "फ़ाइल भेजने से पहले कनेक्शन टूट गया। आपका डेटा इसी डिवाइस पर सहेजा है — नेटवर्क जाँचें और फिर से भेजें दबाएँ।",
    "The response took too long and was cancelled. Your data is saved here — wait a minute and press Send again.":
      "उत्तर में बहुत समय लगा और रद्द हो गया। आपका डेटा यहीं सहेजा है — एक मिनट रुकें और फिर से भेजें दबाएँ।",

    // التوقيعُ والمراجعة
    "How to attach your signature": "हस्ताक्षर कैसे संलग्न करें",
    "Sign with a blue pen on white paper.": "सफ़ेद काग़ज़ पर नीले पेन से हस्ताक्षर करें।",
    "Photograph it in good light with no shadow on the paper.":
      "अच्छी रोशनी में फ़ोटो लें, काग़ज़ पर कोई छाया न हो।",
    "Fill the frame with the signature, then attach it below.":
      "हस्ताक्षर से पूरा फ़्रेम भरें, फिर नीचे संलग्न करें।",
    "Signed and attached": "हस्ताक्षरित और संलग्न",
    "I confirm the information above is correct and I take responsibility for it.":
      "मैं पुष्टि करता/करती हूँ कि ऊपर दी गई जानकारी सही है और इसकी ज़िम्मेदारी मेरी है।",
    "Confirm submission": "भेजने की पुष्टि",
    "After sending, HR reviews your data; you cannot edit it until they respond.":
      "भेजने के बाद मानव संसाधन आपका डेटा देखेगा; उनके उत्तर तक आप इसे बदल नहीं सकते।",
    "HR will review it, then it is finally approved and your record is updated.":
      "मानव संसाधन इसकी समीक्षा करेगा, फिर अंतिम स्वीकृति मिलेगी और आपका रिकॉर्ड अपडेट होगा।",
    "— empty": "— खाली", "— none": "— कोई नहीं", "— not attached": "— संलग्न नहीं",
    "Edit": "संपादित करें", "Cancel": "रद्द करें", "Send": "भेजें",
    "Required attachment: ": "आवश्यक संलग्नक: ",
    "Returned: ": "वापस भेजा गया: ",
    "Attachments total ": "कुल संलग्नक ",
    "Enter 22 digits — you typed ": "२२ अंक लिखें — आपने लिखे ",
    "Expected ": "अपेक्षित ",
    " digits after the code; you typed ": " अंक कोड के बाद; आपने लिखे ",
    "File too large: “": "फ़ाइल बहुत बड़ी: “",
    "Could not upload “": "अपलोड नहीं हो सकी “",
    "”. Tap the card to pick it again.": "”. दोबारा चुनने के लिए कार्ड दबाएँ।",
    "” was shrunk from ": "” छोटी की गई ",
    "; the limit is 6 MB.": "; सीमा ६ एमबी है।",
    " MB; the limit is 40 MB.": " एमबी; सीमा ४० एमबी है।",
    "” is ": "” का आकार ", " KB": " केबी", " MB": " एमबी"
  };

  // ⚠️ الأطولُ أوّلًا: «IBAN» تقع داخل «IBAN letter»، فلو استُبدلت قبلها
  //   خرجت «आईबैन letter» — نصفُها مترجَمٌ ونصفُها إنجليزيّ. والترتيبُ
  //   يُحسب مرّةً لا مع كلّ نصٍّ يُعرض.
  var HI_KEYS = Object.keys(HI).sort(function (a, b) { return b.length - a.length; });

  // ⚠️ نصوصٌ كُتبت بالعربية وحدَها بلا مقابلٍ إنجليزيّ — بطاقةُ
  // «لتصحيح بياناتك» ونافذتُها ورسائلُها. كانت تبقى عربيةً مهما غُيّرت
  // اللغة، فيقف الهنديُّ أمام بطاقةٍ لا يفكّ حرفَها في صفحةٍ كلُّها
  // بلغته. وهي هنا لا عند كلّ موضعٍ: كلُّها يمرّ بـ hx().
  var AR = {
    "لتصحيح بياناتك اضغط هنا": {
      en: "Tap here to correct your data", hi: "अपना डेटा ठीक करने के लिए यहाँ दबाएँ" },
    "تصحيح بياناتك": { en: "Correct your data", hi: "अपना डेटा ठीक करें" },
    "إن أعادت الموارد البشرية ملفَّك للتصحيح، استعِد ما كتبتَه بدل كتابته من جديد.": {
      en: "If HR returned your file for correction, restore what you wrote instead of typing it again.",
      hi: "यदि मानव संसाधन ने आपकी फ़ाइल सुधार के लिए लौटाई है, तो दोबारा लिखने के बजाय अपना लिखा हुआ वापस लाएँ।" },
    "رقم الهوية أو الجوال أو رقم الطلب": {
      en: "ID number, mobile, or reference number",
      hi: "पहचान संख्या, मोबाइल, या अनुरोध संख्या" },
    "اكتب واحدًا منها: رقم هويتك/إقامتك، أو جوالك، أو رقم طلبك (HR-JOIN-…).": {
      en: "Enter any one: your ID/Iqama number, your mobile, or your reference (HR-JOIN-…).",
      hi: "इनमें से कोई एक लिखें: आपकी पहचान/इक़ामा संख्या, आपका मोबाइल, या आपकी अनुरोध संख्या (HR-JOIN-…)।" },
    "استعادة بياناتي": { en: "Restore my data", hi: "मेरा डेटा वापस लाएँ" },
    "إغلاق": { en: "Close", hi: "बंद करें" },
    "اكتب رقمًا صحيحًا.": { en: "Enter a valid number.", hi: "सही संख्या लिखें।" },
    "جارٍ البحث…": { en: "Searching…", hi: "खोजा जा रहा है…" },
    "تعذّر الاتصال — حاول مرّةً أخرى.": {
      en: "Connection failed — please try again.", hi: "कनेक्शन विफल — फिर कोशिश करें।" },
    "تعذّر جلب بياناتك — أعد فتح الصفحة.": {
      en: "Could not load your data — reopen the page.",
      hi: "आपका डेटा नहीं मिला — पृष्ठ फिर खोलें।" },
    "افتح الصفحة من داخل التطبيق بعد تسجيل الدخول.": {
      en: "Open this page from inside the app after signing in.",
      hi: "साइन इन करने के बाद इस पृष्ठ को ऐप के भीतर से खोलें।" },
    "ابدأ من جديد": { en: "Start over", hi: "फिर से शुरू करें" },
    "تحديث ملفّي الوظيفي": { en: "Update my employment file", hi: "मेरी रोज़गार फ़ाइल अपडेट करें" },
    "لك ملفٌّ قيد المراجعة": { en: "You have a file under review", hi: "आपकी एक फ़ाइल समीक्षाधीन है" },
    "انتظر البتّ فيه قبل إرسال تصحيحٍ جديد.": {
      en: "Wait for a decision before sending another correction.",
      hi: "दूसरा सुधार भेजने से पहले निर्णय की प्रतीक्षा करें।" },
    "الكود": { en: "Code", hi: "कोड" },
    "دولةٌ أخرى": { en: "Another country", hi: "अन्य देश" }
  };

  // يترجم نصًّا إلى اللغة المختارة: العربيُّ المكتوبُ وحدَه من AR،
  // والإنجليزيُّ إلى الهندية من HI — مطابقةً تامّةً أوّلًا، ثمّ استبدالًا
  // داخل النصوص المركَّبة (نصٌّ فيه اسمُ ملفٍّ أو رقمٌ بين عباراتٍ ثابتة).
  function hx(s) {
    if (s == null) return s;
    if (L !== "ar") {
      var a = AR[String(s)];
      if (a) return a[L] || a.en;
    }
    if (L !== "hi") return s;
    var v = String(s);
    if (HI[v]) return HI[v];
    if (!/[A-Za-z]/.test(v)) return v;
    HI_KEYS.forEach(function (k) {
      if (k.length > 2 && v.indexOf(k) >= 0) v = v.split(k).join(HI[k]);
    });
    return v;
  }

  // ⚠️ والهنديةُ ترجع إلى الإنجليزية لا إلى العربية: بياناتُ الحقول
  //   مكتوبةٌ بمفتاحَي ar وen، فلو رجعت إلى ar لقرأ الهنديُّ عربيًّا.
  function lk(o) {
    if (!o) return "";
    return o[L] || (L === "hi" ? o.en : "") || o.ar || "";
  }
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
  function t(k) {
    return hx((T[L] && T[L][k]) || (L === "hi" ? T.en[k] : "") || T.ar[k] || k);
  }
  function paintStatic() {
    document.querySelectorAll("[data-t]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-t"));
    });
    document.documentElement.lang = L;
    document.documentElement.dir = L === "ar" ? "rtl" : "ltr";
    // ⚠️ وبطاقةُ «تصحيح بياناتك» تُعاد بناؤها مع كلّ تبديل: بطاقاتُ
    //   الافتتاحية تُترجَم بـdata-t، وهذه وحدَها تُبنى بجافاسكربت وتُلصق
    //   مرّةً — فكانت تبقى باللغة التي بُنيت بها، فتُقرأ هنديّةً في صفحةٍ
    //   عربية.
    var rec = $("#recCard");
    if (rec && rec.parentNode) rec.parentNode.replaceChild(recoverCard(), rec);
    // الزرُّ يحمل اسمَ اللغة الحالية، والقائمةُ تحته تعرض الثلاث.
    var now = $("#langNow");
    if (now) now.textContent = LANG_NAME[L];
    var menu = $("#langMenu");
    if (menu) {
      menu.innerHTML = "";
      LANGS.forEach(function (code) {
        var b = el("button", { type: "button", role: "menuitem", text: LANG_NAME[code] });
        if (code === L) b.setAttribute("aria-current", "true");
        b.addEventListener("click", function () { setLang(code); });
        menu.appendChild(b);
      });
    }
  }

  function langMenu(open) {
    var m = $("#langMenu"), b = $("#lang");
    if (!m || !b) return;
    m.classList.toggle("on", !!open);
    b.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setLang(code) {
    langMenu(false);
    if (code === L) return;
    L = code;
    try { localStorage.setItem("sq.intake.lang", L); } catch (e) {}
    paintStatic();
    if (!$("#wiz").hidden) render();
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
          help: { ar: "افتح القائمة واكتب أوّل حرفٍ لتقفز إليه.",
                  en: "Open the list and type the first letter to jump." } },
        { k: "gender", ar: "الجنس", en: "Gender", opts: [
          { v: "male", ar: "ذكر", en: "Male" }, { v: "female", ar: "أنثى", en: "Female" }] },
        // ⚠️ مطلوبٌ لا اختياري: التاريخُ يدخل في سنّ التقاعد ونهاية الخدمة
        // والتأمين، ويُطلب في كلّ معاملةٍ حكومية. وما يُترك فارغًا هنا
        // يُجمع بعد شهورٍ بالاتّصال واحدًا واحدًا.
        { k: "birthday", ar: "تاريخ الميلاد", en: "Date of birth", type: "date",
          req: true, rule: "birth18",
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
          help: { ar: "اختر كود الدولة ثمّ اكتب الأرقام بلا صفرٍ أوّل — الكودُ يُغني عنه.",
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
        { k: "emergency_name", ar: "اسم شخص للطوارئ", en: "Emergency contact name", rule: "letters", req: true },
        { k: "emergency_phone", ar: "جوال الطوارئ", en: "Emergency contact mobile",
          phone: true, rule: "mobile", req: true },
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
          { v: "temp", ar: "موسمي", en: "Seasonal" },
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
      sub: { ar: "وقّع بقلمٍ أزرق على ورقةٍ بيضاء، وصوّرها وأرفقها — توقيعُك إقرارٌ بما كتبت.",
             en: "Sign with a blue pen on white paper, photograph it and attach — your signature confirms what you entered." },
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
  var SENT = null;   // ملفٌّ سبق إرساله من هذا الجهاز: { ref, at }
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
      SENT = o.sent || null;
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
      var s = String(v).replace(/[\s()-]/g, "");
      if (!/^\+?\d{7,15}$/.test(s)) return L === "ar"
        ? "رقمٌ غير صحيح — اكتب أرقامه بعد كود الدولة."
        : "Invalid number — digits only after the country code.";
      // ⚠️ الطولُ بحسب الدولة: رقمٌ ناقصٌ خانةً لا يُتّصل به، ويُكتشف بعد
      // شهورٍ حين يُحتاج صاحبُه.
      if (s.charAt(0) === "+") {
        for (var i = 0; i < DIAL.length; i++) {
          var c = DIAL[i].c;
          if (s.slice(1, 1 + c.length) === c) {
            var rest = s.slice(1 + c.length).length;
            if (rest !== DIAL[i].n) {
              return L === "ar"
                ? "أرقام هذه الدولة " + DIAL[i].n + " بعد الكود — كتبتَ " + rest + "."
                : "Expected " + DIAL[i].n + " digits after the code; you typed " + rest + ".";
            }
            break;
          }
        }
      }
      return "";
    },
    id: function (v) {
      var d = (v || "").replace(/\D/g, "");
      return d.length === 10 ? "" : (L === "ar" ? "رقم الهوية أو الإقامة عشرة أرقام."
        : "ID number must be exactly 10 digits.");
    },
    // جوالُ الطوارئ اختياريٌّ، فإن كُتب فُحص كما يُفحص جوالُ صاحب الملف
    mobileOpt: function (v) { return v ? RULES.mobile(v) : ""; },
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
      if (state.data.id_type === "national") state.data.nationality_txt = "سعودي";
      else if (/(السعودية|سعودي)/.test(state.data.nationality_txt || "")) state.data.nationality_txt = "";
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
    if (s.sign) return !!state.files.signature;
    if (s.files) return (s.files || []).every(function (f) { return !f.req || state.files[f.k]; });
    return fieldsOf(s).every(function (f) { return !fieldError(f); });
  }
  function percent() {
    var all = [], done = 0;
    SEC.forEach(function (s) {
      fieldsOf(s).forEach(function (f) { all.push(!!(state.data[f.k] || "").toString().trim()); });
      (s.files || []).forEach(function (f) { all.push(!!state.files[f.k]); });
      if (s.sign) all.push(!!state.files.signature);
    });
    all.forEach(function (x) { if (x) done++; });
    return all.length ? Math.round((done / all.length) * 100) : 0;
  }
  function label(f) {
    var lb = el("label", { for: "fld-" + f.k, text: lk(f) });
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
    if (lock) list = ["سعودي"];
    else if (f.k === "nationality_txt" && state.data.id_type === "iqama") {
      list = list.filter(function (n) {
        return !/(السعودية|سعودي|المملكة العربية السعودية|Saudi)/i.test(n);
      });
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
    var sel = el("select", { id: "fld-" + f.k });
    sel.appendChild(el("option", { value: "", text: L === "ar" ? "اختر…" : "Select…" }));
    list.forEach(function (v) { sel.appendChild(el("option", { value: v, text: v })); });
    if (!lock) sel.appendChild(el("option", { value: "__other", text: L === "ar" ? "أخرى — أكتبه بنفسك" : "Other — type it yourself" }));
    sel.value = known ? cur : (cur ? "__other" : "");
    // خانةُ الكتابة تقول ما يُكتب فيها: «أخرى» بلا إرشادٍ تُترك فارغة
    var free = el("input", {
      type: "text", style: "margin-top:8px",
      placeholder: (f.ph && typeof f.ph === "object" ? (lk(f.ph)) : f.ph)
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
  // أكواد الدول الأكثر ورودًا في ملفّات المنشأة، ومعها طولُ الرقم المحليّ
  // فيها — فلا يُكتب أكثر ولا يُقبل أقلّ. والبقيّةُ تُكتب بعد «أخرى».
  //   n: عددُ أرقام الجوال بعد كود الدولة (بلا الصفر المحليّ)
  var DIAL = [
    { c: "966", ar: "السعودية +966", n: 9 },   // 05xxxxxxxx محليًّا (١٠)
    { c: "20",  ar: "مصر +20",        n: 10 },
    { c: "91",  ar: "الهند +91",      n: 10 },
    { c: "92",  ar: "باكستان +92",    n: 10 },
    { c: "880", ar: "بنغلاديش +880",  n: 10 },
    { c: "63",  ar: "الفلبين +63",    n: 10 },
    { c: "249", ar: "السودان +249",   n: 9 },
    { c: "967", ar: "اليمن +967",     n: 9 },
    { c: "962", ar: "الأردن +962",    n: 9 },
    { c: "963", ar: "سوريا +963",     n: 9 },
    { c: "964", ar: "العراق +964",    n: 10 },
    { c: "212", ar: "المغرب +212",    n: 9 },
    { c: "216", ar: "تونس +216",      n: 8 },
    { c: "213", ar: "الجزائر +213",   n: 9 },
    { c: "90",  ar: "تركيا +90",      n: 10 },
    { c: "94",  ar: "سريلانكا +94",   n: 9 },
    { c: "251", ar: "إثيوبيا +251",   n: 9 },
    { c: "256", ar: "أوغندا +256",    n: 9 },
    { c: "254", ar: "كينيا +254",     n: 9 },
    { c: "62",  ar: "إندونيسيا +62",  n: 10 },
    { c: "971", ar: "الإمارات +971",  n: 9 },
    { c: "965", ar: "الكويت +965",    n: 8 },
    { c: "973", ar: "البحرين +973",   n: 8 },
    { c: "974", ar: "قطر +974",       n: 8 },
    { c: "968", ar: "عُمان +968",      n: 8 },
  ];
  var DIAL_LEN = {};
  DIAL.forEach(function (d) { DIAL_LEN[d.c] = d.n; });

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
    // المحفوظُ محليًّا (05…) يُعرض بلا صفره مع كود السعودية
    return { code: "966", num: s.replace(/^0+/, "") };
  }
  function joinPhone(code, num) {
    var d = String(num || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    // السعوديُّ يُخزَّن بصيغته المحلية (05…) لأنّ أنظمة المنشأة تعرفه بها،
    // والصفرُ يُعاد هنا لا في الشاشة.
    if (code === "966") return d.length === 9 ? "0" + d : d;
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
    // ⚠️ علامةُ الزائد تنقلب في النصّ العربي فتُقرأ «966+»: تُحاط بعلامتَي
    // اتجاهٍ (LRM) فتبقى قبل رقمها كما تُكتب.
    DIAL.forEach(function (d) {
      var t = d.ar.replace(/\s*\+(\d+)$/, " \u200E+$1\u200E");
      sel.appendChild(el("option", { value: d.c, text: t }));
    });
    sel.appendChild(el("option", { value: "other", text: "دولةٌ أخرى" }));
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
      // ⚠️ الطولُ بحسب الدولة: لا يُكتب أكثرُ ممّا تحمله أرقامُها، فيُقطع
      // الزائدُ وقتَ الكتابة لا بعد الإرسال.
      // ⚠️ الصفرُ الأوّل لا يُكتب مع كود الدولة — ولا السعوديُّ منه: الكودُ
      // مكتوبٌ بجانبه (+966)، و«+966 0541…» رقمٌ لا يُطلب. فيُحذف وقتَ الكتابة
      // في الدول كلِّها، ويُعاد للصيغة المحلية عند الحفظ وحده.
      var lim = DIAL_LEN[sel.value] || 14;
      var raw = inp.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
      inp.value = raw.slice(0, lim);
      inp.maxLength = lim;
      // الشرحُ يقول ما يُكتب بلا صفر — في الدول كلِّها
      inp.placeholder = (DIAL_LEN[sel.value] || 9) + " أرقام بلا صفرٍ أوّل";
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
    if (f.help) wrap.appendChild(el("div", { class: "help", text: lk(f.help) }));
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
        input.appendChild(el("option", { value: o.v, text: lk(o) }));
      });
    } else {
      input = el("input", {
        id: "fld-" + f.k, name: f.k, type: f.type || "text",
        placeholder: (f.ph && typeof f.ph === "object" ? (lk(f.ph)) : f.ph) || "",
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
    if (f.help) wrap.appendChild(el("div", { class: "help", text: lk(f.help) }));
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
  // ⚠️ ما يُرفع يجب أن يكون خفيفًا، لا أن يُصغَّر «قليلًا».
  //
  // كانت الصورُ تُرفع في مليونين ونصفِ بايت، فتسقط في الشبكة المتقطّعة
  // وتتراكم إلى لحظة الإرسال. والحدُّ على الناتج لا على المصدر: يُعاد
  // الترميزُ بجودةٍ أدنى حتى ينزل تحت الحدّ، فالشبكةُ لا تُسأل عن أبعاد
  // الصورة بل عن بايتاتها.
  var SHRINK_OVER = 400 * 1024;      // ما دونها لا يستحقّ إعادة الترميز
  var WANT_MAX = 900 * 1024;         // الهدف: أقلُّ من تسعِ مئة كيلوبايت
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
          // ثلاثُ محاولاتٍ بجودةٍ نازلة حتى تنزل تحت الحدّ
          var qs = [0.72, 0.58, 0.45], qi = 0;
          var done = function (blob) {
            if (blob && blob.size > WANT_MAX && qi < qs.length - 1) {
              qi++;
              return cv.toBlob(done, "image/jpeg", qs[qi]);
            }
            URL.revokeObjectURL(url);
            if (!blob || blob.size >= file.size) return resolve(null);
            resolve(new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"),
              { type: "image/jpeg" }));
          };
          cv.toBlob(done, "image/jpeg", qs[0]);
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
      el("span", { class: "nm", html: "<span>" + (lk(f)) + (f.req ? " <em style='color:var(--bad)'>*</em>" : "")
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
          // ⚠️ محاولتان لا واحدة: رأينا طلباتٍ تُردّ بـ400 بلا جسمٍ أصلًا —
          //   وذاك انقطاعُ اتّصالٍ في منتصف الرفع لا رفضٌ من الخادم. ومن
          //   أُرجع إليه ملفُّه بلا سببٍ يظنّ النظامَ لا يقبله، فيُعيد
          //   الاختيار مرّةً بعد مرّة. والإعادةُ هنا أرخصُ من يأسه.
          var out = null, res = null, why = "";
          for (var att = 0; att < 3; att++) {
            try {
              res = await fetch("/api/join/" + encodeURIComponent(token) + "/file", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base64: b64, name: file.name }),
              });
              out = await res.json().catch(function () { return {}; });
              if (res.ok && out && out.fid) break;
              // خطأٌ مفهومٌ من الخادم لا يُعاد: الإعادةُ تردّ الجوابَ نفسه
              why = (out && out.error) || ("HTTP " + res.status);
              if (out && out.error) break;
            } catch (netErr) {
              why = L === "ar" ? "انقطع الاتصال" : "connection dropped";
            }
            out = null;
            if (att < 2) await new Promise(function (ok) { setTimeout(ok, 900 * (att + 1)); });
          }
          if (!out || !out.fid) throw new Error(why || "تعذّر الرفع");
          var cur = state.files[f.k];
          if (cur && cur.name === file.name) {
            // ⚠️ البايتاتُ تبقى في الذاكرة: لو ضاع الملفُّ من الخادم قبل
            //   الإرسال (مهلةٌ أو تنظيفُ مساحة) أُعيد رفعُه بلا أن يُطلب من
            //   الموظف إرفاقُه ثانية. ولا تُحفظ في التخزين المحلّي — ذاك
            //   يحفظ البياناتِ وحدَها، فلا يمتلئ.
            cur.fid = out.fid; cur.up = "ok";
            render(); paintProgress();
          }
        } catch (e) {
          var c2 = state.files[f.k];
          if (c2 && c2.name === file.name) { c2.up = "fail"; render(); }
          // السببُ يُقال لا يُخفى: «تحقّق من الشبكة» وحدَها لا تدلّ على شيء
          msg("bad", (L === "ar"
            ? "تعذّر رفع «" + file.name + "» — اضغط البطاقة لإعادة اختياره."
            : "Could not upload “" + file.name + "”. Tap the card to pick it again.")
            + ((e && e.message) ? " (" + e.message + ")" : ""));
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
  // ⚠️ التوقيعُ صورةٌ تُرفَق لا رسمٌ بالإصبع: الرسمُ على زجاج الجوّال يخرج
  // مرتعشًا لا يشبه توقيعَ صاحبه، ومستندٌ يحمله يُنازَع فيه. والقلمُ الأزرق
  // يُفرّق الأصلَ من نسخةٍ مصوَّرة، والظلُّ يُسوّد الورقةَ فيضيع الخطّ.
  function signUploadNode() {
    var wrap = el("div", { class: "signwrap" });
    wrap.appendChild(el("div", { class: "signhow" }, [
      el("b", { text: L === "ar" ? "كيف تُرفق توقيعك" : "How to attach your signature" }),
      el("ol", {}, [
        el("li", { text: L === "ar" ? "وقّع بقلمٍ أزرق على ورقةٍ بيضاء." : "Sign with a blue pen on white paper." }),
        el("li", { text: L === "ar" ? "صوّرها في ضوءٍ جيّد وبلا ظلٍّ على الورقة." : "Photograph it in good light with no shadow on the paper." }),
        el("li", { text: L === "ar" ? "اقترب حتى يملأ التوقيعُ الصورة، ثمّ أرفقها أدناه." : "Fill the frame with the signature, then attach it below." }),
      ]),
    ]));
    wrap.appendChild(fileNode({ k: "signature", ar: "صورة التوقيع", en: "Signature photo", req: true }));
    return wrap;
  }

  function reviewNode() {
    var frag = document.createDocumentFragment();
    SEC.forEach(function (s, i) {
      if (s.review) return;
      var rows = el("dl", {});
      if (s.sign) {
        var sg = state.files.signature;
        var sdd = el("dd", { class: sg ? "" : "empty",
          text: sg ? (sg.name + " · " + human(sg.size))
                   : (L === "ar" ? "— لم يُرفَق" : "— not attached") });
        if (sg) {
          sdd.appendChild(el("button", { class: "seeR", type: "button",
            text: L === "ar" ? "عرض" : "View",
            onclick: function () { openStored(sg); } }));
        }
        rows.appendChild(el("div", { class: "r" }, [
          el("dt", { text: L === "ar" ? "صورة التوقيع" : "Signature photo" }), sdd,
        ]));
      }
      // ⚠️ كلُّ حقلٍ يُعرض، حتى ما لا ينطبق عليه.
      //
      // كانت الحقولُ المشروطة تُحذف من المراجعة حذفًا — فمن لم يُسأل عن
      // «عدد الأبناء» لأنه أعزب لا يرى للحقل أثرًا، ولا يدري أسقط سهوًا
      // أم لم يُطلب منه. والمراجعةُ موضعُ التأكّد، والتأكّدُ لا يكون من
      // غائب. فيُعرض مكتوبًا عليه «لا ينطبق».
      (s.fields || []).forEach(function (f) {
        var on = shown(f);
        var v = on ? (state.data[f.k] || "").toString().trim() : "";
        if (f.opts && v) {
          var o = f.opts.filter(function (x) { return x.v === v; })[0];
          if (o) v = lk(o);
        }
        var txt = !on ? (L === "ar" ? "— لا ينطبق" : "— not applicable")
                      : (v || (L === "ar" ? "— لم يُملأ" : "— empty"));
        rows.appendChild(el("div", { class: "r" }, [
          el("dt", { text: lk(f) }),
          el("dd", { class: v ? "" : "empty", text: txt }),
        ]));
      });
      // والمرفقُ يُفتح من المراجعة: اسمُ ملفٍّ وحجمُه لا يقولان أصُوِّرت
      // الصفحةُ الصحيحة أم ظهرت مقلوبةً أو مقطوعة.
      (s.files || []).forEach(function (f) {
        var g = state.files[f.k];
        var dd = el("dd", { class: g ? "" : "empty",
          text: g ? g.name + " · " + human(g.size) : (L === "ar" ? "— لم يُرفَق" : "— none") });
        if (g) {
          dd.appendChild(el("button", { class: "seeR", type: "button",
            text: L === "ar" ? "عرض" : "View",
            onclick: function () { openStored(g); } }));
        }
        rows.appendChild(el("div", { class: "r" }, [el("dt", { text: lk(f) }), dd]));
      });
      frag.appendChild(el("section", { class: "rev" }, [
        el("h3", {}, [
          el("span", { text: (L === "ar" ? s.n : s.nEn) + " — " + (lk(s.title)) }),
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
    m.textContent = hx(text || "");
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
        el("span", { text: lk(s.title) }),
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
      el("h2", { text: lk(s.title) }),
      el("p", { text: lk(s.sub) }),
    ]));
    if (s.review) pane.appendChild(reviewNode());
    else if (s.files) {
      var g = el("div", { class: "files" });
      s.files.forEach(function (f) { g.appendChild(fileNode(f)); });
      pane.appendChild(g);
    } else if (s.sign) pane.appendChild(signUploadNode());
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
  // التوقيعُ موجود: صورةٌ مرفقةٌ الآن، أو رسمٌ قديمٌ لمن بدأ قبل التبديل
  function signed() { return !!(state.files && state.files.signature) || !!state.sign; }

  function validateStep() {
    var s = SEC[state.step], bad = null;
    if (s.fields) {
      fieldsOf(s).forEach(function (f) {
        var w = $('.fld[data-k="' + f.k + '"]');
        if (w && !checkOne(f, w) && !bad) bad = w;
      });
    }
    // ⚠️ التوقيعُ صار صورةً تُرفَق لا رسمًا في مربّع، والحارسُ بقي يسأل عن
    //   `state.sign` — وهو مخزَنُ الرسم القديم لا يُملأ أبدًا. فكان من
    //   يُرفق توقيعَه يُردّ بـ«وقّع في المربّع» ولا مربّعَ في الشاشة.
    if (s.sign && !signed()) {
      msg("bad", L === "ar" ? "أرفق صورة توقيعك قبل المتابعة."
                            : "Attach a photo of your signature before continuing.");
      return false;
    }
    if (s.files) {
      var missing = (s.files || []).filter(function (f) { return f.req && !state.files[f.k]; });
      if (missing.length) {
        msg("bad", (L === "ar" ? "مرفقٌ مطلوب: " : "Required attachment: ")
          + missing.map(function (f) { return lk(f); }).join("، "));
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
      if (bad.length || noFile.length || (s.sign && !signed())) {
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

    // ⚠️ ما لم يُرفع يُرفع الآن، واحدًا واحدًا، قبل بناء الحمولة.
    //
    // كان المرفقُ الذي أخفق رفعُه تُحشَر بايتاتُه في طلب الإرسال نفسِه —
    // فيصير الطلبُ الأخيرُ عشرةَ أضعافه، وينقطع في منتصفه على الشبكة
    // نفسِها التي أسقطت الرفعَ أوّلًا. فيقف الزرُّ على «جارٍ الإرسال»
    // ويعيد الموظفُ الكرّة فينقطع ثانيةً — وهو ما وقع فعلًا: في سجلّ
    // الخادم طلبا إرسالٍ رُدّا بـ400 بلا جسمِ ردّ.
    //
    // ورفعُها مفردةً يُبقي كلَّ طلبٍ صغيرًا، وهو ما ينجح في الشبكة نفسها.
    var pend = Object.keys(state.files).filter(function (k) {
      return !state.files[k].fid && state.files[k].data;
    });
    if (pend.length) {
      // ⚠️ معًا لا واحدًا بعد واحد: ثلاثةٌ متتابعةٌ تُضاعف الانتظارَ ثلاثًا
      //   والموظفُ واقفٌ أمام زرٍّ يعدّ. وهي طلباتٌ مستقلّةٌ لا يحتاج
      //   أحدُها جوابَ سابقه.
      btn.textContent = L === "ar"
        ? "جارٍ رفع المرفقات…" : "Uploading attachments…";
      await Promise.all(pend.map(function (pk) {
        var pg = state.files[pk];
        return fetch("/api/join/" + encodeURIComponent(token) + "/file", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: pg.data, name: pg.name }),
        }).then(function (pr) { return pr.json().catch(function () { return {}; }); })
          .then(function (po) {
            if (po && po.fid) { pg.fid = po.fid; pg.data = ""; pg.up = "ok"; }
          })
          .catch(function () { /* تبقى بايتاتُه فتُرسل معه — خيرٌ من ألّا يصل */ });
      }));
      btn.textContent = t("sending");
      save();
    }

    // التوقيعُ مرفقٌ كبقيّة المرفقات: يمضي في الحلقة أدناه بمعرّفه
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

      // ⚠️ مرفقٌ ضاع من الخادم: يُعاد رفعُه ثمّ يُرسل ثانيةً بلا أن يُزعج
      //   الموظف. وكان يُردّ بـ«انتهت مهلةُ الحفظ — أعد إرفاقه»، فيقف أمام
      //   نموذجٍ ملأه في عشر دقائق يُطلب منه أن يُعيد ما أرفقه.
      if (res.status === 409) {
        var need = (await res.json().catch(function () { return {}; })).needFiles || [];
        var fixed = 0;
        await Promise.all(need.map(function (nk) {
          var g = state.files[nk];
          if (!g || !g.data) return Promise.resolve();
          return fetch("/api/join/" + encodeURIComponent(token) + "/file", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: g.data, name: g.name }),
          }).then(function (r2) { return r2.json().catch(function () { return {}; }); })
            .then(function (o2) {
              if (o2 && o2.fid) { g.fid = o2.fid; body[nk + "_fid"] = o2.fid; fixed++; }
            })
            .catch(function () {});
        }));
        if (fixed) {
          res = await fetch(MINE ? "/api/me/intake" : "/api/join/" + encodeURIComponent(token), {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      }
      var out = await res.json().catch(function () { return {}; });
      if (res.status === 413) throw new Error(L === "ar"
        ? "المرفقات أكبر ممّا يقبله الخادم — احذف أو صغّر بعضها ثمّ أعد الإرسال."
        : "Attachments are too large for the server — remove or shrink some.");
      if (!res.ok) throw new Error(out.error || (L === "ar" ? "تعذّر الإرسال — حاول مرّةً أخرى." : "Could not send."));
      dirty = false;
      // ⚠️ البياناتُ تبقى في الجهاز بعد الإرسال: الملفُّ قد يُعاد للتصحيح،
      // فإن مُحيت أعاد صاحبُه كتابةَ كلِّ شيءٍ ليصحّح سطرًا واحدًا. تُحفظ
      // ومعها رقمُ الملف وتاريخُه — والمرفقاتُ وحدها تسقط لأنّ معرّفاتها
      // تنتهي في الخادم بعد ساعة.
      try {
        Object.keys(state.files).forEach(function (k) { delete state.files[k]; });
        localStorage.setItem(LS, JSON.stringify({
          data: state.data, step: 0, at: Date.now(),
          sent: { ref: out.ref || "", at: Date.now() },
        }));
      } catch (e) {}
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

  // ─────────────────────── استعادةُ ملفٍّ أُعيد ───────────────────────
  // ⚠️ من صحّح من جهازٍ آخر كان يبدأ من الصفر: أربعون حقلًا تُكتب من جديد
  // ليصحّح سطرًا. فصار له بابان — رابطُه الذي وصله مع الإعادة، أو رقمُ
  // ملفّه مع رقم هويته. ولا يُفتح إلا لملفٍّ أعادته الموارد البشرية.
  function fillFromServer(j) {
    if (!j || !j.ok || !j.data) return false;
    Object.keys(j.data).forEach(function (k) { state.data[k] = j.data[k]; });
    if (state.data.full_name_ar && !state.data.name_first) {
      var p = String(state.data.full_name_ar).trim().split(/\s+/);
      state.data.name_first = p[0] || ""; state.data.name_father = p[1] || "";
      state.data.name_grand = p[2] || ""; state.data.name_family = p.slice(3).join(" ") || "";
    }
    SENT = { ref: j.ref || "", at: Date.now() };
    save();
    startWizard();
    msg("bad", (L === "ar" ? "ملفُّك " + (j.ref || "") + " أُعيد للتصحيح: " : "Returned: ")
      + (j.reason || "") + (L === "ar" ? " — صحّح ما ذُكر وأعد الإرسال (وأعد إرفاق المستندات)." : ""));
    return true;
  }

  // بطاقةٌ رابعةٌ مع البطاقات البيضاء: من أُعيد ملفُّه يجدها حيث ينظر،
  // ويفتحها فتسأله رقمًا واحدًا — أيَّ رقمٍ يحفظه.
  function recoverCard() {
    // سطرٌ واحدٌ يكفي: البطاقةُ نداءٌ لا شرح، وما تحتَه يُطيلها بلا فائدة
    return el("button", { class: "fact rec", id: "recCard", type: "button", onclick: recoverModal }, [
      el("b", { text: "لتصحيح بياناتك اضغط هنا" }),
    ]);
  }

  function recoverModal() {
    var inp = el("input", { type: "text", dir: "auto", id: "recVal",
      placeholder: "رقم الهوية أو الجوال أو رقم الطلب" });
    var out = el("div", { class: "help",
      text: "اكتب واحدًا منها: رقم هويتك/إقامتك، أو جوالك، أو رقم طلبك (HR-JOIN-…)." });
    var go = el("button", { class: "btn gold", type: "button", text: "استعادة بياناتي" });
    var m = el("div", { class: "modal" }, [
      el("div", { class: "box" }, [
        el("h3", { text: "تصحيح بياناتك" }),
        el("p", { text: "إن أعادت الموارد البشرية ملفَّك للتصحيح، استعِد ما كتبتَه بدل كتابته من جديد." }),
        inp, out,
        el("div", { class: "row" }, [
          el("button", { class: "btn o", type: "button", text: "إغلاق",
            onclick: function () { m.remove(); } }),
          go,
        ]),
      ]),
    ]);
    go.addEventListener("click", async function () {
      var v = String(inp.value || "").trim();
      if (v.length < 5) { out.textContent = hx("اكتب رقمًا صحيحًا."); return; }
      go.disabled = true; out.textContent = hx("جارٍ البحث…");
      try {
        var res = await fetch("/api/join/resume", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: v }),
        });
        var j = await res.json().catch(function () { return {}; });
        if (j && j.ok) { m.remove(); fillFromServer(j); return; }
        out.textContent = (j && j.error) || "لم نجد ملفًّا بهذا الرقم.";
      } catch (e) { out.textContent = hx("تعذّر الاتصال — حاول مرّةً أخرى."); }
      go.disabled = false;
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go.click(); });
    document.body.appendChild(m);
    setTimeout(function () { inp.focus(); }, 40);
  }
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
  $("#lang").addEventListener("click", function (e) {
    e.stopPropagation();
    langMenu(!$("#langMenu").classList.contains("on"));
  });
  // ⚠️ تُغلق بالضغط خارجها وبمفتاح Escape: قائمةٌ تبقى مفتوحةً تحجب ما
  //   تحتها، ومن فتحها بالخطأ لا يعرف كيف يُغلقها.
  document.addEventListener("click", function () { langMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") langMenu(false);
  });
  $("#langMenu").addEventListener("click", function (e) { e.stopPropagation(); });

  // خروجٌ قبل الإرسال: التنبيه يقع مرّةً واحدة — والمتصفّح يملك نصَّه
  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault(); e.returnValue = "";
  });

  paintStatic();

  // القوائم تُجلب مبكّرًا فتكون جاهزةً قبل أن يبلغ القسم الوظيفي
  // ⚠️ رقمُ النسخة يكسر كاشَ المتصفّح: قائمةٌ قديمةٌ محفوظةٌ عنده تُعرض
  // إنجليزيةً بعد أن صارت عربية، أو بمسمّياتٍ قبل ترتيبها.
  fetch("/api/join/options?v=" + encodeURIComponent(window.SQ_JOIN_V || "2"))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      OPTS = { departments: j.departments || [], jobs: j.jobs || [],
               jobsByDept: j.jobsByDept || {}, nationalities: j.nationalities || [] };
      if (!$("#wiz").hidden && SEC[state.step] && SEC[state.step].id === "job") render();
    })
    .catch(function () { /* تبقى الحقول كتابةً حرّة */ });

  if (MINE) {
    document.querySelector("[data-t='h1']").textContent = hx("تحديث ملفّي الوظيفي");
    fetch("/api/me/intake", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) { msg("bad", "افتح الصفحة من داخل التطبيق بعد تسجيل الدخول."); return; }
        if (j.pending) {
          $("#land").hidden = true; $("#succ").hidden = false;
          document.body.classList.remove("landing");
          $("#succT").textContent = hx("لك ملفٌّ قيد المراجعة");
          $("#succP").textContent = hx("انتظر البتّ فيه قبل إرسال تصحيحٍ جديد.");
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
  } else {
    // رمزُ رابطٍ في العنوان: يُسأل عنه الخادم — فإن كان ملفًّا أُعيد
    // للتصحيح مُلئت الحقول منه، وإلا فمسودّةُ الجهاز إن كانت.
    var maybeToken = token && token !== "open" && token !== "join" && token.length >= 12;
    (async function () {
      if (maybeToken) {
        try {
          var res = await fetch("/api/join/resume/" + encodeURIComponent(token));
          var j = await res.json().catch(function () { return {}; });
          if (fillFromServer(j)) return;
        } catch (e) { /* الشبكةُ تعثّرت — تبقى المسودّة المحلية */ }
      }
      if (restore()) {
    // ⚠️ المسودّةُ تُستأنف ولا تُفرض: من ترك التعبئةَ أمسِ يُكمل من حيث
    // وقف، ومن أراد البدءَ من جديد يجد زرًّا يقوله — وكان الاستئنافُ
    // يقع صامتًا فيظنّ من يفتح الرابط أنّ بياناته ضاعت أو أنّها بيانات
    // غيره.
    startWizard();
    var pc = percent();
    // من أرسل ملفَّه ثمّ عاد: يُذكَّر برقمه، ويُقال له إنّ ما يلزمه تصحيحُ
    // ما ذُكر وإعادةُ الإرسال — لا إعادةُ كتابة كلّ شيء.
    var note = SENT && SENT.ref
      ? "أرسلتَ ملفَّك برقم " + SENT.ref + " — إن طُلب منك تصحيحٌ فعدّل ما ذُكر وأعد الإرسال. "
        + "وأعِد إرفاق المستندات المطلوبة (لا تُحفظ المرفقاتُ في الجهاز)."
      : "استأنفنا من حيث توقّفت — اكتمال ملفّك " + pc + "٪، وبياناتك محفوظةٌ على هذا الجهاز.";
    var bar = el("div", { class: "resume" }, [
      el("span", { text: note }),
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
      } else {
        // لا مسودّةَ ولا رمز: تُضاف بطاقةُ التصحيح إلى بطاقات الافتتاحية
        // — حيث ينظر من أُعيد ملفُّه، لا في ركنٍ أسفل الصفحة.
        var facts = document.querySelector(".facts");
        // أوّلُ البطاقات لا آخرُها: من جاء يصحّح يجدها أوّل ما ينظر
        if (facts) facts.appendChild(recoverCard());
      }
    })();
  }
})();
