// ===========================================================================
// joinUploads.js — مرفقاتُ بوابة البيانات تُرفع ملفًّا ملفًّا قبل الإرسال
//
// ⚠️ كانت تُرسل كلُّها في طلبٍ واحدٍ مع البيانات: عشرون ميجابايت في نداءٍ
// واحد على شبكة جوّالٍ متوسّطة يطول حتى ينقطع في منتصفه، فيُردّ الطلب كلُّه
// ولا يدري صاحبُه أيُّ ملفٍّ أعجزه. والرفعُ ملفًّا ملفًّا يُنجّي البقيّة:
// ما وصل بقي، وما انقطع يُعاد وحده.
//
// والملفّاتُ تُكتب على القرص لا في الذاكرة: للخادم ٤٥٨ ميجابايت وحدها،
// وملفّان كبيران في الذاكرة يخنقان التطبيق كلَّه.
// ===========================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// ⚠️ على القرص الدائم لا في /tmp: كانت تُحتجَز داخل الحاوية، وكلُّ نشرةٍ
// تُعيد بناءها فتمحوها. فمن رفع مستنداته ثمّ أكمل التعبئة ونشرنا في تلك
// الدقائق، وصل طلبُه **بلا مرفقاته** — ولا أحدَ يدري: لا رسالةَ خطأ ولا
// أثر، والموارد البشرية ترى خاناتٍ فارغةً وتظنّ الموظف لم يرفع.
// وهذا وقع فعلًا، وبقي في المجلد ملفٌّ يتيمٌ شاهدًا عليه.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DIR = (() => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return path.join(DATA_DIR, "join-uploads");
  } catch {
    return path.join(os.tmpdir(), "sq-join-uploads");   // تطويرٌ محلّيّ
  }
})();
// ⚠️ سبعةُ أيامٍ لا ساعة.
//
// كانت ساعةً «تكفي أبطأ تعبئة» — ولا تكفي: الموظف يُرفق صورَه ثمّ يُترك
// النموذجُ مفتوحًا ليعود إليه، أو تُستأنف التعبئةُ في اليوم التالي من
// الجهاز نفسه (والبياناتُ محفوظةٌ له فيه). فيضغط «إرسال» فيُردّ «انتهت
// مهلةُ حفظ صورة الهوية» — وهو لم يفعل شيئًا سوى أنه تمهّل.
//
// والقرصُ لا يمتلئ بهذا: سقفُ MAX_DISK يحذف الأقدمَ فالأقدم متى بلغه،
// فالحدُّ على المساحة لا على الزمن — وذاك أصحّ: الزمنُ يُعاقب البطيءَ،
// والمساحةُ تُحاسب على ما شُغل فعلًا.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILE = 10 * 1024 * 1024;       // لكلّ ملف
const MAX_DISK = 400 * 1024 * 1024;      // سقفُ ما يُحتجز على القرص

function ensureDir() {
  try { fs.mkdirSync(DIR, { recursive: true }); } catch { /* موجودٌ أصلًا */ }
}
ensureDir();

const clean = () => {
  try {
    const now = Date.now();
    let total = 0;
    const files = fs.readdirSync(DIR).map((f) => {
      const p = path.join(DIR, f);
      const st = fs.statSync(p);
      total += st.size;
      return { p, at: st.mtimeMs, size: st.size };
    });
    for (const f of files) {
      if (now - f.at > TTL_MS) { fs.unlinkSync(f.p); total -= f.size; }
    }
    // وإن تجاوز السقف حُذف الأقدم فالأقدم — ملفٌّ متروكٌ لا يمنع رفعَ غيره
    if (total > MAX_DISK) {
      files.sort((a, b) => a.at - b.at);
      for (const f of files) {
        if (total <= MAX_DISK) break;
        try { fs.unlinkSync(f.p); total -= f.size; } catch { /* حُذف قبلُ */ }
      }
    }
  } catch (e) { console.warn("⚠️ تنظيف مرفقات البوابة:", e.message); }
};
setInterval(clean, 10 * 60 * 1000).unref?.();
clean();

/** يحفظ مرفقًا واحدًا ويُعيد معرّفَه. */
export function putFile({ base64, name }) {
  const data = String(base64 || "");
  const raw = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  const bytes = Math.round(raw.length * 0.75);
  if (!raw) throw new Error("ملفٌّ فارغ");
  if (bytes > MAX_FILE) throw new Error("الملف أكبر من ١٠ ميجابايت");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 200))) throw new Error("ترميزُ الملف غير صالح");
  ensureDir();
  const fid = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(DIR, fid), raw, "utf8");
  return { fid, bytes, name: String(name || "").slice(0, 120) };
}

/** يقرأ مرفقًا بمعرّفه (base64 خامًا) — ويحذفه بعد القراءة إن طُلب. */
export function takeFile(fid, { remove = true } = {}) {
  if (!/^[a-f0-9]{32}$/.test(String(fid || ""))) return "";
  const p = path.join(DIR, fid);
  try {
    const raw = fs.readFileSync(p, "utf8");
    if (remove) { try { fs.unlinkSync(p); } catch { /* حُذف قبلُ */ } }
    return raw;
  } catch { return ""; }
}

export const UPLOAD_LIMITS = { MAX_FILE, TTL_MS };
