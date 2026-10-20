// وضع المكالمة: تحيّة ← استماع ← تفكير ← تحدّث ← استماع… بلا لمس.
// اضغط الدائرة أثناء حديث المساعد لمقاطعته والتحدث مباشرة.
// إن لم يكن على الجهاز صوت عربي، يكمل المساعد ردوده كتابةً على نفس الشاشة.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { AgentAvatar } from "./ui.jsx";
import { canRecord, hasBrowserSTT, listenOnce, speakable, speaker } from "../lib/speech.js";
import { statusLabel } from "./Message.jsx";

// تقسيم النص لجمل؛ الجملة الأخيرة قد تكون ناقصة أثناء البثّ
function completeSentences(text, final) {
  const parts = text.split(/(?<=[.!?؟؛\n])\s+/).filter((x) => x.trim());
  return final || /[.!?؟؛\n]\s*$/.test(text) ? parts : parts.slice(0, -1);
}

const LABEL = {
  starting: "جارٍ التجهيز…",
  greeting: "",
  listening: "أستمع إليك… تكلّم الآن",
  thinking: "لحظة…",
  speaking: "اضغط الدائرة للمقاطعة",
  paused: "متوقف مؤقتًا — اضغط الدائرة للمتابعة",
  error: "",
};

export default function VoiceCall({ agent, lang, cloudVoice, liveText, liveStatus, onSend, onClose, voiceHelp, userName }) {
  const [state, setState] = useState("starting");
  const [heard, setHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [noVoice, setNoVoice] = useState(false);
  const openRef = useRef(true);
  const pausedRef = useRef(false);
  const listenCtrl = useRef(null);
  const sendRef = useRef(onSend);
  const wakeRef = useRef(null);
  const streamRef = useRef(null); // بثّ صوتي للرد الجاري
  const spokenRef = useRef(0); // عدد الجمل التي أُرسلت للنطق
  const stateRef = useRef("starting");
  sendRef.current = onSend;
  stateRef.current = state;

  // أثناء كتابة الرد: انطق كل جملة تكتمل فورًا (لا ننتظر نهاية الرد)
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const done = completeSentences(speakable(liveText), false);
    if (done.length < spokenRef.current) spokenRef.current = 0; // بدأ نص جديد (بعد أداة مثلًا)
    const fresh = done.slice(spokenRef.current);
    if (!fresh.length) return;
    fresh.forEach((x) => stream.push(x));
    spokenRef.current = done.length;
    if (stateRef.current === "thinking") setState("speaking");
  }, [liveText]);

  const sttAvailable = hasBrowserSTT() || (cloudVoice && canRecord());
  const waitForWake = () => new Promise((ok) => { wakeRef.current = ok; });

  useEffect(() => {
    openRef.current = true;
    let silentRounds = 0;
    let wakeLock = null;
    navigator.wakeLock?.request("screen").then((l) => { wakeLock = l; }).catch(() => {});

    const say = async (text) => {
      setState("speaking");
      const r = await speaker.speak(text);
      if (!r.ok) setNoVoice(true);
    };

    (async () => {
      if (!sttAvailable) {
        setError("هذا المتصفح لا يدعم التحدث بالصوت — استخدم Chrome أو Edge أو Safari.");
        setState("error");
        return;
      }
      // تحيّة قصيرة (بلا تكلفة) — تؤكد للمستخدم أن الصوت يعمل
      const greeting = `أهلًا ${userName || ""}، أنا ${agent.name}. تفضّل، أنا أسمعك.`;
      setLastReply(greeting);
      await say(greeting);

      while (openRef.current) {
        if (pausedRef.current) {
          setState("paused");
          await waitForWake();
          continue;
        }
        setState("listening");
        setHeard("");
        let text = "";
        try {
          listenCtrl.current = new AbortController();
          text = await listenOnce({
            lang,
            cloud: !hasBrowserSTT() && cloudVoice,
            onInterim: setHeard,
            onLevel: (v) => setLevel(Math.min(1, v * 8)),
            signal: listenCtrl.current.signal,
          });
        } catch (err) {
          if (!openRef.current) break;
          setError(err.message || "تعذّر الوصول للميكروفون");
          setState("error");
          pausedRef.current = true;
          continue;
        }
        setLevel(0);
        if (!openRef.current) break;
        if (!text) {
          silentRounds += 1;
          if (silentRounds >= 3) pausedRef.current = true; // لا أحد يتكلم
          continue;
        }
        silentRounds = 0;
        setHeard(text);
        setState("thinking");
        const stream = speaker.beginStream();
        streamRef.current = stream;
        spokenRef.current = 0;
        const reply = await sendRef.current(text);
        streamRef.current = null;
        if (!openRef.current) break;
        if (reply) {
          setLastReply(reply);
          const all = completeSentences(speakable(reply), true);
          all.slice(spokenRef.current).forEach((x) => stream.push(x));
          setState("speaking");
          const r = await stream.end();
          if (!r.ok) setNoVoice(true);
        }
      }
    })();

    return () => {
      openRef.current = false;
      listenCtrl.current?.abort();
      speaker.stop();
      wakeRef.current?.();
      wakeLock?.release?.().catch(() => {});
    };
  }, [lang, cloudVoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapOrb = () => {
    speaker.unlock();
    if (state === "speaking") {
      speaker.stop(); // يعود للاستماع
    } else if (state === "paused" || state === "error") {
      if (!sttAvailable) return;
      setError("");
      pausedRef.current = false;
      wakeRef.current?.();
    } else if (state === "listening") {
      pausedRef.current = true;
      listenCtrl.current?.abort();
    }
  };

  // ماذا نعرض تحت الدائرة: كلام المستخدم أثناء الاستماع، والرد أثناء التفكير/الحديث
  let shown = heard;
  if (state === "thinking") shown = speakable(liveText).slice(-320) || heard;
  else if (state === "speaking") shown = speakable(lastReply).slice(0, 600);
  else if (state === "listening" && !heard && noVoice) shown = speakable(lastReply).slice(0, 600);
  const sub = state === "thinking" && liveStatus ? statusLabel(liveStatus) : LABEL[state];

  return (
    <div className="call" role="dialog" aria-modal="true" aria-label={`مكالمة مع ${agent.name}`}>
      <div className="call-top">
        <span className="call-name">{agent.name}</span>
        <span className="call-sub">مكالمة صوتية</span>
      </div>

      {noVoice && (
        <div className="call-warn" role="alert">
          <Icon name="alert" size={18} /> {voiceHelp} — الردود تظهر مكتوبة هنا.
        </div>
      )}

      <button className={`call-orb state-${state}`} onClick={tapOrb} aria-label={LABEL[state] || "متابعة"}>
        <span className="orb-ring" style={{ transform: `scale(${1 + level * 0.35})` }} />
        <AgentAvatar name={agent.name} gender={agent.gender} size={132} />
      </button>

      <div className="call-state">{error || sub}</div>
      <div className={`call-text ${noVoice ? "is-long" : ""}`} dir="auto">{shown}</div>

      <div className="call-actions">
        <button
          className="call-ctl"
          onClick={() => {
            pausedRef.current = !pausedRef.current;
            if (pausedRef.current) { listenCtrl.current?.abort(); speaker.stop(); } else wakeRef.current?.();
          }}
          aria-label={state === "paused" ? "متابعة" : "إيقاف مؤقت"}
        >
          <Icon name={state === "paused" ? "mic" : "mute"} size={24} />
        </button>
        <button className="call-ctl call-end" onClick={onClose} aria-label="إنهاء المكالمة">
          <Icon name="x" size={28} />
        </button>
      </div>
    </div>
  );
}
