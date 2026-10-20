// المحادثات والرسائل (بثّ SSE) ونتائج أدوات الجهاز.
import { Router } from "express";
import { wrap, AppError } from "../lib/errors.js";
import {
  attachmentBlock, cancelPendingBlocks, createConversation, runAgent, toDisplay, toolResultsMessage, VOICE_TAG,
} from "../lib/agent.js";
import { countMessage, limitBlock } from "../lib/usage.js";
import { LIMITS } from "../config.js";

const r = Router();

// توليد واحد نشط لكل محادثة؛ الإيقاف يتم بطلب صريح (انقطاع الشبكة لا يوقف
// التوليد — يكتمل ويُحفظ، ويجده المستخدم عند العودة).
const active = new Map(); // `${uid}:${convId}` -> AbortController

function loadConv(req) {
  const conv = req.vault.getConversation(req.params.id);
  if (!conv) throw new AppError("المحادثة غير موجودة", 404);
  return conv;
}

function sse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  let open = true;
  res.on("close", () => { open = false; });
  const ping = setInterval(() => open && res.write(": ping\n\n"), 15_000);
  return {
    emit(event, data) {
      if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      clearInterval(ping);
      if (open) res.end();
    },
  };
}

async function runStreamed(req, res, conv, { effort } = {}) {
  const key = `${req.user.id}:${conv.id}`;
  const ctrl = new AbortController();
  active.set(key, ctrl);
  const out = sse(res);
  try {
    await runAgent({ user: req.user, vault: req.vault, conv, emit: out.emit, signal: ctrl.signal, effort });
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[chat]", err);
    out.emit("error", { message: err instanceof AppError ? err.message : "حدث خطأ غير متوقع" });
  } finally {
    active.delete(key);
    out.end();
  }
}

function assertIdle(req, convId) {
  if (active.has(`${req.user.id}:${convId}`)) throw new AppError("المساعد ما زال يكتب الرد السابق", 409);
}

r.get("/", (req, res) => {
  res.json({ conversations: req.vault.listConversations() });
});

r.post("/", wrap(async (req, res) => {
  const conv = createConversation(req.user, req.body?.model);
  req.vault.saveConversation(conv);
  res.json(toDisplay(conv));
}));

r.get("/:id", (req, res) => {
  const conv = loadConv(req);
  res.json({ ...toDisplay(conv), busy: active.has(`${req.user.id}:${conv.id}`) });
});

r.patch("/:id", (req, res) => {
  const conv = loadConv(req);
  const title = String(req.body?.title || "").trim().slice(0, 80);
  if (title) conv.title = title;
  req.vault.saveConversation(conv);
  res.json({ ok: true });
});

r.delete("/:id", (req, res) => {
  assertIdle(req, req.params.id);
  if (!req.vault.deleteConversation(req.params.id)) throw new AppError("المحادثة غير موجودة", 404);
  res.json({ ok: true });
});

r.post("/:id/stop", (req, res) => {
  active.get(`${req.user.id}:${req.params.id}`)?.abort();
  res.json({ ok: true });
});

r.post("/:id/messages", wrap(async (req, res) => {
  const conv = loadConv(req);
  assertIdle(req, conv.id);
  const blocked = limitBlock(req.user);
  if (blocked) throw new AppError(blocked, 429);

  const text = String(req.body?.text || "").trim().slice(0, 30_000);
  const fileIds = Array.isArray(req.body?.files) ? req.body.files.slice(0, 10) : [];
  const voice = Boolean(req.body?.voice) && req.user.limits?.features?.voice !== false;
  if (!text && !fileIds.length) throw new AppError("اكتب رسالة أو أرفق ملفًا", 400);
  if (fileIds.length && req.user.limits?.features?.files === false) throw new AppError("رفع الملفات غير مسموح لحسابك", 403);

  const blocks = cancelPendingBlocks(conv);
  const files = [];
  for (const id of fileIds) {
    const meta = req.vault.fileMeta(id);
    if (!meta) throw new AppError("أحد الملفات المرفقة لم يعد موجودًا — أعد رفعه", 400);
    if (conv.attachBytes + meta.size > LIMITS.convAttachBytes) {
      throw new AppError("مرفقات هذه المحادثة تجاوزت الحد — ابدأ محادثة جديدة للملفات الإضافية", 413);
    }
    blocks.push(attachmentBlock(id, meta));
    files.push({ id, name: meta.name, kind: meta.kind });
    if (!conv.files.includes(id)) {
      conv.files.push(id);
      conv.attachBytes += meta.size;
    }
  }
  if (voice) blocks.push({ type: "text", text: VOICE_TAG });
  if (text) blocks.push({ type: "text", text });
  else blocks.push({ type: "text", text: "اطّلع على المرفقات." });

  req.vault.linkFiles(files.map((f) => f.id), conv.id);
  conv.messages.push({ role: "user", content: blocks, meta: { ts: Date.now(), voice, files } });
  if (conv.title === "محادثة جديدة") {
    conv.title = (text || files[0]?.name || "محادثة").replace(/\s+/g, " ").slice(0, 60);
  }
  req.vault.saveConversation(conv);
  countMessage(req.user.id);
  // الرسائل الصوتية: تفكير أقل = رد أسرع (المحادثة نفسها والموديل نفسه)
  await runStreamed(req, res, conv, { effort: voice ? "low" : undefined });
}));

r.post("/:id/tool-results", wrap(async (req, res) => {
  const conv = loadConv(req);
  assertIdle(req, conv.id);
  const content = toolResultsMessage(conv, req.body?.results, req.vault);
  conv.messages.push({ role: "user", content, meta: { ts: Date.now(), toolResults: true } });
  req.vault.saveConversation(conv);
  await runStreamed(req, res, conv);
}));

export default r;
