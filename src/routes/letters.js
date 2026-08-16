// ===========================================================================
// routes/letters.js — الخطابات والشهادات الصادرة
//   GET /api/letters          → خطابات الموظف الحالي
//   GET /api/letters/:id/pdf  → ملف الخطاب (تنزيل على الجوال أو عرض)
//
// الملف يُخدَم من الباك إند لا من أودو مباشرةً: الموظف لا يملك حسابًا في
// أودو أصلًا، وفتح رابط أودو له يعني إمّا كشف حساب الخدمة أو رفض الوصول.
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";

const router = Router();
router.use(requireAuth);

router.get("/letters", async (req, res, next) => {
  try {
    const { data, source, warning } = await runAction("letter.list", {}, { user: req.user });
    res.json({ ...(data || { records: [] }), odooSource: source, ...(warning ? { warning } : {}) });
  } catch (e) { next(e); }
});

// POST /api/letters/:id/sign { image } → توقيع الموارد البشرية من التطبيق
router.post("/letters/:id/sign", async (req, res, next) => {
  try {
    const { data } = await runAction("letter.sign",
      { id: req.params.id, image: req.body?.image }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/letters/:id/pdf", async (req, res, next) => {
  try {
    const { data } = await runAction("letter.pdf", { id: req.params.id }, { user: req.user });
    const buf = Buffer.from(data.base64, "base64");
    // ?view=1 يعرضه في قارئ المتصفح؛ الافتراضي تنزيل لأن الموظف يطلبه ورقةً
    const inline = ["1", "true"].includes(String(req.query.view));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(data.name)}`);
    res.setHeader("Content-Length", buf.length);
    // خطاب يحمل الراتب — لا يُخزَّن في وسيط مشترك
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buf);
  } catch (e) { next(e); }
});

export default router;
