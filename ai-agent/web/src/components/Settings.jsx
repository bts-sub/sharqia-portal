import { useEffect, useState } from "react";
import { useMe } from "../App.jsx";
import { api, fmtBytes, fmtUsd } from "../lib/api.js";
import { deviceVoices, NO_VOICE_MESSAGE, speaker } from "../lib/speech.js";
import Icon from "./Icon.jsx";
import { AgentAvatar, Field, Meter, Switch, toast } from "./ui.jsx";
import { PasswordForm } from "./ChangePassword.jsx";
import Connections from "./Connections.jsx";
import SecurityPanel from "./SecurityPanel.jsx";

const DIALECTS = [
  { id: "ar-SA", label: "العربية — سعودي" },
  { id: "ar-EG", label: "العربية — مصري" },
  { id: "en-US", label: "English" },
];

export default function Settings({ onMenu }) {
  const { me, setMe } = useMe();
  const u = me.user;
  const canCustomize = u.limits?.allowCustomize !== false;
  const voiceOn = u.limits?.features?.voice !== false;

  const [agentName, setAgentName] = useState(u.agent?.name || "");
  const [gender, setGender] = useState(u.agent?.gender || "male");
  const [speechLang, setSpeechLang] = useState(u.prefs?.speechLang || "ar-SA");
  const [voiceRate, setVoiceRate] = useState(u.prefs?.voiceRate || 1);
  const [browserVoice, setBrowserVoice] = useState(u.prefs?.browserVoice || "");
  const [autoSpeak, setAutoSpeak] = useState(Boolean(u.prefs?.autoSpeak));
  const [notes, setNotes] = useState(u.prefs?.personalNotes || "");
  const [voices, setVoices] = useState(null); // null = لم تُحمّل بعد
  const [elVoices, setElVoices] = useState([]);
  const [elevenVoice, setElevenVoice] = useState(u.prefs?.elevenVoice || "");
  useEffect(() => {
    if (me.org.eleven && voiceOn) api("/voice/voices").then((r) => { setElVoices(r.voices); if (!u.prefs?.elevenVoice && r.current) setElevenVoice(r.current); }).catch(() => {});
  }, [me.org.eleven]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me.org.cloudVoice) deviceVoices(speechLang).then(setVoices);
  }, [speechLang, me.org.cloudVoice]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api("/auth/profile", {
        method: "PATCH",
        body: {
          agent: canCustomize ? { name: agentName, gender } : undefined,
          prefs: { speechLang, voiceRate, browserVoice, autoSpeak, personalNotes: notes, ...(me.org.eleven ? { elevenVoice } : {}) },
        },
      });
      setMe(data);
      toast("تم الحفظ — التغييرات تسري على المحادثات الجديدة", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    speaker.unlock();
    speaker.configure({ gender, lang: speechLang, rate: voiceRate, voiceName: browserVoice, cloud: me.org.cloudVoice, voiceId: me.org.eleven ? elevenVoice : "" });
    speaker
      .speak(speechLang === "en-US" ? `Hello, I'm ${agentName}. How can I help you today?` : `أهلًا، أنا ${agentName}. كيف أقدر أساعدك اليوم؟`)
      .then((r) => { if (!r.ok) toast(NO_VOICE_MESSAGE, "error"); });
  };

  const limit = u.limits?.monthlyUsd || 0;
  const storageMax = (u.limits?.storageMb || 300) * 1048576;

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <h1>الإعدادات</h1>
      </header>
      <div className="page-body">
        <section className="card">
          <h2>مساعدك</h2>
          <div className="agent-preview">
            <AgentAvatar name={agentName} gender={gender} size={56} />
            <div>
              <strong>{agentName || "—"}</strong>
              <small className="muted">{me.role.title}</small>
            </div>
          </div>
          <div className="grid-2">
            <Field label="اسم المساعد" hint={canCustomize ? "" : "الإدارة حدّدت اسم المساعد"}>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={30} disabled={!canCustomize} />
            </Field>
            <Field label="صوت المساعد">
              <div className="seg">
                <button type="button" className={gender === "male" ? "is-on" : ""} onClick={() => setGender("male")} disabled={!canCustomize}>رجل</button>
                <button type="button" className={gender === "female" ? "is-on" : ""} onClick={() => setGender("female")} disabled={!canCustomize}>امرأة</button>
              </div>
            </Field>
          </div>
          <Field label="معلومات عنك يعرفها المساعد" hint="مثلًا: قسمك، طبيعة عملك، الأسلوب الذي تفضّله في الردود. تسري على المحادثات الجديدة.">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
        </section>

        {voiceOn && (
          <section className="card">
            <h2>الصوت</h2>
            <div className="grid-2">
              <Field label="لغة/لهجة الكلام">
                <select value={speechLang} onChange={(e) => { setSpeechLang(e.target.value); setBrowserVoice(""); }}>
                  {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </Field>
              <Field label={`سرعة الصوت: ${voiceRate.toFixed(1)}×`}>
                <input type="range" min="0.7" max="1.4" step="0.1" value={voiceRate} onChange={(e) => setVoiceRate(+e.target.value)} />
              </Field>
            </div>
            {!me.org.cloudVoice && (
              <Field label="صوت الجهاز" hint="الأصوات المتاحة تختلف من جهاز لآخر. «تلقائي» يختار صوتًا يناسب جنس المساعد.">
                <select value={browserVoice} onChange={(e) => setBrowserVoice(e.target.value)}>
                  <option value="">تلقائي</option>
                  {(voices || []).map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </Field>
            )}
            {!me.org.cloudVoice && voices && voices.length === 0 && (
              <div className="banner banner-warn"><Icon name="alert" size={18} /> {NO_VOICE_MESSAGE}</div>
            )}
            {me.org.eleven && (
              <Field label="صوت مساعدك (ElevenLabs)" hint="اختر صوتًا ثم اضغط «جرّب الصوت». الأصوات العربية تعطي أفضل نطق.">
                <select value={elevenVoice} onChange={(e) => setElevenVoice(e.target.value)}>
                  <option value="">افتراضي المنظّمة</option>
                  {elVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.gender ? ` · ${v.gender === "male" ? "رجل" : v.gender === "female" ? "امرأة" : v.gender}` : ""}{v.accent ? ` · ${v.accent}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {me.org.cloudVoice && !me.org.eleven && <p className="muted small">يُستخدم الصوت السحابي عالي الجودة (رجل/امرأة) الذي فعّلته الإدارة.</p>}
            <Switch checked={autoSpeak} onChange={setAutoSpeak} label="اقرأ الردود بصوت تلقائيًا" />
            <button className="btn btn-ghost" onClick={preview}><Icon name="play" size={16} /> جرّب الصوت</button>
          </section>
        )}

        <div className="save-row">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
        </div>

        <Connections />

        <section className="card">
          <h2>استهلاكك</h2>
          <div className="kv"><span>هذا الشهر</span><strong dir="ltr">{fmtUsd(me.usage.month.usd)}{limit ? ` / ${fmtUsd(limit)}` : " (بلا حد)"}</strong></div>
          {limit > 0 && <Meter value={me.usage.month.usd} max={limit} />}
          <div className="kv"><span>رسائل هذا الشهر</span><strong>{me.usage.month.messages}</strong></div>
          {u.limits?.dailyMessages > 0 && <div className="kv"><span>رسائل اليوم</span><strong>{me.usage.todayMessages} / {u.limits.dailyMessages}</strong></div>}
          <div className="kv"><span>المساحة المستخدمة</span><strong dir="ltr">{fmtBytes(me.storageBytes)} / {fmtBytes(storageMax)}</strong></div>
          <Meter value={me.storageBytes} max={storageMax} />
        </section>

        <SecurityPanel />

        <section className="card">
          <h2>كلمة المرور</h2>
          <p className="muted small">
            <Icon name="lock" size={14} /> كلمة مرورك هي مفتاح تشفير محادثاتك وملفاتك. تغييرها من هنا يحافظ على بياناتك.
            إن نسيتها، الإدارة تقدر تعيد تعيينها لكن المحادثات القديمة تُمسح (لأن لا أحد غيرك يملك مفتاحها).
          </p>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
