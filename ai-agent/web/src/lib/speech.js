// الصوت: تحويل الكلام لنص (من المتصفح، أو سحابيًا عبر Azure إن فعّلته الإدارة)
// وقراءة الردود بصوت رجل أو امرأة.
import { api } from "./api.js";
import { recordWav } from "./wav.js";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const hasBrowserSTT = () => Boolean(SR);
export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia);
export const hasBrowserTTS = () => "speechSynthesis" in window;

const STT_ERRORS = {
  "not-allowed": "لم يُسمح بالوصول للميكروفون — فعّله من إعدادات المتصفح",
  "service-not-allowed": "التعرّف على الكلام غير متاح في هذا المتصفح",
  "audio-capture": "لا يوجد ميكروفون متصل",
  network: "التعرّف على الكلام يحتاج اتصالًا بالإنترنت",
};
export const sttErrorMessage = (code) => STT_ERRORS[code] || null;

// ===== التعرّف على الكلام =====
// إملاء في خانة الكتابة: يرجع {stop}
export function startDictation({ lang, onText, onEnd, onError }) {
  if (!SR) throw new Error("no-stt");
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += `${r[0].transcript} `;
      else interim += r[0].transcript;
    }
    onText?.((finalText + interim).trim());
  };
  rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") onError?.(e.error); };
  rec.onend = () => onEnd?.(finalText.trim());
  rec.start();
  return { stop: () => rec.stop() };
}

// جملة واحدة (وضع المكالمة): يرجع النص بعد أن يسكت المتكلم
export function listenOnce({ lang, cloud, onInterim, onLevel, signal }) {
  if (SR && !cloud) {
    return new Promise((resolve, reject) => {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      let interim = "";
      rec.onresult = (e) => {
        interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += `${r[0].transcript} `;
          else interim += r[0].transcript;
        }
        onInterim?.((finalText + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        reject(new Error(sttErrorMessage(e.error) || e.error));
      };
      rec.onend = () => resolve((finalText || interim).trim());
      signal?.addEventListener("abort", () => rec.abort());
      rec.start();
    });
  }
  return (async () => {
    const wav = await recordWav({ onLevel, signal });
    if (!wav || signal?.aborted) return "";
    onInterim?.("…");
    const { text } = await api("/voice/stt", { method: "POST", raw: wav, headers: { "Content-Type": "audio/wav" } });
    return text || "";
  })();
}

// ===== النطق =====
const MALE = /(naayf|hamed|shakir|maged|majed|tarik|tariq|fahed|hamdan|omar|moaz|bassel|rami|taim|laith|jamal|andrew|guy|david|\bmale\b)/i;
const FEMALE = /(hoda|zariyah|salma|laila|layla|mariam|amira|zeina|sana|fatima|noura|hala|rana|amany|reem|ava|aria|jenny|samantha|zira|female)/i;

function voicesReady() {
  const v = speechSynthesis.getVoices();
  if (v.length) return Promise.resolve(v);
  return new Promise((ok) => {
    const t = setTimeout(() => ok(speechSynthesis.getVoices()), 1500);
    speechSynthesis.addEventListener("voiceschanged", () => { clearTimeout(t); ok(speechSynthesis.getVoices()); }, { once: true });
  });
}

export async function deviceVoices(lang) {
  if (!hasBrowserTTS()) return [];
  const base = lang.split("-")[0];
  return (await voicesReady()).filter((v) => v.lang?.toLowerCase().startsWith(base));
}

async function pickVoice(lang, gender, preferredName) {
  const voices = await voicesReady();
  if (preferredName) {
    const v = voices.find((x) => x.name === preferredName);
    if (v) return { voice: v, pitch: 1 };
  }
  const base = lang.split("-")[0];
  const cands = voices.filter((v) => v.lang?.toLowerCase().startsWith(base));
  const exact = cands.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase());
  const pool = exact.length ? exact : cands;
  const re = gender === "female" ? FEMALE : MALE;
  const hit = pool.find((v) => re.test(v.name)) || cands.find((v) => re.test(v.name));
  if (hit) return { voice: hit, pitch: 1 };
  if (!pool.length) return null; // لا يوجد صوت لهذه اللغة إطلاقًا (مثل Chrome على ويندوز للعربية)
  // لا يوجد صوت بالجنس المطلوب على هذا الجهاز: نغيّر طبقة الصوت المتاح
  return { voice: pool[0], pitch: gender === "female" ? 1.2 : 0.8 };
}

