// routes/notifications.js — إشعارات المستخدم الحالي
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { readAll, writeAll } from "../lib/store.js";
import { runAction } from "../odooActions.js";

const router = Router();
router.use(requireAuth);

// التعاميم (من Odoo)
router.get("/announcements", async (req, res, next) => {
  try {
    const { data } = await runAction("announcement.list", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// إشعار حالة (لا يُخزَّن): يظهر ما دام الموظف في إجازة معتمدة سارية، ويختفي
// وحده بعد عودته. أُضيف كإشعار لأن الواجهة تعرض الإشعارات في الرئيسية
// وفي تبويب الإشعارات معًا — فيصل التنبيه بلا تعديل في الواجهة.
async function onLeaveNotice(user) {
  try {
    const { data } = await runAction("leave.current", {}, { user });
    if (!data?.onLeave) return null;
    const tail = data.daysLeft > 0
      ? `تبقّى ${data.daysLeft} ${data.daysLeft === 1 ? "يوم" : "يومًا"} — العودة للعمل ${data.returnOn}`
      : "آخر يوم في الإجازة — العودة للعمل غدًا";
    return {
      id: "on-leave",
      type: "system",
      title: `أنت حاليًا في ${data.type}`,
      body: `من ${data.from} إلى ${data.to} · ${tail}`,
      read: false,
      at: new Date().toISOString(),
    };
  } catch { return null; }
}

router.get("/notifications", async (req, res, next) => {
  try {
    const mine = readAll("notifs").filter((n) => n.userId === req.user.id);
    const notice = await onLeaveNotice(req.user);
    res.json({ records: notice ? [notice, ...mine] : mine });
  } catch (e) { next(e); }
});

router.post("/notifications/:id/read", (req, res) => {
  const all = readAll("notifs");
  const n = all.find((x) => String(x.id) === req.params.id && x.userId === req.user.id);
  if (n) { n.read = true; writeAll("notifs", all); }
  res.json({ ok: true });
});

router.post("/notifications/read-all", (req, res) => {
  const all = readAll("notifs").map((n) => (n.userId === req.user.id ? { ...n, read: true } : n));
  writeAll("notifs", all);
  res.json({ ok: true });
});

export default router;
