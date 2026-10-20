// ربط واتساب المستخدم (مثل واتساب ويب) عبر Baileys — بلا متصفح، على سيرفرنا.
// يحفظ آخر الرسائل لكل محادثة (مشفّرة) ليقرأها المساعد ويلخّصها ويتابع بها.
// ملاحظات أمان الرقم: لا نرسل «تمت القراءة» ولا نظهر متصلًا (يبقى جوال المستخدم
// يستقبل الإشعارات)، ونحاكي الكتابة قبل كل إرسال، وسقف يومي للرسائل.
import { EventEmitter } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, getContentType, isJidBroadcast, isJidGroup,
  isJidStatusBroadcast, isLidUser, jidNormalizedUser, makeCacheableSignalKeyStore, normalizeMessageContent, toNumber,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import { clearAuthState, useEncryptedAuthState } from "./wa-auth.js";
import { CONNECTORS_ROOT, readSecure, userDir, writeSecure } from "./secure.js";

const logger = pino({ level: "silent" });
export const waEvents = new EventEmitter(); // incoming(uid, chatId, msg) · manual(uid, chatId, msg)

const MAX_CHATS = 500;
const MAX_MSGS = 120;
const MAX_TEXT = 3000;
const DAILY_SEND_CAP = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== أدوات مساعدة =====
const CC = "966";
export function waNumber(raw) {
  let d = String(raw || "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = CC + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = CC + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

export const normAr = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

const phoneOf = (jid) => (jid && jid.endsWith("@s.whatsapp.net") ? `+${jid.split("@")[0]}` : "");
const tsNum = (t) => (typeof t === "number" ? t : t ? toNumber(t) : 0);

function textOf(message) {
  const c = normalizeMessageContent(message);
  if (!c) return null;
  const type = getContentType(c);
  const m = c[type] || {};
  const cap = (s) => (s ? ` ${s}` : "");
  switch (type) {
    case "conversation": return c.conversation || null;
    case "extendedTextMessage": return m.text || null;
    case "imageMessage": return `[صورة]${cap(m.caption)}`;
    case "videoMessage": return `[فيديو]${cap(m.caption)}`;
    case "audioMessage": return m.ptt ? "[رسالة صوتية]" : "[مقطع صوتي]";
    case "documentMessage": return `[ملف: ${m.fileName || "مستند"}]${cap(m.caption)}`;
    case "stickerMessage": return "[ملصق]";
    case "locationMessage": case "liveLocationMessage": return "[موقع جغرافي]";
    case "contactMessage": return `[جهة اتصال: ${m.displayName || ""}]`;
    case "contactsArrayMessage": return "[جهات اتصال]";
    case "pollCreationMessage": case "pollCreationMessageV3": return `[استطلاع: ${m.name || ""}]`;
    case "buttonsResponseMessage": return m.selectedDisplayText || null;
    case "listResponseMessage": return m.title || null;
    case "templateButtonReplyMessage": return m.selectedDisplayText || null;
    default: return null; // تفاعلات، رسائل نظام، تعديلات…
  }
}

// ===== مخزن المحادثات (مشفّر على القرص) =====
class ChatStore {
  constructor(uid) {
    this.uid = uid;
    this.file = resolve(userDir(uid), "wa-store.enc");
    const d = readSecure(this.file, `wa-store:${uid}`) || {};
    this.chats = d.chats || {};
    this.names = d.names || {};
    this.lid = d.lid || {};
    this.timer = null;
  }

  touch() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 5000);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const ids = Object.keys(this.chats);
    if (ids.length > MAX_CHATS) {
      ids.sort((a, b) => this.chats[b].lastTs - this.chats[a].lastTs).slice(MAX_CHATS).forEach((id) => delete this.chats[id]);
    }
    writeSecure(this.file, { chats: this.chats, names: this.names, lid: this.lid }, `wa-store:${this.uid}`);
  }

  wipe() {
    this.chats = {};
    this.names = {};
    this.lid = {};
    this.flush();
  }

  canon(jid, alt) {
    if (!jid) return null;
    let j = jidNormalizedUser(jid);
    const a = alt ? jidNormalizedUser(alt) : null;
    if (a && isLidUser(j) && !isLidUser(a)) this.addLid({ lid: j, pn: a });
    else if (a && isLidUser(a) && !isLidUser(j)) this.addLid({ lid: a, pn: j });
    if (isLidUser(j) && this.lid[j]) j = this.lid[j];
    return j;
  }

  addLid({ lid, pn }) {
    lid = jidNormalizedUser(lid);
    pn = jidNormalizedUser(pn);
    if (!lid || !pn || this.lid[lid] === pn) return;
    this.lid[lid] = pn;
    if (this.names[lid] && !this.names[pn]) this.names[pn] = this.names[lid];
    const from = this.chats[lid];
    if (from) {
      const to = this.chats[pn];
      if (!to) {
        from.id = pn;
        this.chats[pn] = from;
      } else {
        const seen = new Set(to.messages.map((m) => m.id));
        to.messages = [...to.messages, ...from.messages.filter((m) => !seen.has(m.id))].sort((x, y) => x.ts - y.ts).slice(-MAX_MSGS);
        to.unread += from.unread;
        to.lastTs = Math.max(to.lastTs, from.lastTs);
        to.name ||= from.name;
      }
      delete this.chats[lid];
    }
    this.touch();
  }

  setName(jid, name, saved = false) {
    if (!jid || !name) return;
    const j = this.canon(jid);
    if (saved || !this.names[j]) {
      this.names[j] = String(name).slice(0, 80);
      this.touch();
    }
  }

  chat(id) {
    return (this.chats[id] ||= { id, name: null, group: Boolean(isJidGroup(id)), unread: 0, lastTs: 0, messages: [] });
  }

  displayName(id) {
    const c = this.chats[id];
    return this.names[id] || c?.name || phoneOf(id) || id.split("@")[0];
  }

  addMessage(chatId, msg, { countUnread }) {
    const c = this.chat(chatId);
    if (c.messages.some((m) => m.id === msg.id)) return false;
    c.messages.push(msg);
    if (c.messages.length > 1 && c.messages[c.messages.length - 2].ts > msg.ts) c.messages.sort((a, b) => a.ts - b.ts);
    if (c.messages.length > MAX_MSGS) c.messages = c.messages.slice(-MAX_MSGS);
    c.lastTs = Math.max(c.lastTs, msg.ts);
    if (countUnread && !msg.fromMe) c.unread += 1;
    this.touch();
    return true;
  }
}

