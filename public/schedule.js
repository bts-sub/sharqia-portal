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
  const acts = [];
  if (t.stage === "new") acts.push(["ابدأ العمل", () => onAct(t, "doing"), true]);
  if (t.stage === "doing") acts.push(["أرسل للمراجعة", () => onAct(t, "review"), true]);
  // ⚠️ العنوانُ بابٌ لا نصّ: الضغطُ عليه يفتح تفاصيلَ المهمّة — النسبةَ
  //    والتعليقاتِ والمرفقات. وهو العنوانُ وحدَه لا البطاقةُ كلُّها، كي لا
  //    يفتح زرُّ «ابدأ العمل» الشاشةَ مع ضغطته.
  return el("div", { class: "card" },
    el("div", { class: "row" },
      el("h3", { class: "grow", style: "cursor:pointer",
        onclick: () => openTask(t.id, refresh) }, t.name),
      el("span", { class: "pill" + (late ? " late" : "") },
        late ? "متأخّرة" : STAGE_AR[t.stage] || t.stageName || "")),
    el("div", { class: "meta" },
      [t.dept, t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
        .filter(Boolean).join(" · ")),
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

async function viewMine(host) {
  host.replaceChildren(el("div", { class: "sk" }), el("div", { class: "sk" }));
  let data;
  try { data = await api.tasks(); }
  catch (e) { host.replaceChildren(el("div", { class: "err" }, e.message)); return; }
  const recs = data.records || [];
  const refresh = () => viewMine(host);

  // ⚠️ زرُّ الإضافة لكلِّ موظّفٍ لا للمدير وحدَه: «جدولي» جدولُ صاحبه قبل
  //    أن يكون لوحةَ توزيع، ومن لا يملك أن يكتب لنفسه سطرًا لا يفتحه إلّا
  //    ليقرأ ما أُملي عليه.
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      recs.length ? `${recs.length} مهمّة` : ""),
    el("button", { class: "btn pri",
      onclick: () => newTaskSheet(null, [], refresh) }, "+ مهمّة"));

  if (!recs.length) {
    host.replaceChildren(head,
      el("div", { class: "empty" }, "لا مهامَّ عليك الآن."));
    return;
  }
  const onAct = async (t, to) => {
    try { await api.move(t.id, to); toast("تمّ"); refresh(); }
    catch (e) { toast(e.message, true); }
  };
  const byStage = new Map();
  for (const t of recs) {
    if (!byStage.has(t.stage)) byStage.set(t.stage, []);
    byStage.get(t.stage).push(t);
  }
  const out = [head];
  for (const st of MY_ORDER) {
    const list = byStage.get(st);
    if (!list || !list.length) continue;
    out.push(el("div", { class: "meta", style: "margin:14px 2px 2px;font-weight:700" },
      `${STAGE_AR[st] || st} (${list.length})`));
    for (const t of list) out.push(taskCard(t, onAct, refresh));
  }
  host.replaceChildren(...out);
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
      : [el("div", { class: "meta" }, "لا تعليقات.")]));

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
    if (t.mine && t.stage === "new")
      acts.push(["ابدأ العمل", async () => {
        try { await api.move(t.id, "doing"); toast("بدأت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    if (t.mine && t.stage === "doing")
      acts.push(["أرسل للمراجعة", async () => {
        try { await api.move(t.id, "review"); toast("أُرسلت"); draw(); }
        catch (e) { toast(e.message, true); } }, true]);
    if (!t.mine && t.stage === "review") {
      acts.push(["اعتمد", async () => {
        try { await api.decide(t.id, { approve: true }); toast("اعتُمدت"); close(); }
        catch (e) { toast(e.message, true); } }, true]);
      acts.push(["أرجِع", () => returnSheet(async (note) => {
        try { await api.decide(t.id, { note }); toast("أُرجعت"); close(); }
        catch (e) { toast(e.message, true); } })]);
    }

    body.replaceChildren(
      el("div", { class: "row" },
        el("h3", { class: "grow", style: "margin:2px 0" }, t.name),
        el("span", { class: "pill" + (late ? " late" : "") },
          late ? "متأخّرة" : STAGE_AR[t.stage] || t.stageName || "")),
      el("div", { class: "meta" },
        [t.dept, t.assignee ? "المسنَد إليه: " + t.assignee : null,
          t.deadline ? "الموعد: " + fmtDay(t.deadline) : null]
          .filter(Boolean).join(" · ")),
      t.returnNote ? el("div", { class: "err", style: "margin-top:8px" },
        "أُرجعت: " + t.returnNote) : null,
      t.description ? el("div", { class: "meta", style: "margin-top:6px",
        html: t.description }) : null,
      el("label", {}, "نسبة الإنجاز"),
      el("div", { class: "row" }, pct, el("div", { class: "grow" }, track)),
      t.mine ? slider : null,
      t.mine ? el("button", { class: "btn", style: "margin-top:6px",
        onclick: async (ev) => {
          ev.target.disabled = true;
          try { await api.progress(t.id, Number(slider.value)); toast("حُفظت"); draw(); }
          catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "احفظ النسبة") : null,
      acts.length ? el("div", { class: "row", style: "margin-top:10px" },
        acts.map(([l, fn, pri]) => el("button",
          { class: "btn" + (pri ? " pri" : ""), onclick: fn }, l))) : null,
      el("label", {}, "المرفقات"),
      flist,
      el("button", { class: "btn", style: "margin-top:6px",
        onclick: () => picker.click() }, "+ أرفق ملفًّا"),
      picker,
      el("label", {}, "التعليقات"),
      clist,
      (cbox = el("textarea", { placeholder: "اكتب تعليقًا…" })),
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const v = cbox.value.trim();
          if (!v) { toast("اكتب التعليق", true); return; }
          ev.target.disabled = true;
          try { await api.comment(t.id, v); cbox.value = ""; toast("أُضيف"); draw(); }
          catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "أضف تعليقًا"),
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
  const head = el("div", { class: "row", style: "margin:12px 0 4px" },
    el("div", { class: "grow meta", style: "font-weight:700" },
      (data.managed || []).map((d) => d.name).join(" · ") || "—"),
    el("button", { class: "btn pri", onclick: () => newTaskSheet(data.managed || [], team, refresh) },
      "+ مهمّة"));

  const recs = data.records || [];
  if (!recs.length) {
    host.replaceChildren(head, el("div", { class: "empty" }, "لا مهامَّ في قسمك بعد."));
    return;
  }
  const byStage = new Map();
  for (const t of recs) {
    if (!byStage.has(t.stage)) byStage.set(t.stage, []);
    byStage.get(t.stage).push(t);
  }
  const out = [head];
  for (const st of DEPT_ORDER) {
    const list = byStage.get(st);
    if (!list || !list.length) continue;
    out.push(el("div", { class: "meta", style: "margin:14px 2px 2px;font-weight:700" },
      `${DEPT_STAGE_AR[st] || STAGE_AR[st] || st} (${list.length})`));
    for (const t of list) out.push(deptCard(t, team, refresh));
  }
  host.replaceChildren(...out);
}

function deptCard(t, team, refresh) {
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
      [(t.assignees || []).join("، ") || "بلا مسنَد إليه",
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
function newTaskSheet(depts, team, refresh) {
  const mgr = Array.isArray(depts) && depts.length > 0;
  let name, dept, who, due, desc;
  const sheet = el("div", { class: "sheet", onclick: (e) => {
    if (e.target === sheet) sheet.remove();
  } },
    el("div", {},
      el("h3", { style: "margin:4px 0 8px" },
        mgr ? "مهمّةٌ جديدة" : "مهمّةٌ لي"),
      !mgr ? el("div", { class: "meta", style: "margin-bottom:6px" },
        "تُضاف إلى جدولك أنت.") : null,
      el("label", {}, "العنوان"),
      (name = el("input", { placeholder: "ما المطلوب؟" })),
      mgr && depts.length > 1 ? el("label", {}, "القسم") : null,
      mgr && depts.length > 1
        ? (dept = el("select", {}, ...depts.map((d) =>
          el("option", { value: d.id }, d.name))))
        : null,
      mgr ? el("label", {}, "المسنَد إليهم — واحدٌ أو أكثر") : null,
      // ⚠️ «اتركها في الوارد» هو الأصل: المديرُ يكتب المهمّةَ حين تخطر له
      //    ويوزّعها حين يرى الحِمل. وما بقي بلا اختيارٍ فهو مسوّدتُه.
      // ⚠️ واختيارُ عدّةٍ يُنشئ مهمّةً لكلِّ واحد لا مهمّةً يتقاسمونها:
      //    النسبةُ والمراجعةُ والاعتمادُ لشخصٍ بعينه.
      mgr ? el("div", { class: "meta" },
        "بلا اختيارٍ تبقى في «الوارد» مسوّدةً لك.") : null,
      mgr ? (who = el("div", { class: "row", style: "gap:6px;margin-top:4px" },
        ...[...team].sort((a, b) => a.openTasks - b.openTasks).map((m) => {
          const b = el("button", { class: "slot", "aria-pressed": "false",
            "data-emp": String(m.id),
            onclick: () => b.setAttribute("aria-pressed",
              b.getAttribute("aria-pressed") === "true" ? "false" : "true") },
            `${m.name} · ${m.openTasks}`);
          return b;
        }))) : null,
      el("label", {}, "الموعد النهائي (اختياري)"),
      (due = el("input", { type: "date" })),
      el("label", {}, "تفصيل (اختياري)"),
      (desc = el("textarea", { placeholder: "تفاصيلُ المطلوب" })),
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn pri grow", onclick: async (ev) => {
          const title = name.value.trim();
          if (!title) { toast("اكتب العنوان", true); return; }
          ev.target.disabled = true;
          try {
            const r = await api.createTask({
              name: title,
              ...(mgr ? {
                departmentId: dept ? Number(dept.value) : depts[0].id,
                employeeIds: who ? [...who.querySelectorAll('[aria-pressed="true"]')]
                  .map((b) => Number(b.dataset.emp)) : [],
              } : {}),
              deadline: due.value ? due.value + " 12:00:00" : null,
              description: desc.value.trim(),
            });
            sheet.remove();
            toast(r && r.count > 1 ? `أُنشئت ${r.count} مهمّات` : "أُنشئت");
            refresh();
          } catch (e) { ev.target.disabled = false; toast(e.message, true); }
        } }, "أنشئ"),
        el("button", { class: "btn", onclick: () => sheet.remove() }, "إلغاء"))));
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
