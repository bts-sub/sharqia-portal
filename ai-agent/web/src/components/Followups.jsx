// صفحة المتابعات: ما يتابعه المساعد نيابةً عنك على واتساب
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { toast } from "./ui.jsx";
import { go } from "./Shell.jsx";

const TONE = { active: "wait", done: "ok", needs_user: "warn", paused: "off", stopped: "off", expired: "off", replaced: "off" };

export default function Followups({ onMenu }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { setList((await api("/connectors/followups")).followups); } catch (err) { toast(err.message, "error"); setList([]); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const stop = async (f) => {
    if (!confirm(`إيقاف متابعة ${f.name}؟`)) return;
    try { setList((await api(`/connectors/followups/${f.id}/stop`, { method: "POST" })).followups); } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <h1>المتابعات</h1>
      </header>
      <div className="page-body">
        <div className="banner banner-info">
          <Icon name="sparkle" size={18} />
          قل لمساعدك في المحادثة: «تابع مع فلان بخصوص كذا». يرسل أول رسالة، ويرد تلقائيًا كلما رد عليك، ويرسل لك التقرير على
          واتساب (محادثتك مع نفسك). إذا رددت أنت بنفسك في نفس المحادثة يتوقف ويترك لك الحديث.
        </div>
        {!list && <div className="center-pad"><div className="spinner" /></div>}
        {list && !list.length && (
          <div className="empty">
            <p className="muted">لا توجد متابعات بعد.</p>
            <button className="btn btn-primary" onClick={() => go("")}>ابدأ محادثة</button>
          </div>
        )}
        <div className="fu-list">
          {list?.map((f) => (
            <article key={f.id} className="fu-card">
              <div className="fu-head">
                <strong>{f.name}</strong>
                <span className={`status-chip tone-${TONE[f.status] || "off"}`}>{f.statusText}</span>
              </div>
              <p className="fu-goal">{f.goal}</p>
              {f.report && <p className="fu-report"><Icon name="sparkle" size={14} /> {f.report}</p>}
              <div className="fu-meta muted small">
                <span>رسائل المساعد: {f.sent}/{f.maxMessages}</span>
                <span>آخر تحديث: {fmtDate(f.updatedAt)}</span>
              </div>
              <div className="row-gap">
                <button className="btn btn-ghost sm" onClick={() => setOpen(open === f.id ? null : f.id)}>
                  {open === f.id ? "إخفاء السجل" : "سجل الرسائل"}
                </button>
                {f.status === "active" && <button className="btn btn-ghost sm danger" onClick={() => stop(f)}>إيقاف</button>}
              </div>
              {open === f.id && (
                <ul className="fu-log">
                  {f.log.map((l, i) => (
                    <li key={i} className={`fu-${l.dir}`}>
                      <span className="muted small">{l.dir === "out" ? "المساعد" : f.name} · {fmtDate(new Date(l.ts).toISOString())}</span>
                      <div dir="auto">{l.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
