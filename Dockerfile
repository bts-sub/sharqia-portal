# صورة إنتاج خفيفة لبوابة موظفي بيت العباءة الشرقية
FROM node:20-alpine

WORKDIR /app

# تثبيت التبعيات أولاً (استغلال طبقات الكاش)
COPY package.json ./
RUN npm install --omit=dev

# نسخ الكود
COPY . .

# مجلد البيانات (users/requests/notifs) يجب أن يكون volume دائمًا
RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
