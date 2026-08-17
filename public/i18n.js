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
    /* شريط التنقّل يكتبها «خدماتي» لا «الخدمات» — وكان المدخل الخاطئ وحده
       سببَ بقاء التبويب عربيًّا في كل اللغات. */
    "خدماتي":              { en: "My Services", ur: "میری خدمات", fr: "Mes services" },
    "تفضيل":               { en: "Favorite", ur: "پسندیدہ", fr: "Favori" },
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

    /* ===================================================================
     * الدفعة الثانية — كان القاموس يغطّي 89 نصًّا من أصل 904 في الواجهة،
     * فتبقى معظم الشاشات عربية مهما بُدّلت اللغة. هذه تغطّي ما يُرى فعلًا:
     * أسماء الخدمات، والمراحل، والحالات، وعناوين الحقول، والرسائل.
     * =================================================================== */

    /* تصنيفات الخدمات */
    "الإجازات والغياب":    { en: "Leaves & Absence", ur: "چھٹیاں اور غیر حاضری", fr: "Congés et absences" },
    "الدوام والحضور":      { en: "Attendance & Hours", ur: "حاضری اور اوقات", fr: "Présence et horaires" },
    "الطلبات المالية":     { en: "Financial Requests", ur: "مالی درخواستیں", fr: "Demandes financières" },
    "العهد والأصول":       { en: "Assets & Custody", ur: "اثاثے اور تحویل", fr: "Biens et matériel" },
    "النقل والتغييرات":    { en: "Transfers & Changes", ur: "تبادلے اور تبدیلیاں", fr: "Mutations et changements" },
    "البيانات الشخصية":    { en: "Personal Data", ur: "ذاتی معلومات", fr: "Données personnelles" },
    "الخطابات والشهادات":  { en: "Letters & Certificates", ur: "خطوط اور اسناد", fr: "Lettres et attestations" },
    "التدريب والتطوير":    { en: "Training & Development", ur: "تربیت اور ترقی", fr: "Formation et développement" },
    "التأمين والمزايا":    { en: "Insurance & Benefits", ur: "انشورنس اور مراعات", fr: "Assurance et avantages" },
    "الشكاوى والاقتراحات": { en: "Complaints & Suggestions", ur: "شکایات اور تجاویز", fr: "Réclamations et suggestions" },
    "إنهاء الخدمة":        { en: "Offboarding", ur: "ملازمت کا اختتام", fr: "Fin de service" },
    "طلب عام":             { en: "General Request", ur: "عام درخواست", fr: "Demande générale" },
    "الحضور والورديات":    { en: "Attendance & Shifts", ur: "حاضری اور شفٹیں", fr: "Présence et équipes" },
    "العهد":               { en: "Custody", ur: "تحویل", fr: "Matériel confié" },

    /* خدمات الإجازات */
    "إجازة سنوية":         { en: "Annual Leave", ur: "سالانہ چھٹی", fr: "Congé annuel" },
    "إجازة مرضية":         { en: "Sick Leave", ur: "بیماری کی چھٹی", fr: "Congé maladie" },
    "إجازة اضطرارية":      { en: "Emergency Leave", ur: "ہنگامی چھٹی", fr: "Congé d'urgence" },
    "إجازة بدون راتب":     { en: "Unpaid Leave", ur: "بلا تنخواہ چھٹی", fr: "Congé sans solde" },
    "إجازة زواج":          { en: "Marriage Leave", ur: "شادی کی چھٹی", fr: "Congé de mariage" },
    "إجازة مولود":         { en: "Newborn Leave", ur: "بچے کی پیدائش کی چھٹی", fr: "Congé de naissance" },
    "إجازة وفاة":          { en: "Bereavement Leave", ur: "سوگ کی چھٹی", fr: "Congé de deuil" },
    "إجازة حج":            { en: "Hajj Leave", ur: "حج کی چھٹی", fr: "Congé de Hajj" },
    "إجازة دراسية":        { en: "Study Leave", ur: "تعلیمی چھٹی", fr: "Congé d'études" },
    "تمديد إجازة":         { en: "Extend Leave", ur: "چھٹی میں توسیع", fr: "Prolonger le congé" },
    "تعديل إجازة معتمدة":  { en: "Modify Approved Leave", ur: "منظور شدہ چھٹی میں ترمیم", fr: "Modifier un congé approuvé" },
    "تمديد مدة الإجازة":   { en: "Extend Leave Duration", ur: "دورانیہ بڑھائیں", fr: "Prolonger la durée" },
    "تقصير مدة الإجازة":   { en: "Shorten Leave Duration", ur: "دورانیہ کم کریں", fr: "Raccourcir la durée" },
    "قطع الإجازة والعودة للعمل": { en: "End Leave & Return to Work", ur: "چھٹی ختم کر کے واپسی", fr: "Écourter le congé et reprendre" },
    "إلغاء الإجازة بالكامل": { en: "Cancel Leave Entirely", ur: "چھٹی مکمل منسوخ", fr: "Annuler entièrement le congé" },
    "تغيير تاريخ البداية": { en: "Change Start Date", ur: "آغاز کی تاریخ بدلیں", fr: "Changer la date de début" },
    "تغيير تاريخ النهاية": { en: "Change End Date", ur: "اختتام کی تاریخ بدلیں", fr: "Changer la date de fin" },
    "تغيير البداية والنهاية": { en: "Change Both Dates", ur: "دونوں تاریخیں بدلیں", fr: "Changer les deux dates" },
    "سجل إجازاتي":         { en: "My Leave History", ur: "میری چھٹیوں کا ریکارڈ", fr: "Historique de mes congés" },
    "طلب إجازة جديدة":     { en: "New Leave Request", ur: "نئی چھٹی کی درخواست", fr: "Nouvelle demande de congé" },
    "رصيد الإجازات":       { en: "Leave Balance", ur: "چھٹیوں کا بیلنس", fr: "Solde de congés" },
    "رصيد الإجازة":        { en: "Leave Balance", ur: "چھٹیوں کا بیلنس", fr: "Solde de congés" },
    "رفع تقرير طبي":       { en: "Upload Medical Report", ur: "طبی رپورٹ اپ لوڈ", fr: "Envoyer un rapport médical" },
    "نوع الإجازة":         { en: "Leave Type", ur: "چھٹی کی قسم", fr: "Type de congé" },

    /* خدمات الدوام */
    "تصحيح حضور":          { en: "Check-in Correction", ur: "حاضری کی درستی", fr: "Correction d'arrivée" },
    "تصحيح انصراف":        { en: "Check-out Correction", ur: "روانگی کی درستی", fr: "Correction de départ" },
    "استئذان بالساعات":    { en: "Hourly Permission", ur: "گھنٹوں کی اجازت", fr: "Autorisation horaire" },
    "تصريح خروج":          { en: "Exit Permit", ur: "باہر جانے کا اجازت نامہ", fr: "Autorisation de sortie" },
    "عمل إضافي":           { en: "Overtime", ur: "اوور ٹائم", fr: "Heures supplémentaires" },
    "عمل عن بعد":          { en: "Remote Work", ur: "دور کام", fr: "Télétravail" },
    "تغيير وردية أو ساعات دوام": { en: "Change Shift or Hours", ur: "شفٹ یا اوقات کی تبدیلی", fr: "Changer d'équipe ou d'horaires" },
    "تغيير جدول العمل":    { en: "Change Work Schedule", ur: "شیڈول کی تبدیلی", fr: "Changer le planning" },
    "الحضور الذكي":        { en: "Smart Attendance", ur: "سمارٹ حاضری", fr: "Pointage intelligent" },
    "تسجيل حضور":          { en: "Check In", ur: "حاضری درج کریں", fr: "Pointer l'arrivée" },
    "تسجيل انصراف":        { en: "Check Out", ur: "روانگی درج کریں", fr: "Pointer le départ" },
    "حضور":                { en: "Check-in", ur: "حاضری", fr: "Arrivée" },
    "انصراف":              { en: "Check-out", ur: "روانگی", fr: "Départ" },
    "الحضور":              { en: "Attendance", ur: "حاضری", fr: "Présence" },
    "سجل الحضور":          { en: "Attendance Log", ur: "حاضری کا ریکارڈ", fr: "Journal de présence" },
    "الوردية الحالية":     { en: "Current Shift", ur: "موجودہ شفٹ", fr: "Équipe actuelle" },
    "تحديد موقعي":         { en: "Locate Me", ur: "میرا مقام", fr: "Me localiser" },
    "جارٍ تحديد موقعك…":   { en: "Locating you…", ur: "مقام معلوم ہو رہا ہے…", fr: "Localisation en cours…" },
    "جارٍ التحديد…":       { en: "Locating…", ur: "تعین ہو رہا ہے…", fr: "Localisation…" },
    "داخل النطاق":         { en: "Within Range", ur: "حدود کے اندر", fr: "Dans la zone" },
    "خارج النطاق":         { en: "Outside Range", ur: "حدود سے باہر", fr: "Hors zone" },
    "تأخّر":               { en: "Late", ur: "تاخیر", fr: "En retard" },
    "متأخر":               { en: "Late", ur: "تاخیر", fr: "En retard" },
    "مُدخل يدوياً":         { en: "Manually Entered", ur: "دستی اندراج", fr: "Saisie manuelle" },
    "بصمة الإصبع أو Face ID": { en: "Fingerprint or Face ID", ur: "فنگر پرنٹ یا Face ID", fr: "Empreinte ou Face ID" },
    "صورة بالكاميرا":      { en: "Camera Photo", ur: "کیمرے سے تصویر", fr: "Photo par caméra" },
    "طريقة التحقق":        { en: "Verification Method", ur: "تصدیق کا طریقہ", fr: "Méthode de vérification" },
    "مراقبة مواقع الحضور": { en: "Attendance Location Monitor", ur: "حاضری مقامات کی نگرانی", fr: "Suivi des lieux de pointage" },

    /* خدمات مالية وعهد وخطابات */
    "سلفة موظف":           { en: "Employee Advance", ur: "ملازم ایڈوانس", fr: "Avance salariale" },
    "سلفة راتب":           { en: "Salary Advance", ur: "تنخواہ ایڈوانس", fr: "Acompte sur salaire" },
    "تعريف راتب":          { en: "Salary Certificate", ur: "تنخواہ سرٹیفکیٹ", fr: "Attestation de salaire" },
    "تعريف بالراتب":       { en: "Salary Certificate", ur: "تنخواہ سرٹیفکیٹ", fr: "Attestation de salaire" },
    "كشف راتب":            { en: "Payslip", ur: "تنخواہ کی پرچی", fr: "Bulletin de paie" },
    "بدل انتقال":          { en: "Transport Allowance", ur: "ٹرانسپورٹ الاؤنس", fr: "Indemnité de transport" },
    "بدل سكن":             { en: "Housing Allowance", ur: "رہائش الاؤنس", fr: "Indemnité de logement" },
    "تعويض مصروف":         { en: "Expense Reimbursement", ur: "اخراجات کی واپسی", fr: "Remboursement de frais" },
    "مراجعة خصم":          { en: "Deduction Review", ur: "کٹوتی کا جائزہ", fr: "Révision d'une retenue" },
    "مراجعة راتب":         { en: "Salary Review", ur: "تنخواہ کا جائزہ", fr: "Révision de salaire" },
    "عهدة جديدة":          { en: "New Asset", ur: "نیا سامان", fr: "Nouveau matériel" },
    "استبدال عهدة":        { en: "Replace Asset", ur: "سامان کی تبدیلی", fr: "Remplacer le matériel" },
    "صيانة عهدة":          { en: "Asset Maintenance", ur: "سامان کی مرمت", fr: "Maintenance du matériel" },
    "إرجاع عهدة":          { en: "Return Asset", ur: "سامان واپسی", fr: "Restituer le matériel" },
    "بلاغ فقدان عهدة":     { en: "Report Lost Asset", ur: "سامان گم ہونے کی اطلاع", fr: "Déclarer une perte" },
    "شريحة اتصال":         { en: "SIM Card", ur: "سم کارڈ", fr: "Carte SIM" },
    "تعريف موظف":          { en: "Employment Certificate", ur: "ملازمت کا سرٹیفکیٹ", fr: "Attestation d'emploi" },
    "شهادة خبرة":          { en: "Experience Certificate", ur: "تجربے کا سرٹیفکیٹ", fr: "Certificat d'expérience" },
    "خطاب للبنك":          { en: "Letter to Bank", ur: "بینک کے لیے خط", fr: "Lettre pour la banque" },
    "خطاب للسفارة":        { en: "Letter to Embassy", ur: "سفارت خانے کے لیے خط", fr: "Lettre pour l'ambassade" },
    "خطاب للمرور":         { en: "Letter to Traffic Dept.", ur: "ٹریفک کے لیے خط", fr: "Lettre pour la circulation" },
    "خطاب عدم ممانعة":     { en: "No-Objection Letter", ur: "این او سی خط", fr: "Lettre de non-objection" },
    "عدم ممانعة":          { en: "No Objection", ur: "کوئی اعتراض نہیں", fr: "Non-objection" },
    "خطاب مخصص":           { en: "Custom Letter", ur: "خصوصی خط", fr: "Lettre personnalisée" },
    "خطاباتي وشهاداتي":    { en: "My Letters & Certificates", ur: "میرے خطوط اور اسناد", fr: "Mes lettres et attestations" },
    "توقيعي المعتمد":      { en: "My Approved Signature", ur: "میرا منظور شدہ دستخط", fr: "Ma signature approuvée" },
    "توقيع الخطاب":        { en: "Sign Letter", ur: "خط پر دستخط", fr: "Signer la lettre" },
    "الاعتماد بالتوقيع":   { en: "Approve with Signature", ur: "دستخط کے ساتھ منظوری", fr: "Approuver avec signature" },
    "تحديث البيانات":      { en: "Update Personal Data", ur: "معلومات کی تازہ کاری", fr: "Mise à jour des données" },
    "استقالة":             { en: "Resignation", ur: "استعفیٰ", fr: "Démission" },
    "إضافة مولود":         { en: "Add Newborn", ur: "نومولود کا اندراج", fr: "Ajouter un nouveau-né" },
    "التعاميم والأخبار":   { en: "Announcements & News", ur: "اعلانات اور خبریں", fr: "Annonces et actualités" },

    /* المراحل والحالات */
    "تم الإرسال":          { en: "Submitted", ur: "جمع کرا دی گئی", fr: "Envoyée" },
    "بانتظار المدير المباشر": { en: "Awaiting Direct Manager", ur: "منیجر کے انتظار میں", fr: "En attente du responsable" },
    "بانتظار الموارد البشرية": { en: "Awaiting HR", ur: "ایچ آر کے انتظار میں", fr: "En attente des RH" },
    "بانتظار الإدارة المالية": { en: "Awaiting Finance", ur: "مالیات کے انتظار میں", fr: "En attente des finances" },
    "بانتظار تقنية المعلومات": { en: "Awaiting IT", ur: "آئی ٹی کے انتظار میں", fr: "En attente de l'informatique" },
    "بانتظار موافقتي":     { en: "Awaiting My Approval", ur: "میری منظوری کے منتظر", fr: "En attente de mon approbation" },
    "يحتاج معلومات إضافية": { en: "Needs More Info", ur: "مزید معلومات درکار", fr: "Informations requises" },
    "تحت التنفيذ":         { en: "In Progress", ur: "جاری", fr: "En cours" },
    "تحت الإجراء":         { en: "In Progress", ur: "جاری", fr: "En cours" },
    "قيد الإجراء":         { en: "In Progress", ur: "جاری", fr: "En cours" },
    "قيد الانتظار":        { en: "Pending", ur: "زیر التوا", fr: "En attente" },
    "تم الرفض":            { en: "Rejected", ur: "مسترد", fr: "Rejetée" },
    "تم الإلغاء":          { en: "Cancelled", ur: "منسوخ", fr: "Annulée" },
    "تم التنفيذ":          { en: "Completed", ur: "مکمل", fr: "Terminée" },
    "تمت الموافقة":        { en: "Approved", ur: "منظور", fr: "Approuvée" },
    "التنفيذ والإغلاق":    { en: "Execution & Closure", ur: "تکمیل اور بندش", fr: "Exécution et clôture" },
    "ملغاة":               { en: "Cancelled", ur: "منسوخ", fr: "Annulée" },
    "منجزة":               { en: "Completed", ur: "مکمل", fr: "Terminées" },
    "مرفوضة أو ملغاة":     { en: "Rejected or Cancelled", ur: "مسترد یا منسوخ", fr: "Rejetées ou annulées" },
    "مرفوضة/ملغاة":        { en: "Rejected / Cancelled", ur: "مسترد / منسوخ", fr: "Rejetées / annulées" },
    "في انتظار المدير":    { en: "Awaiting Manager", ur: "منیجر کے انتظار میں", fr: "En attente du responsable" },
    "في انتظار الموارد البشرية": { en: "Awaiting HR", ur: "ایچ آر کے انتظار میں", fr: "En attente des RH" },
    "جارية الآن":          { en: "Ongoing", ur: "جاری", fr: "En cours" },
    "في إجازة":            { en: "On Leave", ur: "چھٹی پر", fr: "En congé" },
    "الإدارة المالية":     { en: "Finance", ur: "مالیات", fr: "Finances" },
    "الموارد البشرية":     { en: "Human Resources", ur: "انسانی وسائل", fr: "Ressources humaines" },

    /* عناوين الحقول */
    "المبلغ":              { en: "Amount", ur: "رقم", fr: "Montant" },
    "أشهر السداد":         { en: "Repayment Months", ur: "ادائیگی کے مہینے", fr: "Mois de remboursement" },
    "الغرض":               { en: "Purpose", ur: "مقصد", fr: "Objet" },
    "الجهة":               { en: "Destination", ur: "ادارہ", fr: "Destinataire" },
    "عدد النسخ":           { en: "Number of Copies", ur: "کاپیوں کی تعداد", fr: "Nombre de copies" },
    "طريقة الاستلام":      { en: "Delivery Method", ur: "وصولی کا طریقہ", fr: "Mode de réception" },
    "نوع العهدة":          { en: "Asset Type", ur: "سامان کی قسم", fr: "Type de matériel" },
    "الكمية":              { en: "Quantity", ur: "مقدار", fr: "Quantité" },
    "تاريخ الاحتياج":      { en: "Needed By", ur: "ضرورت کی تاریخ", fr: "Date de besoin" },
    "المدة":               { en: "Duration", ur: "مدت", fr: "Durée" },
    "تاريخ الإرجاع":       { en: "Return Date", ur: "واپسی کی تاریخ", fr: "Date de retour" },
    "التاريخ":             { en: "Date", ur: "تاریخ", fr: "Date" },
    "الوقت":               { en: "Time", ur: "وقت", fr: "Heure" },
    "السبب":               { en: "Reason", ur: "وجہ", fr: "Motif" },
    "سبب آخر":             { en: "Other Reason", ur: "دوسری وجہ", fr: "Autre motif" },
    "نوع الخطاب":          { en: "Letter Type", ur: "خط کی قسم", fr: "Type de lettre" },
    "تاريخ الانتهاء":      { en: "Expiry Date", ur: "اختتامی تاریخ", fr: "Date d'expiration" },
    "الاسم":               { en: "Name", ur: "نام", fr: "Nom" },
    "من تاريخ":            { en: "From Date", ur: "تاریخ سے", fr: "Du" },
    "إلى تاريخ":           { en: "To Date", ur: "تاریخ تک", fr: "Au" },
    "من":                  { en: "From", ur: "سے", fr: "Du" },
    "إلى":                 { en: "To", ur: "تک", fr: "Au" },
    "الراتب":              { en: "Salary", ur: "تنخواہ", fr: "Salaire" },
    "عدد الأيام":          { en: "Number of Days", ur: "دنوں کی تعداد", fr: "Nombre de jours" },
    "تاريخ البداية":       { en: "Start Date", ur: "آغاز کی تاریخ", fr: "Date de début" },
    "تاريخ النهاية":       { en: "End Date", ur: "اختتام کی تاریخ", fr: "Date de fin" },
    "اسم البنك":           { en: "Bank Name", ur: "بینک کا نام", fr: "Nom de la banque" },
    "الجنس":               { en: "Gender", ur: "جنس", fr: "Genre" },
    "النوع":               { en: "Type", ur: "قسم", fr: "Type" },
    "القيمة الجديدة":      { en: "New Value", ur: "نئی قیمت", fr: "Nouvelle valeur" },
    "تاريخ التغيير":       { en: "Change Date", ur: "تبدیلی کی تاریخ", fr: "Date de modification" },
    "تاريخ انتهاء الهوية": { en: "ID Expiry Date", ur: "شناختی کارڈ کی میعاد", fr: "Expiration de la pièce d'identité" },
    "يتضمّن الراتب":        { en: "Includes Salary", ur: "تنخواہ شامل ہے", fr: "Inclut le salaire" },
    "رقم الطلب":           { en: "Request No.", ur: "درخواست نمبر", fr: "N° de demande" },
    "الموظف":              { en: "Employee", ur: "ملازم", fr: "Employé" },
    "الموظف المستفيد":     { en: "Beneficiary Employee", ur: "مستفید ملازم", fr: "Employé bénéficiaire" },
    "مقدم الطلب":          { en: "Requested By", ur: "درخواست گزار", fr: "Demandeur" },
    "التصنيف":             { en: "Category", ur: "زمرہ", fr: "Catégorie" },
    "الحالة":              { en: "Status", ur: "حالت", fr: "Statut" },
    "الدور":               { en: "Role", ur: "کردار", fr: "Rôle" },
    "ملاحظات":             { en: "Notes", ur: "نوٹس", fr: "Remarques" },
    "مرفق":                { en: "Attachment", ur: "منسلکہ", fr: "Pièce jointe" },
    "رقم":                 { en: "No.", ur: "نمبر", fr: "N°" },
    "فريق القسم":          { en: "Department Team", ur: "شعبے کی ٹیم", fr: "Équipe du département" },
    "إجراءات":             { en: "Actions", ur: "اقدامات", fr: "Actions" },

    /* أزرار ورسائل */
    "إنشاء طلب":           { en: "Create Request", ur: "درخواست بنائیں", fr: "Créer une demande" },
    "إرسال الطلب":         { en: "Submit Request", ur: "درخواست بھیجیں", fr: "Envoyer la demande" },
    "موافقة":              { en: "Approve", ur: "منظوری", fr: "Approuver" },
    "إعادة المحاولة":      { en: "Retry", ur: "دوبارہ کوشش", fr: "Réessayer" },
    "تفعيل":               { en: "Enable", ur: "فعال کریں", fr: "Activer" },
    "تعطيل":               { en: "Disable", ur: "غیر فعال", fr: "Désactiver" },
    "إضافة خدمة":          { en: "Add Service", ur: "خدمت شامل کریں", fr: "Ajouter un service" },
    "إخفاء الخدمة":        { en: "Hide Service", ur: "خدمت چھپائیں", fr: "Masquer le service" },
    "تسجيل الدخول":        { en: "Sign In", ur: "سائن ان", fr: "Connexion" },
    "حفظ وتطبيق الصلاحيات": { en: "Save & Apply Permissions", ur: "اجازتیں محفوظ کریں", fr: "Enregistrer les autorisations" },
    "ابحث عن خدمة…":       { en: "Search for a service…", ur: "خدمت تلاش کریں…", fr: "Rechercher un service…" },
    "أقرّ بصحة البيانات المُدخلة.": { en: "I confirm the entered data is correct.", ur: "میں تصدیق کرتا ہوں کہ معلومات درست ہیں۔", fr: "Je certifie l'exactitude des données saisies." },
    "لم تقم بإضافة خدمات إلى اختصاراتك بعد.": { en: "You haven't added any services to your shortcuts yet.", ur: "ابھی تک کوئی خدمت شارٹ کٹ میں شامل نہیں۔", fr: "Vous n'avez encore ajouté aucun service à vos raccourcis." },
    "تعذّر إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى.": { en: "Could not submit the request. Check your connection and try again.", ur: "درخواست نہیں بھیجی جا سکی۔ کنکشن دیکھ کر دوبارہ کوشش کریں۔", fr: "Envoi impossible. Vérifiez votre connexion et réessayez." },
    "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية.": { en: "The end date cannot be before the start date.", ur: "اختتامی تاریخ آغاز سے پہلے نہیں ہو سکتی۔", fr: "La date de fin ne peut précéder la date de début." },
    "يلزم السماح بالوصول إلى الموقع لتسجيل الحضور أو الانصراف.": { en: "Location access is required to check in or out.", ur: "حاضری کے لیے مقام کی اجازت ضروری ہے۔", fr: "L'accès à la localisation est requis pour pointer." },
    "تعذّرت قراءة الصورة.": { en: "Could not read the image.", ur: "تصویر پڑھی نہیں جا سکی۔", fr: "Impossible de lire l'image." },
    "تعذّر الاتصال":        { en: "Connection Failed", ur: "کنکشن ناکام", fr: "Échec de connexion" },
    "تعذّر الاتصال بالخادم.": { en: "Could not reach the server.", ur: "سرور سے رابطہ نہیں ہو سکا۔", fr: "Serveur injoignable." },
    "جارٍ الفحص…":          { en: "Checking…", ur: "جانچ جاری…", fr: "Vérification…" },
    "متصل":                { en: "Connected", ur: "منسلک", fr: "Connecté" },
    "الفلتر النشط:":       { en: "Active filter:", ur: "فعال فلٹر:", fr: "Filtre actif :" },
    "الكل":                { en: "All", ur: "سب", fr: "Tout" },
    "الحالية":             { en: "Current", ur: "موجودہ", fr: "En cours" },
    "القادمة":             { en: "Upcoming", ur: "آنے والی", fr: "À venir" },
    "السابقة":             { en: "Past", ur: "گزشتہ", fr: "Passées" },
    "مؤقتة":               { en: "Temporary", ur: "عارضی", fr: "Temporaire" },
    "بوابة الموظفين":      { en: "Employee Portal", ur: "ملازمین پورٹل", fr: "Portail des employés" },
    "الطلبات":             { en: "Requests", ur: "درخواستیں", fr: "Demandes" },

    /* مصفوفة الصلاحيات */
    "بدون":                { en: "None", ur: "کوئی نہیں", fr: "Aucun" },
    "عرض":                 { en: "View", ur: "دیکھیں", fr: "Consulter" },
    "عرض فقط":             { en: "View Only", ur: "صرف دیکھیں", fr: "Consultation seule" },
    "إنشاء":               { en: "Create", ur: "بنائیں", fr: "Créer" },
    "تعديل":               { en: "Edit", ur: "ترمیم", fr: "Modifier" },
    "إدارة كاملة":         { en: "Full Management", ur: "مکمل انتظام", fr: "Gestion complète" },
    "غير ظاهر":            { en: "Hidden", ur: "پوشیدہ", fr: "Masqué" },
    "إنشاء لنفسي":         { en: "Create for Myself", ur: "اپنے لیے بنائیں", fr: "Créer pour moi" },
    "إنشاء لنفسي فقط":     { en: "Create for Myself Only", ur: "صرف اپنے لیے", fr: "Créer pour moi uniquement" },
    "إنشاء لموظفي فريقي":  { en: "Create for My Team", ur: "میری ٹیم کے لیے", fr: "Créer pour mon équipe" },
    "إنشاء لنفسي ولموظفي فريقي": { en: "Create for Myself & My Team", ur: "اپنے اور ٹیم کے لیے", fr: "Créer pour moi et mon équipe" },
    "اعتماد الطلبات":      { en: "Approve Requests", ur: "درخواستیں منظور کریں", fr: "Approuver les demandes" },
    "اعتماد طلبات التصنيف": { en: "Approve Category Requests", ur: "زمرے کی درخواستیں منظور", fr: "Approuver les demandes de la catégorie" },
    "مراجعة طلبات التصنيف": { en: "Review Category Requests", ur: "زمرے کی درخواستوں کا جائزہ", fr: "Examiner les demandes de la catégorie" },
    "استخدام الخدمات المسموحة": { en: "Use Permitted Services", ur: "اجازت شدہ خدمات کا استعمال", fr: "Utiliser les services autorisés" },
    "عرض طلباته":          { en: "View Own Requests", ur: "اپنی درخواستیں دیکھیں", fr: "Voir ses demandes" },
    "عرض بياناته":         { en: "View Own Data", ur: "اپنی معلومات دیکھیں", fr: "Voir ses données" },
    "عرض حضوره":           { en: "View Own Attendance", ur: "اپنی حاضری دیکھیں", fr: "Voir sa présence" },
    "عرض رصيده":           { en: "View Own Balance", ur: "اپنا بیلنس دیکھیں", fr: "Voir son solde" },
    "الاطلاع على الرواتب": { en: "View Salaries", ur: "تنخواہیں دیکھیں", fr: "Consulter les salaires" },
    "إنشاء إجازة":         { en: "Create Leave", ur: "چھٹی بنائیں", fr: "Créer un congé" },
    "عرض فريق القسم":      { en: "View Department Team", ur: "شعبے کی ٹیم دیکھیں", fr: "Voir l'équipe du département" },
    "عرض ملفات موظفي القسم": { en: "View Department Employee Files", ur: "شعبے کے ملازمین کی فائلیں", fr: "Voir les dossiers du département" },
    "عرض طلبات موظفي القسم": { en: "View Department Requests", ur: "شعبے کی درخواستیں دیکھیں", fr: "Voir les demandes du département" },
    "عرض حضور موظفي القسم": { en: "View Department Attendance", ur: "شعبے کی حاضری دیکھیں", fr: "Voir la présence du département" },
    "عرض إجازات موظفي القسم": { en: "View Department Leaves", ur: "شعبے کی چھٹیاں دیکھیں", fr: "Voir les congés du département" },
    "عرض ورديات موظفي القسم": { en: "View Department Shifts", ur: "شعبے کی شفٹیں دیکھیں", fr: "Voir les équipes du département" },
    "اعتماد طلبات موظفي القسم": { en: "Approve Department Requests", ur: "شعبے کی درخواستیں منظور", fr: "Approuver les demandes du département" },
    "رفض طلبات موظفي القسم": { en: "Reject Department Requests", ur: "شعبے کی درخواستیں مسترد", fr: "Rejeter les demandes du département" },
    "تسجيل حضور يدوي":     { en: "Manual Check-in", ur: "دستی حاضری", fr: "Pointage manuel (arrivée)" },
    "تسجيل انصراف يدوي":   { en: "Manual Check-out", ur: "دستی روانگی", fr: "Pointage manuel (départ)" },
    "تقديم تصحيح حضور":    { en: "Submit Attendance Correction", ur: "حاضری کی درستی جمع کریں", fr: "Soumettre une correction de présence" },
    "إرسال إشعار لموظف":   { en: "Send Notification to Employee", ur: "ملازم کو اطلاع بھیجیں", fr: "Envoyer une notification à un employé" },
    "إنشاء طلب نيابة عن موظف": { en: "Create Request on Behalf of Employee", ur: "ملازم کی جانب سے درخواست", fr: "Créer une demande au nom d'un employé" },
    "إدارة التطبيق":       { en: "App Administration", ur: "ایپ کا انتظام", fr: "Administration de l'application" },
    "مدير موارد بشرية":    { en: "HR Manager", ur: "ایچ آر منیجر", fr: "Responsable RH" },
    "مدير إدارة":          { en: "Division Manager", ur: "شعبہ جاتی منیجر", fr: "Directeur de division" },
    "مدير القسم":          { en: "Department Manager", ur: "شعبہ منیجر", fr: "Chef de département" },

    /* ===================================================================
     * الدفعة الثالثة — قياس التغطية الحقيقي.
     * القياس الأول كان يعدّ كل نصّ عربي في الحزمة (904)، والصحيح أن يُعدّ
     * ما يُرسَم فعلًا عقدةً نصّية داخل children (480). التغطية كانت 26%
     * فقط — ولذلك بقيت معظم الشاشات عربية. هذه الدفعة تُكملها.
     * =================================================================== */

    /* عناوين وأقسام */
    "التقارير والإحصائيات": { en: "Reports & Analytics", ur: "رپورٹس اور اعدادوشمار", fr: "Rapports et statistiques" },
    "التفاصيل":            { en: "Details", ur: "تفصیلات", fr: "Détails" },
    "المسؤول الحالي":      { en: "Current Owner", ur: "موجودہ ذمہ دار", fr: "Responsable actuel" },
    "إجازاتي":             { en: "My Leaves", ur: "میری چھٹیاں", fr: "Mes congés" },
    "بيانات الموظف المستفيد": { en: "Beneficiary Employee Details", ur: "مستفید ملازم کی تفصیل", fr: "Informations du bénéficiaire" },
    "سجل الموافقات والعمليات": { en: "Approvals & Activity Log", ur: "منظوریوں اور کارروائیوں کا ریکارڈ", fr: "Journal des approbations" },
    "التعليقات":           { en: "Comments", ur: "تبصرے", fr: "Commentaires" },
    "إجراء الموافقة":      { en: "Approval Action", ur: "منظوری کی کارروائی", fr: "Action d'approbation" },
    "مسار الموافقات":      { en: "Approval Path", ur: "منظوری کا راستہ", fr: "Circuit d'approbation" },
    "مراحل الموافقة (بالترتيب)": { en: "Approval Stages (in order)", ur: "منظوری کے مراحل (ترتیب سے)", fr: "Étapes d'approbation (dans l'ordre)" },
    "إدارة مسارات الموافقات": { en: "Manage Approval Workflows", ur: "منظوری کے راستوں کا انتظام", fr: "Gérer les circuits d'approbation" },
    "سجل التدقيق — Audit Log": { en: "Audit Log", ur: "آڈٹ لاگ", fr: "Journal d'audit" },
    "مستخدمو التطبيق":     { en: "App Users", ur: "ایپ صارفین", fr: "Utilisateurs de l'application" },
    "قوائم العمل":         { en: "Work Queues", ur: "کام کی فہرستیں", fr: "Files de travail" },
    "مؤشرات الأداء":       { en: "Performance Indicators", ur: "کارکردگی کے اشارے", fr: "Indicateurs de performance" },
    "الطلبات حسب النوع":   { en: "Requests by Type", ur: "قسم کے مطابق درخواستیں", fr: "Demandes par type" },
    "الطلبات حسب الحالة":  { en: "Requests by Status", ur: "حالت کے مطابق درخواستیں", fr: "Demandes par statut" },
    "الطلبات المنجزة":     { en: "Completed Requests", ur: "مکمل درخواستیں", fr: "Demandes traitées" },
    "إجمالي الطلبات":      { en: "Total Requests", ur: "کل درخواستیں", fr: "Total des demandes" },
    "طلبات موظفيي":        { en: "My Employees' Requests", ur: "میرے ملازمین کی درخواستیں", fr: "Demandes de mes employés" },
    "طلبات الحضور والورديات": { en: "Attendance & Shift Requests", ur: "حاضری اور شفٹ درخواستیں", fr: "Demandes de présence et d'équipe" },
    "إجراءات على إجازة قائمة": { en: "Actions on an Existing Leave", ur: "موجودہ چھٹی پر کارروائی", fr: "Actions sur un congé existant" },
    "خدمات أخرى":          { en: "Other Services", ur: "دیگر خدمات", fr: "Autres services" },
    "شعار الشركة":         { en: "Company Logo", ur: "کمپنی کا لوگو", fr: "Logo de l'entreprise" },
    "اسم الشركة":          { en: "Company Name", ur: "کمپنی کا نام", fr: "Nom de l'entreprise" },
    "إعداد الخادم":        { en: "Server Setup", ur: "سرور کی ترتیب", fr: "Configuration du serveur" },
    "الإصدار":             { en: "Version", ur: "ورژن", fr: "Version" },
    "إصدار التطبيق":       { en: "App Version", ur: "ایپ ورژن", fr: "Version de l'application" },
    "أهلًا بك":             { en: "Welcome", ur: "خوش آمدید", fr: "Bienvenue" },
    "بوابة الموظف":        { en: "Employee Portal", ur: "ملازم پورٹل", fr: "Portail employé" },
    "وضع الاختبار":        { en: "Test Mode", ur: "ٹیسٹ موڈ", fr: "Mode test" },
    "الخدمة الذاتية · متكاملة مع Odoo 19": { en: "Self-service · Integrated with Odoo 19", ur: "سیلف سروس · Odoo 19 سے مربوط", fr: "Libre-service · Intégré à Odoo 19" },

    /* أزرار وإجراءات */
    "تحميل PDF":           { en: "Download PDF", ur: "PDF ڈاؤن لوڈ", fr: "Télécharger le PDF" },
    "تحميل المستند":       { en: "Download Document", ur: "دستاویز ڈاؤن لوڈ", fr: "Télécharger le document" },
    "عرض الخطاب":          { en: "View Letter", ur: "خط دیکھیں", fr: "Voir la lettre" },
    "المستند الصادر":      { en: "Issued Document", ur: "جاری کردہ دستاویز", fr: "Document délivré" },
    "اقرأ الخبر":          { en: "Read Article", ur: "خبر پڑھیں", fr: "Lire l'article" },
    "تم":                  { en: "Done", ur: "ہو گیا", fr: "Terminé" },
    "تغيير":               { en: "Change", ur: "تبدیل کریں", fr: "Modifier" },
    "اضغط للتغيير":        { en: "Tap to change", ur: "تبدیلی کے لیے دبائیں", fr: "Appuyez pour modifier" },
    "لاحقاً":              { en: "Later", ur: "بعد میں", fr: "Plus tard" },
    "نعم":                 { en: "Yes", ur: "ہاں", fr: "Oui" },
    "لا":                  { en: "No", ur: "نہیں", fr: "Non" },
    "اختر":                { en: "Select", ur: "منتخب کریں", fr: "Sélectionner" },
    "تراجع":               { en: "Back", ur: "واپس", fr: "Retour" },
    "حذف":                 { en: "Delete", ur: "حذف کریں", fr: "Supprimer" },
    "إخفاء":               { en: "Hide", ur: "چھپائیں", fr: "Masquer" },
    "تطبيق":               { en: "Apply", ur: "لاگو کریں", fr: "Appliquer" },
    "تصدير":               { en: "Export", ur: "برآمد", fr: "Exporter" },
    "معاينة":              { en: "Preview", ur: "پیش نظارہ", fr: "Aperçu" },
    "إعادة تعيين":         { en: "Reset", ur: "ری سیٹ", fr: "Réinitialiser" },
    "استعادة الافتراضي":   { en: "Restore Default", ur: "ڈیفالٹ بحال کریں", fr: "Restaurer par défaut" },
    "تطبيق على التطبيق":   { en: "Apply to App", ur: "ایپ پر لاگو کریں", fr: "Appliquer à l'application" },
    "تأكيد الرفض":         { en: "Confirm Rejection", ur: "مسترد کی تصدیق", fr: "Confirmer le rejet" },
    "اعتماد الكل":         { en: "Approve All", ur: "سب منظور کریں", fr: "Tout approuver" },
    "تطبيق القرارات":      { en: "Apply Decisions", ur: "فیصلے لاگو کریں", fr: "Appliquer les décisions" },
    "اعتماد القرارات":     { en: "Approve Decisions", ur: "فیصلوں کی منظوری", fr: "Approuver les décisions" },
    "إرسال للمراجعة":      { en: "Send for Review", ur: "جائزے کے لیے بھیجیں", fr: "Envoyer pour examen" },
    "إرسال طلب التعديل":   { en: "Submit Modification Request", ur: "ترمیمی درخواست بھیجیں", fr: "Envoyer la demande de modification" },
    "إرسال إشعار للموظف":  { en: "Send Notification to Employee", ur: "ملازم کو اطلاع بھیجیں", fr: "Notifier l'employé" },
    "عرض فريقي":           { en: "View My Team", ur: "میری ٹیم دیکھیں", fr: "Voir mon équipe" },
    "عرض سجل الحضور":      { en: "View Attendance Log", ur: "حاضری کا ریکارڈ دیکھیں", fr: "Voir le journal de présence" },
    "تصدير التقرير (CSV)": { en: "Export Report (CSV)", ur: "رپورٹ برآمد (CSV)", fr: "Exporter le rapport (CSV)" },
    "إضافة مستخدم جديد":   { en: "Add New User", ur: "نیا صارف شامل کریں", fr: "Ajouter un utilisateur" },
    "حفظ المستخدم":        { en: "Save User", ur: "صارف محفوظ کریں", fr: "Enregistrer l'utilisateur" },
    "إضافة خدمة جديدة":    { en: "Add New Service", ur: "نئی خدمت شامل کریں", fr: "Ajouter un service" },
    "حفظ الخدمة":          { en: "Save Service", ur: "خدمت محفوظ کریں", fr: "Enregistrer le service" },
    "إضافة مرحلة":         { en: "Add Stage", ur: "مرحلہ شامل کریں", fr: "Ajouter une étape" },
    "معاينة المسار":       { en: "Preview Workflow", ur: "راستے کا پیش نظارہ", fr: "Aperçu du circuit" },
    "اختبار المسار":       { en: "Test Workflow", ur: "راستے کی جانچ", fr: "Tester le circuit" },
    "اختبار مسار":         { en: "Test Workflow", ur: "راستے کی جانچ", fr: "Tester un circuit" },
    "حفظ المسار":          { en: "Save Workflow", ur: "راستہ محفوظ کریں", fr: "Enregistrer le circuit" },
    "العودة والحفظ":       { en: "Back & Save", ur: "واپس اور محفوظ", fr: "Retour et enregistrer" },
    "المغادرة دون حفظ":    { en: "Leave Without Saving", ur: "بغیر محفوظ کیے نکلیں", fr: "Quitter sans enregistrer" },
    "حفظ كمسودة":          { en: "Save as Draft", ur: "مسودے کے طور پر محفوظ", fr: "Enregistrer comme brouillon" },
    "رفع صورة":            { en: "Upload Image", ur: "تصویر اپ لوڈ", fr: "Téléverser une image" },
    "مسح":                 { en: "Clear", ur: "مٹائیں", fr: "Effacer" },
    "فتح على الخريطة":     { en: "Open in Map", ur: "نقشے پر کھولیں", fr: "Ouvrir sur la carte" },
    "فتح إعدادات الموقع":  { en: "Open Location Settings", ur: "مقام کی ترتیبات کھولیں", fr: "Ouvrir les paramètres de localisation" },
    "طلب جديد":            { en: "New Request", ur: "نئی درخواست", fr: "Nouvelle demande" },
    "طلب عهدة جديدة":      { en: "Request New Asset", ur: "نیا سامان طلب کریں", fr: "Demander du matériel" },
    "إدارة العهد الحالية": { en: "Manage Current Assets", ur: "موجودہ سامان کا انتظام", fr: "Gérer le matériel en cours" },
    "محضر الاستلام":       { en: "Handover Receipt", ur: "وصولی کی رسید", fr: "Procès-verbal de remise" },
    "مراجعة جميع التعديلات": { en: "Review All Changes", ur: "تمام تبدیلیوں کا جائزہ", fr: "Vérifier toutes les modifications" },
    "استخدام توقيع آخر (رسم يدوي)": { en: "Use another signature (draw)", ur: "دوسرا دستخط (ہاتھ سے)", fr: "Utiliser une autre signature (dessin)" },
    "إزالة الصورة والرسم يدويًا": { en: "Remove image and draw by hand", ur: "تصویر ہٹا کر ہاتھ سے بنائیں", fr: "Retirer l'image et dessiner" },
    "نعم، تفعيل البصمة / Face ID": { en: "Yes, enable Fingerprint / Face ID", ur: "ہاں، فنگر پرنٹ / Face ID فعال کریں", fr: "Oui, activer l'empreinte / Face ID" },
    "تفعيل الدخول السريع": { en: "Enable Quick Sign-in", ur: "فوری سائن اِن فعال کریں", fr: "Activer la connexion rapide" },
    "تذكّرني":              { en: "Remember me", ur: "مجھے یاد رکھیں", fr: "Se souvenir de moi" },
    "الدخول عبر نفاذ":     { en: "Sign in with Nafath", ur: "نفاذ سے سائن اِن", fr: "Connexion via Nafath" },
    "أو":                  { en: "or", ur: "یا", fr: "ou" },
    "ضبط دقيق":            { en: "Fine-tune", ur: "باریک ترتیب", fr: "Réglage fin" },

    /* حقول ونماذج */
    "تاريخ البداية *":     { en: "Start Date *", ur: "آغاز کی تاریخ *", fr: "Date de début *" },
    "تاريخ النهاية *":     { en: "End Date *", ur: "اختتام کی تاریخ *", fr: "Date de fin *" },
    "التاريخ *":           { en: "Date *", ur: "تاریخ *", fr: "Date *" },
    "نوع العهدة *":        { en: "Asset Type *", ur: "سامان کی قسم *", fr: "Type de matériel *" },
    "الكمية *":            { en: "Quantity *", ur: "مقدار *", fr: "Quantité *" },
    "تاريخ الاحتياج *":    { en: "Needed By *", ur: "ضرورت کی تاریخ *", fr: "Date de besoin *" },
    "المبلغ (ريال)":       { en: "Amount (SAR)", ur: "رقم (ریال)", fr: "Montant (SAR)" },
    "عدد أشهر السداد":     { en: "Repayment Months", ur: "ادائیگی کے مہینے", fr: "Nombre de mensualités" },
    "الجهة الموجّه إليها *": { en: "Addressed To *", ur: "مکتوب الیہ *", fr: "Destinataire *" },
    "الغرض من الخطاب":     { en: "Letter Purpose", ur: "خط کا مقصد", fr: "Objet de la lettre" },
    "تاريخ التصحيح *":     { en: "Correction Date *", ur: "درستی کی تاریخ *", fr: "Date de correction *" },
    "وقت الحضور الصحيح *": { en: "Correct Check-in Time *", ur: "درست حاضری کا وقت *", fr: "Heure d'arrivée correcte *" },
    "وقت الانصراف الصحيح *": { en: "Correct Check-out Time *", ur: "درست روانگی کا وقت *", fr: "Heure de départ correcte *" },
    "وقت الحضور *":        { en: "Check-in Time *", ur: "حاضری کا وقت *", fr: "Heure d'arrivée *" },
    "وقت الانصراف *":      { en: "Check-out Time *", ur: "روانگی کا وقت *", fr: "Heure de départ *" },
    "من الساعة":           { en: "From", ur: "سے", fr: "De" },
    "إلى الساعة":          { en: "To", ur: "تک", fr: "À" },
    "من الساعة *":         { en: "From *", ur: "سے *", fr: "De *" },
    "إلى الساعة *":        { en: "To *", ur: "تک *", fr: "À *" },
    "نوع الإجازة المعتمد *": { en: "Approved Leave Type *", ur: "منظور شدہ چھٹی کی قسم *", fr: "Type de congé approuvé *" },
    "سبب الرفض (إلزامي)":  { en: "Rejection Reason (required)", ur: "مسترد کی وجہ (لازمی)", fr: "Motif du rejet (obligatoire)" },
    "نوع التعديل المطلوب *": { en: "Requested Change Type *", ur: "مطلوبہ ترمیم کی قسم *", fr: "Type de modification *" },
    "تاريخ البداية الجديد": { en: "New Start Date", ur: "نئی آغاز کی تاریخ", fr: "Nouvelle date de début" },
    "تاريخ النهاية الجديد": { en: "New End Date", ur: "نئی اختتامی تاریخ", fr: "Nouvelle date de fin" },
    "تاريخ العودة الفعلية للعمل *": { en: "Actual Return-to-Work Date *", ur: "کام پر واپسی کی اصل تاریخ *", fr: "Date effective de reprise *" },
    "تاريخ بداية التطبيق *": { en: "Effective From *", ur: "نفاذ کی تاریخ *", fr: "Applicable à partir du *" },
    "تاريخ نهاية التغيير *": { en: "Change End Date *", ur: "تبدیلی کی اختتامی تاریخ *", fr: "Fin du changement *" },
    "وقت البداية":         { en: "Start Time", ur: "آغاز کا وقت", fr: "Heure de début" },
    "أيام العمل":          { en: "Working Days", ur: "کام کے دن", fr: "Jours ouvrés" },
    "أيام عمل":            { en: "working days", ur: "کام کے دن", fr: "jours ouvrés" },
    "مطبّقة منذ":           { en: "In effect since", ur: "نافذ العمل بتاریخ", fr: "En vigueur depuis" },
    "مدة الوردية الجديدة": { en: "New Shift Duration", ur: "نئی شفٹ کا دورانیہ", fr: "Durée de la nouvelle équipe" },
    "الوردية الجديدة المطلوبة": { en: "Requested New Shift", ur: "مطلوبہ نئی شفٹ", fr: "Nouvelle équipe demandée" },
    "طلب تغيير وردية أو ساعات دوام": { en: "Shift or Hours Change Request", ur: "شفٹ یا اوقات کی تبدیلی کی درخواست", fr: "Demande de changement d'équipe ou d'horaires" },
    "دائم":                { en: "Permanent", ur: "مستقل", fr: "Permanent" },
    "دائمة":               { en: "Permanent", ur: "مستقل", fr: "Permanente" },
    "مؤقت":                { en: "Temporary", ur: "عارضی", fr: "Temporaire" },
    "مخصّصة":               { en: "Custom", ur: "خصوصی", fr: "Personnalisée" },
    "غير محدد":            { en: "Unspecified", ur: "غیر متعین", fr: "Non précisé" },
    "القيمة":              { en: "Value", ur: "قیمت", fr: "Valeur" },
    "النموذج":             { en: "Form", ur: "فارم", fr: "Formulaire" },
    "البيان":              { en: "Item", ur: "تفصیل", fr: "Libellé" },
    "المطلوبة":            { en: "Requested", ur: "مطلوبہ", fr: "Demandé" },
    "الرقم":               { en: "Number", ur: "نمبر", fr: "Numéro" },
    "نوع الطلب":           { en: "Request Type", ur: "درخواست کی قسم", fr: "Type de demande" },
    "الدور الحالي":        { en: "Current Role", ur: "موجودہ کردار", fr: "Rôle actuel" },
    "النظام":              { en: "System", ur: "سسٹم", fr: "Système" },
    "عربي":                { en: "Arabic", ur: "عربی", fr: "Arabe" },
    "إنجليزي":             { en: "English", ur: "انگریزی", fr: "Anglais" },
    "إلكتروني (PDF)":      { en: "Electronic (PDF)", ur: "الیکٹرانک (PDF)", fr: "Électronique (PDF)" },
    "ورقي مختوم":          { en: "Stamped Hard Copy", ur: "مہر شدہ کاغذی نقل", fr: "Copie papier tamponnée" },
    "يُرسل للجهة مباشرة":   { en: "Sent directly to the recipient", ur: "براہِ راست ادارے کو بھیجا جائے", fr: "Envoyé directement au destinataire" },
    "طلب سري 🔒":          { en: "Confidential Request 🔒", ur: "خفیہ درخواست 🔒", fr: "Demande confidentielle 🔒" },

    /* الحضور والموقع */
    "الموقع":              { en: "Location", ur: "مقام", fr: "Localisation" },
    "الموقع الجغرافي":     { en: "Geographic Location", ur: "جغرافیائی مقام", fr: "Localisation géographique" },
    "المسافة":             { en: "Distance", ur: "فاصلہ", fr: "Distance" },
    "المسافة التقريبية":   { en: "Approximate Distance", ur: "تخمینی فاصلہ", fr: "Distance approximative" },
    "الدقة":               { en: "Accuracy", ur: "درستگی", fr: "Précision" },
    "جودة الموقع":         { en: "Location Quality", ur: "مقام کا معیار", fr: "Qualité de la localisation" },
    "الإحداثيات":          { en: "Coordinates", ur: "کوآرڈینیٹس", fr: "Coordonnées" },
    "التقاط":              { en: "Captured", ur: "حاصل شدہ", fr: "Capturé" },
    "الجهاز":              { en: "Device", ur: "ڈیوائس", fr: "Appareil" },
    "التحقق":              { en: "Verification", ur: "تصدیق", fr: "Vérification" },
    "التحقق من الهوية":    { en: "Identity Verification", ur: "شناخت کی تصدیق", fr: "Vérification d'identité" },
    "جارٍ التحقق…":        { en: "Verifying…", ur: "تصدیق جاری…", fr: "Vérification…" },
    "اشتباه تلاعب":        { en: "Tampering Suspected", ur: "چھیڑ چھاڑ کا شبہ", fr: "Fraude suspectée" },
    "دقة ضعيفة":           { en: "Poor Accuracy", ur: "کمزور درستگی", fr: "Faible précision" },
    "آخر تحديث":           { en: "Last Updated", ur: "آخری تازہ کاری", fr: "Dernière mise à jour" },
    "تسجيلات اليوم":       { en: "Today's Punches", ur: "آج کے اندراجات", fr: "Pointages du jour" },
    "حالة اليوم":          { en: "Today's Status", ur: "آج کی حالت", fr: "Statut du jour" },
    "اليوم":               { en: "Today", ur: "آج", fr: "Aujourd'hui" },
    "أيام منتظمة":         { en: "Regular Days", ur: "معمول کے دن", fr: "Jours réguliers" },
    "منتظم":               { en: "Regular", ur: "معمول", fr: "Régulier" },
    "ساعات العمل":         { en: "Working Hours", ur: "کام کے گھنٹے", fr: "Heures travaillées" },
    "التأخير":             { en: "Lateness", ur: "تاخیر", fr: "Retard" },
    "إضافي":               { en: "Overtime", ur: "اضافی", fr: "Supplémentaire" },
    "يدوي":                { en: "Manual", ur: "دستی", fr: "Manuel" },
    "بصمة":                { en: "Biometric", ur: "بایومیٹرک", fr: "Biométrie" },
    "الدوام":              { en: "Work Hours", ur: "اوقاتِ کار", fr: "Horaires" },
    "دوام":                { en: "Work", ur: "کام", fr: "Travail" },
    "الوردية":             { en: "Shift", ur: "شفٹ", fr: "Équipe" },
    "حاضرون اليوم":        { en: "Present Today", ur: "آج حاضر", fr: "Présents aujourd'hui" },
    "على رأس العمل":       { en: "At Work", ur: "کام پر", fr: "Au travail" },
    "طلب مفتوح":           { en: "Open Request", ur: "کھلی درخواست", fr: "Demande ouverte" },
    "إخفاء الإجراءات":     { en: "Hide Actions", ur: "کارروائیاں چھپائیں", fr: "Masquer les actions" },
    "موظفاً":               { en: "employees", ur: "ملازمین", fr: "employés" },
    "غير متصل":            { en: "Offline", ur: "آف لائن", fr: "Hors ligne" },
    "GPS يعمل":            { en: "GPS On", ur: "GPS فعال", fr: "GPS actif" },
    "GPS ضعيف":            { en: "GPS Weak", ur: "GPS کمزور", fr: "GPS faible" },
    "GPS متوقف":           { en: "GPS Off", ur: "GPS بند", fr: "GPS inactif" },
    "تم تسجيل الحضور بنجاح": { en: "Check-in recorded successfully", ur: "حاضری کامیابی سے درج", fr: "Arrivée enregistrée" },
    "تم تسجيل الانصراف بنجاح": { en: "Check-out recorded successfully", ur: "روانگی کامیابی سے درج", fr: "Départ enregistré" },
    "تم تسجيل الحضور ✓":   { en: "Checked in ✓", ur: "حاضری درج ✓", fr: "Arrivée pointée ✓" },
    "تم تسجيل الانصراف ✓": { en: "Checked out ✓", ur: "روانگی درج ✓", fr: "Départ pointé ✓" },
    "بانتظار مراجعة الموارد البشرية": { en: "Awaiting HR review", ur: "ایچ آر کے جائزے کے منتظر", fr: "En attente de vérification RH" },
    "الانصراف":            { en: "Check-out", ur: "روانگی", fr: "Départ" },
    "حضورك وانصرافك اليومي": { en: "Your daily check-in and check-out", ur: "آپ کی روزانہ حاضری اور روانگی", fr: "Vos pointages quotidiens" },
    "تسجيل حضور/انصراف بالموقع والتحقق البيومتري": { en: "Check in/out with location and biometric verification", ur: "مقام اور بایومیٹرک تصدیق کے ساتھ حاضری", fr: "Pointage avec localisation et vérification biométrique" },

    /* الإجازات */
    "الإجازة القادمة":     { en: "Next Leave", ur: "اگلی چھٹی", fr: "Prochain congé" },
    "اختر الإجازة المطلوب تعديلها": { en: "Choose the leave to modify", ur: "ترمیم کے لیے چھٹی منتخب کریں", fr: "Choisissez le congé à modifier" },
    "بيانات الإجازة الحالية": { en: "Current Leave Details", ur: "موجودہ چھٹی کی تفصیل", fr: "Détails du congé actuel" },
    "اختر نوع التعديل":    { en: "Choose the change type", ur: "ترمیم کی قسم منتخب کریں", fr: "Choisissez le type de modification" },
    "أيام مُستخدمة":        { en: "Days Used", ur: "استعمال شدہ دن", fr: "Jours utilisés" },
    "تُعاد للرصيد":         { en: "Returned to Balance", ur: "بیلنس میں واپس", fr: "Recrédités au solde" },
    "مقارنة قبل الإرسال":  { en: "Compare Before Submitting", ur: "بھیجنے سے پہلے موازنہ", fr: "Comparer avant l'envoi" },
    "مقارنة":              { en: "Comparison", ur: "موازنہ", fr: "Comparaison" },
    "تصفية الإجازات":      { en: "Filter Leaves", ur: "چھٹیوں کی چھانٹی", fr: "Filtrer les congés" },
    "حالة الإجازة":        { en: "Leave Status", ur: "چھٹی کی حالت", fr: "Statut du congé" },
    "المعتمدة":            { en: "Approved", ur: "منظور شدہ", fr: "Approuvés" },
    "البداية":             { en: "Start", ur: "آغاز", fr: "Début" },
    "النهاية":             { en: "End", ur: "اختتام", fr: "Fin" },
    "الأيام":              { en: "Days", ur: "دن", fr: "Jours" },
    "أيام":                { en: "days", ur: "دن", fr: "jours" },
    "يوم":                 { en: "day", ur: "دن", fr: "jour" },
    "اعتمدها":             { en: "Approved by", ur: "منظور کنندہ", fr: "Approuvé par" },
    "قُدّم":                { en: "Submitted", ur: "جمع کرائی گئی", fr: "Soumise le" },
    "الرصيد بعدها":        { en: "Balance after", ur: "اس کے بعد بیلنس", fr: "Solde après" },
    "آخر إجراء":           { en: "Last action", ur: "آخری کارروائی", fr: "Dernière action" },
    "سبب الرفض":           { en: "Rejection reason", ur: "مسترد کی وجہ", fr: "Motif du rejet" },
    "سبب الرفض/الإلغاء":   { en: "Rejection / cancellation reason", ur: "مسترد یا منسوخی کی وجہ", fr: "Motif de rejet / annulation" },
    "بانتظار الإجراء":     { en: "Awaiting action", ur: "کارروائی کے منتظر", fr: "En attente d'action" },
    "بلا سقف":             { en: "No cap", ur: "کوئی حد نہیں", fr: "Sans plafond" },
    "إجازات":              { en: "Leaves", ur: "چھٹیاں", fr: "Congés" },
    "استُلمت":              { en: "Received", ur: "وصول شدہ", fr: "Reçu" },
    "تحتاج صيانة":         { en: "Needs Maintenance", ur: "مرمت درکار", fr: "Maintenance requise" },
    "موقَّع من":            { en: "Signed by", ur: "دستخط کنندہ", fr: "Signé par" },
    "موافق عليها":         { en: "Approved", ur: "منظور شدہ", fr: "Approuvée" },
    "إشعارات جديدة":       { en: "new notifications", ur: "نئی اطلاعات", fr: "nouvelles notifications" },
    "تعليم الكل مقروء":    { en: "Mark all as read", ur: "سب پڑھا ہوا نشان زد", fr: "Tout marquer comme lu" },
    "غير مصرح":            { en: "Not authorized", ur: "غیر مجاز", fr: "Non autorisé" },
    "لنفسي":               { en: "For myself", ur: "اپنے لیے", fr: "Pour moi" },
    "متوسط الإنجاز":       { en: "Avg. Completion", ur: "اوسط تکمیل", fr: "Délai moyen" },
    "متوسط الإنجاز (يوم)": { en: "Avg. Completion (days)", ur: "اوسط تکمیل (دن)", fr: "Délai moyen (jours)" },
    "الالتزام بـ SLA":     { en: "SLA Compliance", ur: "SLA کی پابندی", fr: "Respect du SLA" },
    "التزام SLA":          { en: "SLA Compliance", ur: "SLA کی پابندی", fr: "Respect du SLA" },
    "ضمن SLA":             { en: "Within SLA", ur: "SLA کے اندر", fr: "Dans le SLA" },
    "متجاوزة SLA":         { en: "SLA Breached", ur: "SLA سے تجاوز", fr: "SLA dépassé" },
    "🔒 سري":              { en: "🔒 Confidential", ur: "🔒 خفیہ", fr: "🔒 Confidentiel" },
    "دخول التطبيق":        { en: "App Access", ur: "ایپ تک رسائی", fr: "Accès à l'application" },
    "دخول لوحة الإدارة":   { en: "Admin Panel Access", ur: "ایڈمن پینل تک رسائی", fr: "Accès au panneau d'administration" },

    /* رسائل وحالات فارغة */
    "لا توجد تعليقات بعد.": { en: "No comments yet.", ur: "ابھی کوئی تبصرہ نہیں۔", fr: "Aucun commentaire pour l'instant." },
    "لا توجد طلبات.":      { en: "No requests.", ur: "کوئی درخواست نہیں۔", fr: "Aucune demande." },
    "لا توجد اختصارات بعد.": { en: "No shortcuts yet.", ur: "ابھی کوئی شارٹ کٹ نہیں۔", fr: "Aucun raccourci pour l'instant." },
    "لا توجد إجازات قادمة.": { en: "No upcoming leaves.", ur: "کوئی آنے والی چھٹی نہیں۔", fr: "Aucun congé à venir." },
    "لا توجد إجازات معتمدة قابلة للتعديل حاليًا.": { en: "No approved leaves can be modified right now.", ur: "فی الحال کوئی قابلِ ترمیم منظور شدہ چھٹی نہیں۔", fr: "Aucun congé approuvé n'est modifiable actuellement." },
    "لا توجد أرصدة إجازات مخصّصة لك في النظام.": { en: "No leave allocations are assigned to you in the system.", ur: "سسٹم میں آپ کے لیے کوئی چھٹی مختص نہیں۔", fr: "Aucun solde de congés ne vous est attribué dans le système." },
    "لا يوجد موظف مطابق في قسمك.": { en: "No matching employee in your department.", ur: "آپ کے شعبے میں کوئی مماثل ملازم نہیں۔", fr: "Aucun employé correspondant dans votre département." },
    "ليس لديك صلاحية للوصول إلى هذا القسم أو الخدمة.": { en: "You are not authorized to access this section or service.", ur: "آپ کو اس حصے یا خدمت تک رسائی کی اجازت نہیں۔", fr: "Vous n'êtes pas autorisé à accéder à cette section ou à ce service." },
    "يرجى مراجعة مدير النظام لمنحك الصلاحية.": { en: "Please contact the system administrator to be granted access.", ur: "براہِ کرم اجازت کے لیے سسٹم ایڈمنسٹریٹر سے رابطہ کریں۔", fr: "Veuillez contacter l'administrateur système pour obtenir l'accès." },
    "يمكنك الاطلاع على هذه الخدمة، لكن صلاحيتك لا تسمح بإنشاء طلب.": { en: "You may view this service, but your permissions do not allow creating a request.", ur: "آپ یہ خدمت دیکھ سکتے ہیں، مگر درخواست بنانے کی اجازت نہیں۔", fr: "Vous pouvez consulter ce service, mais vos droits ne permettent pas de créer une demande." },
    "هذا الطلب ليس ضمن مهامك الحالية.": { en: "This request is not among your current tasks.", ur: "یہ درخواست آپ کے موجودہ کاموں میں شامل نہیں۔", fr: "Cette demande ne fait pas partie de vos tâches actuelles." },
    "لا يمكن تعديل أو إلغاء هذه الإجازة حسب سياسة الشركة.": { en: "This leave cannot be modified or cancelled under company policy.", ur: "کمپنی پالیسی کے تحت یہ چھٹی تبدیل یا منسوخ نہیں ہو سکتی۔", fr: "Ce congé ne peut être modifié ni annulé selon la politique de l'entreprise." },
    "تم إرسال الطلب بنجاح، وأُشعِر المسؤول.": { en: "Request submitted successfully and the approver was notified.", ur: "درخواست کامیابی سے بھیج دی گئی اور ذمہ دار کو اطلاع دی گئی۔", fr: "Demande envoyée avec succès et le responsable a été notifié." },
    "تم الإنشاء نيابة عن الموظف": { en: "Created on behalf of the employee", ur: "ملازم کی جانب سے بنائی گئی", fr: "Créée au nom de l'employé" },
    "تم إرسال الإشعار للموظف.": { en: "Notification sent to the employee.", ur: "ملازم کو اطلاع بھیج دی گئی۔", fr: "Notification envoyée à l'employé." },
    "تم إرسال التسجيل للمراجعة": { en: "The entry was sent for review", ur: "اندراج جائزے کے لیے بھیج دیا گیا", fr: "L'enregistrement a été envoyé pour examen" },
    "تم طلب معلومات إضافية من الموظف.": { en: "Additional information was requested from the employee.", ur: "ملازم سے مزید معلومات طلب کی گئیں۔", fr: "Des informations complémentaires ont été demandées à l'employé." },
    "تم تصعيد الطلب.":     { en: "The request was escalated.", ur: "درخواست ایسکلیٹ کر دی گئی۔", fr: "La demande a été escaladée." },
    "تم الحفظ كمسودة":     { en: "Saved as draft", ur: "مسودے کے طور پر محفوظ", fr: "Enregistré comme brouillon" },
    "تم رفع اللوجو":       { en: "Logo uploaded", ur: "لوگو اپ لوڈ ہو گیا", fr: "Logo téléversé" },
    "تعذّر إرسال التعليق":  { en: "Could not send the comment", ur: "تبصرہ نہیں بھیجا جا سکا", fr: "Impossible d'envoyer le commentaire" },
    "تعذّر إتمام الرفض.":   { en: "Could not complete the rejection.", ur: "مسترد مکمل نہیں ہو سکا۔", fr: "Impossible de finaliser le rejet." },
    "تعذّر تحميل الإجازات.": { en: "Could not load leaves.", ur: "چھٹیاں لوڈ نہیں ہو سکیں۔", fr: "Impossible de charger les congés." },
    "تسجيل الدخول عبر نفاذ غير متاح حالياً.": { en: "Nafath sign-in is currently unavailable.", ur: "نفاذ سے سائن اِن فی الحال دستیاب نہیں۔", fr: "La connexion via Nafath est indisponible." },
    "جارٍ التحميل…":       { en: "Loading…", ur: "لوڈ ہو رہا ہے…", fr: "Chargement…" },
    "جارٍ…":               { en: "Working…", ur: "جاری…", fr: "En cours…" },
    "جارٍ التطبيق…":       { en: "Applying…", ur: "لاگو ہو رہا ہے…", fr: "Application…" },
    "جارٍ التحليل…":       { en: "Analyzing…", ur: "تجزیہ جاری…", fr: "Analyse…" },
    "جارٍ جلب الأرصدة…":   { en: "Fetching balances…", ur: "بیلنس لایا جا رہا ہے…", fr: "Récupération des soldes…" },
    "جارٍ تحميل إجازاتك من Odoo…": { en: "Loading your leaves from Odoo…", ur: "Odoo سے آپ کی چھٹیاں لوڈ ہو رہی ہیں…", fr: "Chargement de vos congés depuis Odoo…" },
    "جارٍ تحميل إجازاتك المعتمدة…": { en: "Loading your approved leaves…", ur: "منظور شدہ چھٹیاں لوڈ ہو رہی ہیں…", fr: "Chargement de vos congés approuvés…" },
    "الرصيد غير كافٍ: المطلوب": { en: "Insufficient balance: requested", ur: "بیلنس ناکافی: مطلوب", fr: "Solde insuffisant : demandé" },
    "يلزم إرفاق تقرير طبي لهذا النوع.": { en: "A medical report must be attached for this type.", ur: "اس قسم کے لیے طبی رپورٹ منسلک کرنا ضروری ہے۔", fr: "Un rapport médical est requis pour ce type." },
    "سيتاح التنزيل بعد اعتماد الطلب وإصدار الخطاب.": { en: "Download becomes available once the request is approved and the letter is issued.", ur: "درخواست کی منظوری اور خط جاری ہونے کے بعد ڈاؤن لوڈ دستیاب ہوگا۔", fr: "Le téléchargement sera disponible après approbation de la demande et émission de la lettre." },
    "لا يظهر للمدير المباشر ويُحال مباشرة إلى الموارد البشرية.": { en: "Hidden from the direct manager and routed straight to HR.", ur: "براہِ راست منیجر سے پوشیدہ اور سیدھا ایچ آر کو۔", fr: "Masquée au responsable direct et transmise directement aux RH." },
    "تُحدَّث البنود المعتمدة فقط في Odoo، ويُشعَر الموظف بنتيجة كل بند.": { en: "Only approved items are updated in Odoo, and the employee is notified of each outcome.", ur: "صرف منظور شدہ اشیاء Odoo میں اپ ڈیٹ ہوں گی اور ملازم کو ہر نتیجے کی اطلاع دی جائے گی۔", fr: "Seuls les éléments approuvés sont mis à jour dans Odoo, et l'employé est informé de chaque décision." },
    "بيانات للقراءة فقط — لا يمكن تعديلها.": { en: "Read-only data — cannot be edited.", ur: "صرف پڑھنے کے لیے — ترمیم ممکن نہیں۔", fr: "Données en lecture seule — non modifiables." },
    "لا تُخزَّن كلمات المرور كنص صريح.": { en: "Passwords are never stored in plain text.", ur: "پاس ورڈ کبھی سادہ متن میں محفوظ نہیں ہوتے۔", fr: "Les mots de passe ne sont jamais stockés en clair." },
    "لا تُعرض المفاتيح أو كلمة المرور كنص واضح؛ تُدار في الـ Backend.": { en: "Keys and passwords are never shown in plain text; they are managed in the backend.", ur: "کلیدیں اور پاس ورڈ سادہ متن میں نہیں دکھائے جاتے؛ بیک اینڈ میں سنبھالے جاتے ہیں۔", fr: "Les clés et mots de passe ne sont jamais affichés en clair ; ils sont gérés côté serveur." },
    "تُطبَّق الصلاحيات فعلياً على مستوى Backend وليس بإخفاء الأزرار فقط.": { en: "Permissions are enforced in the backend, not merely by hiding buttons.", ur: "اجازتیں بیک اینڈ پر نافذ ہوتی ہیں، محض بٹن چھپانے سے نہیں۔", fr: "Les autorisations sont appliquées côté serveur, pas seulement en masquant des boutons." },
    "الصلاحية الفعلية لأي خدمة = الأقل بين صلاحية تصنيفها وصلاحية الخدمة.": { en: "A service's effective permission is the lower of its category permission and its own.", ur: "کسی خدمت کی مؤثر اجازت = زمرے اور خدمت کی اجازتوں میں سے کم تر۔", fr: "L'autorisation effective d'un service est la plus restrictive entre celle de sa catégorie et la sienne." },
    "لكل خدمة مستوى صلاحية مستقل. أي خدمة جديدة تظهر هنا تلقائياً.": { en: "Each service has its own permission level. Any new service appears here automatically.", ur: "ہر خدمت کی الگ اجازت ہے۔ نئی خدمت خودبخود یہاں آ جائے گی۔", fr: "Chaque service a son propre niveau d'autorisation. Tout nouveau service apparaît ici automatiquement." },
    "ستظهر الخدمة الجديدة تلقائياً في شاشة الصلاحيات.": { en: "The new service will appear automatically in the permissions screen.", ur: "نئی خدمت خودبخود اجازتوں کی اسکرین پر آ جائے گی۔", fr: "Le nouveau service apparaîtra automatiquement dans l'écran des autorisations." },
    "تغييرات غير محفوظة": { en: "Unsaved changes", ur: "غیر محفوظ تبدیلیاں", fr: "Modifications non enregistrées" },
    "توجد تغييرات غير محفوظة": { en: "There are unsaved changes", ur: "غیر محفوظ تبدیلیاں موجود ہیں", fr: "Des modifications ne sont pas enregistrées" },
    "لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظها؟": { en: "You have unsaved changes. Leave without saving?", ur: "غیر محفوظ تبدیلیاں ہیں۔ بغیر محفوظ کیے نکلنا چاہتے ہیں؟", fr: "Vous avez des modifications non enregistrées. Quitter sans enregistrer ?" },
    "هل ترغب بتفعيل الدخول بالبصمة أو Face ID في المرات القادمة؟": { en: "Enable Fingerprint or Face ID sign-in next time?", ur: "اگلی بار فنگر پرنٹ یا Face ID سے سائن اِن فعال کریں؟", fr: "Activer la connexion par empreinte ou Face ID la prochaine fois ?" },
    "اختر نوع الإجازة لفتح النموذج.": { en: "Choose a leave type to open the form.", ur: "فارم کھولنے کے لیے چھٹی کی قسم منتخب کریں۔", fr: "Choisissez un type de congé pour ouvrir le formulaire." },
    "اختر نوع العهدة":     { en: "Choose asset type", ur: "سامان کی قسم منتخب کریں", fr: "Choisissez le type de matériel" },
    "اختر نوع العهدة المطلوبة.": { en: "Choose the asset type you need.", ur: "مطلوبہ سامان کی قسم منتخب کریں۔", fr: "Choisissez le type de matériel souhaité." },
    "اختر نوع العهدة وقدّم الطلب": { en: "Choose an asset type and submit the request", ur: "سامان کی قسم منتخب کر کے درخواست دیں", fr: "Choisissez un type de matériel et soumettez la demande" },
    "اختر نوع الخطاب لتعبئة بياناته.": { en: "Choose a letter type to fill in its details.", ur: "تفصیلات بھرنے کے لیے خط کی قسم منتخب کریں۔", fr: "Choisissez un type de lettre pour renseigner ses informations." },
    "اختر النوع لاعتماده في Odoo": { en: "Choose the type to approve it in Odoo", ur: "Odoo میں منظوری کے لیے قسم منتخب کریں", fr: "Choisissez le type pour l'approuver dans Odoo" },
    "اختر السبب":          { en: "Choose a reason", ur: "وجہ منتخب کریں", fr: "Choisissez un motif" },
    "اختر طريقة التحقق لاعتماد": { en: "Choose a verification method to confirm", ur: "تصدیق کا طریقہ منتخب کریں", fr: "Choisissez une méthode de vérification" },
    "اعتماد كل بند على حدة": { en: "Approve each item separately", ur: "ہر شے الگ الگ منظور کریں", fr: "Approuver chaque élément séparément" },
    "اختر عنصرًا واحدًا أو أكثر لتحديثها في طلب واحد.": { en: "Select one or more items to update them in a single request.", ur: "ایک درخواست میں اپ ڈیٹ کے لیے ایک یا زیادہ اشیاء منتخب کریں۔", fr: "Sélectionnez un ou plusieurs éléments à mettre à jour dans une seule demande." },
    "أقرّ بصحة جميع البيانات المُدخلة.": { en: "I confirm all entered data is correct.", ur: "میں تصدیق کرتا ہوں کہ تمام معلومات درست ہیں۔", fr: "Je certifie l'exactitude de toutes les données saisies." },
    "ابدأ بإضافة خدمات من الأسفل.": { en: "Start by adding services below.", ur: "نیچے سے خدمات شامل کرنا شروع کریں۔", fr: "Commencez par ajouter des services ci-dessous." },
    "معاينة الصفحة الرئيسية": { en: "Home Screen Preview", ur: "ہوم اسکرین کا پیش نظارہ", fr: "Aperçu de l'écran d'accueil" },
    "الخدمات المفضلة وترتيب الصفحة الرئيسية": { en: "Favorite services and home screen order", ur: "پسندیدہ خدمات اور ہوم اسکرین کی ترتیب", fr: "Services favoris et ordre de l'écran d'accueil" },
    "رفع اللوجو وتخصيص ألوان التطبيق": { en: "Upload the logo and customize app colors", ur: "لوگو اپ لوڈ کریں اور ایپ کے رنگ ترتیب دیں", fr: "Téléverser le logo et personnaliser les couleurs" },
    "ارفع اللوجو، وسيستخرج التطبيق ألوان الهوية منه تلقائياً.": { en: "Upload the logo and the app will extract its brand colors automatically.", ur: "لوگو اپ لوڈ کریں، ایپ خودبخود رنگ نکال لے گی۔", fr: "Téléversez le logo : l'application en extraira automatiquement les couleurs." },
    "اضغط لرفع صورة اللوجو (PNG / JPG / SVG)": { en: "Tap to upload the logo (PNG / JPG / SVG)", ur: "لوگو اپ لوڈ کرنے کے لیے دبائیں (PNG / JPG / SVG)", fr: "Appuyez pour téléverser le logo (PNG / JPG / SVG)" },
    "الألوان المستخرجة من اللوجو": { en: "Colors extracted from the logo", ur: "لوگو سے نکالے گئے رنگ", fr: "Couleurs extraites du logo" },
    "اضغط أي لون لجعله اللون المميّز.": { en: "Tap any color to make it the accent color.", ur: "کسی بھی رنگ کو نمایاں رنگ بنانے کے لیے دبائیں۔", fr: "Appuyez sur une couleur pour en faire la couleur d'accent." },
    "اللون الأساسي":       { en: "Primary Color", ur: "بنیادی رنگ", fr: "Couleur principale" },
    "اللون المميّز":        { en: "Accent Color", ur: "نمایاں رنگ", fr: "Couleur d'accent" },
    "زر رئيسي":            { en: "Primary Button", ur: "بنیادی بٹن", fr: "Bouton principal" },
    "مميّز":                { en: "Accent", ur: "نمایاں", fr: "Accent" },
    "اضغط لإرفاق مستند":   { en: "Tap to attach a document", ur: "دستاویز منسلک کرنے کے لیے دبائیں", fr: "Appuyez pour joindre un document" },
    "ارفع PDF / صورة / Word — أو صوّر بالكاميرا": { en: "Upload PDF / image / Word — or take a photo", ur: "PDF / تصویر / Word اپ لوڈ کریں — یا تصویر لیں", fr: "Téléversez un PDF / une image / Word — ou prenez une photo" },
    "ابحث برقم الطلب أو الاسم…": { en: "Search by request number or name…", ur: "درخواست نمبر یا نام سے تلاش کریں…", fr: "Rechercher par numéro de demande ou nom…" },
    "ابحث بالاسم أو الرقم أو الجوال…": { en: "Search by name, number or mobile…", ur: "نام، نمبر یا موبائل سے تلاش کریں…", fr: "Rechercher par nom, numéro ou mobile…" },
    "ابحث باسم الموظف أو الرقم…": { en: "Search by employee name or number…", ur: "ملازم کے نام یا نمبر سے تلاش کریں…", fr: "Rechercher par nom ou numéro d'employé…" },
    "ابحث باسم الموظف أو رقمه…": { en: "Search by employee name or number…", ur: "ملازم کے نام یا نمبر سے تلاش کریں…", fr: "Rechercher par nom ou numéro d'employé…" },
    "لم يتم اختيار الموظف بعد": { en: "No employee selected yet", ur: "ابھی کوئی ملازم منتخب نہیں", fr: "Aucun employé sélectionné" },
    "سجل أخطاء الربط":     { en: "Integration Error Log", ur: "انضمام کی خرابیوں کا ریکارڈ", fr: "Journal des erreurs d'intégration" },
    "عهد مستلمة · صيانة/إرجاع/استبدال": { en: "Received assets · maintenance / return / replacement", ur: "وصول شدہ سامان · مرمت/واپسی/تبدیلی", fr: "Matériel reçu · maintenance / retour / remplacement" },
    "عرض وتنزيل المستندات الصادرة": { en: "View and download issued documents", ur: "جاری کردہ دستاویزات دیکھیں اور ڈاؤن لوڈ کریں", fr: "Consulter et télécharger les documents délivrés" },
    "يُطبع تلقائيًّا على ما تعتمده من خطابات": { en: "Printed automatically on the letters you approve", ur: "آپ کی منظور کردہ خطوط پر خودبخود چھپتا ہے", fr: "Imprimée automatiquement sur les lettres que vous approuvez" },
    "حسب النوع والحالة · SLA · تصدير": { en: "By type and status · SLA · export", ur: "قسم اور حالت کے مطابق · SLA · برآمد", fr: "Par type et statut · SLA · export" },
    "تفاصيل المواقع · خارج النطاق · اشتباه التلاعب": { en: "Location details · out of range · suspected tampering", ur: "مقامات کی تفصیل · حدود سے باہر · چھیڑ چھاڑ کا شبہ", fr: "Détails des lieux · hors zone · fraude suspectée" },
    "القادمة · الحالية · السابقة + المؤشرات": { en: "Upcoming · current · past + indicators", ur: "آنے والی · موجودہ · گزشتہ + اشارے", fr: "À venir · en cours · passés + indicateurs" },
    "الأنواع من hr.leave.type": { en: "Types from hr.leave.type", ur: "اقسام hr.leave.type سے", fr: "Types issus de hr.leave.type" },
    "مدير النظام · إعدادات التطبيق": { en: "System Administrator · App Settings", ur: "سسٹم ایڈمنسٹریٹر · ایپ کی ترتیبات", fr: "Administrateur système · Paramètres de l'application" },
    "صلاحيات التصنيفات الرئيسية": { en: "Main Category Permissions", ur: "بنیادی زمروں کی اجازتیں", fr: "Autorisations des catégories principales" },
    "صلاحيات الخدمات الفرعية": { en: "Sub-service Permissions", ur: "ذیلی خدمات کی اجازتیں", fr: "Autorisations des sous-services" },
    "عملية محفوظة محلياً — ستُرسل عند عودة الإنترنت.": { en: "Saved locally — it will be sent when the connection returns.", ur: "مقامی طور پر محفوظ — انٹرنیٹ آنے پر بھیجا جائے گا۔", fr: "Enregistré localement — sera envoyé au retour de la connexion." },
    "قيد المراجعة الآن":   { en: "Under review now", ur: "ابھی زیر جائزہ", fr: "En cours d'examen" },
    "الفلتر النشط":        { en: "Active filter", ur: "فعال فلٹر", fr: "Filtre actif" },
    "يُنشأ تلقائياً":       { en: "Created automatically", ur: "خودبخود بنتا ہے", fr: "Créé automatiquement" },

    /* ===================================================================
     * الدفعة الرابعة — المسح السابق أغفل ما داخل القوالب `…${}…` والقطع
     * القصيرة، وهي التي بقيت ظاهرة («11 خدمة»، أسماء الخدمات في التصنيفات
     * الأخيرة، صفوف مصفوفة الصلاحيات، ورسائل التحقّق).
     *
     * ما لا يُترجَم عمدًا: أسماء الأشخاص والشركات والبنوك وعناوين الطلبات
     * التجريبية — ترجمة بيانات حقيقية أسوأ من تركها.
     * =================================================================== */

    /* قطع قصيرة تظهر مع أرقام */
    "خدمة":                { en: "services", ur: "خدمات", fr: "services" },
    "طلب":                 { en: "request", ur: "درخواست", fr: "demande" },
    "القسم":               { en: "Department", ur: "شعبہ", fr: "Département" },
    "الساعات":             { en: "Hours", ur: "گھنٹے", fr: "Heures" },
    "عنصر)":               { en: "items)", ur: "اشیاء)", fr: "éléments)" },
    "عادي":                { en: "Normal", ur: "عام", fr: "Normal" },
    "أخرى":                { en: "Other", ur: "دیگر", fr: "Autre" },
    "انتظار":              { en: "Waiting", ur: "انتظار", fr: "Attente" },
    "حاضر":                { en: "Present", ur: "حاضر", fr: "Présent" },
    "غائب":                { en: "Absent", ur: "غیر حاضر", fr: "Absent" },
    "مرضية":               { en: "Sick", ur: "بیماری", fr: "Maladie" },
    "استئذان":             { en: "Permission", ur: "اجازت", fr: "Autorisation" },
    "سلفة":                { en: "Advance", ur: "ایڈوانس", fr: "Avance" },
    "اعتُمد":               { en: "Approved", ur: "منظور", fr: "Approuvé" },
    "رُفض":                 { en: "Rejected", ur: "مسترد", fr: "Rejeté" },
    "لم يسجل حضوراً":       { en: "No check-in", ur: "حاضری درج نہیں", fr: "Sans pointage d'arrivée" },
    "لم يسجل انصرافاً":     { en: "No check-out", ur: "روانگی درج نہیں", fr: "Sans pointage de départ" },
    "جميع الموظفين":       { en: "All Employees", ur: "تمام ملازمین", fr: "Tous les employés" },
    "الموظفون":            { en: "Employees", ur: "ملازمین", fr: "Employés" },
    "لأحد موظفي فريقي":    { en: "For a member of my team", ur: "میری ٹیم کے کسی رکن کے لیے", fr: "Pour un membre de mon équipe" },

    /* خدمات: النقل والتغييرات */
    "نقل إلى قسم آخر":     { en: "Transfer to Another Department", ur: "دوسرے شعبے میں تبادلہ", fr: "Mutation vers un autre département" },
    "نقل إلى فرع آخر":     { en: "Transfer to Another Branch", ur: "دوسری برانچ میں تبادلہ", fr: "Mutation vers une autre agence" },
    "تغيير المسمى الوظيفي": { en: "Change Job Title", ur: "عہدے کی تبدیلی", fr: "Changement d'intitulé de poste" },
    "تغيير المدير المباشر": { en: "Change Direct Manager", ur: "براہِ راست منیجر کی تبدیلی", fr: "Changement de responsable direct" },
    "ترقية":               { en: "Promotion", ur: "ترقی", fr: "Promotion" },
    "تجديد عقد":           { en: "Contract Renewal", ur: "معاہدے کی تجدید", fr: "Renouvellement de contrat" },
    "تعديل بيانات العقد":  { en: "Amend Contract Details", ur: "معاہدے کی تفصیل میں ترمیم", fr: "Modifier les données du contrat" },

    /* خدمات: البيانات الشخصية */
    "تحديث رقم الجوال":    { en: "Update Mobile Number", ur: "موبائل نمبر اپ ڈیٹ", fr: "Mettre à jour le mobile" },
    "تحديث البريد الإلكتروني": { en: "Update Email", ur: "ای میل اپ ڈیٹ", fr: "Mettre à jour l'e-mail" },
    "تحديث العنوان":       { en: "Update Address", ur: "پتہ اپ ڈیٹ", fr: "Mettre à jour l'adresse" },
    "تحديث الحساب البنكي": { en: "Update Bank Account", ur: "بینک اکاؤنٹ اپ ڈیٹ", fr: "Mettre à jour le compte bancaire" },
    "تحديث رقم الآيبان":   { en: "Update IBAN", ur: "IBAN اپ ڈیٹ", fr: "Mettre à jour l'IBAN" },
    "تحديث بيانات الهوية": { en: "Update ID Details", ur: "شناختی معلومات اپ ڈیٹ", fr: "Mettre à jour la pièce d'identité" },
    "تصحيح بيانات الموظف": { en: "Correct Employee Data", ur: "ملازم کی معلومات درست کریں", fr: "Corriger les données de l'employé" },
    "بيانات الاتصال":      { en: "Contact Details", ur: "رابطہ معلومات", fr: "Coordonnées" },
    "البريد الإلكتروني":   { en: "Email", ur: "ای میل", fr: "E-mail" },
    "العنوان":             { en: "Address", ur: "پتہ", fr: "Adresse" },
    "جهة اتصال الطوارئ":   { en: "Emergency Contact", ur: "ہنگامی رابطہ", fr: "Contact d'urgence" },
    "البيانات البنكية":    { en: "Bank Details", ur: "بینک تفصیلات", fr: "Coordonnées bancaires" },
    "رقم الحساب":          { en: "Account Number", ur: "اکاؤنٹ نمبر", fr: "Numéro de compte" },
    "رقم الآيبان":         { en: "IBAN", ur: "IBAN", fr: "IBAN" },
    "رقم الآيبان الجديد":  { en: "New IBAN", ur: "نیا IBAN", fr: "Nouvel IBAN" },
    "تأكيد رقم الآيبان":   { en: "Confirm IBAN", ur: "IBAN کی تصدیق", fr: "Confirmer l'IBAN" },
    "شهادة الآيبان":       { en: "IBAN Certificate", ur: "IBAN سرٹیفکیٹ", fr: "Attestation d'IBAN" },
    "مستند البنك":         { en: "Bank Document", ur: "بینک دستاویز", fr: "Document bancaire" },
    "الهوية والإقامة":     { en: "ID & Residency", ur: "شناخت اور اقامہ", fr: "Identité et résidence" },
    "صورة الهوية":         { en: "ID Photo", ur: "شناختی کارڈ کی تصویر", fr: "Photo de la pièce d'identité" },
    "رقم الهوية الجديد":   { en: "New ID Number", ur: "نیا شناختی نمبر", fr: "Nouveau numéro d'identité" },
    "رقم الهوية (إن وجد)": { en: "ID Number (if any)", ur: "شناختی نمبر (اگر ہو)", fr: "Numéro d'identité (le cas échéant)" },
    "مستند الإثبات":       { en: "Supporting Document", ur: "ثبوتی دستاویز", fr: "Justificatif" },
    "مرفق داعم":           { en: "Supporting Attachment", ur: "معاون منسلکہ", fr: "Pièce justificative" },
    "البيانات العائلية":   { en: "Family Details", ur: "خاندانی معلومات", fr: "Situation familiale" },
    "إضافة تابع":          { en: "Add Dependent", ur: "زیرِ کفالت شامل کریں", fr: "Ajouter un ayant droit" },
    "الحالة الاجتماعية الجديدة": { en: "New Marital Status", ur: "نئی ازدواجی حیثیت", fr: "Nouvelle situation matrimoniale" },
    "أعزب/عزباء":          { en: "Single", ur: "غیر شادی شدہ", fr: "Célibataire" },
    "متزوج/متزوجة":        { en: "Married", ur: "شادی شدہ", fr: "Marié(e)" },
    "مطلق/مطلقة":          { en: "Divorced", ur: "طلاق یافتہ", fr: "Divorcé(e)" },
    "أرمل/أرملة":          { en: "Widowed", ur: "بیوہ/رنڈوا", fr: "Veuf/Veuve" },
    "شهادة الميلاد":       { en: "Birth Certificate", ur: "پیدائش کا سرٹیفکیٹ", fr: "Acte de naissance" },
    "اسم المولود":         { en: "Newborn's Name", ur: "نومولود کا نام", fr: "Nom du nouveau-né" },
    "ذكر":                 { en: "Male", ur: "مرد", fr: "Masculin" },
    "أنثى":                { en: "Female", ur: "عورت", fr: "Féminin" },
    "البيانات الوظيفية":   { en: "Employment Details", ur: "ملازمت کی معلومات", fr: "Données professionnelles" },
    "تصحيح الاسم":         { en: "Correct Name", ur: "نام درست کریں", fr: "Corriger le nom" },
    "تصحيح المسمى الوظيفي": { en: "Correct Job Title", ur: "عہدہ درست کریں", fr: "Corriger l'intitulé du poste" },
    "تصحيح القسم":         { en: "Correct Department", ur: "شعبہ درست کریں", fr: "Corriger le département" },
    "تعديل آخر":           { en: "Other Change", ur: "دیگر ترمیم", fr: "Autre modification" },
    "طلب تحديث موحّد":      { en: "Combined Update Request", ur: "مشترکہ اپ ڈیٹ درخواست", fr: "Demande de mise à jour groupée" },

    /* خدمات: التدريب والتأمين والشكاوى وإنهاء الخدمة */
    "دورة تدريبية":        { en: "Training Course", ur: "تربیتی کورس", fr: "Formation" },
    "حضور مؤتمر":          { en: "Conference Attendance", ur: "کانفرنس میں شرکت", fr: "Participation à une conférence" },
    "ورشة عمل":            { en: "Workshop", ur: "ورکشاپ", fr: "Atelier" },
    "شهادة مهنية":         { en: "Professional Certificate", ur: "پیشہ ورانہ سرٹیفکیٹ", fr: "Certification professionnelle" },
    "اعتماد شهادة":        { en: "Certificate Accreditation", ur: "سرٹیفکیٹ کی توثیق", fr: "Validation de certificat" },
    "تعويض رسوم تدريب":    { en: "Training Fee Reimbursement", ur: "تربیتی فیس کی واپسی", fr: "Remboursement de frais de formation" },
    "إضافة تابع للتأمين":  { en: "Add Dependent to Insurance", ur: "انشورنس میں زیرِ کفالت شامل کریں", fr: "Ajouter un ayant droit à l'assurance" },
    "حذف تابع":            { en: "Remove Dependent", ur: "زیرِ کفالت حذف کریں", fr: "Retirer un ayant droit" },
    "تعديل فئة التأمين":   { en: "Change Insurance Class", ur: "انشورنس کلاس کی تبدیلی", fr: "Modifier la classe d'assurance" },
    "بطاقة تأمين":         { en: "Insurance Card", ur: "انشورنس کارڈ", fr: "Carte d'assurance" },
    "خطاب تأمين":          { en: "Insurance Letter", ur: "انشورنس خط", fr: "Attestation d'assurance" },
    "شكوى وظيفية":         { en: "Workplace Complaint", ur: "ملازمت سے متعلق شکایت", fr: "Réclamation professionnelle" },
    "تظلم":                { en: "Grievance", ur: "شکایت", fr: "Recours" },
    "شكوى على إجراء إداري": { en: "Complaint About an Administrative Action", ur: "انتظامی کارروائی پر شکایت", fr: "Réclamation contre une décision administrative" },
    "بلاغ سري":            { en: "Confidential Report", ur: "خفیہ رپورٹ", fr: "Signalement confidentiel" },
    "اقتراح تطوير":        { en: "Improvement Suggestion", ur: "بہتری کی تجویز", fr: "Suggestion d'amélioration" },
    "طلب مقابلة مع الموارد البشرية": { en: "Request an HR Meeting", ur: "ایچ آر سے ملاقات کی درخواست", fr: "Demander un entretien RH" },
    "عدم تجديد عقد":       { en: "Non-renewal of Contract", ur: "معاہدہ تجدید نہ کرنا", fr: "Non-renouvellement du contrat" },
    "تقاعد":               { en: "Retirement", ur: "ریٹائرمنٹ", fr: "Retraite" },
    "إخلاء طرف":           { en: "Clearance", ur: "کلیئرنس", fr: "Quitus" },
    "مستحقات نهاية الخدمة": { en: "End-of-Service Benefits", ur: "اختتامِ خدمت کے واجبات", fr: "Indemnités de fin de service" },
    "سحب استقالة":         { en: "Withdraw Resignation", ur: "استعفیٰ واپس لینا", fr: "Retrait de démission" },
    "طلب موارد بشرية عام": { en: "General HR Request", ur: "عام ایچ آر درخواست", fr: "Demande RH générale" },

    /* أنواع العهد */
    "جهاز كمبيوتر":        { en: "Computer", ur: "کمپیوٹر", fr: "Ordinateur" },
    "جهاز كمبيوتر محمول":  { en: "Laptop", ur: "لیپ ٹاپ", fr: "Ordinateur portable" },
    "جهاز مكتبي":          { en: "Desktop", ur: "ڈیسک ٹاپ", fr: "Ordinateur de bureau" },
    "شاشة":                { en: "Monitor", ur: "مانیٹر", fr: "Écran" },
    "هاتف":                { en: "Phone", ur: "فون", fr: "Téléphone" },
    "هاتف جوال":           { en: "Mobile Phone", ur: "موبائل فون", fr: "Téléphone mobile" },
    "جهاز لوحي":           { en: "Tablet", ur: "ٹیبلٹ", fr: "Tablette" },
    "سيارة":               { en: "Vehicle", ur: "گاڑی", fr: "Véhicule" },
    "مفتاح":               { en: "Key", ur: "چابی", fr: "Clé" },
    "بطاقة دخول":          { en: "Access Card", ur: "رسائی کارڈ", fr: "Badge d'accès" },
    "أثاث مكتبي":          { en: "Office Furniture", ur: "دفتری فرنیچر", fr: "Mobilier de bureau" },
    "أدوات عمل":           { en: "Work Tools", ur: "کام کے اوزار", fr: "Outils de travail" },
    "زي وظيفي":            { en: "Uniform", ur: "یونیفارم", fr: "Uniforme" },
    "معدات سلامة":         { en: "Safety Equipment", ur: "حفاظتی سامان", fr: "Équipement de sécurité" },
    "معدات تقنية":         { en: "IT Equipment", ur: "آئی ٹی سامان", fr: "Équipement informatique" },
    "عهدة مالية":          { en: "Cash Custody", ur: "نقد تحویل", fr: "Fonds confiés" },
    "خدمات العهد":         { en: "Asset Services", ur: "سامان کی خدمات", fr: "Services matériels" },
    "اختيار نوع العهدة":   { en: "Choose Asset Type", ur: "سامان کی قسم منتخب کریں", fr: "Choisir le type de matériel" },
    "عهدي الحالية":        { en: "My Current Assets", ur: "میرا موجودہ سامان", fr: "Mon matériel actuel" },
    "مدة الاستخدام":       { en: "Usage Period", ur: "استعمال کی مدت", fr: "Durée d'utilisation" },
    "تاريخ الإرجاع المتوقع": { en: "Expected Return Date", ur: "متوقع واپسی کی تاریخ", fr: "Date de retour prévue" },

    /* مصفوفة الصلاحيات — بقية الصفوف */
    "عرض طلبات موظفيه":    { en: "View Their Employees' Requests", ur: "اپنے ملازمین کی درخواستیں دیکھیں", fr: "Voir les demandes de ses employés" },
    "عرض جميع الطلبات":    { en: "View All Requests", ur: "تمام درخواستیں دیکھیں", fr: "Voir toutes les demandes" },
    "اعتماد طلب":          { en: "Approve a Request", ur: "درخواست منظور کریں", fr: "Approuver une demande" },
    "رفض طلب":             { en: "Reject a Request", ur: "درخواست مسترد کریں", fr: "Rejeter une demande" },
    "إعادة فتح طلب مغلق":  { en: "Reopen a Closed Request", ur: "بند درخواست دوبارہ کھولیں", fr: "Rouvrir une demande clôturée" },
    "مشاهدة الطلبات السرية": { en: "View Confidential Requests", ur: "خفیہ درخواستیں دیکھیں", fr: "Consulter les demandes confidentielles" },
    "عرض موظفي القسم":     { en: "View Department Employees", ur: "شعبے کے ملازمین دیکھیں", fr: "Voir les employés du département" },
    "عرض جميع الموظفين":   { en: "View All Employees", ur: "تمام ملازمین دیکھیں", fr: "Voir tous les employés" },
    "الاطلاع على العقود":  { en: "View Contracts", ur: "معاہدے دیکھیں", fr: "Consulter les contrats" },
    "الحضور والانصراف":    { en: "Check-in & Check-out", ur: "حاضری اور روانگی", fr: "Arrivées et départs" },
    "عرض حضور موظفيه":     { en: "View Their Employees' Attendance", ur: "اپنے ملازمین کی حاضری دیکھیں", fr: "Voir la présence de ses employés" },
    "تسجيل حضور موظف":     { en: "Record Employee Attendance", ur: "ملازم کی حاضری درج کریں", fr: "Enregistrer la présence d'un employé" },
    "تصحيح سجل حضور":      { en: "Correct an Attendance Record", ur: "حاضری کا ریکارڈ درست کریں", fr: "Corriger un enregistrement de présence" },
    "اعتماد تصحيح حضور":   { en: "Approve Attendance Correction", ur: "حاضری کی درستی منظور کریں", fr: "Approuver une correction de présence" },
    "عرض تقارير الحضور":   { en: "View Attendance Reports", ur: "حاضری رپورٹس دیکھیں", fr: "Voir les rapports de présence" },
    "اعتماد إجازة":        { en: "Approve Leave", ur: "چھٹی منظور کریں", fr: "Approuver un congé" },
    "تعديل الرصيد":        { en: "Adjust Balance", ur: "بیلنس میں ترمیم", fr: "Ajuster le solde" },
    "عرض إجازات الفريق":   { en: "View Team Leaves", ur: "ٹیم کی چھٹیاں دیکھیں", fr: "Voir les congés de l'équipe" },
    "إدارة الفريق (مدير القسم)": { en: "Team Management (Department Manager)", ur: "ٹیم کا انتظام (شعبہ منیجر)", fr: "Gestion d'équipe (chef de département)" },
    "إدارة الصلاحيات":     { en: "Manage Permissions", ur: "اجازتوں کا انتظام", fr: "Gérer les autorisations" },
    "إدارة أنواع الطلبات": { en: "Manage Request Types", ur: "درخواست اقسام کا انتظام", fr: "Gérer les types de demandes" },
    "إدارة Workflow":      { en: "Manage Workflow", ur: "ورک فلو کا انتظام", fr: "Gérer le workflow" },
    "إدارة الهوية والألوان": { en: "Manage Branding & Colors", ur: "برانڈنگ اور رنگوں کا انتظام", fr: "Gérer l'identité et les couleurs" },
    "إدارة التكامل مع Odoo": { en: "Manage Odoo Integration", ur: "Odoo انضمام کا انتظام", fr: "Gérer l'intégration Odoo" },
    "عرض Audit Log":       { en: "View Audit Log", ur: "آڈٹ لاگ دیکھیں", fr: "Consulter le journal d'audit" },
    "إدارة الخدمات":       { en: "Manage Services", ur: "خدمات کا انتظام", fr: "Gérer les services" },
    "بيانات الموظف":       { en: "Employee Data", ur: "ملازم کی معلومات", fr: "Données de l'employé" },
    "الحضور والإجازة":     { en: "Attendance & Leave", ur: "حاضری اور چھٹی", fr: "Présence et congés" },
    "الرواتب":             { en: "Payroll", ur: "تنخواہیں", fr: "Paie" },
    "إدارة الموارد البشرية": { en: "HR Management", ur: "ایچ آر کا انتظام", fr: "Gestion RH" },

    /* رسائل التحقّق قبل الإرسال */
    "يرجى الإقرار بصحة البيانات قبل الإرسال.": { en: "Please confirm the data is correct before submitting.", ur: "بھیجنے سے پہلے معلومات کی درستی کی تصدیق کریں۔", fr: "Veuillez confirmer l'exactitude des données avant l'envoi." },
    "يرجى اختيار الموظف من فريقك.": { en: "Please choose an employee from your team.", ur: "براہِ کرم اپنی ٹیم سے ملازم منتخب کریں۔", fr: "Veuillez choisir un employé de votre équipe." },
    "يرجى اختيار الموظف من فريقك أولاً.": { en: "Please choose an employee from your team first.", ur: "پہلے اپنی ٹیم سے ملازم منتخب کریں۔", fr: "Veuillez d'abord choisir un employé de votre équipe." },
    "لا يمكن إنشاء طلب لموظف من خارج قسمك.": { en: "You cannot create a request for an employee outside your department.", ur: "اپنے شعبے سے باہر کے ملازم کے لیے درخواست نہیں بنا سکتے۔", fr: "Vous ne pouvez pas créer de demande pour un employé hors de votre département." },
    "تعذّر تحديد نوع الإجازة. يرجى الرجوع واختيار النوع من شاشة الإجازات.": { en: "Leave type could not be determined. Go back and choose it from the Leaves screen.", ur: "چھٹی کی قسم متعین نہ ہو سکی۔ واپس جا کر چھٹیوں کی اسکرین سے منتخب کریں۔", fr: "Type de congé indéterminé. Revenez et choisissez-le depuis l'écran des congés." },
    "يرجى تحديد تاريخ بداية ونهاية الإجازة قبل إرسال الطلب.": { en: "Please set the leave start and end dates before submitting.", ur: "درخواست بھیجنے سے پہلے چھٹی کی آغاز و اختتام کی تاریخ متعین کریں۔", fr: "Veuillez indiquer les dates de début et de fin avant l'envoi." },
    "يرجى كتابة سبب الإجازة.": { en: "Please state the reason for the leave.", ur: "براہِ کرم چھٹی کی وجہ لکھیں۔", fr: "Veuillez indiquer le motif du congé." },
    "الإجازة المرضية تتطلب إرفاق تقرير طبي.": { en: "Sick leave requires a medical report attachment.", ur: "بیماری کی چھٹی کے لیے طبی رپورٹ لازم ہے۔", fr: "Le congé maladie exige un rapport médical." },
    "يرجى تحديد نوع العهدة.": { en: "Please select the asset type.", ur: "براہِ کرم سامان کی قسم منتخب کریں۔", fr: "Veuillez sélectionner le type de matériel." },
    "يرجى تحديد تاريخ الاحتياج.": { en: "Please set the date needed.", ur: "براہِ کرم ضرورت کی تاریخ متعین کریں۔", fr: "Veuillez indiquer la date de besoin." },
    "يرجى كتابة سبب الطلب.": { en: "Please state the reason for the request.", ur: "براہِ کرم درخواست کی وجہ لکھیں۔", fr: "Veuillez indiquer le motif de la demande." },
    "يرجى إدخال اسم المستخدم وكلمة المرور.": { en: "Please enter your username and password.", ur: "براہِ کرم صارف نام اور پاس ورڈ درج کریں۔", fr: "Veuillez saisir votre identifiant et mot de passe." },
    "تعذّر تسجيل الدخول. تحقق من البيانات ثم حاول مرة أخرى.": { en: "Sign-in failed. Check your details and try again.", ur: "سائن اِن ناکام۔ معلومات دیکھ کر دوبارہ کوشش کریں۔", fr: "Échec de connexion. Vérifiez vos informations et réessayez." },
    "تعذّر الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى.": { en: "Could not reach the server. Check your network and try again.", ur: "سرور سے رابطہ نہ ہو سکا۔ نیٹ ورک دیکھ کر دوبارہ کوشش کریں۔", fr: "Serveur injoignable. Vérifiez votre réseau et réessayez." },
    "بيانات الدخول غير صحيحة أو الحساب موقوف.": { en: "Invalid credentials or the account is suspended.", ur: "غلط معلومات یا اکاؤنٹ معطل ہے۔", fr: "Identifiants invalides ou compte suspendu." },
    "تعذّر إرسال الطلب": { en: "Could not submit the request", ur: "درخواست نہیں بھیجی جا سکی", fr: "Impossible d'envoyer la demande" },
    "الرصيد غير كافٍ وتعارض مع فترة الجرد": { en: "Insufficient balance and conflict with the stocktaking period", ur: "بیلنس ناکافی اور اسٹاک ٹیکنگ کی مدت سے ٹکراؤ", fr: "Solde insuffisant et conflit avec la période d'inventaire" },

    /* شاشات الدخول والحساب */
    "اسم المستخدم / البريد الإلكتروني": { en: "Username / Email", ur: "صارف نام / ای میل", fr: "Identifiant / E-mail" },
    "كلمة المرور":         { en: "Password", ur: "پاس ورڈ", fr: "Mot de passe" },
    "جارٍ تسجيل الدخول…":  { en: "Signing in…", ur: "سائن اِن ہو رہا ہے…", fr: "Connexion…" },
    "بصمة الإصبع":         { en: "Fingerprint", ur: "فنگر پرنٹ", fr: "Empreinte digitale" },
    "تُستخدم مصادقة الجهاز القياسية (WebAuthn) دون تخزين بيانات البصمة داخل التطبيق.": { en: "Standard device authentication (WebAuthn) is used; no biometric data is stored in the app.", ur: "معیاری ڈیوائس تصدیق (WebAuthn) استعمال ہوتی ہے؛ بایومیٹرک ڈیٹا ایپ میں محفوظ نہیں ہوتا۔", fr: "L'authentification standard de l'appareil (WebAuthn) est utilisée ; aucune donnée biométrique n'est stockée dans l'application." },
    "اضغط لتغيير الصورة":  { en: "Tap to change the photo", ur: "تصویر بدلنے کے لیے دبائیں", fr: "Appuyez pour changer la photo" },
    "اكتب تفاصيل الطلب…":  { en: "Write the request details…", ur: "درخواست کی تفصیل لکھیں…", fr: "Décrivez la demande…" },
    "عنوان الطلب":         { en: "Request Title", ur: "درخواست کا عنوان", fr: "Objet de la demande" },
    "الموقع غير محدد":     { en: "Location not set", ur: "مقام متعین نہیں", fr: "Localisation non définie" },
    "تعذّر التحديد":        { en: "Could not determine", ur: "تعین نہ ہو سکا", fr: "Détermination impossible" },
    "تحقق من الموقع":      { en: "Verify Location", ur: "مقام کی تصدیق", fr: "Vérifier la localisation" },
    "اكتمل دوام اليوم":    { en: "Today's shift is complete", ur: "آج کا دورانیہ مکمل", fr: "Journée de travail terminée" },
    "لم يتم تسجيل الحضور بعد": { en: "Not checked in yet", ur: "ابھی حاضری درج نہیں", fr: "Pas encore pointé" },
    "تم التسجيل":          { en: "Recorded", ur: "درج ہو گیا", fr: "Enregistré" },
    "تم تسجيل الحضور":     { en: "Check-in recorded", ur: "حاضری درج ہو گئی", fr: "Arrivée enregistrée" },
    "تم تقديم تسجيل حضور يدوي": { en: "A manual attendance entry was submitted", ur: "دستی حاضری کا اندراج جمع ہوا", fr: "Un pointage manuel a été soumis" },
    "الوردية الصباحية":    { en: "Morning Shift", ur: "صبح کی شفٹ", fr: "Équipe du matin" },
    "الأحد – الخميس":      { en: "Sunday – Thursday", ur: "اتوار – جمعرات", fr: "Dimanche – Jeudi" },
    "مثال: الأحد – الخميس": { en: "e.g. Sunday – Thursday", ur: "مثلاً اتوار – جمعرات", fr: "ex. Dimanche – Jeudi" },

    /* شاشات الخدمات والطلبات */
    "طلب إجازة وتعديلها وأنواعها": { en: "Request, modify and browse leave types", ur: "چھٹی کی درخواست، ترمیم اور اقسام", fr: "Demander, modifier et consulter les types de congés" },
    "طلب عهدة جديدة وإدارة عهدك": { en: "Request new assets and manage yours", ur: "نیا سامان طلب کریں اور اپنا سامان سنبھالیں", fr: "Demander du matériel et gérer le vôtre" },
    "تحديث بياناتك الشخصية والوظيفية": { en: "Update your personal and employment data", ur: "اپنی ذاتی اور ملازمتی معلومات اپ ڈیٹ کریں", fr: "Mettre à jour vos données personnelles et professionnelles" },
    "تصحيح الحضور والاستئذان والورديات": { en: "Attendance corrections, permissions and shifts", ur: "حاضری کی درستی، اجازت اور شفٹیں", fr: "Corrections de présence, autorisations et équipes" },
    "طلب الخطابات والشهادات الرسمية": { en: "Request official letters and certificates", ur: "سرکاری خطوط اور اسناد کی درخواست", fr: "Demander des lettres et attestations officielles" },
    "لا توجد خدمات مطابقة لبحثك.": { en: "No services match your search.", ur: "آپ کی تلاش سے کوئی خدمت مماثل نہیں۔", fr: "Aucun service ne correspond à votre recherche." },
    "لا توجد خدمات متاحة في هذا التصنيف.": { en: "No services available in this category.", ur: "اس زمرے میں کوئی خدمت دستیاب نہیں۔", fr: "Aucun service disponible dans cette catégorie." },
    "طلباتي تحت الإجراء":  { en: "My Requests in Progress", ur: "میری زیرِ عمل درخواستیں", fr: "Mes demandes en cours" },
    "الطلبات الموافق عليها": { en: "Approved Requests", ur: "منظور شدہ درخواستیں", fr: "Demandes approuvées" },
    "الطلبات المرفوضة":    { en: "Rejected Requests", ur: "مسترد درخواستیں", fr: "Demandes rejetées" },
    "طلبات تنتظر موافقتي": { en: "Requests Awaiting My Approval", ur: "میری منظوری کے منتظر درخواستیں", fr: "Demandes en attente de mon approbation" },
    "تفاصيل الإجازة":      { en: "Leave Details", ur: "چھٹی کی تفصیل", fr: "Détails du congé" },
    "طلب تعديل إجازة معتمدة": { en: "Approved Leave Modification Request", ur: "منظور شدہ چھٹی میں ترمیم کی درخواست", fr: "Demande de modification d'un congé approuvé" },
    "إشعار من مدير القسم": { en: "Notification from the Department Manager", ur: "شعبہ منیجر کی اطلاع", fr: "Notification du chef de département" },
    "إنشاء الطلب":         { en: "Request created", ur: "درخواست بنائی گئی", fr: "Demande créée" },
    "إنشاء الطلب نيابة عن الموظف": { en: "Request created on behalf of the employee", ur: "ملازم کی جانب سے درخواست بنائی گئی", fr: "Demande créée au nom de l'employé" },
    "إضافة تعليق":         { en: "Comment added", ur: "تبصرہ شامل کیا گیا", fr: "Commentaire ajouté" },
    "معالجة تحديث البيانات": { en: "Data update processed", ur: "معلومات کی اپ ڈیٹ پر کارروائی", fr: "Mise à jour des données traitée" },
    "تم تنفيذ طلبك وإغلاقه": { en: "Your request was completed and closed", ur: "آپ کی درخواست مکمل اور بند ہو گئی", fr: "Votre demande a été traitée et clôturée" },
    "تمت الموافقة على مرحلة من طلبك": { en: "A stage of your request was approved", ur: "آپ کی درخواست کا ایک مرحلہ منظور ہوا", fr: "Une étape de votre demande a été approuvée" },

    /* الخطابات والتوقيع */
    "جارٍ جلب الخطابات…":  { en: "Fetching letters…", ur: "خطوط لائے جا رہے ہیں…", fr: "Récupération des lettres…" },
    "لا توجد خطابات صادرة بعد. قدّم طلب خطاب من الخدمات.": { en: "No letters issued yet. Submit a letter request from Services.", ur: "ابھی کوئی خط جاری نہیں۔ خدمات سے خط کی درخواست دیں۔", fr: "Aucune lettre émise. Faites une demande depuis les Services." },
    "إعادة التوقيع":       { en: "Re-sign", ur: "دوبارہ دستخط", fr: "Signer à nouveau" },
    "اعتماد بالتوقيع":     { en: "Approve with signature", ur: "دستخط کے ساتھ منظوری", fr: "Approbation avec signature" },
    "اعتماد التوقيع":      { en: "Confirm Signature", ur: "دستخط کی تصدیق", fr: "Valider la signature" },
    "اعتماد الطلب بالتوقيع": { en: "Approve Request with Signature", ur: "دستخط کے ساتھ درخواست منظور کریں", fr: "Approuver la demande avec signature" },
    "جارٍ الاعتماد…":      { en: "Approving…", ur: "منظوری جاری…", fr: "Approbation…" },
    "جارٍ الحفظ…":         { en: "Saving…", ur: "محفوظ ہو رہا ہے…", fr: "Enregistrement…" },
    "تعذّر حفظ التوقيع":    { en: "Could not save the signature", ur: "دستخط محفوظ نہ ہو سکا", fr: "Impossible d'enregistrer la signature" },
    "ارسم التوقيع أو ارفع صورته أولًا.": { en: "Draw your signature or upload an image first.", ur: "پہلے دستخط بنائیں یا تصویر اپ لوڈ کریں۔", fr: "Dessinez votre signature ou téléversez une image d'abord." },
    "(المعروض الآن هو توقيعك المحفوظ)": { en: "(showing your saved signature)", ur: "(آپ کا محفوظ دستخط دکھایا جا رہا ہے)", fr: "(votre signature enregistrée est affichée)" },
    "حجم الصورة كبير — الحد 2 ميجابايت": { en: "Image too large — 2 MB limit", ur: "تصویر بہت بڑی — حد 2 میگابائٹ", fr: "Image trop volumineuse — limite de 2 Mo" },
    "لم يعد هذا التعميم متاحًا.": { en: "This announcement is no longer available.", ur: "یہ اعلان اب دستیاب نہیں۔", fr: "Cette annonce n'est plus disponible." },
    "لا توجد تعاميم منشورة.": { en: "No published announcements.", ur: "کوئی شائع شدہ اعلان نہیں۔", fr: "Aucune annonce publiée." },
    "عرض جميع الإجازات ←": { en: "View all leaves →", ur: "تمام چھٹیاں دیکھیں ←", fr: "Voir tous les congés →" },
    "يوم والمتاح":         { en: "days, available", ur: "دن، دستیاب", fr: "jours, disponible" },
    "فقط.":                { en: "only.", ur: "صرف۔", fr: "seulement." },
    "لدى":                 { en: "with", ur: "کے پاس", fr: "chez" },
    "يتضمّن الراتب؟":       { en: "Include salary?", ur: "تنخواہ شامل کریں؟", fr: "Inclure le salaire ?" },
    "تأكيد القيمة":        { en: "Confirm Value", ur: "قیمت کی تصدیق", fr: "Confirmer la valeur" },

    /* ===================================================================
     * الدفعة الخامسة والأخيرة — كل ما بقي من نصّ واجهة حقيقي.
     * المستثنى عمدًا بعدها: أسماء الأشخاص والشركات والبنوك وعناوين
     * الطلبات والإشعارات التجريبية (بيانات لا واجهة).
     * =================================================================== */

    /* عام */
    "الخدمة":              { en: "Service", ur: "خدمت", fr: "Service" },
    "تصحيح":               { en: "Correction", ur: "درستی", fr: "Correction" },
    "التقدّم":              { en: "Progress", ur: "پیش رفت", fr: "Progression" },
    "معتمد":               { en: "Approved", ur: "منظور شدہ", fr: "Approuvé" },
    "مرفوض":               { en: "Rejected", ur: "مسترد", fr: "Rejeté" },
    "لا شيء":              { en: "None", ur: "کچھ نہیں", fr: "Aucun" },
    "لا توجد":             { en: "None", ur: "کوئی نہیں", fr: "Aucune" },
    "منتهية":              { en: "Ended", ur: "ختم شدہ", fr: "Terminés" },
    "قادمة":               { en: "Upcoming", ur: "آنے والی", fr: "À venir" },
    "جارية":               { en: "Ongoing", ur: "جاری", fr: "En cours" },
    "الجارية":             { en: "Ongoing", ur: "جاری", fr: "En cours" },
    "سابقة":               { en: "Past", ur: "گزشتہ", fr: "Passés" },
    "السنة":               { en: "Year", ur: "سال", fr: "Année" },
    "ساعة":                { en: "hours", ur: "گھنٹے", fr: "heures" },
    "ساعة.":               { en: "hours.", ur: "گھنٹے۔", fr: "heures." },
    "عام":                 { en: "General", ur: "عام", fr: "Général" },
    "تصنيفات":             { en: "categories", ur: "زمرے", fr: "catégories" },
    "خدمات":               { en: "services", ur: "خدمات", fr: "services" },
    "بواسطة":              { en: "by", ur: "بذریعہ", fr: "par" },
    "متبقٍ":                { en: "remaining", ur: "باقی", fr: "restant" },
    "المستفيد":            { en: "Beneficiary", ur: "مستفید", fr: "Bénéficiaire" },
    "المراجعة":            { en: "Review", ur: "جائزہ", fr: "Vérification" },
    "السابق":              { en: "Previous", ur: "پچھلا", fr: "Précédent" },
    "إغلاق":               { en: "Close", ur: "بند کریں", fr: "Fermer" },
    "المستخدمون":          { en: "Users", ur: "صارفین", fr: "Utilisateurs" },
    "المدير العام":        { en: "General Manager", ur: "جنرل منیجر", fr: "Directeur général" },
    "الملف الوظيفي":       { en: "Employment Profile", ur: "ملازمتی پروفائل", fr: "Dossier professionnel" },
    "صافي الراتب":         { en: "Net Salary", ur: "خالص تنخواہ", fr: "Salaire net" },
    "تاريخ الإنشاء":       { en: "Created On", ur: "تاریخِ اجرا", fr: "Date de création" },
    "تاريخ التقديم":       { en: "Submission Date", ur: "جمع کرانے کی تاریخ", fr: "Date de soumission" },
    "الرصيد بعد الطلب":    { en: "Balance After Request", ur: "درخواست کے بعد بیلنس", fr: "Solde après la demande" },
    "آخر مزامنة":          { en: "Last sync", ur: "آخری ہم آہنگی", fr: "Dernière synchronisation" },
    "عدد المراحل":         { en: "Number of Stages", ur: "مراحل کی تعداد", fr: "Nombre d'étapes" },

    /* أشهر السنة */
    "يناير": { en: "January", ur: "جنوری", fr: "Janvier" },
    "فبراير": { en: "February", ur: "فروری", fr: "Février" },
    "مارس": { en: "March", ur: "مارچ", fr: "Mars" },
    "أبريل": { en: "April", ur: "اپریل", fr: "Avril" },
    "مايو": { en: "May", ur: "مئی", fr: "Mai" },
    "يونيو": { en: "June", ur: "جون", fr: "Juin" },
    "يوليو": { en: "July", ur: "جولائی", fr: "Juillet" },
    "أغسطس": { en: "August", ur: "اگست", fr: "Août" },
    "سبتمبر": { en: "September", ur: "ستمبر", fr: "Septembre" },
    "أكتوبر": { en: "October", ur: "اکتوبر", fr: "Octobre" },
    "نوفمبر": { en: "November", ur: "نومبر", fr: "Novembre" },
    "ديسمبر": { en: "December", ur: "دسمبر", fr: "Décembre" },

    /* الإشعارات وقوائم فارغة */
    "الموافقات":           { en: "Approvals", ur: "منظوریاں", fr: "Approbations" },
    "التعاميم":            { en: "Announcements", ur: "اعلانات", fr: "Annonces" },
    "غير المقروء":         { en: "Unread", ur: "غیر پڑھا", fr: "Non lus" },
    "لا توجد إشعارات.":    { en: "No notifications.", ur: "کوئی اطلاع نہیں۔", fr: "Aucune notification." },
    "لا توجد طلبات مطابقة.": { en: "No matching requests.", ur: "کوئی مماثل درخواست نہیں۔", fr: "Aucune demande correspondante." },
    "لا توجد طلبات في هذه القائمة.": { en: "No requests in this list.", ur: "اس فہرست میں کوئی درخواست نہیں۔", fr: "Aucune demande dans cette liste." },
    "لا توجد طلبات معلّقة. أحسنت!": { en: "No pending requests. Well done!", ur: "کوئی زیرِ التوا درخواست نہیں۔ شاباش!", fr: "Aucune demande en attente. Bravo !" },
    "لا توجد عهد حالية":   { en: "No current assets", ur: "کوئی موجودہ سامان نہیں", fr: "Aucun matériel en cours" },
    "لا توجد سجلات مطابقة.": { en: "No matching records.", ur: "کوئی مماثل ریکارڈ نہیں۔", fr: "Aucun enregistrement correspondant." },
    "لا توجد إجازات بهذه الحالة.": { en: "No leaves with this status.", ur: "اس حالت کی کوئی چھٹی نہیں۔", fr: "Aucun congé avec ce statut." },
    "لا توجد إجازة جارية حاليًا.": { en: "No leave in progress right now.", ur: "فی الحال کوئی چھٹی جاری نہیں۔", fr: "Aucun congé en cours actuellement." },
    "لا توجد إجازات سابقة.": { en: "No past leaves.", ur: "کوئی گزشتہ چھٹی نہیں۔", fr: "Aucun congé passé." },
    "لا يوجد موظفون مطابقون.": { en: "No matching employees.", ur: "کوئی مماثل ملازم نہیں۔", fr: "Aucun employé correspondant." },
    "لا يوجد موظفون مرتبطون بإدارتك حالياً. يرجى مراجعة إعدادات الموظفين في Odoo.": { en: "No employees are linked to your department. Please review employee settings in Odoo.", ur: "آپ کے شعبے سے کوئی ملازم منسلک نہیں۔ Odoo میں ملازمین کی ترتیبات دیکھیں۔", fr: "Aucun employé n'est rattaché à votre département. Vérifiez les paramètres des employés dans Odoo." },
    "طلبات جديدة":         { en: "New Requests", ur: "نئی درخواستیں", fr: "Nouvelles demandes" },
    "طلبات مفتوحة":        { en: "Open Requests", ur: "کھلی درخواستیں", fr: "Demandes ouvertes" },

    /* لوحة المدير */
    "حضور يدوي":           { en: "Manual Check-in", ur: "دستی حاضری", fr: "Arrivée manuelle" },
    "انصراف يدوي":         { en: "Manual Check-out", ur: "دستی روانگی", fr: "Départ manuel" },
    "إشعار":               { en: "Notify", ur: "اطلاع", fr: "Notifier" },
    "طلب نيابة":           { en: "Request on Behalf", ur: "نیابتاً درخواست", fr: "Demande au nom de" },
    "تنبيه من مدير القسم": { en: "Alert from the Department Manager", ur: "شعبہ منیجر کی جانب سے انتباہ", fr: "Alerte du chef de département" },
    "أرسل مدير القسم إشعاراً إلى": { en: "The department manager sent a notification to", ur: "شعبہ منیجر نے اطلاع بھیجی بنام", fr: "Le chef de département a envoyé une notification à" },
    "قام مدير القسم بتقديم تسجيل": { en: "The department manager submitted a", ur: "شعبہ منیجر نے اندراج جمع کرایا", fr: "Le chef de département a soumis un pointage" },
    "لك بتاريخ":           { en: "for you on", ur: "آپ کے لیے بتاریخ", fr: "pour vous le" },
    "وهو بانتظار مراجعة الموارد البشرية.": { en: "and it is awaiting HR review.", ur: "اور یہ ایچ آر کے جائزے کا منتظر ہے۔", fr: "et il est en attente de vérification RH." },

    /* التسجيل اليدوي للحضور */
    "جهاز البصمة لا يعمل": { en: "Biometric device not working", ur: "بایومیٹرک ڈیوائس کام نہیں کر رہی", fr: "Le lecteur biométrique ne fonctionne pas" },
    "لم يتم تسجيل البصمة": { en: "Punch was not recorded", ur: "اندراج نہیں ہوا", fr: "Le pointage n'a pas été enregistré" },
    "انقطاع الكهرباء":     { en: "Power outage", ur: "بجلی کی بندش", fr: "Coupure de courant" },
    "انقطاع الاتصال":      { en: "Connectivity outage", ur: "رابطہ منقطع", fr: "Panne de connexion" },
    "الموظف في مهمة خارجية": { en: "Employee on an external assignment", ur: "ملازم بیرونی مہم پر", fr: "Employé en mission externe" },
    "الموظف في موقع عمل آخر": { en: "Employee at another work site", ur: "ملازم دوسرے مقام پر", fr: "Employé sur un autre site" },
    "خلل في بطاقة الموظف": { en: "Faulty employee badge", ur: "ملازم کے کارڈ میں خرابی", fr: "Badge employé défectueux" },
    "خطأ إداري":           { en: "Administrative error", ur: "انتظامی غلطی", fr: "Erreur administrative" },
    "سبب التسجيل اليدوي *": { en: "Manual Entry Reason *", ur: "دستی اندراج کی وجہ *", fr: "Motif de la saisie manuelle *" },
    "اكتب السبب *":        { en: "Write the reason *", ur: "وجہ لکھیں *", fr: "Indiquez le motif *" },
    "(مُدخل يدوياً)":       { en: "(manually entered)", ur: "(دستی اندراج)", fr: "(saisie manuelle)" },
    "السجل بانتظار مراجعة الموارد البشرية، وأُشعِر الموظف. سيظهر بعلامة «مُدخل يدوياً».": { en: "The record awaits HR review and the employee was notified. It will show a \"manually entered\" mark.", ur: "ریکارڈ ایچ آر کے جائزے کا منتظر ہے اور ملازم کو اطلاع دی گئی۔ اس پر «دستی اندراج» کا نشان ہوگا۔", fr: "L'enregistrement attend la vérification RH et l'employé a été notifié. Il portera la mention « saisie manuelle »." },
    "يرجى تحديد التاريخ.": { en: "Please set the date.", ur: "براہِ کرم تاریخ متعین کریں۔", fr: "Veuillez indiquer la date." },
    "يرجى تحديد وقت الحضور.": { en: "Please set the check-in time.", ur: "براہِ کرم حاضری کا وقت متعین کریں۔", fr: "Veuillez indiquer l'heure d'arrivée." },
    "يرجى تحديد وقت الانصراف.": { en: "Please set the check-out time.", ur: "براہِ کرم روانگی کا وقت متعین کریں۔", fr: "Veuillez indiquer l'heure de départ." },
    "لا يمكن تسجيل تاريخ مستقبلي.": { en: "A future date cannot be recorded.", ur: "مستقبل کی تاریخ درج نہیں ہو سکتی۔", fr: "Une date future ne peut être enregistrée." },
    "وقت الانصراف يجب أن يكون بعد وقت الحضور.": { en: "Check-out time must be after check-in time.", ur: "روانگی کا وقت حاضری کے بعد ہونا چاہیے۔", fr: "L'heure de départ doit suivre l'heure d'arrivée." },
    "يرجى اختيار سبب التسجيل اليدوي.": { en: "Please choose a reason for the manual entry.", ur: "دستی اندراج کی وجہ منتخب کریں۔", fr: "Veuillez choisir un motif pour la saisie manuelle." },
    "يرجى كتابة السبب.":   { en: "Please write the reason.", ur: "براہِ کرم وجہ لکھیں۔", fr: "Veuillez indiquer le motif." },
    "يرجى الإقرار بصحة البيانات.": { en: "Please confirm the data is correct.", ur: "براہِ کرم معلومات کی درستی کی تصدیق کریں۔", fr: "Veuillez confirmer l'exactitude des données." },

    /* تعديل الإجازة */
    "تعديل سبب الإجازة":   { en: "Change Leave Reason", ur: "چھٹی کی وجہ بدلیں", fr: "Modifier le motif du congé" },
    "الإجازة الأصلية":     { en: "Original Leave", ur: "اصل چھٹی", fr: "Congé initial" },
    "نوع التعديل":         { en: "Change Type", ur: "ترمیم کی قسم", fr: "Type de modification" },
    "التاريخ الجديد":      { en: "New Date", ur: "نئی تاریخ", fr: "Nouvelle date" },
    "الأيام الجديدة":      { en: "New Days", ur: "نئے دن", fr: "Nouveaux jours" },
    "تاريخ العودة":        { en: "Return Date", ur: "واپسی کی تاریخ", fr: "Date de retour" },
    "أيام تُعاد للرصيد":    { en: "Days Credited Back", ur: "بیلنس میں واپس دن", fr: "Jours recrédités" },
    "سبب التعديل *":       { en: "Reason for Change *", ur: "ترمیم کی وجہ *", fr: "Motif de la modification *" },
    "سبب الإجازة *":       { en: "Leave Reason *", ur: "چھٹی کی وجہ *", fr: "Motif du congé *" },
    "يرجى اختيار الإجازة المراد تعديلها.": { en: "Please select the leave to modify.", ur: "ترمیم کے لیے چھٹی منتخب کریں۔", fr: "Veuillez sélectionner le congé à modifier." },
    "يرجى تحديد نوع التعديل المطلوب.": { en: "Please specify the change type.", ur: "مطلوبہ ترمیم کی قسم متعین کریں۔", fr: "Veuillez préciser le type de modification." },
    "لم يتم إجراء أي تغيير على الإجازة.": { en: "No change was made to the leave.", ur: "چھٹی میں کوئی تبدیلی نہیں ہوئی۔", fr: "Aucune modification n'a été apportée au congé." },
    "يرجى تحديد تاريخ العودة الفعلية للعمل.": { en: "Please set the actual return-to-work date.", ur: "کام پر واپسی کی اصل تاریخ متعین کریں۔", fr: "Veuillez indiquer la date effective de reprise." },
    "تاريخ العودة لا يمكن أن يسبق بداية الإجازة.": { en: "The return date cannot precede the leave start.", ur: "واپسی کی تاریخ چھٹی کے آغاز سے پہلے نہیں ہو سکتی۔", fr: "La date de retour ne peut précéder le début du congé." },
    "تاريخ العودة لا يتجاوز تاريخ نهاية الإجازة.": { en: "The return date cannot exceed the leave end date.", ur: "واپسی کی تاریخ چھٹی کے اختتام سے آگے نہیں ہو سکتی۔", fr: "La date de retour ne peut dépasser la fin du congé." },
    "لا يمكن قطع إجازة لم تبدأ بعد.": { en: "A leave that hasn't started cannot be cut short.", ur: "جو چھٹی شروع نہیں ہوئی وہ ختم نہیں کی جا سکتی۔", fr: "Un congé non commencé ne peut être écourté." },
    "يرجى كتابة سبب التعديل.": { en: "Please write the reason for the change.", ur: "ترمیم کی وجہ لکھیں۔", fr: "Veuillez indiquer le motif de la modification." },
    "تعذّر تحميل الإجازات من Odoo. تحقق من الاتصال ثم حاول مرة أخرى.": { en: "Could not load leaves from Odoo. Check the connection and try again.", ur: "Odoo سے چھٹیاں لوڈ نہ ہو سکیں۔ کنکشن دیکھ کر دوبارہ کوشش کریں۔", fr: "Impossible de charger les congés depuis Odoo. Vérifiez la connexion et réessayez." },
    "تقصير إجازة":         { en: "Shorten Leave", ur: "چھٹی کم کریں", fr: "Raccourcir le congé" },
    "قطع إجازة والعودة":   { en: "Cut Leave & Return", ur: "چھٹی ختم کر کے واپسی", fr: "Écourter le congé et reprendre" },
    "عودة من إجازة":       { en: "Return from Leave", ur: "چھٹی سے واپسی", fr: "Retour de congé" },
    "إلغاء إجازة":         { en: "Cancel Leave", ur: "چھٹی منسوخ کریں", fr: "Annuler un congé" },
    "تقديم الطلب":         { en: "Request Submission", ur: "درخواست جمع", fr: "Dépôt de la demande" },
    "اعتماد المدير المباشر": { en: "Direct Manager Approval", ur: "براہِ راست منیجر کی منظوری", fr: "Approbation du responsable direct" },
    "اعتماد الموارد البشرية": { en: "HR Approval", ur: "ایچ آر کی منظوری", fr: "Approbation RH" },
    "القرار النهائي":      { en: "Final Decision", ur: "حتمی فیصلہ", fr: "Décision finale" },

    /* الورديات */
    "الوردية الجديدة":     { en: "New Shift", ur: "نئی شفٹ", fr: "Nouvelle équipe" },
    "بداية التطبيق":       { en: "Effective From", ur: "نفاذ کا آغاز", fr: "Prise d'effet" },
    "نهاية التغيير":       { en: "Change Ends", ur: "تبدیلی کا اختتام", fr: "Fin du changement" },
    "أيام العمل الجديدة":  { en: "New Working Days", ur: "نئے کام کے دن", fr: "Nouveaux jours ouvrés" },
    "نوع التغيير *":       { en: "Change Type *", ur: "تبدیلی کی قسم *", fr: "Type de changement *" },
    "سبب تغيير الوردية *": { en: "Reason for Shift Change *", ur: "شفٹ تبدیلی کی وجہ *", fr: "Motif du changement d'équipe *" },
    "وقت النهاية":         { en: "End Time", ur: "اختتام کا وقت", fr: "Heure de fin" },
    "يرجى تحديد وقت بداية ونهاية الدوام الجديد.": { en: "Please set the new start and end times.", ur: "نئے دورانیے کا آغاز و اختتام متعین کریں۔", fr: "Veuillez indiquer les nouvelles heures de début et de fin." },
    "يرجى تحديد تاريخ بداية تطبيق الوردية الجديدة.": { en: "Please set the date the new shift takes effect.", ur: "نئی شفٹ کے نفاذ کی تاریخ متعین کریں۔", fr: "Veuillez indiquer la date de prise d'effet de la nouvelle équipe." },
    "التغيير المؤقت يتطلب تحديد تاريخ نهاية التغيير.": { en: "A temporary change requires an end date.", ur: "عارضی تبدیلی کے لیے اختتامی تاریخ لازم ہے۔", fr: "Un changement temporaire exige une date de fin." },
    "يرجى كتابة سبب تغيير الوردية.": { en: "Please write the reason for the shift change.", ur: "شفٹ تبدیلی کی وجہ لکھیں۔", fr: "Veuillez indiquer le motif du changement d'équipe." },
    "تصحيح بصمة الحضور":   { en: "Correct Check-in Punch", ur: "حاضری کے اندراج کی درستی", fr: "Corriger le pointage d'arrivée" },
    "تصحيح بصمة الانصراف": { en: "Correct Check-out Punch", ur: "روانگی کے اندراج کی درستی", fr: "Corriger le pointage de départ" },
    "استئذان خلال الدوام": { en: "Permission During Work Hours", ur: "دورانِ کار اجازت", fr: "Autorisation pendant le service" },
    "خروج أثناء العمل":    { en: "Exit During Work", ur: "دورانِ کار باہر جانا", fr: "Sortie pendant le service" },
    "تسجيل ساعات إضافية":  { en: "Log Overtime Hours", ur: "اضافی گھنٹے درج کریں", fr: "Enregistrer des heures supplémentaires" },
    "طلب عمل عن بُعد":     { en: "Remote Work Request", ur: "دور کام کی درخواست", fr: "Demande de télétravail" },
    "تغيير الوردية":       { en: "Change Shift", ur: "شفٹ بدلیں", fr: "Changer d'équipe" },
    "تعديل أيام العمل":    { en: "Adjust Working Days", ur: "کام کے دن ترتیب دیں", fr: "Ajuster les jours ouvrés" },
    "لم يسجل انصراف":      { en: "No check-out", ur: "روانگی درج نہیں", fr: "Sans pointage de départ" },

    /* الخطابات — وصف الأنواع */
    "موجّه لجهة مع الراتب": { en: "Addressed to a party, including salary", ur: "تنخواہ سمیت کسی ادارے کے نام", fr: "Adressée à un tiers, salaire inclus" },
    "إثبات عمل":           { en: "Proof of employment", ur: "ملازمت کا ثبوت", fr: "Justificatif d'emploi" },
    "خبرة ومدة الخدمة":    { en: "Experience and length of service", ur: "تجربہ اور مدتِ ملازمت", fr: "Expérience et ancienneté" },
    "لأغراض بنكية":        { en: "For banking purposes", ur: "بینکاری مقاصد کے لیے", fr: "À usage bancaire" },
    "لاستخراج تأشيرة":     { en: "For visa issuance", ur: "ویزا کے حصول کے لیے", fr: "Pour l'obtention d'un visa" },
    "لأغراض المرور":       { en: "For traffic department purposes", ur: "ٹریفک کے مقاصد کے لیے", fr: "Pour la direction de la circulation" },
    "نص حسب الحاجة":       { en: "Free text as needed", ur: "ضرورت کے مطابق متن", fr: "Texte libre selon le besoin" },

    /* الإدارة والصلاحيات */
    "إضافة وتعديل وتعطيل": { en: "Add, edit and disable", ur: "شامل، ترمیم اور غیر فعال", fr: "Ajouter, modifier et désactiver" },
    "مصفوفة الصلاحيات":    { en: "Permissions Matrix", ur: "اجازتوں کا میٹرکس", fr: "Matrice des autorisations" },
    "مسارات الموافقات":    { en: "Approval Workflows", ur: "منظوری کے راستے", fr: "Circuits d'approbation" },
    "تصميم Workflow":      { en: "Workflow Design", ur: "ورک فلو ڈیزائن", fr: "Conception du workflow" },
    "إضافة/إخفاء/ترتيب":   { en: "Add / hide / reorder", ur: "شامل / چھپائیں / ترتیب", fr: "Ajouter / masquer / réordonner" },
    "اللوجو والمظهر":      { en: "Logo & Appearance", ur: "لوگو اور ظاہری شکل", fr: "Logo et apparence" },
    "الاتصال والمزامنة":   { en: "Connection & Sync", ur: "کنکشن اور ہم آہنگی", fr: "Connexion et synchronisation" },
    "إضافة مستخدم":        { en: "Add User", ur: "صارف شامل کریں", fr: "Ajouter un utilisateur" },
    "تغيير حالة مستخدم":   { en: "Change user status", ur: "صارف کی حالت بدلیں", fr: "Modifier le statut d'un utilisateur" },
    "تعذّر إنشاء المستخدم في أودو": { en: "Could not create the user in Odoo", ur: "Odoo میں صارف نہیں بن سکا", fr: "Impossible de créer l'utilisateur dans Odoo" },
    "تعذّر تحديث الحالة في أودو": { en: "Could not update the status in Odoo", ur: "Odoo میں حالت اپ ڈیٹ نہ ہو سکی", fr: "Impossible de mettre à jour le statut dans Odoo" },
    "الاسم *":             { en: "Name *", ur: "نام *", fr: "Nom *" },
    "البريد / اسم الدخول *": { en: "Email / Login *", ur: "ای میل / لاگ اِن *", fr: "E-mail / Identifiant *" },
    "يرجى تحديد الدور المطلوب تعديل صلاحياته.": { en: "Please choose the role whose permissions you want to edit.", ur: "جس کردار کی اجازتیں بدلنی ہیں اسے منتخب کریں۔", fr: "Veuillez choisir le rôle dont vous modifiez les autorisations." },
    "تم حفظ وتطبيق الصلاحيات بنجاح": { en: "Permissions saved and applied successfully", ur: "اجازتیں کامیابی سے محفوظ اور نافذ", fr: "Autorisations enregistrées et appliquées" },
    "تعذّر حفظ الصلاحيات. لم يتم تطبيق أي تغيير. يرجى المحاولة مرة أخرى.": { en: "Could not save permissions. No change was applied. Please try again.", ur: "اجازتیں محفوظ نہ ہو سکیں۔ کوئی تبدیلی نافذ نہیں ہوئی۔ دوبارہ کوشش کریں۔", fr: "Échec de l'enregistrement. Aucune modification appliquée. Réessayez." },
    "جارٍ حفظ الصلاحيات…": { en: "Saving permissions…", ur: "اجازتیں محفوظ ہو رہی ہیں…", fr: "Enregistrement des autorisations…" },
    "تم الحفظ ✓":          { en: "Saved ✓", ur: "محفوظ ✓", fr: "Enregistré ✓" },
    "تعديل مسار موافقات":  { en: "Edit Approval Workflow", ur: "منظوری کے راستے میں ترمیم", fr: "Modifier un circuit d'approbation" },
    "يسجَّل كل إجراء حسّاس (مستخدمون، صلاحيات، مسارات، موافقات) ولا يمكن حذفه.": { en: "Every sensitive action (users, permissions, workflows, approvals) is logged and cannot be deleted.", ur: "ہر حساس کارروائی (صارفین، اجازتیں، راستے، منظوریاں) ریکارڈ ہوتی ہے اور حذف نہیں کی جا سکتی۔", fr: "Toute action sensible (utilisateurs, autorisations, circuits, approbations) est journalisée et indélébile." },
    "وضع الاختبار — لا اتصال بأودو": { en: "Test mode — not connected to Odoo", ur: "ٹیسٹ موڈ — Odoo سے منسلک نہیں", fr: "Mode test — non connecté à Odoo" },
    "الخادم وقاعدة البيانات": { en: "Server & Database", ur: "سرور اور ڈیٹابیس", fr: "Serveur et base de données" },
    "لا تُعرض — تُضبط في إعدادات الخادم": { en: "Not shown — configured in server settings", ur: "نہیں دکھایا جاتا — سرور کی ترتیبات میں", fr: "Non affiché — défini dans les paramètres du serveur" },
    "رابط الخادم":         { en: "Server URL", ur: "سرور کا لنک", fr: "URL du serveur" },
    "اسم قاعدة البيانات":  { en: "Database Name", ur: "ڈیٹابیس کا نام", fr: "Nom de la base de données" },
    "مفتاح التكامل":       { en: "Integration Key", ur: "انضمام کی کلید", fr: "Clé d'intégration" },
    "تم الاتصال — Odoo":   { en: "Connected — Odoo", ur: "منسلک — Odoo", fr: "Connecté — Odoo" },
    "تعذّر الاتصال بخادم Odoo.": { en: "Could not connect to the Odoo server.", ur: "Odoo سرور سے رابطہ نہ ہو سکا۔", fr: "Impossible de se connecter au serveur Odoo." },
    "حذف خدمة":            { en: "Delete Service", ur: "خدمت حذف کریں", fr: "Supprimer un service" },
    "اسم الخدمة *":        { en: "Service Name *", ur: "خدمت کا نام *", fr: "Nom du service *" },
    "الاسم موجود مسبقاً.": { en: "That name already exists.", ur: "یہ نام پہلے سے موجود ہے۔", fr: "Ce nom existe déjà." },
    "مخفية":               { en: "Hidden", ur: "پوشیدہ", fr: "Masqué" },
    "ظاهرة":               { en: "Visible", ur: "ظاہر", fr: "Visible" },
    "المفضلة":             { en: "Favorites", ur: "پسندیدہ", fr: "Favoris" },
    "تحتاج موافقة":        { en: "Requires approval", ur: "منظوری درکار", fr: "Nécessite une approbation" },
    "إعدادات اللغة":       { en: "Language Settings", ur: "زبان کی ترتیبات", fr: "Paramètres de langue" },
    "العربية هي لغة الواجهة الحالية.": { en: "Arabic is the current interface language.", ur: "عربی موجودہ انٹرفیس زبان ہے۔", fr: "L'arabe est la langue actuelle de l'interface." },
    "تغيير كلمة المرور":   { en: "Change Password", ur: "پاس ورڈ تبدیل کریں", fr: "Changer le mot de passe" },
    "سيتم تحويلك لتغيير كلمة المرور عبر Odoo.": { en: "You will be redirected to change your password via Odoo.", ur: "پاس ورڈ بدلنے کے لیے Odoo کی طرف بھیجا جائے گا۔", fr: "Vous serez redirigé pour changer votre mot de passe via Odoo." },
    "لا تملك صلاحية عرض مواقع الحضور.": { en: "You are not authorized to view attendance locations.", ur: "حاضری کے مقامات دیکھنے کی اجازت نہیں۔", fr: "Vous n'êtes pas autorisé à consulter les lieux de pointage." },

    /* اعتماد ورفض */
    "جارٍ الإرسال…":       { en: "Sending…", ur: "بھیجا جا رہا ہے…", fr: "Envoi…" },
    "تم إنشاء الطلب":      { en: "Request created", ur: "درخواست بن گئی", fr: "Demande créée" },
    "سبب رفض هذا البند *": { en: "Reason for rejecting this item *", ur: "اس شے کو مسترد کرنے کی وجہ *", fr: "Motif du rejet de cet élément *" },
    "يرجى تحديد نوع الإجازة المعتمد قبل الموافقة.": { en: "Please choose the approved leave type before approving.", ur: "منظوری سے پہلے منظور شدہ چھٹی کی قسم منتخب کریں۔", fr: "Veuillez choisir le type de congé approuvé avant d'approuver." },
    "تعذّر إتمام الاعتماد.": { en: "Could not complete the approval.", ur: "منظوری مکمل نہ ہو سکی۔", fr: "Impossible de finaliser l'approbation." },
    "يُسجَّل من اختار النوع ومتى، ويُستخدم عند تحديث الإجازة في Odoo.": { en: "Who chose the type and when is recorded, and it is used when updating the leave in Odoo.", ur: "قسم کس نے اور کب منتخب کی یہ درج ہوتا ہے، اور Odoo میں چھٹی اپ ڈیٹ کرتے وقت استعمال ہوتا ہے۔", fr: "L'auteur et la date du choix sont enregistrés et utilisés lors de la mise à jour du congé dans Odoo." },
    "تُحدَّث البنود المعتمدة فقط في Odoo، وتُسجَّل القيم القديمة والجديدة في Audit Log.": { en: "Only approved items are updated in Odoo, and old and new values are recorded in the Audit Log.", ur: "صرف منظور شدہ اشیاء Odoo میں اپ ڈیٹ ہوں گی، اور پرانی و نئی قیمتیں آڈٹ لاگ میں درج ہوں گی۔", fr: "Seuls les éléments approuvés sont mis à jour dans Odoo, et les anciennes et nouvelles valeurs sont consignées dans le journal d'audit." },
    "يرجى اختيار عنصر واحد على الأقل للتحديث.": { en: "Please select at least one item to update.", ur: "اپ ڈیٹ کے لیے کم از کم ایک شے منتخب کریں۔", fr: "Veuillez sélectionner au moins un élément à mettre à jour." },
    "رقم الآيبان وتأكيده غير متطابقين.": { en: "The IBAN and its confirmation do not match.", ur: "IBAN اور اس کی تصدیق مماثل نہیں۔", fr: "L'IBAN et sa confirmation ne correspondent pas." },
    "القيمة الحالية":      { en: "Current Value", ur: "موجودہ قیمت", fr: "Valeur actuelle" },
    "اختيار العناصر":      { en: "Select Items", ur: "اشیاء منتخب کریں", fr: "Sélection des éléments" },
    "طلب صيانة":           { en: "Maintenance Request", ur: "مرمت کی درخواست", fr: "Demande de maintenance" },
    "طلب استبدال":         { en: "Replacement Request", ur: "تبدیلی کی درخواست", fr: "Demande de remplacement" },
    "طلب إرجاع":           { en: "Return Request", ur: "واپسی کی درخواست", fr: "Demande de restitution" },
    "بلاغ فقدان":          { en: "Loss Report", ur: "گمشدگی کی اطلاع", fr: "Déclaration de perte" },
    "حجم الصورة كبير — الحد 4 ميجابايت": { en: "Image too large — 4 MB limit", ur: "تصویر بہت بڑی — حد 4 میگابائٹ", fr: "Image trop volumineuse — limite de 4 Mo" },
    "تعذّر تغيير الصورة":   { en: "Could not change the photo", ur: "تصویر تبدیل نہ ہو سکی", fr: "Impossible de changer la photo" },

    /* الكاميرا والبصمة والموقع */
    "لم تُلتقط صورة.":      { en: "No photo was captured.", ur: "کوئی تصویر نہیں لی گئی۔", fr: "Aucune photo n'a été prise." },
    "أُلغي التقاط الصورة.": { en: "Photo capture was cancelled.", ur: "تصویر لینا منسوخ ہوا۔", fr: "La prise de photo a été annulée." },
    "تعذّر التقاط الصورة.": { en: "Could not capture the photo.", ur: "تصویر نہیں لی جا سکی۔", fr: "Impossible de prendre la photo." },
    "تعذّر فتح الكاميرا على هذا الجهاز.": { en: "Could not open the camera on this device.", ur: "اس ڈیوائس پر کیمرہ نہیں کھل سکا۔", fr: "Impossible d'ouvrir la caméra sur cet appareil." },
    "جهازك لا يدعم التحقق بالبصمة أو Face ID.": { en: "Your device does not support Fingerprint or Face ID verification.", ur: "آپ کی ڈیوائس فنگر پرنٹ یا Face ID تصدیق کی حمایت نہیں کرتی۔", fr: "Votre appareil ne prend pas en charge l'empreinte ou Face ID." },
    "لا توجد بصمة أو Face ID مفعّلة على هذا الجهاز. فعّلها من إعدادات الجهاز ثم أعد المحاولة.": { en: "No Fingerprint or Face ID is enabled on this device. Enable it in device settings and try again.", ur: "اس ڈیوائس پر فنگر پرنٹ یا Face ID فعال نہیں۔ ڈیوائس کی ترتیبات سے فعال کر کے دوبارہ کوشش کریں۔", fr: "Aucune empreinte ni Face ID activé sur cet appareil. Activez-le dans les réglages puis réessayez." },
    "لم يكتمل تسجيل البصمة.": { en: "Biometric enrolment was not completed.", ur: "بایومیٹرک اندراج مکمل نہ ہوا۔", fr: "L'enrôlement biométrique n'a pas abouti." },
    "لم يكتمل التحقق.":    { en: "Verification was not completed.", ur: "تصدیق مکمل نہ ہوئی۔", fr: "La vérification n'a pas abouti." },
    "أُلغي التحقق أو انتهت مهلته.": { en: "Verification was cancelled or timed out.", ur: "تصدیق منسوخ ہوئی یا وقت ختم ہوا۔", fr: "Vérification annulée ou expirée." },
    "تعذّر التحقق بالبصمة على هذا الجهاز.": { en: "Biometric verification failed on this device.", ur: "اس ڈیوائس پر بایومیٹرک تصدیق ناکام۔", fr: "Échec de la vérification biométrique sur cet appareil." },
    "تعذّر التحقق بالبصمة.": { en: "Biometric verification failed.", ur: "بایومیٹرک تصدیق ناکام۔", fr: "Échec de la vérification biométrique." },
    "بصمة/Face ID — سُجّلت على هذا الجهاز": { en: "Fingerprint / Face ID — enrolled on this device", ur: "فنگر پرنٹ / Face ID — اس ڈیوائس پر درج", fr: "Empreinte / Face ID — enrôlé sur cet appareil" },
    "بصمة/Face ID على الجهاز": { en: "Fingerprint / Face ID on device", ur: "ڈیوائس پر فنگر پرنٹ / Face ID", fr: "Empreinte / Face ID sur l'appareil" },
    "تعذّر تسجيل البصمة. حاول مرة أخرى.": { en: "Could not record the punch. Please try again.", ur: "اندراج نہ ہو سکا۔ دوبارہ کوشش کریں۔", fr: "Le pointage a échoué. Réessayez." },
    "يستخدم النظام مصادقة الجهاز البيومترية القياسية دون تخزين بيانات البصمة أو الوجه.": { en: "The system uses standard device biometrics; no fingerprint or face data is stored.", ur: "نظام معیاری ڈیوائس بایومیٹرکس استعمال کرتا ہے؛ فنگر پرنٹ یا چہرے کا ڈیٹا محفوظ نہیں ہوتا۔", fr: "Le système utilise la biométrie standard de l'appareil ; aucune donnée d'empreinte ou de visage n'est stockée." },
    "خدمة الموقع غير متاحة على هذا الجهاز.": { en: "Location services are unavailable on this device.", ur: "اس ڈیوائس پر مقام کی خدمت دستیاب نہیں۔", fr: "Les services de localisation sont indisponibles sur cet appareil." },
    "تعذّر تحديد موقعك. اخرج قرب نافذة أو مكان مكشوف ثم اضغط «تحديد موقعي».": { en: "Could not determine your location. Move near a window or into the open, then tap \"Locate Me\".", ur: "آپ کا مقام متعین نہ ہو سکا۔ کھڑکی کے قریب یا کھلی جگہ جا کر «میرا مقام» دبائیں۔", fr: "Localisation impossible. Rapprochez-vous d'une fenêtre ou sortez, puis appuyez sur « Me localiser »." },
    "لديك بصمة حضور مفتوحة من يوم سابق — سجّل الانصراف لإغلاقها.": { en: "You have an open check-in from a previous day — check out to close it.", ur: "پچھلے دن کی حاضری کھلی ہے — بند کرنے کے لیے روانگی درج کریں۔", fr: "Un pointage d'arrivée d'un jour précédent est ouvert — pointez le départ pour le clôturer." },
    "قبل وقت التسجيل":     { en: "Before punch window", ur: "اندراج کے وقت سے پہلے", fr: "Avant la plage de pointage" },
    "ضمن الوقت":           { en: "On time", ur: "وقت پر", fr: "À l'heure" },
    "متأخر في الانصراف":   { en: "Late departure", ur: "روانگی میں تاخیر", fr: "Départ tardif" },
    "لا يمكن تسجيل الانصراف قبل تسجيل الحضور.": { en: "You cannot check out before checking in.", ur: "حاضری کے بغیر روانگی درج نہیں ہو سکتی۔", fr: "Impossible de pointer le départ avant l'arrivée." },
    "لقد سجّلت حضورك بالفعل.": { en: "You have already checked in.", ur: "آپ پہلے ہی حاضری درج کر چکے ہیں۔", fr: "Vous avez déjà pointé votre arrivée." },
    "لقد سجّلت انصرافك بالفعل.": { en: "You have already checked out.", ur: "آپ پہلے ہی روانگی درج کر چکے ہیں۔", fr: "Vous avez déjà pointé votre départ." },
    "يرجى تحديد موقعك أولاً.": { en: "Please locate yourself first.", ur: "پہلے اپنا مقام متعین کریں۔", fr: "Veuillez d'abord vous localiser." },
    "انتهت صلاحية الموقع. اضغط «تحديد موقعي» لتحديث موقعك.": { en: "The location has expired. Tap \"Locate Me\" to refresh it.", ur: "مقام کی مدت ختم ہوئی۔ «میرا مقام» دبا کر تازہ کریں۔", fr: "La position a expiré. Appuyez sur « Me localiser » pour l'actualiser." },
    "حضور متأخر":          { en: "Late check-in", ur: "تاخیر سے حاضری", fr: "Arrivée tardive" },
    "حضور منتظم":          { en: "Regular check-in", ur: "معمول کی حاضری", fr: "Arrivée normale" },
    "الإنترنت متصل":       { en: "Online", ur: "آن لائن", fr: "En ligne" },
    "بدون إنترنت":         { en: "Offline", ur: "آف لائن", fr: "Hors ligne" },
    "🟢 داخل نطاق العمل":  { en: "🟢 Inside the work zone", ur: "🟢 کام کی حدود کے اندر", fr: "🟢 Dans la zone de travail" },
    "🔴 خارج نطاق العمل":  { en: "🔴 Outside the work zone", ur: "🔴 کام کی حدود سے باہر", fr: "🔴 Hors de la zone de travail" },
    "مشتبه به":            { en: "Suspicious", ur: "مشتبہ", fr: "Suspect" },
    "صلاحية عرض المواقع (HR Location Viewer) — بيانات كاملة لمسؤول الموارد البشرية.": { en: "Location viewing permission (HR Location Viewer) — full data for the HR officer.", ur: "مقام دیکھنے کی اجازت (HR Location Viewer) — ایچ آر افسر کے لیے مکمل ڈیٹا۔", fr: "Autorisation de consultation des lieux (HR Location Viewer) — données complètes pour le responsable RH." },
    "أقل من 50 مترًا":     { en: "Under 50 m", ur: "50 میٹر سے کم", fr: "Moins de 50 m" },
    "أقل من 100 متر":      { en: "Under 100 m", ur: "100 میٹر سے کم", fr: "Moins de 100 m" },
    "أقل من 150 متر":      { en: "Under 150 m", ur: "150 میٹر سے کم", fr: "Moins de 150 m" },
    "أقل من 300 متر":      { en: "Under 300 m", ur: "300 میٹر سے کم", fr: "Moins de 300 m" },
    "أكثر من 300 متر":     { en: "Over 300 m", ur: "300 میٹر سے زیادہ", fr: "Plus de 300 m" },
    "ممتازة":              { en: "Excellent", ur: "بہترین", fr: "Excellente" },
    "جيدة":                { en: "Good", ur: "اچھی", fr: "Bonne" },
    "مقبولة":              { en: "Acceptable", ur: "قابلِ قبول", fr: "Acceptable" },
    "ضعيفة":               { en: "Poor", ur: "کمزور", fr: "Faible" },
    "تم تسجيل حضورك بنجاح الساعة": { en: "Check-in recorded successfully at", ur: "حاضری کامیابی سے درج، وقت", fr: "Arrivée enregistrée à" },
    "تم تسجيل انصرافك بنجاح. إجمالي ساعات العمل اليوم": { en: "Check-out recorded successfully. Total hours worked today", ur: "روانگی کامیابی سے درج۔ آج کے کل کام کے گھنٹے", fr: "Départ enregistré. Total des heures travaillées aujourd'hui" },
    "دقة تحديد موقعك":     { en: "Your location accuracy is", ur: "آپ کے مقام کی درستگی", fr: "La précision de votre position est de" },
    "م والحد المسموح":     { en: "m and the allowed limit is", ur: "میٹر اور مجاز حد", fr: "m et la limite autorisée est de" },
    "أنت خارج نطاق":       { en: "You are outside the zone", ur: "آپ حدود سے باہر ہیں", fr: "Vous êtes hors de la zone" },
    "بمسافة":              { en: "by", ur: "بفاصلہ", fr: "de" },
    "جارٍ مزامنة":         { en: "Syncing", ur: "ہم آہنگی جاری", fr: "Synchronisation de" },
    "عملية محفوظة…":       { en: "saved operations…", ur: "محفوظ کارروائیاں…", fr: "opérations enregistrées…" },
    "تمت مزامنة":          { en: "Synced", ur: "ہم آہنگ ہوا", fr: "Synchronisé" },
    "عملية مع Odoo.":      { en: "operations with Odoo.", ur: "کارروائیاں Odoo کے ساتھ۔", fr: "opérations avec Odoo." },

    /* أخطاء عامة وتثبيت */
    "حدث خطأ مؤقت":        { en: "A temporary error occurred", ur: "عارضی خرابی پیش آئی", fr: "Une erreur temporaire est survenue" },
    "أعد المحاولة أو ارجع للرئيسية.": { en: "Try again or go back to Home.", ur: "دوبارہ کوشش کریں یا ہوم پر جائیں۔", fr: "Réessayez ou revenez à l'accueil." },
    "العودة للتطبيق":      { en: "Back to the app", ur: "ایپ پر واپس", fr: "Retour à l'application" },
    "بيانات غير مكتملة":   { en: "Incomplete data", ur: "نامکمل معلومات", fr: "Données incomplètes" },
    "ثبّت البوابة على جهازك لتفتحها كتطبيق مستقل.": { en: "Install the portal on your device to open it as a standalone app.", ur: "پورٹل کو ڈیوائس پر انسٹال کریں تاکہ الگ ایپ کی طرح کھلے۔", fr: "Installez le portail sur votre appareil pour l'ouvrir comme une application autonome." },
    "للتثبيت على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».": { en: "To install on iPhone: tap Share, then \"Add to Home Screen\".", ur: "آئی فون پر انسٹال کرنے کے لیے: شیئر دبائیں پھر «ہوم اسکرین میں شامل کریں»۔", fr: "Pour installer sur iPhone : appuyez sur Partager, puis « Sur l'écran d'accueil »." },
    "بوابة الموارد البشرية": { en: "HR Portal", ur: "ایچ آر پورٹل", fr: "Portail RH" },
  };

  var KEY_LANG = "sq.lang", KEY_DARK = "sq.dark";
  var lang = "ar";
  try { lang = localStorage.getItem(KEY_LANG) || "ar"; } catch (e) {}
  if (!LANGS[lang]) lang = "ar";

  /* ترجمة نص واحد؛ يعود null إن لم يكن في القاموس فيُترك كما هو.
     React يقصّ النصوص عند كل قيمة متغيّرة، فتصل العقدة مثل "· قُدّم " أو
     "الفلتر النشط:" — لذا نقصّ علامات الفصل والمسافات قبل البحث ونعيدها
     بعده، وإلا لم يطابق شيءٌ من هذه القطع ولو كان في القاموس. */
  var LEAD = /^[\s·:،,\-–—»«]+/, TAIL = /[\s·:،,\-–—»«]+$/;
  function tr(text) {
    if (lang === "ar") return null;
    var pre = (text.match(LEAD) || [""])[0];
    var post = (text.match(TAIL) || [""])[0];
    var k = text.slice(pre.length, text.length - post.length);
    if (!k) return null;
    var row = DICT[k];
    if (!row || !row[lang]) return null;
    // نحافظ على المسافات والفواصل المحيطة حتى لا ينهار تباعد العناصر
    return pre + row[lang] + post;
  }

  var baseOf = new WeakMap();     // العقدة → نصّها العربي المصدر
  var mineOf = new WeakMap();     // العقدة → آخر ما كتبناه نحن فيها
  var observer = null;

  /* نصوصٌ تعيش في خصائص العنصر لا في عقدة نصّية: نصّ الحقل الإرشادي،
     وتلميح الزر، وبديل الصورة. كان المارّ على العقد النصّية وحدها يتركها
     عربيةً أبدًا — 78 نصًّا منها «ابحث عن خدمة…» في أعلى شاشة الخدمات. */
  var ATTRS = ["placeholder", "title", "alt", "aria-label"];
  var attrBase = new WeakMap();
  var attrMine = new WeakMap();
  // المراقب يشمل الخصائص أيضًا، وإلا لم يُعِد الرسم حين يبدّل React نصّ
  // حقل إرشادي. كتابتنا نحن لا توقظه لأننا نفصله أثناء الرسم.
  var OBS = {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATTRS,
  };

  function paintAttrs(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    var el;
    while ((el = w.nextNode())) {
      if (el.id === "sq-lang" || (el.closest && el.closest("#sq-lang"))) continue;
      var bm = attrBase.get(el), mm = attrMine.get(el);
      for (var i = 0; i < ATTRS.length; i++) {
        var name = ATTRS[i];
        if (!el.hasAttribute(name)) continue;
        var cur = el.getAttribute(name);
        if (!bm) { bm = {}; attrBase.set(el, bm); }
        if (!mm) { mm = {}; attrMine.set(el, mm); }
        if (cur !== mm[name]) bm[name] = cur;      // React كتب قيمة جديدة
        var out = tr(bm[name]) || bm[name];
        if (cur !== out) { el.setAttribute(name, out); mm[name] = out; }
      }
    }
  }

  function restoreAttrs(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    var el;
    while ((el = w.nextNode())) {
      var bm = attrBase.get(el), mm = attrMine.get(el);
      if (!bm || !mm) continue;
      for (var i = 0; i < ATTRS.length; i++) {
        var name = ATTRS[i];
        if (mm[name] === undefined) continue;
        if (el.getAttribute(name) === mm[name] && bm[name] !== undefined)
          el.setAttribute(name, bm[name]);
        delete mm[name];
      }
    }
  }

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
      paintAttrs(root);
    } finally {
      if (observer) observer.observe(document.body, OBS);
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
      restoreAttrs(root);
    } finally {
      if (observer) observer.observe(document.body, OBS);
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
    observer.observe(document.body, OBS);
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
