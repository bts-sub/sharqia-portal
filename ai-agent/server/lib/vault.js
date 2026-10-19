// الخزنة المشفّرة لكل مستخدم: المحادثات والملفات. كل ملف على القرص مشفّر
// بـAES-256-GCM بمفتاح المستخدم (DEK)، ومربوط باسمه (AAD) فلا يمكن تبديل
// ملف مكان آخر. بدون كلمة مرور صاحبها لا تُقرأ.
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { DATA_DIR } from "../config.js";
import { open, seal } from "./crypto.js";

const VAULT_ROOT = resolve(DATA_DIR, "vault");
const SAFE_ID = /^[a-zA-Z0-9_-]{6,64}$/;
const SAFE_NAME = /^[a-zA-Z0-9_-]{3,80}$/;

export const newId = (prefix = "") => prefix + randomBytes(9).toString("base64url");

export function wipeVault(uid) {
  if (!SAFE_ID.test(uid)) return;
  rmSync(resolve(VAULT_ROOT, uid), { recursive: true, force: true });
}

export function vaultSize(uid) {
  const dir = resolve(VAULT_ROOT, uid);
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of readdirSync(dir)) total += statSync(resolve(dir, f)).size;
  return total;
}

export class Vault {
  constructor(uid, dek) {
    if (!SAFE_ID.test(uid)) throw new Error("معرّف مستخدم غير صالح");
    this.uid = uid;
    this.dek = dek;
    this.dir = resolve(VAULT_ROOT, uid);
  }

  #path(name) {
    if (!SAFE_NAME.test(name)) throw new Error("اسم عنصر غير صالح");
    return resolve(this.dir, `${name}.enc`);
  }

  #aad(name) {
    return `${this.uid}:${name}`;
  }

  writeBlob(name, buf) {
    mkdirSync(this.dir, { recursive: true });
    const p = this.#path(name);
    writeFileSync(`${p}.tmp`, seal(this.dek, buf, this.#aad(name)), { mode: 0o600 });
    renameSync(`${p}.tmp`, p);
  }

  readBlob(name) {
    const p = this.#path(name);
    if (!existsSync(p)) return null;
    return open(this.dek, readFileSync(p), this.#aad(name));
  }

  remove(name) {
    const p = this.#path(name);
    if (existsSync(p)) unlinkSync(p);
  }

  readJson(name, fallback = null) {
    const b = this.readBlob(name);
    return b ? JSON.parse(b.toString("utf8")) : fallback;
  }

  writeJson(name, obj) {
    this.writeBlob(name, Buffer.from(JSON.stringify(obj)));
  }

  // ===== المحادثات =====
  listConversations() {
    return this.readJson("index", { conversations: [] }).conversations;
  }

  #touchIndex(conv) {
    const idx = this.readJson("index", { conversations: [] });
    const entry = { id: conv.id, title: conv.title, model: conv.model, updatedAt: conv.updatedAt, createdAt: conv.createdAt };
    idx.conversations = [entry, ...idx.conversations.filter((c) => c.id !== conv.id)];
    this.writeJson("index", idx);
  }

  getConversation(id) {
    return SAFE_ID.test(id) ? this.readJson(`c_${id}`) : null;
  }

  saveConversation(conv) {
    conv.updatedAt = new Date().toISOString();
    this.writeJson(`c_${conv.id}`, conv);
    this.#touchIndex(conv);
  }

  deleteConversation(id) {
    const conv = this.getConversation(id);
    if (!conv) return false;
    const files = this.readJson("files", { files: {} });
    for (const f of conv.files || []) {
      this.remove(`f_${f}`);
      delete files.files[f];
    }
    this.writeJson("files", files);
    this.remove(`c_${id}`);
    const idx = this.readJson("index", { conversations: [] });
    idx.conversations = idx.conversations.filter((c) => c.id !== id);
    this.writeJson("index", idx);
    return true;
  }

  // ===== الملفات =====
  // meta: {name, kind: pdf|image|text, mediaType, size}
  putFile(buf, meta) {
    const id = newId();
    this.writeBlob(`f_${id}`, buf);
    const files = this.readJson("files", { files: {} });
    files.files[id] = { ...meta, size: buf.length, createdAt: new Date().toISOString() };
    this.writeJson("files", files);
    return { id, ...files.files[id] };
  }

  fileMeta(id) {
    if (!SAFE_ID.test(id)) return null;
    return this.readJson("files", { files: {} }).files[id] || null;
  }

  getFile(id) {
    const meta = this.fileMeta(id);
    if (!meta) return null;
    const buf = this.readBlob(`f_${id}`);
    return buf ? { meta, buf } : null;
  }

  // ربط الملف بمحادثة (حتى لا يُعتبر يتيمًا)
  linkFiles(ids, convId) {
    if (!ids.length) return;
    const files = this.readJson("files", { files: {} });
    for (const id of ids) if (files.files[id]) files.files[id].conv = convId;
    this.writeJson("files", files);
  }

  // ملفات مرفوعة لم تُربط بأي محادثة خلال يوم تُحذف (رفعٌ أُلغي قبل الإرسال)
  sweepOrphans() {
    const files = this.readJson("files", null);
    if (!files) return;
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    let changed = false;
    for (const [id, m] of Object.entries(files.files)) {
      if (!m.conv && Date.parse(m.createdAt) < dayAgo) {
        this.remove(`f_${id}`);
        delete files.files[id];
        changed = true;
      }
    }
    if (changed) this.writeJson("files", files);
  }
}
