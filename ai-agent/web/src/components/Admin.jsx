import { useCallback, useEffect, useState } from "react";
import { useMe } from "../App.jsx";
import { api, fmtBytes, fmtDate, fmtUsd } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { AgentAvatar, Field, Meter, Modal, Switch, toast } from "./ui.jsx";

const FEATURES = [
  { key: "voice", label: "الصوت", hint: "إملاء صوتي، قراءة الردود، ومكالمة صوتية" },
  { key: "files", label: "رفع الملفات", hint: "PDF وWord وExcel والصور" },
  { key: "folder", label: "قراءة مجلد من الجهاز", hint: "الموظف يختار مجلدًا والمساعد يقرأ ملفاته" },
  { key: "web", label: "البحث في الإنترنت", hint: "للأنظمة واللوائح والأسعار الحديثة ($0.01 لكل بحث)" },
];

const randomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = crypto.getRandomValues(new Uint32Array(10));
  return [...arr].map((n) => chars[n % chars.length]).join("");
};

function UserEditor({ data, user, onClose, onSaved }) {
  const isNew = !user;
  const [f, setF] = useState(() => ({
    displayName: user?.displayName || "",
    jobTitle: user?.jobTitle || "",
    username: user?.username || "",
    password: isNew ? randomPassword() : "",
    isAdmin: Boolean(user?.isAdmin),
    agent: {
      name: user?.agent?.name || "",
      gender: user?.agent?.gender || "male",
      role: user?.agent?.role || "general",
      customTitle: user?.agent?.customTitle || "",
      customInstructions: user?.agent?.customInstructions || "",
    },
    model: user?.model || "",
    limits: {
      monthlyUsd: user?.limits?.monthlyUsd ?? 20,
      dailyMessages: user?.limits?.dailyMessages ?? 0,
      storageMb: user?.limits?.storageMb ?? 300,
      models: user?.limits?.models || data.models.map((m) => m.id),
      features: { voice: true, files: true, folder: true, web: false, ...(user?.limits?.features || {}) },
      allowCustomize: user?.limits?.allowCustomize ?? true,
    },
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (path, v) =>
    setF((cur) => {
      const next = structuredClone(cur);
      const keys = path.split(".");
      let o = next;
      while (keys.length > 1) o = o[keys.shift()];
      o[keys[0]] = v;
      return next;
    });

  const role = data.roles.find((r) => r.id === f.agent.role);

  const save = async () => {
    setError("");
    if (!f.agent.name.trim()) return setError("اكتب اسمًا للمساعد (مثل: سارة، خالد، نورة)");
    if (!f.limits.models.length) return setError("اختر موديلًا واحدًا على الأقل");
    setBusy(true);
    try {
      const body = { ...f, model: f.model || null };
      if (isNew) {
        const created = await api("/admin/users", { method: "POST", body });
        onSaved(created, { username: f.username.trim().toLowerCase(), password: f.password });
      } else {
        delete body.password;
        delete body.username;
        onSaved(await api(`/admin/users/${user.id}`, { method: "PATCH", body }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={isNew ? "إضافة موظف" : `تعديل: ${user.displayName}`}
      onClose={onClose}
      footer={
        <>
          {error && <span className="form-error inline">{error}</span>}
          <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        </>
      }
    >
      <h3 className="form-section">الموظف</h3>
      <div className="grid-2">
        <Field label="الاسم">
          <input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="مثال: أحمد محمد" />
        </Field>
        <Field label="المسمى الوظيفي">
          <input value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="مثال: محاسب" />
        </Field>
        {isNew && (
          <>
            <Field label="اسم الدخول" hint="حروف إنجليزية صغيرة وأرقام فقط">
              <input dir="ltr" value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="ahmed" autoCapitalize="none" />
            </Field>
            <Field label="كلمة مرور مؤقتة" hint="سيُطلب من الموظف تغييرها عند أول دخول">
              <div className="input-with-btn">
                <input dir="ltr" value={f.password} onChange={(e) => set("password", e.target.value)} />
                <button type="button" className="btn btn-ghost sm" onClick={() => set("password", randomPassword())}>توليد</button>
              </div>
            </Field>
          </>
        )}
      </div>
      <Switch checked={f.isAdmin} onChange={(v) => set("isAdmin", v)} label="صلاحية الإدارة" hint="يفتح الحسابات ويحدد الحدود والإعدادات (لا يرى محادثات أحد)" />

      <h3 className="form-section">المساعد الذكي</h3>
      <div className="grid-2">
        <Field label="اسم المساعد">
          <input value={f.agent.name} onChange={(e) => set("agent.name", e.target.value)} placeholder="مثال: سارة" maxLength={30} />
        </Field>
        <Field label="صوت المساعد">
          <div className="seg">
            <button type="button" className={f.agent.gender === "male" ? "is-on" : ""} onClick={() => set("agent.gender", "male")}>رجل</button>
            <button type="button" className={f.agent.gender === "female" ? "is-on" : ""} onClick={() => set("agent.gender", "female")}>امرأة</button>
          </div>
        </Field>
      </div>
      <Field label="المهمة / التخصص" hint={role?.summary}>
        <select value={f.agent.role} onChange={(e) => set("agent.role", e.target.value)}>
          {data.roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
      </Field>
      {f.agent.role === "custom" && (
        <Field label="مسمى الدور المخصّص">
          <input value={f.agent.customTitle} onChange={(e) => set("agent.customTitle", e.target.value)} placeholder="مثال: مستشار جودة" />
        </Field>
      )}
      <Field
        label={f.agent.role === "custom" ? "تعليمات الدور" : "تعليمات إضافية (اختياري)"}
        hint="ما يجب أن يعرفه أو يلتزم به المساعد لهذا الموظف تحديدًا. تسري على المحادثات الجديدة."
      >
        <textarea rows={4} value={f.agent.customInstructions} onChange={(e) => set("agent.customInstructions", e.target.value)} maxLength={6000} />
      </Field>
      <Switch checked={f.limits.allowCustomize} onChange={(v) => set("limits.allowCustomize", v)} label="يسمح للموظف بتغيير اسم المساعد وصوته" />

      <h3 className="form-section">الحدود والصلاحيات</h3>
      <div className="grid-3">
        <Field label="حد شهري ($)" hint="0 = بلا حد">
          <input type="number" min="0" step="1" dir="ltr" value={f.limits.monthlyUsd} onChange={(e) => set("limits.monthlyUsd", +e.target.value)} />
        </Field>
        <Field label="رسائل يوميًا" hint="0 = بلا حد">
          <input type="number" min="0" step="1" dir="ltr" value={f.limits.dailyMessages} onChange={(e) => set("limits.dailyMessages", +e.target.value)} />
        </Field>
        <Field label="المساحة (MB)">
          <input type="number" min="10" step="10" dir="ltr" value={f.limits.storageMb} onChange={(e) => set("limits.storageMb", +e.target.value)} />
        </Field>
      </div>
      <div className="field">
        <span className="field-label">الموديلات المسموحة</span>
        <div className="check-list">
          {data.models.map((m) => (
            <label key={m.id} className="check">
              <input
                type="checkbox"
                checked={f.limits.models.includes(m.id)}
                onChange={(e) => set("limits.models", e.target.checked ? [...f.limits.models, m.id] : f.limits.models.filter((x) => x !== m.id))}
              />
              <span><strong>{m.label}</strong> <small className="muted">— {m.hint}</small></span>
            </label>
          ))}
        </div>
      </div>
      <Field label="الموديل الافتراضي لهذا الموظف">
        <select value={f.model} onChange={(e) => set("model", e.target.value)}>
          <option value="">افتراضي المنظّمة</option>
          {data.models.filter((m) => f.limits.models.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      {FEATURES.map((x) => (
        <Switch key={x.key} checked={f.limits.features[x.key]} onChange={(v) => set(`limits.features.${x.key}`, v)} label={x.label} hint={x.hint} />
      ))}
    </Modal>
  );
}

function OrgSettings({ settings, models, onSaved }) {
  const [orgName, setOrgName] = useState(settings.orgName);
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel);
  const [effort, setEffort] = useState(settings.effort);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [azureKey, setAzureKey] = useState("");
  const [azureRegion, setAzureRegion] = useState(settings.azureRegion);
  const [busy, setBusy] = useState(false);

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const body = { orgName, defaultModel, effort, azureRegion, ...extra };
      if (anthropicKey) body.anthropicKey = anthropicKey;
      if (azureKey) body.azureKey = azureKey;
      const s = await api("/admin/settings", { method: "PUT", body });
      setAnthropicKey("");
      setAzureKey("");
      onSaved(s);
      toast("تم حفظ الإعدادات", "success");
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const test = async (what) => {
    if ((what === "claude" && anthropicKey) || (what === "azure" && azureKey)) {
      if (!(await save())) return;
    }
    try {
      const r = await api("/admin/settings/test", { method: "POST", body: { what } });
      toast(r.message, "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="stack-lg">
      <section className="card">
        <h2><Icon name="key" size={18} /> اشتراك Claude</h2>
        <p className="muted small">
          ضع مفتاح API من <span dir="ltr">platform.claude.com</span> (الدفع حسب الاستهلاك). اشتراكات Claude.ai العادية (Pro/Max) لا تعمل داخل الأنظمة الخارجية.
          المفتاح يُحفظ مشفّرًا على السيرفر ولا يظهر لأحد.
        </p>
        <Field label="مفتاح Claude API" hint={settings.hasAnthropicKey ? `مضبوط حاليًا (${settings.anthropicKeyHint}). اترك الخانة فارغة للإبقاء عليه.` : "غير مضبوط"}>
          <input dir="ltr" type="password" autoComplete="off" placeholder="sk-ant-…" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
        </Field>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={() => test("claude")} disabled={busy}>اختبار المفتاح</button>
        </div>
        <div className="grid-2">
          <Field label="الموديل الافتراضي">
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label} (${m.in}/${m.out} لكل مليون)</option>)}
            </select>
          </Field>
          <Field label="عمق التفكير" hint="أعمق = أدق في التحليل وأبطأ وأغلى قليلًا">
            <select value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="low">سريع</option>
              <option value="medium">متوازن (موصى به)</option>
              <option value="high">عميق</option>
            </select>
          </Field>
        </div>
        <Field label="اسم المنظّمة">
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </Field>
      </section>

      <section className="card">
        <h2><Icon name="speaker" size={18} /> الصوت السحابي (اختياري)</h2>
        <p className="muted small">
          بدون إعداد: يستخدم التطبيق أصوات الجهاز المجانية (جودتها تختلف من جهاز لآخر). مع Azure Speech: أصوات عربية طبيعية
          ثابتة على كل الأجهزة — رجل (حامد) وامرأة (زارية) بلهجة سعودية — بتكلفة تقارب $16 لكل مليون حرف.
        </p>
        <div className="grid-2">
          <Field label="مفتاح Azure Speech" hint={settings.hasAzure ? `مضبوط (${settings.azureKeyHint})` : "غير مضبوط"}>
            <input dir="ltr" type="password" autoComplete="off" value={azureKey} onChange={(e) => setAzureKey(e.target.value)} />
          </Field>
          <Field label="المنطقة (Region)" hint="مثال: uaenorth أو westeurope">
            <input dir="ltr" value={azureRegion} onChange={(e) => setAzureRegion(e.target.value)} />
          </Field>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={() => test("azure")} disabled={busy}>اختبار الصوت</button>
          {settings.hasAzure && (
            <button className="btn btn-ghost danger" onClick={() => save({ azureKey: "" })} disabled={busy}>إيقاف الصوت السحابي</button>
          )}
        </div>
      </section>

      <div className="save-row">
        <button className="btn btn-primary" onClick={() => save()} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
      </div>
    </div>
  );
}

export default function Admin({ onMenu }) {
  const { me, refresh } = useMe();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("users");
  const [editing, setEditing] = useState(null); // null | "new" | user
  const [created, setCreated] = useState(null); // {username,password} لعرضها مرة واحدة
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try { setData(await api("/admin/overview")); } catch (err) { toast(err.message, "error"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="page"><div className="center-pad"><div className="spinner" /></div></div>;

  const onSaved = (u, creds) => {
    setEditing(null);
    if (creds) setCreated({ ...creds, name: u.displayName });
    load();
    if (u.id === me.user.id) refresh();
  };

  const resetPw = async (u) => {
    if (!confirm(`إعادة تعيين كلمة مرور ${u.displayName}؟\n\nتنبيه: محادثاته وملفاته الحالية ستُمسح نهائيًا، لأنها مشفّرة بكلمة مروره القديمة ولا أحد يملك مفتاحها.`)) return;
    const password = randomPassword();
    try {
      await api(`/admin/users/${u.id}/reset-password`, { method: "POST", body: { password } });
      setCreated({ username: u.username, password, name: u.displayName, reset: true });
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  const toggleDisabled = async (u) => {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { disabled: !u.disabled } });
      toast(u.disabled ? "تم تفعيل الحساب" : "تم إيقاف الحساب وتسجيل خروجه من كل الأجهزة", "success");
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  const remove = async (u) => {
    if (!confirm(`حذف حساب ${u.displayName} نهائيًا مع كل محادثاته وملفاته؟`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  const roleTitle = (u) => (u.agent?.role === "custom" ? u.agent.customTitle || "دور مخصّص" : data.roles.find((r) => r.id === u.agent?.role)?.title);
  const users = data.users.filter((u) => !q || `${u.displayName} ${u.username} ${u.jobTitle}`.toLowerCase().includes(q.toLowerCase()));
  const active = data.users.filter((u) => !u.disabled).length;

  return (
    <div className="page">
      <header className="page-head">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="القائمة"><Icon name="menu" /></button>
        <h1>لوحة الإدارة</h1>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "users"} className={tab === "users" ? "is-on" : ""} onClick={() => setTab("users")}>الموظفون</button>
          <button role="tab" aria-selected={tab === "settings"} className={tab === "settings" ? "is-on" : ""} onClick={() => setTab("settings")}>الإعدادات</button>
        </div>
      </header>

      <div className="page-body">
        <div className="kpis">
          <div className="kpi"><span>الحسابات النشطة</span><strong>{active}</strong></div>
          <div className="kpi"><span>استهلاك الشهر</span><strong dir="ltr">{fmtUsd(data.totals.usd)}</strong></div>
          <div className="kpi"><span>رسائل الشهر</span><strong>{data.totals.messages}</strong></div>
          <div className={`kpi ${data.settings.hasAnthropicKey ? "" : "kpi-warn"}`}>
            <span>مفتاح Claude</span>
            <strong>{data.settings.hasAnthropicKey ? "مضبوط" : "غير مضبوط"}</strong>
          </div>
        </div>

        <div className="banner banner-info">
          <Icon name="shield" size={18} />
          الإدارة تتحكم في الحسابات والحدود فقط — محادثات وملفات كل موظف مشفّرة بكلمة مروره، ولا يمكن لأحد غيره قراءتها (ولا حتى المدير).
        </div>

        {tab === "users" && (
          <>
            <div className="toolbar">
              <input className="search" placeholder="بحث عن موظف…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={18} /> إضافة موظف</button>
            </div>
            <div className="user-grid">
              {users.map((u) => {
                const lim = u.limits?.monthlyUsd || 0;
                return (
                  <article key={u.id} className={`user-card ${u.disabled ? "is-disabled" : ""}`}>
                    <div className="user-card-head">
                      <AgentAvatar name={u.agent?.name} gender={u.agent?.gender} size={42} />
                      <div className="user-card-meta">
                        <strong>{u.displayName} {u.isAdmin && <span className="pill">إدارة</span>} {u.disabled && <span className="pill pill-muted">موقوف</span>}</strong>
                        <small dir="ltr" className="muted">@{u.username}</small>
                        <small>{u.jobTitle}</small>
                      </div>
                    </div>
                    <div className="user-card-agent">
                      <Icon name="sparkle" size={14} /> {u.agent?.name} — {roleTitle(u)}
                    </div>
                    <div className="usage-row">
                      <span>هذا الشهر</span>
                      <span dir="ltr">{fmtUsd(u.usage.month.usd)}{lim ? ` / ${fmtUsd(lim)}` : " · بلا حد"}</span>
                    </div>
                    {lim > 0 && <Meter value={u.usage.month.usd} max={lim} />}
                    <div className="user-card-stats muted small">
                      <span>{u.usage.month.messages} رسالة</span>
                      <span>{fmtBytes(u.storageBytes)}</span>
                      <span>{u.usage.lastActive ? `آخر نشاط ${fmtDate(u.usage.lastActive)}` : "لم يدخل بعد"}</span>
                    </div>
                    <div className="user-card-actions">
                      <button className="btn btn-ghost sm" onClick={() => setEditing(u)}><Icon name="edit" size={15} /> تعديل</button>
                      {u.id !== me.user.id && (
                        <>
                          <button className="btn btn-ghost sm" onClick={() => resetPw(u)}><Icon name="key" size={15} /> كلمة المرور</button>
                          <button className="btn btn-ghost sm" onClick={() => toggleDisabled(u)}>{u.disabled ? "تفعيل" : "إيقاف"}</button>
                          <button className="icon-btn sm danger" onClick={() => remove(u)} aria-label="حذف"><Icon name="trash" size={15} /></button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === "settings" && (
          <OrgSettings
            settings={data.settings}
            models={data.models}
            onSaved={(s) => { setData((d) => ({ ...d, settings: s })); refresh(); }}
          />
        )}
      </div>

      {editing && <UserEditor data={data} user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}

      {created && (
        <Modal title={created.reset ? "كلمة المرور الجديدة" : "تم إنشاء الحساب"} onClose={() => setCreated(null)}
          footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>تم</button>}>
          <p>أرسل بيانات الدخول إلى <strong>{created.name}</strong> (تظهر الآن فقط):</p>
          <div className="creds" dir="ltr">
            <div><span>Link</span><code>{window.location.origin}</code></div>
            <div><span>User</span><code>{created.username}</code></div>
            <div><span>Password</span><code>{created.password}</code></div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => navigator.clipboard.writeText(`الرابط: ${window.location.origin}\nاسم الدخول: ${created.username}\nكلمة المرور المؤقتة: ${created.password}`).then(() => toast("تم النسخ", "success"))}
          >
            <Icon name="copy" size={16} /> نسخ البيانات
          </button>
          <p className="muted small">سيُطلب منه تغيير كلمة المرور عند أول دخول.</p>
        </Modal>
      )}
    </div>
  );
}
