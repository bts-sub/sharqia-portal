// ===========================================================================
// schedule.js — تبويب «جدولي»: مهامّي واجتماعاتي
//
// ⚠️ صفحةٌ مستقلّةٌ بمصدرٍ مقروء، لا شيءَ منها داخل الحزمة المُصغَّرة:
//    واجهةُ البوابة (public/index.html) حزمةٌ مبنيّةٌ لا مصدرَ لها في
//    الريبو، فكلُّ ما يُكتب داخلها يُكتب مرّةً ويُقرأ بعدها بصعوبة،
//    ويضيع إن أُعيد بناؤها. وهذه الصفحةُ على نمط join.html و
//    support.html: تُخدَم من الخادم نفسِه، وتُطوَّر كأيِّ ملفٍّ آخر.
//
// ⚠️ ولا بناءَ لها ولا حزم: جافاسكربت عاديّةٌ تعمل كما هي في المتصفّح،
//    فلا تُضيف خطوةَ بناءٍ إلى مشروعٍ ليس فيه واحدة.
//
// ⚠️ والمصادقةُ بكوكي الجلسة نفسِه: الصفحةُ على النطاق ذاته، فتصل
//    الكوكي تلقائيًّا ولا يُخزَّن رمزٌ ثانٍ في المتصفّح.
// ===========================================================================

const $ = (s, r = document) => r.querySelector(s);
const el = (t, a = {}, ...kids) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
};

// ── نداءُ الخادم ───────────────────────────────────────────────────────
async function call(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) { location.href = "/"; throw new Error("الجلسة منتهية"); }
  let body = null;
  try { body = await res.json(); } catch { /* قد يردّ الخادمُ بلا جسم */ }
  if (!res.ok) throw new Error(body?.error || body?.message || "تعذّر الاتصال");
  return body;
}
const api = {
  tasks: () => call("/api/schedule/tasks"),
  deptTasks: () => call("/api/schedule/tasks/dept"),
  team: () => call("/api/schedule/team"),
  people: (q, dept) => call("/api/schedule/people?q=" + encodeURIComponent(q || "")
    + (dept ? "&dept=" + dept : "")),
  depts: () => call("/api/schedule/depts"),
  week: (from, to) => call("/api/schedule/week?from=" + encodeURIComponent(from)
    + (to ? "&to=" + encodeURIComponent(to) : "")),
  one: (id) => call("/api/schedule/tasks/" + id),
  progress: (id, percent, text, final) =>
    call("/api/schedule/tasks/" + id + "/progress",
      { method: "POST", body: JSON.stringify({ percent, text, final }) }),
  plan: (id, start, stop) => call("/api/schedule/tasks/" + id + "/plan",
    { method: "POST", body: JSON.stringify({ start, stop }) }),
  busy: (b) => call("/api/schedule/meetings/busy",
    { method: "POST", body: JSON.stringify(b) }),
  comment: (id, text) => call("/api/schedule/tasks/" + id + "/comment",
    { method: "POST", body: JSON.stringify({ text }) }),
  upload: (b) => call("/api/attachments", { method: "POST", body: JSON.stringify(b) }),
  createTask: (b) => call("/api/schedule/tasks", { method: "POST", body: JSON.stringify(b) }),
  assign: (id, employeeId) => call(`/api/schedule/tasks/${id}/assign`,
    { method: "POST", body: JSON.stringify({ employeeId }) }),
  move: (id, to) => call(`/api/schedule/tasks/${id}/move`,
    { method: "POST", body: JSON.stringify({ to }) }),
  decide: (id, b) => call(`/api/schedule/tasks/${id}/decide`,
    { method: "POST", body: JSON.stringify(b) }),
  meetings: (from, to) => call("/api/schedule/meetings"
    + (from ? "?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to || from) : "")),
  slots: (b) => call("/api/schedule/meetings/slots", { method: "POST", body: JSON.stringify(b) }),
  createMeeting: (b) => call("/api/schedule/meetings", { method: "POST", body: JSON.stringify(b) }),
  updateMeeting: (id, b) => call(`/api/schedule/meetings/${id}/update`,
    { method: "POST", body: JSON.stringify(b) }),
  cancelMeeting: (id, reason) => call(`/api/schedule/meetings/${id}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) }),
  respond: (id, accept) => call(`/api/schedule/meetings/${id}/respond`,
    { method: "POST", body: JSON.stringify({ accept }) }),
};

// ── تنسيقُ الوقت ───────────────────────────────────────────────────────
// ⚠️ أودو يُرسل الوقتَ بتوقيت UTC بلا لاحقة، فتُضاف Z قبل التحويل —
//    وإلّا قرأه المتصفّحُ وقتًا محلّيًّا وأزاح كلَّ موعدٍ ثلاثَ ساعات.

/** يومٌ وساعةٌ بتوقيت الرياض → نصُّ أودو بـUTC. */
function riyadhToOdoo(day, hhmm) {
  if (!day) return null;
  const d = new Date(`${day}T${hhmm || "12:00"}:00+03:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
const toDate = (s) => (s ? new Date(String(s).replace(" ", "T") + "Z") : null);
const AR_DATE = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory",
  { weekday: "short", day: "numeric", month: "short" });
const AR_TIME = new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s) => (toDate(s) ? AR_DATE.format(toDate(s)) : "—");
const fmtTime = (s) => (toDate(s) ? AR_TIME.format(toDate(s)) : "—");

/** يومُ وقتٍ من أودو (UTC) بتوقيت الرياض — YYYY-MM-DD و HH:MM. */
const riyadhParts = (s) => {
  const d = toDate(s);
  if (!d) return { day: "", time: "" };
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh",
    year: "numeric", month: "2-digit", day: "2-digit" });
  const g = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh",
    hour: "2-digit", minute: "2-digit", hour12: false });
  return { day: f.format(d), time: g.format(d) };
};
const isoOf = (s) => riyadhParts(s).day;
const hhmmOf = (s) => riyadhParts(s).time;
const fmtWhen = (s) => (toDate(s) ? `${fmtDay(s)} · ${fmtTime(s)}` : "—");

// ⚠️ الصفحةُ تُفتح داخل التطبيق في إطارٍ لا في تبويبٍ جديد: فالرجوعُ
//    يُغلق الإطارَ لا يُغادر الصفحة. ومن فتحها مباشرةً برابطها يرجع كما
//    يرجع من أيّ صفحة.
const EMBED = (function () {
  try { return window.top !== window.self; } catch (e) { return true; }
})();
function goBack() {
  if (EMBED) {
    try { parent.postMessage({ sq: "schedule-close" }, location.origin); return; }
    catch (e) { /* يسقط إلى الرجوع العاديّ */ }
  }
  if (history.length > 1) history.back(); else location.href = "/";
}

// ⚠️ ثلاثُ أولويّاتٍ بألوانٍ تُقرأ من بعيد: عاجلةٌ حمراءُ ومهمّةٌ
//    برتقاليّةٌ وعاديّةٌ رماديّة — بطلب الإدارة.

/** نصٌّ آمنٌ للعرض: ما كان فارغًا أو حرفَ «null» يصير "".
 *  ⚠️ دفاعيٌّ: شُوهدت «null» في التفاصيل ولم أُعِد إنتاجَ موضعها —
 *     فيُحرَس المَخرجُ نفسُه بدل تتبّع كلِّ مدخل. */
const txt = (v) => {
  const s = (v === null || v === undefined || v === false) ? "" : String(v);
  const k = s.trim().toLowerCase();
  return (k === "null" || k === "undefined" || k === "false") ? "" : s;
};
const PRIO_AR = { 0: "عادية", 1: "مهمة", 2: "عاجلة" };
const prioBadge = (p) => {
  const k = String(p == null ? "0" : p);
  return el("span", { class: "pri pri" + (k === "1" || k === "2" ? k : "0") },
    PRIO_AR[k] || PRIO_AR[0]);
};
const STAGE_AR = { inbox: "وارد", new: "جديدة", received: "مستلمة",
  doing: "قيد التنفيذ", review: "بانتظار الاعتماد", done: "مكتملة" };

function toast(msg, bad = false) {
  const t = el("div", { class: bad ? "err" : "card",
    // ⚠️ فوق الأزرارِ لا عليها: كانت الرسالةُ أسفلَ الشاشة فتغطّي أزرارَ
    //    الورقة، فيقرأ المستخدمُ خطأَه ولا يصل إلى زرِّ تصحيحه.
    style: "position:fixed;inset-inline:16px;bottom:96px;z-index:60;"
      + "text-align:center;box-shadow:var(--sh-2)" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ══ مهامّي ════════════════════════════════════════════════════════════
// ⚠️ الترتيبُ بالمرحلة لا بالتاريخ: الموظّفُ يفتح جدولَه ليعرف ما يعمله
//    الآن، فما هو «قيد التنفيذ» فوق ما لم يبدأ. والمنتهيةُ آخرًا ومطويّة.
const MY_ORDER = ["doing", "review", "received", "new", "inbox", "done"];
/** شريطُ نسبةٍ صغيرٌ للبطاقات — عنصرٌ واحدٌ يقرأ المحفوظَ لا غير. */
function miniBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct || 0)));
  return el("div", { class: "row", style: "gap:8px;margin-top:6px" },
    el("div", { style: "flex:1;height:7px;border-radius:99px;"
      + "background:var(--line-2);overflow:hidden" },
      el("div", { style: "height:100%;border-radius:99px;"
        + "background:var(--gold);width:" + Math.max(2, p) + "%" })),
    el("span", { class: "meta", style: "font-weight:700" }, p + "%"));
}


