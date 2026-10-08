// تخزين بسيط ودائم لمحادثات المستخدمين + قائمة المُصرّح لهم (كود الوصول).
// JSON على قرص volume. مناسب لسيرفر صغير وعدد محادثات محدود — لا قاعدة بيانات.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");
const CONV_FILE = resolve(DATA_DIR, "conversations.json");

const HISTORY_TURNS = Math.max(1, parseInt(process.env.BOT_HISTORY_TURNS || "10", 10));
const MAX_MSGS = HISTORY_TURNS * 2; // كل جولة = رسالة مستخدم + ردّ

// البنية: { convs: { "<chatId>": [ {role, content}, ... ] }, authorized: ["<chatId>"] }
let state = { convs: {}, authorized: [] };

function load() {
  try {
    state = JSON.parse(readFileSync(CONV_FILE, "utf8"));
    if (!state.convs) state.convs = {};
    if (!state.authorized) state.authorized = [];
  } catch {
    state = { convs: {}, authorized: [] };
  }
}

let saveTimer = null;
function save() {
  // كتابة مؤجّلة (debounce) حتى لا نكتب القرص مع كل رسالة.
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(CONV_FILE, JSON.stringify(state), "utf8");
    } catch (e) {
      console.error("store save failed:", e.message);
    }
  }, 1500);
}

export function getHistory(chatId) {
  return state.convs[String(chatId)] || [];
}

export function pushTurn(chatId, userText, assistantText) {
  const key = String(chatId);
  const arr = state.convs[key] || (state.convs[key] = []);
  arr.push({ role: "user", content: userText });
  arr.push({ role: "assistant", content: assistantText });
  // اقتطاع أقدم الرسائل للحفاظ على السياق خفيفًا.
  if (arr.length > MAX_MSGS) state.convs[key] = arr.slice(arr.length - MAX_MSGS);
  save();
}

export function resetConversation(chatId) {
  delete state.convs[String(chatId)];
  save();
}

export function isAuthorized(chatId) {
  return state.authorized.includes(String(chatId));
}

export function authorize(chatId) {
  const key = String(chatId);
  if (!state.authorized.includes(key)) {
    state.authorized.push(key);
    save();
  }
}

export function allChatIds() {
  return Object.keys(state.convs);
}

load();
