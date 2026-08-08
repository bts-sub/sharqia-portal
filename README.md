# بوابة موظفي «بيت العباءة الشرقية» — الخادم الخلفي (Backend)

خادم Node.js + Express يربط واجهة بوابة الموظفين بـ **Odoo 19 Community**، مع **مصادقة محلية** (JWT + bcrypt)، وطبقة عمليات Odoo موحّدة، و**وضع اختبار** آمن يعمل بدون Odoo.

يعمل على **المنفذ 4000** (تتوقّعه الواجهة)، بجانب تطبيقك الآخر على 3001.

---

## المتطلبات
- Node.js 18 أو أحدث (أو Docker).
- خادم Odoo 19 يعمل مع تطبيقات: Employees، Time Off، Attendances (واختياريًا Expenses / Approvals).
- مستخدم خدمة في Odoo له صلاحيات HR المطلوبة فقط.

---

## 1) الإعداد السريع (بدون Docker)

```bash
cp .env.example .env          # ثم عدّل القيم (JWT_SECRET, ADMIN_*, ODOO_*)
npm install
npm start                     # يعمل على http://localhost:4000
```

عند أول تشغيل يُنشأ حساب مدير النظام تلقائيًا من `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> النظام يبدأ افتراضيًا بـ `TEST_MODE=true` (بيانات تجريبية). اضبطه `false` بعد إدخال بيانات Odoo.

---

## 2) الاتصال بـ Odoo

املأ في `.env`:

```
ODOO_URL=https://odoo.example.sa
ODOO_DB=sharqia-prod
ODOO_USER=portal-bot@sharqia.sa
ODOO_PASSWORD=مفتاح-API-أو-كلمة-المرور
TEST_MODE=false
```

- الاتصال عبر **JSON-RPC** (`/jsonrpc`)، مع **كاش للـ uid** (افتراضي 10 دقائق) لتفادي إعادة المصادقة في كل طلب.
- **كلمة مرور Odoo لا تُرسَل للواجهة إطلاقًا** — تبقى في الخادم فقط.
- افحص الاتصال من شاشة الإعدادات أو عبر: `POST /api/settings/test-connection`.

### الموديلات المستخدمة
| العملية | موديل Odoo |
|---|---|
| بيانات الموظف | `hr.employee` |
| الإجازات والأرصدة | `hr.leave`, `hr.leave.type`, `hr.leave.allocation` |
| الحضور | `hr.attendance` |
| المرفقات | `ir.attachment` |
| السلف/المصروفات | `hr.expense` (قيد الإضافة) |

---

## 3) وضع الاختبار (Test Mode)

- `TEST_MODE=true` **أو** فشل الاتصال بـ Odoo → يرجّع الخادم بيانات تجريبية آمنة من `src/fixtures.js` (وليست في الواجهة).
- `TEST_MODE=false` + اتصال ناجح → كل البيانات حقيقية من Odoo.
- يمكن لمدير النظام تبديل الوضع أثناء التشغيل: `POST /api/settings/test-mode { "enabled": true|false }`.
- حالة الاتصال تظهر في `GET /api/settings` (متصل بأودو / وضع تجريبي).

**عمليات الكتابة الحسّاسة** (إنشاء إجازة/حضور/مرفق) لا تُخفي أخطاء Odoo خلف بيانات تجريبية — تُرجع الخطأ صراحةً حتى لا يظنّ المستخدم أن العملية نجحت.

---

## 4) إدارة المستخدمين (CLI)

كل مستخدم بوابة مربوط بموظف Odoo عبر `--odoo <employeeId>`.

```bash
npm run users list
npm run users add -- --login m.alotaibi@sharqia.sa --name "محمد العتيبي" \
     --role employee --password "كلمة-قوية" --odoo 1042 --dept المشتريات --branch الرياض
