// الصوت عبر Azure Speech (اختياري): أصوات عربية طبيعية رجل/امرأة بلهجة سعودية
// أو مصرية، وتحويل الكلام لنص. بدون مفتاح Azure يستخدم التطبيق أصوات الجهاز.
import { getAzure } from "./settings.js";
import { AppError } from "./errors.js";

export const AZURE_VOICES = {
  "ar-SA": { male: "ar-SA-HamedNeural", female: "ar-SA-ZariyahNeural" },
  "ar-EG": { male: "ar-EG-ShakirNeural", female: "ar-EG-SalmaNeural" },
  "en-US": { male: "en-US-AndrewNeural", female: "en-US-AvaNeural" },
};

const xmlEscape = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

function azureOrThrow() {
  const az = getAzure();
  if (!az) throw new AppError("الصوت السحابي غير مفعّل — يُستخدم صوت الجهاز", 404);
  return az;
}

export async function synthesize({ text, lang = "ar-SA", gender = "male", rate = 1 }) {
  const az = azureOrThrow();
  const voice = (AZURE_VOICES[lang] || AZURE_VOICES["ar-SA"])[gender === "female" ? "female" : "male"];
  const pct = Math.round((Math.min(Math.max(rate, 0.6), 1.6) - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${xmlEscape(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${az.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": az.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "sharqia-ai",
    },
    body: ssml,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new AppError(`تعذّر توليد الصوت (Azure ${r.status})`, 502);
  return Buffer.from(await r.arrayBuffer());
}

// wav: PCM 16kHz mono (يجهّزه المتصفح) — حتى 60 ثانية
export async function transcribe({ wav, lang = "ar-SA" }) {
  const az = azureOrThrow();
  const url =
    `https://${az.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(lang)}&format=simple`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": az.key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
    },
    body: wav,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new AppError(`تعذّر التعرّف على الكلام (Azure ${r.status})`, 502);
  const j = await r.json();
  return j.RecognitionStatus === "Success" ? j.DisplayText || "" : "";
}

export async function testAzure() {
  await synthesize({ text: "مرحبا" });
  return true;
}
