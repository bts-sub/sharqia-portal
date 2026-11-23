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
  people: (q) => call("/api/schedule/people" + (q ? "?q=" + encodeURIComponent(q) : "")),
  depts: () => call("/api/schedule/depts"),
  week: (from) => call("/api/schedule/week?from=" + encodeURIComponent(from)),
  one: (id) => call("/api/schedule/tasks/" + id),
  progress: (id, percent) => call("/api/schedule/tasks/" + id + "/progress",
    { method: "POST", body: JSON.stringify({ percent }) }),
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
  meetings: () => call("/api/schedule/meetings"),
  slots: (b) => call("/api/schedule/meetings/slots", { method: "POST", body: JSON.stringify(b) }),
  createMeeting: (b) => call("/api/schedule/meetings", { method: "POST", body: JSON.stringify(b) }),
  respond: (id, accept) => call(`/api/schedule/meetings/${id}/respond`,
    { method: "POST", body: JSON.stringify({ accept }) }),
};

// ── تنسيقُ الوقت ───────────────────────────────────────────────────────
// ⚠️ أودو يُرسل الوقتَ بتوقيت UTC بلا لاحقة، فتُضاف Z قبل التحويل —
//    وإلّا قرأه المتصفّحُ وقتًا محلّيًّا وأزاح كلَّ موعدٍ ثلاثَ ساعات.
const toDate = (s) => (s ? new Date(String(s).replace(" ", "T") + "Z") : null);
const AR_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory",
  { weekday: "short", day: "numeric", month: "short" });
const AR_TIME = new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (s) => (toDate(s) ? AR_DATE.format(toDate(s)) : "—");
const fmtTime = (s) => (toDate(s) ? AR_TIME.format(toDate(s)) : "—");
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
const STAGE_AR = { inbox: "وارد", new: "جديدة", doing: "قيد التنفيذ",
  review: "مراجعة", done: "منتهية" };

