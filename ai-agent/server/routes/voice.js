// الصوت السحابي (Azure) — يعمل فقط إن أضافت الإدارة مفتاح Azure Speech.
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { AppError, wrap } from "../lib/errors.js";
import { synthesize, transcribe } from "../lib/speech.js";

const r = Router();

r.use((req, res, next) => {
  if (req.user.limits?.features?.voice === false) return next(new AppError("الصوت غير مفعّل لحسابك", 403));
  next();
});

const voiceLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  keyGenerator: (req) => req.user.id,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "طلبات صوت كثيرة — انتظر قليلًا" },
});

r.post("/tts", voiceLimiter, wrap(async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 1500);
  if (!text) throw new AppError("لا يوجد نص", 400);
  const audio = await synthesize({
    text,
    lang: req.user.prefs?.speechLang || "ar-SA",
    gender: req.user.agent?.gender,
    rate: req.user.prefs?.voiceRate || 1,
  });
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.send(audio);
}));

r.post(
  "/stt",
  voiceLimiter,
  express.raw({ type: () => true, limit: 3 * 1024 * 1024 }),
  wrap(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) throw new AppError("تسجيل فارغ", 400);
    const text = await transcribe({ wav: req.body, lang: req.user.prefs?.speechLang || "ar-SA" });
    res.json({ text });
  }),
);

export default r;
