// رفع الملفات (تُشفَّر فور وصولها) وتنزيلها لصاحبها فقط.
// المتصفح يرسل: PDF وصور كما هي، وWord/Excel/نصوص بعد تحويلها لنص محليًا.
import express, { Router } from "express";
import { AppError, wrap } from "../lib/errors.js";
import { LIMITS } from "../config.js";
import { vaultSize } from "../lib/vault.js";

const r = Router();

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function kindOf(ct) {
  if (ct === "application/pdf") return "pdf";
  if (IMAGE_TYPES.has(ct)) return "image";
  if (ct.startsWith("text/plain")) return "text";
  return null;
}

r.post(
  "/",
  express.raw({ type: () => true, limit: LIMITS.pdfBytes }),
  wrap(async (req, res) => {
    const f = req.user.limits?.features || {};
    if (f.files === false && f.folder === false) throw new AppError("رفع الملفات غير مسموح لحسابك", 403);
    const ct = String(req.headers["content-type"] || "").toLowerCase().split(";")[0].trim();
    const kind = kindOf(ct);
    if (!kind) throw new AppError("نوع ملف غير مدعوم", 415);
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw new AppError("الملف فارغ", 400);
    const max = kind === "pdf" ? LIMITS.pdfBytes : kind === "image" ? LIMITS.imageBytes : LIMITS.textBytes;
    if (buf.length > max) throw new AppError(`حجم الملف أكبر من المسموح (${Math.round(max / 1048576)}MB)`, 413);
    if (kind === "pdf" && buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new AppError("ملف PDF غير صالح", 400);

    const quota = (req.user.limits?.storageMb || 300) * 1024 * 1024;
    if (vaultSize(req.user.id) + buf.length > quota) {
      throw new AppError("امتلأت مساحتك التخزينية — احذف محادثات قديمة أو اطلب من الإدارة زيادتها", 413);
    }
    let name = "ملف";
    try { name = decodeURIComponent(String(req.headers["x-file-name"] || "ملف")); } catch {}
    name = name.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "ملف";

    const saved = req.vault.putFile(buf, { name, kind, mediaType: ct });
    res.json({ id: saved.id, name: saved.name, kind: saved.kind, size: saved.size });
  }),
);

r.get("/:id", (req, res) => {
  const f = req.vault.getFile(req.params.id);
  if (!f) throw new AppError("الملف غير موجود", 404);
  res.setHeader("Content-Type", f.meta.kind === "text" ? "text/plain; charset=utf-8" : f.meta.mediaType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.meta.name)}`);
  res.send(f.buf);
});

export default r;
