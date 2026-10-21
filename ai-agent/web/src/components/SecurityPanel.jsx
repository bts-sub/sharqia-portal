// قسم الأمان في الإعدادات: التحقق بخطوتين، الجلسات، ونشاط الحساب
import { useEffect, useState } from "react";
import { useMe } from "../App.jsx";
import { api, fmtDate } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { Field, Modal, toast } from "./ui.jsx";
import { RecoveryCodes } from "./TwoFactorSetup.jsx";

export default function SecurityPanel() {
  const { me, refresh } = useMe();
  const u = me.user;
  const [activity, setActivity] = useState(null);
  const [regen, setRegen] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/activity").then(setActivity).catch(() => setActivity({ security: [], actions: [] }));
  }, []);

  const logoutAll = async () => {
    if (!confirm("تسجيل الخروج من كل الأجهزة الأخرى؟ (يبقى هذا الجهاز)")) return;
    try {
      await api("/auth/logout-all", { method: "POST" });
      toast("تم تسجيل الخروج من كل الأجهزة الأخرى", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const doRegen = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/auth/2fa/recovery", { method: "POST", body: { code } });
      setCodes(r.recoveryCodes);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const items = activity
    ? [
        ...activity.security.map((e) => ({ ts: e.ts, text: e.label, sub: [e.device, e.ip].filter(Boolean).join(" · "), bad: /failed|locked/.test(e.event) })),
        ...activity.actions.map((a) => ({ ts: a.ts, text: a.detail, sub: "بواسطة المساعد", agent: true })),
      ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 30)
    : [];

  return (
    <section className="card">
      <h2><Icon name="shield" size={18} /> الأمان</h2>
      <div className="kv">
        <span>التحقق بخطوتين</span>
        <strong className="ok-text">مفعّل ✓</strong>
      </div>
      <div className="kv">
        <span>رموز الاسترداد المتبقية</span>
        <strong>{u.recoveryLeft}</strong>
      </div>
      <div className="row-gap">
        <button className="btn btn-ghost" onClick={() => { setRegen(true); setCodes(null); setCode(""); }}>رموز استرداد جديدة</button>
        <button className="btn btn-ghost" onClick={logoutAll}><Icon name="logout" size={16} /> خروج من كل الأجهزة الأخرى</button>
      </div>

      <h3 className="form-section">آخر النشاط على حسابك</h3>
      {!activity && <div className="spinner" />}
      {activity && !items.length && <p className="muted small">لا يوجد نشاط مسجّل بعد.</p>}
      <ul className="activity">
        {items.map((it, i) => (
          <li key={i} className={it.bad ? "is-bad" : it.agent ? "is-agent" : ""}>
            <Icon name={it.bad ? "alert" : it.agent ? "sparkle" : "lock"} size={15} />
            <div>
              <span>{it.text}</span>
              <small className="muted">{fmtDate(it.ts)}{it.sub ? ` · ${it.sub}` : ""}</small>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">لاحظت دخولًا لا تعرفه؟ غيّر كلمة مرورك فورًا ثم اضغط «خروج من كل الأجهزة الأخرى».</p>

      {regen && (
        <Modal title="رموز استرداد جديدة" onClose={() => setRegen(false)}>
          {codes ? (
            <>
              <p className="muted">الرموز القديمة لم تعد تعمل. احفظ هذه في مكان آمن:</p>
              <RecoveryCodes codes={codes} />
            </>
          ) : (
            <form onSubmit={doRegen} className="stack">
              <p className="muted">للتأكيد اكتب الرمز الحالي من تطبيق المصادقة. الرموز القديمة ستُلغى.</p>
              <Field label="الرمز (6 أرقام)">
                <input dir="ltr" className="otp-input" inputMode="numeric" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
              </Field>
              <button className="btn btn-primary" disabled={busy || code.length !== 6}>إنشاء</button>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