// ===== الجلسة لكل مستخدم =====
class Session {
  constructor(uid) {
    this.uid = uid;
    this.store = new ChatStore(uid);
    this.metaFile = resolve(userDir(uid), "wa-meta.enc");
    this.meta = readSecure(this.metaFile, `wa-meta:${uid}`) || { linked: false };
    this.status = "idle";
    this.sock = null;
    this.qr = null;
    this.pairCode = null;
    this.pairPhone = null;
    this.error = null;
    this.retry = 0;
    this.qrCount = 0;
    this.stopped = true;
    this.sentIds = new Set();
    this.sentCache = new Map();
    this.sendDay = { day: "", count: 0 };
  }

  saveMeta(patch) {
    this.meta = { ...this.meta, ...patch };
    writeSecure(this.metaFile, this.meta, `wa-meta:${this.uid}`);
  }

  async start({ phone } = {}) {
    try { this.sock?.end(undefined); } catch {}
    this.sock = null;
    this.stopped = false;
    this.status = "connecting";
    this.qr = null;
    this.pairCode = null;
    this.error = null;
    this.qrCount = 0;
    this.pairPhone = phone || null;

    const { state, saveCreds } = await useEncryptedAuthState(this.uid);
    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch {}
    const sock = makeWASocket({
      version,
      logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => this.sentCache.get(key.id),
    });
    this.sock = sock;
    const live = (fn) => (...a) => { if (sock === this.sock) { try { fn(...a); } catch (err) { console.warn("[wa]", err.message); } } };

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (u) => { if (sock === this.sock) this.onConnection(u, sock, state).catch((e) => console.warn("[wa]", e.message)); });
    sock.ev.on("messaging-history.set", live((h) => this.onHistory(h)));
    sock.ev.on("messages.upsert", live((e) => this.onMessages(e)));
    sock.ev.on("chats.upsert", live((cs) => this.onChats(cs, true)));
    sock.ev.on("chats.update", live((cs) => this.onChats(cs, false)));
    sock.ev.on("contacts.upsert", live((cs) => this.onContacts(cs)));
    sock.ev.on("contacts.update", live((cs) => this.onContacts(cs)));
    sock.ev.on("lid-mapping.update", live((m) => this.store.addLid(m)));
  }

  async onConnection(u, sock, state) {
    if (u.qr) {
      this.qrCount += 1;
      if (this.qrCount > 6) {
        this.stop();
        this.error = "انتهت مهلة الربط — اضغط «ربط» من جديد";
        return;
      }
      if (this.pairPhone && !state.creds.registered) {
        if (!this.pairCode) {
          try {
            this.pairCode = await sock.requestPairingCode(this.pairPhone);
            this.status = "pairing";
          } catch {
            this.error = "تعذّر طلب رمز الربط — تأكد من الرقم وحاول مرة أخرى";
          }
        }
      } else {
        this.qr = u.qr;
        this.status = "qr";
      }
    }
    if (u.connection === "open") {
      this.status = "open";
      this.qr = null;
      this.pairCode = null;
      this.pairPhone = null;
      this.error = null;
      this.retry = 0;
      const me = { id: jidNormalizedUser(sock.user?.id), name: sock.user?.name || sock.user?.notify || "" };
      this.saveMeta({ linked: true, me, linkedAt: this.meta.linkedAt || new Date().toISOString() });
    }
    if (u.connection === "close") {
      if (this.stopped) return;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        // المستخدم ألغى الربط من جواله
        this.stopped = true;
        this.sock = null;
        this.status = "idle";
        this.error = "أُلغي الربط من الجوال";
        clearAuthState(this.uid);
        this.saveMeta({ linked: false });
        return;
      }
      if (code === DisconnectReason.restartRequired) {
        this.start();
        return;
      }
      if (!state.creds.registered && this.status !== "open") {
        // لم يكتمل الربط بعد (انتهت صلاحية الرمز مثلًا): نعيد المحاولة ما دامت المهلة لم تنته
        setTimeout(() => !this.stopped && this.start({ phone: this.pairPhone }), 1500);
        return;
      }
      this.status = "reconnecting";
      const delay = Math.min(300_000, 2000 * 2 ** this.retry++);
      setTimeout(() => !this.stopped && this.start(), delay);
    }
  }

  ingest(m, { countUnread }) {
    const key = m.key || {};
    const remote = key.remoteJid;
    if (!remote || isJidStatusBroadcast(remote) || (isJidBroadcast(remote) && !isJidGroup(remote))) return null;
    const text = textOf(m.message);
    if (text == null) return null;
    const chatId = this.store.canon(remote, key.remoteJidAlt);
    const group = isJidGroup(chatId);
    const sender = key.fromMe ? null : group ? this.store.canon(key.participant, key.participantAlt) : chatId;
    if (sender && m.pushName) this.store.setName(sender, m.pushName);
    const msg = {
      id: key.id,
      fromMe: Boolean(key.fromMe),
      ts: (tsNum(m.messageTimestamp) || Date.now() / 1000) * 1000,
      text: text.slice(0, MAX_TEXT),
      ...(group && sender ? { sender } : {}),
    };
    const added = this.store.addMessage(chatId, msg, { countUnread });
    return added ? { chatId, msg } : null;
  }

  onHistory({ chats = [], contacts = [], messages = [], lidPnMappings = [] }) {
    for (const m of lidPnMappings) this.store.addLid(m);
    this.onContacts(contacts);
    for (const c of chats) {
      const id = this.store.canon(c.id);
      if (!id || isJidStatusBroadcast(id)) continue;
      const chat = this.store.chat(id);
      if (c.name) chat.name = c.name;
      if (typeof c.unreadCount === "number") chat.unread = Math.max(0, c.unreadCount);
      chat.lastTs = Math.max(chat.lastTs, tsNum(c.conversationTimestamp) * 1000);
    }
    for (const m of messages) this.ingest(m, { countUnread: false });
    this.store.touch();
  }

  onChats(list, isUpsert) {
    for (const c of list) {
      const id = this.store.canon(c.id);
      if (!id || isJidStatusBroadcast(id)) continue;
      const chat = this.store.chat(id);
      if (c.name) chat.name = c.name;
      if (typeof c.unreadCount === "number") {
        // الأرقام الموجبة في التحديثات «زيادات» نحسبها بأنفسنا من الرسائل؛ 0 = قُرئت من الجوال
        if (isUpsert) chat.unread = Math.max(0, c.unreadCount);
        else if (c.unreadCount === 0) chat.unread = 0;
        else if (c.unreadCount < 0) chat.unread = Math.max(1, chat.unread);
      }
      if (c.conversationTimestamp) chat.lastTs = Math.max(chat.lastTs, tsNum(c.conversationTimestamp) * 1000);
    }
    this.store.touch();
  }

  onContacts(list) {
    for (const c of list) {
      if (c.lid && c.phoneNumber) this.store.addLid({ lid: c.lid, pn: c.phoneNumber });
      const name = c.name || c.verifiedName || c.notify;
      if (name) this.store.setName(c.phoneNumber || c.id, name, Boolean(c.name));
    }
  }

  onMessages({ messages, type }) {
    for (const m of messages) {
      const r = this.ingest(m, { countUnread: type === "notify" });
      if (!r || type !== "notify") continue;
      if (!r.msg.fromMe) waEvents.emit("incoming", this.uid, r.chatId, r.msg);
      else if (!this.sentIds.has(r.msg.id)) waEvents.emit("manual", this.uid, r.chatId, r.msg);
    }
  }

  async send(chatId, text) {
    if (this.status !== "open" || !this.sock) throw new Error("واتساب غير متصل الآن — راجع الربط من الإعدادات");
    const today = new Date().toISOString().slice(0, 10);
    if (this.sendDay.day !== today) this.sendDay = { day: today, count: 0 };
    if (this.sendDay.count >= DAILY_SEND_CAP) throw new Error("وصلت للحد اليومي لرسائل المساعد (حماية للرقم من الحظر)");

    let jid = chatId;
    if (!isJidGroup(jid) && !isLidUser(jid) && !this.store.chats[jid]) {
      const [r] = (await this.sock.onWhatsApp(jid.split("@")[0])) || [];
      if (!r?.exists) throw new Error("هذا الرقم غير مسجّل في واتساب");
      jid = jidNormalizedUser(r.jid);
    }
    const sock = this.sock;
    await sock.presenceSubscribe(jid).catch(() => {});
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
    await sleep(Math.min(7000, 1500 + text.length * 40));
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    const sent = await sock.sendMessage(jid, { text });
    this.sendDay.count += 1;
    this.sentIds.add(sent.key.id);
    if (this.sentIds.size > 500) this.sentIds = new Set([...this.sentIds].slice(-300));
    this.sentCache.set(sent.key.id, sent.message);
    if (this.sentCache.size > 200) this.sentCache.delete(this.sentCache.keys().next().value);
    const r = this.ingest(sent, { countUnread: false });
    return { chatId: r?.chatId || jid, id: sent.key.id };
  }

  stop() {
    this.stopped = true;
    try { this.sock?.end(undefined); } catch {}
    this.sock = null;
    this.status = "idle";
    this.qr = null;
    this.pairCode = null;
  }

  async logout() {
    this.stopped = true;
    try { await this.sock?.logout(); } catch {}
    this.stop();
    clearAuthState(this.uid);
    this.saveMeta({ linked: false, me: null });
    this.store.wipe();
  }
}

