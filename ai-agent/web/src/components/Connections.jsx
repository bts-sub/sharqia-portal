// ربط واتساب وGmail من صفحة الإعدادات
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { Field, toast } from "./ui.jsx";

const WA_STATUS = {
  open: { text: "متصل", tone: "ok" },
  connecting: { text: "جارٍ الاتصال…", tone: "wait" },
  reconnecting: { text: "يعيد الاتصال…", tone: "wait" },
  qr: { text: "بانتظار المسح", tone: "wait" },
  pairing: { text: "بانتظار إدخال الرمز", tone: "wait" },
  idle: { text: "غير مربوط", tone: "off" },
};

function WhatsAppCard({ wa, onChange }) {
  const [mode, setMode] = useState(null); // null | "qr" | "phone"
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const st = WA_STATUS[wa.status] || WA_STATUS.idle;
  const waiting = ["connecting", "qr", "pairing"].includes(wa.status) && !wa.linked;

  const connect = async (withPhone) => {
    setBusy(true);
    try {
      onChange(await api("/connectors/whatsapp/connect", { method: "POST", body: withPhone ? { phone } : {} }));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (wa.linked && !confirm("إلغاء ربط واتساب؟ سيتوقف المساعد عن قراءة رسائلك وتُمسح الرسائل المحفوظة عنده.")) return;
    try {
      onChange(await api("/connectors/whatsapp/logout", { method: "POST" }));
      setMode(null);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="connector">
      <div className="connector-head">
        <span className="connector-icon wa"><Icon name="phone" size={18} /></span>
        <div>
          <strong>واتساب</strong>
          <small className="muted">يقرأ رسائلك، يلخّص ما فاتك، يرسل ويتابع نيابةً عنك</small>
        </div>
        <span className={`status-chip tone-${wa.linked && wa.status === "open" ? "ok" : st.tone}`}>{wa.linked && wa.status === "idle" ? "مربوط (غير متصل)" : st.text}</span>
      </div>

      {wa.linked ? (
        <div className="connector-body">
          <div className="kv"><span>الرقم</span><strong dir="ltr">{wa.me?.id ? `+${wa.me.id.split("@")[0]}` : "—"}</strong></div>
          <div className="kv"><span>المحادثات المحفوظة</span><strong>{wa.chats} {wa.unreadChats ? `(${wa.unreadChats} فيها غير مقروء)` : ""}</strong></div>
          <p className="muted small">
            يظهر في جوالك ضمن «الأجهزة المرتبطة». لا يضع المساعد علامة «تمت القراءة» على رسائلك، فتبقى إشعاراتك كما هي.
          </p>
          <button className="btn btn-ghost danger" onClick={logout}>إلغاء الربط</button>
        </div>
      ) : waiting ? (
        <div className="connector-body">
          {wa.qr && (
            <div className="qr-box">
              <img src={wa.qr} alt="رمز QR لربط واتساب" width={240} height={240} />
              <ol className="steps">
                <li>افتح واتساب في جوالك</li>
                <li>الإعدادات ← <b>الأجهزة المرتبطة</b> ← <b>ربط جهاز</b></li>
                <li>وجّه الكاميرا إلى الرمز</li>
              </ol>
            </div>
          )}
          {wa.pairCode && (
            <div className="pair-box">
              <div className="pair-code" dir="ltr">{wa.pairCode.replace(/(.{4})(.{4})/, "$1-$2")}</div>
              <ol className="steps">
                <li>افتح واتساب ← الإعدادات ← <b>الأجهزة المرتبطة</b> ← <b>ربط جهاز</b></li>
                <li>اضغط <b>«الربط باستخدام رقم الهاتف بدلًا من ذلك»</b></li>
                <li>اكتب الرمز الظاهر هنا</li>
              </ol>
            </div>
          )}
          {!wa.qr && !wa.pairCode && <div className="center-pad small-pad"><div className="spinner" /></div>}
          <p className="muted small">الصفحة تتحدّث تلقائيًا بعد الربط.</p>
          <div><button className="btn btn-ghost" onClick={logout}>إلغاء</button></div>
        </div>
      ) : (
        <div className="connector-body">
          {wa.error && <div className="form-error">{wa.error}</div>}
          {mode === "phone" ? (
            <div className="stack">
              <Field label="رقم واتساب الخاص بك" hint="سيظهر رمز من 8 أحرف تكتبه في واتساب جوالك">
                <input dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <div className="row-gap">
                <button className="btn btn-primary" disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={() => connect(true)}>اطلب رمز الربط</button>
                <button className="btn btn-ghost" onClick={() => setMode(null)}>رجوع</button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted small">
                الربط مثل «واتساب ويب»: مرة واحدة فقط. ملاحظة: هذه طريقة غير رسمية من واتساب — المساعد يتصرف بهدوء (يحاكي الكتابة
                وله سقف يومي) لكن الإرسال الكثيف قد يعرّض الرقم للتقييد.
              </p>
              <div className="row-gap">
                <button className="btn btn-primary" disabled={busy} onClick={() => { setMode("phone"); }}>
                  <Icon name="phone" size={16} /> الربط برقم الجوال (من نفس الجوال)
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => connect(false)}>
                  الربط برمز QR (من الكمبيوتر)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GmailCard({ gm, onChange }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const link = async () => {
    setBusy(true);
    try {
      onChange(await api("/connectors/gmail", { method: "POST", body: { email, appPassword: pass } }));
      setPass("");
      toast("تم ربط Gmail", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const unlink = async () => {
    if (!confirm("إلغاء ربط Gmail؟")) return;
    onChange(await api("/connectors/gmail", { method: "DELETE" }));
  };

  return (
    <div className="connector">
      <div className="connector-head">
        <span className="connector-icon gm"><Icon name="file" size={18} /></span>
        <div>
          <strong>Gmail</strong>
          <small className="muted">يقرأ بريدك ويلخّصه ويرد ويرسل بطلبك</small>
        </div>
        <span className={`status-chip tone-${gm.linked ? "ok" : "off"}`}>{gm.linked ? "مربوط" : "غير مربوط"}</span>
      </div>
      {gm.linked ? (
        <div className="connector-body">
          <div className="kv"><span>البريد</span><strong dir="ltr">{gm.email}</strong></div>
          <p className="muted small">لا يضع المساعد علامة «مقروء» على رسائلك.</p>
          <button className="btn btn-ghost danger" onClick={unlink}>إلغاء الربط</button>
        </div>
      ) : (
        <div className="connector-body stack">
          <ol className="steps">
            <li>فعّل <b>التحقق بخطوتين</b> في حساب Google إن لم يكن مفعّلًا</li>
            <li>
              افتح <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" dir="ltr">myaccount.google.com/apppasswords</a>
              {" "}واكتب اسمًا مثل «مساعدي» ثم اضغط إنشاء
            </li>
            <li>انسخ الرمز المكوّن من 16 حرفًا والصقه هنا</li>
          </ol>
          <div className="grid-2">
            <Field label="بريد Gmail">
              <input dir="ltr" type="email" autoComplete="off" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="كلمة مرور التطبيقات">
              <input dir="ltr" type="password" autoComplete="off" placeholder="xxxx xxxx xxxx xxxx" value={pass} onChange={(e) => setPass(e.target.value)} />
            </Field>
          </div>
          <div><button className="btn btn-primary" disabled={busy || !email || pass.replace(/\s/g, "").length < 16} onClick={link}>{busy ? "جارٍ التحقق…" : "ربط Gmail"}</button></div>
        </div>
      )}
    </div>
  );
}

export default function Connections() {
  const [data, setData] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { setData(await api("/connectors")); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // أثناء انتظار الربط: تحديث كل ثانيتين
  const waiting = data?.whatsapp && !data.whatsapp.linked && ["connecting", "qr", "pairing"].includes(data.whatsapp.status);
  const connecting = data?.whatsapp?.linked && data.whatsapp.status !== "open";
  useEffect(() => {
    clearInterval(timer.current);
    if (waiting || connecting) timer.current = setInterval(load, waiting ? 2000 : 5000);
    return () => clearInterval(timer.current);
  }, [waiting, connecting, load]);

  if (!data || (!data.whatsapp && !data.gmail)) return null;

  return (
    <section className="card">
      <h2><Icon name="globe" size={18} /> الربط بالواتساب والبريد</h2>
      <p className="muted small">
        بعد الربط اسأل مساعدك: «إيه اللي فاتني؟» أو «تابع مع فلان بخصوص كذا». بيانات الربط تُحفظ مشفّرة على سيرفر الشركة فقط.
      </p>
      {data.whatsapp && <WhatsAppCard wa={data.whatsapp} onChange={(w) => setData((d) => ({ ...d, whatsapp: w }))} />}
      {data.gmail && <GmailCard gm={data.gmail} onChange={(g) => setData((d) => ({ ...d, gmail: g }))} />}
    </section>
  );
}
