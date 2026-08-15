/* ===========================================================================
 * i18n.js — طبقة لغة ومظهر تعمل فوق الواجهة بلا مساس بحزمتها.
 *
 * لماذا هكذا وليس داخل التطبيق؟ الواجهة تُشحَن ملفًّا واحدًا مبنيًّا ومصغَّرًا
 * بلا كود مصدر، ونصوصها العربية مكتوبة حرفيًّا داخله. فالترجمة من الداخل
 * تعني إعادة بناء التطبيق. هذه الطبقة تترجم ما يُرسَم فعلًا في الصفحة.
 *
 * حدّها الذي لا تتجاوزه: لا تترجم إلا نصًّا يطابق مدخلًا في القاموس مطابقة
 * تامة. أسماء الموظفين وعناوين الطلبات وأي شيء قادم من أودو يمرّ كما هو —
 * ترجمة تقريبية لبيانات حقيقية أسوأ من عدم الترجمة.
 * =========================================================================== */
(function () {
  "use strict";

  var LANGS = {
    ar: { name: "العربية", dir: "rtl" },
    en: { name: "English", dir: "ltr" },
    ur: { name: "اردو", dir: "rtl" },
    fr: { name: "Français", dir: "ltr" },
  };

  /* القاموس: المفتاح هو النص العربي كما هو في الواجهة حرفًا بحرف. */
  var DICT = {
    /* التنقّل */
    "الرئيسية":            { en: "Home", ur: "ہوم", fr: "Accueil" },
    "الخدمات":             { en: "Services", ur: "خدمات", fr: "Services" },
    "طلباتي":              { en: "My Requests", ur: "میری درخواستیں", fr: "Mes demandes" },
    "الإشعارات":           { en: "Notifications", ur: "اطلاعات", fr: "Notifications" },
    "حسابي":               { en: "My Account", ur: "میرا اکاؤنٹ", fr: "Mon compte" },

    /* الشاشات */
    "ملفي الوظيفي":        { en: "My Profile", ur: "میرا پروفائل", fr: "Mon profil" },
    "لوحة مدير القسم":     { en: "Manager Dashboard", ur: "منیجر ڈیش بورڈ", fr: "Tableau de bord du manager" },
    "لوحة الموارد البشرية": { en: "HR Dashboard", ur: "ایچ آر ڈیش بورڈ", fr: "Tableau de bord RH" },
    "لوحة الإدارة":        { en: "Admin Panel", ur: "ایڈمن پینل", fr: "Panneau d'administration" },
    "خدمات الموظفين":      { en: "Employee Services", ur: "ملازمین کی خدمات", fr: "Services aux employés" },
    "إدارة المستخدمين":    { en: "User Management", ur: "صارف کا انتظام", fr: "Gestion des utilisateurs" },
    "الأدوار والصلاحيات":  { en: "Roles & Permissions", ur: "کردار اور اجازتیں", fr: "Rôles et autorisations" },
    "إدارة اختصاراتي":     { en: "Manage Shortcuts", ur: "شارٹ کٹ کا انتظام", fr: "Gérer mes raccourcis" },
    "تكامل Odoo":          { en: "Odoo Integration", ur: "Odoo انضمام", fr: "Intégration Odoo" },
    "سجل التدقيق":         { en: "Audit Log", ur: "آڈٹ لاگ", fr: "Journal d'audit" },
    "الهوية والألوان":     { en: "Branding & Colors", ur: "برانڈنگ اور رنگ", fr: "Identité et couleurs" },
    "تعميم":               { en: "Announcement", ur: "اعلان", fr: "Annonce" },
    "إعدادات التكامل مع Odoo": { en: "Odoo Integration Settings", ur: "Odoo انضمام کی ترتیبات", fr: "Paramètres d'intégration Odoo" },

    /* أزرار */
    "إرسال":               { en: "Send", ur: "بھیجیں", fr: "Envoyer" },
    "إلغاء":               { en: "Cancel", ur: "منسوخ", fr: "Annuler" },
    "تحديث":               { en: "Refresh", ur: "تازہ کریں", fr: "Actualiser" },
    "إدارة":               { en: "Manage", ur: "انتظام", fr: "Gérer" },
    "تثبيت":               { en: "Install", ur: "انسٹال", fr: "Installer" },
    "اعتماد":              { en: "Approve", ur: "منظور", fr: "Approuver" },
    "رفض":                 { en: "Reject", ur: "مسترد", fr: "Rejeter" },
    "تصعيد":               { en: "Escalate", ur: "ایسکلیٹ", fr: "Escalader" },
    "طلب معلومات":         { en: "Request Info", ur: "معلومات طلب کریں", fr: "Demander des infos" },
    "تسجيل الخروج":        { en: "Sign Out", ur: "سائن آؤٹ", fr: "Déconnexion" },
    "اختيار الاختصارات":   { en: "Choose Shortcuts", ur: "شارٹ کٹ منتخب کریں", fr: "Choisir des raccourcis" },
    "اختبار الاتصال":      { en: "Test Connection", ur: "کنکشن جانچیں", fr: "Tester la connexion" },
    "عرض الكل":            { en: "View All", ur: "سب دیکھیں", fr: "Tout voir" },
    "إلغاء الطلب":         { en: "Cancel Request", ur: "درخواست منسوخ کریں", fr: "Annuler la demande" },
    "حسنًا":                { en: "OK", ur: "ٹھیک ہے", fr: "OK" },
    "التالي":              { en: "Next", ur: "اگلا", fr: "Suivant" },
    "اقرأ الخبر ›":        { en: "Read more ›", ur: "مزید پڑھیں ›", fr: "Lire la suite ›" },

    /* عناوين أقسام */
    "اختصاراتي":           { en: "My Shortcuts", ur: "میرے شارٹ کٹ", fr: "Mes raccourcis" },
    "آخر الطلبات":         { en: "Recent Requests", ur: "حالیہ درخواستیں", fr: "Demandes récentes" },
    "آخر التعاميم":        { en: "Latest Announcements", ur: "تازہ اعلانات", fr: "Dernières annonces" },
    "طلبات تنتظر موافقتك": { en: "Awaiting Your Approval", ur: "آپ کی منظوری کے منتظر", fr: "En attente de votre approbation" },
    "أحدث الطلبات الواردة": { en: "Latest Incoming Requests", ur: "تازہ موصولہ درخواستیں", fr: "Dernières demandes reçues" },
    "البيانات الأساسية":   { en: "Basic Information", ur: "بنیادی معلومات", fr: "Informations de base" },
    "البيانات الشخصية (مخفية جزئياً)": { en: "Personal Data (partially masked)", ur: "ذاتی ڈیٹا (جزوی طور پر پوشیدہ)", fr: "Données personnelles (partiellement masquées)" },
    "الإجازات":            { en: "Time Off", ur: "چھٹیاں", fr: "Congés" },
    "العهد الحالية":       { en: "Current Custody", ur: "موجودہ تحویل", fr: "Biens en charge" },
    "رحلة الطلب":          { en: "Request Journey", ur: "درخواست کا سفر", fr: "Parcours de la demande" },

    /* حقول */
    "الرقم الوظيفي":       { en: "Employee No.", ur: "ملازم نمبر", fr: "Matricule" },
    "المسمى الوظيفي":      { en: "Job Title", ur: "عہدہ", fr: "Intitulé du poste" },
    "الإدارة":             { en: "Department", ur: "شعبہ", fr: "Département" },
    "الفرع":               { en: "Branch", ur: "برانچ", fr: "Succursale" },
    "المدير المباشر":      { en: "Direct Manager", ur: "براہ راست منیجر", fr: "Responsable direct" },
    "البريد الوظيفي":      { en: "Work Email", ur: "دفتری ای میل", fr: "E-mail professionnel" },
    "رقم الجوال":          { en: "Mobile Number", ur: "موبائل نمبر", fr: "Numéro de mobile" },
    "تاريخ التعيين":       { en: "Hire Date", ur: "تقرری کی تاریخ", fr: "Date d'embauche" },
    "رقم الهوية":          { en: "ID Number", ur: "شناختی نمبر", fr: "Numéro d'identité" },
    "رقم الإقامة":         { en: "Residency No.", ur: "اقامہ نمبر", fr: "N° de résidence" },
    "جواز السفر":          { en: "Passport", ur: "پاسپورٹ", fr: "Passeport" },
    "الحالة الاجتماعية":   { en: "Marital Status", ur: "ازدواجی حیثیت", fr: "État civil" },
    "تاريخ الميلاد":       { en: "Date of Birth", ur: "تاریخ پیدائش", fr: "Date de naissance" },
    "الحساب البنكي (IBAN)": { en: "Bank Account (IBAN)", ur: "بینک اکاؤنٹ (IBAN)", fr: "Compte bancaire (IBAN)" },
    "الرصيد المتاح":       { en: "Available Balance", ur: "دستیاب بیلنس", fr: "Solde disponible" },
    "المستخدم":            { en: "Used", ur: "استعمال شدہ", fr: "Utilisé" },
    "إجازات قادمة":        { en: "Upcoming Leaves", ur: "آنے والی چھٹیاں", fr: "Congés à venir" },
    "الأولوية":            { en: "Priority", ur: "ترجیح", fr: "Priorité" },
    "المرفقات":            { en: "Attachments", ur: "منسلکات", fr: "Pièces jointes" },
    "وصف الطلب":           { en: "Request Description", ur: "درخواست کی تفصیل", fr: "Description de la demande" },
    "حالة الاتصال":        { en: "Connection Status", ur: "کنکشن کی حالت", fr: "État de la connexion" },
    "إصدار Odoo":          { en: "Odoo Version", ur: "Odoo ورژن", fr: "Version d'Odoo" },
    "زمن الاستجابة":       { en: "Response Time", ur: "جوابی وقت", fr: "Temps de réponse" },

    /* حالات */
    "معتمدة":              { en: "Approved", ur: "منظور شدہ", fr: "Approuvée" },
    "مرفوضة":              { en: "Rejected", ur: "مسترد", fr: "Rejetée" },
    "قيد المراجعة":        { en: "Under Review", ur: "زیر جائزہ", fr: "En cours d'examen" },
    "مسودة":               { en: "Draft", ur: "مسودہ", fr: "Brouillon" },
    "مُستلَمة":              { en: "Received", ur: "موصول", fr: "Reçu" },
    "مُرجَعة":               { en: "Returned", ur: "واپس", fr: "Retourné" },
    "مثبّت":                { en: "Pinned", ur: "پن شدہ", fr: "Épinglé" },
    "مهم":                 { en: "Important", ur: "اہم", fr: "Important" },
    "عادية":               { en: "Normal", ur: "عام", fr: "Normale" },
    "متوسطة":              { en: "Medium", ur: "درمیانی", fr: "Moyenne" },
    "عاجلة":               { en: "Urgent", ur: "فوری", fr: "Urgente" },
    "فعال":                { en: "Active", ur: "فعال", fr: "Actif" },
    "موقوف":               { en: "Suspended", ur: "معطل", fr: "Suspendu" },

    /* الأدوار */
    "موظف":                { en: "Employee", ur: "ملازم", fr: "Employé" },
    "مدير قسم":            { en: "Department Manager", ur: "شعبہ منیجر", fr: "Chef de département" },
    "موارد بشرية":         { en: "Human Resources", ur: "انسانی وسائل", fr: "Ressources humaines" },
    "مسؤول مالي":          { en: "Finance Officer", ur: "مالیاتی افسر", fr: "Responsable financier" },
    "تقنية المعلومات":     { en: "IT", ur: "آئی ٹی", fr: "Informatique" },
    "مدير النظام":         { en: "System Administrator", ur: "سسٹم ایڈمنسٹریٹر", fr: "Administrateur système" },

    /* المظهر واللغة */
    "المظهر الداكن":       { en: "Dark Mode", ur: "ڈارک موڈ", fr: "Mode sombre" },
    "اللغة":               { en: "Language", ur: "زبان", fr: "Langue" },
  };

  var KEY_LANG = "sq.lang", KEY_DARK = "sq.dark";
  var lang = "ar";
  try { lang = localStorage.getItem(KEY_LANG) || "ar"; } catch (e) {}
  if (!LANGS[lang]) lang = "ar";

  /* ترجمة نص واحد؛ يعود null إن لم يكن في القاموس فيُترك كما هو */
  function tr(text) {
    if (lang === "ar") return null;
    var k = text.trim();
    if (!k) return null;
    var row = DICT[k];
    if (!row || !row[lang]) return null;
    // نحافظ على المسافات المحيطة كما كانت حتى لا ينهار تباعد العناصر
    return text.replace(k, row[lang]);
  }

  var baseOf = new WeakMap();     // العقدة → نصّها العربي المصدر
  var mineOf = new WeakMap();     // العقدة → آخر ما كتبناه نحن فيها
  var observer = null;

  /* الفرق بين «ما كتبناه» و«ما فيها الآن» هو ما يميّز تحديث React عن كتابتنا.
     بدونه نُعيد كتابة أول نص رأيناه فنجمّد كل رقم وكل حالة تتغيّر — «0 موظفاً»
     تبقى صفرًا بعد وصول الفريق من أودو. */
  function paint(root) {
    if (lang === "ar") return;    // العربية هي الأصل: لا نلمس الصفحة إطلاقًا
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, batch = [];
    while ((n = w.nextNode())) batch.push(n);
    if (observer) observer.disconnect();   // كتابتنا يجب ألّا توقظ المراقب
    try {
      for (var i = 0; i < batch.length; i++) {
        var node = batch[i];
        var p = node.parentNode;
        if (!p) continue;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || p.id === "sq-lang") continue;
        var cur = node.nodeValue;
        if (cur !== mineOf.get(node)) baseOf.set(node, cur);  // React كتب نصًّا جديدًا
        var base = baseOf.get(node);
        var out = tr(base) || base;
        if (cur !== out) { node.nodeValue = out; mineOf.set(node, out); }
      }
    } finally {
      if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  /* العودة للعربية: نُرجع كل عقدة كتبناها إلى نصّها المصدر */
  function restore(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    if (observer) observer.disconnect();
    try {
      while ((n = w.nextNode())) {
        if (n.nodeValue === mineOf.get(n)) {
          var base = baseOf.get(n);
          if (base !== undefined && base !== n.nodeValue) n.nodeValue = base;
          mineOf.delete(n);
        }
      }
    } finally {
      if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function applyDir() {
    var d = LANGS[lang].dir;
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", d);
  }

  var pending = null;
  function schedule() {
    if (pending) return;
    // React يعيد الرسم كثيرًا؛ التجميع في إطار واحد يمنع عملًا مضاعفًا
    pending = requestAnimationFrame(function () {
      pending = null;
      paint(document.body);
    });
  }

  function setLang(next) {
    if (!LANGS[next]) return;
    var wasForeign = lang !== "ar";
    lang = next;
    try { localStorage.setItem(KEY_LANG, next); } catch (e) {}
    applyDir();
    if (next === "ar") { if (wasForeign) restore(document.body); }
    else paint(document.body);
    build();
  }

  /* --- المظهر الداكن: قلبٌ لوني على مستوى الصفحة ---
     الواجهة تحمل ألوانها داخل أنماط سطرية (inline) لا في متغيّرات CSS،
     فلا سبيل لتبديل لوحة الألوان من الخارج إلا بمرشّح على الجذر. نستثني
     الصور من القلب حتى لا تظهر سالبة. */
  var DARK_CSS =
    "html.sq-dark{filter:invert(1) hue-rotate(180deg);background:#111;}" +
    "html.sq-dark img,html.sq-dark video,html.sq-dark canvas," +
    "html.sq-dark [style*='background-image']{filter:invert(1) hue-rotate(180deg);}" +
    "html.sq-dark #sq-lang{filter:invert(1) hue-rotate(180deg);}";

  function setDark(on) {
    document.documentElement.classList.toggle("sq-dark", !!on);
    try { localStorage.setItem(KEY_DARK, on ? "1" : "0"); } catch (e) {}
  }
  function isDark() {
    try { return localStorage.getItem(KEY_DARK) === "1"; } catch (e) { return false; }
  }

  /* --- شريط التحكّم: لغة + مظهر --- */
  function build() {
    var old = document.getElementById("sq-lang");
    if (old) old.remove();
    var box = document.createElement("div");
    box.id = "sq-lang";
    box.style.cssText = "position:fixed;top:8px;" + (LANGS[lang].dir === "rtl" ? "left" : "right") +
      ":8px;z-index:2147482000;display:flex;gap:6px;align-items:center;" +
      "background:rgba(27,27,27,.86);border-radius:99px;padding:4px 6px;" +
      "font-family:Tajawal,'Segoe UI',Tahoma,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.28)";

    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Language");
    sel.style.cssText = "background:transparent;color:#fff;border:none;font-size:12px;" +
      "font-weight:700;cursor:pointer;outline:none;font-family:inherit";
    Object.keys(LANGS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = LANGS[k].name;
      o.style.color = "#111";
      if (k === lang) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () { setLang(sel.value); };

    var moon = document.createElement("button");
    moon.type = "button";
    moon.textContent = isDark() ? "☀" : "☾";
    moon.title = DICT["المظهر الداكن"] && lang !== "ar" ? DICT["المظهر الداكن"][lang] : "المظهر الداكن";
    moon.style.cssText = "background:transparent;border:none;color:#fff;font-size:14px;" +
      "cursor:pointer;padding:0 4px;line-height:1";
    moon.onclick = function () {
      var next = !isDark();
      setDark(next);
      moon.textContent = next ? "☀" : "☾";
    };

    box.appendChild(sel);
    box.appendChild(moon);
    document.body.appendChild(box);
  }

  function boot() {
    var st = document.createElement("style");
    st.textContent = DARK_CSS;
    document.head.appendChild(st);
    setDark(isDark());
    applyDir();
    build();
    paint(document.body);
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // نافذة للتوسعة: إضافة نصوص جديدة بلا إعادة بناء
  window.SQ_I18N = {
    add: function (map) { Object.assign(DICT, map); paint(document.body); },
    setLang: setLang,
    get lang() { return lang; },
  };
})();
