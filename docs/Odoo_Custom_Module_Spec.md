# مواصفات موديول Odoo 19 المخصّص — `sharqia_portal`

وثيقة مواصفات (بدون تنفيذ) كافية لمطوّر Odoo لبناء موديول يغطّي الميزات التي **لا** توفّرها موديولات Odoo القياسية في بوابة موظفي «بيت العباءة الشرقية».

> **مبدأ عام:** نُعيد استخدام موديولات Odoo القياسية حيثما أمكن (`hr.leave`, `hr.expense`, `hr.attendance`, `ir.attachment`, `approval.request`)، ولا نُنشئ نموذجًا جديدًا إلا عند غياب البديل. الجزء الأكبر من محرّك الطلبات يمكن أن يبقى في الـ backend؛ هذا الموديول للحالة التي تريد فيها أن يكون **Odoo مصدر الحقيقة الكامل**.

---

## 0) ملخّص القرار: قياسي مقابل مخصّص

| الميزة | الحل | السبب |
|---|---|---|
| الإجازات | `hr.leave` قياسي | مسار موافقة الإجازة مدعوم أصلًا |
| السلف/المصروفات | `hr.expense` + `hr.expense.sheet` قياسي | يغطّي الطلبات المالية |
| الحضور | `hr.attendance` قياسي (+ حقل geofence مخصّص) | check_in/out موجود؛ ينقص الموقع فقط |
| المرفقات | `ir.attachment` قياسي | جاهز |
| موافقات عامة بسيطة | `approval.request` قياسي | متاح في Community لطلبات بسيطة |
| **محرّك الطلبات العام (80 خدمة)** | **مخصّص** `x.portal.request` | لا يوجد نموذج قياسي بمسارات SLA متعدّدة لكل تصنيف |
| **مصفوفة الصلاحيات ثنائية المستوى** | **مخصّص** `x.portal.permission` | قاعدة «الأقل بين التصنيف والخدمة» غير قياسية |
| **سجل التدقيق التفصيلي** | **مخصّص** `x.portal.audit` (أو `mail.tracking` جزئيًا) | تتبّع كل انتقال بحقول from/to/note |
| **الخطابات والشهادات** | **مخصّص** `x.portal.letter` + قوالب | لا يوجد نموذج قياسي |
| **العهد بحالات مخصّصة** | **مخصّص** `x.portal.custody` (أو `maintenance.equipment`) | حالات استلام/صيانة/إرجاع/فقدان |
| **التعاميم مع تأكيد القراءة** | **مخصّص** `x.portal.announcement` (+ `ack`) | عدّادات القراءة والـ ack غير قياسية |
| **نطاقات الحضور (geofence)** | **مخصّص** `x.portal.location` | إحداثيات ونصف قطر للتحقق |

---

## 1) `x.portal.request` — محرّك الطلبات العام

النموذج المركزي لكل الطلبات غير المغطّاة بنماذج قياسية مخصّصة.

**الحقول:**
| الحقل | النوع | ملاحظات |
|---|---|---|
| `name` | Char | رقم الطلب `HR-REQ-#####` (تسلسل `ir.sequence`) |
| `employee_id` | Many2one `hr.employee` | مقدّم/مستفيد الطلب |
| `requester_id` | Many2one `hr.employee` | عند الإنشاء نيابةً |
| `on_behalf` | Boolean | طلب نيابة عن موظف |
| `category` | Selection | leave/attend/finance/custody/transfer/personal/letters/training/insurance/complaint/offboard/general |
| `service` | Char | اسم الخدمة الفرعية (من كتالوج الخدمات) |
| `title` | Char | عنوان الطلب |
| `description` | Text | الوصف |
| `priority` | Selection | عادية/متوسطة/عاجلة |
| `confidential` | Boolean | طلب سري (يُخفى عن غير المخوّلين) |
| `state` | Selection | draft/submitted/manager/hr/finance/it/approved/rejected/cancelled/done |
| `stage_index` | Integer | موضع المرحلة في المسار |
| `sla_days` | Integer | مهلة الخدمة |
| `flow_json` | Char/Json | مصفوفة المراحل المحسوبة من التصنيف |
| `extra_json` | Text (JSON) | حقول الخدمة الديناميكية (from/to/amount/…) |
| `attachment_ids` | Many2many `ir.attachment` | المرفقات |
| `comment_ids` | One2many `x.portal.comment` | التعليقات |
| `audit_ids` | One2many `x.portal.audit` | سجل التدقيق |
| `odoo_ref_model` / `odoo_ref_id` | Char/Integer | ربط بالسجل المُنشأ عند الاعتماد (مثلاً hr.leave) |

