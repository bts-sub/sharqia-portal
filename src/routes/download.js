// ===========================================================================
// download.js — صفحة تنزيل ذكية (رابط واحد لكل الأجهزة).
//
// الموظف يفتح hr.sharqiaa-tech.net/download من أي جوال، فتكتشف الصفحة نظامه:
//   • أندرويد → تنزيل التطبيق (APK) مباشرةً.
//   • آيفون   → «أضف إلى الشاشة الرئيسية» (PWA) — ريثما يتوفّر إصدار App Store
//              (يتطلّب حساب Apple Developer). عند توفّره يُستبدل الرابط هنا.
//
// تُركَّب قبل التقاط الواجهة لكل المسارات، ويُستثنى /download في عامل الخدمة
// وإلا خدَمه معالجُ التنقّل صفحةَ التطبيق.
// ===========================================================================
import { Router } from "express";
import { config } from "../config.js";

const router = Router();

// روابط المتاجر — تُملأ عند توفّر الحسابات. فارغة الآن ⇒ تُعرض البدائل التي
// تعمل اليوم (APK مباشر للأندرويد، وإضافة للشاشة الرئيسية للآيفون).
const APP_STORE_URL = process.env.APP_STORE_URL || "";       // آيفون (App Store)
const PLAY_STORE_URL = process.env.PLAY_STORE_URL || "";     // أندرويد (Google Play)
const APK_URL = process.env.APK_URL || "/app-debug.apk";     // تنزيل مباشر

