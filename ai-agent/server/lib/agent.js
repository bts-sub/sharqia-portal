// قلب المساعد: إنشاء المحادثة، بناء طلب Claude، تشغيل الدور مع البثّ،
// وأدوات «مجلد الجهاز» التي تُنفَّذ في متصفح المستخدم نفسه.
//
// السجلّ append-only: لا نعدّل رسالة سابقة أبدًا (لا قصّ ولا حذف) — هذا يُبقي
// كاش البرومبت صالحًا وكتل التفكير السابقة صالحة على الموديلات الحديثة.
// المرفقات تُحفظ كمراجع للخزنة {source:{type:"vault"}} وتُفكّ عند كل طلب
// بنفس البايتات تمامًا.
import Anthropic from "@anthropic-ai/sdk";
import { LIMITS } from "../config.js";
import { getAnthropicKey, getSettings } from "./settings.js";
import { buildSystemPrompt } from "./roles.js";
import { costOfUsage, modelInfo, MODELS } from "./models.js";
import { addCost, overBudget } from "./usage.js";
import { newId } from "./vault.js";
import { AppError } from "./errors.js";

let cached = { key: null, client: null };
export function getClient() {
  const key = getAnthropicKey();
  if (!key) throw new AppError("لم تُضِف الإدارة مفتاح Claude بعد — من صفحة الإدارة ← الإعدادات", 503);
  if (cached.key !== key) cached = { key, client: new Anthropic({ apiKey: key, maxRetries: 2 }) };
  return cached.client;
}

// ===== أدوات مجلد الجهاز (تُنفَّذ في المتصفح، قراءة فقط) =====
const FOLDER_TOOLS = [
  {
    name: "list_folder",
    description:
      "List files and sub-folders inside the folder the user connected from their device (read-only). " +
      "Use an empty path for the root. Returns names, relative paths, sizes and modification dates.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Relative sub-folder path inside the connected folder; empty for root" } },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "search_folder",
    description:
      "Search the connected device folder for files whose name or path contains the query (case-insensitive, Arabic or English). " +
      "Returns up to 50 matching relative paths.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Part of a file or folder name" } },
      required: ["query"],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: "read_folder_file",
    description:
      "Read one file from the connected device folder by its relative path. Supports PDF, images, Word (.docx), " +
      "Excel (.xlsx/.xls/.csv) and text/code files. Large files may be refused.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Relative path exactly as returned by list_folder/search_folder" } },
      required: ["path"],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
];
const FOLDER_TOOL_NAMES = new Set(FOLDER_TOOLS.map((t) => t.name));

function validToolInput(name, input) {
  if (!input || typeof input !== "object") return false;
  if (name === "list_folder") return input.path === undefined || typeof input.path === "string";
  if (name === "search_folder") return typeof input.query === "string" && input.query.trim().length > 0;
  if (name === "read_folder_file") return typeof input.path === "string" && input.path.trim().length > 0;
  return false;
}

