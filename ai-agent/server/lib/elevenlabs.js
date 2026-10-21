// ElevenLabs: أصوات عربية عالمية الجودة (نطق)، تعرّف على الكلام (Scribe)،
// و«وكيل المكالمات» الذي يرد على هاتف المستخدم (Agents Platform).
// المفتاح يضعه المدير في الإعدادات ويُحفظ مشفّرًا.
import { AppError } from "./errors.js";
import { getEleven } from "./settings.js";

const BASE = "https://api.elevenlabs.io";

function cfg() {
  const c = getEleven();
  if (!c) throw new AppError("لم يُضَف مفتاح ElevenLabs بعد — من لوحة الإدارة ← الإعدادات", 404);
  return c;
}

async function el(path, { method = "GET", json, form, key, timeout = 30_000 } = {}) {
  const headers = { "xi-api-key": key || cfg().key };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new AppError("تعذّر الاتصال بـElevenLabs — حاول بعد قليل", 502);
  }
  if (!r.ok) {
    let msg = `ElevenLabs ${r.status}`;
    try {
      const j = await r.json();
      const d = j?.detail;
      msg = typeof d === "string" ? d : d?.message || (Array.isArray(d) ? d.map((x) => x.msg).join("؛ ") : JSON.stringify(j)).slice(0, 300);
    } catch {}
    if (r.status === 401) throw new AppError("مفتاح ElevenLabs غير صالح أو لا يملك الصلاحية المطلوبة", 400);
    if (r.status === 429) throw new AppError("تجاوزت حد ElevenLabs الآن أو نفد الرصيد", 429);
    const err = new AppError(`ElevenLabs: ${msg}`, r.status >= 500 ? 502 : 400);
    err.upstream = r.status;
    throw err;
  }
  return r;
}

// ===== الأصوات =====
let voicesCache = { at: 0, key: "", list: [] };
export async function elVoices({ key } = {}) {
  const k = key || cfg().key;
  if (voicesCache.key === k && Date.now() - voicesCache.at < 10 * 60_000) return voicesCache.list;
  const out = [];
  let token = null;
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ page_size: "100", sort: "name", sort_direction: "asc" });
    if (token) q.set("next_page_token", token);
    const j = await (await el(`/v2/voices?${q}`, { key: k })).json();
    for (const v of j.voices || []) {
      out.push({
        id: v.voice_id,
        name: v.name,
        gender: v.labels?.gender || "",
        accent: v.labels?.accent || "",
        language: v.labels?.language || "",
        category: v.category || "",
        preview: v.preview_url || "",
      });
    }
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  voicesCache = { at: Date.now(), key: k, list: out };
  return out;
}

export async function elPreview(voiceId) {
  const v = (await elVoices()).find((x) => x.id === voiceId);
  if (!v?.preview) throw new AppError("لا توجد عيّنة لهذا الصوت", 404);
  const r = await fetch(v.preview, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new AppError("تعذّر تحميل العيّنة", 502);
  return Buffer.from(await r.arrayBuffer());
}

// ===== النطق =====
export async function elTts({ text, voiceId, speed = 1 }) {
  const c = cfg();
  const r = await el(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    json: {
      text,
      model_id: c.model,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: Math.min(Math.max(speed, 0.7), 1.2) },
    },
  });
  return Buffer.from(await r.arrayBuffer());
}

// ===== التعرّف على الكلام =====
export async function elStt({ audio, mime = "audio/wav", lang = "ar" }) {
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("language_code", lang);
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([audio], { type: mime }), mime.includes("wav") ? "audio.wav" : "audio.webm");
  const j = await (await el("/v1/speech-to-text", { method: "POST", form, timeout: 60_000 })).json();
  return (j.text || "").trim();
}

// ===== وكيل المكالمات =====
export async function elCreateAgent(body) {
  return (await el("/v1/convai/agents/create", { method: "POST", json: body })).json();
}
export async function elUpdateAgent(agentId, body) {
  return (await el(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "PATCH", json: body })).json();
}
export async function elDeleteAgent(agentId) {
  await el(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" }).catch(() => {});
}
export async function elImportTwilio({ phone, sid, token, label, agentId }) {
  return (await el("/v1/convai/phone-numbers", {
    method: "POST",
    json: { provider: "twilio", phone_number: phone, sid, token, label, agent_id: agentId, enable_sms: false },
  })).json();
}
export async function elAssignNumber(phoneNumberId, agentId) {
  return (await el(`/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`, { method: "PATCH", json: { agent_id: agentId } })).json();
}
export async function elDeleteNumber(phoneNumberId) {
  await el(`/v1/convai/phone-numbers/${encodeURIComponent(phoneNumberId)}`, { method: "DELETE" }).catch(() => {});
}
export async function elConversations(agentId, afterUnix) {
  const q = new URLSearchParams({ agent_id: agentId, page_size: "30", summary_mode: "include" });
  if (afterUnix) q.set("call_start_after_unix", String(afterUnix));
  return (await el(`/v1/convai/conversations?${q}`)).json();
}
export async function elConversation(id) {
  return (await el(`/v1/convai/conversations/${encodeURIComponent(id)}`)).json();
}

export async function elTestKey(key) {
  await elVoices({ key });
  return true;
}
