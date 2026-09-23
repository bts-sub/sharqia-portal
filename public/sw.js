// ===========================================================================
// sw.js — عامل الخدمة: يجعل البوابة قابلة للتثبيت ويُبقيها تفتح بلا اتصال.
//
// قواعد:
//   1) كتابةُ /api (POST/PATCH/DELETE) لا تُخزَّن أبدًا — تمرّ بمهلةٍ فلا تتعلّق.
//   2) قراءةُ /api (GET) تُخزَّن لتُقرأ بلا اتصال (وصولٌ سريع وعملٌ بلا نت)،
//      لكنها بيانات موظفٍ وجلسة — فتُمسح عند كل تسجيل دخولٍ أو خروج كي لا
//      يقرأ أحدٌ بياناتِ من سبقه على الجهاز نفسه.
//   3) لا شبكةَ بلا مهلة: على اتصالٍ بطيء نلجأ للذاكرة بدل ترك الواجهة معلّقة.
//   4) صفحةُ التطبيق تُعرَض من الذاكرة فورًا وتُحدَّث خلفَها (فتحٌ فوري).
// ===========================================================================
const VERSION = "v97";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
// ⚠️ ملفاتٌ لا تتغيّر أبدًا (محرّك العرض والخطوط والأيقونات): ذاكرتها لا
// تحمل رقم الإصدار، فلا تُمحى مع كل نشر. كانت تُمحى وتُنزَّل من جديد —
// ١٫٥ ميجابايت من pdf.js وحده — فيبطئ كل إصدارٍ أجهزةَ الموظفين جميعًا.
const STATIC = "static-v1";
const IMMUTABLE = /^\/(vendor|fonts|icons)\//;
const APIDATA = `apidata-${VERSION}`;      // كاش قراءات GET /api (للعمل بلا اتصال)

// fetch بمهلة: على شبكةٍ بطيئة لا تُترك الواجهة معلّقة إلى الأبد — علاج «بيقف كتير».
function fetchT(req, ms) {
  return new Promise((resolve, reject) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => { ctl.abort(); reject(new Error("timeout")); }, ms);
    fetch(req, { signal: ctl.signal }).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
async function clearApiCache() { try { await caches.delete(APIDATA); } catch (e) {} }

// ما يكفي لفتح التطبيق بلا شبكة
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/i18n.js",
  // الشعار: أول ما يراه الموظف في الدخول والرئيسية، فلا يُترك لشبكةٍ قد تتأخّر
  "/logo-mark.png?v=2",
  "/logo-mark-dark.png?v=1",
];

// لا يتغيّر بتغيّر الإصدار، فيُخزَّن مرّةً واحدة ويبقى
const PRECACHE_STATIC = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // محرّك عرض المستندات: تخزينه يجعل الخطاب يُفتح بلا انتظار تنزيله
  "/vendor/pdfjs/pdf.min.js",
  "/vendor/pdfjs/pdf.worker.min.js",
  "/fonts/IBMPlexSansArabic-Regular.ttf",
  "/fonts/IBMPlexSansArabic-SemiBold.ttf",
  "/fonts/Tajawal-Bold.ttf",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.addAll(PRECACHE)),
      caches.open(STATIC).then(async (c) => {
        // ما هو مخزَّنٌ سلفًا لا يُنزَّل ثانيةً
        const have = await c.keys();
        const has = new Set(have.map((r) => new URL(r.url).pathname));
        const need = PRECACHE_STATIC.filter((p) => !has.has(p));
        if (need.length) await c.addAll(need);
      }),
    ])
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // فشل تخزين أصل واحد لا يمنع التثبيت
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== SHELL && k !== ASSETS && k !== STATIC && k !== APIDATA)
      .map((k) => caches.delete(k)));
    await self.clients.claim();

    // (3) تطبيقٌ مثبّت على iOS لا تنتهي صفحته بإغلاقه — تُستعاد من الذاكرة
    //     بلا إعادة تحميل، فيبقى الموظف على حزمةٍ قديمة إلى الأبد مهما نُشر
    //     جديد. حين يُفعَّل عاملٌ جديد نُعيد تحميل كل نافذة مفتوحة بأنفسنا،
    //     فلا يحتاج أحد إلى إغلاق التطبيق يدويًّا.
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      try {
        if (typeof c.navigate === "function") await c.navigate(c.url);
        else c.postMessage("RELOAD");
      } catch { c.postMessage("RELOAD"); }
    }
  })());
});

// رسالة من الصفحة لتفعيل نسخة جديدة فورًا بعد النشر
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

