// ===========================================================================
// push.js — تفعيل إشعارات الخلفية وتسجيل الجهاز، وحاجزٌ يمنع الاستعمال بدونها.
//
// الإشعار هو ما يُبلِّغ الموظف بمحضر تحقيقٍ أو موعد استدعاء أو طلبٍ ينتظر
// اعتماده. وقبل اليوم كان لا يصل إلا والتطبيقُ مفتوح، فيمضي اليوم والإجراء
// ينتظره وهو لا يدري. ولذلك صار التفعيل شرطًا لا خيارًا: التطبيق يطلب الإذن
// بنفسه، ولا يُفتح ما لم يُمنح.
//
// ولا يُطلب الإذن في شاشة الدخول: طلبٌ قبل أن يعرف الموظف ما التطبيق يُرفض
// في العادة، والرفض في المتصفّحات لا يُسأل عنه مرّةً ثانية.
// ===========================================================================
(function () {
  "use strict";
  var KEY_URL = "/api/push/key";
  var state = { key: "", gate: "block", exempt: false, ready: false };
  var overlay = null, asking = false, lastTry = 0;

  function h(tag, css, text) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (text != null) el.textContent = text;
    return el;
  }

  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || window.navigator.standalone === true;
  var supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  // ─── التطبيق الأصلي (Capacitor) ───
  // داخل غلاف التطبيق لا يوجد Web Push، فالإذن يُطلب أصليًّا عبر إضافة
  // الإشعارات المحليّة (تُظهر حوار الإذن على أندرويد، وزرًّا يفتح إعدادات
  // التطبيق إن مُنع). فوجودُ الإضافة يعني «مدعوم».
  var CAP = window.Capacitor;
  var isNative = !!(CAP && typeof CAP.isNativePlatform === "function" && CAP.isNativePlatform());
  var LN = (isNative && CAP.Plugins) ? CAP.Plugins.LocalNotifications : null;
  var PN = (isNative && CAP.Plugins) ? CAP.Plugins.PushNotifications : null;
  var NOTIF = PN || LN;                 // إضافة الإشعارات (الدفع FCM أولًا)
  if (NOTIF) supported = true;

  // تسجيل جهاز FCM: يطلب الدفع توكنًا فنرسله للخادم، فيصلك الإشعار والتطبيق
  // مغلق عبر خدمة جوجل. تُربَط المستمعات مرّةً واحدة.
  function registerFcm() {
    if (!PN) return Promise.resolve(false);
    if (!registerFcm._wired) {
      registerFcm._wired = true;
      try {
        PN.addListener("registration", function (t) {
          if (t && t.value) api("/api/push/native", { token: t.value }).catch(function () {});
        });
        PN.addListener("pushNotificationActionPerformed", function (ev) {
          try {
            var d = (ev && ev.notification && ev.notification.data) || {};
            if (window.SQ_navFn) {
              if (d.link === "discipline") window.SQ_navFn({ name: "discipline", focus: Number(d.penaltyId || 0) });
              else window.SQ_navFn({ name: "tab", tab: "notifs" });
            }
          } catch (e) {}
        });
      } catch (e) {}
    }
    return PN.register().then(function () { return true; }).catch(function () { return false; });
  }

  // navigator.geolocation لا يعمل داخل الغلاف الأصلي (WebView)، فنوجّه دواله
  // إلى إضافة Capacitor Geolocation: موقعٌ أصليّ بإذنٍ أصليّ. بهذا يعمل زرّ
  // «تحديد موقعي» وتسجيلُ الحضور دون تغيير كود الموقع في التطبيق.
  (function () {
    if (!navigator.geolocation) return;
    var origGet = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    var origWatch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    var origClear = navigator.geolocation.clearWatch.bind(navigator.geolocation);
    // القرار «أصلي/متصفّح» يُتّخذ لحظةَ الاستدعاء لا التحميل: جسرُ Capacitor قد
    // يتأخّر عن تنفيذ هذا الملف، فلو قرّرنا الآن فاتنا الغلاف. في المتصفّح
    // العادي نُبقي السلوك الأصلي.
    function capGeo() {
      var C = window.Capacitor;
      return (C && C.Plugins && typeof C.isNativePlatform === "function"
        && C.isNativePlatform()) ? C.Plugins.Geolocation : null;
    }
    function locSettings(opt) {
      try {
        var C = window.Capacitor, NS = C && C.Plugins ? C.Plugins.NativeSettings : null;
        if (NS && NS.openAndroid) return NS.openAndroid({ option: opt });
      } catch (e) {}
      return Promise.resolve();
    }
    // دقّةٌ عالية (GPS) دائمًا: الموقع الشبكيّ يبعد مئات الأمتار فيقع خارج النطاق.
    function toOpts(o) { o = o || {}; return { enableHighAccuracy: true, timeout: o.timeout || 20000, maximumAge: 0 }; }
    function get(ok, err, opts) {
      var G = capGeo();
      if (!G) return origGet(ok, err, opts);
      G.requestPermissions().catch(function () {}).then(function () {
        return G.getCurrentPosition(toOpts(opts));
      }).then(function (p) {
        try { ok({ coords: p.coords, timestamp: p.timestamp || Date.now() }); } catch (e) {}
      }).catch(function (e2) {
        var msg = (e2 && e2.message) || "";
        var denied = /denied|permission/i.test(msg);
        card(denied ? "إذن الموقع مطلوب" : "شغّل خدمة الموقع (GPS)",
          denied ? ["التطبيق يحتاج إذن الموقع لتسجيل الحضور.",
                    "افتح إعدادات التطبيق ← الأذونات ← الموقع ← اسمح."]
                 : ["خدمة الموقع مغلقة أو لا تلتقط إشارة.",
                    "شغّل «الموقع/GPS» من الإعدادات وكن في مكانٍ مكشوف ثم أعد المحاولة."],
          denied ? "فتح إعدادات التطبيق" : "فتح إعدادات الموقع",
          function () { locSettings(denied ? "application_details" : "location"); });
        if (err) try { err({ code: denied ? 1 : 2, message: msg || "location" }); } catch (x) {}
      });
    }
    var watches = {};
    function watch(ok, err, opts) {
      var G = capGeo();
      if (!G) return origWatch(ok, err, opts);
      var wid = "sq" + Math.random().toString(36).slice(2);
      G.requestPermissions().catch(function () {}).then(function () {
        return G.watchPosition(toOpts(opts), function (p, e) {
          if (e) { if (err) try { err({ code: 2, message: e.message || "location" }); } catch (x) {} return; }
          if (p && ok) try { ok({ coords: p.coords, timestamp: p.timestamp || Date.now() }); } catch (x) {}
        });
      }).then(function (id) { watches[wid] = id; }).catch(function () {});
      return wid;
    }
    function clearW(wid) {
      var G = capGeo();
      if (!G || !watches[wid]) return origClear(wid);
      try { G.clearWatch({ id: watches[wid] }); delete watches[wid]; } catch (e) {}
    }
    var shim = { getCurrentPosition: get, watchPosition: watch, clearWatch: clearW };
    try {
      navigator.geolocation.getCurrentPosition = get;
      navigator.geolocation.watchPosition = watch;
      navigator.geolocation.clearWatch = clearW;
    } catch (e) {}
    try { Object.defineProperty(navigator, "geolocation", { configurable: true, value: shim }); } catch (e2) {}
  })();

  function perm() {
    try { return Notification.permission; } catch (e) { return "unsupported"; }
  }

  function b64(base64) {
    var pad = "=".repeat((4 - (base64.length % 4)) % 4);
    var raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function api(path, body) {
    return fetch(path, {
      method: body ? "POST" : "GET",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // تسجيل الجهاز عند الخادم. يُعاد في كل إقلاع: الاشتراك ينتهي من تلقاء نفسه
  // أحيانًا (تنظيف المتصفّح أو تبديل الجهاز)، والتسجيل بالـ endpoint فلا يتكرّر.
  function subscribe() {
    if (!supported || perm() !== "granted" || !state.key) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (sub) return sub;
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64(state.key),
        });
      });
    }).then(function (sub) {
      return api("/api/push/subscribe", { subscription: sub.toJSON ? sub.toJSON() : sub })
        .then(function (r) { return r.ok; });
    }).catch(function () { return false; });
  }

  function ask() {
    if (asking || !supported) return Promise.resolve(perm());
    asking = true;
    return Promise.resolve()
      .then(function () { return Notification.requestPermission(); })
      .catch(function () { return perm(); })
      .then(function (p) { asking = false; return p; });
  }

  // ─────────────────────────── الحاجز ───────────────────────────
  function card(title, lines, actionLabel, onAction) {
    if (overlay) overlay.remove();
    overlay = h("div",
      "position:fixed;inset:0;z-index:2147483500;background:#0F0F0F;color:#fff;display:flex;" +
      "align-items:center;justify-content:center;padding:22px;direction:rtl;text-align:center;" +
      "font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif");
    var box = h("div", "max-width:420px;width:100%");
    var icon = h("div",
      "width:74px;height:74px;margin:0 auto 16px;border-radius:24px;background:#C9A22722;" +
      "display:grid;place-items:center;font-size:34px", "🔔");
    box.appendChild(icon);
    box.appendChild(h("div", "font-size:19px;font-weight:800;margin-bottom:10px", title));
    lines.forEach(function (l) {
      box.appendChild(h("div", "font-size:13.5px;line-height:2;color:#D6D6D6;margin-bottom:6px", l));
    });
    if (actionLabel) {
      var b = h("button",
        "margin-top:16px;width:100%;padding:14px;border:none;border-radius:13px;background:#C9A227;" +
        "color:#1B1B1B;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer", actionLabel);
      b.type = "button";
      b.onclick = onAction;
      box.appendChild(b);
    }
    var again = h("button",
      "margin-top:10px;width:100%;padding:12px;border:1px solid #ffffff33;border-radius:13px;" +
      "background:transparent;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer",
      "أعدتُ الضبط — أعد الفحص");
    again.type = "button";
    again.onclick = function () { location.reload(); };
    box.appendChild(again);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function clear() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function blockUnsupported() {
    if (isIOS && !standalone) {
      card("فعِّل الإشعارات لتستعمل التطبيق", [
        "على الآيفون لا تصل الإشعارات إلا بعد تثبيت التطبيق على الشاشة الرئيسية.",
        "١) اضغط زرّ «مشاركة» في أسفل المتصفّح.",
        "٢) اختر «إضافة إلى الشاشة الرئيسية».",
        "٣) افتح التطبيق من أيقونته، وستظهر لك رسالة السماح بالإشعارات — اضغط «سماح».",
      ], null, null);
    } else {
      card("متصفّحك لا يدعم الإشعارات", [
        "الإشعارات شرطٌ لاستعمال التطبيق: بها تصلك محاضر التحقيق والطلبات العاجلة.",
        "افتح التطبيق من متصفّح Chrome أو Safari حديث، أو ثبّته على الشاشة الرئيسية.",
      ], null, null);
    }
  }

  // ── الموقع ──
  // التواجد الفعلي شرطٌ للعمليات الإدارية، وخدمة الموقع مغلقةٌ تجعل الحضور
  // والانصراف مستحيلَين ثم يُكتشف ذلك في آخر الشهر. فتُطلب مع الإشعارات معًا
  // عند الفتح، لا عند أول بصمة.
  var geoState = "unknown";   // granted | denied | prompt | unsupported
  function geoCheck() {
    if (!navigator.geolocation) { geoState = "unsupported"; return Promise.resolve(geoState); }
    var q = navigator.permissions && navigator.permissions.query
      ? navigator.permissions.query({ name: "geolocation" }).catch(function () { return null; })
      : Promise.resolve(null);
    return q.then(function (st) {
      if (st && st.state) {
        geoState = st.state;                       // granted / denied / prompt
        if (st.state !== "prompt") return geoState;
      }
      // لا واجهةَ أذونات (سفاري): نسأل الموقع نفسه — الإذن الممنوح يردّ بموضع
      return new Promise(function (res) {
        navigator.geolocation.getCurrentPosition(
          function () { geoState = "granted"; res(geoState); },
          function (e) { geoState = e && e.code === 1 ? "denied" : "prompt"; res(geoState); },
          { timeout: 12000, maximumAge: 600000, enableHighAccuracy: false });
      });
    });
  }

  function askGeo() {
    if (!navigator.geolocation) return Promise.resolve("unsupported");
    return new Promise(function (res) {
      navigator.geolocation.getCurrentPosition(
        function () { geoState = "granted"; res(geoState); },
        function (e) { geoState = e && e.code === 1 ? "denied" : "prompt"; res(geoState); },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: true });
    });
  }

  function blockGeo(denied) {
    card("تشغيل خدمة الموقع مطلوب", denied ? [
      "منعتَ خدمة الموقع لهذا التطبيق، والموقع شرطٌ لتسجيل الحضور والانصراف وإثبات التواجد.",
      isIOS
        ? "من إعدادات الجهاز: الخصوصية والأمان ← خدمات الموقع ← بوابة الموظفين ← «أثناء استخدام التطبيق»."
        : "افتح إعدادات الموقع في المتصفّح (القفل بجوار العنوان) ← الموقع ← سماح.",
      "ثم أعد فتح التطبيق.",
    ] : [
      "الموقع شرطٌ لاستعمال التطبيق: به يُثبَت حضورك وانصرافك وتواجدك عند الإجراءات الإدارية.",
      "اضغط «تشغيل الموقع» ثم «سماح» في رسالة الجهاز.",
    ], denied ? null : "تشغيل الموقع", function () {
      askGeo().then(function () { check(true); });
    });
  }

  function blockDenied() {
    card("الإشعارات محظورة في جهازك", [
      "منعتَ الإشعارات لهذا التطبيق من قبل، والمتصفّح لا يسأل مرّةً ثانية.",
      isIOS
        ? "من إعدادات الجهاز: الإشعارات ← بوابة الموظفين ← السماح بالإشعارات."
        : "افتح إعدادات الموقع في المتصفّح (القفل بجوار العنوان) ← الإشعارات ← سماح.",
      "ثم أعد فتح التطبيق.",
    ], null, null);
  }

  function blockAsk() {
    card("تفعيل الإشعارات", [
      "بها تصلك محاضر التحقيق ومواعيد الاستدعاء والطلبات التي تنتظر اعتمادك.",
      "اضغط «تفعيل» ثم «سماح» في رسالة المتصفّح.",
    ], "تفعيل الإشعارات", function () {
      ask().then(function () { check(true); });
    });
  }

  function warnBanner() {
    clear();
    if (document.getElementById("sq-push-warn")) return;
    var bar = h("div",
      "position:fixed;left:0;right:0;bottom:96px;z-index:2147483400;margin:0 12px;padding:11px 13px;" +
      "border-radius:12px;background:#7C2D12;color:#fff;font-family:'IBM Plex Sans Arabic',sans-serif;" +
      "font-size:12.5px;font-weight:700;direction:rtl;display:flex;gap:10px;align-items:center;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.3)");
    bar.id = "sq-push-warn";
    bar.appendChild(h("span", "flex:1;line-height:1.7", "الإشعارات غير مفعّلة — لن تصلك محاضر التحقيق والطلبات العاجلة."));
    var b = h("button",
      "border:none;border-radius:9px;background:#fff;color:#7C2D12;font:inherit;font-weight:800;" +
      "padding:8px 11px;cursor:pointer", "تفعيل");
    b.type = "button";
    b.onclick = function () { ask().then(function () { check(true); }); };
    bar.appendChild(b);
    document.body.appendChild(bar);
  }

  function dropWarn() {
    var w = document.getElementById("sq-push-warn");
    if (w) w.remove();
  }

  // الفحص الكامل: الجلسة، ثم الدعم، ثم الإذن، ثم التسجيل.
  function check(afterAsk) {
    if (Date.now() - lastTry < 1200 && !afterAsk) return;
    lastTry = Date.now();
    return api(KEY_URL).then(function (r) {
      if (r.status === 401 || r.status === 403) { clear(); dropWarn(); return; }  // لم يدخل بعد
      if (!r.ok) return;                                                          // عطل خادم: لا نحجب
      return r.json().then(function (j) {
        state.key = j.key || "";
        state.gate = j.gate || "block";
        state.exempt = !!j.exempt;
        state.ready = true;
        var block = state.gate === "block" && !state.exempt;
        if (NOTIF) return nativeGate(block, afterAsk);   // التطبيق الأصلي: إذنٌ أصليّ + FCM
        if (!supported) { if (block) blockUnsupported(); else warnBanner(); return; }
        var p = perm();
        if (p === "granted") {
          // الإشعارات تمّت — يبقى الموقع
          return subscribe().then(function () { return geoGate(block); });
        }
        if (p === "denied") { if (block) blockDenied(); else warnBanner(); return; }
        // الإذن لم يُطلب بعد: يُطلب تلقائيًّا مرّةً، فإن لم يستجب المتصفّح
        // (يشترط لمسةً من المستخدم) عُرض الزرّ.
        if (!afterAsk) {
          return ask().then(function (res) {
            if (res === "granted") { return subscribe().then(function () { return geoGate(block); }); }
            if (res === "denied") { if (block) blockDenied(); else warnBanner(); return; }
            if (block) blockAsk(); else warnBanner();
          });
        }
        if (block) blockAsk(); else warnBanner();
      });
    }).catch(function () { /* بلا شبكة: لا يُحجب التطبيق */ });
  }

  /** بعد الإشعارات يأتي الموقع: الحاجز واحد، والشرطان يُطلبان في فتحةٍ واحدة. */
  function geoGate(block) {
    return geoCheck().then(function (st) {
      if (st === "granted" || st === "unsupported") { clear(); dropWarn(); return; }
      if (!block) { warnBanner(); return; }
      if (st === "denied") { blockGeo(true); return; }
      // "prompt": يُطلب الإذن مرّةً تلقائيًّا، وإلا فبزرٍّ صريح
      return askGeo().then(function (r2) {
        if (r2 === "granted" || r2 === "unsupported") { clear(); dropWarn(); return; }
        blockGeo(r2 === "denied");
      });
    });
  }

  // ─── حاجز التطبيق الأصلي: إذنُ إشعاراتٍ أصليّ + فتحُ الإعدادات ───
  // الموقع أيضًا يُطلب أصليًّا: في الغلاف لا يظهر حوار المتصفّح، فنطلب إذن
  // الموقع عبر إضافة Geolocation (حوار أندرويد) بعد الإشعارات — كما يريد
  // المستخدم «سماح» زي الإشعارات — فيعمل تسجيلُ الحضور بعده.
  function nativeGeo() {
    var G = CAP.Plugins && CAP.Plugins.Geolocation;
    if (!G) return Promise.resolve();
    return G.checkPermissions().then(function (st) {
      if (st && (st.location === "granted" || st.coarseLocation === "granted")) return;
      return G.requestPermissions();
    }).catch(function () {});
  }

  function nativeSettings() {
    try {
      var NS = CAP.Plugins && CAP.Plugins.NativeSettings;
      if (NS && NS.openAndroid) return NS.openAndroid({ option: "app_notification" });
      if (NS && NS.open) return NS.open({ optionAndroid: "app_notification" });
    } catch (e) {}
    return Promise.resolve();
  }

  function nativePanel(block, denied) {
    if (!block) { warnBanner(); return; }
    card("فعِّل إشعارات التطبيق", [
      "بها تصلك محاضر التحقيق ومواعيد الاستدعاء والطلبات التي تنتظر اعتمادك.",
      denied ? "الإشعارات محظورة — افتح إعدادات التطبيق وفعّلها ثم أعد الفحص."
             : "اضغط «تفعيل الإشعارات» ثم «سماح».",
    ], denied ? "فتح إعدادات التطبيق" : "تفعيل الإشعارات", function () {
      if (denied) { nativeSettings(); return; }
      NOTIF.requestPermissions().then(function (r) {
        if (permGranted(r)) { registerFcm(); clear(); check(true); }
        else { nativePanel(block, true); }
      }).catch(function () { nativePanel(block, true); });
    });
  }

  function permGranted(r) { return r && (r.receive || r.display) === "granted"; }
  function permDenied(r) { return r && (r.receive || r.display) === "denied"; }

  function nativeGate(block, afterAsk) {
    return NOTIF.checkPermissions().then(function (st) {
      if (permGranted(st)) { registerFcm(); return nativeGeo().then(function () { clear(); dropWarn(); }); }
      if (permDenied(st)) { if (block) nativePanel(block, true); else warnBanner(); return; }
      // "prompt": يُطلب الإذن مرّةً تلقائيًّا عند الفتح، وإلا فبزرٍّ صريح
      if (!afterAsk) {
        return NOTIF.requestPermissions().then(function (r) {
          if (permGranted(r)) { registerFcm(); return nativeGeo().then(function () { clear(); dropWarn(); }); }
          if (permDenied(r)) { if (block) nativePanel(block, true); else warnBanner(); return; }
          if (block) nativePanel(block, false); else warnBanner();
        }).catch(function () { if (block) nativePanel(block, false); });
      }
      if (block) nativePanel(block, false); else warnBanner();
    }).catch(function () { clear(); });   // فشلُ الإضافة لا يحجب التطبيق
  }

  window.SQ_PUSH = {
    state: function () {
      return { supported: supported, permission: perm(), gate: state.gate,
               standalone: standalone, ios: isIOS };
    },
    enable: function () { return ask().then(function () { return check(true); }); },
    devices: function () { return api(KEY_URL).then(function (r) { return r.json(); }); },
    test: function () { return api("/api/push/test", {}).then(function (r) { return r.json(); }); },
    recheck: function () { return check(true); },
  };

  // فتحُ الإشعار وهو مفتوح: عاملُ الخدمة يرسل الوجهة، والتطبيق ينتقل إليها.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (ev) {
      var d = ev.data;
      if (!d || d.sq !== "notif-open" || !window.SQ_navFn) return;
      try {
        if (d.data && d.data.link === "discipline") {
          window.SQ_navFn({ name: "discipline", focus: Number(d.data.penaltyId || 0) });
        } else {
          window.SQ_navFn({ name: "tab", tab: "notifs" });
        }
      } catch (e) {}
    });
  }

  // فتحُ الإشعار والتطبيق مغلق: عاملُ الخدمة يفتحه على «/؟n=…»، فتُقرأ
  // الوجهة هنا بعد إقلاع الواجهة ثم يُنظَّف العنوان فلا يتكرّر الانتقال.
  function deepLink() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var n = q.get("n"), pid = Number(q.get("pid") || 0);
    if (!n) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (window.SQ_navFn) {
        clearInterval(timer);
        try {
          if (n === "discipline") window.SQ_navFn({ name: "discipline", focus: pid });
          else window.SQ_navFn({ name: "tab", tab: "notifs" });
        } catch (e) {}
        try { history.replaceState(history.state, "", location.pathname); } catch (e) {}
      } else if (tries > 40) clearInterval(timer);
    }, 500);
  }

  function boot() { deepLink(); setTimeout(function () { check(false); }, 2500); }
  if (document.readyState === "complete" || document.readyState === "interactive") boot();
  else document.addEventListener("DOMContentLoaded", boot);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) check(true);
  });
  // بعد تسجيل الدخول تتغيّر الجلسة ولا تُعاد الصفحة: فحصٌ دوريّ خفيف يلتقطها.
  setInterval(function () { check(false); }, 20000);
})();
