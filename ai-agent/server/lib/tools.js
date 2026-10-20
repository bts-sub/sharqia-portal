// أدوات تُنفَّذ على السيرفر: واتساب، Gmail، المتابعات.
// (أدوات «مجلد الجهاز» تُنفَّذ في المتصفح وتعريفها في agent.js)
import { gmailList, gmailRead, gmailSend, gmailStatus } from "./connectors/gmail.js";
import { listChats, readChat, resolveChat, sendTo, waSession } from "./connectors/whatsapp.js";
import { createFollowup, followupsText, stopFollowup } from "./followups.js";

const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });

export const WA_TOOLS = [
  {
    name: "whatsapp_chats",
    description:
      "List the user's WhatsApp chats, most recent first, with unread counts and the last message. " +
      "Use unread_only=true for 'what did I miss'. `search` filters by contact name or message text.",
    input_schema: obj({
      unread_only: { type: "boolean" },
      search: { type: "string" },
      limit: { type: "integer", description: "Max chats (default 25)" },
    }),
  },
  {
    name: "whatsapp_read",
    description:
      "Read the recent messages of one WhatsApp chat. `chat` may be a contact name, a phone number, or the [id] shown by whatsapp_chats.",
    input_schema: obj({ chat: { type: "string" }, limit: { type: "integer", description: "Messages to return (default 40)" } }, ["chat"]),
  },
  {
    name: "whatsapp_send",
    description:
      "Send a WhatsApp text message from the user's own number, immediately. Only when the user explicitly asked you to send or reply. " +
      "Write in the user's own voice (first person), short and polite.",
    input_schema: obj({ to: { type: "string", description: "Contact name, phone number or chat [id]" }, message: { type: "string" } }, ["to", "message"]),
  },
  {
    name: "whatsapp_follow_up",
    description:
      "Start an autonomous follow-up with one contact: sends first_message now, then every time they answer the assistant replies on its own " +
      "toward `goal` and reports back to the user when done or when a decision is needed. Use when the user says things like 'تابع مع فلان'. " +
      "Read the chat first (whatsapp_read) so the first message and goal fit what was already said. Put every detail the follow-up needs " +
      "(what to ask for, deadlines, limits on what may be promised) into `goal`.",
    input_schema: obj({
      to: { type: "string" },
      goal: { type: "string" },
      first_message: { type: "string" },
      max_messages: { type: "integer", description: "Max messages the assistant may send in this follow-up (default 6)" },
    }, ["to", "goal", "first_message"]),
  },
  {
    name: "followups_status",
    description: "Show the user's follow-ups: who, goal, status and the latest report.",
    input_schema: obj({}),
  },
  {
    name: "followup_stop",
    description: "Stop an active follow-up by its [id].",
    input_schema: obj({ id: { type: "string" } }, ["id"]),
  },
];

export const GMAIL_TOOLS = [
  {
    name: "gmail_list",
    description:
      "List emails from the user's Gmail (newest first): id, date, sender, subject, unread flag. " +
      "`search` uses Gmail search syntax, e.g. 'from:ahmed newer_than:3d', 'subject:فاتورة', 'is:important'.",
    input_schema: obj({
      unread_only: { type: "boolean" },
      search: { type: "string" },
      limit: { type: "integer", description: "Max emails (default 20)" },
    }),
  },
  {
    name: "gmail_read",
    description: "Read one email (headers, body text, attachment names) by the [id] from gmail_list. Does not mark it as read.",
    input_schema: obj({ id: { type: "string" } }, ["id"]),
  },
  {
    name: "gmail_send",
    description:
      "Send an email from the user's Gmail, immediately. Only when the user asked. To reply to an email pass reply_to_id " +
      "(recipient and subject are then filled automatically unless given).",
    input_schema: obj({
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
      reply_to_id: { type: "string" },
    }, ["body"]),
  },
];

export const SERVER_TOOL_NAMES = new Set([...WA_TOOLS, ...GMAIL_TOOLS].map((t) => t.name));

const str = (v) => (typeof v === "string" ? v.trim() : "");
const int = (v, d) => (Number.isInteger(v) && v > 0 ? v : d);

function waReady(uid) {
  const s = waSession(uid);
  if (!s.meta.linked) return "واتساب غير مربوط. اطلب من المستخدم ربطه من الإعدادات ← واتساب.";
  return null;
}

