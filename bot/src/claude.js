// نداء Claude (Anthropic Messages API) — يبني النظام (system) من ملفات المعرفة
// ويمرّر تاريخ المحادثة. مستقلّ عن طبقة تيليجرام ليسهل اختباره وتبديله.
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = resolve(__dirname, "..", "knowledge");

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS || "1500", 10);

// تُحمَّل ملفات المعرفة مرّة عند الإقلاع (تتغيّر نادرًا، وإعادة التشغيل تلتقط الجديد).
function loadKnowledge() {
  try {
    const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
    return files
      .map((f) => `# مصدر: ${f}\n\n${readFileSync(join(KNOWLEDGE_DIR, f), "utf8")}`)
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}
const KNOWLEDGE = loadKnowledge();

const SYSTEM_PROMPT = `أنت المساعد الذكي لشركة «بيت العباءة الشرقية» (تصنيع وتجارة عبايات وأقمشة؛ سعودية ولها تعاملات تصدير/استيراد).
تتحدّث مع صاحب الشركة وفريقه عبر تيليجرام. ردودك بالعربية (اللهجة المصرية/الخليجية البسيطة مقبولة)، مختصرة وعملية ومنظّمة.
- للأسئلة عن بيانات الشركة: استعن بقسم «معرفة الشركة» أدناه.
- إن سُئلت عن أرقام تفصيلية لم تُستخرَج بعد، وضّح أن المستندات أغلبها صور (PDF) تحتاج مرحلة استخراج (OCR) لم تكتمل، ولا تخترع أرقامًا.
- عند التلخيص استخدم نقاطًا وجداول نصّية بسيطة تناسب تيليجرام.
- لو السؤال عام (مش عن الشركة) جاوبه عادي كمساعد ذكي.

================ معرفة الشركة ================
${KNOWLEDGE || "(لا توجد ملفات معرفة محمّلة بعد.)"}
==============================================`;

let client = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY غير مضبوط");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// history: مصفوفة [{role:'user'|'assistant', content:'...'}], userText: الرسالة الجديدة.
export async function askClaude(history, userText) {
  const messages = [...history, { role: "user", content: userText }];
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages,
  });
  const text = (resp.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "…";
}

export const CLAUDE_INFO = { model: MODEL, knowledgeLoaded: KNOWLEDGE.length > 0 };
