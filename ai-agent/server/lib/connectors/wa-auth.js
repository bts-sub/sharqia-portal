// حالة جلسة واتساب (مفاتيح Signal) — نفس فكرة useMultiFileAuthState من Baileys
// لكن كل ملف مشفّر على القرص: من يسرق الملفات لا يستطيع انتحال رقم واتساب.
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { BufferJSON, initAuthCreds, proto } from "baileys";
import { readSecure, userDir, writeSecure } from "./secure.js";

const fix = (name) => name.replace(/\//g, "__").replace(/:/g, "-");

export async function useEncryptedAuthState(uid) {
  const dir = userDir(uid, "wa-auth");
  const locks = new Map();
  const withLock = (file, fn) => {
    const prev = locks.get(file) || Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(file, next.catch(() => {}));
    return next;
  };
  const path = (name) => resolve(dir, `${fix(name)}.enc`);
  const aad = (name) => `wa:${uid}:${fix(name)}`;

  const read = (name) => withLock(path(name), () => readSecure(path(name), aad(name), BufferJSON.reviver));
  const write = (name, data) => withLock(path(name), () => writeSecure(path(name), data, aad(name), BufferJSON.replacer));
  const remove = (name) => withLock(path(name), () => { if (existsSync(path(name))) unlinkSync(path(name)); });

  const creds = (await read("creds.json")) || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {};
          await Promise.all(ids.map(async (id) => {
            let value = await read(`${type}-${id}.json`);
            if (type === "app-state-sync-key" && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            out[id] = value;
          }));
          return out;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const name = `${category}-${id}.json`;
              tasks.push(value ? write(name, value) : remove(name));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => write("creds.json", creds),
  };
}

export function clearAuthState(uid) {
  const dir = userDir(uid, "wa-auth");
  for (const f of readdirSync(dir)) unlinkSync(resolve(dir, f));
}
