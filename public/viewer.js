// ===========================================================================
// viewer.js — عارض المستندات والصور داخل التطبيق.
//
// كان الخطاب ومحضر العهدة ونموذج الإجازة يُفتح بـ window.open، والتطبيق المثبَّت
// على الجوال لا يملك شريط متصفّح: يفتح الملف فوق التطبيق ولا زرّ رجوع، فيعلق
// الموظف أو يُغلق التطبيق كلّه ليعود. الآن يُعرض المستند داخل التطبيق بزرّ
// «رجوع» ظاهر، وزرّ الرجوع في الجوال يغلقه ويعود للصفحة نفسها.
//
// PDF يُرسَم بـ pdf.js (مستضاف محليًّا) لأن متصفّح أندرويد المدمج لا يعرض
// ملفات PDF داخل الصفحة أصلًا.
// ===========================================================================
(function () {
  "use strict";
  var open = null;          // { el, overflow, url }
  var ignorePop = false;    // الإغلاق بالزرّ يرجع خطوة في السجلّ — لا نعدّه رجوعًا آخر
  var pdfjsLoading = null;

  function h(tag, css, text) {
    var el = document.createElement(tag);
    if (css) el.style.cssText = css;
    if (text != null) el.textContent = text;
    return el;
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsLoading) return pdfjsLoading;
    pdfjsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/vendor/pdfjs/pdf.min.js";
      s.onload = function () {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { pdfjsLoading = null; reject(new Error("pdfjs")); };
      document.head.appendChild(s);
    });
    return pdfjsLoading;
  }

  function shell(title) {
    close(true);
    var ov = h("div",
      "position:fixed;inset:0;z-index:2147483600;background:#141414;display:flex;flex-direction:column;" +
      "font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;direction:rtl");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var bar = h("div",
      "display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));" +
      "background:#1B1B1B;color:#fff;border-bottom:1px solid #2a2a2a;flex-shrink:0");
    var back = h("button",
      "display:flex;align-items:center;gap:6px;background:#2a2a2a;color:#fff;border:none;border-radius:10px;" +
      "padding:8px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer");
    back.type = "button";
    back.appendChild(h("span", "font-size:16px;line-height:1", "→"));
    back.appendChild(h("span", "", "رجوع"));
    back.onclick = function () { close(false); };
    var ttl = h("div", "flex:1;min-width:0;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis", title || "");
    var actions = h("div", "display:flex;gap:6px");
    bar.appendChild(back); bar.appendChild(ttl); bar.appendChild(actions);
    var body = h("div", "flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px;display:flex;flex-direction:column;align-items:center;gap:10px");
    ov.appendChild(bar); ov.appendChild(body);
    document.body.appendChild(ov);
    open = { el: ov, overflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
    try { history.pushState({ sq: "viewer" }, ""); } catch (e) {}
    return { body: body, actions: actions };
  }

  function actionBtn(label, fn) {
    var b = h("button",
      "background:#C9A227;color:#1b1b1b;border:none;border-radius:10px;padding:8px 12px;font:inherit;" +
      "font-size:13px;font-weight:700;cursor:pointer", label);
    b.type = "button";
    b.onclick = fn;
    return b;
  }

  function message(body, text, color) {
    body.innerHTML = "";
    body.appendChild(h("div", "color:" + (color || "#ddd") + ";font-size:14px;margin-top:40px;text-align:center;line-height:1.8", text));
  }

  function saveBlob(blob, name) {
    var file = null;
    try { file = new File([blob], name, { type: blob.type || "application/pdf" }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(function () {});
      return;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function openPdf(url, title) {
    var ui = shell(title || "المستند");
    message(ui.body, "جارٍ فتح المستند…");
    var name = (title || "document").replace(/[\\/:*?"<>|]+/g, " ").trim() + ".pdf";
    var viewUrl = url + (url.indexOf("?") >= 0 ? "&" : "?") + "view=1";
    Promise.all([
      fetch(viewUrl, { credentials: "include" }).then(function (r) {
        var ct = r.headers.get("content-type") || "";
        if (!r.ok || ct.indexOf("pdf") < 0) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            throw new Error(j.error || "تعذّر فتح المستند.");
          });
        }
        return r.blob();
      }),
      loadPdfJs(),
    ]).then(function (res) {
      var blob = res[0], pdfjs = res[1];
      if (!open) return;
      ui.actions.appendChild(actionBtn("تنزيل", function () { saveBlob(blob, name); }));
      return blob.arrayBuffer().then(function (buf) {
        // ⚠️ disableFontFace: الحروف تُرسم من الخطّ المضمَّن في الملف نفسه، لا
        // بتحميله في المتصفّح.
        //   كان العارض يسلّم الخطّ المضمَّن (Tajawal) إلى المتصفّح ليحمّله
        //   ويكتب به. وبعض الأجهزة ترفض الخطّ المستخرَج، فيسقط المتصفّح إلى
        //   خطٍّ بديل ويرسم كل حرفٍ في موضعه المحسوب على الخطّ الأصلي: تتفكّك
        //   الكلمات وتنعكس حروفها، ويخرج الخطاب غير مقروء. والملف نفسه سليم —
        //   ولذلك كان يُطبع صحيحًا ويُقرأ مشوَّهًا داخل التطبيق.
        //   ورسمُ الأشكال من الخطّ المضمَّن لا يعتمد على جهازٍ ولا على خطٍّ
        //   مثبَّت فيه: ما في الورقة هو ما يُرسم.
        return pdfjs.getDocument({
          data: new Uint8Array(buf),
          disableFontFace: true,
          // الخطوط كلها مضمَّنة في مستنداتنا، فلا يُنتظر جلبُ خطٍّ قياسي
          useSystemFonts: false,
        }).promise;
      }).then(function (pdf) {
        if (!open) return;
        ui.body.innerHTML = "";
        var baseWidth = Math.min(ui.body.clientWidth - 20, 900);
        var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        var zoom = 1, pages = [];

        function draw(width) {
          var chain = Promise.resolve();
          pages.forEach(function (o) {
            chain = chain.then(function () {
              if (!open) return;
              var vp = o.page.getViewport({ scale: (width / o.base.width) * dpr });
              o.canvas.width = vp.width; o.canvas.height = vp.height;
              o.canvas.style.width = width + "px";
              return o.page.render({ canvasContext: o.canvas.getContext("2d"), viewport: vp }).promise;
            });
          });
          return chain;
        }

        // ⚠️ التقريب يُعيد الرسم لا يُكبّر الصورة: تكبير اللوحة يجعل الخط
        //   مهترئًا وهو ما جاء الموظف ليقرأه. فتُرسم الصفحات من جديد بالمقاس
        //   الجديد، والقرص بالإصبعين يُغيّره كما يُغيّره في أي عارضٍ آخر.
        var redraw = null;
        function setZoom(z, anim) {
          zoom = Math.min(4, Math.max(1, z));
          var w = Math.round(baseWidth * zoom);
          pages.forEach(function (o) {
            o.canvas.style.transition = anim ? "width .15s ease" : "none";
            o.canvas.style.width = w + "px";
            o.canvas.style.maxWidth = "none";
          });
          ui.body.style.alignItems = zoom > 1 ? "flex-start" : "center";
          clearTimeout(redraw);
          redraw = setTimeout(function () { if (open) draw(w); }, 220);
        }

        var pts = {}, startDist = 0, startZ = 1, lastTap = 0;
        function dist2() {
          var k = Object.keys(pts);
          if (k.length < 2) return 0;
          return Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y);
        }
        ui.body.style.touchAction = "pan-x pan-y";
        ui.body.addEventListener("pointerdown", function (e) {
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          if (Object.keys(pts).length === 2) { startDist = dist2(); startZ = zoom; }
        });
        ui.body.addEventListener("pointermove", function (e) {
          if (!pts[e.pointerId]) return;
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          if (Object.keys(pts).length >= 2 && startDist) {
            e.preventDefault();
            setZoom(startZ * (dist2() / startDist), false);
          }
        }, { passive: false });
        function endPt(e) {
          delete pts[e.pointerId];
          if (Object.keys(pts).length < 2) startDist = 0;
          var now = Date.now();
          if (e.type === "pointerup" && now - lastTap < 320) { setZoom(zoom > 1.2 ? 1 : 2, true); lastTap = 0; }
          else if (e.type === "pointerup") lastTap = now;
        }
        ui.body.addEventListener("pointerup", endPt);
        ui.body.addEventListener("pointercancel", endPt);
        ui.body.addEventListener("wheel", function (e) {
          if (!e.ctrlKey && !e.metaKey) return;      // عجلةٌ وحدها تمرير لا تقريب
          e.preventDefault();
          setZoom(zoom * (e.deltaY < 0 ? 1.15 : 0.87), false);
        }, { passive: false });
        ui.actions.appendChild(actionBtn("+", function () { setZoom(zoom + 0.5, true); }));
        ui.actions.appendChild(actionBtn("−", function () { setZoom(zoom - 0.5, true); }));

        var chain = Promise.resolve();
        for (var p = 1; p <= pdf.numPages; p++) {
          (function (n) {
            chain = chain.then(function () {
              if (!open) return;
              return pdf.getPage(n).then(function (page) {
                var base = page.getViewport({ scale: 1 });
                var vp = page.getViewport({ scale: (baseWidth / base.width) * dpr });
                var c = document.createElement("canvas");
                c.width = vp.width; c.height = vp.height;
                c.style.cssText = "width:" + baseWidth + "px;max-width:100%;height:auto;background:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4)";
                ui.body.appendChild(c);
                pages.push({ page: page, base: base, canvas: c });
                return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
              });
            });
          })(p);
        }
        return chain;
      });
    }).catch(function (e) {
      if (!open) return;
      if (e && e.message === "pdfjs") {
        // العارض لم يُحمَّل (شبكة) — نعود للطريقة القديمة بدل أن نترك الموظف أمام شاشة فارغة
        close(false);
        var w = nativeOpen.call(window, viewUrl, "_blank", "noopener");
        if (!w) location.href = viewUrl;
        return;
      }
      message(ui.body, (e && e.message) || "تعذّر فتح المستند.", "#FCA5A5");
    });
  }

  // الصورة ليست مستندًا: لا تُفتح صفحةً بترويسةٍ وزرّ رجوع، بل تكبر في مكانها
  // فوق الشاشة ويُقرَّب فيها بالإصبعين أو بضغطتين، وتُغلق بلمسة خارجها.
  function openImage(src, title) {
    if (!src) return;
    close(true);
    // ⚠️ ليست صفحةً تُفتح: نافذةٌ تعلو الشاشة وتترك ما خلفها ظاهرًا، فيُعرف
    //   أنها تُغلق بلمسة. وتبدأ بحجمٍ معتدل ثم تكبر بالتقريب بقدر ما يريد.
    var ov = h("div",
      "position:fixed;inset:0;z-index:2147483600;background:rgba(6,6,8,.72);display:flex;" +
      "align-items:center;justify-content:center;padding:16px;direction:rtl;touch-action:none;" +
      "backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);" +
      "font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;overflow:hidden");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");

    // ⚠️ النافذة بقدر الصورة لا بقدر الشاشة: الإطار يلتفّ حول الصورة نفسها،
    //   والصورة الصغيرة تكبر قليلًا لتُرى، ولا تُملأ الشاشة بسوادٍ حولها.
    var frame = h("div", "position:relative;display:flex;align-items:center;justify-content:center;" +
      "line-height:0;border-radius:18px;overflow:hidden;box-shadow:0 22px 70px rgba(0,0,0,.6);" +
      "background:#101014;border:1px solid rgba(255,255,255,.14);touch-action:none");
    var img = h("img", "display:block;width:auto;height:auto;" +
      "min-width:min(58vw,210px);max-width:min(72vw,360px);max-height:min(46vh,360px);object-fit:contain;" +
      "transform-origin:center center;will-change:transform;user-select:none;-webkit-user-drag:none");
    img.src = src;
    img.alt = title || "";
    img.draggable = false;
    frame.appendChild(img);

    var cap = h("div", "position:absolute;bottom:0;left:0;right:0;padding:9px 12px;font-size:12.5px;" +
      "font-weight:700;color:#fff;background:linear-gradient(to top,rgba(0,0,0,.72),transparent);" +
      "text-align:center;pointer-events:none", title || "");
    if (title) frame.appendChild(cap);

    // زرّ الإغلاق على ركن النافذة نفسها لا على ركن الشاشة: بحجمٍ يناسبها
    var x = h("button",
      "position:absolute;top:8px;left:8px;width:30px;height:30px;border-radius:10px;" +
      "border:none;background:rgba(12,12,14,.62);color:#fff;font:inherit;font-size:15px;font-weight:800;" +
      "line-height:1;cursor:pointer;display:grid;place-items:center;z-index:2;" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "إغلاق");
    x.onclick = function (e) { e.stopPropagation(); close(false); };
    frame.appendChild(x);

    var hint = h("div", "position:absolute;bottom:calc(50% - 20vh);left:0;right:0;text-align:center;" +
      "color:#ffffffa6;font-size:11.5px;font-weight:600;pointer-events:none", "قرّب بالإصبعين أو بضغطتين");

    ov.appendChild(frame); ov.appendChild(hint);
    document.body.appendChild(ov);
    open = { el: ov, overflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
    try { history.pushState({ sq: "viewer" }, ""); } catch (e) {}

    // ── التقريب والتحريك ──
    var z = 1, tx = 0, ty = 0, MAXZ = 5;
    // النافذة تكبر مع التقريب حتى تقارب الشاشة، ثم تكبر الصورة داخلها
    // ويُسحب فيها. فمن أراد النظر في تفصيلٍ وسّعها بإصبعيه ولم تُقحم عليه
    // شاشةٌ كاملة من أول لمسة.
    var base = { w: 0, h: 0 };
    function sizeFrame(anim) {
      if (!base.w) { base.w = img.offsetWidth || 220; base.h = img.offsetHeight || 220; }
      var maxW = window.innerWidth * 0.92, maxH = window.innerHeight * 0.8;
      frame.style.transition = anim ? "width .18s ease, height .18s ease" : "none";
      frame.style.width = Math.round(Math.min(base.w * z, maxW)) + "px";
      frame.style.height = Math.round(Math.min(base.h * z, maxH)) + "px";
    }
    function apply(anim) {
      img.style.transition = anim ? "transform .18s ease" : "none";
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + z + ")";
      frame.style.cursor = z > 1 ? "grab" : "default";
      sizeFrame(anim);
      if (hint.parentNode && z > 1) hint.remove();
    }
    function clamp() {
      // لا تُترك الصورة خارج الإطار: الحدّ نصفُ ما زاد من حجمها بعد التقريب
      var r = img.getBoundingClientRect();
      var maxX = Math.max(0, (img.offsetWidth * z - Math.min(img.offsetWidth * z, window.innerWidth)) / 2);
      var maxY = Math.max(0, (img.offsetHeight * z - Math.min(img.offsetHeight * z, window.innerHeight)) / 2);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
      return r;
    }
    function zoomTo(nz, anim) {
      z = Math.min(MAXZ, Math.max(1, nz));
      if (z === 1) { tx = 0; ty = 0; }
      clamp(); apply(anim);
    }

    var pts = {}, startDist = 0, startZ = 1, startT = null, moved = false, lastTap = 0;
    function dist() {
      var k = Object.keys(pts);
      if (k.length < 2) return 0;
      var a = pts[k[0]], b = pts[k[1]];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    ov.addEventListener("pointerdown", function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      moved = false;
      if (Object.keys(pts).length === 2) { startDist = dist(); startZ = z; }
      else { startT = { x: e.clientX - tx, y: e.clientY - ty }; }
      try { ov.setPointerCapture(e.pointerId); } catch (err) {}
    });
    ov.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var n = Object.keys(pts).length;
      if (n >= 2 && startDist) {
        moved = true;
        zoomTo(startZ * (dist() / startDist), false);
      } else if (n === 1 && startT && z > 1) {
        moved = true;
        tx = e.clientX - startT.x; ty = e.clientY - startT.y;
        clamp(); apply(false);
      }
      if (moved) e.preventDefault();
    }, { passive: false });
    function up(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) startDist = 0;
      if (!moved && e.target === ov) { close(false); return; }   // لمسةٌ خارج الصورة تُغلق
      if (!moved && (e.target === img || e.target === frame)) {
        var now = Date.now();
        if (now - lastTap < 320) { zoomTo(z > 1.2 ? 1 : 2.4, true); lastTap = 0; }
        else lastTap = now;
      }
    }
    ov.addEventListener("pointerup", up);
    ov.addEventListener("pointercancel", function (e) { delete pts[e.pointerId]; startDist = 0; });
    ov.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomTo(z * (e.deltaY < 0 ? 1.12 : 0.89), false);
    }, { passive: false });
    ov.addEventListener("dblclick", function (e) { e.preventDefault(); zoomTo(z > 1.2 ? 1 : 2.4, true); });
    // القياس بعد تحميل الصورة: قبله عرضها صفر فتخرج النافذة بلا حجم
    if (img.complete) apply(false);
    img.addEventListener("load", function () { base.w = 0; apply(false); });
    apply(false);
  }

  function close(silent) {
    if (!open) return false;
    open.el.remove();
    document.body.style.overflow = open.overflow || "";
    open = null;
    if (!silent) {
      try {
        if (history.state && history.state.sq === "viewer") { ignorePop = true; history.back(); }
      } catch (e) {}
    }
    return true;
  }

  // زرّ الرجوع في الجوال والعارض مفتوح: يُغلق العارض فقط.
  window.addEventListener("popstate", function (ev) {
    if (open) { close(true); ev.stopImmediatePropagation(); }
  }, true);

  // كل مستندات التطبيق تمرّ من هنا: روابط «عرض …» ونداءات window.open.
  var DOC_RE = /^\/api\/(letters\/\d+\/pdf|leave\/\d+\/form|custody\/\d+\/receipt|discipline\/\d+\/(?:pdf|summons)|requests\/\d+\/letter)/;
  var DOC_TITLE = [
    [/^\/api\/letters\//, "الخطاب"],
    [/^\/api\/leave\//, "طلب الإجازة"],
    [/^\/api\/custody\//, "محضر استلام العهدة"],
    [/^\/api\/discipline\/\d+\/summons/, "طلب استدعاء للتحقيق"],
    [/^\/api\/discipline\//, "محضر التحقيق"],
    [/^\/api\/requests\/\d+\/letter/, "المخالصة"],
  ];
  function docPath(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin || !DOC_RE.test(u.pathname)) return null;
      u.searchParams.delete("view");
      return u.pathname + (u.search || "");
    } catch (e) { return null; }
  }
  function docTitle(path) {
    for (var i = 0; i < DOC_TITLE.length; i++) if (DOC_TITLE[i][0].test(path)) return DOC_TITLE[i][1];
    return "المستند";
  }

  var nativeOpen = window.open;
  window.open = function (url) {
    var p = url && docPath(String(url));
    if (p) { openPdf(p, docTitle(p)); return window; }
    return nativeOpen.apply(window, arguments);
  };

  // روابط العرض (لا روابط التنزيل: تلك تحمل download أو نصّ «تحميل»)
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
    if (!a || a.hasAttribute("download") || ev.defaultPrevented) return;
    if (/تحميل|تنزيل/.test(a.textContent || "")) return;
    var p = docPath(a.getAttribute("href"));
    if (!p) return;
    ev.preventDefault();
    openPdf(p, docTitle(p));
  }, true);

  window.SQ_viewer = {
    openPdf: openPdf,
    openImage: openImage,
    close: function () { return close(false); },
    isOpen: function () { return !!open; },
    // يسأله معالج الرجوع في التطبيق: هل هذا الحدث إغلاقٌ بالزرّ لا رجوعٌ حقيقي؟
    consumePop: function () { var v = ignorePop || !!open; ignorePop = false; return v; },
  };
})();