// ===== واجهة الوحدة =====
const sessions = new Map();
export function waSession(uid) {
  let s = sessions.get(uid);
  if (!s) {
    s = new Session(uid);
    sessions.set(uid, s);
  }
  return s;
}

export function waForget(uid) {
  sessions.get(uid)?.stop();
  sessions.delete(uid);
}

export async function waStatus(uid) {
  const s = waSession(uid);
  return {
    status: s.status,
    linked: Boolean(s.meta.linked),
    me: s.meta.me || null,
    qr: s.qr ? await QRCode.toDataURL(s.qr, { margin: 1, width: 300 }) : null,
    pairCode: s.pairCode,
    error: s.error,
    chats: Object.keys(s.store.chats).length,
    unreadChats: Object.values(s.store.chats).filter((c) => c.unread > 0).length,
  };
}

export async function waConnect(uid, { phone } = {}) {
  const s = waSession(uid);
  if (s.status === "open") return;
  const num = phone ? waNumber(phone) : null;
  if (phone && !num) throw new Error("رقم الجوال غير صحيح");
  if (num) clearAuthState(uid); // ربط جديد برقم: نبدأ من حالة نظيفة
  await s.start({ phone: num });
}

export async function waLogout(uid) {
  await waSession(uid).logout();
}

// عند إقلاع السيرفر: إعادة اتصال كل من ربط واتساب سابقًا
export function restoreWhatsApp(isAllowed) {
  const root = CONNECTORS_ROOT;
  for (const uid of existsSync(root) ? readdirSync(root) : []) {
    if (!isAllowed(uid)) continue;
    const s = waSession(uid);
    if (s.meta.linked) s.start().catch((e) => console.warn("[wa] restore", uid, e.message));
  }
}

