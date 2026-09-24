// ===========================================================================
// legal.js — صفحة سياسة الخصوصية العامة (مطلوبة لنشر التطبيق على App Store
// وGoogle Play). تُخدم على /privacy، وتُستثنى في عامل الخدمة كي لا يبتلعها
// معالجُ التنقّل. المحتوى يصف بدقّة ما يجمعه التطبيق فعلًا.
// ===========================================================================
import { Router } from "express";
import { config } from "../config.js";

const router = Router();

// بريد الخصوصية — يُضبط من البيئة عند توفّره؛ وإلا يُحال إلى الموارد البشرية.
const PRIVACY_EMAIL = process.env.PRIVACY_EMAIL || "";

function page() {
  const updated = "سبتمبر 2026";
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>سياسة الخصوصية — موظفين الشرقية</title>
<link rel="icon" href="/logo-mark.png">
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;background:#FAFAFA;color:#1B1B1B;line-height:1.9}
  .wrap{max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 28px) 18px calc(env(safe-area-inset-bottom,0px) + 48px)}
  header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  header img{width:44px;height:44px;border-radius:12px}
  h1{font-size:22px;margin:0}
  .upd{color:#777;font-size:12.5px;margin-bottom:22px}
  h2{font-size:16.5px;margin:26px 0 8px;color:#0F0F0F;border-right:3px solid #C9A24B;padding-right:10px}
  p,li{font-size:14px;color:#333}
  ul{padding-right:20px;margin:6px 0}
  .box{background:#fff;border:1px solid #eee;border-radius:14px;padding:16px 18px;margin-top:10px}
  a{color:#B8860B;font-weight:700}
  footer{margin-top:34px;color:#888;font-size:12px;text-align:center}
</style></head>
<body>
  <div class="wrap">
    <header><img src="/logo-mark.png" alt=""><h1>سياسة الخصوصية</h1></header>
    <div class="upd">تطبيق «موظفين الشرقية» — بوابة الخدمة الذاتية · آخر تحديث: ${updated}</div>

    <p>يوضّح هذا المستند كيفية تعامل تطبيق «موظفين الشرقية» (بوابة موظفي العباءة الشرقية)
    مع بياناتك. التطبيق أداةٌ داخلية لموظفي المنشأة لإدارة خدمات الموارد البشرية.</p>

    <h2>البيانات التي نجمعها</h2>
    <div class="box"><ul>
      <li><b>بيانات الدخول:</b> اسم المستخدم وكلمة المرور — للمصادقة والدخول الآمن فقط.</li>
      <li><b>بيانات الملف الوظيفي:</b> الاسم، المسمّى، القسم، الفرع، رقم الجوال، البريد، والرقم الوظيفي — تُقرأ من نظام الموارد البشرية (Odoo) الخاص بالمنشأة.</li>
      <li><b>الموقع الجغرافي:</b> يُستخدم <b>فقط لحظة تسجيل الحضور/الانصراف</b> للتحقق من وجودك داخل نطاق مواقع العمل. لا نتتبّع موقعك في الخلفية ولا نخزّن مسارك.</li>
      <li><b>إشعارات الدفع:</b> رمز جهازٍ (token) لإرسال إشعارات الطلبات والموافقات والتعاميم.</li>
    </ul></div>

    <h2>كيف نستخدم البيانات</h2>
    <p>تُستخدم البيانات حصريًا لتقديم خدمات التطبيق: الطلبات، الإجازات، الحضور والانصراف،
    العهد، الخطابات والشهادات، والإشعارات. لا نستخدمها لأي غرض تسويقي.</p>

    <h2>المشاركة مع أطراف أخرى</h2>
    <div class="box"><ul>
      <li><b>Google Firebase (FCM):</b> لإرسال إشعارات الدفع فقط (يُمرَّر رمز الجهاز).</li>
      <li><b>Odoo:</b> نظام الموارد البشرية لدى المنشأة (مصدر بياناتك الوظيفية).</li>
      <li><b>لا نبيع بياناتك، ولا نشاركها مع مُعلنين، ولا مع أي طرف خارج ما سبق.</b></li>
    </ul></div>

    <h2>التخزين والحماية</h2>
    <p>تُنقل البيانات عبر اتصالٍ مشفّر (HTTPS) وتُخزَّن على خوادم المنشأة الآمنة. الوصول
    مقصورٌ على المصرّح لهم داخل المنشأة.</p>

    <h2>حقوقك</h2>
    <p>يمكنك مراجعة بياناتك وتصحيحها عبر التطبيق أو بمراجعة إدارة الموارد البشرية.
    يُدار إنشاء الحسابات وحذفها عبر إدارة الموارد البشرية بالمنشأة.</p>

    <h2>الأطفال</h2>
    <p>التطبيق مخصّص لموظفي المنشأة البالغين، وليس موجّهًا للأطفال.</p>

    <h2>التواصل</h2>
    <p>لأي استفسار بخصوص الخصوصية: ${PRIVACY_EMAIL
      ? `راسلنا على <a href="mailto:${PRIVACY_EMAIL}">${PRIVACY_EMAIL}</a>.`
      : "يُرجى مراجعة إدارة الموارد البشرية في العباءة الشرقية."}</p>

    <footer>© العباءة الشرقية — جميع الحقوق محفوظة · <a href="/">بوابة الموظفين</a></footer>
  </div>
</body></html>`;
}

router.get(["/privacy", "/privacy-policy"], (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("html").send(page());
});

export default router;
