// تخزين JSON بسيط بكتابة ذرّية (tmp ثم rename) — ملف لكل مجموعة بيانات.
// يكفي لعشرات المستخدمين؛ المحتوى الحسّاس لا يُحفظ هنا بل في الخزنة المشفّرة.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "../config.js";

export class JsonStore {
  constructor(name, defaults) {
    this.file = resolve(DATA_DIR, name);
    this.defaults = defaults;
    this.data = null;
  }

  get() {
    if (this.data === null) {
      this.data = existsSync(this.file)
        ? JSON.parse(readFileSync(this.file, "utf8"))
        : structuredClone(this.defaults);
    }
    return this.data;
  }

  // fn تعدّل البيانات في مكانها (أو ترجع بديلًا)؛ الحفظ متزامن فلا تتداخل الكتابات.
  update(fn) {
    const cur = this.get();
    const next = fn(cur) ?? cur;
    this.data = next;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 1), { mode: 0o600 });
    renameSync(tmp, this.file);
    return next;
  }
}

export const usersStore = new JsonStore("users.json", { users: [] });
export const settingsStore = new JsonStore("settings.json", {});
export const usageStore = new JsonStore("usage.json", {});