// يرجع {text, isError}
export async function runServerTool(user, name, input = {}) {
  const uid = user.id;
  const f = user.limits?.features || {};
  try {
    if (name.startsWith("whatsapp_") || name.startsWith("followup")) {
      if (!f.whatsapp) return { text: "ميزة واتساب غير مفعّلة لهذا الحساب من الإدارة.", isError: true };
      const notReady = waReady(uid);
      if (notReady) return { text: notReady, isError: true };
    }
    if (name.startsWith("gmail_")) {
      if (!f.gmail) return { text: "ميزة Gmail غير مفعّلة لهذا الحساب من الإدارة.", isError: true };
      if (!gmailStatus(uid).linked) return { text: "Gmail غير مربوط. اطلب من المستخدم ربطه من الإعدادات ← Gmail.", isError: true };
    }

    switch (name) {
      case "whatsapp_chats":
        return { text: listChats(uid, { unreadOnly: input.unread_only === true, search: str(input.search), limit: int(input.limit, 25) }) };
      case "whatsapp_read": {
        const r = readChat(uid, str(input.chat), int(input.limit, 40));
        return r.error ? { text: r.error, isError: true } : { text: r.text };
      }
      case "whatsapp_send": {
        const message = str(input.message);
        if (!message) return { text: "الرسالة فارغة", isError: true };
        const r = await sendTo(uid, str(input.to), message);
        return r.error ? { text: r.error, isError: true } : { text: `أُرسلت الرسالة إلى ${r.name} [${r.chatId}].` };
      }
      case "whatsapp_follow_up": {
        const goal = str(input.goal);
        const first = str(input.first_message);
        if (!goal || !first) return { text: "حدّد الهدف وأول رسالة", isError: true };
        const target = resolveChat(uid, str(input.to));
        if (target.error) return { text: target.error, isError: true };
        const sent = await sendTo(uid, target.id, first);
        if (sent.error) return { text: sent.error, isError: true };
        const task = createFollowup(uid, { chatId: sent.chatId, name: sent.name, goal, firstMessage: first, maxMessages: int(input.max_messages, 6) });
        return {
          text: `بدأت المتابعة [${task.id}] مع ${sent.name}: أُرسلت أول رسالة، وسيرد المساعد تلقائيًا عند ردّه حتى ${task.maxMessages} رسائل، ` +
            "ويصل التقرير للمستخدم على واتساب (محادثته مع نفسه) وفي صفحة «المتابعات».",
        };
      }
      case "followups_status":
        return { text: followupsText(uid) };
      case "followup_stop": {
        const t = stopFollowup(uid, str(input.id));
        return t ? { text: `أُوقفت متابعة ${t.name}.` } : { text: "لم أجد هذه المتابعة", isError: true };
      }
      case "gmail_list":
        return { text: await gmailList(uid, { unreadOnly: input.unread_only === true, search: str(input.search), limit: int(input.limit, 20) }) };
      case "gmail_read":
        return { text: await gmailRead(uid, str(input.id)) };
      case "gmail_send": {
        const body = str(input.body);
        if (!body) return { text: "نص البريد فارغ", isError: true };
        return { text: await gmailSend(uid, { to: str(input.to), subject: str(input.subject), body, replyToId: str(input.reply_to_id) || null }) };
      }
      default:
        return { text: `أداة غير معروفة: ${name}`, isError: true };
    }
  } catch (err) {
    return { text: `فشل التنفيذ: ${err.message}`, isError: true };
  }
}

export const SERVER_TOOL_LABELS = {
  whatsapp_chats: (i) => (i.unread_only ? "مراجعة رسائل واتساب غير المقروءة" : `تصفّح محادثات واتساب${i.search ? `: ${i.search}` : ""}`),
  whatsapp_read: (i) => `قراءة محادثة واتساب: ${i.chat || ""}`,
  whatsapp_send: (i) => `إرسال واتساب إلى: ${i.to || ""}`,
  whatsapp_follow_up: (i) => `بدء متابعة مع: ${i.to || ""}`,
  followups_status: () => "مراجعة المتابعات",
  followup_stop: () => "إيقاف متابعة",
  gmail_list: (i) => (i.unread_only ? "مراجعة البريد غير المقروء" : `بحث في البريد${i.search ? `: ${i.search}` : ""}`),
  gmail_read: () => "قراءة بريد",
  gmail_send: (i) => `إرسال بريد${i.to ? ` إلى: ${i.to}` : ""}`,
};
