// عناصر واجهة مشتركة: الإشعارات، النوافذ، الصورة الرمزية، المفاتيح.
import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

// ===== Toasts =====
let pushToast = () => {};
export const toast = (message, kind = "info") => pushToast({ message, kind, id: Math.random() });

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === "error" ? 6000 : 3500);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ===== Modal =====
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ===== Avatar للمساعد =====
export function AgentAvatar({ name = "م", gender = "male", size = 40, pulse = false }) {
  const letter = (name.trim()[0] || "م").toUpperCase();
  return (
    <div
      className={`avatar avatar-${gender === "female" ? "f" : "m"} ${pulse ? "avatar-pulse" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`switch-row ${disabled ? "is-disabled" : ""}`}>
      <span className="switch-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

export function Meter({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";
  return (
    <div className="meter" title={label}>
      <div className={`meter-fill meter-${tone}`} style={{ width: `${max > 0 ? pct : 0}%` }} />
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
