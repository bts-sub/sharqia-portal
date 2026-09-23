// ===========================================================================
// card.js — البطاقة المهنية للموظف (Digital ID Card).
//
// ثلاثة أوجه لبيانٍ واحد:
//   • GET /api/me/card    — بيانات البطاقة + رمزا QR (جهة اتصال / رابط) للتطبيق.
//   • GET /c/:token       — صفحة عامة أنيقة تُفتح بمسح الـ QR في مؤتمرٍ ونحوه.
//   • GET /c/:token/vcf   — ملف vCard: يُضاف الموظف كجهة اتصال بضغطة.
//
// خصوصية: البطاقة تحمل ما يُشارَك في مؤتمر فقط (اسم/مسمّى/قسم/شركة/جوال/بريد/
// صورة) — لا رقم هوية ولا آيبان ولا راتب. والتوكن HMAC غير قابل للتخمين، فلا
// يُعدّ الموظفون بتجربة الأرقام، ولا يُقرأ من Odoo إلا بجلسة صاحب البطاقة.
// ===========================================================================
import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { config } from "../config.js";
import { readAll, writeAll } from "../lib/store.js";

const router = Router();

// توكن ثابت لكل موظف: نفس الرابط دائمًا، وغير قابل للتخمين أو التعداد.
function shareToken(userId) {
  return crypto.createHmac("sha256", config.jwtSecret)
    .update("card:" + String(userId))
    .digest("base64url").slice(0, 22);
}

// الحقول القابلة للمشاركة فقط — لا شيء حسّاس.
function shareableCard(emp, user) {
  emp = emp || {};
  return {
    name: emp.name || user?.name || "",
    jobTitle: emp.jobTitle || "",
    dept: emp.dept || "",
    branch: emp.branch || "",
    company: emp.company || "",
    phone: emp.phone || "",
    email: emp.email || user?.email || "",
    empNo: emp.empNo || "",
    photo: emp.photo || "",   // data URI جاهزة للعرض
  };
}

// رقم واتساب بصيغة دولية بلا + ولا صفر بادئ. wa.me يرفض الصيغة المحلّية
// (مثل 0501234567) فلا يجد الحساب — فنحوّلها إلى 9665XXXXXXXX.
function waNumber(phone) {
  let d = String(phone || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);          // 00966… → 966…
  if (d.startsWith("966")) return d;               // دولي بالفعل
  if (d.startsWith("0")) return "966" + d.slice(1);// 05X… → 9665X…
  if (d.length === 9 && d.startsWith("5")) return "966" + d; // 5XXXXXXXX
  return d;                                        // رقم أجنبي: كما هو
}

// هروب قيم vCard 3.0 (فاصلة/فاصلة منقوطة/شرطة مائلة/سطر جديد).
const vesc = (v) => String(v || "").replace(/\\/g, "\\\\")
  .replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

function buildVcard(c, url) {
  const org = c.company
    ? "ORG:" + vesc(c.company) + (c.dept ? ";" + vesc(c.dept) : "")
    : (c.dept ? "ORG:" + vesc(c.dept) : "");
  return [
    "BEGIN:VCARD", "VERSION:3.0",
    "N:" + vesc(c.name), "FN:" + vesc(c.name),
    c.jobTitle ? "TITLE:" + vesc(c.jobTitle) : "",
    org,
    c.phone ? "TEL;TYPE=CELL,VOICE:" + vesc(c.phone) : "",
    c.email ? "EMAIL;TYPE=WORK:" + vesc(c.email) : "",
    url ? "URL:" + url : "",
    "END:VCARD",
  ].filter(Boolean).join("\r\n");
}

const hesc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function baseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// الـ SVG المُعاد للتطبيق يُحقن كما هو، فنجعله يملأ حاويته (viewBox يتكفّل بالقياس).
const respSvg = (svg) => svg.replace(/<svg /, '<svg style="width:100%;height:100%;display:block" ');

function upsertSnapshot(token, userId, card) {
  const all = readAll("shareCards");
  const rest = all.filter((s) => s.token !== token);
  rest.unshift({ token, userId, card, at: new Date().toISOString() });
  writeAll("shareCards", rest);
}

function findSnapshot(token) {
  return readAll("shareCards").find((s) => s.token === token) || null;
}

