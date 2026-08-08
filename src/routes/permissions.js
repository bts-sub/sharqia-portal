// ===========================================================================
// routes/permissions.js — عرض/تعديل مصفوفة الصلاحيات (مدير النظام)
//   GET  /api/permissions              → التجاوزات المخزّنة + شرح القاعدة
//   PUT  /api/permissions              → حفظ التجاوزات (admin)
//   GET  /api/permissions/check        → فحص صلاحية دور على تصنيف/خدمة
// ===========================================================================
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as perm from "../lib/permissions.js";

const router = Router();
router.use(requireAuth);

router.get("/permissions", requireRole("admin", "hr"), (req, res) => {
  res.json({ overrides: perm.getOverrides(), levels: Object.keys(perm.LVL_RANK), rule: "الرتبة الفعلية = min(رتبة التصنيف، رتبة الخدمة)" });
});

router.put("/permissions", requireRole("admin"), (req, res) => {
  const saved = perm.setOverrides(req.body?.overrides || {});
  res.json({ ok: true, overrides: saved });
});

router.get("/permissions/check", (req, res) => {
  const { role = req.user.role, category = "general", unit = "" } = req.query;
  res.json({
    role, category, unit,
    effRank: perm.effRank(role, category, unit),
    canView: perm.canView(role, category, unit),
    canCreate: perm.canCreate(role, category, unit),
    canApprove: perm.canApprove(role, category, unit),
    hidden: perm.isHidden(role, category, unit),
  });
});

export default router;
