// routes/notifications.js — إشعارات المستخدم الحالي
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { readAll, writeAll } from "../lib/store.js";

const router = Router();
router.use(requireAuth);

router.get("/notifications", (req, res) => {
  const mine = readAll("notifs").filter((n) => n.userId === req.user.id);
  res.json({ records: mine });
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
