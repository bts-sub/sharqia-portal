/* ===========================================================================
 * chpw.js — تغيير الموظف كلمة مروره بنفسه.
 *
 * لماذا ملفٌّ مستقلّ؟ واجهة التطبيق حزمةٌ مبنيّة مصغَّرة، وكتابة نافذةٍ
 * داخلها تعني تعديل شيفرةٍ لا تُقرأ. وهذه النافذة عناصر DOM خالصة تُركَّب
 * فوق الواجهة ولا تمسّها.
 *
 * يستدعيها الزرّ في قائمة الحساب: window.SharqiaChangePassword().
 * =========================================================================== */
(function () {
  "use strict";
  var OPEN = false;

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  function field(label, ph) {
    var wrap = el("div", "margin-bottom:12px");
    var l = el("label", "display:block;font-size:12.5px;font-weight:700;color:#3D3D34;margin-bottom:5px", label);
    var i = el("input", "width:100%;padding:11px 12px;border:1px solid #E7E9EC;border-radius:10px;" +
      "font:inherit;font-size:14px;background:#FAFAFA;box-sizing:border-box");
    i.type = "password";
    i.autocomplete = "off";
    if (ph) i.placeholder = ph;
    wrap.appendChild(l); wrap.appendChild(i);
    return { wrap: wrap, input: i };
  }

  window.SharqiaChangePassword = function () {
    if (OPEN) return;
    OPEN = true;

    var back = el("div", "position:fixed;inset:0;background:rgba(16,16,8,.45);z-index:2147483000;" +
      "display:flex;align-items:center;justify-content:center;padding:16px");
    var card = el("div", "background:#fff;border-radius:16px;max-width:380px;width:100%;padding:18px;" +
      "box-shadow:0 18px 50px rgba(16,24,40,.28);font-family:inherit;direction:rtl;text-align:right");
    var h = el("div", "font-size:16.5px;font-weight:800;color:#17170F;margin-bottom:4px", "تغيير كلمة المرور");
    var sub = el("div", "font-size:12.5px;color:#6B6B60;margin-bottom:14px",
      "أدخل كلمة المرور الحالية ثم الجديدة (٨ أحرف فأكثر).");
    var f1 = field("كلمة المرور الحالية", "••••••••");
    var f2 = field("كلمة المرور الجديدة", "٨ أحرف فأكثر");
    var f3 = field("تأكيد كلمة المرور الجديدة", "أعد كتابتها");
    var msg = el("div", "font-size:12.5px;font-weight:700;min-height:18px;margin-bottom:6px");
    var row = el("div", "display:flex;gap:8px;margin-top:6px");
    var ok = el("button", "flex:1;padding:11px;border:0;border-radius:10px;background:#17170F;color:#fff;" +
      "font:inherit;font-weight:800;font-size:14px;cursor:pointer", "حفظ");
    var no = el("button", "flex:1;padding:11px;border:1px solid #E7E9EC;border-radius:10px;background:#fff;" +
      "color:#3D3D34;font:inherit;font-weight:700;font-size:14px;cursor:pointer", "إلغاء");

    function close() { OPEN = false; try { back.remove(); } catch (e) {} }
    function say(t, bad) { msg.textContent = t; msg.style.color = bad ? "#DC2626" : "#16A34A"; }

    ok.onclick = async function () {
      var cur = f1.input.value, nw = f2.input.value, cf = f3.input.value;
      if (!cur || !nw) return say("أدخل كلمة المرور الحالية والجديدة.", true);
      if (nw.length < 8) return say("كلمة المرور الجديدة أقصر من ثمانية أحرف.", true);
      if (nw !== cf) return say("التأكيد لا يطابق كلمة المرور الجديدة.", true);
      ok.disabled = true; ok.textContent = "جارٍ الحفظ…"; say("");
      try {
        var res = await fetch("/api/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ current: cur, next: nw }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error || data.message || "تعذّر تغيير كلمة المرور.");
        say("تم تغيير كلمة المرور بنجاح.");
        setTimeout(close, 1200);
      } catch (e) {
        say(e.message || "تعذّر تغيير كلمة المرور.", true);
        ok.disabled = false; ok.textContent = "حفظ";
      }
    };
    no.onclick = close;
    back.onclick = function (ev) { if (ev.target === back) close(); };

    row.appendChild(ok); row.appendChild(no);
    [h, sub, f1.wrap, f2.wrap, f3.wrap, msg, row].forEach(function (n) { card.appendChild(n); });
    back.appendChild(card);
    document.body.appendChild(back);
    setTimeout(function () { try { f1.input.focus(); } catch (e) {} }, 50);
  };
})();
