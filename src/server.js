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
import { AppError } from "./lib/errors.js";

import authRoutes from "./routes/auth.js";
import odooRoutes from "./routes/odoo.js";
import employeeRoutes from "./routes/employee.js";
import leaveRoutes from "./routes/leaves.js";
import requestRoutes from "./routes/requests.js";
import attachmentRoutes from "./routes/attachments.js";
import notificationRoutes from "./routes/notifications.js";
import settingsRoutes from "./routes/settings.js";
import permissionRoutes from "./routes/permissions.js";
import integrationRoutes from "./routes/integration.js";

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
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: "12mb" }));   // يسمح بالمرفقات base64
app.use(cookieParser());
if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin, credentials: true }));

// فحص صحّة
app.get("/api/health", (req, res) => res.json({ ok: true, env: config.env, testMode: isTestMode() }));

// المسارات
app.use("/api", integrationRoutes);
app.use("/api", authRoutes);
app.use("/api", odooRoutes);
app.use("/api", employeeRoutes);
app.use("/api", leaveRoutes);
app.use("/api", requestRoutes);
app.use("/api", attachmentRoutes);
app.use("/api", notificationRoutes);
app.use("/api", settingsRoutes);
app.use("/api", permissionRoutes);

// تقديم الواجهة (ملف HTML الواحد) — إن وُجد
const frontendPath = path.resolve(__dirname, "..", config.frontendFile);
if (fs.existsSync(frontendPath)) {
  const publicDir = path.dirname(frontendPath);
  app.use(express.static(publicDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(frontendPath);
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
  app.listen(config.port, () => {
    console.log(`✅ خادم بوابة «بيت العباءة الشرقية» يعمل على المنفذ ${config.port} — الوضع: ${config.testMode ? "اختبار (fixtures)" : "Odoo مباشر"}`);
  });
}
start();
