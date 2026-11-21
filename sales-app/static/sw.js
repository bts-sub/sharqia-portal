// عامل الخدمة لتطبيق المبيعات (PWA): يجعل التطبيق قابلًا للتثبيت ويفتح سريعًا.
//   • الصفحة: من الشبكة أولًا (فيصل كل تحديث فورًا)، ومن الكاش إن انقطع النت.
//   • الملفات الثابتة والخطوط: من الكاش أولًا.
//   • /api/*: من الشبكة دائمًا — لا تُخزَّن بيانات الفواتير والأسعار أبدًا.
const VERSION = "sales-3.97.0";
// ترجمة إشعارات الجوال بلغة التطبيق (يحفظها التطبيق في كاش «sales-prefs»). إن تعذّر تحميلها بقيت عربية.
try { importScripts("/static/i18n-dict.js?v=3.97.0", "/static/i18n.js?v=3.97.0"); } catch (err) { /* عربي كما هو */ }
const PREFS = "sales-prefs";
const appLang = () => caches.open(PREFS).then((c) => c.match("/__lang")).then((r) => (r ? r.text() : "ar")).catch(() => "ar");
const SHELL = ["/", "/static/logo.png", "/static/emblem.png", "/static/icons/icon-192.png",
  "/static/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== PREFS).map((k) => caches.delete(k))))
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

// إشعارات الجوال (Web Push من أودو): طلب بضاعة أو موافقة لمدير الفروع، وقرار المدير للطالب. تصل والتطبيق مغلق.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(appLang().then((lang) => {
    const tr = (t) => (self.I18N && t ? self.I18N.tr(t, lang) : t);
    const ltr = lang === "en" || lang === "fr";
    return self.registration.showNotification(tr(d.title || "تطبيق المبيعات"), {
      body: tr(d.body || ""), tag: d.tag || "sales-app", renotify: true, dir: ltr ? "ltr" : "rtl", lang: lang || "ar",
      icon: "/static/icons/icon-192.png", badge: "/static/icons/icon-192.png", data: { url: d.url || "/" },
    });
  }));
});

// لمس الإشعار: يفتح التطبيق (أو يُظهره إن كان مفتوحًا) على الشاشة المعنيّة (/?go=approvals …)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) {
      win.postMessage({ type: "sales-go", url });
      return win.focus();
    }
    return self.clients.openWindow(url);
  }));
});