export async function flushAll() {
  for (const s of sessions.values()) {
    try { s.store.flush(); } catch {}
  }
}

// ===== قراءة للمساعد =====
const fmtTime = (ts) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ts);

export function resolveChat(uid, ref) {
  const s = waSession(uid);
  const st = s.store;
  const q = String(ref || "").trim();
  if (!q) return { error: "حدّد اسم الشخص أو رقمه" };
  if (q.includes("@")) return { id: st.canon(q) };
  const num = waNumber(q);
  if (num && /^[+\d\s()\-٠-٩]+$/.test(q)) return { id: `${num}@s.whatsapp.net` };
  const nq = normAr(q);
  const cands = new Map();
  for (const c of Object.values(st.chats)) {
    const name = normAr(st.displayName(c.id));
    if (name && (name.includes(nq) || nq.includes(name))) cands.set(c.id, { id: c.id, exact: name === nq, ts: c.lastTs });
  }
  for (const [jid, name] of Object.entries(st.names)) {
    if (isLidUser(jid) && st.lid[jid]) continue;
    const n = normAr(name);
    if (n && (n.includes(nq) || nq.includes(n)) && !cands.has(jid)) cands.set(jid, { id: jid, exact: n === nq, ts: st.chats[jid]?.lastTs || 0 });
  }
  const list = [...cands.values()].sort((a, b) => b.exact - a.exact || b.ts - a.ts);
  if (!list.length) return { error: `لم أجد «${q}» في محادثات أو جهات اتصال واتساب. اطلب رقمه.` };
  if (list.length === 1 || list[0].exact && !list[1]?.exact) return { id: list[0].id };
  return {
    error: `يوجد أكثر من شخص بهذا الاسم — اسأل المستخدم أيّهم يقصد:\n${list.slice(0, 8).map((c) => `- ${st.displayName(c.id)} ${phoneOf(c.id)} [${c.id}]`).join("\n")}`,
  };
}

