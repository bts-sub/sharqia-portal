// ===========================================================================
// schedule-entry.js — بطاقةُ «جدولي» في شاشة «حسابي»
//
// ⚠️ لماذا حقنٌ لا تعديلٌ في الحزمة: public/index.html حزمةُ React مبنيّةٌ
//    مُصغَّرة لا مصدرَ لها في الريبو. وكلُّ سطرٍ يُكتب داخلها يُقرأ بعدها
//    بصعوبة، ويضيع يومَ تُعاد بناؤها. وهذا الملفُّ يُحقَن سطرًا واحدًا عند
//    إقلاع الخادم (src/server.js)، فيبقى ولو استُبدلت الحزمةُ كلُّها.
//
// ⚠️ والمرساةُ نصٌّ لا سِمة: صفوفُ «حسابي» بطاقاتٌ بلا role ولا title —
//    أيقونةٌ ثمّ كتلةُ نصٍّ (عنوانٌ وسطرٌ تحته) ثمّ سهم. فيُبحث عن العنوان
//    نصًّا، ويُصعَد منه درجتين إلى الصفّ. (أوّلُ محاولةٍ بحثت عن
//    [role=button][title=…] فلم تُطابق شيئًا ولم تظهر البطاقة.)
//
// ⚠️ وهو مُضيفٌ لا مُغيّر: يستنسخ صفًّا قائمًا فيأخذ شكلَه تمامًا، ويُدرجه
//    قبله. وإن تبدّلت البنيةُ فلم يجد مرساه، لم تظهر البطاقةُ ولم ينكسر شيء.
//
// ⚠️ والميزةُ نفسُها ليست هنا: هذه بطاقةُ دخولٍ إلى /schedule، وتلك صفحةٌ
//    بمصدرٍ كاملٍ مقروء (public/schedule.js).
// ===========================================================================
(function () {
  "use strict";
  var ID = "sq-schedule-entry";
  // مراسٍ بالترتيب: أوّلُ ما يوجد منها يُدرَج قبله. وتعدُّدُها لأنّ أيَّ
  // بطاقةٍ قد تُعاد تسميتُها، فلا يتعلّق المدخلُ باسمٍ واحد.
  var ANCHORS = ["بطاقتي المهنية", "الشهادات المهنية", "إدارة اختصاراتي",
    "بيانات العمل"];
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
    + ' width="20" height="20"><rect x="3" y="4.5" width="18" height="16"'
    + ' rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>'
    + '<path d="M8 14h3M8 17.5h6"/></svg>';

  function titleNode(text) {
    try {
      return document.evaluate(
        '//div[not(*) and normalize-space(.)="' + text + '"]',
        document, null, 9 /* FIRST_ORDERED_NODE_TYPE */, null).singleNodeValue;
    } catch (e) { return null; }
  }

  // الصفُّ هو جدُّ العنوان: العنوانُ داخل كتلةِ النصّ، وكتلةُ النصّ داخل
  // البطاقة التي فيها الأيقونةُ والسهم.
  function findRow() {
    for (var i = 0; i < ANCHORS.length; i++) {
      var t = titleNode(ANCHORS[i]);
      if (!t || !t.parentElement) continue;
      var row = t.parentElement.parentElement;
      if (row && row.parentElement && row.children.length >= 2) return row;
    }
    return null;
  }

  function build(row) {
    // لونُ الأيقونة يُقرأ من الأصل قبل الاستنساخ: المستنسَخُ خارج الصفحة
    // فلا تُحسب أنماطُه، ويخرج السهمُ والأيقونةُ بلا لون.
    var src = row.querySelector("svg");
    var col = "";
    try { col = src ? (getComputedStyle(src).color || "") : ""; } catch (e) { col = ""; }

    var card = row.cloneNode(true);
    card.id = ID;
    var svg = card.querySelector("svg");
    if (svg && svg.parentNode) {
      var holder = svg.parentNode;
      holder.innerHTML = ICON;
      var neu = holder.querySelector("svg");
      if (neu && col) neu.style.color = col;
    }
    var block = card.children[1];
    if (block && block.children.length) {
      if (block.children[0]) block.children[0].textContent = "مهامي وجدولي";
      if (block.children[1]) block.children[1].textContent = "المهامّ والجدول الأسبوعي";
    }
    card.style.cursor = "pointer";
    // المرحلةُ الملتقِطة: الحزمةُ تلتقط النقراتِ من الجذر، فلو تُركت تصعد
    // لحاولت فتحَ شاشةِ البطاقة المنسوخة.
    card.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openSchedule();
    }, true);
    return card;
  }
  // ══ الفتحُ داخل التطبيق لا في صفحةٍ أخرى ════════════════════════════
  // ⚠️ كان الضغطُ يُغادر إلى /schedule، فيختفي شريطُ التبويبات ويبدو
  //    كأنّه موقعٌ خارجيّ. والصفحةُ لا يمكن أن تُرسَم داخل شجرة React
  //    (لا مصدرَ للحزمة)، فتُعرض في إطارٍ على نفس النطاق فوق التطبيق.
  //
  // ⚠️ والطبقةُ تُقصَر على **جوف** قشرةِ التطبيق لا على الشاشة كلِّها:
  //    تحت الشريط العلويّ (التحيّةُ والصورة)، وفوق شريط التبويبات، وفي
  //    عرض عمودِه (٤٤٠ متوسِّطة). وأوّلُ محاولةٍ بدأت من أعلى الشاشة
  //    وامتدّت إلى حافّتيها، فغطّت الشريطَ العلويَّ وبرزت خارج العمود —
  //    فبقي المستخدمُ يراها «صفحةً جديدة» وإن كانت داخلَه فعلًا.
  //    والقياسُ من الشريطين أنفسِهما لا بأرقامٍ منسوخةٍ من الحزمة.
  var OV = "sq-schedule-overlay";

  // شريطُ التبويبات: عنصرٌ ثابتٌ أسفلَ الشاشة فيه «الرئيسية».
  function findNav() {
    var all = document.body.getElementsByTagName("div");
    for (var i = all.length - 1; i >= 0; i--) {
      var n = all[i], s;
      if (n.offsetHeight < 34 || n.offsetHeight > 130) continue;
      if (n.textContent.indexOf("الرئيسية") < 0) continue;
      try { s = getComputedStyle(n); } catch (e) { continue; }
      if (s.position === "fixed" && parseInt(s.bottom, 10) === 0) return n;
    }
    return null;
  }

  function closeSchedule() {
    var ov = document.getElementById(OV);
    if (ov) ov.remove();
  }

  // شريطُ التطبيقِ العلويّ: لاصقٌ عند الصفر فيه تحيّةُ المستخدم وصورتُه.
  // ⚠️ وهو موضعُ العلّة الأولى: كان الإطارُ يبدأ من أعلى الشاشة فيُغطّيه،
  //    فتختفي هُويّةُ التطبيق ويبدو ما تحتَها صفحةً أخرى. (وفي الحزمة:
  //    رأسُ كلِّ شاشةٍ لاصقٌ عند top:78 — أي أنّ فوقه هذا الشريط.)
  function findTopBar() {
    var all = document.body.getElementsByTagName("div");
    for (var i = 0; i < all.length; i++) {
      var n = all[i], s, r;
      if (n.offsetHeight < 44 || n.offsetHeight > 150) continue;
      try { s = getComputedStyle(n); } catch (e) { continue; }
      if (s.position !== "sticky" || parseInt(s.top, 10) !== 0) continue;
      if (parseInt(s.zIndex, 10) < 10) continue;
      r = n.getBoundingClientRect();
      if (r.top > 2 || r.width < 120) continue;
      return n;
    }
    return null;
  }

  // داكنٌ أم فاتح؟ يُقرأ من خلفية التطبيق لا من تفضيل النظام: الداكنُ في
  // التطبيق اختيارٌ في إعداداته، فلو سألنا النظامَ لخرج الإطارُ داكنًا
  // وما حولَه فاتحًا.
  function themeOf() {
    var c = "";
    try { c = getComputedStyle(document.body).backgroundColor || ""; } catch (e) { return "light"; }
    var m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return "light";
    var lum = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
    return lum < 0.5 ? "dark" : "light";
  }

  function openSchedule(tab) {
    // مفتوحٌ أصلًا وجاء إشعارٌ بتبويبٍ آخر: يُنقل الإطارُ إليه بدل أن
    // يُترك على ما كان، فالمُشعَرُ ضغط ليرى شيئًا بعينه.
    var cur = document.getElementById(OV);
    if (cur) {
      if (tab) {
        var f0 = cur.querySelector("iframe");
        if (f0) f0.src = "/schedule?embed=1&theme=" + themeOf() + "&t=" + tab;
      }
      return;
    }
    var nav = findNav();
    var bar = findTopBar();
    var navH = nav ? nav.offsetHeight : 0;
    var topH = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
    var z = 900;
    try {
      var nz = nav ? parseInt(getComputedStyle(nav).zIndex, 10) : 0;
      if (nz > 1) z = nz - 1;
      var bz = bar ? parseInt(getComputedStyle(bar).zIndex, 10) : 0;
      if (bz > 1 && bz - 1 < z) z = bz - 1;
    } catch (e) { /* يبقى الافتراضيّ */ }
    var bg = "#FAFAFA";
    try { bg = getComputedStyle(document.body).backgroundColor || bg; } catch (e) {}

    // ⚠️ وعرضُ الإطارِ عرضُ عمودِ التطبيق لا عرضَ الشاشة: الحزمةُ تحصر
    //    نفسَها في ٤٤٠ متوسِّطة، فإطارٌ يمتدّ إلى الحافّتين يبرز خارجَ
    //    العمود فيبين غريبًا ولو تطابقت الألوانُ كلُّها. ويُقاس من الشريط
    //    السفليّ نفسِه ليحاذيَه تمامًا مهما تغيّر الرقمُ في الحزمة.
    var ref = nav || bar;
    var box = ref ? ref.getBoundingClientRect() : null;

    var ov = document.createElement("div");
    ov.id = OV;
    ov.style.cssText = "position:fixed;top:" + topH + "px;bottom:" + navH
      + "px;z-index:" + z + ";background:" + bg
      + (box && box.width > 80
        ? ";left:" + Math.round(box.left) + "px;width:" + Math.round(box.width) + "px"
        : ";left:0;right:0");
    var fr = document.createElement("iframe");
    fr.src = "/schedule?embed=1&theme=" + themeOf() + (tab ? "&t=" + tab : "");
    fr.setAttribute("title", "مهامي وجدولي");
    fr.style.cssText = "width:100%;height:100%;border:0;display:block";
    ov.appendChild(fr);
    document.body.appendChild(ov);

    // ⚠️ ضغطُ تبويبٍ في الشريط يُغلق الجدول: الشريطُ ظاهرٌ فوق الإطار،
    //    ولو بقي الجدولُ مفتوحًا لانتقل التطبيقُ خلفه بلا أن يُرى.
    if (nav && !nav.__sqBound) {
      nav.__sqBound = true;
      nav.addEventListener("click", function () { closeSchedule(); }, true);
    }
    // ⚠️ وتدويرُ الجهازِ يُغيّر العمودَ والارتفاعات: تُعاد القياسات، وإلّا
    //    بقي الإطارُ على مقاس الوضع السابق.
    if (!window.__sqFit) {
      window.__sqFit = function () {
        var o = document.getElementById(OV);
        if (!o) return;
        var n2 = findNav(), b2 = findTopBar();
        var x2 = (n2 || b2) ? (n2 || b2).getBoundingClientRect() : null;
        o.style.top = (b2 ? Math.round(b2.getBoundingClientRect().bottom) : 0) + "px";
        o.style.bottom = (n2 ? n2.offsetHeight : 0) + "px";
        if (x2 && x2.width > 80) {
          o.style.left = Math.round(x2.left) + "px";
          o.style.width = Math.round(x2.width) + "px";
          o.style.right = "auto";
        }
      };
      window.addEventListener("resize", window.__sqFit);
      window.addEventListener("orientationchange", window.__sqFit);
    }
  }


  // ══ الفتحُ من إشعار ═══════════════════════════════════════════════
  // ⚠️ قشرةُ التطبيق تُرسَم بعد لحظةٍ من الإقلاع: لو قيس الشريطُ قبلها
  //    لخرجت الطبقةُ بمقاسٍ خاطئ. فيُنتظر وجودُه ثمّ تُفتح، وإن لم يظهر
  //    (شبكةٌ بطيئة) فُتحت على الشاشة كلِّها — داخل التطبيق على كلّ حال.
  function openWhenReady(tab) {
    var tries = 0;
    (function again() {
      if (document.getElementById(OV)) return;
      if (findNav() || ++tries > 30) { openSchedule(tab); return; }
      setTimeout(again, 200);
    })();
  }

  // نافذةٌ مفتوحةٌ ضُغط إشعارُها: العاملُ يُبلّغ ولا يَنقل.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.sq === "schedule-open") openWhenReady(d.t || "");
    });
  }

  // إقلاعٌ باردٌ من إشعار: العلامةُ في الرابط. وتُمحى بعد القراءة
  // بـreplaceState — بلا دفعِ سجلٍّ جديد، فـ«اضغط رجوع مرّةً أخرى
  // للخروج» في التطبيق يبقى على حاله.
  function fromUrl() {
    var p;
    try { p = new URLSearchParams(location.search); } catch (e) { return; }
    if (p.get("sq") !== "schedule") return;
    var tab = p.get("t") || "";
    p.delete("sq"); p.delete("t");
    var rest = p.toString();
    try {
      history.replaceState(history.state, "",
        location.pathname + (rest ? "?" + rest : "") + location.hash);
    } catch (e) { /* لا يضرّ بقاؤها */ }
    openWhenReady(tab);
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;
    if (e.data && e.data.sq === "schedule-close") closeSchedule();
  });
  // رجوعُ الجهاز يُغلق الجدولَ أيضًا — بلا لمسِ تاريخ المتصفّح، فالتطبيقُ
  // يستعمله لـ«اضغط رجوع مرّةً أخرى للخروج».
  window.addEventListener("popstate", function () { closeSchedule(); });

  var pending = false;
  function place() {
    if (document.getElementById(ID)) return;
    var row = findRow();
    if (!row) return;
    try { row.parentElement.insertBefore(build(row), row); } catch (e) { /* لا يُكسر شيء */ }
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; place(); });
  }

  // ⚠️ مراقبةٌ دائمة: التطبيقُ يُعيد بناءَ الشاشة عند كلِّ تنقّل، فيُزال ما
  //    ليس من شجرته. والمراقبُ يُعيده بلا أن يشعر المستخدم.
  function start() {
    new MutationObserver(schedule).observe(document.body,
      { childList: true, subtree: true });
    schedule();
    fromUrl();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
