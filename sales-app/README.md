# تطبيق المبيعات (Sales / POS) — حاوية مستقلّة

واجهة **`index.html`** (JS نقي، PWA) تُخدَم من حاوية **nginx ثابتة**، وتنادي `/api/sales/*` في باك-إند البوابة
(`src/routes/sales.js`) الذي يكلّم أودو. الصلاحيات تُفرض في أودو لا هنا.

- **عميل خارجي:** فاتورة ماي فاتورة بالمنتجات والشحن ولينك دفع. كل بائع يرى عملاءه فقط. (أدون `sharqia_sales_app`)
- **عميل داخلي (المعرض):** طلب يتحوّل بين الأقسام ثم يصل **كاشير نقطة البيع في أودو** مسودّةً بضريبتها، وكل سطر
  يخرج من مخزون قسمه. التحصيل والمرتجع والطباعة من شاشة الكاشير. (أدون `sharqia_sales_app_pos`)
- **لوحة مبيعات لكل موظف**، و**استلام مخزن الفرع واعتماد الجودة** للمشرف.
- **قراءة جواز السفر:** tesseract.js على الجوال — الصورة لا تُرفع، وأرقام تحقّق MRZ ترفض القراءة الخاطئة.
- `demo.html` على `/demo`: تصميم العرض الأصلي ببيانات وهمية.

- **الحاوية:** `sharqia-sales` (خدمة `sales` في [../docker-compose.yml](../docker-compose.yml))
- **البورت الداخلي:** `127.0.0.1:4100` → خلف Nginx الأمامي فقط
- **الدومين:** `pos.sharqiaa-tech.net`
- **الذاكرة:** محدودة 64m

## التحديث
الملف `index.html` يُنسخ من مصدر التصميم. بعد تغييره:

```bash
# محليًا: استبدل sales-app/index.html ثم ارفع
git add sales-app/index.html && git commit -m "تحديث واجهة المبيعات" && git push

# على السيرفر:
ssh root@159.223.186.156 "cd ~/sharqia-portal && git pull origin main && docker compose up -d sales"
```
`index.html` و `nginx.conf` مركّبان كـ volume للقراءة فقط، فالتحديث لا يحتاج إعادة بناء — فقط `up -d sales` (أو `restart sales`).

## أول نشر — الدومين والشهادة
1. أضِف في GoDaddy سجلّ **CNAME**: `pos` → `hr.sharqiaa-tech.net`.
2. على السيرفر: بلوك Nginx أمامي في `/etc/nginx/sites-available/pos.sharqiaa-tech.net` يعمل proxy لـ `127.0.0.1:4100`.
3. شهادة TLS: `certbot --nginx -d pos.sharqiaa-tech.net -n --redirect` (تجديد تلقائي).
