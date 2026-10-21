// «سند يعرفك» (الملف الشخصي) + الرد على المكالمات.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AppError, wrap } from "../lib/errors.js";
import { getPersona, learnFromConversations, savePersona } from "../lib/persona.js";
import { connectTwilio, disconnectPhone, listCalls, phonePrompt, phoneStatus, syncAgent } from "../lib/phone.js";
import { chatTranscript, waSession } from "../lib/connectors/whatsapp.js";
import { getUser } from "../lib/users.js";
import { audit } from "../lib/audit.js";
import { limitBlock } from "../lib/usage.js";

const r = Router();

const heavy = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user.id,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "طلبات كثيرة — انتظر قليلًا" },
});

// ===== سند يعرفك =====
r.get("/persona", (req, res) => res.json(getPersona(req.user.id)));

r.put("/persona", wrap(async (req, res) => {
  const p = savePersona(req.user.id, req.body || {});
  // تحديث وكيل المكالمات ليعرف آخر المعلومات
  if (phoneStatus(req.user.id).agentReady) await syncAgent(getUser(req.user.id)).catch((e) => console.warn("[persona] sync", e.message));
  res.json(p);
}));

// التعلّم من المحادثات: نص مُلصق/ملف تصدير واتساب، أو آخر محادثات واتساب المربوط
r.post("/persona/learn", heavy, wrap(async (req, res) => {
  const blocked = limitBlock(req.user);
  if (blocked) throw new AppError(blocked, 429);
  let text = String(req.body?.text || "");
  if (req.body?.source === "whatsapp") {
    if (!req.user.limits?.features?.whatsapp) throw new AppError("واتساب غير مفعّل لحسابك", 403);
    const s = waSession(req.user.id);
    if (!s.meta.linked) throw new AppError("اربط واتساب أولًا من الإعدادات", 400);
    const chats = Object.values(s.store.chats)
      .filter((c) => !c.group && c.messages.some((m) => m.fromMe) && c.messages.length >= 6)
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 12);
    if (!chats.length) throw new AppError("لا توجد محادثات كافية محفوظة بعد — انتظر يومًا بعد الربط أو الصق محادثة", 400);
    text = chats.map((c) => `--- محادثة مع ${s.store.displayName(c.id)} ---\n${chatTranscript(req.user.id, c.id, 80)}`).join("\n\n");
  }
  const suggestions = await learnFromConversations(req.user, text, { selfName: String(req.body?.selfName || "").trim() || undefined });
  res.json(suggestions);
}));

// ===== المكالمات =====
const needPhone = (req, res, next) =>
  req.user.limits?.features?.phone ? next() : next(new AppError("ميزة الرد على المكالمات غير مفعّلة لحسابك — تواصل مع الإدارة", 403));

r.get("/phone", needPhone, (req, res) => res.json({ ...phoneStatus(req.user.id), calls: listCalls(req.user.id).slice(0, 100) }));

r.get("/phone/prompt", needPhone, (req, res) => res.json({ prompt: phonePrompt(req.user) }));

r.post("/phone/agent", needPhone, heavy, wrap(async (req, res) => {
  await syncAgent(getUser(req.user.id));
  audit("phone_agent_synced", { req, uid: req.user.id, username: req.user.username });
  res.json(phoneStatus(req.user.id));
}));

r.post("/phone/twilio", needPhone, heavy, wrap(async (req, res) => {
  const out = await connectTwilio(getUser(req.user.id), req.body || {});
  audit("phone_linked", { req, uid: req.user.id, username: req.user.username, detail: out.number });
  res.json(out);
}));

r.delete("/phone", needPhone, wrap(async (req, res) => {
  const out = await disconnectPhone(req.user.id);
  audit("phone_unlinked", { req, uid: req.user.id, username: req.user.username });
  res.json(out);
}));

export default r;
