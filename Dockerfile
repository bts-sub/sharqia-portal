# صورة إنتاج خفيفة لبوابة موظفي بيت العباءة الشرقية
FROM node:20-alpine

WORKDIR /app

# تثبيت التبعيات أولاً (استغلال طبقات الكاش)
#   npm ci مع package-lock: كل بناء مطابق للسابق بالضبط. npm install وحده
#   كان يتجاهل القفل فيجلب إصدارات أحدث بصمت — بناءان من نفس الكوميت قد
#   يختلفان، فيصعب تفسير عطل يظهر بعد النشر.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# نسخ الكود
COPY . .

# مجلد البيانات (users/requests/notifs) يجب أن يكون volume دائمًا
RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
