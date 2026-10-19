// وضع المكالمة: استماع ← تفكير ← تحدّث ← استماع… بلا لمس.
// اضغط الدائرة أثناء حديث المساعد لمقاطعته والتحدث مباشرة.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { AgentAvatar } from "./ui.jsx";
import { hasBrowserSTT, listenOnce, speakable, speaker } from "../lib/speech.js";
import { statusLabel } from "./Message.jsx";

const LABEL = {
  starting: "جارٍ التجهيز…",
  listening: "أستمع إليك…",
  thinking: "لحظة…",
  speaking: "اضغط للمقاطعة",
  paused: "متوقف مؤقتًا — اضغط للمتابعة",
  error: "",
};

export default function VoiceCall({ agent, lang, cloudVoice, liveText, liveStatus, onSend, onClose }) {
  const [state, setState] = useState("starting");
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const openRef = useRef(true);
  const pausedRef = useRef(false);
  const listenCtrl = useRef(null);
  const sendRef = useRef(onSend);
  const wakeRef = useRef(null);
  sendRef.current = onSend;

  const waitForWake = () => new Promise((ok) => { wakeRef.current = ok; });

  useEffect(() => {
    openRef.current = true;
    let silentRounds = 0;
    let wakeLock = null;
    navigator.wakeLock?.request("screen").then((l) => { wakeLock = l; }).catch(() => {});

    (async () => {
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
          setState("speaking");
          await speaker.speak(reply);
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
  }, [lang, cloudVoice]);

  const tapOrb = () => {
    speaker.unlock();
    if (state === "speaking") {
      speaker.stop(); // يعود للاستماع
    } else if (state === "paused" || state === "error") {
      setError("");
      pausedRef.current = false;
      wakeRef.current?.();
    } else if (state === "listening") {
      pausedRef.current = true;
      listenCtrl.current?.abort();
    }
  };

  const shown = state === "thinking" || state === "speaking" ? speakable(liveText).slice(-280) : heard;
  const sub = state === "thinking" && liveStatus ? statusLabel(liveStatus) : LABEL[state];

  return (
    <div className="call" role="dialog" aria-modal="true" aria-label={`مكالمة مع ${agent.name}`}>
      <div className="call-top">
        <span className="call-name">{agent.name}</span>
        <span className="call-sub">مكالمة صوتية</span>
      </div>

      <button className={`call-orb state-${state}`} onClick={tapOrb} aria-label={LABEL[state] || "متابعة"}>
        <span className="orb-ring" style={{ transform: `scale(${1 + level * 0.35})` }} />
        <AgentAvatar name={agent.name} gender={agent.gender} size={132} />
      </button>

      <div className="call-state">{error || sub}</div>
      <div className="call-text" dir="auto">{shown}</div>

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
