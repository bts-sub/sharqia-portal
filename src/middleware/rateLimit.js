// تحديد معدل المحاولات على تسجيل الدخول (حماية من التخمين)
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // نافذة 15 دقيقة
  max: 10,                    // 10 محاولات لكل IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات كثيرة جدًا. حاول مرة أخرى بعد 15 دقيقة." },
});
