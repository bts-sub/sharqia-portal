import { useState } from "react";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ticket, setTicket] = useState(null); // بعد كلمة المرور الصحيحة: خطوة رمز التطبيق
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/login", { method: "POST", body: { username: username.trim(), password } });
      if (r.mfaRequired) {
        setTicket(r.ticket);
        setPassword("");
      } else {
        await onDone();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/2fa", { method: "POST", body: { ticket, code, recovery } });
      await onDone();
    } catch (err) {
      setError(err.message);
      if (err.status === 401 && /سجّل الدخول من جديد/.test(err.message)) {
        setTicket(null);
        setCode("");
      }
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={submitCode}>
          <div className="auth-shield"><Icon name="shield" size={30} /></div>
          <h1>رمز التحقق</h1>
          <p className="muted">
            {recovery
              ? "اكتب أحد رموز الاسترداد التي حفظتها عند تفعيل التحقق بخطوتين."
              : "افتح تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator) واكتب الرمز المكوّن من 6 أرقام."}
          </p>
          <label className="field">
            <span className="field-label">{recovery ? "رمز الاسترداد" : "الرمز"}</span>
            <input
              dir="ltr"
              className={recovery ? "" : "otp-input"}
              inputMode={recovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoFocus
              maxLength={recovery ? 12 : 6}
              placeholder={recovery ? "xxxx-xxxx" : "••••••"}
              value={code}
              onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)))}
              required
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy || (!recovery && code.length !== 6)}>{busy ? "جارٍ التحقق…" : "تأكيد"}</button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => { setRecovery(!recovery); setCode(""); setError(""); }}>
            {recovery ? "استخدام رمز التطبيق" : "فقدت جوالي — استخدم رمز استرداد"}
          </button>
          <button type="button" className="link-btn" onClick={() => { setTicket(null); setCode(""); setError(""); }}>رجوع</button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submitPassword}>
        <img src="/icons/icon-192.png" alt="" className="auth-logo" />
        <h1>سند</h1>
        <p className="muted">مساعدك الشخصي في بيت العباءة الشرقية</p>
        <label className="field">
          <span className="field-label">اسم الدخول</span>
          <input
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">كلمة المرور</span>
          <input dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول"}</button>
        <a className="link-btn" href="/">تعرّف على سند</a>
        <p className="auth-privacy">
          <Icon name="lock" size={14} /> محمي بالتحقق بخطوتين، ومحادثاتك مشفّرة بكلمة مرورك — لا يطّلع عليها أحد غيرك.
        </p>
      </form>
    </div>
  );
}