function taskCard(t, onAct, refresh) {
  const late = t.late && t.stage !== "done";
  const full = Number(t.progress || 0) >= 100;
  // ⚠️ زرٌّ صريحٌ للفتح لا العنوانَ وحدَه: على الهاتف لا مؤشّرَ يتبدّل،
  //    فلا يدري المسنَدُ إليه أنّ العنوانَ بابٌ — فيقرأ سطرًا واحدًا ويظنّ
  //    أنّ هذا كلُّ ما طُلب منه، وفيها المطلوبُ والمرفقاتُ والردود.
  const acts = [["اقرأ المطلوب وردّ", () => openTask(t.id, refresh), false]];
  // ⚠️ «استلمتُها» قبل «ابدأ العمل»: الاستلامُ خبرٌ لمن أسندها — يُسند
  //    ثمّ ينتظر فلا يدري أوصلت أم ضاعت.
  if (t.stage === "new") acts.push(["استلمتُها", () => onAct(t, "received"), true]);
  if (t.stage === "received") acts.push(["ابدأ العمل", () => onAct(t, "doing"), true]);
  // ⚠️ والرفعُ للاعتماد من داخل الورقة لا من البطاقة: صار يلزمه تقريرٌ
  //    ختاميٌّ يُكتب، ولا موضعَ لكتابته هنا.
  if (t.stage === "doing" && full)
    acts.push(["ارفعها للاعتماد", () => openTask(t.id, refresh), true]);
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openTask(t.id, refresh) }, t.name),
      prioBadge(t.priority),
      el("span", { class: "pill" + (late ? " late" : "") },
        late ? "متأخرة" : STAGE_AR[t.stage] || t.stageName || "")),
    el("div", { class: "meta" },
      [t.requester ? "من: " + t.requester : t.dept,
        t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
    // ⚠️ والنسبةُ على البطاقة لا داخلَ الورقة وحدَها: صاحبُها يحتاج أن
    //    يعرف ما ينقصه قبل أن يفتح، وبها يفهم لماذا لا يرى زرَّ الرفع.
    t.stage === "done" ? null : miniBar(t.progress),
    t.stage === "doing" && !full
      ? el("div", { class: "meta", style: "margin-top:4px" },
        "أكمِل النسبة إلى 100% لترفعها للاعتماد.")
      : null,
    t.returnNote
      ? el("div", { class: "err", style: "margin-top:8px" }, "أُرجعت: " + t.returnNote)
      : null,
    t.description
      ? el("div", { class: "meta", style: "margin-top:6px", html: txt(t.description) })
      : null,
    acts.length
      ? el("div", { class: "row", style: "margin-top:10px" },
        acts.map(([lbl, fn, pri]) =>
          el("button", { class: "btn" + (pri ? " pri" : ""), onclick: fn }, lbl)))
      : null);
}

// ⚠️ بطاقةُ ما أرسلتَه غيرُ بطاقةِ ما عليك: لا أزرارَ عمل — أنت لا تُنفّذها
//    ولا تنقل مرحلتَها — إنّما تقرأ أين وصلت ومَن أخذها، وتفتحها لتقرأ
//    تعليقاتِها أو تُضيف توضيحًا. و«في الوارد» تعني أنّ مديرَ القسم لم
//    يوزّعها بعد، وهذا أهمُّ ما يريد المرسِلُ معرفتَه.
function sentCard(t, refresh) {
  const late = t.late && t.stage !== "done";
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openTask(t.id, refresh) }, t.name),
      prioBadge(t.priority),
      el("span", { class: "pill" + (late ? " late" : "") },
        late ? "متأخرة" : STAGE_AR[t.stage] || t.stageName || "")),
    el("div", { class: "meta" },
      [t.dept,
        t.assignee ? "عند: " + t.assignee : "في الوارد — لم تُوزَّع بعد",
        t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
    t.stage === "done" ? null : miniBar(t.progress),
    el("div", { class: "row", style: "margin-top:8px" },
      el("button", { class: "btn",
        onclick: () => openTask(t.id, refresh) },
        t.stage === "review" ? "راجِعها واعتمدها" : "التفاصيل والتقارير")));
}


// ══ البحثُ والترشيح ═══════════════════════════════════════════════════
// ⚠️ يُرشَّح المحمَّلُ ولا يُنادى الخادمُ عند كلِّ حرف: «مهامي» مئتان
//    و«قسمي» أربعُمئةٍ سقفًا، فالترشيحُ فيها لحظيٌّ بلا انتظار — ونداءُ
//    الخادم مع كلِّ ضغطةٍ يجعل البحثَ أبطأ من القراءة بالعين.
//
// ⚠️ والمطابقةُ بعد تجريد العربيّة: العناوينُ هنا مشكولةٌ («مهمّة»)، ومن
//    يبحث يكتب بلا شكلٍ ولا همزة («مهمه») — فلو قُورن الحرفُ بالحرف لما
//    وجد شيئًا أبدًا. فتُحذف الحركاتُ والتطويل، وتُوحَّد الألفُ والياءُ
//    والتاءُ المربوطة.
const norm = (s) => String(s || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/[\u064B-\u0652\u0640]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/[ىئ]/g, "ي").replace(/ؤ/g, "و")
  .replace(/ة/g, "ه")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

// ⚠️ خمسُ حالاتٍ في المرشِّح والنظامُ فيه ستّ: «مستلمة» تُطوى في
//    «جديدة». و«بانتظار الاعتماد» صارت شريطًا قائمًا بذاته بعد التجربة.
//    والحالةُ الحقيقيّةُ تبقى مكتوبةً على شارة الكرت، فلا يضيع التمييز.
const FOLD = {
  new: ["new", "received"],
  doing: ["doing"],
  review: ["review"],
  done: ["done"],
};
// ⚠️ و«بانتظار الاعتماد» شريطٌ قائمٌ بذاته: هو الطابورُ الذي ينتظر
//    قرارَ المنشئ، ومن لم يره لم يعرف ما عليه أن يبتّ فيه.
const TASK_FILTERS = [["", "الكل"], ["new", "جديدة"],
  ["doing", "قيد التنفيذ"], ["review", "بانتظار الاعتماد"],
  ["done", "منتهية"], ["late", "متأخرة"]];

function matchTask(t, f) {
  if (f.stage === "late") {
    if (!(t.late && t.stage !== "done")) return false;
  } else if (f.stage) {
    if (!(FOLD[f.stage] || [f.stage]).includes(t.stage)) return false;
  }
  if (f.dept && Number(t.deptId || 0) !== f.dept) return false;
  const names = (t.assignees || [t.assignee]).filter(Boolean);
  if (f.who && !names.some((n) => norm(n) === f.who)) return false;
  if (!f.q) return true;
  // القسمُ والمسنَدُ إليه في المطابقة أيضًا: من يكتب «المبيعات» يقصد
  // مهامَّها، ومن يكتب اسمًا يقصد ما عليه.
  return norm(`${t.name} ${t.description || ""} ${names.join(" ")} ${t.dept || ""}`)
    .includes(f.q);
}

/** شريطُ بحثٍ ومرشِّحات. يُعيد {node, f} — و f يُقرأ عند كلِّ رسم. */
function filterBar(opts) {
  const f = { q: "", stage: "", dept: 0, who: "" };
  const fire = () => opts.onChange();
  const q = el("input", { type: "search", placeholder: "ابحث في العنوان أو التفصيل…",
    oninput: (e) => { f.q = norm(e.target.value); fire(); } });
  const chips = el("div", { class: "chips" });
  const drawChips = () => chips.replaceChildren(
    ...(opts.filters || TASK_FILTERS).map(([k, l]) =>
      el("button", { class: "slot", "aria-pressed": String(f.stage === k),
        onclick: () => { f.stage = k; drawChips(); fire(); } }, l)));
  drawChips();
  const kids = [q, chips];
  if ((opts.depts || []).length > 1) {
    kids.push(el("select", { style: "margin-top:6px",
      onchange: (e) => { f.dept = Number(e.target.value); fire(); } },
      el("option", { value: "0" }, "كلُّ الأقسام"),
      ...opts.depts.map((d) => el("option", { value: String(d.id) }, d.name))));
  }
  if ((opts.people || []).length > 1) {
    kids.push(el("select", { style: "margin-top:6px",
      onchange: (e) => { f.who = e.target.value ? norm(e.target.value) : ""; fire(); } },
      el("option", { value: "" }, "كلُّ الموظفين"),
      ...opts.people.map((n) => el("option", { value: n }, n))));
  }
  return { node: el("div", { style: "margin:10px 0 2px" }, ...kids), f };
}

