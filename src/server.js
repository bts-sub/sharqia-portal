// ===========================================================================
// server.js — نقطة تشغيل الخادم
//   Helmet + compression + cookie-parser + CORS (اختياري) + المسارات + تقديم الواجهة
// ===========================================================================
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { config, warnConfig } from "./config.js";
import { seedAdminIfEmpty } from "./lib/users.js";
import { isTestMode } from "./lib/settings.js";
import { testConnection } from "./lib/odooClient.js";
import { maskCreds } from "./lib/odooCreds.js";
import { AppError } from "./lib/errors.js";

import authRoutes from "./routes/auth.js";
import odooRoutes from "./routes/odoo.js";
import employeeRoutes from "./routes/employee.js";
import leaveRoutes from "./routes/leaves.js";
import requestRoutes from "./routes/requests.js";
import attachmentRoutes from "./routes/attachments.js";
import attendanceRoutes from "./routes/attendance.js";
import notificationRoutes from "./routes/notifications.js";
import settingsRoutes from "./routes/settings.js";
import permissionRoutes from "./routes/permissions.js";
import userRoutes from "./routes/users.js";
import letterRoutes from "./routes/letters.js";
import integrationRoutes from "./routes/integration.js";
import learningRoutes from "./routes/learning.js";
import disciplineRoutes from "./routes/discipline.js";
import pushRoutes from "./routes/push.js";
import cardRoutes from "./routes/card.js";
import downloadRoutes from "./routes/download.js";
import legalRoutes from "./routes/legal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// خلف Nginx: ثِق بالـ proxy الأول للحصول على IP الحقيقي (لتحديد المعدل)
app.set("trust proxy", 1);

// أمان ورؤوس. نسمح بالسكربتات المضمّنة لأن الواجهة ملف HTML واحد يحوي React مضمّنًا.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
      "script-src-elem": ["'self'", "'unsafe-inline'", "blob:"],
      "worker-src": ["'self'", "blob:"],
      "connect-src": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "style-src-elem": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https:"],
      // مشغّلات الفيديو التدريبي داخل الشاشة. بدون frame-src صريح يرث
      // default-src 'self' فيُحجب كل إطار خارجي — والدرس يبقى بلا فيديو.
      // والقائمة محصورة في مشغّلَين معروفَين لا "https:" مفتوحة: الإطار
      // يُنفّذ سكربتات، فتوسيعه يوسّع سطح الهجوم بلا داعٍ.
      "frame-src": ["'self'", "https://www.youtube.com",
        "https://www.youtube-nocookie.com", "https://player.vimeo.com"],
      // ملفات الفيديو المرفوعة على أي مستضيف تُشغَّل بوسم video لا بإطار،
      // فلا تُنفِّذ شيئًا — ويكفيها https.
      "media-src": ["'self'", "data:", "blob:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: "12mb" }));   // يسمح بالمرفقات base64
app.use(cookieParser());

// سجل وصول مختصر: سطر واحد لكل طلب. بدونه لا يوجد أي أثر حين يقول موظف
// «طلبي لم يصل». لا تُسجَّل أجسام الطلبات إطلاقًا (فيها base64 وكلمات مرور).
app.use((req, res, next) => {
  if (req.path === "/api/health") return next();
  const t0 = Date.now();
  res.on("finish", () => {
    if (!req.path.startsWith("/api/")) return;   // الملفات الساكنة لا تُسجَّل
    const line = {
      t: new Date().toISOString(), m: req.method, p: req.path,
      s: res.statusCode, ms: Date.now() - t0,
      u: req.user?.login || "-", ip: req.ip,
    };
    if (res.statusCode >= 400) console.warn("⚠️", JSON.stringify(line));
    else console.log(JSON.stringify(line));
  });
  next();
});
if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin, credentials: true }));

// فحص صحّة
app.get("/api/health", (req, res) =>
  res.json({ ok: true, version: config.version, env: config.env, testMode: isTestMode() }));

// تشخيص الاتصال بأودو.
//   عام: حالة فقط — تكفي لمراقبة التشغيل (UptimeRobot) ولا تكشف شيئًا.
//   بالتفاصيل: للأدمن فقط عبر ?key=<INTEGRATION_TOKEN> — الرابط واسم قاعدة
//   البيانات واسم حساب الخدمة ثلاثة أرباع بيانات الدخول إلى Odoo، ونشرها
//   للعامة يحوّل أي كلمة مرور ضعيفة إلى اختراق كامل.
app.get("/api/health/odoo", async (req, res) => {
  const detailed = !!config.integrationToken && req.query.key === config.integrationToken;
  const detail = detailed ? { odoo: maskCreds() } : {};
  if (isTestMode()) {
    return res.json({ ok: false, testMode: true, reason: "وضع الاختبار مفعّل — لا يتم الاتصال بأودو", ...detail });
  }
  try {
    const r = await testConnection();
    res.json({ ok: true, testMode: false, odooVersion: r.odooVersion, ...detail });
  } catch (e) {
    res.status(503).json({ ok: false, testMode: false, ...(detailed ? { error: e.message } : {}), ...detail });
  }
});

