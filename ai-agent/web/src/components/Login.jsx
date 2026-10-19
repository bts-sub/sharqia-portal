import { useState } from "react";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", { method: "POST", body: { username: username.trim(), password } });
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/icons/icon-192.png" alt="" className="auth-logo" />
        <h1>مساعدي الذكي</h1>
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
        <p className="auth-privacy">
          <Icon name="lock" size={14} /> محادثاتك وملفاتك مشفّرة بكلمة مرورك — لا يطّلع عليها أحد غيرك.
        </p>
      </form>
    </div>
  );
}