// ══ تبويبُ المهامّ ════════════════════════════════════════════════════
// ⚠️ مِحورانِ لا قائمةٌ واحدة: «المسندة إليّ» عملُك، و«اللي أسندتها»
//    متابعتُك. ولو جُمعا لعُدَّ على المرء ما سلّمه لغيره.
// ⚠️ و«وارِدُ قسمي» تحت الثانية للمدير وحدَه: هو مهبطُ كلِّ طلبٍ يأتي
//    قسمَه من خارجه، ولو لم يُعرض لبقي لا يوزّعه أحد.
async function viewTasks(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let data;
  try { data = await api.tasks(); }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }
  const recs = data.records || [];
  const sent = data.sent || [];
  const isMgr = ME.managed.length > 0;
  const refresh = () => viewTasks(host);
  let scope = "mine";

  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow" }),
    el("button", { class: "btn pri",
      onclick: () => newTaskSheet(refresh) }, "+ مهمة"));

  const scopeBar = el("div", { class: "seg", role: "tablist",
    style: "margin:4px 0 0" });
  const drawScope = () => scopeBar.replaceChildren(
    ...[["mine", `المسندة إليّ (${recs.length})`],
      ["sent", `اللي أسندتها (${sent.length})`]].map(([k, l]) =>
      el("button", { role: "tab", "aria-selected": String(scope === k),
        onclick: () => { scope = k; drawScope(); redraw(); } }, l)));
  drawScope();

  const onAct = async (t, to) => {
    try { await api.move(t.id, to); toast("تمّ"); refresh(); }
    catch (e) { toast(e.message, true); }
  };

  const listHost = el("div", {});
  const people = [...new Set(sent.map((t) => t.assignee).filter(Boolean))].sort();
  const bar = filterBar({ people, onChange: () => redraw() });

  const redraw = () => {
    const f = bar.f;
    const out = [];
    if (scope === "mine") {
      const list = recs.filter((t) => matchTask(t, f));
      if (!list.length) {
        out.push(el("div", { class: "empty" },
          recs.length ? "لا مهمّةَ تطابق البحث." : "لا مهامَّ عليك الآن."));
      } else {
        const byStage = new Map();
        for (const t of list) {
          if (!byStage.has(t.stage)) byStage.set(t.stage, []);
          byStage.get(t.stage).push(t);
        }
        for (const st of MY_ORDER) {
          const l = byStage.get(st);
          if (!l || !l.length) continue;
          out.push(el("div", { class: "meta",
            style: "margin:14px 2px 2px;font-weight:700" },
            `${STAGE_AR[st] || st} (${l.length})`));
          for (const t of l) out.push(taskCard(t, onAct, refresh));
        }
      }
    } else {
      const list = sent.filter((t) => matchTask(t, f));
      if (!list.length) {
        out.push(el("div", { class: "empty" },
          sent.length ? "لا مهمّةَ تطابق البحث." : "لم تُسنِد شيئًا بعد."));
      } else {
        for (const t of list) out.push(sentCard(t, refresh));
      }
      // وارِدُ القسم للمدير: ما وصل قسمَه ولم يُوزَّع بعد
      const inbox = (ME.inbox || []).filter((t) => matchTask(t, f));
      if (isMgr) {
        out.push(el("div", { class: "meta",
          style: "margin:18px 2px 2px;font-weight:700" },
          `وارِدُ قسمي (${inbox.length})`));
        if (!inbox.length) {
          out.push(el("div", { class: "meta", style: "padding:2px" },
            "لا طلباتٍ تنتظر التوزيع."));
        } else {
          for (const t of inbox) out.push(deptCard(t, ME.team, refresh,
            ME.managed.length > 1));
        }
      }
    }
    listHost.replaceChildren(...out);
  };

  host.replaceChildren(head, scopeBar, bar.node, listHost);
  redraw();
}