**states (سير العمل):** `draft → submitted → (manager) → (hr) → (finance|it) → done`، مع `rejected` و`cancelled` كنهايات. الانتقالات عبر أزرار خادمية (server actions): `action_approve`, `action_reject`, `action_cancel` — كل انتقال يُنشئ سطر `x.portal.audit` ويُرسل إشعارًا (`mail.thread`).

**mixins مقترحة:** `mail.thread`, `mail.activity.mixin` (للإشعارات والأنشطة والتتبّع).

---

## 2) `x.portal.audit` — سجل التدقيق

| الحقل | النوع |
|---|---|
| `request_id` | Many2one `x.portal.request` (ondelete=cascade) |
| `user_id` | Many2one `res.users` |
| `action` | Char (إنشاء/موافقة/رفض/تعليق/إلغاء) |
| `stage_from` / `stage_to` | Char |
| `note` | Text |
| `timestamp` | Datetime |

> **البديل الأبسط:** الاعتماد على `mail.message`/تتبّع الحقول في `mail.thread` يغطّي جزءًا، لكن نموذجًا مخصّصًا يعطي حقول from/to/note منظّمة وقابلة للتقارير.

---

## 3) `x.portal.permission` — مصفوفة الصلاحيات ثنائية المستوى

| الحقل | النوع | ملاحظات |
|---|---|---|
| `role` | Selection | الأدوار التسعة |
| `scope` | Selection | category / service |
| `key` | Char | معرّف التصنيف أو الخدمة |
| `level` | Selection | المستويات (إخفاء/عرض/إنشاء/…/إدارة كاملة) |

القاعدة عند التطبيق: **الرتبة الفعلية = min(رتبة التصنيف, رتبة الخدمة)**. تُحسب في دالة مساعدة.

> **البديل الأبسط الموصى به:** إبقاء هذه المصفوفة في الـ backend (تم تنفيذها فعلًا في `src/lib/permissions.js`) بدل موديل Odoo، لأنها منطق تطبيقي بحت لا يحتاج ظهورًا داخل Odoo. أدرجناها هنا فقط للحالة التي تريد إدارتها من داخل Odoo.

---

## 4) `x.portal.letter` — الخطابات والشهادات

| الحقل | النوع |
|---|---|
| `employee_id` | Many2one `hr.employee` |
| `letter_type` | Selection (تعريف راتب/تعريف موظف/شهادة خبرة/خطاب بنك/خطاب سفارة/خطاب مرور/عدم ممانعة/مخصّص) |
| `to_entity` | Char (الجهة الموجّه لها) |
| `language` | Selection (عربي/إنجليزي) |
| `include_salary` | Boolean |
| `state` | Selection (draft/submitted/hr/done) |
| `pdf_file` | Binary (المستند المُصدَر) |
| `template_id` | Many2one `x.portal.letter.template` |

**`x.portal.letter.template`:** `name, letter_type, body_html (QWeb), lang`. توليد PDF عبر تقارير QWeb القياسية.

---

## 5) `x.portal.custody` — العهد

| الحقل | النوع |
|---|---|
| `employee_id` | Many2one `hr.employee` |
| `asset_name` | Char |
| `asset_type` | Selection (16 نوعًا) |
| `serial` | Char |
| `assigned_date` | Date |
| `state` | Selection (requested/assigned/maintenance/returned/lost) |
| `product_id` | Many2one `product.product` (اختياري للربط بالمخزون) |

> **البديل:** موديول `maintenance` (`maintenance.equipment`) يغطّي جزءًا كبيرًا من إدارة العهد/المعدّات مع حالات الصيانة — يُفضّل تقييمه قبل بناء نموذج جديد.

---

## 6) `x.portal.announcement` — التعاميم

