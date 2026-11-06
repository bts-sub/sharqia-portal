// ===========================================================================
// schedule-entry.js — بطاقةُ «جدولي» في شاشة «حسابي»
//
// ⚠️ لماذا حقنٌ لا تعديلٌ في الحزمة: public/index.html حزمةٌ مبنيّةٌ
//    مُصغَّرة لا مصدرَ لها في الريبو. وكلُّ سطرٍ يُكتب داخلها يُقرأ بعدها
//    بصعوبة، ويضيع يومَ تُعاد بناؤها. وهذا الملفُّ يُحقَن سطرًا واحدًا
//    عند إقلاع الخادم (src/server.js)، فيبقى ولو استُبدلت الحزمةُ كلُّها.
//
// ⚠️ وهو مُضيفٌ لا مُغيّر: لا يلمس بطاقةً قائمةً ولا يحذف شيئًا — يُدرج
//    بطاقةً واحدةً قبل «بطاقتي المهنية». وإن تبدّلت بنيةُ الشاشة فلم
//    يجد مرساه، لم تظهر البطاقةُ ولم ينكسر شيء.
//
// ⚠️ والميزةُ نفسُها ليست هنا: هذه بطاقةُ دخولٍ إلى /schedule، وتلك
//    صفحةٌ بمصدرٍ كاملٍ مقروء (public/schedule.js).
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

  function findAnchor() {
    for (var i = 0; i < ANCHORS.length; i++) {
      var n = document.querySelector('[role="button"][title="' + ANCHORS[i] + '"]');
      if (n && n.parentNode) return n;
    }
    return null;
  }

  // أوراقُ النصّ: العناصرُ التي لا أبناءَ لها وفيها نصّ — أوّلُها العنوانُ
  // وثانيها السطرُ تحته. لا تُمسّ البقيّةُ (السهمُ وغيرُه).
  function textLeaves(root) {
    var out = [];
    (function walk(n) {
      for (var i = 0; i < n.children.length; i++) {
        var c = n.children[i];
        if (!c.children.length && (c.textContent || "").trim()) out.push(c);
        else walk(c);
      }
    })(root);
    return out;
  }

  function build(anchor) {
    var card = anchor.cloneNode(true);
    card.id = ID;
    card.setAttribute("title", "جدولي");
    var svg = card.querySelector("svg");
    if (svg && svg.parentNode) {
      var holder = svg.parentNode;
      holder.innerHTML = ICON;
    }
    var leaves = textLeaves(card);
    if (leaves[0]) leaves[0].textContent = "جدولي";
    if (leaves[1]) leaves[1].textContent = "مهامي واجتماعاتي";
    // المرحلةُ الملتقِطة: الحزمةُ تلتقط النقراتِ من الجذر، فلو تُركت
    // تصعد لحاولت فتحَ شاشةِ البطاقة المنسوخة.
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
    var a = findAnchor();
    if (!a) return;
    try { a.parentNode.insertBefore(build(a), a); } catch (e) { /* لا يُكسر شيء */ }
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; place(); });
  }

  // ⚠️ مراقبةٌ دائمة: التطبيقُ يُعيد بناءَ الشاشة عند كلِّ تنقّل، فيُزال
  //    ما ليس من شجرته. والمراقبُ يُعيده بلا أن يشعر المستخدم.
  if (document.body) {
    new MutationObserver(schedule).observe(document.body,
      { childList: true, subtree: true });
    schedule();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      new MutationObserver(schedule).observe(document.body,
        { childList: true, subtree: true });
      schedule();
    });
  }
})();
