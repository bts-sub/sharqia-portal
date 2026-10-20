// ربط Gmail بكلمة مرور تطبيقات (App Password): قراءة عبر IMAP وإرسال عبر SMTP.
// لا نضع أي علامة «مقروء» على الرسائل (القراءة بـBODY.PEEK) فيبقى البريد كما هو عند صاحبه.
import { resolve } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { readSecure, userDir, writeSecure } from "./secure.js";

const file = (uid) => resolve(userDir(uid), "gmail.enc");
const aad = (uid) => `gmail:${uid}`;

export function gmailConfig(uid) {
  return readSecure(file(uid), aad(uid));
}

export function gmailStatus(uid) {
  const c = gmailConfig(uid);
  return c ? { linked: true, email: c.email } : { linked: false };
}

export function gmailUnlink(uid) {
  if (existsSync(file(uid))) unlinkSync(file(uid));
}

function imap(c) {
  return new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user: c.email, pass: c.appPassword },
    logger: false,
    socketTimeout: 60_000,
  });
}

const smtp = (c) =>
  nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: c.email, pass: c.appPassword } });

async function withImap(uid, fn) {
  const c = gmailConfig(uid);
  if (!c) throw new Error("Gmail غير مربوط — اربطه من الإعدادات");
  const client = imap(c);
  await client.connect();
  try {
    return await fn(client, c);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function gmailLink(uid, { email, appPassword }) {
  const c = { email: String(email || "").trim().toLowerCase(), appPassword: String(appPassword || "").replace(/\s+/g, "") };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) throw new Error("البريد غير صحيح");
  if (c.appPassword.length < 16) throw new Error("كلمة مرور التطبيقات تتكوّن من 16 حرفًا (بدون مسافات)");
  const client = imap(c);
  try {
    await client.connect();
    await client.logout();
  } catch {
    throw new Error("Gmail رفض الدخول — تأكد من البريد ومن «كلمة مرور التطبيقات» (وليست كلمة مرور حسابك العادية)");
  }
  await smtp(c).verify().catch(() => { throw new Error("تعذّر التحقق من الإرسال عبر Gmail"); });
  writeSecure(file(uid), c, aad(uid));
  return { linked: true, email: c.email };
}

async function allMailBox(client) {
  const boxes = await client.list();
  return boxes.find((b) => b.specialUse === "\\All")?.path || "INBOX";
}

const fmtDate = (d) =>
  d ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d) : "";
const addr = (a) => (a?.[0] ? `${a[0].name ? `${a[0].name} ` : ""}<${a[0].address}>` : "");

// قائمة رسائل: id = UID داخل «كل البريد» (ثابت ويصلح للقراءة والرد)
export async function gmailList(uid, { unreadOnly = false, search = "", limit = 20, days = 0 } = {}) {
  return withImap(uid, async (client) => {
    const box = unreadOnly && !search ? "INBOX" : await allMailBox(client);
    const lock = await client.getMailboxLock(box, { readOnly: true });
    try {
      const criteria = {};
      if (unreadOnly) criteria.seen = false;
      if (search) criteria.gmraw = search;
      if (days > 0) criteria.since = new Date(Date.now() - days * 86400_000);
      if (!Object.keys(criteria).length) criteria.all = true;
      const uids = (await client.search(criteria, { uid: true })) || [];
      const pick = uids.slice(-Math.min(limit, 50));
      const rows = [];
      if (pick.length) {
        for await (const m of client.fetch(pick, { envelope: true, flags: true, uid: true }, { uid: true })) {
          rows.push({
            id: `${box === "INBOX" ? "i" : "a"}${m.uid}`,
            date: m.envelope?.date,
            from: addr(m.envelope?.from),
            subject: m.envelope?.subject || "(بدون عنوان)",
            unread: !m.flags?.has("\\Seen"),
          });
        }
      }
      rows.sort((a, b) => (b.date || 0) - (a.date || 0));
      const lines = rows.map((r) => `- [${r.id}] ${fmtDate(r.date)} — ${r.from} — ${r.subject}${r.unread ? " (غير مقروءة)" : ""}`);
      return `${uids.length} رسالة مطابقة${uids.length > rows.length ? ` (يُعرض أحدث ${rows.length})` : ""}:\n${lines.join("\n") || "(لا شيء)"}`;
    } finally {
      lock.release();
    }
  });
}

async function fetchParsed(client, id) {
  const box = id.startsWith("i") ? "INBOX" : await allMailBox(client);
  const uid = Number(id.slice(1));
  if (!uid) throw new Error("معرّف رسالة غير صالح");
  const lock = await client.getMailboxLock(box, { readOnly: true });
  try {
    const m = await client.fetchOne(String(uid), { source: true }, { uid: true });
    if (!m?.source) throw new Error("الرسالة غير موجودة");
    return simpleParser(m.source);
  } finally {
    lock.release();
  }
}

export async function gmailRead(uid, id) {
  return withImap(uid, async (client) => {
    const p = await fetchParsed(client, String(id));
    const body = (p.text || (p.html ? String(p.html).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ") : ""))
      .replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    const atts = (p.attachments || []).map((a) => a.filename).filter(Boolean);
    return [
      `من: ${p.from?.text || ""}`,
      `إلى: ${p.to?.text || ""}`,
      p.cc?.text ? `نسخة: ${p.cc.text}` : "",
      `التاريخ: ${fmtDate(p.date)}`,
      `العنوان: ${p.subject || ""}`,
      atts.length ? `مرفقات: ${atts.join("، ")}` : "",
      "",
      body.slice(0, 20_000) + (body.length > 20_000 ? "\n[… الرسالة أطول، عُرض أول 20 ألف حرف]" : ""),
    ].filter((l) => l !== "").join("\n");
  });
}

export async function gmailSend(uid, { to, subject, body, replyToId }) {
  const c = gmailConfig(uid);
  if (!c) throw new Error("Gmail غير مربوط — اربطه من الإعدادات");
  const mail = { from: c.email, to, subject, text: body };
  if (replyToId) {
    await withImap(uid, async (client) => {
      const p = await fetchParsed(client, String(replyToId));
      mail.to ||= p.replyTo?.text || p.from?.text;
      mail.subject ||= /^re:/i.test(p.subject || "") ? p.subject : `Re: ${p.subject || ""}`;
      mail.inReplyTo = p.messageId;
      mail.references = [...(Array.isArray(p.references) ? p.references : p.references ? [p.references] : []), p.messageId].filter(Boolean);
    });
  }
  if (!mail.to) throw new Error("حدّد المرسَل إليه");
  if (!mail.subject) mail.subject = "(بدون عنوان)";
  const info = await smtp(c).sendMail(mail);
  return `أُرسل البريد إلى ${mail.to} بعنوان «${mail.subject}» (${info.messageId || "تم"})`;
}
