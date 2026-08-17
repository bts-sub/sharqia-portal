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
