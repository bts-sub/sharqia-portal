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
      if (block.children[0]) block.children[0].textContent = "جدولي";
      if (block.children[1]) block.children[1].textContent = "مهامي واجتماعاتي";
    }
    card.style.cursor = "pointer";
    // المرحلةُ الملتقِطة: الحزمةُ تلتقط النقراتِ من الجذر، فلو تُركت تصعد
    // لحاولت فتحَ شاشةِ البطاقة المنسوخة.
    card.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      location.href = "/schedule";
    }, true);
    return card;
  }

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
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
