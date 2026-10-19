// وضع المكالمة: تحيّة ← استماع ← تفكير ← تحدّث ← استماع… بلا لمس.
// اضغط الدائرة أثناء حديث المساعد لمقاطعته والتحدث مباشرة.
// إن لم يكن على الجهاز صوت عربي، يكمل المساعد ردوده كتابةً على نفس الشاشة.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { AgentAvatar } from "./ui.jsx";
import { canRecord, hasBrowserSTT, listenOnce, speakable, speaker } from "../lib/speech.js";
import { statusLabel } from "./Message.jsx";

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
  sendRef.current = onSend;

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
        const reply = await sendRef.current(text);
        if (!openRef.current) break;
        if (reply) {
          setLastReply(reply);
          await say(reply);
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