// ───────────────────────────── إشعارات الخلفية ─────────────────────────────
// الإشعار يصل والتطبيق مغلق: هذا هو موضعه الوحيد. والصفحة لا تعمل حينها،
// فلا يُقرأ شيءٌ من حالتها — الحمولة تحمل كل ما يلزم لعرضه وفتحه.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  const title = d.title || "بوابة الموظفين";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    lang: "ar",
    dir: "rtl",
    tag: d.tag || "sharqia",
    renotify: true,
    // اهتزازٌ قصير: إشعار محضر تحقيق أو موعد استدعاء لا يُترك صامتًا في الجيب
    vibrate: [90, 60, 90],
    data: d.data || {},
    requireInteraction: !!d.requireInteraction,
  }));
});

// الضغط على الإشعار يفتح التطبيق على موضع الخبر لا على صفحته الرئيسية:
// إشعارٌ يقول «استدعاء للتحقيق» ثم يفتح الرئيسية يترك الموظف يبحث عن محضره.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const q = [];
  if (d.link) q.push("n=" + encodeURIComponent(d.link));
  if (d.penaltyId) q.push("pid=" + encodeURIComponent(d.penaltyId));
  if (d.reqId) q.push("req=" + encodeURIComponent(d.reqId));
  if (d.letterId) q.push("lid=" + encodeURIComponent(d.letterId));
  const url = "/" + (q.length ? "?" + q.join("&") : "");
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      // نافذةٌ مفتوحة: تُركَّز وتُبلَّغ بالوجهة بدل فتح نافذةٍ ثانية للتطبيق نفسه
      await w.focus();
      w.postMessage({ sq: "notif-open", data: d });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // لا نتدخّل في نطاق آخر

  // ─── /api: مهلةٌ فلا تتعلّق، وكاشُ قراءاتٍ للعمل بلا اتصال ───
  if (url.pathname.startsWith("/api/")) {
    // الدخول/الخروج: يمرّ ثم يُمسح كاش القراءات — بيانات جلسةٍ لا تُقرأ لمن بعده.
    if (url.pathname === "/api/login" || url.pathname === "/api/logout") {
      e.respondWith((async () => {
        try { return await fetchT(req, 20000); }
        finally { clearApiCache(); }
      })());
      return;
    }
    // الكتابة (رفع طلب…): مهلةٌ سخيّة كي لا تتعلّق للأبد ثم تفشل بوضوح — بلا
    // كاش ولا إعادةٍ تلقائية (إعادةُ POST بلا مفتاح تكرارٍ تُنشئ طلبين).
    if (req.method !== "GET") {
      e.respondWith(fetchT(req, 30000));
      return;
    }
    if (url.pathname.startsWith("/api/health")) return;   // فحوصٌ لا معنى لتخزينها
    // القراءات: الشبكة أولًا بمهلة، ثم آخر نسخةٍ محفوظة عند الانقطاع أو البطء.
    e.respondWith((async () => {
      try {
        const fresh = await fetchT(req, 8000);
        if (fresh && fresh.status === 200) {
          const c = await caches.open(APIDATA);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return (await caches.match(req, { cacheName: APIDATA })) || Response.error();
      }
    })());
    return;
  }

  if (req.method !== "GET") return;                       // غير /api وغير GET يمرّ كما هو

  // (2) صفحات التطبيق: النسخة المحفوظة تُعرض فورًا، والشبكة تُحدّثها خلفَها.
  //   كانت الشبكة أولًا، فكل فتحةٍ تنتظر تنزيل الصفحة كاملة (نحو 150 كيلوبايت
  //   مضغوطة) قبل أن يرى الموظف شيئًا. والنسخةُ الجديدة لا تضيع: الصفحة تسأل
  //   الخادم عن رقم النسخة بعد ثوانٍ من فتحها وكل خمس دقائق، فتُحدّث نفسها.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("/");
      const net = fetch(req).then(async (fresh) => {
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL);
          await cache.put("/", fresh.clone());
        }
        return fresh;
      }).catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) || Response.error();
    })());
    return;
  }

  // (3) ما لا يتغيّر: من الذاكرة مباشرةً بلا سؤال الشبكة.
  //   محرّك العرض ١٫٥ ميجابايت وخطوطٌ بمئات الكيلوبايت، وكلها ثابتة لا
  //   تتبدّل بإصدار. وكانت تُطلب من الشبكة في كل فتحة، فيقف الموظف ينتظر
  //   تنزيلها قبل أن يظهر الخطاب — وهو ما اشتُكي منه: «الخطاب يطول».
  if (IMMUTABLE.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { cacheName: STATIC });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === "basic") {
          const c = await caches.open(STATIC);
          c.put(req, res.clone());
        }
        return res;
      } catch {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // (4) بقيّة الأصول: الشبكة أولًا، والذاكرة شبكة نجاة عند انقطاعها.
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
