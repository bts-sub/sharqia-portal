import { useState } from "react";
import { api } from "../lib/api.js";
import { toast } from "./ui.jsx";

export function PasswordForm({ onDone, submitLabel = "حفظ كلمة المرور" }) {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("كلمة المرور الجديدة لا تقل عن 8 أحرف");
    if (newPassword !== confirm) return setError("التأكيد لا يطابق كلمة المرور الجديدة");
    setBusy(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { oldPassword, newPassword } });
      toast("تم تغيير كلمة المرور", "success");
      setOld(""); setNew(""); setConfirm("");
      await onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <label className="field">
        <span className="field-label">كلمة المرور الحالية</span>
        <input dir="ltr" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOld(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">كلمة المرور الجديدة</span>
        <input dir="ltr" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={8} />
      </label>
      <label className="field">
        <span className="field-label">تأكيد كلمة المرور الجديدة</span>
        <input dir="ltr" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : submitLabel}</button>
    </form>
  );
}

export default function ChangePassword({ onDone, onLogout }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>اختر كلمة مرور خاصة بك</h1>
        <p className="muted">
          كلمة المرور الحالية مؤقتة من الإدارة. كلمة مرورك الجديدة هي مفتاح تشفير بياناتك — لا تشاركها مع أحد،
          وإذا نسيتها وأعادت الإدارة تعيينها ستبدأ بمحادثات جديدة فارغة.
        </p>
        <PasswordForm onDone={onDone} submitLabel="حفظ والمتابعة" />
        <button className="btn btn-ghost btn-block" onClick={onLogout}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
