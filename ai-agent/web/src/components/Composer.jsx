import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { toast } from "./ui.jsx";
import { ACCEPT, prepareFile, uploadPrepared } from "../lib/files.js";
import { api } from "../lib/api.js";
import { canRecord, hasBrowserSTT, startDictation, sttErrorMessage } from "../lib/speech.js";
import { recordWav } from "../lib/wav.js";

const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function Composer({ busy, onSend, onStop, features, cloudVoice, lang, agentName, folderSlot }) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState([]); // {key, name, kind, status, id, error}
  const [dictating, setDictating] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const dictRef = useRef(null);
  const baseTextRef = useRef("");

  // ارتفاع تلقائي
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const uploading = atts.some((a) => a.status === "uploading");
  const ready = atts.filter((a) => a.status === "ready");
  const canSend = !busy && !uploading && (text.trim() || ready.length);

  const pickFiles = async (fileList) => {
    const files = [...fileList].slice(0, 10 - atts.length);
    for (const file of files) {
      const key = `${file.name}-${Math.random()}`;
      setAtts((xs) => [...xs, { key, name: file.name, status: "uploading" }]);
      try {
        const prepared = await prepareFile(file);
        const up = await uploadPrepared(prepared);
        setAtts((xs) => xs.map((a) => (a.key === key ? { ...a, status: "ready", id: up.id, kind: up.kind } : a)));
      } catch (err) {
        setAtts((xs) => xs.filter((a) => a.key !== key));
        toast(err.message, "error");
      }
    }
  };

  const submit = () => {
    if (!canSend) return;
    stopDictation();
    const files = ready.map((a) => ({ id: a.id, name: a.name, kind: a.kind }));
    onSend({ text: text.trim(), files });
    setText("");
    setAtts([]);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // ===== الإملاء الصوتي =====
  function stopDictation() {
    dictRef.current?.stop();
    dictRef.current = null;
    setDictating(false);
  }

  const toggleDictation = async () => {
    if (dictating) return stopDictation();
    if (hasBrowserSTT()) {
      baseTextRef.current = text ? `${text.trim()} ` : "";
      try {
        dictRef.current = startDictation({
          lang,
          onText: (t) => setText(baseTextRef.current + t),
          onEnd: () => { dictRef.current = null; setDictating(false); },
          onError: (code) => toast(sttErrorMessage(code) || "تعذّر التعرّف على الكلام", "error"),
        });
        setDictating(true);
      } catch {
        toast("التعرّف على الكلام غير متاح هنا", "error");
      }
      return;
    }
    if (cloudVoice && canRecord()) {
      const ctrl = new AbortController();
      dictRef.current = { stop: () => ctrl.abort() };
      setDictating(true);
      try {
        const wav = await recordWav({ signal: ctrl.signal, silenceMs: 2500, maxMs: 55000 });
        if (wav) {
          const { text: t } = await api("/voice/stt", { method: "POST", raw: wav, headers: { "Content-Type": "audio/wav" } });
          if (t) setText((cur) => (cur ? `${cur.trim()} ${t}` : t));
        }
      } catch (err) {
        toast(err.name === "NotAllowedError" ? "لم يُسمح بالوصول للميكروفون" : err.message, "error");
      } finally {
        dictRef.current = null;
        setDictating(false);
      }
      return;
    }
    toast("متصفحك لا يدعم الإملاء الصوتي — جرّب Chrome أو Safari", "error");
  };

  useEffect(() => () => dictRef.current?.stop(), []);

  const micAvailable = features.voice !== false && (hasBrowserSTT() || (cloudVoice && canRecord()));

  return (
    <div className="composer-wrap">
      {folderSlot}
      <div
        className={`composer ${dictating ? "is-dictating" : ""}`}
        onDragOver={(e) => features.files !== false && e.preventDefault()}
        onDrop={(e) => {
          if (features.files === false) return;
          e.preventDefault();
          if (e.dataTransfer.files?.length) pickFiles(e.dataTransfer.files);
        }}
      >
        {atts.length > 0 && (
          <div className="att-row">
            {atts.map((a) => (
              <span key={a.key} className={`att ${a.status === "uploading" ? "is-loading" : ""}`}>
                <Icon name="file" size={14} />
                <span className="att-name">{a.name}</span>
                {a.status === "uploading" ? (
                  <span className="mini-spin" aria-label="جارٍ الرفع" />
                ) : (
                  <button onClick={() => setAtts((xs) => xs.filter((x) => x.key !== a.key))} aria-label={`إزالة ${a.name}`}>
                    <Icon name="x" size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <div className="composer-row">
          {features.files !== false && (
            <>
              <button className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="إرفاق ملف" title="إرفاق ملف (PDF، Word، Excel، صور)">
                <Icon name="clip" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT}
                hidden
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
              />
            </>
          )}
          <textarea
            ref={taRef}
            rows={1}
            dir="auto"
            value={text}
            placeholder={dictating ? "أتكلّم… سيظهر كلامك هنا" : `اكتب رسالتك إلى ${agentName}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              if (features.files !== false && e.clipboardData.files?.length) {
                e.preventDefault();
                pickFiles(e.clipboardData.files);
              }
            }}
            aria-label="الرسالة"
          />
          {micAvailable && (
            <button
              className={`icon-btn ${dictating ? "is-recording" : ""}`}
              onClick={toggleDictation}
              aria-label={dictating ? "إيقاف الإملاء" : "إملاء صوتي"}
              title={dictating ? "إيقاف" : "تكلّم بدل الكتابة"}
            >
              <Icon name="mic" />
            </button>
          )}
          {busy ? (
            <button className="send-btn is-stop" onClick={onStop} aria-label="إيقاف الرد"><Icon name="stop" size={18} /></button>
          ) : (
            <button className="send-btn" onClick={submit} disabled={!canSend} aria-label="إرسال"><Icon name="send" size={18} /></button>
          )}
        </div>
      </div>
      <p className="composer-note">قد يخطئ المساعد — راجِع القرارات المهمة. بياناتك مشفّرة ولا يطّلع عليها غيرك.</p>
    </div>
  );
}
