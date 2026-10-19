// «مجلد الجهاز»: المستخدم يختار مجلدًا من جهازه، والمساعد يتصفّحه ويقرأ
// ملفاته (قراءة فقط) عبر أدوات تُنفَّذ هنا في المتصفح — لا يُرفع إلا الملف الذي
// يطلب المساعد قراءته فعلًا.
import { prepareFile, uploadPrepared } from "./files.js";

const SKIP = /^(\.|node_modules$|__pycache__$|\$recycle\.bin$|system volume information$)/i;
const MAX_ENTRIES = 8000;
const INLINE_TEXT = 150_000;

let current = null; // {name, entries: Map(path -> {path, name, dir, size, mtime, getFile})}
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(current));
export const onFolderChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const connectedFolder = () => current;
export const canPickDirectory = () => "showDirectoryPicker" in window;
export const canPickFolderInput = () => "webkitdirectory" in document.createElement("input");
export function disconnectFolder() { current = null; notify(); }

async function walk(dirHandle, prefix, entries, depth) {
  if (depth > 10 || entries.size >= MAX_ENTRIES) return;
  for await (const [name, h] of dirHandle.entries()) {
    if (SKIP.test(name) || entries.size >= MAX_ENTRIES) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (h.kind === "directory") {
      entries.set(path, { path, name, dir: true });
      await walk(h, path, entries, depth + 1);
    } else {
      const file = await h.getFile().catch(() => null);
      if (file) entries.set(path, { path, name, dir: false, size: file.size, mtime: file.lastModified, getFile: () => h.getFile() });
    }
  }
}

export async function pickFolderWithApi() {
  const handle = await window.showDirectoryPicker({ mode: "read" });
  const entries = new Map();
  await walk(handle, "", entries, 0);
  current = { name: handle.name, entries, truncated: entries.size >= MAX_ENTRIES };
  notify();
  return current;
}

// بديل للمتصفحات التي لا تدعم showDirectoryPicker: <input webkitdirectory>
export function loadFolderFromInput(fileList) {
  const files = [...fileList];
  if (!files.length) return null;
  const root = (files[0].webkitRelativePath || "").split("/")[0] || "المجلد";
  const entries = new Map();
  for (const f of files) {
    const rel = (f.webkitRelativePath || f.name).split("/").slice(1).join("/") || f.name;
    if (rel.split("/").some((seg) => SKIP.test(seg))) continue;
    const segs = rel.split("/");
    for (let i = 1; i < segs.length; i++) {
      const d = segs.slice(0, i).join("/");
      if (!entries.has(d)) entries.set(d, { path: d, name: segs[i - 1], dir: true });
    }
    entries.set(rel, { path: rel, name: f.name, dir: false, size: f.size, mtime: f.lastModified, getFile: async () => f });
    if (entries.size >= MAX_ENTRIES) break;
  }
  current = { name: root, entries, truncated: entries.size >= MAX_ENTRIES };
  notify();
  return current;
}

// ===== تنفيذ أدوات المساعد =====
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\\/g, "/")
    .trim();

const cleanPath = (p) => String(p || "").replace(/\\/g, "/").replace(/^\.?\/+|\/+$/g, "");
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
const date = (t) => (t ? new Date(t).toISOString().slice(0, 10) : "");

function listDir(path) {
  const base = cleanPath(path);
  if (base && !current.entries.get(base)?.dir) return { text: `Folder not found: "${base}". Use list_folder with an empty path to see the root.`, isError: true };
  const kids = [...current.entries.values()].filter((e) => {
    const parent = e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "";
    return parent === base;
  });
  kids.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, "ar") : a.dir ? -1 : 1));
  const shown = kids.slice(0, 300);
  const lines = shown.map((e) => (e.dir ? `[DIR]  ${e.path}/` : `[FILE] ${e.path}  (${size(e.size)}, ${date(e.mtime)})`));
  const more = kids.length > shown.length ? `\n… and ${kids.length - shown.length} more entries` : "";
  return { text: `Connected folder "${current.name}"${base ? ` › ${base}` : ""} — ${kids.length} entries:\n${lines.join("\n") || "(empty)"}${more}` };
}

function search(query) {
  const q = norm(query);
  const hits = [...current.entries.values()].filter((e) => norm(e.path).includes(q)).slice(0, 50);
  if (!hits.length) return { text: `No files or folders match "${query}".` };
  return { text: hits.map((e) => (e.dir ? `[DIR]  ${e.path}/` : `[FILE] ${e.path}  (${size(e.size)}, ${date(e.mtime)})`)).join("\n") };
}

async function readFile(path) {
  const p = cleanPath(path);
  const e = current.entries.get(p) || [...current.entries.values()].find((x) => !x.dir && norm(x.path) === norm(p));
  if (!e || e.dir) return { text: `File not found: "${p}". Use search_folder to find the exact path.`, isError: true };
  const file = await e.getFile();
  const prepared = await prepareFile(file, { allowTruncate: true });
  if (prepared.kind === "text" && prepared.text.length <= INLINE_TEXT) {
    return { text: `File: ${e.path}\n\n${prepared.text}` };
  }
  const up = await uploadPrepared(prepared);
  return { text: `File: ${e.path}`, fileId: up.id };
}

// calls: [{id, name, input}] → results للسيرفر
export async function runFolderTools(calls, onProgress) {
  const out = [];
  for (const c of calls) {
    onProgress?.(c);
    if (!current) {
      out.push({ id: c.id, isError: true, text: "No folder is connected. Ask the user to tap «ربط مجلد» (Connect folder) and choose a folder from their device." });
      continue;
    }
    try {
      let r;
      if (c.name === "list_folder") r = listDir(c.input?.path);
      else if (c.name === "search_folder") r = search(c.input?.query);
      else if (c.name === "read_folder_file") r = await readFile(c.input?.path);
      else r = { text: `Unknown tool ${c.name}`, isError: true };
      out.push({ id: c.id, ...r });
    } catch (err) {
      out.push({ id: c.id, isError: true, text: `Could not read: ${err.message}` });
    }
  }
  return out;
}
