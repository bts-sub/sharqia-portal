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
