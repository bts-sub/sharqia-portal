// routes/attachments.js — رفع المرفقات إلى ir.attachment (توافق مع uploadAttachment)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { badRequest } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

// POST /api/attachments { fileName, base64, resModel, resId } → { odooAttachmentId }
router.post("/attachments", async (req, res, next) => {
  try {
    const { fileName, base64, resModel, resId } = req.body || {};
    if (!fileName || !base64) throw badRequest("fileName و base64 مطلوبان");
    // حدّ حجم مبدئي (~8MB بعد base64) — عدّله حسب الحاجة
    if (base64.length > 8 * 1024 * 1024 * 1.4) throw badRequest("حجم المرفق كبير جدًا");
    const { data } = await runAction("attachment.upload", { fileName, base64, resModel, resId }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/attachments/:id → الملف نفسه (تنزيل/عرض)
//   المدير يفتح ما أرفقه مرؤوسه؛ الفحص على الخادم لا على الواجهة.
router.get("/attachments/:id", async (req, res, next) => {
  try {
    const { data } = await runAction("attachment.read", { id: req.params.id }, { user: req.user });
    if (!data?.base64) throw badRequest("المرفق فارغ");
    const buf = Buffer.from(data.base64, "base64");
    res.setHeader("Content-Type", data.mimetype);
    // اسم الملف قد يكون عربيًّا — filename* بترميز RFC 5987
    res.setHeader("Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(data.name || "attachment")}`);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buf);
  } catch (e) { next(e); }
});

export default router;