// ══ تفاصيلُ المهمّة: النسبةُ والتعليقاتُ والمرفقات ═══════════════════
// ⚠️ شاشةٌ واحدةٌ لكلِّ ما يخصّ المهمّة: كان الموظّفُ ينقلها من البطاقة
//    ولا يملك أن يقول «أنجزتُ ستّين» ولا أن يسأل سؤالًا ولا أن يُرفق
//    ورقة. فصارت البطاقةُ بابًا يُفتح على كلِّ ذلك.
function openTask(id, refresh) {
  const body = el("div", {}, el("div", { class: "sk" }), el("div", { class: "sk" }));
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } }, el("div", {}, body));
  document.body.append(sheet);

  const close = () => { sheet.remove(); if (refresh) refresh(); };
  const draw = async () => {
    let d;
    try { d = await api.one(id); }
    catch (e) { body.replaceChildren(el("div", { class: "err" }, e.message)); return; }
    const t = d.task;
    const late = t.late && t.stage !== "done";

    // ── النسبة ──
    let bar, pct, rep, sendBtn, planDay, planA, planB;
    // ⚠️ القيمةُ المعروضةُ هي قيمةُ المِزلاق نفسِها في كلِّ لحظة: كانت
    //    الشارةُ تُرسم من المحفوظ والمِزلاقُ من اختيار اليد، فيقرأ المرءُ
    //    رقمًا ويحفظ غيرَه.
    const setPct = (v) => {
      pct.textContent = v + "%";
      bar.style.width = Math.max(2, v) + "%";
      if (sendBtn) sendBtn.textContent = v >= 100 ? "أرسل للاعتماد" : "أرسل التحديث";
    };
    const slider = el("input", { type: "range", min: "0", max: "100", step: "5",
      value: String(t.progress || 0),
      oninput: (e) => setPct(Number(e.target.value)) });
    const track = el("div", { style: "height:8px;border-radius:99px;"
      + "background:var(--line-2);overflow:hidden;margin:6px 0" },
      (bar = el("div", { style: "height:100%;border-radius:99px;"
        + "background:var(--gold);width:2%" })));
    pct = el("span", { class: "pill" }, (t.progress || 0) + "%");

    // ── التعليقات ──
    let cbox;
    const clist = el("div", {}, ...(d.comments.length
      ? d.comments.map((c) => el("div", { class: "card",
        style: "padding:9px 11px;margin:6px 0" },
        el("div", { class: "meta", style: "font-weight:700" },
          c.who + " · " + fmtWhen(c.at)),
        el("div", {}, txt(c.text))))
      : [el("div", { class: "meta" }, "لا ردودَ بعد.")]));

    // ── المرفقات ──
    const flist = el("div", { class: "row", style: "gap:6px" },
      ...(d.files.length
        ? d.files.map((f) => el("a", { class: "slot", href: "/api/attachments/" + f.id,
          target: "_blank", rel: "noopener" }, f.name))
        : [el("div", { class: "meta" }, "لا مرفقات.")]));
    const picker = el("input", { type: "file", style: "display:none",
      onchange: async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 8 * 1024 * 1024) { toast("الملفُّ أكبر من ٨ ميجابايت", true); return; }
        toast("يُرفع…");
        const rd = new FileReader();
        rd.onload = async () => {
          try {
            await api.upload({ fileName: f.name,
              base64: String(rd.result).split(",")[1] || "",
              resModel: "project.task", resId: t.id });
            toast("رُفع"); draw();
          } catch (er) { toast(er.message, true); }
        };
        rd.readAsDataURL(f);
      } });

    const acts = [];
    const full = Number(t.progress || 0) >= 100;
    // «بدأ العمل»: ما بعد «مستلمة» — وعندها تظهر النسبةُ والتقرير
    const started = t.stage === "doing" || t.stage === "review";
    if (t.mine && t.stage === "new")
      acts.push(["استلمتُها", async () => {
        try { await api.move(t.id, "received"); toast("استُلمت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    if (t.mine && t.stage === "received")
      acts.push(["ابدأ العمل", async () => {
        try { await api.move(t.id, "doing"); toast("بدأت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    // ⚠️ والاعتمادُ والإقفالُ **لمن أنشأ المهمّة** — لا لمديرِ قسمِ
    //    المنفِّذ. يرسلها الخادمُ في can أيضًا، وهذا للعرض فقط.
    const owner = t.canClose;
    if (owner && t.stage === "review") {
      if (full)
        acts.push(["اعتماد وإقفال", async () => {
          try { await api.decide(t.id, { approve: true }); toast("اعتُمدت"); close(); }
          catch (e) { toast(e.message, true); } }, true]);
      acts.push(["إرجاع بملاحظة", () => returnSheet(async (note) => {
        try { await api.decide(t.id, { note }); toast("أُرجعت"); close(); }
        catch (e) { toast(e.message, true); } })]);
    }
    // سطرٌ يقول ما ينقص قبل الإقفال — لصاحبها وللمنشئ بلفظٍ يناسب كلًّا
    const gap = !full && (
      (t.mine && t.stage === "doing")
        ? `أكمِل النسبة إلى 100% لترفعها للاعتماد — الآن ${t.progress || 0}%.`
        : (owner && t.stage === "review")
          ? `أقرّ صاحبُها بـ${t.progress || 0}% — لا تُقفل ناقصةً، أرجِعها ليُكملها.`
          : "");

    // ── سجلُّ التقارير ──
    // ⚠️ سطورٌ مرقومةٌ لا تعليقاتٌ منثورة: المنشئُ يقرأ متى بلغت الستّين
    //    وبأيِّ شيءٍ بلغها ومن قال ذلك — وهذا ما يُراجَع عند الاعتماد.
    const reps = d.reports || [];
    const rlist = el("div", {}, ...(reps.length
      ? reps.map((r) => el("div", { class: "card",
        style: "padding:9px 11px;margin:6px 0" },
        el("div", { class: "row" },
          el("span", { class: "pill" + (r.final ? " ok" : "") },
            (r.progress || 0) + "%"),
          el("div", { class: "grow meta", style: "font-weight:700" },
            (r.who || "—") + " · " + fmtWhen(r.at)),
          r.final ? el("span", { class: "meta" }, "ختامي") : null),
        el("div", { style: "margin-top:4px" }, txt(r.text)),
        (r.files || []).length
          ? el("div", { class: "row", style: "gap:6px;margin-top:6px" },
            ...r.files.map((f) => el("a", { class: "slot",
              href: "/api/attachments/" + f.id, target: "_blank",
              rel: "noopener" }, f.name || "مرفق")))
          : null))
      : [el("div", { class: "meta" }, "لا تقارير بعد.")]));

    body.replaceChildren(
      el("div", { class: "row" },
        el("h3", { class: "grow", style: "margin:2px 0" }, t.name),
        prioBadge(t.priority),
        el("span", { class: "pill" + (late ? " late" : "") },
          late ? "متأخرة" : STAGE_AR[t.stage] || t.stageName || "")),
      el("div", { class: "meta" },
        [t.requester ? "المرسل: " + t.requester : t.dept,
          t.assignee ? "المسنَد إليه: " + t.assignee : null,
          "الأولوية: " + (PRIO_AR[String(t.priority || "0")] || ""),
          t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
          .filter(Boolean).join(" · ")),
      t.returnNote ? el("div", { class: "err", style: "margin-top:8px" },
        "أُرجعت: " + t.returnNote) : null,
      // ⚠️ «المطلوب» بعنوانه وبخطٍّ مقروء: كان يُعرض هامشًا رماديًّا صغيرًا
      //    بلا عنوان، فيقرؤه المسنَدُ إليه تذييلًا لا أمرًا — وهو أهمُّ ما
      //    في المهمّة. ومن لا تفصيلَ لمهمّته يُقال له: اسأل في الردود.
      el("label", {}, "المطلوب"),
      t.description
        ? el("div", { class: "card", style: "margin:4px 0 2px;padding:11px 13px",
          html: txt(t.description) })
        : el("div", { class: "meta" }, "لا تفصيلَ مكتوبًا — اسأل في الردود أدناه."),
      // ⚠️ ولا تظهر النسبةُ قبل «ابدأ العمل»: من لم يبدأ لا نسبةَ له،
      //    ومِزلاقٌ معروضٌ على مهمّةٍ لم تُبدأ دعوةٌ إلى رقمٍ بلا معنى.
      //    (وتُعرض للمنشئ دائمًا — هو يقرأ لا يكتب.)
      (started || !t.mine) ? el("label", {}, "نسبة الإنجاز") : null,
      (started || !t.mine)
        ? el("div", { class: "row" }, pct, el("div", { class: "grow" }, track))
        : null,
      t.mine && started ? slider : null,
      // ⚠️ ولا تُحفظ نسبةٌ بلا تقرير: من قرأ «ستّين» يحتاج أن يعرف بأيِّ
      //    شيءٍ بلغها. والخادمُ يردُّها بلا نصّ، فيُسأل عنه هنا في موضعه.
      t.mine && started ? el("label", {}, "ما أنجزتَه (يُحفظ مع النسبة)") : null,
      t.mine && started ? (rep = el("textarea", { style: "min-height:58px",
        placeholder: "مثلًا: رُوجعت العقودُ الخمسةُ وبقي اثنان" })) : null,
      // ⚠️ زرٌّ واحدٌ يتبدّل اسمُه عند المئة لا زرّان: «أرسل التحديث» ما
      //    دامت ناقصةً، و«أرسل للاعتماد» عند المئة — فالفعلُ واحدٌ في
      //    حقيقته (تقريرٌ بنسبة)، واختلافُ الاسم يُعلم صاحبَه بأثره.
      t.mine && started ? (sendBtn = el("button", { class: "btn pri",
        style: "margin-top:6px;width:100%",
        onclick: async (ev) => {
          const txt = rep.value.trim();
          if (!txt) { toast("اكتب ما أنجزتَه", true); return; }
          const p = Number(slider.value);
          ev.target.disabled = true;
          try {
            await api.progress(t.id, p, txt, p >= 100);
            toast(p >= 100 ? "رُفعت للاعتماد" : "أُرسل التحديث"); draw();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, Number(t.progress || 0) >= 100
        ? "أرسل للاعتماد" : "أرسل التحديث")) : null,
      // ⚠️ وقتُ التنفيذ غيرُ موعد التسليم: الموعدُ آخرُ ما يُقبل، وهذا
      //    متى تنوي أن تعملها — وبه تظهر في «جدولي» في ساعتها.
      t.mine ? el("label", {}, "وقتُ التنفيذ في جدولي (اختياري)") : null,
      t.mine ? el("div", { class: "row", style: "gap:6px" },
        el("div", { class: "grow" },
          (planDay = el("input", { type: "date",
            value: t.planStart ? isoOf(t.planStart) : "" }))),
        el("div", { class: "grow" },
          (planA = el("input", { type: "time",
            value: t.planStart ? hhmmOf(t.planStart) : "09:00" }))),
        el("div", { class: "grow" },
          (planB = el("input", { type: "time",
            value: t.planStop ? hhmmOf(t.planStop) : "10:00" })))) : null,
      t.mine ? el("div", { class: "row", style: "margin-top:6px" },
        el("button", { class: "btn", onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            if (!planDay.value) {
              await api.plan(t.id, "", "");
              toast("أُزيل وقتُ التنفيذ");
            } else {
              await api.plan(t.id,
                riyadhToOdoo(planDay.value, planA.value || "09:00"),
                riyadhToOdoo(planDay.value, planB.value || "10:00"));
              toast("حُفظ وقتُ التنفيذ");
            }
            draw();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احفظ وقتَ التنفيذ"),
        t.planStart ? el("button", { class: "btn", onclick: async () => {
          try { await api.plan(t.id, "", ""); toast("أُزيل"); draw(); }
          catch (e) { toast(e.message, true); }
        } }, "أزِله") : null) : null,
      gap ? el("div", { class: "meta", style: "margin-top:6px" }, gap) : null,
      acts.length ? el("div", { class: "row", style: "margin-top:10px" },
        acts.map(([l, fn, pri]) => el("button",
          { class: "btn" + (pri ? " pri" : ""), onclick: fn }, l))) : null,
      el("label", {}, "المرفقات"),
      flist,
      el("button", { class: "btn", style: "margin-top:6px",
        onclick: () => picker.click() }, "+ أرفق ملفًّا"),
      picker,
      el("label", {}, `سجلّ التقارير (${(d.reports || []).length})`),
      rlist,
      // ⚠️ اسمُها «الردود» لا «التعليقات»: المسنَدُ إليه يُطلب منه أن
      //    يقرأ ويردّ — «تعليق» كلمةٌ تدلّ على فضلةٍ تُكتب أو تُترك.
      //    وهي نفسُها سجلُّ المهمّة في أودو (mail.message) لا سجلٌّ ثانٍ.
      el("label", {}, "الردود"),
      clist,
      (cbox = el("textarea", {
        placeholder: t.mine ? "اكتب ردَّك: ما أنجزتَه، أو ما تحتاجه، أو سؤالك…"
          : "اكتب ردَّك أو ملاحظتك…" })),
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const v = cbox.value.trim();
          if (!v) { toast("اكتب ردَّك", true); return; }
          ev.target.disabled = true;
          try { await api.comment(t.id, v); cbox.value = ""; toast("أُرسل"); draw(); }
          catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "أرسِل الردّ"),
        el("button", { class: "btn", onclick: close }, "إغلاق")));
    setPct(t.progress || 0);
  };
  draw();
}
// ══ قسمي — للمدير ════════════════════════════════════════════════════
// ⚠️ «الوارد» أوّلًا ثمّ «المراجعة»: هذان ما ينتظران قرارَ المدير،
//    وبقيّةُ المراحل تُقرأ ولا تُنتظر.
const DEPT_ORDER = ["inbox", "review", "doing", "received", "new", "done"];
// ⚠️ «الوارد» عند المدير مسوّداتُه: ما كتبه ولم يوزّعه بعد — تذكيرٌ له
//    لا طابورُ انتظار. والاسمُ يقول ذلك كي لا يظنّها مهامَّ ضائعة.
const DEPT_STAGE_AR = { inbox: "مسوّدات وتذكيرات (وارد)" };

function pickSheet(title, team, onPick) {
  // ⚠️ عددُ المهامّ بجانب كلِّ اسم: هذه هي الغايةُ من الشاشة — ألّا
  //    يُحمَّل أحدُهم عشرًا ويُترك زميلُه على اثنتين.
  const sorted = [...team].sort((a, b) => a.openTasks - b.openTasks);
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 12px" }, title),
      ...sorted.map((m) => el("button", {
        class: "btn", style: "width:100%;text-align:start;margin:6px 0;display:flex;gap:8px",
        onclick: () => { sheet.remove(); onPick(m); },
      },
        el("span", { class: "grow" }, m.name + (m.job ? ` · ${m.job}` : "")),
        el("span", { class: "pill" + (m.openTasks ? "" : " ok") },
          `${m.openTasks} مهمّة`))),
      el("button", { class: "btn", style: "width:100%;margin-top:10px",
        onclick: () => sheet.remove() }, "إلغاء")));
  document.body.append(sheet);
}

function returnSheet(onSend, title, hint, btn) {
  let box;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 2px" }, title || "سببُ الإرجاع"),
      el("div", { class: "meta" }, hint || "يصل الموظّفَ إشعارًا بنصّه."),
      (box = el("textarea", { placeholder: "ما الذي ينقص؟" })),
      el("div", { class: "row", style: "margin-top:10px" },
        el("button", { class: "btn pri grow", onclick: () => {
          const v = box.value.trim();
          if (!v) { toast("اكتب السبب", true); return; }
          sheet.remove(); onSend(v);
        } }, btn || "أرجِع"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
  document.body.append(sheet);
  setTimeout(() => box.focus(), 50);
}


function deptCard(t, team, refresh, showDept) {
  const acts = [];
  if (t.stage === "inbox")
    acts.push(["أسنِد", () => pickSheet("أسنِد المهمّة إلى", team, async (m) => {
      try { await api.assign(t.id, m.id); toast("أُسندت إلى " + m.name); refresh(); }
      catch (e) { toast(e.message, true); }
    }), true]);
  if (t.stage === "review") {
    acts.push(["اعتمد", async () => {
      try { await api.decide(t.id, { approve: true }); toast("اعتُمدت"); refresh(); }
      catch (e) { toast(e.message, true); }
    }, true]);
    acts.push(["أرجِع", () => returnSheet(async (note) => {
      try { await api.decide(t.id, { note }); toast("أُرجعت"); refresh(); }
      catch (e) { toast(e.message, true); }
    }), false, true]);
  }
  if (t.stage !== "inbox" && t.stage !== "done")
    acts.push(["انقل لآخر", () => pickSheet("أعِد الإسناد إلى", team, async (m) => {
      try { await api.assign(t.id, m.id); toast("نُقلت إلى " + m.name); refresh(); }
      catch (e) { toast(e.message, true); }
    })]);

  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openTask(t.id, refresh) }, t.name),
      el("span", { class: "pill" + (t.late && t.stage !== "done" ? " late" : "") },
        t.late && t.stage !== "done" ? "متأخّرة" : STAGE_AR[t.stage] || "")),
    el("div", { class: "meta" },
      [showDept && t.dept ? t.dept : null,
        (t.assignees || []).join("، ") || "بلا مسنَد إليه",
        t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
    acts.length
      ? el("div", { class: "row", style: "margin-top:10px" },
        acts.map(([lbl, fn, pri, danger]) =>
          el("button", {
            class: "btn" + (pri ? " pri" : "") + (danger ? " danger" : ""),
            onclick: fn,
          }, lbl)))
      : null);
}

// ══ مهمّةٌ جديدة ══════════════════════════════════════════════════════
// ⚠️ المقصدُ أوّلُ سؤالٍ لا آخرُه، وهو يختلف بالدور:
//    · مديرُ قسم: «موظف من قسمي» أو «قسم آخر» ثمّ اسمُ الموظّف — وإن لم
//      يختر اسمًا نزلت وارِدَ ذلك القسم ليوزّعها مديرُه.
//    · وغيرُ المدير: «لنفسي» أو «أرسل إلى قسم» بلا اختيار اسم — حِملُ
//      الرجلِ يعرفه مديرُه، ومن أسند من خارج القسم أسند على من لا يدري.
//    و١٦ من ٢٦ مستخدمًا ليسوا مديرين، فلو بُني النموذجُ على المدير وحدَه
//    لما استطاع أكثرُهم أن يكتب لنفسه سطرًا.
function newTaskSheet(refresh) {
  const isMgr = ME.managed.length > 0;
  let mode = isMgr ? "team" : "me";
  let allDepts = null, admins = 0, myDept = 0;
  let deptSel = null, whoSel = null, otherSel = null, otherWho = null;

  const box = el("div", {});
  const seg = el("div", { class: "seg", role: "tablist",
    style: "margin:10px 0 6px" });
  const tabs = isMgr
    ? [["team", "موظف من قسمي"], ["other", "قسم آخر"]]
    : [["me", "لنفسي"], ["other", "أرسل إلى قسم"]];

  const drawSeg = () => seg.replaceChildren(...tabs.map(([k, l]) =>
    el("button", { role: "tab", "aria-selected": String(mode === k),
      onclick: () => { mode = k; drawSeg(); drawBody(); } }, l)));

  async function loadDepts(hostEl) {
    if (allDepts) return true;
    try {
      const r = await api.depts();
      allDepts = r.records || [];
      admins = Number(r.admins || 0);
      myDept = Number(r.mine || 0);
      return true;
    } catch (e) {
      hostEl.replaceChildren(el("div", { class: "err" }, e.message));
      return false;
    }
  }

  async function drawBody() {
    deptSel = whoSel = otherSel = otherWho = null;
    if (mode === "me") {
      box.replaceChildren(el("div", { class: "sk" }));
      if (!(await loadDepts(box))) return;
      box.replaceChildren(myDept
        ? el("div", { class: "meta" }, "تُضاف إلى جدولك أنت.")
        : el("div", { class: "err" },
          "لا قسمَ في بطاقتك، فلا موضعَ لمهمّتك — راجع الموارد البشرية."
          + " وتستطيع إرسالها إلى قسمٍ بعينه."));
      return;
    }

    if (mode === "team") {
      const kids = [];
      if (ME.managed.length > 1) {
        kids.push(el("label", {}, "القسم"));
        kids.push((deptSel = el("select", {
          onchange: () => drawTeam() },
        ...ME.managed.map((d) => el("option", { value: String(d.id) }, d.name)))));
      }
      const list = el("div", {});
      kids.push(el("label", {}, "الموظف"));
      kids.push(list);
      const drawTeam = () => {
        const did = deptSel ? Number(deptSel.value) : ME.managed[0].id;
        const team = ME.team.filter((m) => !m.deptId || m.deptId === did);
        if (!team.length) {
          whoSel = null;
          list.replaceChildren(el("div", { class: "meta" },
            "لا موظفين في هذا القسم."));
          return;
        }
        // ⚠️ عددُ المهامِّ المفتوحةِ بجانب كلِّ اسم: هذه غايةُ الشاشة —
        //    ألّا يُحمَّل أحدُهم عشرًا ويُترك زميلُه على اثنتين.
        whoSel = el("select", {},
          el("option", { value: "0" }, "— اتركها في وارد القسم —"),
          ...[...team].sort((a, b) => a.openTasks - b.openTasks)
            .map((m) => el("option", { value: String(m.id) },
              `${m.name} · ${m.openTasks}`)));
        list.replaceChildren(whoSel);
      };
      box.replaceChildren(...kids);
      drawTeam();
      return;
    }

    // قسمٌ آخر
    box.replaceChildren(el("div", { class: "sk" }));
    if (!(await loadDepts(box))) return;
    const list = allDepts.filter((d) => !d.managed);
    if (!list.length) {
      box.replaceChildren(el("div", { class: "empty" }, "لا أقسامَ أخرى."));
      return;
    }
    // ⚠️ ولا قسمَ مختارًا سلفًا: كان أوّلُ قسمٍ في القائمة يُختار بنفسه،
    //    فيضغط المرسِلُ «أنشئ» فتذهب إلى قسمٍ لم يقصده.
    // ⚠️ والقسمُ بلا مديرٍ معطَّل: لا أحدَ يوزّع وارِدَه، فإرسالُ طلبٍ
    //    إليه إضاعةٌ له. (وعلاجُه تعيينُ مديرٍ لا فتحُ الباب.)
    otherSel = el("select", {},
      el("option", { value: "0" }, "— اختر القسم —"),
      ...list.map((d) => el("option", {
        value: String(d.id),
        ...(d.manager ? {} : { disabled: "disabled" }),
      }, d.name + (d.manager ? " — " + d.manager : " — بلا مدير (معطّل)"))));
    const note = el("div", { class: "meta", style: "margin-top:4px" }, "");
    const whoBox = el("div", {});
    const say = async () => {
      const d = list.find((x) => x.id === Number(otherSel.value));
      if (!Number(otherSel.value)) {
        note.className = "meta";
        note.textContent = "اختر القسمَ أوّلًا.";
        otherWho = null; whoBox.replaceChildren(); return;
      }
      if (d && d.manager) {
        note.className = "meta";
        note.textContent = `تصل القسم، ويُشعَر ${d.manager}.`;
      } else if (admins > 0) {
        note.className = "meta";
        note.textContent = "لا مديرَ لهذا القسم — يُشعَر مديرو النظام.";
      } else {
        // ⚠️ ولا يُقال «يُشعَر مديرو النظام» وليس في البوابة واحد.
        note.className = "err";
        note.textContent = "لا مديرَ لهذا القسم ولا مديرَ نظام:"
          + " تُسجَّل في الوارد ولا يصل إشعارٌ لأحد — أبلِغ الإدارة.";
      }
      if (!isMgr) { otherWho = null; whoBox.replaceChildren(); return; }
      whoBox.replaceChildren(el("div", { class: "sk" }));
      try {
        const r = await api.people("", Number(otherSel.value));
        const recs = r.records || [];
        otherWho = el("select", {},
          el("option", { value: "0" }, "— اتركها في وارد القسم —"),
          ...recs.map((m) => el("option", { value: String(m.id) }, m.name)));
        whoBox.replaceChildren(el("label", {}, "الموظف (اختياري)"), otherWho);
      } catch (e) {
        otherWho = null;
        whoBox.replaceChildren(el("div", { class: "err" }, e.message));
      }
    };
    otherSel.addEventListener("change", say);
    box.replaceChildren(el("label", {}, "القسم"), otherSel, note, whoBox);
    say();
  }

  let name, due, dueTime, desc, prio;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" }, "مهمة جديدة"),
      el("label", {}, "العنوان"),
      (name = el("input", { placeholder: "ما المطلوب؟" })),
      el("label", {}, "التفاصيل"),
      (desc = el("textarea", { placeholder: "تفاصيلُ المطلوب" })),
      // ⚠️ التاريخُ إجباريٌّ والوقتُ اختياريّ: مهمّةٌ بلا موعدٍ لا تدخل
      //    جدولَ أحدٍ ولا تتأخّر أبدًا. وأكثرُ المهامّ يومٌ لا ساعة،
      //    فلا يُلزَم بها من لا يحتاجها.
      el("label", {}, "تاريخ التسليم (إجباري)"),
      el("div", { class: "row", style: "gap:6px" },
        el("div", { class: "grow" }, (due = el("input", { type: "date",
          min: todayISO() }))),
        el("div", { class: "grow" },
          (dueTime = el("input", { type: "time",
            title: "وقتٌ اختياريّ" })))),
      el("label", {}, "الأولوية (إجبارية)"),
      (prio = el("select", {},
        el("option", { value: "0" }, "عادية"),
        el("option", { value: "1" }, "مهمة"),
        el("option", { value: "2" }, "عاجلة"))),
      el("label", {}, "الإسناد إلى"),
      seg,
      box,
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const title = name.value.trim();
          if (!title) { toast("اكتب العنوان", true); return; }
          if (!due.value) { toast("حدّد تاريخ التسليم", true); return; }
          if (mode === "other" && (!otherSel || !Number(otherSel.value))) {
            toast("اختر القسم", true); return;
          }
          ev.target.disabled = true;
          try {
            const body = {
              name: title,
              // ⚠️ والوقتُ يُحوَّل من الرياض إلى UTC: أودو يخزّن بـUTC،
              //    ولو أُرسل كما هو لقرأ صاحبُ المهمّة موعدًا يسبق
              //    موعدَه بثلاث ساعات.
              deadline: riyadhToOdoo(due.value, dueTime.value || "12:00"),
              description: desc.value.trim(),
              priority: prio.value,
            };
            if (mode === "team") {
              body.departmentId = deptSel
                ? Number(deptSel.value) : ME.managed[0].id;
              const who = whoSel ? Number(whoSel.value) : 0;
              body.employeeIds = who ? [who] : [];
            } else if (mode === "other") {
              body.departmentId = Number(otherSel.value);
              const who = otherWho ? Number(otherWho.value) : 0;
              if (who) body.employeeIds = [who];
            }
            const r = await api.createTask(body);
            sheet.remove();
            toast(r && r.toInbox ? "أُرسلت إلى وارد القسم" : "أُنشئت");
            refresh();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "أنشئ"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
  drawSeg();
  drawBody();
  document.body.append(sheet);
  setTimeout(() => name.focus(), 50);
}


// ══ جدولي — الأسبوع ══════════════════════════════════════════════════
// ⚠️ الأسبوعُ يبدأ الأحد لا الاثنين: هو أوّلُ الدوام هنا، ولو بدأ
//    الاثنين لظهر أوّلُ أيّام العمل في آخر العمود.
// ⚠️ والمتأخّرُ فوق الأسبوع لا داخلَه: موعدُه مضى فلا يومَ له في هذه
//    الأيّام السبعة، ولو تُرك بلا موضعٍ لاختفى من الجدول كلِّه.
let weekStart = null;

function sundayOf(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 7) % 7));
  return x;
}
const isoDay = (d) => d.toISOString().slice(0, 10);
const AR_WD = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { weekday: "long" });
const AR_DM = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory",
  { day: "numeric", month: "short" });

// ⚠️ ثلاثةُ مدًى لا مدًى واحد: يومٌ لمن يسأل «ما عليّ اليوم»، وأسبوعٌ
//    للنظرة العامّة، ومدًى مفتوحٌ لمن يُخطّط لشهر. وكان سبعةً ثابتةً.
let weekSpan = "week";
let rangeTo = null;

async function viewWeek(host) {
  if (!weekStart) weekStart = sundayOf(new Date());
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));

  const endOf = () => {
    if (weekSpan === "day") return new Date(weekStart.getTime());
    if (weekSpan === "range" && rangeTo) return new Date(rangeTo.getTime());
    return new Date(weekStart.getTime() + 6 * 864e5);
  };
  let d;
  try { d = await api.week(isoDay(weekStart), isoDay(endOf())); }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }

  const refresh = () => viewWeek(host);
  const step = weekSpan === "day" ? 1 : 7;
  const hop = (n) => {
    weekStart = new Date(weekStart.getTime() + n * step * 864e5);
    if (weekSpan === "range" && rangeTo) {
      rangeTo = new Date(rangeTo.getTime() + n * step * 864e5);
    }
    viewWeek(host);
  };

  const spanBar = el("div", { class: "seg", role: "tablist",
    style: "margin:10px 0 6px" });
  const drawSpan = () => spanBar.replaceChildren(
    ...[["day", "يوم"], ["week", "أسبوع"], ["range", "من - إلى"]]
      .map(([k, l]) => el("button", {
        role: "tab", "aria-selected": String(weekSpan === k),
        onclick: () => {
          weekSpan = k;
          if (k === "day") weekStart = new Date(todayUTC().getTime());
          if (k === "week") weekStart = sundayOf(new Date());
          if (k === "range" && !rangeTo) {
            rangeTo = new Date(weekStart.getTime() + 13 * 864e5);
          }
          viewWeek(host);
        },
      }, l)));
  drawSpan();

  const end = endOf();
  const head = el("div", { class: "row", style: "margin:4px 0" },
    el("button", { class: "btn", onclick: () => hop(-1) }, "‹ السابق"),
    el("div", { class: "grow meta", style: "font-weight:700;text-align:center" },
      weekSpan === "day" ? `${AR_WD.format(weekStart)} · ${AR_DM.format(weekStart)}`
        : `${AR_DM.format(weekStart)} — ${AR_DM.format(end)}`),
    el("button", { class: "btn", onclick: () => hop(1) }, "التالي ›"));

  const out = [spanBar, head];

  if (weekSpan === "range") {
    const a = el("input", { type: "date", value: isoDay(weekStart) });
    const b = el("input", { type: "date", value: isoDay(end) });
    out.push(el("div", { class: "row", style: "gap:6px;margin-bottom:6px" },
      el("div", { class: "grow" }, el("label", {}, "من"), a),
      el("div", { class: "grow" }, el("label", {}, "إلى"), b),
      el("button", { class: "btn", style: "align-self:end", onclick: () => {
        if (!a.value || !b.value) { toast("حدّد التاريخين", true); return; }
        weekStart = new Date(a.value + "T00:00:00Z");
        rangeTo = new Date(b.value + "T00:00:00Z");
        viewWeek(host);
      } }, "اعرض")));
  }

  const todayIso = isoDay(todayUTC());
  if (isoDay(weekStart) !== todayIso && weekSpan !== "range") {
    out.push(el("button", { class: "btn", style: "width:100%;margin-bottom:6px",
      onclick: () => {
        weekStart = weekSpan === "day" ? todayUTC() : sundayOf(new Date());
        viewWeek(host);
      } }, "ارجع إلى اليوم"));
  }

  // ⚠️ المتأخّرُ وما لا موعدَ له فوق الأيّام: لا يومَ لهما، ولو تُركا
  //    لاختفيا من الجدول كلِّه وعلى صاحبهما عمل.
  if ((d.late || []).length) {
    out.push(el("div", { class: "meta",
      style: "margin:14px 2px 2px;font-weight:700;color:var(--bad)" },
      `متأخرة (${d.late.length})`));
    for (const t of d.late) out.push(dayTask(t, refresh));
  }
  if ((d.undated || []).length) {
    out.push(el("div", { class: "meta",
      style: "margin:14px 2px 2px;font-weight:700" },
      `بلا موعد (${d.undated.length})`));
    for (const t of d.undated) out.push(dayTask(t, refresh));
  }

  for (const day of (d.days || [])) {
    const dt = new Date(day.date + "T00:00:00Z");
    const isToday = day.date === todayIso;
    const n = day.tasks.length + day.meetings.length;
    out.push(el("div", { class: "card",
      style: "padding:10px 12px" + (isToday ? ";border-color:var(--gold)" : "") },
      el("div", { class: "row" },
        el("div", { class: "grow", style: "font-weight:700" },
          `${AR_WD.format(dt)} · ${AR_DM.format(dt)}`),
        isToday ? el("span", { class: "pill ok" }, "اليوم") : null,
        el("span", { class: "meta" }, n ? String(n) : "")),
      ...(n
        ? [...day.tasks.map((t) => dayTask(t, refresh)),
          ...day.meetings.map((m) => dayMeet(m, refresh))]
        : [el("div", { class: "meta", style: "padding:4px 2px" }, "فارغ")])));
  }
  host.replaceChildren(...out);
}

function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function dayTask(t, refresh) {
  const late = t.late && t.stage !== "done";
  return el("div", { class: "row",
    style: "gap:8px;padding:7px 2px;cursor:pointer;border-top:1px solid var(--line-2)",
    onclick: () => openTask(t.id, refresh) },
    el("span", { class: "pill" + (late ? " late" : t.stage === "done" ? " ok" : "") },
      `${t.progress || 0}%`),
    el("div", { class: "grow" }, t.name),
    el("span", { class: "meta" }, STAGE_AR[t.stage] || ""));
}

// ⚠️ والاجتماعُ في الجدول يُفتح كالمهمّة: ضغطةٌ تُظهر تفصيلَه وردَّك
//    عليه — وكان سطرًا يُقرأ ولا يُفتح.
function dayMeet(m, refresh) {
  return el("div", { class: "row",
    style: "gap:8px;padding:7px 2px;cursor:pointer;"
      + "border-top:1px solid var(--line-2)",
    onclick: () => openMeeting(m, refresh) },
    el("span", { class: "pill" }, m.allday ? "طوال اليوم" : fmtTime(m.start)),
    el("div", { class: "grow" }, m.title),
    el("span", { class: "meta" },
      m.mode === "online" ? "أونلاين" : (m.place || "حضوري")));
}
// ══ اجتماعاتي ═════════════════════════════════════════════════════════
const RESP_AR = { accepted: "قبلتَ", declined: "اعتذرتَ", tentative: "ربّما",
  needsAction: "بانتظار ردّك" };
const RESP_SHORT = { accepted: "قبل", declined: "اعتذر", tentative: "ربما",
  needsAction: "بانتظار" };
let meetFrom = null, meetTo = null;

function meetingCard(m, refresh) {
  const mine = m.myState || "needsAction";
  const pending = mine === "needsAction";
  const host = m.mineOrganizer;
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openMeeting(m, refresh) }, m.title || ""),
      host
        ? el("span", { class: "pill" }, "أنت المنظّم")
        : el("span", { class: "pill" + (mine === "accepted" ? " ok"
          : mine === "declined" ? " late" : "") }, RESP_AR[mine] || mine)),
    el("div", { class: "meta" }, `${fmtWhen(m.start)} – ${fmtTime(m.stop)}`),
    el("div", { class: "meta" },
      [m.mode === "online" ? "أونلاين" : "حضوري",
        m.mode === "online" ? "" : (m.place || ""),
        m.organizer ? "نظّمه " + m.organizer : ""]
        .filter(Boolean).join(" · ")),
    // ⚠️ المنظِّمُ يرى ردودَ الحضور لا أسماءَهم وحدَها: هو من يقرّر
    //    أيُعقد أم يُؤجَّل، ولا يُقرّر ذلك من لا يعرف من قبِل.
    (m.attendees || []).length
      ? el("div", { class: "meta", style: "margin-top:4px" },
        host
          ? m.attendees.map((a) => `${a.name} (${RESP_SHORT[a.state] || "—"})`)
            .join("، ")
          : "الحاضرون: " + m.attendees.map((a) => a.name).join("، "))
      : null,
    el("div", { class: "row", style: "margin-top:10px" },
      m.mode === "online" && m.link
        ? el("a", { class: "btn pri", href: m.link, target: "_blank",
          rel: "noopener" }, "ادخل الاجتماع")
        : null,
      pending && !host ? el("button", { class: "btn pri", onclick: async () => {
        try { await api.respond(m.id, true); toast("قبلتَ الدعوة"); refresh(); }
        catch (e) { toast(e.message, true); }
      } }, "قبول") : null,
      pending && !host ? el("button", { class: "btn danger", onclick: async () => {
        try { await api.respond(m.id, false); toast("اعتذرتَ"); refresh(); }
        catch (e) { toast(e.message, true); }
      } }, "اعتذار") : null,
      el("button", { class: "btn", onclick: () => openMeeting(m, refresh) },
        "التفاصيل")));
}