export function listChats(uid, { unreadOnly = false, search = "", limit = 25 } = {}) {
  const s = waSession(uid);
  const st = s.store;
  let chats = Object.values(st.chats).filter((c) => c.messages.length || c.unread);
  if (unreadOnly) chats = chats.filter((c) => c.unread > 0);
  if (search) {
    const q = normAr(search);
    chats = chats.filter((c) => normAr(st.displayName(c.id)).includes(q) || c.messages.some((m) => normAr(m.text).includes(q)));
  }
  chats.sort((a, b) => b.lastTs - a.lastTs);
  const total = chats.length;
  const lines = chats.slice(0, Math.min(limit, 60)).map((c) => {
    const last = c.messages[c.messages.length - 1];
    const who = last ? (last.fromMe ? "أنا" : c.group ? st.displayName(last.sender || "") : st.displayName(c.id)) : "";
    return `- ${st.displayName(c.id)}${c.group ? " (مجموعة)" : ""} ${phoneOf(c.id)} [${c.id}]` +
      `${c.unread ? ` — ${c.unread} غير مقروءة` : ""}${c.lastTs ? ` — آخر نشاط ${fmtTime(c.lastTs)}` : ""}` +
      (last ? `\n  آخر رسالة (${who}): ${last.text.slice(0, 160)}` : "");
  });
  const header = s.status === "open" ? "" : "تنبيه: واتساب غير متصل الآن — البيانات حتى آخر اتصال.\n";
  return `${header}${total} محادثة${unreadOnly ? " فيها رسائل غير مقروءة" : ""}:\n${lines.join("\n") || "(لا شيء)"}`;
}

