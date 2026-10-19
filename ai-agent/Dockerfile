# منصّة المساعدين الأذكياء — صورة إنتاج خفيفة.
# الواجهة (web/dist) مبنية مسبقًا ومرفوعة في git: بناء React على سيرفر 512MB
# قد يلتهم الذاكرة ويُسقط الخدمات المجاورة.
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY web/dist ./web/dist

RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production PORT=4200
EXPOSE 4200
CMD ["node", "server/index.js"]
