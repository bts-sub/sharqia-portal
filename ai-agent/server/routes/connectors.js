// ربط واتساب وGmail لكل مستخدم + صفحة المتابعات.
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AppError, wrap } from "../lib/errors.js";
import { waConnect, waLogout, waStatus } from "../lib/connectors/whatsapp.js";
import { gmailLink, gmailStatus, gmailUnlink } from "../lib/connectors/gmail.js";
import { listFollowups, stopFollowup } from "../lib/followups.js";

const r = Router();

const need = (feature) => (req, res, next) =>
  req.user.limits?.features?.[feature] ? next() : next(new AppError("هذه الميزة غير مفعّلة لحسابك — تواصل مع الإدارة", 403));

const linkLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  keyGenerator: (req) => req.user.id,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "محاولات ربط كثيرة — انتظر قليلًا" },
});

r.get("/", wrap(async (req, res) => {
  const f = req.user.limits?.features || {};
  res.json({
    whatsapp: f.whatsapp ? await waStatus(req.user.id) : null,
    gmail: f.gmail ? gmailStatus(req.user.id) : null,
  });
}));

r.post("/whatsapp/connect", need("whatsapp"), linkLimiter, wrap(async (req, res) => {
  await waConnect(req.user.id, { phone: req.body?.phone || null });
  // أول رمز QR/رمز ربط يصل خلال ثوانٍ؛ المتصفح يسأل /connectors كل ثانيتين
  res.json(await waStatus(req.user.id));
}));

r.post("/whatsapp/logout", need("whatsapp"), wrap(async (req, res) => {
  await waLogout(req.user.id);
  res.json(await waStatus(req.user.id));
}));

r.post("/gmail", need("gmail"), linkLimiter, wrap(async (req, res) => {
  res.json(await gmailLink(req.user.id, req.body || {}));
}));

r.delete("/gmail", need("gmail"), (req, res) => {
  gmailUnlink(req.user.id);
  res.json({ linked: false });
});

r.get("/followups", need("whatsapp"), (req, res) => {
  res.json({ followups: listFollowups(req.user.id) });
});

r.post("/followups/:id/stop", need("whatsapp"), (req, res) => {
  if (!stopFollowup(req.user.id, req.params.id)) throw new AppError("المتابعة غير موجودة", 404);
  res.json({ followups: listFollowups(req.user.id) });
});

export default r;
