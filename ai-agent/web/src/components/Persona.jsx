// «سند يعرفك»: من أنت، أسلوبك، حدودك، وإجاباتك المعتمدة — مع التعلّم من محادثاتك
import { useEffect, useRef, useState } from "react";
import { useMe } from "../App.jsx";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { Field, Modal, toast } from "./ui.jsx";

export default function Persona({ onMenu }) {
  const { me } = useMe();
  const f = me.user.limits?.features || {};
  const [p, setP] = useState(null);
  const [saving, setSaving] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnText, setLearnText] = useState("");
  const [selfName, setSelfName] = useState(me.user.displayName.split(" ")[0]);
  const [learning, setLearning] = useState(false);
  const [sugg, setSugg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { api("/assistant/persona").then(setP).catch((e) => toast(e.message, "error")); }, []);
  if (!p) return <div className="page"><div className="center-pad"><div className="spinner" /></div></div>;

  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setFaq = (i, k, v) => set("faqs", p.faqs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const save = async (next = p) => {
    setSaving(true);
    try {
      setP(await api("/assistant/persona", { method: "PUT", body: next }));
      toast("تم الحفظ — سند يستخدم هذه المعلومات من الآن", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const learn = async (source) => {
    setLearning(true);
    setSugg(null);
    try {
      const r = await api("/assistant/persona/learn", { method: "POST", body: source === "whatsapp" ? { source, selfName } : { text: learnText, selfName } });
      setSugg({ ...r, pick: { style: true, facts: r.facts.map(() => true), faqs: r.faqs.map(() => true), boundaries: r.boundaries.map(() => true) } });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLearning(false);
    }
  };

  const applySugg = () => {
    const s = sugg;
    const facts = s.facts.filter((_, i) => s.pick.facts[i]);
    const bounds = s.boundaries.filter((_, i) => s.pick.boundaries[i]);
    const next = {
      ...p,
      style: s.pick.style && s.style ? (p.style ? `${p.style}\n${s.style}` : s.style) : p.style,
      about: facts.length ? [p.about, ...facts.map((x) => `- ${x}`)].filter(Boolean).join("\n") : p.about,
      boundaries: bounds.length ? [p.boundaries, ...bounds.map((x) => `- ${x}`)].filter(Boolean).join("\n") : p.boundaries,
      faqs: [...p.faqs, ...s.faqs.filter((_, i) => s.pick.faqs[i])].slice(0, 100),
    };
    setP(next);
    setSugg(null);
    setLearnOpen(false);
    save(next);
  };

  const togglePick = (k, i) => setSugg((s) => ({ ...s, pick: { ...s.pick, [k]: i === undefined ? !s.pick[k] : s.pick[k].map((v, j) => (j === i ? !v : v)) } }));

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <h1>سند يعرفك</h1>
      </header>
      <div className="page-body">
        <div className="banner banner-info">
          <Icon name="sparkle" size={18} />
          كل ما تكتبه هنا يستخدمه مساعدك عندما يكتب باسمك، ويتابع على واتساب، ويرد على مكالماتك. كلما كان أوضح كان المساعد أقرب لك.
        </div>

        <section className="card">
          <div className="card-head-row">
            <h2>تعلّم من محادثاتك</h2>
            <button className="btn btn-primary" onClick={() => setLearnOpen(true)}><Icon name="sparkle" size={16} /> ابدأ التعلّم</button>
          </div>
          <p className="muted small">يقرأ المساعد محادثات حقيقية لك ويقترح: أسلوبك، والأسئلة التي تتكرر عليك وكيف تجيب عنها، ومعلومات عن عملك. أنت تراجع وتختار ما يُحفظ.</p>
        </section>

        <section className="card">
          <h2>عنك وعن عملك</h2>
          <Field label="من أنت وماذا تعمل؟" hint="مثال: صاحب بيت العباءة الشرقية، نبيع عبايات جملة وتجزئة، المصنع في الدمام، أوقات العمل…">
            <textarea rows={5} value={p.about} onChange={(e) => set("about", e.target.value)} maxLength={5000} />
          </Field>
          <Field label="أسلوبك في الكلام" hint="مثال: مختصر، أبدأ بالسلام، لهجة سعودية، أنادي العملاء «أخوي/أختي»…">
            <textarea rows={3} value={p.style} onChange={(e) => set("style", e.target.value)} maxLength={3000} />
          </Field>
          <Field label="حدود لا يتجاوزها المساعد" hint="مثال: لا يعطي خصومات، لا يحدد مواعيد تسليم، لا يتكلم في الرواتب، لا يعطي رقمي الخاص…">
            <textarea rows={3} value={p.boundaries} onChange={(e) => set("boundaries", e.target.value)} maxLength={3000} />
          </Field>
        </section>

        <section className="card">
          <div className="card-head-row">
            <h2>أسئلة متكررة وإجاباتك المعتمدة</h2>
            <button className="btn btn-ghost sm" onClick={() => set("faqs", [...p.faqs, { q: "", a: "" }])}><Icon name="plus" size={15} /> سؤال</button>
          </div>
          {!p.faqs.length && <p className="muted small">مثال: «كم سعر عباية الكريب جملة؟» ← «حسب الكمية، أرسل لنا العدد والموديل ونرد عليك بعرض سعر».</p>}
          <div className="faq-list">
            {p.faqs.map((f, i) => (
              <div key={i} className="faq-item">
                <input placeholder="السؤال" value={f.q} onChange={(e) => setFaq(i, "q", e.target.value)} maxLength={400} />
                <textarea rows={2} placeholder="إجابتك المعتمدة" value={f.a} onChange={(e) => setFaq(i, "a", e.target.value)} maxLength={2000} />
                <button className="icon-btn sm danger" onClick={() => set("faqs", p.faqs.filter((_, j) => j !== i))} aria-label="حذف السؤال"><Icon name="trash" size={15} /></button>
              </div>
            ))}
          </div>
        </section>

        <div className="save-row">
          <button className="btn btn-primary" onClick={() => save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button>
        </div>
      </div>

      {learnOpen && (
        <Modal wide title="تعلّم من محادثاتك" onClose={() => { setLearnOpen(false); setSugg(null); }}>
          {!sugg ? (
            <div className="stack">
              <Field label="اسمك كما يظهر في المحادثات">
                <input value={selfName} onChange={(e) => setSelfName(e.target.value)} />
              </Field>
              {f.whatsapp && (
                <div className="learn-option">
                  <strong>من واتساب المربوط</strong>
                  <p className="muted small">يقرأ آخر ١٢ محادثة فردية لك (بموافقتك) ويستخرج الاقتراحات.</p>
                  <button className="btn btn-primary" disabled={learning} onClick={() => learn("whatsapp")}>{learning ? "يحلّل…" : "تعلّم من واتساب"}</button>
                </div>
              )}
              <div className="learn-option">
                <strong>من محادثة تصدّرها أو تلصقها</strong>
                <p className="muted small">من واتساب: افتح المحادثة ← اسم الشخص ← «تصدير الدردشة» ← بدون وسائط، ثم ارفع الملف هنا أو الصق النص.</p>
                <div className="row-gap">
                  <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="clip" size={16} /> رفع ملف المحادثة</button>
                  <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setLearnText(await file.text());
                    e.target.value = "";
                  }} />
                </div>
                <textarea rows={6} placeholder="أو الصق نص المحادثات هنا…" value={learnText} onChange={(e) => setLearnText(e.target.value)} />
                <button className="btn btn-primary" disabled={learning || learnText.trim().length < 200} onClick={() => learn("text")}>{learning ? "يحلّل…" : "تحليل"}</button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="muted">اختر ما تريد حفظه (يمكنك تعديله بعدها):</p>
              {sugg.style && (
                <label className="check"><input type="checkbox" checked={sugg.pick.style} onChange={() => togglePick("style")} /><span><b>أسلوبك:</b> {sugg.style}</span></label>
              )}
              {sugg.facts.length > 0 && <h3 className="form-section">معلومات عن عملك</h3>}
              {sugg.facts.map((x, i) => (
                <label key={i} className="check"><input type="checkbox" checked={sugg.pick.facts[i]} onChange={() => togglePick("facts", i)} /><span>{x}</span></label>
              ))}
              {sugg.faqs.length > 0 && <h3 className="form-section">أسئلة متكررة وإجاباتك</h3>}
              {sugg.faqs.map((x, i) => (
                <label key={i} className="check"><input type="checkbox" checked={sugg.pick.faqs[i]} onChange={() => togglePick("faqs", i)} /><span><b>س:</b> {x.q}<br /><b>ج:</b> {x.a}</span></label>
              ))}
              {sugg.boundaries.length > 0 && <h3 className="form-section">حدود لاحظها</h3>}
              {sugg.boundaries.map((x, i) => (
                <label key={i} className="check"><input type="checkbox" checked={sugg.pick.boundaries[i]} onChange={() => togglePick("boundaries", i)} /><span>{x}</span></label>
              ))}
              <div className="row-gap">
                <button className="btn btn-primary" onClick={applySugg}>حفظ المختار</button>
                <button className="btn btn-ghost" onClick={() => setSugg(null)}>رجوع</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
