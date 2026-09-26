// ===========================================================================
// certs.js — الشهادات المهنية للموظف (تُخزَّن عندنا، يديرها الموظف بنفسه).
//   GET    /api/me/certs        قائمة شهاداته
//   POST   /api/me/certs        إضافة شهادة {name, dateKind, date, file?}
//   DELETE /api/me/certs/:id    حذف شهادة
// لا اعتماد من Odoo — تخزينٌ ذاتيّ بسيط لكل موظف.
// ===========================================================================
import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { readAll, writeAll } from "../lib/store.js";

const router = Router();
const KEY = "certs";
const MAX_FILE = 6_000_000; // ~4.5MB أصلية بعد base64

router.use("/api/me/certs", requireAuth);

router.get("/api/me/certs", (req, res) => {
  const mine = readAll(KEY).filter((c) => c.userId === req.user.id);
  res.set("Cache-Control", "private, no-store");
  res.json({ records: mine });
});

router.post("/api/me/certs", (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const date = String(b.date || "").slice(0, 10);
  if (!name) return res.status(400).json({ error: "اسم الشهادة مطلوب." });
  if (!date) return res.status(400).json({ error: "تاريخ الشهادة مطلوب." });
  const file = b.file ? String(b.file) : "";
  if (file && file.length > MAX_FILE) {
    return res.status(400).json({ error: "حجم ملف الشهادة كبير — الحد نحو 4.5 ميجابايت." });
  }
  const rec = {
    id: crypto.randomBytes(8).toString("hex"),
    userId: req.user.id,
    name: name.slice(0, 140),
    dateKind: b.dateKind === "issue" ? "issue" : "expiry",
    date,
    file,
    at: new Date().toISOString(),
  };
  const all = readAll(KEY);
  all.unshift(rec);
  writeAll(KEY, all);
  res.json({ ok: true, id: rec.id });
});

router.delete("/api/me/certs/:id", (req, res) => {
  const all = readAll(KEY);
  const rest = all.filter((c) => !(c.id === req.params.id && c.userId === req.user.id));
  if (rest.length !== all.length) writeAll(KEY, rest);
  res.json({ ok: true, removed: all.length - rest.length });
});

export default router;