npm run users passwd -- --login m.alotaibi@sharqia.sa --password "كلمة-جديدة"
npm run users del -- --login m.alotaibi@sharqia.sa
```

الأدوار المتاحة: `employee, manager, hr, finance, it, admin` — وهي التي تحدّد من يعتمد كل مرحلة في مسار الموافقات.

---

## 5) واجهة الـ API (ملخّص)

| المسار | الوصف |
|---|---|
| `POST /api/login` · `POST /api/logout` · `GET /api/me` | المصادقة المحلية (كوكي httpOnly) |
| `GET /api/employee/me` | بيانات الموظف الحالي |
| `GET /api/leave/balance` · `GET /api/leaves` · `GET /api/leave/types` | الإجازات والرصيد |
| `POST /api/requests` · `GET /api/requests?scope=mine\|inbox\|all` | إنشاء ومتابعة الطلبات |
| `POST /api/requests/:id/{approve,reject,comment,cancel}` | مسار الموافقات |
| `GET /api/notifications` · `POST /api/notifications/read-all` | الإشعارات |
| `POST /api/attachments` | رفع مرفق إلى `ir.attachment` |
| `POST /api/odoo` `{action, params}` | الطبقة الموحّدة لعمليات Odoo |
| `GET /api/settings` · `POST /api/settings/test-mode` | حالة الاتصال ووضع الاختبار |
| `GET /api/health` | فحص صحّة الخادم |

جميع مسارات `/api` (عدا `login` و`health`) محمية بالجلسة.

---

## 6) تقديم الواجهة (ملف HTML الواحد)

- ضع ملف الواجهة في `public/index.html` — وسيقدّمه الخادم تلقائيًا على `/`.
- بديل: اجعل Nginx يقدّم الملف مباشرة و يمرّر فقط `/api` إلى الخادم.

### التعديل المطلوب في الواجهة (بسيط)
الواجهة الحالية على وضع `demo`. للتشغيل الحقيقي:
1. غيّر `OdooIntegrationService.mode` من `"demo"` إلى `"live"`.
2. اجعل `authenticate()` ينادي `POST /api/login { login, password }` بدل مصادقة Odoo المباشرة، وخذ الدور من الرد.
3. `PROXY_URL` يبقى نفس الأصل (فارغ/نسبي) عند تقديم الواجهة من نفس الخادم.

> هذه التعديلات محدودة ومتوافقة مع شكل كائن `Me` الحالي. يمكنني تنفيذها في الملف الجاهز عند طلبك.

---

## 6.5) التكامل مع Odoo — منصّة التحكّم في المستخدمين

موديول Odoo `sharqia_portal` (مرفق منفصل) يديـر مستخدمي التطبيق من داخل Odoo ويرسل إليهم إشعارات وإجراءات عبر **جسر آمن بمفتاح مشترك**.

اضبط في `.env`:
```
INTEGRATION_TOKEN=مفتاح-سرّي-طويل-عشوائي   # نفس القيمة تُوضَع في Odoo (الإعدادات › بوابة الشرقية)
```

نقاط الجسر (محميّة بالمفتاح المشترك فقط عبر `Authorization: Bearer <token>`):

| المسار | الإجراء من Odoo |
|---|---|
| `POST /api/integration/users/upsert` | إنشاء/تحديث مستخدم تطبيق وربطه بموظف Odoo |
| `POST /api/integration/users/:login/status` | تفعيل/إيقاف مستخدم |
| `POST /api/integration/users/:login/reset-password` | تصفير كلمة المرور (تأتي مؤقتة من Odoo) |
| `POST /api/integration/notifications` | إرسال إشعار يظهر في التطبيق |
| `GET  /api/integration/health` | فحص الجسر |

- كلمات المرور تبقى في الـ backend فقط (bcrypt) ولا تُخزَّن في Odoo.
- الإشعارات المُرسَلة تظهر للمستخدم عبر `GET /api/notifications`.

---

## 7) النشر على DigitalOcean (Docker + Nginx + SSL)

```bash
# على الـ Droplet
git clone <repo> sharqia-backend && cd sharqia-backend
cp .env.example .env && nano .env        # املأ القيم الحقيقية
# ضع ملف الواجهة:
cp /path/to/portal.html public/index.html

docker compose up -d --build             # يعمل على 127.0.0.1:4000

# Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/portal
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portal.example.sa   # إصدار SSL تلقائيًا
```

- التطبيق لا يُعرَض مباشرة للإنترنت — فقط عبر Nginx على 443.
- مجلد `data/` (المستخدمون/الطلبات/الإشعارات) محفوظ كـ volume دائم.
- `COOKIE_SECURE=true` خلف HTTPS.

---

## 8) الأمان
- كلمات المرور مخزّنة bcrypt فقط، والجلسة بكوكي `httpOnly` + `secure`.
- تحديد معدل المحاولات على تسجيل الدخول (10 لكل 15 دقيقة).
- Helmet + CSP + compression.
- مستخدم Odoo للخدمة يجب أن يملك **صلاحيات HR اللازمة فقط** (مبدأ الأقل امتياز).
- لا تُخزَّن أي أسرار في الواجهة، ولا يُقبل أي سرّ Odoo من الواجهة.

---

## هيكل المشروع
```
src/
  server.js            نقطة التشغيل
  config.js            تحميل .env
  lib/  odooClient.js  (JSON-RPC + كاش uid)
        jwt.js users.js store.js settings.js workflow.js errors.js
  middleware/ auth.js rateLimit.js
  odooActions.js       الطبقة الموحّدة لعمليات Odoo
  fixtures.js          بيانات وضع الاختبار
  routes/  auth employee leaves requests notifications attachments settings odoo
bin/ users-cli.js      إدارة المستخدمين
deploy/ nginx.conf     نموذج Nginx
Dockerfile · docker-compose.yml · .env.example
```
