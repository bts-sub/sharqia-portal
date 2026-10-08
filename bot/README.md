# بوت تيليجرام «بيت العباءة الشرقية»

مساعد ذكي على تيليجرام مدعوم بـClaude. يرد على الأسئلة ويقدّم تحليلات عن
بيانات الشركة. يعمل بالـlong-polling (لا يحتاج webhook ولا تعديل Nginx).

## الإعداد (مرة واحدة)
1. أنشئ البوت: في تيليجرام كلّم `@BotFather` → `/newbot` → خذ التوكن.
2. مفتاح Claude: من console.anthropic.com → API Keys.
3. ضع القيم في `.env` على السيرفر (نفس ملف البوابة):
   ```
   TELEGRAM_BOT_TOKEN=...
   ANTHROPIC_API_KEY=sk-ant-...
   CLAUDE_MODEL=claude-sonnet-5-5
   BOT_ADMIN_CHAT_ID=   # رقمك (اختياري، من /id)
   ```
   باقي المفاتيح في `.env.example`.

## التشغيل (مع البوابة)
```
cd ~/sharqia-portal
git pull origin main
docker compose up -d --build bot
docker compose logs -f bot
```

## الأوامر داخل تيليجرام
- `/start` و `/help` — ترحيب ومساعدة
- `/report` — ملخّص أرشيف بيانات الشركة
- `/reset` — محادثة جديدة (نسيان السياق)
- `/id` — رقمك في تيليجرام
- `/ping` — فحص الحالة والموديل

## التحكّم
- **إيقاف مؤقّت:** `BOT_ENABLED=false` في `.env` ثم إعادة تشغيل الخدمة.
- **قصر الاستخدام على أشخاص:** `BOT_ALLOWED_USERS=111,222` (أرقام تيليجرام).
- **كود دخول:** `BOT_ACCESS_CODE=سرّ` — يرسله المستخدم مرة ليُفعَّل.

## المعرفة
`knowledge/*.md` تُحمَّل وقت الإقلاع وتُحقن في تعليمات النظام. لتحديث ما يعرفه
البوت عن الشركة، عدّل `knowledge/company-data.md` ثم أعد تشغيل الخدمة.