// ===== إنشاء المحادثة: تثبيت التعليمات والأدوات والموديل لعمرها كله =====
export function createConversation(user, requestedModel) {
  const settings = getSettings();
  const allowed = user.limits?.models?.length ? user.limits.models : Object.keys(MODELS);
  let model = requestedModel || user.model || settings.defaultModel;
  if (!allowed.includes(model)) model = allowed[0];
  const f = user.limits?.features || {};
  const tools = { folder: Boolean(f.folder), web: Boolean(f.web) };
  return {
    id: newId(),
    title: "محادثة جديدة",
    model,
    effort: settings.effort,
    tools,
    system: buildSystemPrompt({ user, orgName: settings.orgName, tools }),
    messages: [],
    files: [],
    attachBytes: 0,
    pending: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function toolsFor(conv) {
  const tools = [];
  if (conv.tools.folder) tools.push(...FOLDER_TOOLS);
  if (conv.tools.web) {
    tools.push({
      type: modelInfo(conv.model).webSearch,
      name: "web_search",
      max_uses: 5,
      user_location: { type: "approximate", country: "SA", timezone: "Asia/Riyadh" },
    });
  }
  return tools;
}

// ===== المرفقات: كتل محفوظة كمراجع للخزنة =====
export function attachmentBlock(fileId, meta) {
  if (meta.kind === "image") return { type: "image", source: { type: "vault", id: fileId } };
  return { type: "document", source: { type: "vault", id: fileId }, title: meta.name.slice(0, 200) };
}

function hydrateBlock(block, vault) {
  if (block?.source?.type !== "vault") {
    if (block?.type === "tool_result" && Array.isArray(block.content)) {
      return { ...block, content: block.content.map((b) => hydrateBlock(b, vault)) };
    }
    return block;
  }
  const f = vault.getFile(block.source.id);
  if (!f) return { type: "text", text: `[ملف محذوف: ${block.title || ""}]` };
  if (f.meta.kind === "image") {
    return { type: "image", source: { type: "base64", media_type: f.meta.mediaType, data: f.buf.toString("base64") } };
  }
  if (f.meta.kind === "pdf") {
    return { ...block, source: { type: "base64", media_type: "application/pdf", data: f.buf.toString("base64") } };
  }
  return { ...block, source: { type: "text", media_type: "text/plain", data: f.buf.toString("utf8") } };
}

function apiMessages(conv, vault) {
  return conv.messages.map((m) => ({
    role: m.role,
    content: m.role === "user" ? m.content.map((b) => hydrateBlock(b, vault)) : m.content,
  }));
}

function buildParams(conv, vault) {
  const info = modelInfo(conv.model);
  const betas = ["compact-2026-01-12"];
  const params = {
    model: conv.model,
    max_tokens: 32000,
    system: [{ type: "text", text: conv.system }],
    messages: apiMessages(conv, vault),
    thinking: { type: "adaptive" },
    output_config: { effort: conv.effort || "medium" },
    cache_control: { type: "ephemeral" },
    context_management: { edits: [{ type: "compact_20260112" }] },
  };
  const tools = toolsFor(conv);
  if (tools.length) params.tools = tools;
  if (info.fallbacks) {
    betas.push("server-side-fallback-2026-07-01");
    params.fallbacks = "default";
  }
  params.betas = betas;
  return params;
}

// بعد fallback في منتصف الرد: ما قبل آخر كتلة fallback يُعاد نصًّا فقط
function cleanAssistantContent(content) {
  const lastFb = content.map((b) => b.type).lastIndexOf("fallback");
  if (lastFb === -1) return content;
  return [
    ...content.slice(0, lastFb).filter((b) => b.type === "text"),
    ...content.slice(lastFb + 1),
  ];
}

function apiErrorMessage(err) {
  if (err instanceof Anthropic.AuthenticationError) return "مفتاح Claude غير صالح — على الإدارة مراجعته من الإعدادات.";
  if (err instanceof Anthropic.PermissionDeniedError) return "مفتاح Claude لا يملك صلاحية لهذا الموديل.";
  if (err instanceof Anthropic.RateLimitError) return "ضغط كبير على الخدمة الآن — حاول بعد دقيقة.";
  if (err instanceof Anthropic.BadRequestError) {
    const msg = err.error?.error?.message || err.message || "";
    if (/credit balance/i.test(msg)) return "رصيد حساب Claude انتهى — على الإدارة شحن الرصيد.";
    if (/too long|context/i.test(msg)) return "المحادثة أصبحت طويلة جدًا — ابدأ محادثة جديدة.";
    return `تعذّر تنفيذ الطلب: ${msg.slice(0, 300)}`;
  }
  if (err instanceof Anthropic.InternalServerError || err?.status === 529) return "خدمة Claude مشغولة حاليًا — حاول بعد قليل.";
  if (err instanceof Anthropic.APIConnectionError) return "تعذّر الاتصال بخدمة Claude — تحقّق من اتصال السيرفر.";
  if (err instanceof AppError) return err.message;
  return "حدث خطأ غير متوقع أثناء توليد الرد.";
}

function statusFor(block) {
  switch (block.type) {
    case "thinking":
    case "redacted_thinking":
      return { kind: "thinking" };
    case "server_tool_use":
      return { kind: "web_search" };
    case "tool_use":
      return { kind: "tool", name: block.name };
    case "compaction":
      return { kind: "compacting" };
    case "text":
      return { kind: "writing" };
    default:
      return null;
  }
}

// ===== تشغيل الدور =====
// emit(event, data) يرسل أحداث SSE للمتصفح. يرجع عند انتهاء الرد أو طلب أداة.
export async function runAgent({ user, vault, conv, emit, signal }) {
  const client = getClient();
  for (let round = 0; round < LIMITS.maxToolRounds; round++) {
    if (round > 0 && overBudget(user)) {
      emit("notice", { message: "توقّف المساعد لأنك وصلت للحدّ الشهري المسموح." });
      break;
    }
    let partial = "";
    let msg;
    try {
      const stream = client.beta.messages.stream(buildParams(conv, vault), { signal });
      for await (const ev of stream) {
        if (ev.type === "content_block_start") {
          const st = statusFor(ev.content_block);
          if (st) emit("status", st);
        } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          partial += ev.delta.text;
          emit("delta", { text: ev.delta.text });
        }
      }
      msg = await stream.finalMessage();
    } catch (err) {
      if (signal?.aborted || err instanceof Anthropic.APIUserAbortError) {
        // إيقاف من المستخدم: نحفظ النص الجزئي فقط (بلا تفكير ولا أدوات ناقصة)
        if (partial.trim()) {
          conv.messages.push({ role: "assistant", content: [{ type: "text", text: `${partial} …` }], meta: { ts: Date.now(), stopped: true } });
        }
        vault.saveConversation(conv);
        emit("stopped", {});
        return;
      }
      console.error("[agent]", err?.status, err?.message);
      emit("error", { message: apiErrorMessage(err) });
      return;
    }

    const cost = costOfUsage(conv.model, msg.usage);
    addCost(user.id, cost);

    if (msg.stop_reason === "refusal") {
      emit("error", { message: "اعتذر المساعد عن هذا الطلب لأنه يخالف سياسات الاستخدام. جرّب صياغة أخرى." });
      vault.saveConversation(conv);
      return;
    }

    const content = cleanAssistantContent(msg.content);
    conv.messages.push({ role: "assistant", content, meta: { ts: Date.now(), model: msg.model, usd: cost.usd } });
    emit("usage", { usd: cost.usd });

    if (msg.stop_reason === "pause_turn") {
      vault.saveConversation(conv);
      emit("round", {});
      continue;
    }

    const toolUses = content.filter((b) => b.type === "tool_use");
    if (toolUses.length) {
      const calls = [];
      const preset = [];
      for (const t of toolUses) {
        if (msg.stop_reason === "tool_use" && FOLDER_TOOL_NAMES.has(t.name) && validToolInput(t.name, t.input)) {
          calls.push({ id: t.id, name: t.name, input: t.input });
        } else {
          preset.push({ type: "tool_result", tool_use_id: t.id, is_error: true, content: "Invalid or truncated tool input — try again with a valid input." });
        }
      }
      if (!calls.length) {
        conv.messages.push({ role: "user", content: preset, meta: { ts: Date.now(), toolResults: true } });
        vault.saveConversation(conv);
        emit("round", {});
        continue;
      }
      conv.pending = { order: toolUses.map((t) => t.id), calls, preset };
      vault.saveConversation(conv);
      emit("tool_request", { calls });
      return;
    }

    if (msg.stop_reason === "max_tokens") emit("notice", { message: "الرد طويل وتوقف عند الحد الأقصى — اكتب «أكمل» للمتابعة." });
    if (msg.stop_reason === "model_context_window_exceeded") emit("notice", { message: "المحادثة طويلة جدًا — ابدأ محادثة جديدة." });
    vault.saveConversation(conv);
    emit("done", {});
    return;
  }
  vault.saveConversation(conv);
  emit("done", {});
}

// ===== بناء رسائل المستخدم =====
export const VOICE_TAG = "[رسالة صوتية]";

// نتائج أدوات معلّقة لم تُرسَل (مثلًا أُغلق المتصفح) تُغلق كأخطاء قبل الرسالة الجديدة
export function cancelPendingBlocks(conv) {
  if (!conv.pending) return [];
  const blocks = [
    ...conv.pending.preset,
    ...conv.pending.calls.map((c) => ({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "Cancelled — the user sent a new message instead." })),
  ];
  conv.pending = null;
  return orderResults(blocks, blocks.map((b) => b.tool_use_id));
}

function orderResults(blocks, order) {
  return [...blocks].sort((a, b) => order.indexOf(a.tool_use_id) - order.indexOf(b.tool_use_id));
}

// results: [{id, text?, fileId?, isError?}] من المتصفح
export function toolResultsMessage(conv, results, vault) {
  const p = conv.pending;
  if (!p) throw new AppError("لا توجد أدوات بانتظار نتائج", 409);
  const byId = new Map((Array.isArray(results) ? results : []).map((r) => [r?.id, r]));
  const blocks = [...p.preset];
  for (const c of p.calls) {
    const r = byId.get(c.id);
    if (!r) {
      blocks.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "No result returned by the device." });
      continue;
    }
    const content = [];
    if (typeof r.text === "string" && r.text) content.push({ type: "text", text: r.text.slice(0, 200_000) });
    if (typeof r.fileId === "string") {
      const meta = vault.fileMeta(r.fileId);
      if (meta) {
        content.push(attachmentBlock(r.fileId, meta));
        if (!conv.files.includes(r.fileId)) {
          conv.files.push(r.fileId);
          conv.attachBytes += meta.size;
          vault.linkFiles([r.fileId], conv.id);
        }
      }
    }
    if (!content.length) content.push({ type: "text", text: "(empty result)" });
    blocks.push({ type: "tool_result", tool_use_id: c.id, is_error: Boolean(r.isError), content });
  }
  conv.pending = null;
  return orderResults(blocks, p.order);
}

