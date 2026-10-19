import { useCallback, useEffect, useRef, useState } from "react";
import { useMe } from "../App.jsx";
import { api, stream } from "../lib/api.js";
import { NO_VOICE_MESSAGE, speaker } from "../lib/speech.js";
import {
  canPickDirectory, canPickFolderInput, connectedFolder, disconnectFolder,
  loadFolderFromInput, onFolderChange, pickFolderWithApi, runFolderTools,
} from "../lib/folder.js";
import Icon from "./Icon.jsx";
import { AgentAvatar, toast } from "./ui.jsx";
import { AssistantMessage, UserMessage } from "./Message.jsx";
import Composer from "./Composer.jsx";
import VoiceCall from "./VoiceCall.jsx";

const SUGGESTIONS = {
  general: ["اكتب لي خطاب طلب إجازة رسمي", "رتّب أولويات مهامي لهذا الأسبوع", "اكتب إيميل متابعة لعميل لم يرد", "لخّص لي مستندًا في نقاط"],
  finance: ["احسب ضريبة القيمة المضافة في فاتورة 11,500 ريال شاملة الضريبة", "كيف أعمل موازنة شهرية للمصاريف؟", "حلّل لي ملف مبيعات Excel واستخرج أهم المؤشرات", "ما الفرق بين الزكاة وضريبة الدخل في السعودية؟"],
  hr: ["احسب مكافأة نهاية الخدمة لموظف راتبه 6000 ريال وخدمته 7 سنوات", "كم مدة الإجازة السنوية في نظام العمل السعودي؟", "اكتب خطاب إنذار أول بسبب التأخير المتكرر", "ما أحكام فترة التجربة في نظام العمل؟"],
  legal: ["راجع عقدًا واستخرج البنود الخطرة", "ما متطلبات نظام التجارة الإلكترونية للمتاجر؟", "اكتب بند سرّية لعقد توريد", "كيف أسجّل علامة تجارية في السعودية؟"],
  sales: ["اكتب 5 أفكار بوستات إنستغرام لعباية جديدة", "اكتب وصفًا جذابًا لعباية كريب سوداء لمتجر سلّة", "خطة عروض لموسم رمضان", "رد على عميل يطلب خصم جملة"],
  support: ["رد على عميلة تأخر طلبها 5 أيام", "اكتب سياسة استبدال واسترجاع مختصرة", "رد على شكوى مقاس غير مناسب", "رسالة شكر بعد الشراء"],
  operations: ["احسب تكلفة عباية من استهلاك القماش والخياطة", "كيف أحدد حد إعادة الطلب للأقمشة؟", "قارن شركات الشحن للطلبات الدولية", "خطة جرد شهري للمخزون"],
  it: ["الطابعة لا تطبع من الشبكة — ماذا أفعل؟", "معادلة Excel لجمع المبيعات حسب الشهر", "كيف أنشئ عرض سعر في أودو؟", "نصائح لحماية بريد الشركة"],
};

