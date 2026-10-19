// منصّة المساعدين الأذكياء — بيت العباءة الشرقية.
// خلف Nginx على السيرفر نفسه؛ البيانات تبقى على السيرفر مشفّرة لكل مستخدم.
import "./lib/bootstrap-env.js";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PORT, VERSION, WEB_DIST, IS_PROD } from "./config.js";
import { AppError } from "./lib/errors.js";
import { requireAdmin, requireAuth, requireReady } from "./lib/session.js";
import { createUser, listUsers } from "./lib/users.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import fileRoutes from "./routes/files.js";
import voiceRoutes from "./routes/voice.js";
import adminRoutes from "./routes/admin.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'", "blob:", "data:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "worker-src": ["'self'", "blob:"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": IS_PROD ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  next();
});

// لا ضغط لمسارات البثّ (SSE) — الضغط يحبس الأحداث حتى نهاية الرد
app.use(compression({ filter: (req, res) => !/\/messages$|\/tool-results$/.test(req.path) && compression.filter(req, res) }));
app.use(cookieParser());
app.use("/api", express.json({ limit: "1mb" }));

// حماية CSRF: كل طلب يغيّر بيانات لازم يحمل ترويسة التطبيق (تفرض preflight
// على أي موقع آخر) — إضافةً إلى كوكي SameSite=Strict.
app.use("/api", (req, res, next) => {
  if (req.method !== "GET" && req.headers["x-app"] !== "sq-ai") {
    return next(new AppError("طلب مرفوض", 403));
  }
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true, version: VERSION }));
app.use("/api/auth", authRoutes);
app.use("/api/conversations", requireAuth, requireReady, chatRoutes);
app.use("/api/files", requireAuth, requireReady, fileRoutes);
app.use("/api/voice", requireAuth, requireReady, voiceRoutes);
app.use("/api/admin", requireAuth, requireReady, requireAdmin, adminRoutes);
app.use("/api", (req, res, next) => next(new AppError("المسار غير موجود", 404)));

// الواجهة (React مبنية مسبقًا)
if (existsSync(WEB_DIST)) {
  app.use(
    express.static(WEB_DIST, {
      index: false,
      setHeaders(res, path) {
        if (/[\\/]assets[\\/]/.test(path)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(resolve(WEB_DIST, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "حجم الطلب أكبر من المسموح" });
  const status = err instanceof AppError ? err.status : err?.status && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error("[error]", err);
  const message = err instanceof AppError ? err.message : status < 500 ? "طلب غير صالح" : "خطأ داخلي في السيرفر";
  if (res.headersSent) return res.end();
  res.status(status).json({ error: message });
});

// أول تشغيل: حساب المدير العام من البيئة (يُطلب منه تغيير كلمة المرور عند الدخول)
async function bootstrapAdmin() {
  if (listUsers().length) return;
  const username = process.env.AI_ADMIN_USER;
  const password = process.env.AI_ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn("[boot] لا توجد حسابات — اضبط AI_ADMIN_USER و AI_ADMIN_PASSWORD لإنشاء حساب المدير العام");
    return;
  }
  await createUser(
    {
      username, password,
      displayName: process.env.AI_ADMIN_NAME || "المدير العام",
      jobTitle: "المدير العام",
      agent: { name: "سند", gender: "male", role: "general" },
      limits: { monthlyUsd: 0, features: { voice: true, files: true, folder: true, web: true } },
      mustChangePassword: true,
    },
    { isAdmin: true },
  );
  console.log(`[boot] أُنشئ حساب المدير العام: ${username}`);
}

await bootstrapAdmin();
app.listen(PORT, () => console.log(`[ai] v${VERSION} على المنفذ ${PORT}`));
