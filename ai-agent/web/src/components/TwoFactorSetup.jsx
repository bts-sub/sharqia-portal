// تفعيل التحقق بخطوتين (إلزامي للجميع): تطبيق مصادقة + رموز استرداد
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { toast } from "./ui.jsx";

const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);

export function RecoveryCodes({ codes }) {
  const text = codes.join("\n");
  const copy = () => navigator.clipboard.writeText(`رموز استرداد «سند» — كل رمز يُستخدم مرة واحدة:\n${text}`).then(() => toast("تم النسخ", "success"));
  const download = () => {
    const blob = new Blob([`رموز استرداد «سند» — كل رمز يُستخدم مرة واحدة\n\n${text}\n`], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sharqia-ai-recovery-codes.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <>
      <div className="recovery-grid" dir="ltr">
        {codes.map((c) => <code key={c}>{c}</code>)}
      </div>
      <div className="row-gap">
        <button type="button" className="btn btn-ghost" onClick={copy}><Icon name="copy" size={16} /> نسخ</button>
        <button type="button" className="btn btn-ghost" onClick={download}><Icon name="file" size={16} /> تنزيل ملف</button>
      </div>
    </>
  );
}

export default function TwoFactorSetup({ onDone, onLogout }) {
  const [step, setStep] = useState("intro"); // intro → scan → codes
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      setSetup(await api("/auth/2fa/setup", { method: "POST" }));
      setStep("scan");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (step === "scan" && !setup) start(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/2fa/enable", { method: "POST", body: { code } });
      setCodes(r.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-wide">
        <div className="auth-shield"><Icon name="shield" size={30} /></div>
        {step === "intro" && (
          <>
            <h1>فعّل التحقق بخطوتين</h1>
            <p className="muted">
              لحماية حسابك (وواتساب وبريدك المربوطين به)، يلزم عند كل دخول رمز من تطبيق على جوالك بالإضافة لكلمة المرور.
              حتى لو عرف أحد كلمة مرورك لن يستطيع الدخول.
            </p>
            <ol className="steps">
              <li>
                ثبّت تطبيق <b>Google Authenticator</b> أو <b>Microsoft Authenticator</b> على جوالك
                (من <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">App Store</a> أو
                {" "}<a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">Google Play</a>)
              </li>
              <li>اضغط «متابعة» وأضف الحساب للتطبيق</li>
              <li>اكتب الرمز الظاهر في التطبيق</li>
            </ol>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-block" onClick={start} disabled={busy}>متابعة</button>
          </>
        )}

        {step === "scan" && setup && (
          <form onSubmit={verify} className="stack">
            <h1>أضف الحساب للتطبيق</h1>
            {isMobile ? (
              <>
                <p className="muted">على نفس الجوال: اضغط الزر ليفتح تطبيق المصادقة ويضيف الحساب تلقائيًا، ثم ارجع هنا.</p>
                <a className="btn btn-primary btn-block" href={setup.url}>إضافة إلى تطبيق المصادقة</a>
                <details className="manual-key">
                  <summary>لم يفتح التطبيق؟ أدخل المفتاح يدويًا</summary>
                  <p className="muted small">في التطبيق: «+» ← «إدخال مفتاح الإعداد» ← اكتب أي اسم ثم هذا المفتاح:</p>
                  <code dir="ltr" className="secret">{setup.secret}</code>
                  <img src={setup.qr} alt="رمز QR" width={180} height={180} className="qr-small" />
                </details>
              </>
            ) : (
              <>
                <p className="muted">افتح التطبيق على جوالك ← «+» ← «مسح رمز QR» ووجّه الكاميرا:</p>
                <img src={setup.qr} alt="رمز QR لتطبيق المصادقة" width={220} height={220} className="qr-center" />
                <p className="muted small">لا تستطيع المسح؟ أدخل هذا المفتاح يدويًا: <code dir="ltr" className="secret">{setup.secret}</code></p>
              </>
            )}
            <label className="field">
              <span className="field-label">الرمز من التطبيق (6 أرقام)</span>
              <input
                dir="ltr"
                className="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)))}
              />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>{busy ? "جارٍ التحقق…" : "تفعيل"}</button>
          </form>
        )}

        {step === "codes" && codes && (
          <div className="stack">
            <h1>احفظ رموز الاسترداد</h1>
            <p className="muted">
              إذا ضاع جوالك تدخل بأحد هذه الرموز (كل رمز مرة واحدة). احفظها في مكان آمن خارج الجوال — لن تظهر مرة أخرى.
            </p>
            <RecoveryCodes codes={codes} />
            <label className="check">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              <span>حفظت الرموز في مكان آمن</span>
            </label>
            <button className="btn btn-primary btn-block" disabled={!saved} onClick={onDone}>تم — ادخل للمساعد</button>
          </div>
        )}

        {step !== "codes" && <button className="btn btn-ghost btn-block" onClick={onLogout}>تسجيل الخروج</button>}
      </div>
    </div>
  );
}
