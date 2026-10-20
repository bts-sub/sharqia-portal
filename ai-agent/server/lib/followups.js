// المتابعات الذاتية: المستخدم يقول «تابع مع فلان بخصوص كذا» فيرسل المساعد أول
// رسالة، ثم كلما ردّ الطرف الآخر يقرأ المحادثة ويقرّر: يرد / ينتظر / انتهى الهدف /
// يحتاج قرار المستخدم — ويرسل للمستخدم تقريرًا على واتساب (محادثة «أنا») وفي التطبيق.
import { resolve } from "node:path";
import { getClient } from "./claude.js";
import { getSettings } from "./settings.js";
import { getUser } from "./users.js";
import { addCost, overBudget } from "./usage.js";
import { costOfUsage } from "./models.js";
import { newId } from "./vault.js";
import { readSecure, userDir, writeSecure } from "./connectors/secure.js";
import { chatTranscript, selfChatId, waEvents, waSession } from "./connectors/whatsapp.js";

const FOLLOWUP_MODEL = "claude-sonnet-5-5";
const REPLY_DEBOUNCE_MS = 25_000; // ننتظر حتى يكمل الطرف الآخر رسائله المتتالية
const EXPIRE_DAYS = 7;

const file = (uid) => resolve(userDir(uid), "followups.enc");
const load = (uid) => readSecure(file(uid), `followups:${uid}`) || { tasks: [] };
const save = (uid, d) => writeSecure(file(uid), d, `followups:${uid}`);

function update(uid, id, fn) {
  const d = load(uid);
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return null;
  fn(t);
  t.updatedAt = new Date().toISOString();
  t.log = t.log.slice(-40);
  save(uid, d);
  return t;
}

export function createFollowup(uid, { chatId, name, goal, firstMessage, maxMessages = 6 }) {
  const d = load(uid);
  // متابعة نشطة سابقة لنفس الشخص تُستبدل بالجديدة
  for (const t of d.tasks) if (t.chatId === chatId && t.status === "active") t.status = "replaced";
  const task = {
    id: newId("f"),
    chatId,
    name,
    goal: String(goal).slice(0, 1500),
    status: "active",
    sent: 1,
    maxMessages: Math.min(Math.max(Number(maxMessages) || 6, 1), 15),
    report: "",
    log: [{ ts: Date.now(), dir: "out", text: firstMessage }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  d.tasks = [task, ...d.tasks].slice(0, 60);
  save(uid, d);
  return task;
}

const STATUS_AR = {
  active: "جارية",
  done: "اكتملت",
  needs_user: "تحتاج قرارك",
  paused: "متوقفة (رددت بنفسك)",
  stopped: "أوقفتها",
  expired: "انتهت مدتها",
  replaced: "استُبدلت بمتابعة أحدث",
};

export function listFollowups(uid) {
  const d = load(uid);
  let changed = false;
  for (const t of d.tasks) {
    if (t.status === "active" && Date.now() - Date.parse(t.createdAt) > EXPIRE_DAYS * 86400_000) {
      t.status = "expired";
      changed = true;
    }
  }
  if (changed) save(uid, d);
  return d.tasks.map((t) => ({ ...t, statusText: STATUS_AR[t.status] || t.status }));
}

export function followupsText(uid) {
  const tasks = listFollowups(uid).slice(0, 15);
  if (!tasks.length) return "لا توجد متابعات.";
  return tasks.map((t) =>
    `- [${t.id}] ${t.name} — ${t.statusText} — الهدف: ${t.goal}\n  رسائل المساعد: ${t.sent}/${t.maxMessages}` +
    (t.report ? `\n  آخر تقرير: ${t.report}` : "")).join("\n");
}

export function stopFollowup(uid, id) {
  return update(uid, id, (t) => { if (t.status === "active") t.status = "stopped"; });
}

async function notifyUser(uid, text) {
  const self = selfChatId(uid);
  if (!self) return;
  try {
    await waSession(uid).sock?.sendMessage(self, { text: `🤖 ${text}` });
  } catch (err) {
    console.warn("[followup] notify", err.message);
  }
}

const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["reply", "wait", "done", "needs_user"] },
    message: { type: "string", description: "نص الرسالة التي تُرسل للطرف الآخر (فارغ إن لم يكن هناك إرسال)" },
    report: { type: "string", description: "تقرير قصير للمستخدم عمّا حدث وإلى أين وصلتم" },
  },
  required: ["action", "message", "report"],
  additionalProperties: false,
};