// ===== عرض المحادثة للمتصفح (بلا تفكير ولا تفاصيل داخلية) =====
const toolLabel = (b) => {
  const i = b.input || {};
  if (b.name === "list_folder") return `تصفّح المجلد: ${i.path || "الرئيسي"}`;
  if (b.name === "search_folder") return `بحث في الملفات: ${i.query || ""}`;
  if (b.name === "read_folder_file") return `قراءة ملف: ${i.path || ""}`;
  if (b.name === "web_search") return `بحث في الإنترنت: ${i.query || ""}`;
  return b.name;
};

export function toDisplay(conv) {
  const items = [];
  for (const m of conv.messages) {
    if (m.role === "user") {
      const texts = m.content.filter((b) => b.type === "text" && !(m.meta?.voice && b.text === VOICE_TAG)).map((b) => b.text);
      const files = m.meta?.files || [];
      if (!texts.length && !files.length) continue; // رسالة نتائج أدوات فقط
      items.push({ role: "user", text: texts.join("\n"), files, voice: Boolean(m.meta?.voice), ts: m.meta?.ts });
    } else {
      let last = items[items.length - 1];
      if (!last || last.role !== "assistant") {
        last = { role: "assistant", text: "", tools: [], ts: m.meta?.ts };
        items.push(last);
      }
      for (const b of m.content) {
        if (b.type === "text" && b.text) last.text += (last.text && !last.text.endsWith("\n") ? "\n\n" : "") + b.text;
        else if (b.type === "tool_use" || b.type === "server_tool_use") last.tools.push(toolLabel(b));
        else if (b.type === "compaction") last.tools.push("تلخيص بداية المحادثة لتوفير الذاكرة");
      }
      if (m.meta?.stopped) last.stopped = true;
    }
  }
  return {
    id: conv.id,
    title: conv.title,
    model: conv.model,
    tools: conv.tools,
    createdAt: conv.createdAt,
    items,
    pending: conv.pending ? { calls: conv.pending.calls } : null,
  };
}