// ── بيانات البطاقة للتطبيق (يتطلب جلسة) ──
router.get("/api/me/card", requireAuth, async (req, res, next) => {
  try {
    let emp = {};
    try {
      const r = await runAction("employee.me", {}, { user: req.user });
      emp = r?.data || {};
    } catch { /* fallback إلى بيانات الجلسة */ }
    const card = shareableCard(emp, req.user);
    const token = shareToken(req.user.id);
    const url = `${baseUrl(req)}/c/${token}`;
    const vcfUrl = `/c/${token}/vcf`;
    upsertSnapshot(token, req.user.id, card);

    const opt = { margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#00000000" } };
    const [vcardQr, linkQr] = await Promise.all([
      QRCode.toString(buildVcard(card, url), { ...opt, type: "svg" }),
      QRCode.toString(url, { ...opt, type: "svg" }),
    ]);
    res.set("Cache-Control", "private, no-store");
    res.json({ card, token, url, vcfUrl, vcardQr: respSvg(vcardQr), linkQr: respSvg(linkQr) });
  } catch (e) { next(e); }
});

// إلغاء المشاركة: يزيل اللقطة العامة فيتعطّل الرابط القديم.
router.delete("/api/me/card", requireAuth, (req, res) => {
  const token = shareToken(req.user.id);
  const all = readAll("shareCards");
  writeAll("shareCards", all.filter((s) => s.token !== token));
  res.json({ ok: true });
});

// ── vCard عام (يُفتح بمسح الـ QR) ──
router.get("/c/:token/vcf", (req, res) => {
  const snap = findSnapshot(req.params.token);
  if (!snap) return res.status(404).type("text/plain; charset=utf-8").send("البطاقة غير متاحة");
  const url = `${baseUrl(req)}/c/${snap.token}`;
  const vcf = buildVcard(snap.card, url);
  res.set("Cache-Control", "private, no-store");
  res.type("text/vcard; charset=utf-8");
  res.setHeader("Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent((snap.card.name || "contact") + ".vcf")}`);
  res.send(vcf);
});

// ── الصفحة العامة الأنيقة ──
router.get("/c/:token", async (req, res) => {
  const snap = findSnapshot(req.params.token);
  if (!snap) {
    return res.status(404).type("html").send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
       <div style="font-family:system-ui;display:grid;place-items:center;min-height:80vh;color:#666">البطاقة غير متاحة أو أُلغيت.</div>`);
  }
  const c = snap.card;
  const url = `${baseUrl(req)}/c/${snap.token}`;
  let linkQr = "";
  try { linkQr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#111", light: "#00000000" } }); } catch { /* بلا QR */ }

  const initials = (c.name || "؟").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  const photoBlock = c.photo
    ? `<img src="${hesc(c.photo)}" alt="" style="width:104px;height:104px;border-radius:50%;object-fit:cover;border:3px solid #C9A24B;box-shadow:0 6px 18px #0006">`
    : `<div style="width:104px;height:104px;border-radius:50%;display:grid;place-items:center;background:#C9A24B;color:#111;font-weight:800;font-size:38px;border:3px solid #E7C877">${hesc(initials)}</div>`;
  const row = (label, val, href) => val
    ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #ffffff14">
         <span style="color:#9a9a9a;font-size:13px">${hesc(label)}</span>
         ${href ? `<a href="${hesc(href)}" style="color:#E7C877;font-weight:700;font-size:13.5px;text-decoration:none;direction:ltr">${hesc(val)}</a>`
                : `<span style="color:#f2f2f2;font-weight:700;font-size:13.5px">${hesc(val)}</span>`}
       </div>` : "";

  res.set("Cache-Control", "private, no-store");
  res.type("html").send(`<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${hesc(c.name)} — بطاقة مهنية</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;
       background:radial-gradient(120% 90% at 50% 0%,#232323 0%,#0E0E0E 60%);color:#fff;
       min-height:100vh;display:grid;place-items:start center;padding:24px 16px 40px}
  .card{width:100%;max-width:400px;background:#161616;border:1px solid #ffffff12;border-radius:22px;
        overflow:hidden;box-shadow:0 20px 60px #0009}
  .hero{background:linear-gradient(135deg,#1B1B1B,#2A2A2A);padding:26px 20px 20px;text-align:center;
        border-bottom:1px solid #ffffff10}
  .name{font-size:21px;font-weight:800;margin:14px 0 3px}
  .title{color:#E7C877;font-size:14px;font-weight:700}
  .sub{color:#9a9a9a;font-size:12.5px;margin-top:3px}
  .body{padding:16px 20px 20px}
  .btns{display:flex;gap:10px;margin-top:18px}
  .btn{flex:1;text-align:center;padding:12px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none}
  .primary{background:#C9A24B;color:#161616}
  .ghost{background:#ffffff10;color:#fff;border:1px solid #ffffff1c}
  .qr{margin:20px auto 4px;width:120px;height:120px;background:#fff;border-radius:14px;padding:8px}
  .qr svg{width:100%;height:100%}
  .foot{text-align:center;color:#6f6f6f;font-size:11px;margin-top:14px}
</style></head>
<body>
  <div class="card">
    <div class="hero">
      ${photoBlock}
      <div class="name">${hesc(c.name)}</div>
      ${c.jobTitle ? `<div class="title">${hesc(c.jobTitle)}</div>` : ""}
      <div class="sub">${[c.dept, c.company].filter(Boolean).map(hesc).join(" · ")}</div>
    </div>
    <div class="body">
      ${row("الجوال", c.phone, c.phone ? "tel:" + c.phone : "")}
      ${row("البريد", c.email, c.email ? "mailto:" + c.email : "")}
      ${row("الرقم الوظيفي", c.empNo)}
      ${c.branch ? row("الفرع", c.branch) : ""}
      <div class="btns">
        <a class="btn primary" href="/c/${hesc(snap.token)}/vcf">أضف جهة الاتصال</a>
        ${waNumber(c.phone) ? `<a class="btn ghost" href="https://wa.me/${hesc(waNumber(c.phone))}">واتساب</a>` : ""}
      </div>
      <div class="qr">${linkQr}</div>
      <div class="foot">بطاقة مهنية — العباءة الشرقية</div>
    </div>
  </div>
</body></html>`);
});

export default router;
