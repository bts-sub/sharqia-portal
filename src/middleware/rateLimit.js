// تحديد معدل المحاولات على تسجيل الدخول (حماية من التخمين)
//
// كان محدِّدًا واحدًا: عشر محاولات لكل عنوان شبكة في ربع ساعة، تُحتسب فيها
// الناجحة والفاشلة سواء. وأثره أنّ من يدخل ويخرج بحسابات صحيحة — كما تفعل
// الموارد البشرية وهي تجرّب حسابات موظفيها — يُقفَل عليه الباب وهو لم يخطئ
// كلمةً واحدة. والأسوأ أنّ مكتبًا كاملًا خلف عنوانٍ واحد يُقفَل عليه جميعًا
// لأن أحدهم أخطأ عشر مرات.
//
// فصارا محدِّدَين، وكلاهما لا يعدّ إلا الفاشل:
//   • على (العنوان + الحساب): يحمي حسابًا بعينه من التخمين المتكرّر.
//   • على العنوان وحده بسقفٍ أوسع: يحمي من رشّ كلمات المرور على حساباتٍ
//     كثيرة من مصدرٍ واحد — وهو ما كان التقييد بالحساب وحده سيفتحه.
//
// ودخولٌ ناجح ليس محاولةَ تخمين، فلا يُعدّ. وبهذا لا يُقفَل على مُحقٍّ باب.
import rateLimit from "express-rate-limit";

// IPv6 يُعطي كل جهازٍ نطاقًا واسعًا من العناوين، فالعدّ بعنوانٍ كامل لا
// يحمي شيئًا: يبدّل المهاجم آخر أرقامه ويتجاوز السقف. نأخذ أول أربع كتل
// (‎/64‎) وهي ما يُخصَّص للمشترك الواحد عادةً.
function ipKey(req) {
  const ip = req.ip || "";
  if (!ip.includes(":")) return ip;                 // IPv4 كما هو
  return ip.split(":").slice(0, 4).join(":") + "::/64";
}

const MESSAGE = {
  error: "محاولات كثيرة جدًا. حاول مرة أخرى بعد 15 دقيقة.",
};

const perAccount = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                       // عشر محاولات فاشلة على الحساب الواحد
  skipSuccessfulRequests: true,  // الدخول الصحيح ليس محاولةَ تخمين
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const login = String(req.body?.login || "").trim().toLowerCase();
    return `${ipKey(req)}|${login}`;
  },
  message: MESSAGE,
});

const perAddress = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,                       // رشُّ كلمات المرور على حسابات كثيرة
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: MESSAGE,
});

export const loginLimiter = [perAccount, perAddress];