export default function Chat({ convId, onCreated, onChanged, onMenu }) {
  const { me, refresh } = useMe();
  const user = me.user;
  const agent = user.agent || {};
  const features = user.limits?.features || {};
  const lang = user.prefs?.speechLang || "ar-SA";

  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(Boolean(convId));
  const [model, setModel] = useState(me.defaultModel);
  const [live, setLive] = useState(null); // {text, status, tools}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speakingKey, setSpeakingKey] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(Boolean(user.prefs?.autoSpeak));
  const [callOpen, setCallOpen] = useState(false);
  const [folder, setFolder] = useState(connectedFolder());

  const idRef = useRef(convId);
  const createdRef = useRef(null);
  const busyRef = useRef(false);
  const listRef = useRef(null);
  const stickRef = useRef(true);
  const liveTextRef = useRef("");
  const rafRef = useRef(0);
  const folderInputRef = useRef(null);

  useEffect(() => onFolderChange(setFolder), []);

  const load = useCallback(async (id) => {
    const data = await api(`/conversations/${id}`);
    setConv(data);
    return data;
  }, []);

  useEffect(() => {
    // محادثة أنشأناها للتو هنا: حالتها عندنا بالفعل، وإعادة تحميلها تمسح رسالة المستخدم المعروضة أثناء البثّ
    if (!convId || createdRef.current === convId) return;
    setLoading(true);
    load(convId)
      .catch((err) => { setError(err.message); })
      .finally(() => setLoading(false));
  }, [convId, load]);

  // تمرير تلقائي للأسفل ما دام المستخدم في الأسفل
  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [conv, live, error]);

  useEffect(() => () => { speaker.stop(); cancelAnimationFrame(rafRef.current); }, []);

  const flushLive = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setLive((l) => (l ? { ...l, text: liveTextRef.current } : l)));
  };

  // يشغّل طلب بثّ ويتعامل مع أدوات الجهاز حتى ينتهي الرد. يرجع نص الرد.
  async function runTurn(id, path, body) {
    liveTextRef.current = "";
    setLive({ text: "", status: { kind: "thinking" }, tools: [] });
    let next = { path, body };
    let failure = "";
    while (next) {
      let calls = null;
      let needBreak = false;
      await stream(next.path, next.body, (ev, data) => {
        if (ev === "delta") {
          liveTextRef.current += data.text;
          flushLive();
        } else if (ev === "status") {
          // ما كُتب قبل استخدام أداة تمهيد؛ الجواب يبدأ بعد آخر أداة (مثل العرض المحفوظ)
          if (data.kind === "web_search" || data.kind === "tool") {
            liveTextRef.current = "";
            flushLive();
          }
          setLive((l) => l && { ...l, status: data });
        } else if (ev === "round") {
          if (liveTextRef.current && !liveTextRef.current.endsWith("\n")) liveTextRef.current += "\n\n";
        } else if (ev === "tool_request") {
          calls = data.calls;
        } else if (ev === "notice") {
          toast(data.message, "info");
        } else if (ev === "error") {
          failure = data.message;
          needBreak = true;
        }
      });
      if (calls && !needBreak) {
        liveTextRef.current = "";
        flushLive();
        const results = await runFolderTools(calls, (c) =>
          setLive((l) => l && { ...l, status: { kind: "tool", name: c.name, label: toolProgress(c) } }));
        next = { path: `/conversations/${id}/tool-results`, body: { results } };
      } else {
        next = null;
      }
    }
    return { text: liveTextRef.current, failure };
  }

  const toolProgress = (c) =>
    c.name === "read_folder_file" ? `يقرأ: ${c.input?.path || ""}` : c.name === "search_folder" ? `يبحث عن: ${c.input?.query || ""}` : "يتصفّح المجلد";

  async function ensureConv() {
    if (idRef.current) return idRef.current;
    const created = await api("/conversations", { method: "POST", body: { model } });
    idRef.current = created.id;
    createdRef.current = created.id;
    setConv(created);
    onCreated(created.id);
    return created.id;
  }

  // يرجع نص الرد (يستخدمه وضع المكالمة)
  async function send({ text, files = [], voice = false }) {
    if (busyRef.current) return "";
    busyRef.current = true;
    setError("");
    speaker.stop();
    setSpeakingKey(null);
    setBusy(true);
    stickRef.current = true;
    let reply = "";
    try {
      const id = await ensureConv();
      setConv((c) => c && { ...c, items: [...c.items, { role: "user", text, files, voice }] });
      const r = await runTurn(id, `/conversations/${id}/messages`, { text, files: files.map((f) => f.id), voice });
      reply = r.text;
      if (r.failure) setError(r.failure);
      await load(id).catch(() => {});
    } catch (err) {
      setError(err.message);
      if (idRef.current) await load(idRef.current).catch(() => {});
    } finally {
      setLive(null);
      busyRef.current = false;
      setBusy(false);
      onChanged?.();
      refresh();
    }
    if (reply && autoSpeak && !voice && features.voice !== false) {
      setSpeakingKey("last");
      speaker.speak(reply)
        .then((r) => { if (!r.ok) toast(voiceHelp(), "error"); })
        .finally(() => setSpeakingKey((k) => (k === "last" ? null : k)));
    }
    return reply;
  }

  const stop = () => {
    if (idRef.current) api(`/conversations/${idRef.current}/stop`, { method: "POST" }).catch(() => {});
  };

  const toggleAutoSpeak = async () => {
    const v = !autoSpeak;
    setAutoSpeak(v);
    if (v) {
      speaker.unlock();
      speaker.speak("تم تفعيل القراءة الصوتية.").then((r) => { if (!r.ok) toast(voiceHelp(), "error"); });
    } else speaker.stop();
    api("/auth/profile", { method: "PATCH", body: { prefs: { autoSpeak: v } } }).catch(() => {});
  };

  const voiceHelp = () => NO_VOICE_MESSAGE + (user.isAdmin ? " أو فعّل الصوت السحابي من لوحة الإدارة ← الإعدادات." : "");

  const speakItem = (key, text) => {
    speaker.unlock();
    setSpeakingKey(key);
    speaker.speak(text)
      .then((r) => { if (!r.ok) toast(voiceHelp(), "error"); })
      .finally(() => setSpeakingKey((k) => (k === key ? null : k)));
  };

  const connectFolder = async () => {
    try {
      if (canPickDirectory()) {
        const f = await pickFolderWithApi();
        toast(`رُبط المجلد «${f.name}» (${f.entries.size} عنصر)`, "success");
      } else {
        folderInputRef.current?.click();
      }
    } catch (err) {
      if (err.name !== "AbortError") toast("تعذّر فتح المجلد", "error");
    }
  };

  const items = conv?.items || [];
  const lastAssistantIdx = items.map((i) => i.role).lastIndexOf("assistant");
  const empty = !loading && !items.length && !live;
  const isNew = !idRef.current;
  const modelLabel = me.models.find((m) => m.id === (conv?.model || model))?.label;
  const folderAllowed = features.folder !== false && (conv ? conv.tools?.folder : true) && (canPickDirectory() || canPickFolderInput());

  const folderSlot = folderAllowed ? (
    <div className="folder-bar">
      {folder ? (
        <span className="folder-chip is-on">
          <Icon name="folder" size={15} /> مجلد مربوط: <strong>{folder.name}</strong> ({folder.entries.size})
          <button onClick={disconnectFolder} aria-label="فصل المجلد"><Icon name="x" size={13} /></button>
        </span>
      ) : (
        <button className="folder-chip" onClick={connectFolder} title="اسمح للمساعد بقراءة ملفات مجلد من جهازك (قراءة فقط)">
          <Icon name="folder" size={15} /> ربط مجلد من الجهاز
        </button>
      )}
      <input
        ref={folderInputRef}
        type="file"
        hidden
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          const f = loadFolderFromInput(e.target.files);
          if (f) toast(`رُبط المجلد «${f.name}» (${f.entries.size} عنصر)`, "success");
          e.target.value = "";
        }}
      />
    </div>
  ) : null;

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <AgentAvatar name={agent.name} gender={agent.gender} size={38} pulse={busy} />
        <div className="chat-head-meta">
          <strong>{agent.name}</strong>
          <small>{me.role.title}</small>
        </div>
        <div className="chat-head-actions">
          {isNew && me.models.length > 1 ? (
            <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)} aria-label="الموديل">
              {me.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          ) : (
            <span className="model-chip" title="الموديل ثابت لكل محادثة">{modelLabel}</span>
          )}
          {features.voice !== false && (
            <>
              <button
                className={`icon-btn ${autoSpeak ? "is-on" : ""}`}
                onClick={toggleAutoSpeak}
                aria-pressed={autoSpeak}
                aria-label="قراءة الردود تلقائيًا"
                title={autoSpeak ? "القراءة التلقائية مفعّلة" : "اقرأ الردود بصوت تلقائيًا"}
              >
                <Icon name={autoSpeak ? "speaker" : "mute"} />
              </button>
              <button
                className="icon-btn call-btn"
                onClick={() => { speaker.unlock(); setCallOpen(true); }}
                aria-label="مكالمة صوتية"
                title="تحدّث مع المساعد صوتيًا"
                disabled={busy}
              >
                <Icon name="phone" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="chat-scroll" ref={listRef} onScroll={onScroll}>
        <div className="chat-inner">
          {!me.org.hasKey && (
            <div className="banner banner-warn">
              <Icon name="key" size={18} /> لم تُضِف الإدارة مفتاح Claude بعد — {user.isAdmin ? "أضفه من لوحة الإدارة ← الإعدادات." : "تواصل مع الإدارة."}
            </div>
          )}
          {loading && <div className="center-pad"><div className="spinner" /></div>}

          {empty && (
            <div className="welcome">
              <AgentAvatar name={agent.name} gender={agent.gender} size={84} />
              <h1>
                أهلًا {user.displayName.split(" ")[0]}، أنا {agent.name}
              </h1>
              <p className="muted">{me.role.title} — {me.role.summary}</p>
              <div className="suggestions">
                {(SUGGESTIONS[user.agent?.role] || SUGGESTIONS.general).map((s) => (
                  <button key={s} className="suggestion" onClick={() => send({ text: s })} disabled={busy || !me.org.hasKey}>
                    {s}
                  </button>
                ))}
              </div>
              <ul className="welcome-tips">
                {features.files !== false && <li><Icon name="clip" size={15} /> أرفق PDF أو Word أو Excel أو صورة واسألني عنها</li>}
                {features.voice !== false && <li><Icon name="phone" size={15} /> اضغط زر المكالمة لتتحدث معي صوتيًا</li>}
                {folderAllowed && <li><Icon name="folder" size={15} /> اربط مجلدًا من جهازك لأقرأ ملفاته</li>}
              </ul>
            </div>
          )}

          {items.map((it, i) =>
            it.role === "user" ? (
              <UserMessage key={i} item={it} />
            ) : (
              <AssistantMessage
                key={i}
                item={it}
                agent={agent}
                canSpeak={features.voice !== false}
                speaking={speakingKey === i || (speakingKey === "last" && i === lastAssistantIdx)}
                onSpeak={() => speakItem(i, it.text)}
                onStopSpeak={() => { speaker.stop(); setSpeakingKey(null); }}
              />
            ),
          )}
          {live && <AssistantMessage item={{ text: live.text, tools: [] }} agent={agent} live={live} />}
          {error && !live && <AssistantMessage item={{ text: "", error }} agent={agent} />}
        </div>
      </div>

      <Composer
        busy={busy}
        onSend={send}
        onStop={stop}
        features={features}
        cloudVoice={me.org.cloudVoice}
        lang={lang}
        agentName={agent.name}
        folderSlot={folderSlot}
      />

      {callOpen && (
        <VoiceCall
          agent={agent}
          lang={lang}
          cloudVoice={me.org.cloudVoice}
          liveText={live?.text || ""}
          liveStatus={live?.status}
          voiceHelp={voiceHelp()}
          userName={user.displayName.split(" ")[0]}
          onSend={(text) => send({ text, voice: true })}
          onClose={() => { speaker.stop(); setCallOpen(false); }}
        />
      )}
    </div>
  );
}