/** ورقةُ تفاصيل اجتماعٍ — تُفتح من الجدول ومن القائمة ومن الإشعار. */
function openMeeting(m, refresh) {
  const mine = m.myState || "needsAction";
  const pending = mine === "needsAction" && !m.mineOrganizer;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:2px 0 6px" }, m.title || ""),
      el("div", { class: "meta" }, `${fmtWhen(m.start)} – ${fmtTime(m.stop)}`),
      el("div", { class: "meta" },
        [m.mode === "online" ? "أونلاين" : "حضوري",
          m.mode === "online" ? "" : (m.place || ""),
          m.organizer ? "المنظّم: " + m.organizer : ""]
          .filter(Boolean).join(" · ")),
      m.note ? el("div", { class: "card", style: "margin:8px 0;padding:11px 13px" },
        txt(m.note)) : null,
      m.mode === "online" && m.link
        ? el("a", { class: "btn pri", style: "margin-top:8px;display:block;"
          + "text-align:center", href: m.link, target: "_blank",
          rel: "noopener" }, "ادخل الاجتماع")
        : null,
      el("label", {}, `الحضور (${(m.attendees || []).length})`),
      el("div", {}, ...((m.attendees || []).length
        ? m.attendees.map((a) => el("div", { class: "row",
          style: "padding:6px 2px;border-top:1px solid var(--line-2)" },
          el("div", { class: "grow" }, a.name || ""),
          el("span", { class: "pill" + (a.state === "accepted" ? " ok"
            : a.state === "declined" ? " late" : "") },
          RESP_SHORT[a.state] || "بانتظار")))
        : [el("div", { class: "meta" }, "لا حضور.")])),
      // ⚠️ والردُّ يُغيَّر لا يُقفل: من قبِل ثمّ طرأ عليه ما يمنعه يعتذر،
      //    ومن اعتذر ثمّ فرغ يقبل. فالزرّانِ ظاهرانِ دائمًا لغير المنظِّم،
      //    والمختارُ منهما مميَّز.
      !m.mineOrganizer ? el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn" + (mine === "accepted" ? " pri" : ""),
          onclick: async () => {
            try {
              await api.respond(m.id, true); toast("قبلتَ الدعوة");
              sheet.remove(); if (refresh) refresh();
            } catch (e) { toast(e.message, true); }
          } }, mine === "accepted" ? "✓ قبلتَ" : "قبول"),
        el("button", { class: "btn" + (mine === "declined" ? " danger" : ""),
          onclick: async () => {
            try {
              await api.respond(m.id, false); toast("اعتذرتَ");
              sheet.remove(); if (refresh) refresh();
            } catch (e) { toast(e.message, true); }
          } }, mine === "declined" ? "✓ اعتذرتَ" : "اعتذار")) : null,
      // ⚠️ وللمنظِّم أن يُعدّل أو يُلغي: كان الاجتماعُ يُحجز ولا يُمسّ،
      //    فإن تبدّل الموعدُ حُجز ثانٍ وبقي الأوّلُ يشغل الناس.
      m.mineOrganizer ? el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn", onclick: () => {
          sheet.remove(); editMeetingSheet(m, refresh);
        } }, "تعديل"),
        el("button", { class: "btn danger", onclick: () => {
          returnSheet(async (why) => {
            try {
              await api.cancelMeeting(m.id, why);
              toast("أُلغي الاجتماع"); sheet.remove(); if (refresh) refresh();
            } catch (e) { toast(e.message, true); }
          }, "إلغاءُ الاجتماع", "لماذا أُلغي؟ يصل المدعوّين.", "ألغِ الاجتماع");
        } }, "إلغاء الاجتماع")) : null,
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "btn grow", onclick: () => sheet.remove() },
          "إغلاق"))));
  document.body.append(sheet);
}

