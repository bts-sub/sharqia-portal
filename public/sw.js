// ===========================================================================
// sw.js — عامل الخدمة: يجعل البوابة قابلة للتثبيت ويُبقيها تفتح بلا اتصال.
//
// قاعدتان لا تُخالَفان:
//   1) لا يُخزَّن أي رد من /api إطلاقًا. الردود تحمل بيانات الموظف وجلسته،
//      وتخزينها على القرص يجعلها تُقرأ بعد الخروج أو على جهاز مشترك.
//   2) صفحة التطبيق تُطلب من الشبكة أولًا. لو خُدِّمت من الذاكرة أولًا لبقي
//      الموظف على نسخة قديمة بعد كل نشر حتى يفرّغ ذاكرة متصفحه.
// ===========================================================================
const VERSION = "v31";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

// ما يكفي لفتح التطبيق بلا شبكة
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/i18n.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // فشل تخزين أصل واحد لا يمنع التثبيت
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// رسالة من الصفحة لتفعيل نسخة جديدة فورًا بعد النشر
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // POST/PATCH تمرّ كما هي

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // لا نتدخّل في نطاق آخر
  if (url.pathname.startsWith("/api/")) return;           // (1) بيانات الجلسة لا تُخزَّن

  // (2) صفحات التطبيق: الشبكة أولًا، والذاكرة شبكة نجاة عند انقطاعها
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put("/", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // (3) الأصول: الشبكة أولًا كذلك، والذاكرة شبكة نجاة عند انقطاعها.
  //   كانت «الذاكرة أولًا مع تحديث في الخلفية»، وهي تُخدّم النسخة السابقة
  //   دائمًا: بعد كل نشر يبقى الموظف على i18n.js القديم حتى الفتحة التالية —
  //   فيرى قاموس ترجمة متأخرًا بإصدار كامل ويظنّ أن الترجمة لم تُصلَح.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === "basic") {
        const c = await caches.open(ASSETS);
        c.put(req, res.clone());
      }
      return res;
    } catch {
      return (await caches.match(req)) || Response.error();
    }
  })());
});
