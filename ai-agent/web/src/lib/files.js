// تجهيز الملفات في المتصفح قبل رفعها:
//  - PDF يُرفع كما هو (Claude يقرأ النصوص والصفحات الممسوحة ضوئيًا)
//  - الصور تُصغَّر (أسرع وأرخص بلا فقد للتفاصيل المهمة)
//  - Word وExcel والنصوص تتحوّل لنص هنا على الجهاز ثم يُرفع النص فقط
import { api } from "./api.js";

const MAX_TEXT_CHARS = 600_000;
const TEXT_EXT = /\.(txt|md|csv|tsv|json|xml|html?|log|ya?ml|ini|sql|js|jsx|ts|tsx|py|java|cs|php|rb|go|css|sh|bat|ps1)$/i;
const EXCEL_EXT = /\.(xlsx|xlsm|xls|ods)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

export const ACCEPT = ".pdf,.docx,.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt,.md,.json,.xml,.html,.htm,.log,image/*";

export function fileKind(name, type = "") {
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (type.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  if (/\.docx$/i.test(name)) return "docx";
  if (EXCEL_EXT.test(name)) return "excel";
  if (type.startsWith("text/") || TEXT_EXT.test(name)) return "text";
  if (/\.(doc|ppt|pptx)$/i.test(name)) return "office-old";
  return null;
}

async function downscaleImage(file, maxSide = 1568) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("تعذّر قراءة الصورة — جرّب صيغة JPG أو PNG");
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.86));
}

async function excelToText(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    return `### ورقة: ${name}\n${csv}`;
  }).join("\n\n");
}

async function docxToText(file) {
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

// يحوّل الملف لصيغة قابلة للرفع: {blob, type, name, kind, text?}
export async function prepareFile(file, { allowTruncate = false } = {}) {
  const name = file.name || "ملف";
  const kind = fileKind(name, file.type);
  if (!kind) throw new Error(`نوع الملف «${name}» غير مدعوم`);
  if (kind === "office-old") throw new Error(`«${name}»: احفظه بصيغة docx أو PDF أولًا`);

  if (kind === "pdf") {
    if (file.size > 20 * 1048576) throw new Error(`«${name}» أكبر من 20MB — قسّمه أو اضغطه`);
    return { blob: file, type: "application/pdf", name, kind: "pdf" };
  }
  if (kind === "image") {
    const blob = await downscaleImage(file);
    return { blob, type: "image/jpeg", name, kind: "image" };
  }

  let text;
  if (kind === "excel") text = await excelToText(file);
  else if (kind === "docx") text = await docxToText(file);
  else text = await file.text();
  text = text.replace(/\u0000/g, "");
  let note = "";
  if (text.length > MAX_TEXT_CHARS) {
    if (!allowTruncate) throw new Error(`«${name}» كبير جدًا (${Math.round(text.length / 1000)} ألف حرف) — قسّمه لملفات أصغر`);
    note = `\n\n[تنبيه: الملف أطول من المسموح؛ يظهر أول ${MAX_TEXT_CHARS / 1000} ألف حرف فقط من أصل ${Math.round(text.length / 1000)} ألف]`;
    text = text.slice(0, MAX_TEXT_CHARS) + note;
  }
  if (!text.trim()) throw new Error(`«${name}» لا يحتوي نصًّا مقروءًا`);
  return { blob: new Blob([text], { type: "text/plain;charset=utf-8" }), type: "text/plain", name, kind: "text", text };
}

export async function uploadPrepared(p) {
  return api("/files", {
    method: "POST",
    raw: p.blob,
    headers: { "Content-Type": p.type, "X-File-Name": encodeURIComponent(p.name) },
  });
}
