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
  // المرجع أكبر رقم إشعارٍ رآه هذا المستخدم على هذا الجهاز، محفوظًا بين
  // الجلسات. وكان المرجع يُؤخذ من أول استطلاعٍ في الصفحة — وهو يقع قبل
  // تسجيل الدخول فيعود بصفر، فتُحسب إشعاراتُ الموظف كلّها «جديدة» لحظةَ
  // دخوله. ومفتاحه باسم المستخدم: جهازٌ يتناوبه اثنان لا يرث أحدهما مرجع
  // الآخر.
  var seenKey = null;
  var lastActivity = Date.now();
  ["click", "keydown", "input", "touchstart", "scroll"].forEach(function (ev) {
    window.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
  });

  function typing() {
    var a = document.activeElement;
    return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable));
  }
  function idle() { return Date.now() - lastActivity > 15000; }
  function readSeen() { try { return Number(localStorage.getItem(seenKey) || 0); } catch (e) { return 0; } }
  function writeSeen(v) { try { localStorage.setItem(seenKey, String(v)); } catch (e) {} }

  function identify() {
    return fetch("/api/me", { credentials: "include", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var id = j && j.user && j.user.id;
        seenKey = id ? "sq.notifSeen." + id : null;
        return !!seenKey;
      })
      .catch(function () { return false; });
  }

  function pollNotifs() {
    if (!visible()) return;
    if (!seenKey) { identify().then(function (ok) { if (ok) pollNotifs(); }); return; }
    fetch("/api/notifications", { credentials: "include", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !Array.isArray(j.records)) return;   // خرج من الجلسة أو خطأ
        var ids = j.records.map(function (n) {
          return Number(String(n.id).replace(/\D/g, "")) || 0;
        });
        var maxId = ids.length ? Math.max.apply(null, ids) : 0;
        var seen = readSeen();
        if (!seen) { writeSeen(maxId); return; }        // أول تشغيلٍ لهذا المستخدم
        if (maxId <= seen) return;

        var fresh = ids.filter(function (i) { return i > seen; }).length;
        writeSeen(maxId);
        systemNotice(fresh);
        // التحديث يجري بنفسه: من طلب إشعارًا جديدًا يريد رؤيته لا زرًّا
        // يضغطه. ولا نُعيد التحميل وأصابعه على لوحة المفاتيح — نصٌّ نصف
        // مكتوب يضيع، فيُعرض الشريط بدلًا منه.
        if (!typing() && idle()) location.reload();
        else bar(fresh === 1 ? "وصلك إشعار جديد" : "وصلك " + fresh + " إشعارات جديدة");
      })
      .catch(function () {});
  }



  /* ---------- ربط زرّ التحديث الموجود في التطبيق ----------
   * للتطبيق زرّ تحديثٍ خاصّ به يعيد جلب البيانات، ولا يفحص وجود نسخةٍ
   * أحدث. فبدل زرٍّ ثانٍ عائم فوقه — زرّان لغرضٍ واحد يربكان — نُصغي
   * لضغطته ونفحص النسخة معها بصمت.
   */
  document.addEventListener("click", function (ev) {
    try {
      var t = ev.target && ev.target.closest && ev.target.closest('[title="تحديث"]');
      if (t) checkBuild();
    } catch (e) {}
  }, true);
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