// المسارات
app.use("/api", integrationRoutes);
app.use("/api", authRoutes);
app.use("/api", odooRoutes);
app.use("/api", employeeRoutes);
app.use("/api", leaveRoutes);
app.use("/api", requestRoutes);
app.use("/api", attachmentRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", notificationRoutes);
app.use("/api", settingsRoutes);
app.use("/api", permissionRoutes);
app.use("/api", userRoutes);
app.use("/api", letterRoutes);
app.use("/api", learningRoutes);
app.use("/api", disciplineRoutes);
app.use("/api", pushRoutes);
// البطاقة المهنية: يحمل مساري /api/me/card و /c/:token — يُركّب قبل التقاط
// الواجهة لكل المسارات (app.get("*")) وإلا ابتلعت الصفحةُ العامةَ الرابطَ.
app.use(cardRoutes);
// صفحة التنزيل الذكية (/download و /app) — قبل التقاط الواجهة لكل المسارات.
app.use(downloadRoutes);
// صفحة سياسة الخصوصية (/privacy) — مطلوبة لنشر المتاجر، قبل التقاط الواجهة.
app.use(legalRoutes);

// تقديم الواجهة (ملف HTML الواحد) — إن وُجد
const frontendPath = path.resolve(__dirname, "..", config.frontendFile);
if (fs.existsSync(frontendPath)) {
  const publicDir = path.dirname(frontendPath);

  // ⚠️ رقمُ النسخة يُحقَن عند الإقلاع، ولا يُكتب بيد أحد في الحزمة ولا في
  // عامل الخدمة. كان مكتوبًا في ثلاثة مواضع تُحدَّث يدويًّا، فتفترق: الخادم
  // يقول 1.85 والحزمة تقول 1.94 وعاملُ الخدمة يقول v96. والتطبيق يعرف أنه
  // قديمٌ بمقارنة رقمه برقم الخادم — فما داما لا يتطابقان أبدًا فالمقارنة
  // لا تدلّ على شيء، ويبقى الموظف على نسخةٍ قديمة حتى يطلب التحديث بيده.
  //
  // فصار المصدر واحدًا: package.json. رفعُه وحده ينشر التحديث على الأجهزة
  // كلّها: يتغيّر رقم الحزمة فتُعيد الصفحة تحميل نفسها، ويتغيّر اسم مخزن
  // عامل الخدمة فيُستبدل العامل ويُفرَّغ القديم.
  const stamp = (src) => src
    .replace(/window\.SQ_BUILD\s*=\s*"[^"]*"/, `window.SQ_BUILD = "${config.version}"`)
    .replace(/const VERSION = "[^"]*"/, `const VERSION = "v${config.version}"`);

  const indexHtml = stamp(fs.readFileSync(frontendPath, "utf8"));
  const swSource = stamp(fs.readFileSync(path.join(publicDir, "sw.js"), "utf8"));
  console.log(`📦 نسخة التطبيق المنشورة: ${config.version}`);

  // عامل الخدمة يجب ألّا يُخزَّن طويلًا: المتصفح يقارنه بالخادم ليكتشف نسخة
  // جديدة، فتخزينه يعني بقاء الموظفين على نسخة قديمة بعد كل نشر.
  app.get("/sw.js", (req, res) => {
    res.set("Cache-Control", "no-cache, must-revalidate");
    res.type("application/javascript").send(swSource);
  });
  // بعض إصدارات express لا تعرف امتداد webmanifest فتُرسله نصًّا عاديًا
  // فيتجاهله المتصفح ولا يظهر عرض التثبيت
  app.get("/manifest.webmanifest", (req, res) => {
    res.type("application/manifest+json");
    res.sendFile(path.join(publicDir, "manifest.webmanifest"));
  });
  // الصفحة تُرسَل من الذاكرة بنسختها المحقونة. و index:false يمنع
  // express.static من تقديم الملف الخام قبل أن نصل إليه.
  const sendApp = (req, res) => {
    // no-cache لا no-store: المتصفّح يسأل «هل تغيّرت؟» فيردّ الخادم 304 بلا
    // جسم حين لا تتغيّر — بدل تنزيل الصفحة كاملة في كل فتحة. والتحديث يبقى
    // فوريًّا لأن الردّ لا يُستعمل بلا مراجعة.
    res.set("Cache-Control", "no-cache");
    res.type("html").send(indexHtml);
  };
  app.get("/", sendApp);
  app.get("/index.html", sendApp);
  app.use(express.static(publicDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    sendApp(req, res);
  });
}

// معالج الأخطاء الموحّد — الواجهة تتوقّع { error }
app.use((err, req, res, next) => {
  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) console.error("❌", err);
  res.status(status).json({ error: err.message || "خطأ غير متوقّع" });
});

async function start() {
  warnConfig();
  await seedAdminIfEmpty();
  const server = app.listen(config.port, () => {
    console.log(`✅ خادم «العباءة الشرقية» v${config.version} يعمل على المنفذ ${config.port} — الوضع: ${config.testMode ? "اختبار (fixtures)" : "Odoo مباشر"}`);
  });

  // إيقاف نظيف: ينهي الطلبات الجارية بدل قتلها في منتصف الكتابة على القرص
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      console.log(`↩️ استلمت ${sig} — إيقاف نظيف…`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 8000).unref();
    });
  }
  // لا تُسقط العملية بصمت على وعد مرفوض غير ملتقَط
  process.on("unhandledRejection", (e) => console.error("❌ وعد مرفوض غير ملتقَط:", e));
}
start();