/** يفتح اجتماعًا برقمه — لنقرِ الإشعار. */

// ⚠️ تعديلُ الاجتماع لا إعادةُ حجزه: كان المنظِّمُ إن تبدّل موعدُه حجز
//    ثانيًا وبقي الأوّلُ يشغل الناسَ في تقاويمهم.
function editMeetingSheet(m, refresh) {
  let title, note, day, from, to, modeSel, place, link;
  const placeBox = el("div", {});
  const online0 = m.mode === "online";
  const drawPlace = () => {
    const online = modeSel.value === "online";
    placeBox.replaceChildren(
      el("label", {}, online ? "الرابط" : "المكان"),
      online
        ? (link = el("input", { value: m.link || "", placeholder: "https://…" }))
        : (place = el("input", { value: m.place || "",
          placeholder: "قاعةُ الاجتماعات" })));
    if (online) place = null; else link = null;
  };
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" }, "تعديلُ الاجتماع"),
      el("label", {}, "الموضوع"),
      (title = el("input", { value: m.title || "" })),
      el("label", {}, "التفاصيل"),
      (note = el("textarea", { style: "min-height:58px" }, m.note || "")),
      el("label", {}, "التاريخ"),
      (day = el("input", { type: "date", min: todayISO(),
        value: isoOf(m.start) })),
      el("div", { class: "row", style: "gap:6px" },
        el("div", { class: "grow" }, el("label", {}, "من"),
          (from = el("input", { type: "time", value: hhmmOf(m.start) }))),
        el("div", { class: "grow" }, el("label", {}, "إلى"),
          (to = el("input", { type: "time", value: hhmmOf(m.stop) })))),
      el("label", {}, "النوع"),
      (modeSel = el("select", { onchange: () => drawPlace() },
        el("option", { value: "onsite", ...(online0 ? {} : { selected: "selected" }) }, "حضوري"),
        el("option", { value: "online", ...(online0 ? { selected: "selected" } : {}) }, "أونلاين"))),
      placeBox,
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          if (!title.value.trim()) { toast("اكتب الموضوع", true); return; }
          if (!day.value || !from.value || !to.value) {
            toast("حدّد التاريخَ والوقت", true); return;
          }
          if (to.value <= from.value) { toast("النهاية قبل البداية", true); return; }
          ev.target.disabled = true;
          try {
            await api.updateMeeting(m.id, {
              title: title.value.trim(),
              note: note.value.trim(),
              start: riyadhToOdoo(day.value, from.value),
              stop: riyadhToOdoo(day.value, to.value),
              mode: modeSel.value,
              place: place ? place.value.trim() : "",
              link: link ? link.value.trim() : "",
            });
            sheet.remove(); toast("حُفظ التعديل"); refresh();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احفظ"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
  document.body.append(sheet);
  drawPlace();
}

/** تاريخُ اليوم بتوقيت الرياض — حدٌّ أدنى لحقول التاريخ. */
function todayISO() {
  return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
}
async function openMeetingById(id) {
  try {
    const recs = (await api.meetings()).records || [];
    const m = recs.find((x) => x.id === Number(id));
    if (m) openMeeting(m, null);
    else toast("لم يُعثر على الاجتماع", true);
  } catch (e) { toast(e.message, true); }
}

async function viewMeetings(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let recs = [];
  try {
    recs = (await api.meetings(meetFrom, meetTo)).records || [];
  } catch (e) {
    host.replaceChildren(el("div", { class: "err" }, e.message)); return;
  }

  const refresh = () => viewMeetings(host);
  // ⚠️ الحجزُ متاحٌ للجميع: من يحتاج اجتماعًا مع قسمٍ آخر لا يحتاج إذنًا
  //    ليطلبه — والمدعوُّ يقبل أو يعتذر، وهذا هو الإذن.
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      recs.length ? `${recs.length} اجتماعًا` : ""),
    el("button", { class: "btn pri", onclick: () => bookSheet(refresh) },
      "+ احجز"));

  const a = el("input", { type: "date", value: meetFrom || "" });
  const b = el("input", { type: "date", value: meetTo || "" });
  const bar = el("div", { class: "row", style: "gap:6px;margin:6px 0" },
    el("div", { class: "grow" }, el("label", {}, "من"), a),
    el("div", { class: "grow" }, el("label", {}, "إلى"), b),
    el("button", { class: "btn", style: "align-self:end", onclick: () => {
      meetFrom = a.value || null; meetTo = b.value || null; refresh();
    } }, "اعرض"),
    (meetFrom || meetTo)
      ? el("button", { class: "btn", style: "align-self:end", onclick: () => {
        meetFrom = meetTo = null; refresh();
      } }, "القادمة")
      : null);

  host.replaceChildren(head, bar,
    ...(recs.length
      ? recs.map((m) => meetingCard(m, refresh))
      : [el("div", { class: "empty" },
        (meetFrom || meetTo) ? "لا اجتماعات في هذا المدى."
          : "لا اجتماعاتِ قادمة.")]));
}