| الحقل | النوع |
|---|---|
| `title` | Char |
| `body_html` | Html |
| `priority` | Selection (عادي/مهم) |
| `audience` | Selection/Many2many (`hr.department`/الكل) |
| `pinned` | Boolean |
| `require_ack` | Boolean |
| `publish_date` | Datetime |
| `ack_ids` | One2many `x.portal.announcement.ack` |

**`x.portal.announcement.ack`:** `announcement_id, employee_id, read_at, acknowledged`. عدّاد القراءات = عدد سطور الـ ack.

---

## 7) `x.portal.location` — نطاقات الحضور (geofence)

| الحقل | النوع |
|---|---|
| `name` | Char (اسم الموقع/الفرع) |
| `latitude` / `longitude` | Float |
| `radius_m` | Integer (نصف القطر بالأمتار) |
| `branch_id` | Many2one (اختياري) |

يُستخدم للتحقق أن تسجيل الحضور داخل النطاق قبل كتابة `hr.attendance`. (منطق التحقق يعمل في الـ backend عبر Haversine؛ هذا النموذج يخزّن النطاقات فقط.)

**امتداد `hr.attendance` (حقول مخصّصة):** `x_geo_lat`, `x_geo_lng`, `x_in_range` (Boolean), `x_manual` (Boolean لتسجيل يدوي معتمد).

---

## 8) صلاحيات الوصول — `ir.model.access.csv`

نموذج مقترح (مبسّط — يُفصّل لكل مجموعة):

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_portal_request_user,portal.request.user,model_x_portal_request,base.group_user,1,1,1,0
access_portal_request_hr,portal.request.hr,model_x_portal_request,hr.group_hr_user,1,1,1,1
access_portal_audit_user,portal.audit.user,model_x_portal_audit,base.group_user,1,0,1,0
access_portal_letter_hr,portal.letter.hr,model_x_portal_letter,hr.group_hr_user,1,1,1,1
access_portal_custody_hr,portal.custody.hr,model_x_portal_custody,hr.group_hr_user,1,1,1,1
access_portal_announcement_hr,portal.ann.hr,model_x_portal_announcement,hr.group_hr_manager,1,1,1,1
access_portal_location_hr,portal.loc.hr,model_x_portal_location,hr.group_hr_manager,1,1,1,1
```

بالإضافة إلى **record rules** (`ir.rule`) لقصر رؤية الموظف على طلباته، والمدير على قسمه، وإخفاء الطلبات السرّية عن غير المخوّلين.

---

## 9) بيانات مرجعية (data)
- `ir.sequence` لرقم الطلب `HR-REQ-#####`.
- مجموعات أمان: `group_portal_manager`, `group_portal_hr`, `group_portal_finance`, `group_portal_it`, `group_portal_admin` (أو إعادة استخدام مجموعات hr القياسية).
- قوالب خطابات افتراضية (QWeb).
- أنواع العهد الافتراضية.

---

## 10) بنية الموديول المقترحة
```
sharqia_portal/
  __manifest__.py         (depends: base, hr, hr_holidays, hr_attendance, hr_expense, mail)
  models/
    portal_request.py  portal_audit.py  portal_permission.py
    portal_letter.py   portal_custody.py portal_announcement.py
    portal_location.py hr_attendance_geo.py
  security/
    ir.model.access.csv  security_groups.xml  record_rules.xml
  data/
    ir_sequence.xml  letter_templates.xml  custody_types.xml
  views/
    *.xml               (قوائم/نماذج للإدارة داخل Odoo)
  report/
    letter_reports.xml  (QWeb PDF للخطابات)
```

---

## 11) التوصية النهائية (المسار العملي)
1. **المرحلة الأولى (الأسرع للإنتاج):** أبقِ محرّك الطلبات والصلاحيات والتدقيق والتعاميم في الـ backend (مُنفّذ فعلًا)، وزامِن النتائج فقط إلى `hr.leave` / `hr.expense` القياسية. **لا حاجة لموديول مخصّص للإطلاق.**
2. **المرحلة الثانية (إن أردت Odoo مصدر الحقيقة الكامل):** نفّذ `sharqia_portal` بالنماذج أعلاه، وبدّل الـ backend من التخزين المحلي إلى قراءة/كتابة هذه النماذج عبر نفس طبقة `odooActions.js` (تغيير معزول).

هذا التدرّج يجعلك تُطلق سريعًا الآن، وتُعمّق التكامل لاحقًا دون إعادة بناء.
