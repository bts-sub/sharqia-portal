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

export default router;
