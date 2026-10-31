// عامل الخدمة لتطبيق المبيعات (PWA): يجعل التطبيق قابلًا للتثبيت ويفتح سريعًا.
//   • الصفحة: من الشبكة أولًا (فيصل كل تحديث فورًا)، ومن الكاش إن انقطع النت.
//   • الملفات الثابتة والخطوط: من الكاش أولًا.
//   • /api/*: من الشبكة دائمًا — لا تُخزَّن بيانات الفواتير والأسعار أبدًا.
const VERSION = "sales-3.48.0";
const SHELL = ["/", "/static/logo.png", "/static/emblem.png", "/static/icons/icon-192.png",
  "/static/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put("/", copy));
      return res;
    }).catch(() => caches.match("/")));
    return;
  }
  const cacheable = url.origin === self.location.origin
    || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!cacheable) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
