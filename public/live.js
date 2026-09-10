/* ===========================================================================
 * live.js — يُبقي التطبيق حيًّا: نسخةً وإشعاراتٍ.
 *
 * (1) التحديث التلقائي:
 *     كان الفحص يجري عند فتح التطبيق وعند عودته إلى الواجهة فقط. ومن يترك
 *     التطبيق مفتوحًا أمامه طوال اليوم لا يقع له أيّ منهما، فيبقى على نسخةٍ
 *     قديمة حتى يسجّل خروجًا ودخولًا. فأُضيف فحصٌ دوريّ.
 *
 * (2) الإشعارات الآتية من أودو:
 *     كانت تُقرأ مرّةً عند فتح التطبيق. فإشعارٌ يُرسَل من أودو بعد ذلك لا
 *     يظهر إلا في الفتحة التالية. فصار يُستطلَع دوريًّا، ويُنبَّه إليه:
 *     إشعارُ نظامٍ إن أذن المستخدم، وشريطٌ في الصفحة على كل حال.
 *
 * ملفٌّ مستقلّ لأن واجهة التطبيق حزمةٌ مبنيّة مصغَّرة، وكتابة هذا داخلها
 * تعديلُ شيفرةٍ لا تُقرأ.
 * =========================================================================== */
(function () {
  "use strict";

  var BUILD_EVERY = 3 * 60 * 1000;     // فحص النسخة كل ٣ دقائق
  var NOTIF_EVERY = 60 * 1000;         // استطلاع الإشعارات كل دقيقة
  var lastUnread = null;               // null = لم يُقرأ بعد؛ لا ننبّه لأول قراءة
  var barUp = false;

  function visible() { return document.visibilityState === "visible"; }

  /* ---------- (1) النسخة ---------- */
  function checkBuild() {
    if (!visible()) return;            // لا نُتعب الشبكة والتطبيق في الخلفية
    try { window.SQ_checkBuild && window.SQ_checkBuild(); } catch (e) {}
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration()
      .then(function (r) { if (r) r.update(); })
      .catch(function () {});
  }

  /* ---------- (2) الإشعارات ---------- */
  function bar(text) {
    if (barUp) return;
    barUp = true;
    var d = document.createElement("div");
    d.dir = "rtl";
    d.style.cssText = "position:fixed;inset-inline:0;bottom:14px;margin-inline:auto;width:max-content;" +
      "max-width:92vw;display:flex;align-items:center;gap:10px;z-index:2147483000;background:#17170F;" +
      "color:#fff;border-radius:999px;padding:9px 12px 9px 16px;font:600 13.5px/1.4 inherit;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.35)";
    var span = document.createElement("span");
    span.textContent = text;
    var go = document.createElement("button");
    go.textContent = "تحديث";
    go.style.cssText = "background:#C9A227;color:#17170F;border:0;border-radius:999px;padding:6px 14px;" +
      "font:800 13px inherit;cursor:pointer";
    go.onclick = function () { location.reload(); };
    var x = document.createElement("button");
    x.textContent = "✕";
    x.setAttribute("aria-label", "إغلاق");
    x.style.cssText = "background:transparent;color:#9A9A8C;border:0;font-size:17px;cursor:pointer;padding:2px 4px";
    x.onclick = function () { barUp = false; d.remove(); };
    d.appendChild(span); d.appendChild(go); d.appendChild(x);
    document.body.appendChild(d);
    // لا يبقى إلى الأبد: من لم يضغط «تحديث» يجدها في الفتحة التالية
    setTimeout(function () { barUp = false; try { d.remove(); } catch (e) {} }, 25000);
  }

  function systemNotice(count) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      var n = new Notification("العباءة الشرقية", {
        body: count === 1 ? "لديك إشعار جديد" : "لديك " + count + " إشعارات جديدة",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "sharqia-notifs",          // إشعارٌ واحد يتجدّد لا كومةٌ تتراكم
      });
      n.onclick = function () { try { window.focus(); } catch (e) {} location.reload(); };
    } catch (e) {}
  }

  function pollNotifs() {
    if (!visible()) return;
    fetch("/api/notifications", { credentials: "include", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !Array.isArray(j.records)) return;   // غير مسجَّل دخولًا أو خطأ
        var unread = j.records.filter(function (n) { return !n.read; }).length;
        if (lastUnread === null) { lastUnread = unread; return; }   // القراءة الأولى مرجع
        if (unread > lastUnread) {
          var fresh = unread - lastUnread;
          systemNotice(fresh);
          bar(fresh === 1 ? "وصلك إشعار جديد" : "وصلك " + fresh + " إشعارات جديدة");
        }
        lastUnread = unread;
      })
      .catch(function () {});
  }

  /* ---------- التشغيل ---------- */
  window.addEventListener("load", function () {
    setInterval(checkBuild, BUILD_EVERY);
    setInterval(pollNotifs, NOTIF_EVERY);
    setTimeout(pollNotifs, 8000);      // قراءةٌ مرجعية بعد أن يستقرّ التطبيق
  });

  // العودة إلى التطبيق: افحص فورًا بلا انتظار دورة المؤقّت
  document.addEventListener("visibilitychange", function () {
    if (visible()) { checkBuild(); pollNotifs(); }
  });

  /* طلب إذن إشعارات النظام — يُستدعى من زرّ في التطبيق أو من هنا مرّة واحدة
     بعد أول إشعار وارد. لا يُطلب عند الفتح: طلبٌ بلا سياقٍ يُرفض ولا يُعاد. */
  window.SharqiaAskNotifPermission = function () {
    try {
      if (!("Notification" in window) || Notification.permission !== "default") return;
      Notification.requestPermission().catch(function () {});
    } catch (e) {}
  };
})();
