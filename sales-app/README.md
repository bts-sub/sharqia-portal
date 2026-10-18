# تطبيق المبيعات (Sales / POS) — حاوية مستقلّة

تطبيق واجهة **مستقلّ بالكامل** (React مضمّن داخل `index.html`، بلا باك-إند).
يُخدَم عبر حاوية **nginx ثابتة خفيفة** منفصلة عن بوابة الموظفين.

- **الحاوية:** `sharqia-sales` (خدمة `sales` في [../docker-compose.yml](../docker-compose.yml))
- **البورت الداخلي:** `127.0.0.1:4100` → خلف Nginx الأمامي فقط
- **الدومين:** `pos.sharqiaa-tech.net`
- **الذاكرة:** محدودة 64m (السيرفر 512MB؛ nginx الثابت يستهلك أقل من ذلك فعليًا)

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