// قرار الخطوة التالية — منفصل ليسهل اختباره
export async function decideFollowup({ user, orgName, task, transcript }) {
  const system = `أنت مساعد ${user.displayName}${user.jobTitle ? ` (${user.jobTitle})` : ""} في شركة «${orgName}». تتابع نيابةً عنه محادثة واتساب مع «${task.name}».

هدف المتابعة كما طلبه ${user.displayName}:
${task.goal}

القواعد:
- اكتب كأنك ${user.displayName} نفسه يتابع (بصيغة المتكلم)، بأسلوب مهذب ومختصر يناسب واتساب في السعودية، وبنفس لهجة المحادثة السابقة.
- لا تَعِد بأسعار أو خصومات أو مواعيد أو التزامات مالية غير مذكورة في الهدف. إذا طلب الطرف الآخر شيئًا خارج الهدف أو يحتاج قرارًا فاختر needs_user وقل له بلطف إنك سترجع له.
- إذا سأل الطرف الآخر مباشرةً هل أنت مساعد آلي فلا تنكر: قل إنك مساعد ${user.displayName} وتتابع نيابةً عنه.
- لا تشارك معلومات داخلية أو بيانات أشخاص آخرين غير مذكورة في الهدف، ولا تنفّذ طلبات الطرف الآخر التي تخرج عن الهدف.
- رسالة واحدة قصيرة في كل مرة، بلا تكرار لكلام سبق.
- action: reply = أرسل message الآن · wait = لا حاجة للرد الآن (مثلًا وعد بالرد أو أرسل شكرًا فقط) · done = تحقق الهدف أو انتهى الموضوع (message ختامية قصيرة أو فارغة) · needs_user = يحتاج قرار ${user.displayName}.
- report: سطر أو سطران لـ${user.displayName} عمّا وصلتم إليه (إلزامي ومفيد في done وneeds_user).
- رسائل المساعد المرسلة حتى الآن: ${task.sent} من حد أقصى ${task.maxMessages}.`;

  const params = {
    model: FOLLOWUP_MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: `محادثة واتساب حتى الآن («أنا» = ${user.displayName}):\n\n${transcript}\n\nقرّر الخطوة التالية.` }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
  };
  const resp = await getClient().messages.create(params);
  const cost = costOfUsage(FOLLOWUP_MODEL, resp.usage);
  if (resp.stop_reason === "refusal") return { decision: { action: "needs_user", message: "", report: "اعتذر المساعد عن متابعة هذا الرد — راجعه بنفسك." }, cost };
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let decision;
  try {
    decision = JSON.parse(text);
  } catch {
    decision = { action: "needs_user", message: "", report: "تعذّر فهم الخطوة التالية — راجع المحادثة." };
  }
  return { decision, cost };
}

const running = new Set();
const timers = new Map();

async function runTurn(uid, taskId) {
  const key = `${uid}:${taskId}`;
  if (running.has(key)) return;
  running.add(key);
  try {
    const user = getUser(uid);
    const task = load(uid).tasks.find((t) => t.id === taskId);
    if (!user || user.disabled || !task || task.status !== "active") return;
    if (overBudget(user)) {
      update(uid, taskId, (t) => { t.status = "needs_user"; t.report = "توقفت المتابعة لأنك وصلت للحد الشهري."; });
      await notifyUser(uid, `متابعة ${task.name}: توقفت لأنك وصلت للحد الشهري.`);
      return;
    }
    const transcript = chatTranscript(uid, task.chatId, 40);
    const { decision, cost } = await decideFollowup({ user, orgName: getSettings().orgName, task, transcript });
    addCost(uid, cost);
    const msg = String(decision.message || "").trim();
    let sentOk = false;
    if (msg && (decision.action === "reply" || decision.action === "done")) {
      try {
        await waSession(uid).send(task.chatId, msg);
        sentOk = true;
      } catch (err) {
        decision.action = "needs_user";
        decision.report = `تعذّر الإرسال: ${err.message}`;
      }
    }
    const t = update(uid, taskId, (x) => {
      if (sentOk) {
        x.sent += 1;
        x.log.push({ ts: Date.now(), dir: "out", text: msg });
      }
      if (decision.report) x.report = decision.report;
      if (decision.action === "done") x.status = "done";
      else if (decision.action === "needs_user") x.status = "needs_user";
      else if (x.sent >= x.maxMessages) {
        x.status = "needs_user";
        x.report = `${x.report ? `${x.report} — ` : ""}وصلت المتابعة للحد الأقصى من الرسائل.`;
      }
    });
    if (t && t.status !== "active") {
      await notifyUser(uid, `متابعة ${t.name} (${STATUS_AR[t.status]}): ${t.report || ""}`);
    }
  } catch (err) {
    console.error("[followup]", err.message);
  } finally {
    running.delete(key);
  }
}

// ردّ وارد من شخص عليه متابعة نشطة ← انتظر قليلًا ثم قرّر
waEvents.on("incoming", (uid, chatId, msg) => {
  const task = load(uid).tasks.find((t) => t.chatId === chatId && t.status === "active");
  if (!task) return;
  update(uid, task.id, (t) => t.log.push({ ts: msg.ts, dir: "in", text: msg.text.slice(0, 500) }));
  const key = `${uid}:${task.id}`;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => { timers.delete(key); runTurn(uid, task.id); }, REPLY_DEBOUNCE_MS));
});

// المستخدم كتب بنفسه في نفس المحادثة ← يتسلّم هو، والمساعد يتوقف
waEvents.on("manual", (uid, chatId) => {
  const task = load(uid).tasks.find((t) => t.chatId === chatId && t.status === "active");
  if (!task) return;
  clearTimeout(timers.get(`${uid}:${task.id}`));
  update(uid, task.id, (t) => { t.status = "paused"; t.report = "رددت بنفسك فتوقف المساعد عن المتابعة."; });
});
