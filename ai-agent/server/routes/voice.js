// الصوت السحابي: ElevenLabs أولًا (جودة عالمية) ثم Azure، وإلا يستخدم المتصفح صوت الجهاز.
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { AppError, wrap } from "../lib/errors.js";
import { synthesize, transcribe } from "../lib/speech.js";
import { elPreview, elStt, elTts, elVoices } from "../lib/elevenlabs.js";
import { getAzure, getEleven } from "../lib/settings.js";

const r = Router();

r.use((req, res, next) => {
  if (req.user.limits?.features?.voice === false) return next(new AppError("الصوت غير مفعّل لحسابك", 403));
  next();
});

const voiceLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  keyGenerator: (req) => req.user.id,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "طلبات صوت كثيرة — انتظر قليلًا" },
});

// صوت مساعد هذا المستخدم في ElevenLabs: اختياره الشخصي، وإلا افتراضي المنظّمة حسب جنس المساعد
export function userElevenVoice(user) {
  const el = getEleven();
  if (!el) return null;
  return user.prefs?.elevenVoice || (user.agent?.gender === "female" ? el.female : el.male) || el.male || el.female || null;
}

r.post("/tts", voiceLimiter, wrap(async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 1500);
  if (!text) throw new AppError("لا يوجد نص", 400);
  const rate = req.user.prefs?.voiceRate || 1;
  let audio;
  const voiceId = req.body?.voiceId || userElevenVoice(req.user);
  if (getEleven() && voiceId) {
    audio = await elTts({ text, voiceId, speed: rate });
  } else if (getAzure()) {
    audio = await synthesize({ text, lang: req.user.prefs?.speechLang || "ar-SA", gender: req.user.agent?.gender, rate });
  } else {
    throw new AppError("الصوت السحابي غير مفعّل — يُستخدم صوت الجهاز", 404);
  }
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.send(audio);
}));

r.post(
  "/stt",
  voiceLimiter,
  express.raw({ type: () => true, limit: 5 * 1024 * 1024 }),
  wrap(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 100) throw new AppError("تسجيل فارغ", 400);
    const lang = req.user.prefs?.speechLang || "ar-SA";
    let text;
    if (getEleven()) text = await elStt({ audio: req.body, mime: req.headers["content-type"] || "audio/wav", lang: lang.split("-")[0] });
    else if (getAzure()) text = await transcribe({ wav: req.body, lang });
    else throw new AppError("التعرّف السحابي على الكلام غير مفعّل", 404);
    res.json({ text });
  }),
);

// قائمة أصوات حساب ElevenLabs (لاختيار صوت المساعد)
r.get("/voices", wrap(async (req, res) => {
  if (!getEleven()) return res.json({ voices: [], current: null });
  res.json({ voices: await elVoices(), current: userElevenVoice(req.user) });
}));

r.get("/preview/:id", voiceLimiter, wrap(async (req, res) => {
  const buf = await elPreview(String(req.params.id));
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(buf);
}));

export default r;
