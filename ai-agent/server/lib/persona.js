// «سند يعرفك»: ملف شخصي يكتبه المستخدم (من هو، عمله، أسلوبه، حدوده، وإجابات معتمدة
// للأسئلة المتكررة) — يستخدمه المساعد في المحادثة والمتابعات والرد على المكالمات.
// يُحفظ مشفّرًا بمفتاح السيرفر لأن وكيل المكالمات والمتابعات تعمل والمستخدم غير متصل.
import { resolve } from "node:path";
import { readSecure, userDir, writeSecure } from "./connectors/secure.js";
import { getClient } from "./claude.js";
import { costOfUsage } from "./models.js";
import { addCost } from "./usage.js";
import { AppError } from "./errors.js";

const file = (uid) => resolve(userDir(uid), "persona.enc");
const aad = (uid) => `persona:${uid}`;
const EMPTY = { about: "", style: "", boundaries: "", faqs: [], updatedAt: null };

export function getPersona(uid) {
  try {
    return { ...EMPTY, ...(readSecure(file(uid), aad(uid)) || {}) };
  } catch {
    return { ...EMPTY };
  }
}

const clip = (v, n) => String(v || "").trim().slice(0, n);

export function savePersona(uid, patch = {}) {
  const cur = getPersona(uid);
  const next = {
    about: patch.about !== undefined ? clip(patch.about, 5000) : cur.about,
    style: patch.style !== undefined ? clip(patch.style, 3000) : cur.style,
    boundaries: patch.boundaries !== undefined ? clip(patch.boundaries, 3000) : cur.boundaries,
    faqs: Array.isArray(patch.faqs)
      ? patch.faqs.map((f) => ({ q: clip(f?.q, 400), a: clip(f?.a, 2000) })).filter((f) => f.q && f.a).slice(0, 100)
      : cur.faqs,
    updatedAt: new Date().toISOString(),
  };
  writeSecure(file(uid), next, aad(uid));
  return next;
}

export const personaIsEmpty = (p) => !p.about && !p.style && !p.boundaries && !p.faqs.length;

// كتلة نصية تُضاف لتعليمات المساعد (المحادثة/المتابعات/المكالمات)
export function personaBlock(p, name) {
  if (!p || personaIsEmpty(p)) return "";
  const parts = [`ما يعرفه المساعد عن ${name} (كتبه بنفسه — معلومات معتمدة):`];
  if (p.about) parts.push(`• عنه وعن عمله:\n${p.about}`);
  if (p.style) parts.push(`• أسلوبه في الكلام والكتابة:\n${p.style}`);
  if (p.boundaries) parts.push(`• حدود لا يتجاوزها المساعد أبدًا:\n${p.boundaries}`);
  if (p.faqs.length) {
    parts.push(`• أسئلة متكررة وإجاباته المعتمدة (أجب بمضمونها، ولا تتجاوزها في الأمور الحساسة):\n${p.faqs.map((f, i) => `${i + 1}) س: ${f.q}\n   ج: ${f.a}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

const LEARN_SCHEMA = {
  type: "object",
  properties: {
    style: { type: "string", description: "وصف مختصر لأسلوبه: لهجته، طول رسائله، تحيّاته، مدى رسميته، عبارات يكررها" },
    facts: { type: "array", items: { type: "string" }, description: "حقائق ثابتة عن عمله وردت صراحةً (منتجات، سياسات، مواعيد، أسعار مذكورة)" },
    faqs: {
      type: "array",
      items: {
        type: "object",
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
        additionalProperties: false,
      },
      description: "أسئلة تكررت من الناس وكيف أجاب عنها هو فعلًا (بأسلوبه)",
    },
    boundaries: { type: "array", items: { type: "string" }, description: "أشياء رفضها أو تحفّظ عليها أو قال إنه يقررها بنفسه" },
  },
  required: ["style", "facts", "faqs", "boundaries"],
  additionalProperties: false,
};

// يتعلّم من محادثات حقيقية: يرجع اقتراحات يراجعها المستخدم قبل الحفظ
export async function learnFromConversations(user, text, { selfName } = {}) {
  const body = String(text || "").trim();
  if (body.length < 200) throw new AppError("النص قصير جدًا للتعلّم منه — أرسل محادثات أطول", 400);
  const sample = body.slice(-90_000);
  const me = selfName || user.displayName;
  const resp = await getClient().messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 8000,
    system:
      `أنت تحلّل محادثات واتساب حقيقية لـ«${me}» (${user.jobTitle || "موظف"}) لتبني ملفًا يساعد مساعده الذكي على تمثيله بدقة.\n` +
      `رسائله هو هي التي يكون مرسلها «${me}» أو «أنا». استخرج فقط ما ورد صراحةً — لا تخترع أسعارًا أو وعودًا أو معلومات. ` +
      "اكتب الإجابات المقترحة بأسلوبه هو وبلهجته، ولا تضمّن أرقام هواتف أو بيانات شخصية لأطراف أخرى.",
    messages: [{ role: "user", content: `<conversations>\n${sample}\n</conversations>\n\nاستخرج الملف.` }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: LEARN_SCHEMA } },
  });
  addCost(user.id, costOfUsage("claude-sonnet-5-5", resp.usage));
  if (resp.stop_reason === "refusal") throw new AppError("تعذّر تحليل هذه المحادثات", 422);
  try {
    return JSON.parse(resp.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  } catch {
    throw new AppError("تعذّر فهم نتيجة التحليل — حاول مرة أخرى", 502);
  }
}
