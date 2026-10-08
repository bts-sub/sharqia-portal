// بوت تيليجرام «بيت العباءة الشرقية» — مساعد ذكي بـClaude.
// يعمل بالـlong-polling (لا يحتاج webhook ولا فتح بورت ولا تعديل Nginx).
import "dotenv/config";
import { Bot } from "grammy";
import { askClaude, CLAUDE_INFO } from "./claude.js";
import {
  getHistory, pushTurn, resetConversation,
  isAuthorized, authorize,
} from "./store.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN غير مضبوط — أوقفتُ التشغيل.");
  process.exit(1);
}

const ENABLED = (process.env.BOT_ENABLED ?? "true").toLowerCase() !== "false";
const ALLOWED = (process.env.BOT_ALLOWED_USERS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ACCESS_CODE = (process.env.BOT_ACCESS_CODE || "").trim();
const ADMIN_ID = (process.env.BOT_ADMIN_CHAT_ID || "").trim();

const bot = new Bot(TOKEN);

const WELCOME =
  "أهلًا بك في مساعد «بيت العباءة الشرقية» 🤖\n\n" +
  "اسألني أي شيء — عن بيانات الشركة (الموردين، العملاء، الصادرات/الواردات، الشحن) أو أي سؤال عام.\n\n" +
  "الأوامر:\n" +
  "/report — ملخّص أرشيف بيانات الشركة\n" +
  "/reset — ابدأ محادثة جديدة (نسيان السياق)\n" +
  "/id — أظهِر رقمك في تيليجرام\n" +
  "/help — مساعدة";

// ——— التحكّم في الوصول (مغلق افتراضيًا: بيانات الشركة سرّية) ———
// الأولوية: الأدمن < القائمة البيضاء < كود الدخول < مغلق.
function gate(ctx) {
  if (!ENABLED) return "disabled";
  const uid = String(ctx.from?.id || "");
  if (ADMIN_ID && uid === ADMIN_ID) return "ok";          // الأدمن مسموح دائمًا
  if (ALLOWED.length) return ALLOWED.includes(uid) ? "ok" : "denied";
  if (ACCESS_CODE) return isAuthorized(ctx.chat.id) ? "ok" : "need_code";
  return "denied";   // لا أدمن ولا قائمة ولا كود → مغلق (آمن افتراضيًا)
}

// ——— تقطيع الردّ الطويل (حدّ تيليجرام 4096 حرفًا) ———
function chunk(text, size = 3900) {
  const out = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size; // لا يوجد سطر مناسب → اقطع عند الحد
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest);
  return out;
}

async function sendLong(ctx, text) {
  for (const part of chunk(text)) {
    await ctx.reply(part, { disable_web_page_preview: true });
  }
}

// ——— الأوامر ———
bot.command("start", async (ctx) => {
  const g = gate(ctx);
  if (g === "disabled") return ctx.reply("البوت متوقّف مؤقتًا للصيانة. حاول لاحقًا 🙏");
  if (g === "denied") return ctx.reply("غير مصرّح لك باستخدام هذا البوت.");
  if (g === "need_code") return ctx.reply("من فضلك أرسل كود الدخول للمتابعة.");
  await ctx.reply(WELCOME);
});

bot.command("help", async (ctx) => {
  const g = gate(ctx);
  if (g === "disabled") return ctx.reply("البوت متوقّف مؤقتًا للصيانة. حاول لاحقًا 🙏");
  if (g === "denied") return ctx.reply("غير مصرّح لك باستخدام هذا البوت.");
  if (g === "need_code") return ctx.reply("من فضلك أرسل كود الدخول للمتابعة.");
  await ctx.reply(WELCOME);
});

// /id مفتوح عمدًا: يكشف رقمك أنت فقط (لا بيانات شركة) — مفيد لضبط القائمة البيضاء.
bot.command("id", async (ctx) => {
  await ctx.reply(`رقمك في تيليجرام: ${ctx.from?.id}\nرقم هذه المحادثة: ${ctx.chat.id}`);
});

bot.command("reset", async (ctx) => {
  resetConversation(ctx.chat.id);
  await ctx.reply("تمام، بدأنا من جديد ✨ (نسيت السياق السابق).");
});

bot.command("report", async (ctx) => {
  const g = gate(ctx);
  if (g !== "ok") return; // نفس منطق البوابة
  await ctx.api.sendChatAction(ctx.chat.id, "typing");
  try {
    const text = await askClaude(
      [],
      "اعرض ملخّصًا منظّمًا لأرشيف بيانات الشركة: الأقسام الرئيسية، أحجامها، وما الذي يصلح ماستر داتا لأودو. استخدم نقاطًا."
    );
    await sendLong(ctx, text);
  } catch (e) {
    console.error("report error:", e.message);
    await ctx.reply("حصل خطأ أثناء إعداد التقرير. جرّب تاني بعد شوية.");
  }
});

// فحص الحالة — للمصرّح لهم فقط
bot.command("ping", async (ctx) => {
  if (gate(ctx) !== "ok") return ctx.reply("غير مصرّح لك باستخدام هذا البوت.");
  await ctx.reply(`شغّال ✅ | الموديل: ${CLAUDE_INFO.model} | المعرفة: ${CLAUDE_INFO.knowledgeLoaded ? "محمّلة" : "غير محمّلة"}`);
});

// ——— الرسائل النصّية ———
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text) return;

  const g = gate(ctx);
  if (g === "disabled") return ctx.reply("البوت متوقّف مؤقتًا للصيانة. حاول لاحقًا 🙏");
  if (g === "denied") return ctx.reply("غير مصرّح لك باستخدام هذا البوت.");
  if (g === "need_code") {
    if (text === ACCESS_CODE) {
      authorize(ctx.chat.id);
      return ctx.reply("تم التفعيل ✅");
    }
    return ctx.reply("كود الدخول غير صحيح. أرسل الكود الصحيح للمتابعة.");
  }

  await ctx.api.sendChatAction(ctx.chat.id, "typing");
  try {
    const history = getHistory(ctx.chat.id);
    const answer = await askClaude(history, text);
    pushTurn(ctx.chat.id, text, answer);
    await sendLong(ctx, answer);
  } catch (e) {
    console.error("ask error:", e.message);
    const msg = /api key|authentication|401/i.test(e.message)
      ? "مشكلة في مفتاح Claude — راجع الإعداد."
      : "حصل خطأ مؤقت. جرّب تاني بعد لحظات 🙏";
    await ctx.reply(msg);
  }
});

bot.catch((err) => {
  console.error("bot error:", err?.error?.message || err?.message || err);
});

// ——— الإقلاع ———
bot.start({
  onStart: async (info) => {
    console.log(`بوت تيليجرام يعمل: @${info.username} | موديل: ${CLAUDE_INFO.model} | معرفة: ${CLAUDE_INFO.knowledgeLoaded}`);
    if (ADMIN_ID) {
      try {
        await bot.api.sendMessage(ADMIN_ID, `✅ البوت اشتغل: @${info.username}\nالموديل: ${CLAUDE_INFO.model}`);
      } catch { /* الأدمن لم يبدأ محادثة بعد */ }
    }
  },
});

// إيقاف نظيف
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
