/* ترجمة تطبيق المبيعات (منذ 3.97.0): العربية الأصل، والإنجليزية والفرنسية (من الشمال لليمين) والأوردو.
 *
 *  الكود يبقى بالعربية كما هو؛ هذا الملف يترجم ما يظهر على الشاشة لحظة رسمه: نصوص الصفحة وسماتها (placeholder وaria-label
 *  وtitle) والتنبيهات (toast وconfirm وprompt)، ورسائل أودو والبوابة (أنماطٌ فيها %s تُطابَق وتُملأ بقيمها).
 *  القاموس في i18n-dict.js: {النص العربي: [en, fr, ur]}. نصٌّ لا يجده يبقى عربيًا؛ ونصٌّ يخلط كلمات التطبيق ببيانات
 *  (اسم منتج، رقم) تُترجم كلماته المعروفة وحدها. ما عليه translate="no" لا يُمَسّ (رسالة العميل، الإيصال).
 *  ويُحمَّل في عامل الخدمة أيضًا ليترجم إشعارات الجوال (بلا صفحة: I18N.tr(نص، لغة)).
 */
(function (root) {
  "use strict";
  var LANGS = [
    { code: "ar", name: "العربية", short: "ع", dir: "rtl", locale: "ar-SA-u-nu-latn", cur: "ر.س" },
    { code: "en", name: "English", short: "EN", dir: "ltr", locale: "en-GB", cur: "SAR" },
    { code: "fr", name: "Français", short: "FR", dir: "ltr", locale: "fr-FR", cur: "SAR" },
    { code: "ur", name: "اردو", short: "اردو", dir: "rtl", locale: "ur-PK-u-nu-latn", cur: "ریال" },
  ];
  var IDX = { en: 0, fr: 1, ur: 2 };
  var BY = {}; LANGS.forEach(function (l) { BY[l.code] = l; });
  var DICT = root.I18N_DICT || {};

  // «جملة عربية»: حروفٌ متصلة بمسافات وفواصل عربية (هي نفسها في أداة استخراج النصوص)
  var L = "ؠ-ؿف-يٮٯٱ-ۓەۮۯۺ-ۼۿـ";
  var M = "ً-ٰٟۖ-ۭ";
  var RUN = new RegExp("[" + L + "][" + L + M + "  ،]*[" + L + M + "]|[" + L + "]", "g");
  var ARABIC = /[؀-ۿ]/;

  function stored() {
    try { var l = root.localStorage && root.localStorage.getItem("salesLang"); return BY[l] ? l : "ar"; } catch (e) { return "ar"; }
  }
  var lang = stored();

  function look(key, lg) {
    var row = DICT[key];
    var t = row && row[IDX[lg]];
    return t ? t : null;
  }

  // ── أنماط رسائل أودو: «المتاح من «%(p)s» في مخزونك %(q)s فقط.» ← تعبيرٌ يلتقط القيم ويملؤها في الترجمة
  var PH = /%\((\w+)\)[sd]|%[sd]/g;
  var PATS = [];
  Object.keys(DICT).forEach(function (key) {
    if (key.indexOf("%") < 0 || !PH.test(key)) return;
    PH.lastIndex = 0;
    var names = [], src = "^", last = 0, m;
    while ((m = PH.exec(key))) {
      src += key.slice(last, m.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s\\S]+?)";
      names.push(m[1] || null); last = m.index + m[0].length;
    }
    src += key.slice(last).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
    var prefix = key.slice(0, key.search(PH)).trim();
    try { PATS.push({ re: new RegExp(src.replace(/%%/g, "%")), names: names, key: key, prefix: prefix }); } catch (e) {}
  });
  // الأطول نصًّا أولًا: النمط الأدقّ يسبق العام
  PATS.sort(function (a, b) { return b.key.length - a.key.length; });

  function fill(tpl, names, vals, lg) {
    var pos = 0, byName = {};
    names.forEach(function (n, i) { if (n) byName[n] = vals[i]; });
    return tpl.replace(PH, function (all, name) {
      var v = name ? byName[name] : vals[pos++];
      if (v == null) return all;
      var t = look(v.trim(), lg);            // قيمةٌ هي نفسها تسمية (حالة، نوع): تُترجم
      return t != null ? t : v;
    }).replace(/%%/g, "%");
  }
  function byPattern(t, lg) {
    for (var i = 0; i < PATS.length; i++) {
      var p = PATS[i];
      if (p.prefix && t.indexOf(p.prefix) !== 0) continue;
      var m = p.re.exec(t);
      if (!m) continue;
      var tpl = look(p.key, lg);
      if (tpl == null) return null;
      return fill(tpl, p.names, m.slice(1), lg);
    }
    return null;
  }
  // كلمات التطبيق داخل نصٍّ فيه بيانات: أطول عبارةٍ معروفة من كل موضع، والباقي كما هو. والكلمة الواحدة في أول الجملة
  // فقط («من …»، «فرع …»): في وسطها تكون غالبًا من اسم منتجٍ أو عميل فلا تُمسّ
  function phrases(run, lg) {
    var words = run.split(" "), out = [], i = 0;
    while (i < words.length) {
      var hit = null, j;
      for (j = Math.min(words.length, i + 8); j > (i === 0 ? i : i + 1); j--) {
        hit = look(words.slice(i, j).join(" "), lg);
        if (hit != null) break;
      }
      if (hit != null) { out.push(hit); i = j; } else { out.push(words[i]); i++; }
    }
    return out.join(" ");
  }
  function tr(s, lg) {
    lg = lg || lang;
    if (lg === "ar" || s == null) return s;
    s = String(s);
    if (!ARABIC.test(s)) return s;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], t = s.trim().replace(/\s+/g, " ");
    var out = look(t, lg);
    if (out == null) out = byPattern(t, lg);
    if (out == null) {
      out = t.replace(RUN, function (run, at, whole) {
        run = run.replace(/\s+/g, " ");
        var hit = look(run, lg);
        // «و60» في العربية ملتصقة: الترجمة تنفصل عمّا يلاصقها من أرقام وحروف
        if (hit != null) {
          var before = whole.charAt(at - 1), after = whole.charAt(at + run.length);
          return (/[0-9A-Za-z]/.test(before) ? " " : "") + hit + (/[0-9A-Za-z]/.test(after) ? " " : "");
        }
        // جملتان من الكود التقتا عند فاصلة: كلٌّ وحدها
        if (run.indexOf("،") >= 0) {
          return run.split(/\s*،\s*/).map(function (part) {
            var h = look(part, lg);
            return h != null ? h : phrases(part, lg);
          }).join(lg === "ur" ? "، " : ", ");
        }
        return phrases(run, lg);
      });
    }
    // من الشمال: الأسهم تنقلب للأمام، وعلامات الترقيم العربية لاتينية
    if (BY[lg].dir === "ltr") {
      out = out.replace(/[←‹]/g, function (c) { return c === "←" ? "→" : "›"; })
        .replace(/\s*،/g, ",").replace(/؟/g, "?").replace(/؛/g, ";");
    }
    return lead + out + trail;
  }

  var api = {
    langs: LANGS, tr: tr,
    lang: function () { return lang; },
    info: function () { return BY[lang]; },
    locale: function () { return BY[lang].locale; },
    cur: function () { return BY[lang].cur; },
    rtl: function () { return BY[lang].dir === "rtl"; },
    // يُحفظ على الجوال، ولعامل الخدمة (إشعارات الجوال) في كاشٍ صغير
    setLang: function (code) {
      if (!BY[code]) return;
      try { root.localStorage.setItem("salesLang", code); } catch (e) {}
      api.syncWorker(code);
    },
    syncWorker: function (code) {
      try {
        if (root.caches) root.caches.open("sales-prefs").then(function (c) { return c.put("/__lang", new Response(code || lang)); }).catch(function () {});
      } catch (e) {}
    },
  };
  root.I18N = api;

  // ── الصفحة (لا في عامل الخدمة)
  if (typeof document === "undefined") return;
  var html = document.documentElement;
  html.setAttribute("lang", lang);
  html.setAttribute("dir", BY[lang].dir);
  if (lang === "ur") {
    // الأوردو بخطٍّ فيه حروفها (ٹ ڈ ں ے): لا تختلط الخطوط داخل الكلمة فتنقطع الحروف
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap";
    document.head.appendChild(font);
  }
  if (lang === "ar") { api.syncWorker("ar"); return; }

  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  // نصوصٌ لا تُمسّ: الكود والأنماط وما يكتبه الموظف (textarea). وسمة placeholder للخانات تُترجم.
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var textDone = new WeakMap(), attrDone = new WeakMap();
  function skipped(el, forText) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if ((forText && SKIP[el.nodeName]) || el.getAttribute("translate") === "no" || el.isContentEditable) return true;
    }
    return false;
  }
  function doText(node) {
    var v = node.nodeValue;
    if (!v || textDone.get(node) === v || !ARABIC.test(v) || skipped(node.parentNode, true)) return;
    var t = tr(v);
    textDone.set(node, t);
    if (t !== v) node.nodeValue = t;
  }
  function doAttr(el, name) {
    var v = el.getAttribute(name);
    if (!v || !ARABIC.test(v)) return;
    var done = attrDone.get(el) || {};
    if (done[name] === v || skipped(el)) return;
    var t = tr(v);
    done[name] = t; attrDone.set(el, done);
    if (t !== v) el.setAttribute(name, t);
  }
  function doTree(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1 || skipped(node)) return;
    ATTRS.forEach(function (a) { if (node.hasAttribute(a)) doAttr(node, a); });
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else ATTRS.forEach(function (a) { if (n.hasAttribute(a)) doAttr(n, a); });
    }
  }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === "childList") { for (var j = 0; j < m.addedNodes.length; j++) doTree(m.addedNodes[j]); }
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttr(m.target, m.attributeName);
    }
  });
  mo.observe(html, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener("DOMContentLoaded", function () { doTree(html); });

  // نوافذ المتصفح البسيطة
  ["alert", "confirm"].forEach(function (fn) {
    var orig = root[fn];
    if (orig) root[fn] = function (msg) { return orig.call(root, tr(msg)); };
  });
  var prompt0 = root.prompt;
  if (prompt0) root.prompt = function (msg, def) { return prompt0.call(root, tr(msg), def); };
  api.syncWorker(lang);
})(typeof self !== "undefined" ? self : this);