function page() {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>تنزيل تطبيق موظفين الشرقية</title>
<link rel="icon" href="/logo-mark.png">
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;
       background:radial-gradient(130% 90% at 50% 0%,#242424 0%,#0E0E0E 62%);color:#fff;
       min-height:100vh;display:grid;place-items:start center;
       padding:calc(env(safe-area-inset-top,0px) + 34px) 18px calc(env(safe-area-inset-bottom,0px) + 40px)}
  .wrap{width:100%;max-width:420px;text-align:center}
  .badge{width:96px;height:96px;border-radius:26px;background:#fff;display:grid;place-items:center;margin:0 auto 16px;box-shadow:0 12px 40px #0008;overflow:hidden}
  .badge img{width:76px;height:76px;object-fit:contain}
  h1{font-size:23px;font-weight:800;margin:0 0 4px}
  .tag{color:#C9A24B;font-size:14px;font-weight:700;margin-bottom:4px}
  .sub{color:#9a9a9a;font-size:13px;margin-bottom:22px}
  .you{font-size:12.5px;color:#bdbdbd;background:#ffffff10;border:1px solid #ffffff18;
       display:inline-flex;gap:7px;align-items:center;padding:7px 14px;border-radius:99;margin-bottom:20px}
  .dot{width:8px;height:8px;border-radius:99;background:#4ade80}
  .store{display:flex;align-items:center;gap:12px;width:100%;text-decoration:none;
         background:#000;border:1px solid #ffffff26;border-radius:15px;padding:12px 16px;margin-bottom:12px;
         color:#fff;text-align:right;transition:transform .12s,border-color .18s,background .18s}
  .store:active{transform:scale(.985)}
  .store .ic{width:34px;height:34px;flex-shrink:0}
  .store .tx{flex:1;line-height:1.2}
  .store .tx small{display:block;font-size:11px;color:#c7c7c7;font-weight:600}
  .store .tx b{font-size:17px;font-weight:800}
  .store.hi{border-color:#C9A24B;background:linear-gradient(#161616,#000);box-shadow:0 10px 30px #0007}
  .store.hi::after{content:"جهازك";background:#C9A24B;color:#161616;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:99}
  .note{font-size:11.5px;color:#7f7f7f;margin:2px 2px 16px}
  .ios-steps{display:none;text-align:right;background:#161616;border:1px solid #ffffff14;border-radius:16px;padding:16px 16px 8px;margin-top:6px}
  .ios-steps.show{display:block}
  .ios-steps h3{font-size:14px;margin:0 0 10px;color:#C9A24B}
  .step{display:flex;gap:11px;align-items:flex-start;margin-bottom:12px;font-size:13px;color:#e6e6e6;line-height:1.6}
  .step .n{flex-shrink:0;width:22px;height:22px;border-radius:99;background:#C9A24B;color:#161616;font-weight:800;font-size:12px;display:grid;place-items:center}
  .foot{margin-top:22px;color:#6f6f6f;font-size:11px}
  a.web{color:#C9A24B;font-weight:700;text-decoration:none}
</style></head>
<body>
  <div class="wrap">
    <div class="badge"><img src="/logo-mark.png" alt=""></div>
    <h1>موظفين الشرقية</h1>
    <div class="tag">بوابة الموظفين</div>
    <div class="sub">حمّل التطبيق على جوالك حسب نظامه</div>
    <div class="you" id="you" hidden><span class="dot"></span><span id="youtxt"></span></div>

    <a class="store" id="android" href="${PLAY_STORE_URL || APK_URL}"${PLAY_STORE_URL ? "" : ' download'}>
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 20.5 13 12 3.6 3.5c-.37.25-.6.66-.6 1.15v14.7c0 .49.23.9.6 1.15z"/><path fill="#4285F4" d="M16.8 8.7 5.9 2.4C5.6 2.2 5.2 2.2 4.9 2.4L14.1 11z"/><path fill="#EA4335" d="M14.1 13 4.9 21.6c.3.2.7.2 1 .0l10.9-6.3z"/><path fill="#FBBC04" d="M20.4 11.1 17.4 9.4 15 12l2.4 2.6 3-1.7c.7-.4.7-1.4 0-1.8z"/></svg>
      <div class="tx"><small>${PLAY_STORE_URL ? "احصل عليه من" : "أندرويد — تثبيت مباشر"}</small><b>${PLAY_STORE_URL ? "Google Play" : "تنزيل التطبيق (APK)"}</b></div>
    </a>
    <div class="note" id="android-note"${PLAY_STORE_URL ? " hidden" : ""}>لو ظهر تحذير «مصدر غير معروف» فاسمح بالتثبيت من هذا المصدر.</div>

    <a class="store" id="ios" href="${APP_STORE_URL || "#"}"${APP_STORE_URL ? "" : ' onclick="return showIos()"'}>
      <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 8.7 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.18 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
      <div class="tx"><small>${APP_STORE_URL ? "حمّله من" : "آيفون — أضف للشاشة الرئيسية"}</small><b>${APP_STORE_URL ? "App Store" : "تثبيت على الآيفون"}</b></div>
    </a>

    <div class="ios-steps" id="ios-steps">
      <h3>تثبيت التطبيق على الآيفون</h3>
      <div class="step"><span class="n">1</span><span>افتح هذا الرابط داخل متصفّح <b>Safari</b>.</span></div>
      <div class="step"><span class="n">2</span><span>اضغط زر المشاركة <b>◻︎↑</b> في الأسفل.</span></div>
      <div class="step"><span class="n">3</span><span>اختر <b>«أضف إلى الشاشة الرئيسية»</b>.</span></div>
      <div class="step"><span class="n">4</span><span>سيظهر أيقونة التطبيق على شاشتك ويعمل كتطبيق كامل.</span></div>
    </div>

    <div class="foot">أو استخدم النسخة على المتصفّح: <a class="web" href="/">افتح البوابة الآن</a><br>النسخة ${config.version}</div>
  </div>
<script>
  function showIos(){var s=document.getElementById("ios-steps");s.classList.add("show");s.scrollIntoView({behavior:"smooth",block:"center"});return false;}
  (function(){
    var ua=navigator.userAgent||"";
    var isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    var isAndroid=/android/i.test(ua);
    var you=document.getElementById("you"),yt=document.getElementById("youtxt");
    if(isIOS){document.getElementById("ios").classList.add("hi");yt.textContent="جهازك آيفون (iOS)";you.hidden=false;document.getElementById("ios-steps").classList.add("show");}
    else if(isAndroid){document.getElementById("android").classList.add("hi");yt.textContent="جهازك أندرويد";you.hidden=false;}
  })();
</script>
</body></html>`;
}

router.get(["/download", "/app"], (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("html").send(page());
});

export default router;
