// «المكالمات»: تجهيز سند للرد على مكالماتك + سجل المكالمات وملخصاتها
import { useCallback, useEffect, useState } from "react";
import { useMe } from "../App.jsx";
import { api, fmtDate } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { Field, toast } from "./ui.jsx";
import { go } from "./Shell.jsx";

const fmtDur = (s) => (s >= 60 ? `${Math.floor(s / 60)} د ${s % 60} ث` : `${s} ث`);

function ForwardCodes({ number }) {
  const n = number || "+الرقم";
  const rows = [
    ["عند عدم الرد", `**61*${n}#`],
    ["عند الانشغال", `**67*${n}#`],
    ["عند إغلاق الجوال أو خارج التغطية", `**62*${n}#`],
    ["الثلاثة معًا", `**004*${n}#`],
    ["إلغاء كل التحويلات", "##004#"],
  ];
  return (
    <div className="codes">
      {rows.map(([label, code]) => (
        <div key={code} className="code-row">
          <span>{label}</span>
          <a dir="ltr" href={`tel:${encodeURIComponent(code)}`} className="code">{code}</a>
        </div>
      ))}
    </div>
  );
}

export default function Calls({ onMenu }) {
  const { me } = useMe();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tw, setTw] = useState({ phone: "", sid: "", token: "" });
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { setSt(await api("/assistant/phone")); } catch (err) { toast(err.message, "error"); setSt({ error: err.message }); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast(okMsg, "success");
      await load();
      return r;
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!st) return <div className="page"><div className="center-pad"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <h1>المكالمات</h1>
      </header>
      <div className="page-body">
        {st.error && <div className="banner banner-warn"><Icon name="alert" size={18} /> {st.error}</div>}
        {!st.eleven && !st.error && (
          <div className="banner banner-warn">
            <Icon name="key" size={18} /> الرد على المكالمات يحتاج مفتاح ElevenLabs — {me.user.isAdmin ? "أضفه من لوحة الإدارة ← الإعدادات." : "تواصل مع الإدارة."}
          </div>
        )}

        {st.eleven && (
          <section className="card">
            <h2><Icon name="phone" size={18} /> تجهيز سند للرد على مكالماتك</h2>
            <ol className="setup-steps">
              <li className={st.agentReady ? "done" : ""}>
                <div className="step-head">
                  <strong>١. تجهيز صوت سند وشخصيته</strong>
                  {st.agentReady && <span className="status-chip tone-ok">جاهز</span>}
                </div>
                <p className="muted small">
                  يرد بصوت مساعدك المختار، ويعرّف بنفسه كمساعدك، ويجيب فقط مما كتبته في «سند يعرفك»، ويأخذ اسم المتصل وطلبه.
                  حدّث المعلومات من <button className="link-btn" onClick={() => go("#/persona")}>سند يعرفك</button> وتتحدّث هنا تلقائيًا.
                </p>
                <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api("/assistant/phone/agent", { method: "POST" }), "تم تجهيز سند")}>
                  {st.agentReady ? "تحديث" : "تجهيز الآن"}
                </button>
              </li>

              <li className={st.number ? "done" : ""}>
                <div className="step-head">
                  <strong>٢. رقم يستقبل المكالمات (من تويليو)</strong>
                  {st.number && <span className="status-chip tone-ok" dir="ltr">{st.number}</span>}
                </div>
                {!st.number ? (
                  <>
                    <p className="muted small">
                      أنشئ حسابًا في <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer">تويليو</a> واشترِ رقمًا يدعم المكالمات الصوتية،
                      ثم انسخ من الصفحة الرئيسية لحسابك «معرّف الحساب» و«رمز المصادقة».
                    </p>
                    <div className="grid-3">
                      <Field label="رقم تويليو (دولي)"><input dir="ltr" placeholder="+12025550123" value={tw.phone} onChange={(e) => setTw({ ...tw, phone: e.target.value })} /></Field>
                      <Field label="معرّف الحساب (Account SID)"><input dir="ltr" placeholder="AC…" value={tw.sid} onChange={(e) => setTw({ ...tw, sid: e.target.value })} /></Field>
                      <Field label="رمز المصادقة (Auth Token)"><input dir="ltr" type="password" value={tw.token} onChange={(e) => setTw({ ...tw, token: e.target.value })} /></Field>
                    </div>
                    <div>
                      <button className="btn btn-primary" disabled={busy || !st.agentReady || !tw.phone || !tw.sid || !tw.token}
                        onClick={() => act(() => api("/assistant/phone/twilio", { method: "POST", body: tw }), "تم ربط الرقم").then(() => setTw({ phone: "", sid: "", token: "" }))}>
                        ربط الرقم
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted small">المكالمات الواردة لهذا الرقم يرد عليها سند الآن.</p>
                )}
              </li>

              <li className={st.number ? "" : "pending"}>
                <div className="step-head"><strong>٣. تحويل مكالمات جوالك إلى سند</strong></div>
                <p className="muted small">
                  من جوالك اطلب الرمز المناسب (مثل طلب رقم عادي) وانتظر رسالة التأكيد. الأشهر: «عند عدم الرد» و«عند الانشغال».
                  تنبيه: شركة الاتصالات قد تحتسب المكالمة المحوّلة لرقم دولي بسعر المكالمات الدولية.
                </p>
                <ForwardCodes number={st.number} />
              </li>
            </ol>
            {(st.agentReady || st.number) && (
              <button className="btn btn-ghost danger" disabled={busy}
                onClick={() => confirm("إيقاف الرد على المكالمات وحذف الرقم والوكيل من ElevenLabs؟ (ألغِ التحويل من جوالك أيضًا: ##004#)") && act(() => api("/assistant/phone", { method: "DELETE" }), "تم الإيقاف")}>
                إيقاف الرد على المكالمات
              </button>
            )}
          </section>
        )}

        <section className="card">
          <h2>سجل المكالمات</h2>
          {!st.calls?.length && <p className="muted small">لا توجد مكالمات بعد. كل مكالمة يرد عليها سند تظهر هنا ويصلك ملخصها على واتساب.</p>}
          <div className="call-list">
            {st.calls?.map((c) => (
              <article key={c.id} className={`call-card ${c.urgent ? "is-urgent" : ""}`}>
                <div className="call-card-head">
                  <div>
                    <strong>{c.callerName || c.from || "متصل"}</strong>
                    {c.callerName && c.from && <small className="muted" dir="ltr"> {c.from}</small>}
                  </div>
                  <span className="muted small">{fmtDate(c.ts)} · {fmtDur(c.duration)}</span>
                </div>
                <div className="call-tags">
                  {c.urgent && <span className="pill pill-bad">عاجل</span>}
                  {c.callback && <span className="pill">يريد معاودة الاتصال{c.callbackNumber ? `: ${c.callbackNumber}` : ""}</span>}
                </div>
                {c.reason && <p className="call-reason"><b>الطلب:</b> {c.reason}</p>}
                {c.summary && <p className="muted small">{c.summary}</p>}
                <div className="row-gap">
                  {c.from && <a className="btn btn-ghost sm" href={`tel:${c.callbackNumber || c.from}`}><Icon name="phone" size={14} /> اتصل به</a>}
                  <button className="btn btn-ghost sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "إخفاء النص" : "نص المكالمة"}</button>
                </div>
                {open === c.id && (
                  <ul className="fu-log">
                    {c.transcript.map((t, i) => (
                      <li key={i} className={t.role === "agent" ? "fu-out" : "fu-in"}>
                        <span className="muted small">{t.role === "agent" ? "سند" : "المتصل"}</span>
                        <div dir="auto">{t.text}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