// ── حجزُ اجتماع ────────────────────────────────────────────────────────
// ⚠️ الحاضرون من كلِّ الأقسام: الاجتماعُ يُعقد بين الأقسام أكثرَ ممّا
//    يُعقد داخلها. وقائمةُ أربعةٍ وستّين اسمًا لا تُعرض دفعةً — تُبحث.
// ⚠️ وزرُّ «اقترح وقتًا فارغًا» يبقى: الخادمُ يحسب ما يفرغ فيه الحاضرون
//    كلُّهم (الدوام ناقص الاجتماعات ناقص الإجازات)، فلا يُحجز موعدٌ
//    يعتذر عنه نصفُهم. وهو عونٌ لا شرط — ومن عرف وقتَه كتبه بيده.
function bookSheet(refresh) {
  let title, note, day, from, to, modeSel, place, link, search;
  const picked = new Map();          // id → name
  let people = [];
  const chips = el("div", { class: "row", style: "gap:6px;margin:6px 0" });
  const list = el("div", { style: "max-height:190px;overflow:auto;margin-top:6px" });
  const placeBox = el("div", {});
  const slotBox = el("div", { style: "margin-top:6px" });

  // ⚠️ المحجوزُ يُعرض قبل الحفظ لا بعدَه: من يحجز لا يرى جداولَ غيره،
  //    فيختار وقتًا يعتذر عنه نصفُهم. والخادمُ يردُّ التعارضَ على كلِّ
  //    حال، لكنّ الردَّ بعد المحاولة أسوأُ من بيانٍ قبلها.
  let busyTimer = null;
  const drawBusy = () => {
    clearTimeout(busyTimer);
    busyTimer = setTimeout(async () => {
      if (!day.value) { slotBox.replaceChildren(); return; }
      slotBox.replaceChildren(el("div", { class: "meta" }, "يُقرأ التقويم…"));
      try {
        const r = await api.busy({ day: day.value,
          employeeIds: [...picked.keys()] });
        const rows = r.records || [];
        slotBox.replaceChildren(
          el("label", {}, `المحجوز في ${day.value} (${rows.length})`),
          ...(rows.length
            ? rows.map((b) => el("div", { class: "row",
              style: "padding:5px 2px;border-top:1px solid var(--line-2)" },
            el("span", { class: "pill late" },
              `${fmtTime(b.start)} – ${fmtTime(b.stop)}`),
            el("div", { class: "grow meta" }, `${b.who} · ${b.title || ""}`)))
            : [el("div", { class: "meta" }, "لا حجزَ في هذا اليوم.")]));
      } catch (e) {
        slotBox.replaceChildren(el("div", { class: "meta" }, e.message));
      }
    }, 250);
  };

  const drawChips = () => chips.replaceChildren(...(picked.size
    ? [...picked.entries()].map(([id, name]) =>
      el("button", { class: "slot", onclick: () => {
        picked.delete(id); drawChips(); drawList(); drawBusy();
      } }, name + " ✕"))
    : [el("div", { class: "meta" }, "لم تختر أحدًا بعد.")]));

  const drawList = () => {
    const q = norm(search ? search.value : "");
    const show = people
      .filter((p) => !picked.has(p.id))
      .filter((p) => !q || norm(p.name + " " + p.dept).includes(q))
      .slice(0, 40);
    list.replaceChildren(...(show.length
      ? show.map((p) => el("div", { class: "row",
        style: "padding:7px 2px;cursor:pointer;border-top:1px solid var(--line-2)",
        onclick: () => { picked.set(p.id, p.name); drawChips(); drawList(); drawBusy(); } },
      el("div", { class: "grow" }, p.name),
      el("span", { class: "meta" }, p.dept || "")))
      : [el("div", { class: "meta", style: "padding:6px 2px" }, "لا نتائج.")]));
  };

  const drawPlace = () => {
    const online = modeSel.value === "online";
    placeBox.replaceChildren(
      el("label", {}, online ? "الرابط (اتركه فارغًا ليُولّده النظام)" : "المكان"),
      online
        ? (link = el("input", { placeholder: "https://…" }))
        : (place = el("input", { placeholder: "قاعةُ الاجتماعات" })));
    if (online) place = null; else link = null;
  };

  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" }, "حجزُ اجتماع"),
      el("label", {}, "الموضوع"),
      (title = el("input", { placeholder: "موضوعُ الاجتماع" })),
      el("label", {}, "التفاصيل"),
      (note = el("textarea", { style: "min-height:58px",
        placeholder: "ما الذي سيُناقَش؟" })),
      el("label", {}, "التاريخ"),
      (day = el("input", { type: "date", min: todayISO(),
        onchange: () => drawBusy() })),
      el("div", { class: "row", style: "gap:6px" },
        el("div", { class: "grow" }, el("label", {}, "من"),
          (from = el("input", { type: "time", value: "09:00" }))),
        el("div", { class: "grow" }, el("label", {}, "إلى"),
          (to = el("input", { type: "time", value: "10:00" })))),
      el("label", {}, "النوع"),
      (modeSel = el("select", { onchange: () => drawPlace() },
        el("option", { value: "onsite" }, "حضوري"),
        el("option", { value: "online" }, "أونلاين"))),
      placeBox,
      el("label", {}, "الحضور"),
      chips,
      (search = el("input", { type: "search", placeholder: "ابحث بالاسم…",
        oninput: () => drawList() })),
      list,
      slotBox,
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const t = title.value.trim();
          if (!t) { toast("اكتب الموضوع", true); return; }
          if (!day.value) { toast("حدّد التاريخ", true); return; }
          if (!from.value || !to.value) { toast("حدّد الوقت", true); return; }
          if (to.value <= from.value) { toast("النهاية قبل البداية", true); return; }
          if (!picked.size) { toast("اختر الحضور", true); return; }
          ev.target.disabled = true;
          try {
            // ⚠️ أودو يخزّن بـUTC والرياضُ +٣: يُطرح الفرقُ هنا، وإلّا
            //    وصل المدعوَّ موعدٌ يسبق موعدَه بثلاث ساعات.
            const mk = (hhmm) => {
              const d = new Date(`${day.value}T${hhmm}:00+03:00`);
              return d.toISOString().slice(0, 19).replace("T", " ");
            };
            await api.createMeeting({
              title: t,
              note: note.value.trim(),
              start: mk(from.value),
              stop: mk(to.value),
              mode: modeSel.value,
              place: place ? place.value.trim() : "",
              link: link ? link.value.trim() : "",
              employeeIds: [...picked.keys()],
            });
            sheet.remove();
            toast("حُجز الاجتماع");
            refresh();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احجز"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));

  document.body.append(sheet);
  drawChips();
  drawPlace();
  (async () => {
    try {
      const r = await api.people("");
      people = r.records || [];
      people = people.filter((p) => p.id !== r.me);
    } catch (e) { toast(e.message, true); }
    drawList();
  })();
  setTimeout(() => title.focus(), 50);
}

// ══ التبويبُ والإقلاع ═════════════════════════════════════════════════
// ⚠️ ثلاثةٌ لا أربعة: «قسمي» حُذف بقرار الإدارة، و**وارِدُ القسم** انتقل
//    إلى «المهام» تحت «اللي أسندتها» للمدير — ولولا ذلك لبقي الوارِدُ
//    (وهو مهبطُ كلِّ طلبٍ عابرٍ بين الأقسام) لا يفتحه أحدٌ ولا يوزّعه.
// حالُ صاحب الجلسة، تُقرأ مرّةً عند الإقلاع
const ME = { managed: [], team: [], inbox: [] };

const TABS = [
  { k: "mine", l: "المهام", view: viewTasks },
  { k: "week", l: "جدولي", view: viewWeek },
  { k: "meetings", l: "اجتماعاتي", view: viewMeetings },
];

async function boot() {
  if (EMBED) document.documentElement.classList.add("sq-embed");
  const seg = $("#sq-seg");
  const body = $("#sq-body");

  $("#sq-back").addEventListener("click", goBack);

  // ⚠️ تُقرأ مرّةً عند الإقلاع لا عند كلِّ رسم: الأقسامُ التي أُديرها
  //    وفريقي يُسألان في ثلاثة مواضع (وارِدُ القسم، ونموذجُ الإسناد،
  //    وأزرارُ التوزيع)، ونداءٌ لكلِّ موضعٍ يُبطئ الشاشةَ بلا فائدة.
  try {
    const d = await api.deptTasks();
    ME.managed = d.managed || [];
    ME.inbox = (d.records || []).filter((t) => t.stage === "inbox");
  } catch { ME.managed = []; ME.inbox = []; }
  if (ME.managed.length) {
    try { ME.team = (await api.team()).records || []; } catch { ME.team = []; }
  }

  const tabs = TABS;
  const qs = new URLSearchParams(location.search);
  const start = qs.get("t");
  let active = tabs.some((t) => t.k === start) ? start : tabs[0].k;

  const draw = () => {
    seg.replaceChildren(...tabs.map((t) => el("button", {
      role: "tab", "aria-selected": String(t.k === active),
      onclick: () => {
        active = t.k;
        history.replaceState(null, "", `?t=${t.k}`);
        draw();
      },
    }, t.l)));
    (tabs.find((t) => t.k === active) || tabs[0]).view(body);
  };
  draw();

  // ⚠️ نقرُ الإشعار يفتح العنصرَ نفسَه لا تبويبَه: كان يفتح «مهامي»
  //    فيبحث المُشعَرُ عمّا أُشعر به بين مهامّه.
  const tid = Number(qs.get("task") || 0);
  const mid = Number(qs.get("meeting") || 0);
  if (tid) openTask(tid, () => draw());
  else if (mid) openMeetingById(mid);
}

boot();
