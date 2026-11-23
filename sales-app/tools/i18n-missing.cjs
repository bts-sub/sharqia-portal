// النصوص العربية في التطبيق التي ليست في قاموس الترجمة بعد (تظهر عربيةً بالإنجليزية والفرنسية والأوردو).
//   node sales-app/tools/i18n-missing.cjs
// يقرأ سلاسل JS ونصوص الصفحة في index.html (بلا التعليقات) كما يراها static/i18n.js: النص كاملًا، ثم كل «جملة عربية»
// فيه. أضف الناقص إلى static/i18n-dict.js: "النص": ["English", "Français", "اردو"].
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..");
const ctx = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(APP, "static", "i18n-dict.js"), "utf8"), ctx);
const DICT = ctx.self.I18N_DICT;
const L = "ؠ-ؿف-يٮٯٱ-ۓەۮۯۺ-ۼۿـ";
const M = "ً-ٰٟۖ-ۭ";
const RUN = new RegExp("[" + L + "][" + L + M + "  ،]*[" + L + M + "]|[" + L + "]", "g");
const ARABIC = /[؀-ۿ]/;

function literals(line) {
  const out = []; let i = 0, q = null, cur = "";
  while (i < line.length) {
    const c = line[i];
    if (q) { if (c === "\\") { cur += c + (line[i + 1] || ""); i += 2; continue; } if (c === q) { out.push(cur); q = null; cur = ""; } else cur += c; i++; continue; }
    if (c === "/" && line[i + 1] === "/") break;
    if (c === "'" || c === '"' || c === "`") { q = c; i++; continue; }
    if (c === "/" && /[(,=:!&|?{};\[]\s*$/.test(line.slice(0, i))) {
      let j = i + 1, cls = false;
      while (j < line.length) { const d = line[j]; if (d === "\\") { j += 2; continue; } if (d === "[") cls = true; else if (d === "]") cls = false; else if (d === "/" && !cls) break; j++; }
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}
const missing = new Map();
function check(text, where) {
  text = text.replace(/\s+/g, " ").trim();
  if (!text || !ARABIC.test(text) || DICT[text]) return;
  // نصٌّ مختلط: يكفي أن تُعرف جمله العربية
  const runs = (text.match(RUN) || []).filter((r) => !DICT[r.replace(/\s+/g, " ")]);
  if (runs.length && !missing.has(text)) missing.set(text, where);
}
let mode = "html";
fs.readFileSync(path.join(APP, "index.html"), "utf8").split(/\r?\n/).forEach((line, n) => {
  if (/<script\b/.test(line) && !/<\/script>/.test(line)) { mode = "js"; return; }
  if (/<\/script>|<\/style>/.test(line)) { mode = "html"; return; }
  if (/<style\b/.test(line)) { mode = "css"; return; }
  if (mode === "css") return;
  const pieces = mode === "html" ? [line.replace(/<!--[\s\S]*?-->/g, "")] : literals(line);
  for (const s of pieces) {
    if (!ARABIC.test(s)) continue;
    for (const m of s.matchAll(/\b(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) check(m[1], n + 1);
    for (const seg of s.replace(/<[^>]*>/g, "\u0001").split("\u0001")) check(seg, n + 1);
  }
});
for (const [text, line] of missing) console.log(`index.html:${line}\t${text}`);
console.log(`${missing.size} نصًّا بلا ترجمة`);
