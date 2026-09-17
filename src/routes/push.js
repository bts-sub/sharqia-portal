// ===========================================================================
// routes/push.js — تسجيل أجهزة الموظفين لإشعارات الخلفية
//   GET  /api/push/key         المفتاح العام (يحتاجه المتصفح للاشتراك)
//   POST /api/push/subscribe   { subscription }
//   POST /api/push/unsubscribe { endpoint }
//   POST /api/push/test        إشعار تجريبي إلى أجهزة صاحب الجلسة
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { badRequest } from "../lib/errors.js";
import { publicKey, saveSubscription, removeSubscription, countFor, sendToUser } from "../lib/push.js";
import { notifGateMode } from "../lib/settings.js";

const router = Router();

// المفتاح العام ليس سرًّا — لكنه خلف الجلسة كبقية المسارات
router.get("/push/key", requireAuth, (req, res, next) => {
  try {
    res.json({
      key: publicKey(),
      devices: countFor(req.user.id),
      gate: notifGateMode(),
      // مدير النظام لا يُحجب: هو من يملك مفتاح تخفيف الحجب، فحجبُه يُغلق
      // الباب على المفتاح نفسه.
      exempt: req.user.role === "admin",
    });
  } catch (e) { next(e); }
});

router.post("/push/subscribe", requireAuth, (req, res, next) => {
  try {
    const sub = req.body?.subscription || req.body;
    saveSubscription(req.user.id, sub, { ua: req.get("user-agent") });
    res.json({ ok: true, devices: countFor(req.user.id) });
  } catch (e) { next(e?.status ? e : badRequest(e?.message || "تعذّر تسجيل الجهاز")); }
});

router.post("/push/unsubscribe", requireAuth, (req, res, next) => {
  try {
    const endpoint = String(req.body?.endpoint || "");
    if (!endpoint) throw badRequest("endpoint مطلوب");
    res.json({ ok: true, removed: removeSubscription(endpoint) });
  } catch (e) { next(e); }
});

router.post("/push/test", requireAuth, async (req, res, next) => {
  try {
    const r = await sendToUser(req.user.id, {
      title: "تجربة إشعار", body: "وصلك هذا الإشعار — التفعيل سليم.",
      tag: "sq-test",
    });
    res.json({ ok: true, ...r });
  } catch (e) { next(e); }
});

export default router;