export function readChat(uid, ref, limit = 40) {
  const r = resolveChat(uid, ref);
  if (r.error) return { error: r.error };
  const st = waSession(uid).store;
  const c = st.chats[r.id];
  if (!c || !c.messages.length) return { text: `لا توجد رسائل محفوظة مع ${st.displayName(r.id)} ${phoneOf(r.id)} [${r.id}] (قد تكون أقدم من تاريخ الربط).`, id: r.id };
  const msgs = c.messages.slice(-Math.min(limit, MAX_MSGS));
  const lines = msgs.map((m) => `[${fmtTime(m.ts)}] ${m.fromMe ? "أنا" : c.group ? st.displayName(m.sender || "") : st.displayName(c.id)}: ${m.text}`);
  return {
    id: r.id,
    name: st.displayName(r.id),
    text: `محادثة ${st.displayName(r.id)}${c.group ? " (مجموعة)" : ""} ${phoneOf(r.id)} [${r.id}] — آخر ${msgs.length} رسالة${c.unread ? `، منها ${c.unread} غير مقروءة` : ""}:\n${lines.join("\n")}`,
  };
}

export async function sendTo(uid, ref, text) {
  const r = resolveChat(uid, ref);
  if (r.error) return { error: r.error };
  const s = waSession(uid);
  const out = await s.send(r.id, String(text).slice(0, 4000));
  return { ...out, name: s.store.displayName(out.chatId) };
}

export function chatTranscript(uid, chatId, limit = 40) {
  const st = waSession(uid).store;
  const c = st.chats[chatId];
  if (!c) return "";
  return c.messages.slice(-limit)
    .map((m) => `[${fmtTime(m.ts)}] ${m.fromMe ? "أنا" : st.displayName(m.sender || c.id)}: ${m.text}`)
    .join("\n");
}

export function selfChatId(uid) {
  return waSession(uid).meta.me?.id || null;
}
