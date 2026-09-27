import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as perm from "../lib/permissions.js";
import * as odoo from "../lib/odooClient.js";

const router = Router();
router.use(requireAuth);

const call = (model, method, args) => odoo.execKw(model, method, args);

router.get("/permissions", requireRole("admin", "hr"), async (req, res) => {
  // استثناءاتُ صاحب الجلسة نفسِه تُعرض معها: الشاشةُ تقول من أين جاء المستوى
  const mine = await perm.userPerms(req.user?.login, call);
  res.json({
    overrides: perm.getOverrides(), user: mine,
    levels: Object.keys(perm.LVL_RANK),
    rule: "الرتبة الفعلية = min(رتبة التصنيف، رتبة الخدمة)، واستثناءُ المستخدم يسبق دورَه",
  });
});

router.put("/permissions", requireRole("admin"), (req, res) => {
  const saved = perm.setOverrides(req.body?.overrides || {});
  res.json({ ok: true, overrides: saved });
});

router.get("/permissions/check", async (req, res) => {
  const { role = req.user.role, category = "general", unit = "" } = req.query;
  // ⚠️ الاستثناءُ يُقرأ لصاحب الجلسة لا للدور المسؤول عنه: سؤالُ «ماذا يملك
  // دورُ كذا» شيء، و«ماذا أملك أنا» شيءٌ آخر — والشاشة تسأل عن نفسها.
  const uperms = role === req.user.role ? await perm.userPerms(req.user?.login, call) : {};
  const eff = perm.effRankFor(role, category, unit, uperms);
  res.json({
    role, category, unit, effRank: eff,
    source: uperms[unit] ? "استثناء المستخدم" : "حكم الدور",
    canView: eff >= 1, canCreate: eff >= 2, canApprove: eff >= 6, hidden: eff === 0,
  });
});

export default router;
