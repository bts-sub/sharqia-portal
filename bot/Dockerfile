# صورة خفيفة لبوت تيليجرام — تعمل بجوار البوابة على نفس السيرفر الصغير.
FROM node:20-alpine

WORKDIR /app

# التبعيات أولًا (كاش الطبقات). لا يوجد package-lock بعد → npm install.
COPY package.json ./
RUN npm install --omit=dev

# الكود + ملفات المعرفة (knowledge/*.md تُحمَّل وقت التشغيل)
COPY . .

# مجلد البيانات (محادثات المستخدمين) يجب أن يكون volume دائمًا
RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
