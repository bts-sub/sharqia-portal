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
        return pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      }).then(function (pdf) {
        if (!open) return;
        ui.body.innerHTML = "";
        var width = Math.min(ui.body.clientWidth - 20, 900);
        var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        var chain = Promise.resolve();
        for (var p = 1; p <= pdf.numPages; p++) {
          (function (n) {
            chain = chain.then(function () {
              if (!open) return;
              return pdf.getPage(n).then(function (page) {
                var base = page.getViewport({ scale: 1 });
                var vp = page.getViewport({ scale: (width / base.width) * dpr });
                var c = document.createElement("canvas");
                c.width = vp.width; c.height = vp.height;
                c.style.cssText = "width:" + width + "px;max-width:100%;height:auto;background:#fff;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4)";
                ui.body.appendChild(c);
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

  function openImage(src, title) {
    if (!src) return;
    var ui = shell(title || "الصورة");
    ui.body.style.justifyContent = "center";
    var img = h("img", "max-width:100%;max-height:100%;object-fit:contain;border-radius:12px");
    img.src = src;
    img.alt = title || "";
    ui.body.appendChild(img);
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