function toast(msg, bad = false) {
  const t = el("div", { class: bad ? "err" : "card",
    style: "position:fixed;inset-inline:16px;bottom:18px;z-index:60;text-align:center" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ══ مهامّي ════════════════════════════════════════════════════════════
// ⚠️ الترتيبُ بالمرحلة لا بالتاريخ: الموظّفُ يفتح جدولَه ليعرف ما يعمله
//    الآن، فما هو «قيد التنفيذ» فوق ما لم يبدأ. والمنتهيةُ آخرًا ومطويّة.
const MY_ORDER = ["doing", "review", "new", "inbox", "done"];

function taskCard(t, onAct, refresh) {
  const late = t.late && t.stage !== "done";
  const full = Number(t.progress || 0) >= 100;
  // ⚠️ زرٌّ صريحٌ للفتح لا العنوانَ وحدَه: على الهاتف لا مؤشّرَ يتبدّل،
  //    فلا يدري المسنَدُ إليه أنّ العنوانَ بابٌ — فيقرأ سطرًا واحدًا ويظنّ
  //    أنّ هذا كلُّ ما طُلب منه، وفيها المطلوبُ والمرفقاتُ والردود.
  const acts = [["اقرأ المطلوب وردّ", () => openTask(t.id, refresh), false]];
  if (t.stage === "new") acts.push(["ابدأ العمل", () => onAct(t, "doing"), true]);
  // ⚠️ ولا «أرسل للمراجعة» قبل المئة: المهمّةُ لا تُقفل وهي ناقصة،
  //    والخادمُ يردُّ الإرسالَ دونها — فيُقال ما ينقص بدل زرٍّ يُردّ.
  if (t.stage === "doing" && full)
    acts.push(["أرسل للمراجعة", () => onAct(t, "review"), true]);
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openTask(t.id, refresh) }, t.name),
      el("span", { class: "pill" + (late ? " late" : "") },
        late ? "متأخّرة" : STAGE_AR[t.stage] || t.stageName || "")),
    el("div", { class: "meta" },
      [t.dept, t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
    // ⚠️ والنسبةُ على البطاقة لا داخلَ الورقة وحدَها: صاحبُها يحتاج أن
    //    يعرف ما ينقصه قبل أن يفتح، وبها يفهم لماذا لا يرى زرَّ الإرسال.
    t.stage === "doing" && !full
      ? el("div", { class: "meta", style: "margin-top:4px" },
        `الإنجاز ${t.progress || 0}٪ — أكمله إلى ١٠٠٪ لتُرسلها للمراجعة.`)
      : null,
    t.returnNote
      ? el("div", { class: "err", style: "margin-top:8px" }, "أُرجعت: " + t.returnNote)
      : null,
    t.description
      ? el("div", { class: "meta", style: "margin-top:6px", html: t.description })
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
      el("span", { class: "pill" + (late ? " late" : "") },
        late ? "متأخّرة" : STAGE_AR[t.stage] || t.stageName || "")),
    el("div", { class: "meta" },
      [t.dept,
        t.assignee ? "عند: " + t.assignee : "في الوارد — لم تُوزَّع بعد",
        t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
    t.progress
      ? el("div", { class: "meta", style: "margin-top:4px" },
        `أنجز ${t.progress}%`)
      : null);
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

function matchTask(t, f) {
  if (f.stage && t.stage !== f.stage) return false;
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
  const chips = el("div", { class: "row",
    style: "gap:6px;margin-top:6px;flex-wrap:wrap" });
  const drawChips = () => chips.replaceChildren(
    ...[["", "الكل"], ...(opts.stages || []).map((s) => [s, STAGE_AR[s] || s])]
      .map(([k, l]) => el("button", { class: "slot", "aria-pressed": String(f.stage === k),
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
async function viewMine(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let data;
  try { data = await api.tasks(); }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }
  const recs = data.records || [];
  const sent = data.sent || [];
  const refresh = () => viewMine(host);

  // ⚠️ زرُّ الإضافة لكلِّ موظّفٍ لا للمدير وحدَه: «جدولي» جدولُ صاحبه قبل
  //    أن يكون لوحةَ توزيع، ومن لا يملك أن يكتب لنفسه سطرًا لا يفتحه إلّا
  //    ليقرأ ما أُملي عليه.
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      recs.length ? `${recs.length} مهمّة` : ""),
    el("button", { class: "btn pri",
      onclick: () => newTaskSheet(null, [], refresh) }, "+ مهمّة"));

  const onAct = async (t, to) => {
    try { await api.move(t.id, to); toast("تمّ"); refresh(); }
    catch (e) { toast(e.message, true); }
  };

  const listHost = el("div", {});
  const stages = MY_ORDER.filter((s) => recs.some((t) => t.stage === s));
  // ⚠️ أسماءُ من سلّمتَ إليهم في المرشِّح لا أسماءُ الشركة كلِّها: «أرسلتُها»
  //    قد تكون عشراتٍ على عدّة أشخاص، والمرشِّحُ يُريك عملَ واحدٍ منهم.
  const people = [...new Set(sent.map((t) => t.assignee).filter(Boolean))].sort();
  const bar = filterBar({ stages, people, onChange: () => redraw() });

  const redraw = () => {
    const f = bar.f;
    const mine = recs.filter((t) => matchTask(t, f));
    const out = [];
    const byStage = new Map();
    for (const t of mine) {
      if (!byStage.has(t.stage)) byStage.set(t.stage, []);
      byStage.get(t.stage).push(t);
    }
    if (!mine.length) {
      out.push(el("div", { class: "empty" },
        recs.length ? "لا مهمّةَ تطابق البحث." : "لا مهامَّ عليك الآن."));
    } else {
      for (const st of MY_ORDER) {
        const list = byStage.get(st);
        if (!list || !list.length) continue;
        out.push(el("div", { class: "meta",
          style: "margin:14px 2px 2px;font-weight:700" },
          `${STAGE_AR[st] || st} (${list.length})`));
        for (const t of list) out.push(taskCard(t, onAct, refresh));
      }
    }
    // ⚠️ وما أرسلتَه أسفلَ ما عليك لا مختلطًا به: ذاك عملُك وهذا متابعتُك،
    //    ولو جُمعا في قائمةٍ واحدةٍ لعُدَّ على المرء ما أرسله إلى غيره.
    const out2 = sent.filter((t) => matchTask(t, f));
    if (out2.length) {
      out.push(el("div", { class: "meta",
        style: "margin:18px 2px 2px;font-weight:700" },
        `أرسلتُها (${out2.length})`));
      for (const t of out2) out.push(sentCard(t, refresh));
    }
    listHost.replaceChildren(...out);
  };

  host.replaceChildren(head, bar.node, listHost);
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
    let bar, pct;
    const setPct = (v) => {
      pct.textContent = v + "%";
      bar.style.width = Math.max(2, v) + "%";
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
        el("div", {}, c.text)))
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
    if (t.mine && t.stage === "new")
      acts.push(["ابدأ العمل", async () => {
        try { await api.move(t.id, "doing"); toast("بدأت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    // ⚠️ ولا يُعرض «أرسل للمراجعة» قبل المئة: الإرسالُ إقرارٌ بالإتمام،
    //    والخادمُ يردُّه دونها — فزرٌّ يُضغط ليُردَّ خيرٌ منه سطرٌ يقول
    //    ما ينقص. وهذا ما طُلب: لا تُقفل المهمّةُ إلّا بمئةٍ كاملة.
    if (t.mine && t.stage === "doing" && full)
      acts.push(["أرسل للمراجعة", async () => {
        try { await api.move(t.id, "review"); toast("أُرسلت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    if (t.manages && t.stage === "review") {
      // ⚠️ والاعتمادُ كذلك لا يُعرض دون المئة: المديرُ يرى نسبةَ صاحبها
      //    أمامه، فإن كانت ناقصةً فسبيلُه الإرجاعُ لا الاعتماد.
      if (full)
        acts.push(["اعتمد", async () => {
          try { await api.decide(t.id, { approve: true }); toast("اعتُمدت"); close(); }
          catch (e) { toast(e.message, true); } }, true]);
      acts.push(["أرجِع", () => returnSheet(async (note) => {
        try { await api.decide(t.id, { note }); toast("أُرجعت"); close(); }
        catch (e) { toast(e.message, true); } })]);
    }
    // سطرٌ يقول ما ينقص قبل الإغلاق — لصاحبها وللمدير بلفظٍ يناسب كلًّا
    const gap = !full && (
      (t.mine && t.stage === "doing")
        ? `أكمل النسبةَ إلى ١٠٠٪ لتُرسلها للمراجعة — الآن ${t.progress || 0}٪.`
        : (t.manages && t.stage === "review")
          ? `أقرّ صاحبُها بـ${t.progress || 0}٪ — لا تُعتمد ناقصةً، أرجِعها ليُكملها.`
          : "");

    body.replaceChildren(
      el("div", { class: "row" },
        el("h3", { class: "grow", style: "margin:2px 0" }, t.name),
        el("span", { class: "pill" + (late ? " late" : "") },
          late ? "متأخّرة" : STAGE_AR[t.stage] || t.stageName || "")),
      el("div", { class: "meta" },
        [t.dept, t.assignee ? "المسنَد إليه: " + t.assignee : null,
          t.requester ? "طلبها: " + t.requester : null,
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
          html: t.description })
        : el("div", { class: "meta" }, "لا تفصيلَ مكتوبًا — اسأل في الردود أدناه."),
      el("label", {}, "نسبة الإنجاز"),
      el("div", { class: "row" }, pct, el("div", { class: "grow" }, track)),
      t.mine ? slider : null,
      t.mine ? el("button", { class: "btn", style: "margin-top:6px",
        onclick: async (ev) => {
          ev.target.disabled = true;
          try { await api.progress(t.id, Number(slider.value)); toast("حُفظت"); draw(); }
          catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احفظ النسبة") : null,
      gap ? el("div", { class: "meta", style: "margin-top:6px" }, gap) : null,
      acts.length ? el("div", { class: "row", style: "margin-top:10px" },
        acts.map(([l, fn, pri]) => el("button",
          { class: "btn" + (pri ? " pri" : ""), onclick: fn }, l))) : null,
      el("label", {}, "المرفقات"),
      flist,
      el("button", { class: "btn", style: "margin-top:6px",
        onclick: () => picker.click() }, "+ أرفق ملفًّا"),
      picker,
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
const DEPT_ORDER = ["inbox", "review", "doing", "new", "done"];
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

function returnSheet(onSend) {
  let box;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 2px" }, "سببُ الإرجاع"),
      el("div", { class: "meta" }, "يصل الموظّفَ إشعارًا بنصّه."),
      (box = el("textarea", { placeholder: "ما الذي ينقص؟" })),
      el("div", { class: "row", style: "margin-top:10px" },
        el("button", { class: "btn pri grow", onclick: () => {
          const v = box.value.trim();
          if (!v) { toast("اكتب السبب", true); return; }
          sheet.remove(); onSend(v);
        } }, "أرجِع"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
  document.body.append(sheet);
  setTimeout(() => box.focus(), 50);
}

async function viewDept(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let data, team = [];
  try {
    data = await api.deptTasks();
    team = (await api.team()).records || [];
  } catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }

  const refresh = () => viewDept(host);
  const managed = data.managed || [];
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      managed.map((d) => d.name).join(" · ") || "—"),
    el("button", { class: "btn pri",
      onclick: () => newTaskSheet(managed, team, refresh) }, "+ مهمّة"));

  const recs = data.records || [];
  if (!recs.length) {
    host.replaceChildren(head, el("div", { class: "empty" }, "لا مهامَّ في قسمك بعد."));
    return;
  }

  const listHost = el("div", {});
  const stages = DEPT_ORDER.filter((s) => recs.some((t) => t.stage === s));
  // أسماءُ من في القائمة فعلًا لا الفريقِ كلِّه: مرشِّحٌ بأسماءٍ بلا مهامَّ
  // يُوهم أنّ عليهم شيئًا.
  const people = [...new Set(recs.flatMap((t) => t.assignees || []))].sort();
  const bar = filterBar({ stages, people, depts: managed, onChange: () => redraw() });

  const redraw = () => {
    const list = recs.filter((t) => matchTask(t, bar.f));
    if (!list.length) {
      listHost.replaceChildren(el("div", { class: "empty" }, "لا مهمّةَ تطابق البحث."));
      return;
    }
    const byStage = new Map();
    for (const t of list) {
      if (!byStage.has(t.stage)) byStage.set(t.stage, []);
      byStage.get(t.stage).push(t);
    }
    const out = [el("div", { class: "meta", style: "margin:8px 2px 0" },
      `يُعرض ${list.length} من ${recs.length}`)];
    for (const st of DEPT_ORDER) {
      const l = byStage.get(st);
      if (!l || !l.length) continue;
      out.push(el("div", { class: "meta",
        style: "margin:14px 2px 2px;font-weight:700" },
        `${DEPT_STAGE_AR[st] || STAGE_AR[st] || st} (${l.length})`));
      for (const t of l) out.push(deptCard(t, team, refresh, managed.length > 1));
    }
    listHost.replaceChildren(...out);
  };

  host.replaceChildren(head, bar.node, listHost);
  redraw();
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

// depts = null → الموظّفُ يكتب لنفسه: لا اختيارَ قسمٍ ولا مسنَدٍ إليه.
// ══ مهمّةٌ جديدة: ثلاثةُ مقاصد ════════════════════════════════════════
// ⚠️ المقصدُ أوّلُ سؤالٍ لا آخرُه: كانت الورقةُ تسأل العنوانَ ثمّ تفترض
//    المقصدَ من دور فاتحِها — فالموظّفُ لا يملك إلّا نفسَه، والمديرُ لا
//    يملك إلّا فريقَه، ولا سبيلَ لأحدٍ أن يطلب من قسمٍ آخر شيئًا أصلًا.
// ⚠️ و«إلى قسمٍ آخر» لا تُسنَد على فردٍ بعينه: تنزل وارِدَ القسم ويوزّعها
//    مديرُه. حِملُ الرجلِ يعرفه مديرُه، ومن أسند من خارج القسم أسند على
//    مَن لا يدري ما عليه. ويُقال للمرسِل صراحةً إلى من تصل.
function newTaskSheet(depts, team, refresh) {
  const mgr = Array.isArray(depts) && depts.length > 0;
  let mode = mgr ? "team" : "me";
  let allDepts = null;          // تُجلب عند أوّل اختيارٍ لـ«قسمٍ آخر» لا قبلَه
  let admins = 0;               // عددُ مديري النظام — لصدق رسالةِ «إلى مَن تصل»
  let myDept = 0;               // قسمُ بطاقتي — صفرٌ يعني أنّ «لي» لا موضعَ لها
  let deptSel = null, who = null, otherSel = null;

  const box = el("div", {});
  const seg = el("div", { class: "seg", role: "tablist",
    style: "margin:10px 0 6px" });
  const tabs = [["me", "لي"]];
  if (mgr) tabs.push(["team", "لفريقي"]);
  tabs.push(["other", "قسمٌ آخر"]);

  const drawSeg = () => seg.replaceChildren(...tabs.map(([k, l]) =>
    el("button", { role: "tab", "aria-selected": String(k === mode),
      onclick: () => { mode = k; drawSeg(); drawBody(); } }, l)));

  // تُجلب مرّةً وتُستعمل في المقصدين: «لي» تحتاج قسمَ البطاقة، و«قسمٌ آخر»
  // تحتاج القائمةَ ومديريها.
  async function loadDepts(host) {
    if (allDepts) return true;
    try {
      const r = await api.depts();
      allDepts = r.records || [];
      admins = Number(r.admins || 0);
      myDept = Number(r.mine || 0);
      return true;
    } catch (e) {
      host.replaceChildren(el("div", { class: "err" }, e.message));
      return false;
    }
  }

  async function drawBody() {
    deptSel = who = otherSel = null;
    if (mode === "me") {
      box.replaceChildren(el("div", { class: "sk" }));
      if (!(await loadDepts(box))) return;
      // ⚠️ ويُقال له قبل أن يملأ الورقةَ لا بعدها: عشرةٌ من ستّةٍ وعشرين
      //    مستخدمًا بلا قسمٍ في بطاقتهم، وكان أحدُهم يكتب العنوانَ والموعدَ
      //    والتفصيلَ ثمّ يضغط «أنشئ» فيُردُّ برسالةِ خطأٍ ويضيع ما كتب.
      box.replaceChildren(myDept
        ? el("div", { class: "meta" }, "تُضاف إلى جدولك أنت.")
        : el("div", { class: "err" },
          "⚠️ لا قسمَ في بطاقتك، فلا موضعَ لمهمّتك — راجع الموارد البشرية."
          + " وتستطيع الآن إرسالَها إلى قسمٍ بعينه من «قسمٌ آخر»."));
      return;
    }
    if (mode === "team") {
      box.replaceChildren(
        depts.length > 1 ? el("label", {}, "القسم") : null,
        depts.length > 1
          ? (deptSel = el("select", {}, ...depts.map((d) =>
            el("option", { value: d.id }, d.name))))
          : null,
        el("label", {}, "المسنَد إليهم — واحدٌ أو أكثر"),
        // ⚠️ «اتركها في الوارد» هو الأصل: المديرُ يكتب المهمّةَ حين تخطر
        //    له ويوزّعها حين يرى الحِمل. وما بقي بلا اختيارٍ فهو مسوّدتُه.
        // ⚠️ واختيارُ عدّةٍ يُنشئ مهمّةً لكلِّ واحدٍ لا مهمّةً يتقاسمونها:
        //    النسبةُ والمراجعةُ والاعتمادُ لشخصٍ بعينه.
        el("div", { class: "meta" }, "بلا اختيارٍ تبقى في «الوارد» مسوّدةً لك."),
        (who = el("div", { class: "row", style: "gap:6px;margin-top:4px" },
          ...[...team].sort((a, b) => a.openTasks - b.openTasks).map((m) => {
            const b = el("button", { class: "slot", "aria-pressed": "false",
              "data-emp": String(m.id),
              onclick: () => b.setAttribute("aria-pressed",
                b.getAttribute("aria-pressed") === "true" ? "false" : "true") },
              `${m.name} · ${m.openTasks}`);
            return b;
          }))));
      return;
    }
    box.replaceChildren(el("div", { class: "sk" }));
    if (!(await loadDepts(box))) return;
    const list = allDepts.filter((d) => !d.managed);
    if (!list.length) {
      box.replaceChildren(el("div", { class: "empty" }, "لا أقسامَ أخرى."));
      return;
    }
    otherSel = el("select", {}, ...list.map((d) =>
      el("option", { value: d.id },
        d.name + (d.manager ? " — " + d.manager : " — بلا مدير"))));
    const note = el("div", { class: "meta", style: "margin-top:4px" }, "");
    const say = () => {
      const d = list.find((x) => x.id === Number(otherSel.value));
      if (d && d.manager) {
        note.className = "meta";
        note.textContent = `تصل وارِدَ القسم، ويُشعَر ${d.manager} ليوزّعها.`;
      } else if (admins > 0) {
        note.className = "meta";
        note.textContent = "لا مديرَ لهذا القسم — تصل وارِدَه ويُشعَر مديرو النظام.";
      } else {
        // ⚠️ ولا تُقال له «يُشعَر مديرو النظام» وليس في البوابة واحد:
        //    يُرسل ويطمئنّ، والطلبُ في وارِدٍ لا يفتحه أحد.
        note.className = "err";
        note.textContent = "⚠️ لا مديرَ لهذا القسم ولا مديرَ نظام:"
          + " تُسجَّل في الوارد ولا يصل إشعارٌ لأحد — أبلِغ الإدارة.";
      }
    };
    otherSel.addEventListener("change", say);
    box.replaceChildren(el("label", {}, "القسم"), otherSel, note);
    say();
  }

  let name, due, desc;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" }, "مهمّةٌ جديدة"),
      el("label", {}, "العنوان"),
      (name = el("input", { placeholder: "ما المطلوب؟" })),
      el("label", {}, "إلى مَن"),
      seg,
      box,
      el("label", {}, "الموعد النهائي (اختياري)"),
      (due = el("input", { type: "date" })),
      el("label", {}, "تفصيل (اختياري)"),
      (desc = el("textarea", { placeholder: "تفاصيلُ المطلوب" })),
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const title = name.value.trim();
          if (!title) { toast("اكتب العنوان", true); return; }
          if (mode === "other" && !otherSel) { toast("اختر القسم", true); return; }
          ev.target.disabled = true;
          try {
            const body = {
              name: title,
              deadline: due.value ? due.value + " 12:00:00" : null,
              description: desc.value.trim(),
            };
            if (mode === "team") {
              body.departmentId = deptSel ? Number(deptSel.value) : depts[0].id;
              body.employeeIds = who
                ? [...who.querySelectorAll('[aria-pressed="true"]')]
                  .map((b) => Number(b.dataset.emp)) : [];
            } else if (mode === "other") {
              body.departmentId = Number(otherSel.value);
            }
            const r = await api.createTask(body);
            sheet.remove();
            toast(r && r.toInbox ? "أُرسلت إلى وارِد القسم"
              : r && r.count > 1 ? `أُنشئت ${r.count} مهمّات` : "أُنشئت");
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
const AR_WD = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long" });
const AR_DM = new Intl.DateTimeFormat("ar-SA-u-ca-gregory",
  { day: "numeric", month: "short" });

async function viewWeek(host) {
  if (!weekStart) weekStart = sundayOf(new Date());
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let d;
  try { d = await api.week(isoDay(weekStart)); }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }

  const refresh = () => viewWeek(host);
  const hop = (n) => {
    weekStart = new Date(weekStart.getTime() + n * 7 * 864e5);
    viewWeek(host);
  };
  const end = new Date(weekStart.getTime() + 6 * 864e5);
  const today = isoDay(sundayOf(new Date())) === isoDay(weekStart);

  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("button", { class: "btn", onclick: () => hop(-1) }, "‹ السابق"),
    el("div", { class: "grow meta",
      style: "font-weight:700;text-align:center" },
      `${AR_DM.format(weekStart)} — ${AR_DM.format(end)}`),
    el("button", { class: "btn", onclick: () => hop(1) }, "التالي ›"));
  const nowBtn = today ? null
    : el("button", { class: "btn", style: "width:100%;margin-top:6px",
      onclick: () => { weekStart = sundayOf(new Date()); viewWeek(host); } },
      "ارجع إلى هذا الأسبوع");

  const out = [head];
  if (nowBtn) out.push(nowBtn);

  if ((d.late || []).length) {
    out.push(el("div", { class: "meta",
      style: "margin:14px 2px 2px;font-weight:700;color:var(--bad)" },
      `متأخّرة (${d.late.length})`));
    for (const t of d.late) out.push(dayTask(t, refresh));
  }
  // ⚠️ وما لا موعدَ له فوق الأسبوع كالمتأخّر: لا يومَ له فلا موضعَ له في
  //    الأيّام السبعة، ولو تُرك لاختفى من الجدول كلِّه وعلى صاحبه عمل.
  if ((d.undated || []).length) {
    out.push(el("div", { class: "meta",
      style: "margin:14px 2px 2px;font-weight:700" },
      `بلا موعد (${d.undated.length})`));
    for (const t of d.undated) out.push(dayTask(t, refresh));
  }

  const todayIso = isoDay(new Date(Date.UTC(new Date().getFullYear(),
    new Date().getMonth(), new Date().getDate())));
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
        el("span", { class: "meta" }, n ? `${n}` : "—")),
      ...(n
        ? [...day.tasks.map((t) => dayTask(t, refresh)),
          ...day.meetings.map((m) => dayMeet(m))]
        : [el("div", { class: "meta", style: "padding:4px 2px" }, "فارغ")])));
  }
  host.replaceChildren(...out);
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

function dayMeet(m) {
  return el("div", { class: "row",
    style: "gap:8px;padding:7px 2px;border-top:1px solid var(--line-2)" },
    el("span", { class: "pill" }, m.allday ? "طوال اليوم" : fmtTime(m.start)),
    el("div", { class: "grow" }, m.title),
    m.mode === "online" && m.link
      ? el("a", { class: "btn", style: "padding:3px 9px", href: m.link,
        target: "_blank", rel: "noopener" }, "ادخل")
      : el("span", { class: "meta" }, m.place || "حضوري"));
}
// ══ اجتماعاتي ═════════════════════════════════════════════════════════
const RESP_AR = { accepted: "قبلتَ", declined: "اعتذرتَ", tentative: "ربّما",
  needsAction: "بانتظار ردّك" };

function meetingCard(m, refresh) {
  const mine = m.myState || "needsAction";
  const pending = mine === "needsAction";
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow" }, m.title),
      el("span", { class: "pill" + (mine === "accepted" ? " ok" : mine === "declined" ? " late" : "") },
        RESP_AR[mine] || mine)),
    el("div", { class: "meta" },
      `${fmtWhen(m.start)} – ${fmtTime(m.stop)}`),
    el("div", { class: "meta" },
      [m.mode === "online" ? "أونلاين" : (m.place || "حضوري"),
        m.organizer ? "نظّمه " + m.organizer : null].filter(Boolean).join(" · ")),
    (m.attendees || []).length
      ? el("div", { class: "meta", style: "margin-top:4px" },
        "الحاضرون: " + m.attendees.map((a) => a.name).join("، "))
      : null,
    el("div", { class: "row", style: "margin-top:10px" },
      m.mode === "online" && m.link
        ? el("a", { class: "btn pri", href: m.link, target: "_blank",
          rel: "noopener" }, "ادخل الاجتماع")
        : null,
      pending ? el("button", { class: "btn pri", onclick: async () => {
        try { await api.respond(m.id, true); toast("قبلتَ الدعوة"); refresh(); }
        catch (e) { toast(e.message, true); }
      } }, "أقبل") : null,
      pending ? el("button", { class: "btn danger", onclick: async () => {
        try { await api.respond(m.id, false); toast("اعتذرتَ"); refresh(); }
        catch (e) { toast(e.message, true); }
      } }, "أعتذر") : null));
}

async function viewMeetings(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let recs = [];
  try { recs = (await api.meetings()).records || []; }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }

  const refresh = () => viewMeetings(host);
  // ⚠️ الحجزُ متاحٌ للجميع: من يحتاج اجتماعًا مع قسمٍ آخر لا يحتاج إذنًا
  //    ليطلبه — والمدعوُّ يقبل أو يعتذر، وهذا هو الإذن.
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      recs.length ? `${recs.length} اجتماعًا قادمًا` : ""),
    el("button", { class: "btn pri", onclick: () => bookSheet(refresh) },
      "+ احجز"));
  host.replaceChildren(head,
    ...(recs.length
      ? recs.map((m) => meetingCard(m, refresh))
      : [el("div", { class: "empty" }, "لا اجتماعاتِ قادمة.")]));
}

// ── حجزُ اجتماع ────────────────────────────────────────────────────────
// ⚠️ الوقتُ يُختار من الفراغ لا من تقويمٍ فارغ: الخادمُ يحسب ما يفرغ فيه
//    الحاضرون كلُّهم (الدوام ناقص الاجتماعات ناقص الإجازات)، فلا يُحجز
//    موعدٌ يعتذر عنه نصفُهم.
// ⚠️ والحاضرون من كلِّ الأقسام: الاجتماعُ يُعقد بين الأقسام أكثرَ ممّا
//    يُعقد داخلها. وقائمةُ أربعةٍ وأربعين اسمًا لا تُعرض دفعةً — تُبحث.
function bookSheet(refresh) {
  let title, mode, place, mins, from, to, note, search;
  const picked = new Map();          // id → name
  let slot = null;
  let people = [];
  const chips = el("div", { class: "row", style: "gap:6px;margin:6px 0" });
  const list = el("div", { style: "max-height:190px;overflow:auto;margin-top:6px" });
  const slotBox = el("div", { class: "row", style: "gap:6px;margin-top:6px" });

  const drawChips = () => {
    chips.replaceChildren(...(picked.size
      ? [...picked].map(([id, nm]) => el("button", {
        class: "slot", "aria-pressed": "true",
        onclick: () => { picked.delete(id); drawChips(); drawList(); loadSlots(); },
      }, nm + " ×"))
      : [el("div", { class: "meta" }, "لم تختر أحدًا بعد.")]));
  };

  const drawList = () => {
    const q = (search.value || "").trim();
    const shown = people.filter((p) => !picked.has(p.id)
      && (!q || p.name.includes(q) || p.dept.includes(q)));
    if (!shown.length) {
      list.replaceChildren(el("div", { class: "meta" }, "لا أحدَ بهذا الاسم."));
      return;
    }
    const out = [];
    let dept = null;
    for (const p of shown.slice(0, 60)) {
      if (p.dept !== dept) {
        dept = p.dept;
        out.push(el("div", { class: "meta",
          style: "font-weight:700;margin:8px 2px 2px" }, dept));
      }
      out.push(el("button", {
        class: "btn", style: "width:100%;text-align:start;margin:3px 0",
        onclick: () => {
          picked.set(p.id, p.name);
          search.value = "";
          drawChips(); drawList(); loadSlots();
        },
      }, p.name + (p.job ? ` · ${p.job}` : "")));

  const loadSlots = async () => {
    slot = null;
    if (picked.size === 0) {
      slotBox.replaceChildren(el("div", { class: "meta" },
        "اختر من تجتمع بهم أوّلًا."));
      return;
    }
    slotBox.replaceChildren(el("div", { class: "meta" }, "أبحث عن الفراغ…"));
    try {
      const r = await api.slots({
        employeeIds: [...picked.keys()], from: from.value, to: to.value,
        minutes: Number(mins.value || 30),
      });
      const items = r.slots || [];
      if (!items.length) {
        slotBox.replaceChildren(el("div", { class: "meta" },
          "لا وقتَ يفرغ فيه الجميعُ في هذا المدى — وسّعه أو أنقِص الحاضرين."));
        return;
      }
      slotBox.replaceChildren(...items.map((s) => {
        const b = el("button", { class: "slot", "aria-pressed": "false",
          onclick: () => {
            slot = s;
            for (const x of slotBox.children) x.setAttribute("aria-pressed", "false");
            b.setAttribute("aria-pressed", "true");
          } }, `${fmtDay(s.start)} ${fmtTime(s.start)}`);
        return b;
      }));
    } catch (e) { slotBox.replaceChildren(el("div", { class: "err" }, e.message)); }
  };

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" }, "احجز اجتماعًا"),
      el("label", {}, "الموضوع"),
      (title = el("input", { placeholder: "موضوع الاجتماع" })),
      el("label", {}, "الحاضرون — من أيِّ قسم"),
      chips,
      (search = el("input", { placeholder: "ابحث باسم الموظّف أو القسم…",
        oninput: () => drawList() })),
      list,
      el("label", {}, "النوع"),
      (mode = el("select", { onchange: () => {
        place.style.display = mode.value === "online" ? "none" : "";
      } },
        el("option", { value: "onsite" }, "حضوري"),
        el("option", { value: "online" }, "أونلاين — رابطٌ يُنشأ تلقائيًّا"))),
      (place = el("input", { placeholder: "المكان (قاعة الاجتماعات…)" })),
      el("div", { class: "row" },
        el("div", { class: "grow" }, el("label", {}, "من"),
          (from = el("input", { type: "date", value: iso(today),
            onchange: () => loadSlots() }))),
        el("div", { class: "grow" }, el("label", {}, "إلى"),
          (to = el("input", { type: "date",
            value: iso(new Date(today.getTime() + 6 * 864e5)),
            onchange: () => loadSlots() })))),
      el("label", {}, "المدّة"),
      (mins = el("select", { onchange: () => loadSlots() },
        el("option", { value: "30" }, "نصف ساعة"),
        el("option", { value: "60" }, "ساعة"),
        el("option", { value: "90" }, "ساعة ونصف"))),
      el("label", {}, "الأوقاتُ التي يفرغ فيها الجميع"),
      slotBox,
      el("label", {}, "ملاحظة (اختياري)"),
      (note = el("textarea", { placeholder: "جدولُ الأعمال" })),
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          if (!title.value.trim()) { toast("اكتب الموضوع", true); return; }
          if (!picked.size) { toast("اختر من تجتمع بهم", true); return; }
          if (!slot) { toast("اختر وقتًا", true); return; }
          ev.target.disabled = true;
          try {
            await api.createMeeting({
              title: title.value.trim(), start: slot.start, stop: slot.stop,
              mode: mode.value, employeeIds: [...picked.keys()],
              place: place.value.trim(), note: note.value.trim(),
            });
            sheet.remove(); toast("حُجز الاجتماع"); refresh();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احجز"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
  document.body.append(sheet);
  drawChips();
  loadSlots();
  api.people().then((r) => {
    // ⚠️ أنا لستُ في القائمة: الخادمُ يُضيفني إلى الحاضرين دائمًا، فلو
    //    عُرضتُ لاختار المستخدمُ نفسَه ثمّ عدَّ نفسه مرّتين.
    people = (r.records || []).filter((p) => p.id !== r.me);
    drawList();
  }).catch(() => {
    list.replaceChildren(el("div", { class: "err" }, "تعذّر جلبُ الموظفين"));
  });
}
    }
    list.replaceChildren(...out);
  };

// ══ التبويبُ والإقلاع ═════════════════════════════════════════════════
// ⚠️ تبويبُ «قسمي» لا يُعرض إلّا لمن يدير قسمًا فعلًا: يُسأل الخادمُ
//    مرّةً عند الإقلاع، ولا يُبنى على دور البوابة — فالدورُ صفةٌ لا تقول
//    أيَّ قسمٍ يدير، وقد يحمله من لا قسمَ له.
const TABS = [
  { k: "mine", l: "مهامي", view: viewMine },
  { k: "week", l: "جدولي", view: viewWeek },
  { k: "meetings", l: "اجتماعاتي", view: viewMeetings },
  { k: "dept", l: "قسمي", view: viewDept, managerOnly: true },
];

async function boot() {
  if (EMBED) document.documentElement.classList.add("sq-embed");
  const seg = $("#sq-seg");
  const body = $("#sq-body");

  $("#sq-back").addEventListener("click", goBack);

  let managed = false;
  try { managed = ((await api.deptTasks()).managed || []).length > 0; }
  catch { managed = false; }

  const tabs = TABS.filter((t) => !t.managerOnly || managed);
  const start = new URLSearchParams(location.search).get("t");
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
}

boot();