// رسالة واضحة عندما لا يملك الجهاز صوتًا عربيًا
export const NO_VOICE_MESSAGE =
  "هذا الجهاز لا يحتوي على صوت عربي، لذلك لا يُقرأ الرد بصوت. على الكمبيوتر افتح الموقع من متصفح Microsoft Edge (فيه أصوات عربية رجل وامرأة مجانًا)، أو استخدم الجوال.";

// تحويل Markdown لنص يُقرأ بشكل طبيعي
export function speakable(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_~`>#]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, ".\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function chunkText(text, max) {
  const parts = text.split(/(?<=[.!?؟؛\n])\s+/);
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).length > max && cur) { out.push(cur.trim()); cur = p; }
    else cur = cur ? `${cur} ${p}` : p;
    while (cur.length > max * 1.6) {
      const cut = cur.lastIndexOf("،", max) > 40 ? cur.lastIndexOf("،", max) + 1 : max;
      out.push(cur.slice(0, cut).trim());
      cur = cur.slice(cut);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ملف WAV صامت قصير (يُولَّد محليًا) لفتح قفل الصوت على iOS
function silentWavUrl() {
  const n = 800;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
let SILENT = null;

export function createSpeaker() {
  const audio = new Audio();
  audio.preload = "auto";
  let token = 0;
  let cfg = { cloud: false, lang: "ar-SA", gender: "male", rate: 1, voiceName: "" };
  const keep = new Set();

  const playBlob = (blob, my) =>
    new Promise((resolve) => {
      if (my !== token) return resolve();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      const done = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });

  const say = (text, v, my) =>
    new Promise((resolve) => {
      if (my !== token) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = v.voice?.lang || cfg.lang;
      if (v.voice) u.voice = v.voice;
      u.pitch = v.pitch;
      u.rate = cfg.rate;
      // Chrome أحيانًا لا يطلق onend: مهلة أمان حسب طول النص
      const guard = setTimeout(resolve, 4000 + text.length * 120);
      const done = () => { clearTimeout(guard); resolve(); };
      u.onend = done;
      u.onerror = done;
      keep.add(u); // منع جمع القمامة للعبارة قبل انتهائها (خلل معروف في Chrome)
      u.addEventListener("end", () => keep.delete(u));
      speechSynthesis.speak(u);
    });

  const fetchTts = (text) =>
    api("/voice/tts", { method: "POST", body: { text } }).then((res) => res.blob());

  return {
    configure(next) { cfg = { ...cfg, ...next }; },
    // يُستدعى داخل ضغطة المستخدم حتى يسمح iOS بتشغيل الصوت لاحقًا
    unlock() {
      SILENT ||= silentWavUrl();
      audio.src = SILENT;
      audio.play().catch(() => {});
      if (hasBrowserTTS()) speechSynthesis.resume();
    },
    stop() {
      token++;
      audio.pause();
      if (hasBrowserTTS()) speechSynthesis.cancel();
    },
    // يرجع {ok:true} أو {ok:false, reason:"no-voice"|"no-tts"}
    async speak(md, { onStart } = {}) {
      this.stop();
      const my = ++token;
      const text = speakable(md);
      if (!text) return { ok: true };
      onStart?.();
      if (cfg.cloud) {
        try {
          const chunks = chunkText(text, 450);
          let next = fetchTts(chunks[0]);
          for (let i = 0; i < chunks.length && my === token; i++) {
            const blob = await next;
            if (i + 1 < chunks.length) next = fetchTts(chunks[i + 1]);
            await playBlob(blob, my);
          }
          return { ok: true };
        } catch {
          if (my !== token) return { ok: true }; // أُوقف
          // فشل الصوت السحابي: نكمل بصوت الجهاز
        }
      }
      if (!hasBrowserTTS()) return { ok: false, reason: "no-tts" };
      const v = await pickVoice(cfg.lang, cfg.gender, cfg.voiceName);
      if (!v) return { ok: false, reason: "no-voice" };
      for (const c of chunkText(text, 200)) {
        if (my !== token) break;
        await say(c, v, my);
      }
      return { ok: true };
    },
  };
}

export const speaker = createSpeaker();
