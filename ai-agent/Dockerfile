# منصّة المساعدين الأذكياء — صورة إنتاج خفيفة.
# الواجهة (web/dist) مبنية مسبقًا ومرفوعة في git: بناء React على سيرفر 512MB
# قد يلتهم الذاكرة ويُسقط الخدمات المجاورة.
FROM node:20-alpine
WORKDIR /app

# المكتبات تبقى ملكًا لـroot (قراءة فقط للتطبيق). لا `chown -R /app` هنا:
# كان ينسخ node_modules كلها في طبقة ثانية فيتضاعف حجم الصورة على قرص صغير.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY web/dist ./web/dist

# مجلد البيانات وحده قابل للكتابة (ويُركَّب volume في الإنتاج)
RUN mkdir -p /app/data && chown node:node /app/data
USER node

ENV NODE_ENV=production PORT=4200
EXPOSE 4200
CMD ["node", "server/index.js"]
