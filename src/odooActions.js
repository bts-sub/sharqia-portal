// ===========================================================================
// odooActions.js — طبقة العمليات الموحّدة مع Odoo (نقطة الدخول: POST /api/odoo)
//   كل عملية Odoo تُعرّف هنا كـ action باسم، وتُستدعى بـ { action, params }.
//   منطق Test Mode: لو TEST_MODE مفعّل أو فشل الاتصال بأودو → ترجع fixtures.
//   ملاحظة الأمان: ctx.user يأتي من الجلسة (JWT) ويحدّد الموظف المرتبط في Odoo.
// ===========================================================================
import * as odoo from "./lib/odooClient.js";
import { isTestMode } from "./lib/settings.js";
import { nearestLocation } from "./lib/geo.js";
import * as FX from "./fixtures.js";

// غلاف موحّد: يجرّب Odoo، ويسقط لبيانات الاختبار عند التفعيل اليدوي أو فشل الاتصال
//   forceLiveErrors: عمليات الكتابة الحسّاسة — لا تُخفِ الخطأ خلف fixtures.
//   emptyOnError:    بيانات يراها الموظف كحقيقة (رصيد، إجازات، تعاميم) — عند الفشل
//                    نرجع فراغًا صريحًا مع تحذير، لا أرقامًا تجريبية يصدّقها.
//                    (fixtures تبقى كاملة في وضع الاختبار — لم تُمسّ ميزة العرض التجريبي.)
async function withOdoo(liveFn, fixtureFn, { forceLiveErrors = false, emptyOnError = null } = {}) {
  if (isTestMode()) return { source: "test", data: await fixtureFn() };
  try {
    return { source: "odoo", data: await liveFn() };
  } catch (e) {
    if (forceLiveErrors) throw e;
    if (emptyOnError) {
      console.warn("⚠️ تعذّرت قراءة بيانات حقيقية من Odoo:", e.message);
      return { source: "unavailable", data: emptyOnError(), warning: e.message };
    }
    return { source: "test-fallback", data: await fixtureFn(), warning: e.message };
  }
}

// معرّف الموظف قد يصل من الواجهة بصيغة "E42" — نحوّله لرقم Odoo
// (بدونه كان domain يحمل نصًّا فلا يُرجع أودو أي إجازة أبدًا → شاشتا الإجازات فارغتان)
function toEmpId(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const m = String(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

// حقول hr.employee التي نقرأها ونحوّلها لشكل الواجهة
const EMP_FIELDS = ["name", "job_title", "department_id", "work_email", "work_phone", "parent_id",
  "employee_type", "work_location_id", "company_id", "image_128"];

// ---------------------------------------------------------------------------
// تفاصيل الطلب: جمعها من الحمولة، وتحويلها لحقول Odoo
//   التطبيق يرسل تفاصيل كل خدمة بمفاتيح مختلفة (نوع الإجازة، من/إلى، المبلغ…)
//   مرة في المستوى الأعلى ومرة داخل extra. نجمع الاثنين حتى لا تضيع تفاصيل مع
//   أي نسخة من الواجهة، ثم نعيّن ما نعرفه على أعمدة مخصّصة ونحفظ الباقي JSON.
//   ⚠️ هذه المرادفات مطابقة لـ EXTRA_ALIASES في الأدون (models/portal_request.py)
//   حتى تُقرأ التفاصيل بنفس الشكل من الطرفين.
// ---------------------------------------------------------------------------
const DETAIL_ALIASES = {
  sub_type: ["subType", "sub_type", "leaveType", "assetType", "letterType", "certType", "trainingType", "complaintType"],
  date_from: ["from", "dateFrom", "startDate", "date", "needDate", "changeDate", "birthDate"],
  date_to: ["to", "dateTo", "endDate", "returnDate", "expiry"],
  days: ["days", "duration_days", "numDays"],
  amount: ["amount", "salary", "value"],
  quantity: ["quantity", "copies", "qty"],
  purpose: ["purpose", "to_entity", "toEntity", "delivery", "destination", "lang"],
  reason: ["reason", "notes", "note"],
};

// مفاتيح الحمولة التي ليست تفاصيل (رأس الطلب أو حقول تحكّم في الواجهة)
const CONTROL_KEYS = new Set([
  "service", "category", "title", "desc", "description", "priority", "confidential",
  "extra", "attachments", "idempotencyKey", "ack",
  "id", "odooId", "status", "state", "flow", "stageIndex", "audit", "at", "emp", "employee",
]);

const isEmpty = (v) =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

// كل ما أرسله التطبيق كتفاصيل: المستوى الأعلى + extra (extra له الأولوية)
function collectDetails(params = {}) {
  const out = {};
  const put = (k, v) => { if (!isEmpty(v)) out[k] = v; };
  for (const [k, v] of Object.entries(params)) if (!CONTROL_KEYS.has(k)) put(k, v);
  const ex = params.extra;
  if (ex && typeof ex === "object" && !Array.isArray(ex)) for (const [k, v] of Object.entries(ex)) put(k, v);
  // أسماء المرفقات تُحفظ ضمن التفاصيل حتى تظهر في Odoo حتى لو لم تُرفع الملفات
  const names = (params.attachments || []).map((a) => a?.name || a?.fileName).filter(Boolean);
  if (names.length) out.attachmentNames = names;
  return out;
}

const toNum = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n; };
// تاريخ فقط (YYYY-MM-DD). قيم الوقت مثل "09:00" ليست تواريخ → تبقى في extra_json
const toDate = (v) => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : s.slice(0, 10);
};

// تعيين التفاصيل على أعمدة sharqia.portal.request
function mapDetailFields(details) {
  const vals = {};
  const pick = (keys) => { for (const k of keys) if (!isEmpty(details[k])) return details[k]; return null; };
  // للتاريخ/الرقم: خذ أول مرادف **يصلح** فعلًا، لا أول مرادف موجود.
  // (استئذان بالساعات يرسل from="09:00" وdate="2026-09-03" — لولا هذا لضاع التاريخ)
  const pickBy = (keys, conv) => {
    for (const k of keys) {
      if (isEmpty(details[k])) continue;
      const v = conv(details[k]);
      if (v !== null) return v;
    }
    return null;
  };
  const subType = pick(DETAIL_ALIASES.sub_type);
  const dateFrom = pickBy(DETAIL_ALIASES.date_from, toDate);
  const dateTo = pickBy(DETAIL_ALIASES.date_to, toDate);
  const days = pickBy(DETAIL_ALIASES.days, toNum);
  const amount = pickBy(DETAIL_ALIASES.amount, toNum);
  const quantity = pickBy(DETAIL_ALIASES.quantity, toNum);
  const purpose = pick(DETAIL_ALIASES.purpose);
  const reason = pick(DETAIL_ALIASES.reason);
  if (subType != null) vals.sub_type = String(subType);
  if (dateFrom) vals.date_from = dateFrom;
  if (dateTo) vals.date_to = dateTo;
  if (amount != null) vals.amount = amount;
  if (quantity != null) vals.quantity = quantity;
  if (purpose != null) vals.purpose = String(purpose);
  if (reason != null) vals.reason = String(reason);
  if (days != null) vals.days = days;
  else if (dateFrom && dateTo) {
    const diff = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
    if (diff > 0) vals.days = diff;
  }
  return vals;
}

// تسميات عربية لملخّص التفاصيل (تُستخدم عند تعذّر كتابة الأعمدة المخصّصة)
const DETAIL_LABELS = {
  leaveType: "نوع الإجازة", from: "من", to: "إلى", days: "عدد الأيام", assetType: "نوع العهدة",
  quantity: "الكمية", needDate: "تاريخ الاحتياج", duration: "مدة العهدة", returnDate: "تاريخ الإرجاع",
  to_entity: "الجهة الموجّه إليها", purpose: "الغرض", lang: "اللغة", inc: "يتضمّن الراتب",
  incSalary: "يتضمّن الراتب", copies: "عدد النسخ", delivery: "طريقة الاستلام", letterType: "نوع الخطاب",
  date: "التاريخ", time: "الوقت", amount: "المبلغ", months: "عدد أشهر السداد", reason: "السبب",
  notes: "ملاحظات", new: "القيمة الجديدة", confirm: "تأكيد القيمة", expiry: "تاريخ الانتهاء",
  changeDate: "تاريخ التغيير", bankName: "اسم البنك", name: "الاسم", birthDate: "تاريخ الميلاد",
  gender: "الجنس", babyId: "رقم الهوية", items: "العناصر", attachmentNames: "المرفقات",
  leaveTypeId: "معرّف نوع الإجازة", productId: "معرّف المنتج",
  beneficiaryId: "المستفيد", onBehalf: "بالنيابة عن الموظف", requester: "مقدّم الطلب",
  originalLeave: "الإجازة الأصلية", changeType: "نوع التعديل",
};

// التفاصيل المخزَّنة في أعمدة الطلب → شكل جاهز للعرض في التطبيق
const DETAIL_COLUMN_LABELS = {
  sub_type: "النوع", date_from: "من تاريخ", date_to: "إلى تاريخ", days: "عدد الأيام",
  amount: "المبلغ", quantity: "الكمية", purpose: "الغرض / الجهة", reason: "السبب",
};
function pickDetailValues(rec = {}) {
  const out = [];
  for (const [key, label] of Object.entries(DETAIL_COLUMN_LABELS)) {
    const v = rec[key];
    if (isEmpty(v) || v === false || v === 0) continue;
    out.push({ key, label, value: String(v) });
  }
  return out;
}

function detailsSummary(details) {
  const lines = [];
  for (const [k, v] of Object.entries(details)) {
    if (isEmpty(v)) continue;
    const shown = typeof v === "boolean" ? (v ? "نعم" : "لا")
      : Array.isArray(v) && v.every((x) => typeof x !== "object") ? v.join("، ")
        : (typeof v === "object" ? JSON.stringify(v, null, 1) : String(v));
    lines.push(`• ${DETAIL_LABELS[k] || k}: ${shown}`);
  }
  return lines.join("\n");
}

// أسماء حقول الطلب في Odoo — نقرأها مرة ونخزّنها، حتى لا نرسل حقلًا غير موجود
// (لو لم يُرقَّ الأدون بعد، يُنشأ الطلب بالتفاصيل داخل extra_json + الوصف بدل أن يفشل)
const REQUEST_BASE_FIELDS = ["employee_id", "category", "service", "title", "description", "priority", "confidential", "extra_json"];
let reqFieldsCache = { at: 0, names: null };

// الحقول التي نقرأها للطلب — مفلترة على ما يوجد فعلًا في الموديل
const REQUEST_READ_BASE = ["name", "employee_id", "category", "service", "title", "description",
  "priority", "confidential", "state", "current_stage", "create_date"];
const REQUEST_READ_DETAILS = ["sub_type", "date_from", "date_to", "days", "amount", "quantity",
  "purpose", "reason", "extra_json"];

async function requestReadFields() {
  const known = await requestFieldNames();
  const all = [...REQUEST_READ_BASE, ...REQUEST_READ_DETAILS];
  return known ? all.filter((f) => known.has(f)) : REQUEST_READ_BASE.filter((f) => f !== "current_stage");
}

// سجل Odoo → شكل يفهمه التطبيق (extra جاهزة + تفاصيل معنونة)
//   ⚠️ empId ضروري: شاشة «طلباتي» تفلتر بـ (request.empId === employee.id)
//   وصيغة معرّف الموظف في التطبيق هي "E"+رقم أودو (انظر mapEmployee).
//   بدونه تظهر الشاشة فارغة تمامًا مهما كان عدد الطلبات.
function mapRequestRecord(rec) {
  let extra = {};
  try { extra = JSON.parse(rec.extra_json || "{}") || {}; } catch { extra = {}; }
  if (typeof extra !== "object" || Array.isArray(extra)) extra = {};
  const emp = Array.isArray(rec.employee_id) ? rec.employee_id : null;
  return {
    ...rec,
    empId: emp ? "E" + emp[0] : "",
    empName: emp ? emp[1] : "",
    extra,
    details: pickDetailValues(rec),
  };
}

// أسماء حقول أي موديل — تُقرأ مرة وتُخزَّن. تُستخدم لتصفية قائمة حقول مطلوبة
// على الموجود فعلًا، فاختلاف اسم حقل بين نسخ أودو لا يُفشل القراءة كلها.
const modelFieldsCache = new Map();
async function modelFieldNames(model) {
  const hit = modelFieldsCache.get(model);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.names;
  let names = null;
  try {
    const f = await odoo.execKw(model, "fields_get", [[], ["type"]]);
    names = new Set(Object.keys(f || {}));
  } catch { names = null; }
  modelFieldsCache.set(model, { at: Date.now(), names });
  return names;
}
async function availableFields(model, wanted) {
  const names = await modelFieldNames(model);
  if (!names) return wanted;
  const ok = wanted.filter((f) => names.has(f));
  return ok.length ? ok : wanted;
}

async function requestFieldNames() {
  if (reqFieldsCache.names && Date.now() - reqFieldsCache.at < 5 * 60 * 1000) return reqFieldsCache.names;
  try {
    const f = await odoo.execKw("sharqia.portal.request", "fields_get", [[], ["type"]]);
    reqFieldsCache = { at: Date.now(), names: new Set(Object.keys(f || {})) };
  } catch {
    reqFieldsCache = { at: Date.now(), names: null }; // تعذّرت القراءة → نكتفي بالحقول الأساسية
  }
  return reqFieldsCache.names;
}

function mapEmployee(rec) {
  if (!rec) return null;
  return {
    id: "E" + rec.id, odooId: rec.id, name: rec.name,
    jobTitle: rec.job_title || "", dept: rec.department_id?.[1] || "",
    branch: rec.work_location_id?.[1] || "", empNo: String(rec.id),
    manager: rec.parent_id?.[1] || "", email: rec.work_email || "", phone: rec.work_phone || "",
    contract: rec.employee_type || "", company: rec.company_id?.[1] || "",
    // صورة الموظف من أودو كـ data URI جاهزة للعرض في <img> مباشرة
    photo: rec.image_128 ? `data:image/png;base64,${rec.image_128}` : "",
    leaveBalance: rec.leaveBalance ?? null,
  };
}

// حالات الطلب المغلقة — لا تظهر في صندوق وارد أحد
const CLOSED_STATES = ["done", "rejected", "cancelled"];

// مسارات الاعتماد — مطابقة لـ FLOW في الأدون (models/portal_request.py)
// وتُستخدم لفرض المرحلة على الخادم قبل تمرير الاعتماد إلى Odoo.
export const FLOW = {
  leave: ["manager", "hr", "done"], attend: ["manager", "hr", "done"],
  finance: ["manager", "hr", "finance", "done"], custody: ["manager", "it", "done"],
  transfer: ["manager", "hr", "done"], personal: ["hr", "done"], letters: ["hr", "done"],
  training: ["manager", "hr", "done"], insurance: ["hr", "done"], complaint: ["hr", "done"],
  offboard: ["manager", "hr", "done"], general: ["manager", "hr", "done"],
};

// حالات العهدة (hr.custody من Open HRMS + موديل الأدون) → نص عربي
const CUSTODY_STATE_AR = {
  draft: "مسودة", to_approve: "بانتظار الاعتماد", approved: "مُستلَمة",
  returned: "مُرجَعة", rejected: "مرفوضة",
  assigned: "مُستلَمة", pending: "بانتظار الاعتماد",
};

function mapCustody(rec) {
  const today = new Date().toISOString().slice(0, 10);
  const ret = rec.return_date || rec.renew_date || "";
  return {
    id: rec.id,
    name: rec.custody_property_id?.[1] || rec.name || "عهدة",
    serial: rec.name || "",                       // رقم العهدة في أودو (Code)
    since: rec.date_request || "",
    returnDate: ret,
    purpose: rec.purpose || "",
    status: CUSTODY_STATE_AR[rec.state] || rec.state || "",
    // maint: قاربت أو تجاوزت تاريخ الإرجاع — تُبرز في الواجهة
    maint: !!(ret && ret <= today && rec.state !== "returned"),
  };
}

// حالة الإجازة في Odoo → نص عربي متوافق مع الواجهة
const LEAVE_STATE_AR = {
  draft: "مسودة", confirm: "في انتظار المدير", validate1: "بانتظار الموارد البشرية",
  validate: "معتمدة", refuse: "مرفوضة", cancel: "ملغاة",
};
function mapLeave(rec) {
  const from = rec.request_date_from || rec.date_from;
  const to = rec.request_date_to || rec.date_to;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "LV-" + String(rec.id).padStart(5, "0"), odooId: rec.id,
    type: rec.holiday_status_id?.[1] || "", from, to,
    days: rec.number_of_days,
    status: LEAVE_STATE_AR[rec.state] || rec.state,
    approver: rec.first_approver_id?.[1] || rec.second_approver_id?.[1] || "",
    // started: هل بدأت الإجازة فعلًا؟ كانت false دائمًا، فشاشة «قطع الإجازة
    // والعودة للعمل» ترفض كل إجازة برسالة «لم تبدأ بعد» — تعطيل كامل للخدمة.
    started: !!(from && from <= today),
    ongoing: !!(from && to && from <= today && to >= today),
  };
}

// ---- تعريف الـ actions ----
const actions = {
  // فحص الاتصال بأودو (يُستخدم في شاشة الإعدادات)
  async "connection.test"() {
    if (isTestMode()) return { ok: true, odooVersion: FX.FX_VERSION, mode: "test" };
    const r = await odoo.testConnection();
    return { ok: true, odooVersion: r.odooVersion, mode: "odoo" };
  },

  // بيانات الموظف الحالي (يُشتق من ربط المستخدم بموظف Odoo)
  //   ⚠️ الهوية لا تُزوَّر أبدًا: عند تعذّر القراءة من Odoo نرجع اسم صاحب الجلسة
  //   نفسه (المخزّن محليًا) لا موظفًا تجريبيًا باسم شخص آخر — إظهار اسم غريب
  //   على شاشة «حسابي» أسوأ بكثير من إظهار بيانات ناقصة.
  async "employee.me"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const u = ctx?.user || {};
    const fromSession = (reason) => ({
      id: empId ? "E" + empId : (u.login ? "U" + u.login : ""),
      odooId: empId || null,
      name: u.name || u.login || "",
      jobTitle: "", dept: "", branch: "", empNo: empId ? String(empId) : "",
      manager: "", email: u.email || "", phone: "", contract: "",
      company: "", leaveBalance: null,
      unavailable: true, reason,
    });
    if (isTestMode()) return { source: "test", data: FX.FX_EMPLOYEE };
    try {
      if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo (odooEmployeeId فارغ) — اعمل «مزامنة» للمستخدم من Odoo");
      const recs = await odoo.searchRead("hr.employee", [["id", "=", empId]], EMP_FIELDS, { limit: 1 });
      if (!recs.length) throw new Error(`لا يوجد موظف بالرقم ${empId} في قاعدة بيانات Odoo الحالية — تحقّق من ربط المستخدم`);
      return { source: "odoo", data: mapEmployee(recs[0]) };
    } catch (e) {
      return { source: "session-fallback", warning: e.message, data: fromSession(e.message) };
    }
  },

  // رصيد الإجازات (allocation - taken) — مبسّط: مجموع الأيام المتبقية من hr.leave.allocation
  async "leave.balance"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        // نداءان مستقلان → بالتوازي (كانا متتابعين فيتضاعف زمن الانتظار)
        const [allocs, taken] = await Promise.all([
          odoo.searchRead("hr.leave.allocation",
            [["employee_id", "=", empId], ["state", "=", "validate"]], ["number_of_days"]),
          odoo.searchRead("hr.leave",
            [["employee_id", "=", empId], ["state", "=", "validate"]], ["number_of_days"]),
        ]);
        const allocated = allocs.reduce((s, a) => s + (a.number_of_days || 0), 0);
        const used = taken.reduce((s, a) => s + (a.number_of_days || 0), 0);
        return { balance: Math.max(0, allocated - used) };
      },
      async () => ({ balance: FX.FX_LEAVE_BALANCE }),
      { emptyOnError: () => ({ balance: null, unavailable: true }) }
    );
  },

  // إجازات الموظف — كل الحالات أو المعتمدة فقط (onlyApproved)
  async "leave.list"(params, ctx) {
    const empId = toEmpId(params?.employeeId) || ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        const domain = [["employee_id", "=", empId]];
        if (params?.onlyApproved) domain.push(["state", "=", "validate"]);
        // أسماء حقول المعتمِد تختلف بين نسخ أودو (manager_id في 17 →
        // first_approver_id في 19). نطلب الموجود فعلًا فقط، فحقل واحد خاطئ
        // كان يُفشل القراءة كلها ويترك سجل الإجازات فارغًا بلا سبب ظاهر.
        const recs = await odoo.searchRead("hr.leave", domain,
          await availableFields("hr.leave", ["holiday_status_id", "request_date_from", "request_date_to",
            "number_of_days", "state", "first_approver_id", "second_approver_id"]),
          { order: "request_date_from desc" });
        return { records: recs.map(mapLeave) };
      },
      async () => ({ records: params?.onlyApproved ? FX.FX_LEAVES.filter((l) => l.status === "معتمدة") : FX.FX_LEAVES }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // هل الموظف في إجازة معتمدة اليوم؟ → { onLeave, type, from, to, daysLeft, returnOn }
  async "leave.current"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const today = new Date().toISOString().slice(0, 10);
    return withOdoo(
      async () => {
        if (!empId) return { onLeave: false };
        const recs = await odoo.searchRead("hr.leave",
          [["employee_id", "=", empId], ["state", "=", "validate"],
            ["request_date_from", "<=", today], ["request_date_to", ">=", today]],
          ["holiday_status_id", "request_date_from", "request_date_to", "number_of_days"],
          { limit: 1, order: "request_date_from desc" });
        if (!recs.length) return { onLeave: false };
        const r = recs[0];
        const to = r.request_date_to;
        const daysLeft = Math.max(0, Math.round((new Date(to) - new Date(today)) / 86400000));
        // أول يوم عمل بعد الإجازة
        const back = new Date(to);
        back.setDate(back.getDate() + 1);
        return {
          onLeave: true,
          type: r.holiday_status_id?.[1] || "إجازة",
          from: r.request_date_from, to,
          days: r.number_of_days, daysLeft,
          returnOn: back.toISOString().slice(0, 10),
        };
      },
      async () => ({ onLeave: false }),
      { emptyOnError: () => ({ onLeave: false, unavailable: true }) }
    );
  },

  // بيانات مستخدم التطبيق من Odoo (الدور والموظف المرتبط والحالة)
  //   Odoo هو مصدر الحقيقة للدور؛ users.json نسخة تُحدَّث عند «المزامنة» اليدوية
  //   فقط — فتغيير الدور في Odoo كان لا يصل الباك إند إطلاقًا حتى يضغط أحدهم زرًا.
  async "portalUser.get"(params) {
    const login = String(params?.login || "").trim();
    return withOdoo(
      async () => {
        if (!login) return null;
        const recs = await odoo.searchRead("sharqia.portal.user",
          [["login", "=ilike", login]], ["login", "name", "role", "status", "employee_id"], { limit: 1 });
        if (!recs.length) return null;
        const r = recs[0];
        return {
          login: r.login, name: r.name || "", role: r.role || "employee",
          status: r.status === "suspended" ? "suspended" : "active",
          odooEmployeeId: r.employee_id?.[0] || null,
        };
      },
      async () => null,
      { emptyOnError: () => null }
    );
  },

  // فريق المدير المباشر: hr.employee حيث parent_id = موظف صاحب الجلسة.
  //   شاشات المدير (لوحة المدير، فريق القسم، طلبات الفريق) كانت كلها تقرأ
  //   مصفوفة موظفين تجريبية مثبّتة في الحزمة — هذا يجعلها بيانات أودو الحقيقية.
  async "team.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const TEAM_FIELDS = EMP_FIELDS.filter((f) => f !== "image_128"); // الصور تُثقل الرد
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        const recs = await odoo.searchRead("hr.employee",
          [["parent_id", "=", empId]], TEAM_FIELDS, { limit: 200 });
        if (!recs.length) return { records: [] };
        const ids = recs.map((r) => r.id);
        const today = new Date().toISOString().slice(0, 10);
        const open = {};
        // المصادر الثلاثة بالتوازي، وكلٌّ يفشل وحده دون إسقاط شاشة الفريق
        const safe = (p) => p.catch(() => []);
        const [att, lv, rq] = await Promise.all([
          safe(odoo.searchRead("hr.attendance",
            [["employee_id", "in", ids], ["check_in", ">=", `${today} 00:00:00`]],
            ["employee_id"], { limit: 500 })),
          safe(odoo.searchRead("hr.leave",
            [["employee_id", "in", ids], ["state", "=", "validate"],
              ["request_date_from", "<=", today], ["request_date_to", ">=", today]],
            ["employee_id"], { limit: 500 })),
          safe(odoo.searchRead("sharqia.portal.request",
            [["employee_id", "in", ids], ["state", "not in", CLOSED_STATES]],
            ["employee_id"], { limit: 500 })),
        ]);
        const present = new Set(att.map((a) => a.employee_id?.[0]));
        const onLeave = new Set(lv.map((a) => a.employee_id?.[0]));
        for (const r of rq) { const k = r.employee_id?.[0]; if (k) open[k] = (open[k] || 0) + 1; }
        return {
          records: recs.map((r) => ({
            ...mapEmployee(r),
            att: onLeave.has(r.id) ? "on_leave" : present.has(r.id) ? "present" : "no_checkin",
            leave: onLeave.has(r.id) ? "في إجازة" : "-",
            openReq: open[r.id] || 0,
            shift: "",
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [] }) }
    );
  },

  // ---- العهد: من Open HRMS Custody (hr.custody) وإلا من موديل الأدون ----
  //   الشركة تستخدم hr_custody المثبّت فعلًا، فالعهد تُقرأ منه مباشرة ولا
  //   تُدخَل مرتين. sharqia.portal.custody يبقى احتياطًا لمن لا يملك الموديول.
  async "custody.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        const models = await modelFieldNames("hr.custody");
        if (models) {
          const recs = await odoo.searchRead("hr.custody",
            [["employee_id", "=", empId]],
            await availableFields("hr.custody", ["name", "custody_property_id", "date_request",
              "return_date", "renew_date", "purpose", "state", "notes"]),
            { order: "date_request desc", limit: 100 });
          return { records: recs.map(mapCustody), source: "hr.custody" };
        }
        const recs = await odoo.searchRead("sharqia.portal.custody",
          [["employee_id", "=", empId]], ["asset_name", "assigned_date", "state"], { limit: 100 });
        return {
          records: recs.map((r) => ({
            id: r.id, name: r.asset_name || "عهدة", serial: "",
            since: r.assigned_date || "", status: CUSTODY_STATE_AR[r.state] || r.state || "",
            maint: false,
          })),
          source: "sharqia.portal.custody",
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // أنواع الإجازات
  async "leaveType.list"() {
    return withOdoo(
      async () => ({ records: await odoo.searchRead("hr.leave.type", [], ["name"]) }),
      async () => ({ records: FX.FX_LEAVE_TYPES })
    );
  },

  // إنشاء إجازة في Odoo (يُستدعى عند اعتماد طلب إجازة — الكتابة حسّاسة)
  async "leave.create"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        const id = await odoo.create("hr.leave", {
          employee_id: empId,
          holiday_status_id: params.leaveTypeId,
          request_date_from: params.from,
          request_date_to: params.to,
          name: params.reason || "طلب إجازة عبر البوابة",
        });
        return { odooId: id };
      },
      async () => ({ odooId: Math.floor(Math.random() * 9000) + 1000 }),
      { forceLiveErrors: true }
    );
  },

  // سجل الحضور
  async "attendance.log"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        const recs = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId]], ["check_in", "check_out"], { limit: 30, order: "check_in desc" });
        return { records: recs };
      },
      async () => ({ records: FX.FX_ATTENDANCE }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // نطاقات الحضور المعتمدة (sharqia.portal.location)
  async "location.list"() {
    return withOdoo(
      async () => ({
        records: await odoo.searchRead("sharqia.portal.location", [["active", "=", true]],
          await availableFields("sharqia.portal.location",
            ["name", "latitude", "longitude", "radius_m", "max_accuracy_m"]),
          { limit: 100 }),
      }),
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [] }) }
    );
  },

  // مراقبة مواقع الحضور اليوم (لشاشة الموارد البشرية) — بيانات أودو لا عيّنات
  async "attendance.monitor"(params, ctx) {
    return withOdoo(
      async () => {
        const today = new Date().toISOString().slice(0, 10);
        const fields = await availableFields("hr.attendance",
          ["employee_id", "check_in", "check_out", "x_geo_lat", "x_geo_lng",
            "x_in_range", "x_accuracy_m", "x_distance_m", "x_location_id", "x_device"]);
        const recs = await odoo.searchRead("hr.attendance",
          [["check_in", ">=", `${today} 00:00:00`]], fields,
          { limit: 300, order: "check_in desc" });
        const hhmm = (v) => (v ? String(v).slice(11, 16) : "—");
        return {
          records: recs.map((r) => ({
            emp: r.employee_id?.[1] || "", empNo: String(r.employee_id?.[0] || ""),
            dept: "", branch: r.x_location_id?.[1] || "",
            in: hhmm(r.check_in), out: hhmm(r.check_out),
            lat: r.x_geo_lat || null, lng: r.x_geo_lng || null,
            accuracy: r.x_accuracy_m || 0, dist: r.x_distance_m || 0,
            radius: 0, within: !!r.x_in_range,
            method: "التطبيق", device: r.x_device || "",
            capturedAt: hhmm(r.check_in), suspicious: !r.x_in_range,
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [] }) }
    );
  },

  // تسجيل حضور/انصراف — مع فرض النطاق الجغرافي على الخادم
  //   ⚠️ كان يكتب employee_id + check_in فقط، بوقت يحدّده العميل وبلا أي
  //   إحداثيات ولا تحقق نطاق — أي بصمة قابلة للتزوير بطلب HTTP واحد من أي مكان.
  async "attendance.punch"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        const lat = Number(params.lat), lng = Number(params.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("تعذّر تحديد موقعك. فعّل خدمة الموقع وحاول مرة أخرى.");
        }
        if (params.mock === true) throw new Error("تم رصد موقع مزيّف — لا يمكن تسجيل الحضور.");

        // النطاقات من أودو (لا إحداثيات مثبّتة في التطبيق)
        const { data: locData } = await runAction("location.list", {}, ctx);
        const locs = locData.records || [];
        if (!locs.length) throw new Error("لم تُضبط أي نطاقات حضور في Odoo (الإعدادات ← نطاقات الحضور).");

        const near = nearestLocation(lat, lng, locs);
        if (!near) throw new Error("تعذّر مطابقة موقعك بأي نطاق عمل.");
        const maxAcc = near.location.max_accuracy_m || 50;
        const acc = Number(params.accuracy);
        if (Number.isFinite(acc) && acc > maxAcc) {
          throw new Error(`دقة الموقع ضعيفة (${Math.round(acc)}م). اخرج لمكان مكشوف وحاول مرة أخرى.`);
        }
        if (!near.within) {
          throw new Error(`أنت خارج نطاق «${near.location.name}» بمسافة ${near.distance} متر.`);
        }

        // وقت الخادم دائمًا — لا نثق بوقت الجهاز
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        const geo = {
          x_in_range: true, x_location_id: near.location.id,
          x_accuracy_m: Number.isFinite(acc) ? Math.round(acc) : 0,
          x_distance_m: near.distance,
          ...(params.device ? { x_device: String(params.device).slice(0, 80) } : {}),
        };
        const known = await modelFieldNames("hr.attendance");
        const only = (o) => (known ? Object.fromEntries(Object.entries(o).filter(([k]) => known.has(k))) : {});

        if (params.op === "in") {
          const openNow = await odoo.searchRead("hr.attendance",
            [["employee_id", "=", empId], ["check_out", "=", false]], ["id"], { limit: 1 });
          if (openNow.length) throw new Error("لديك حضور مفتوح بالفعل — سجّل الانصراف أولًا.");
          const id = await odoo.create("hr.attendance", {
            employee_id: empId, check_in: now,
            ...only({ ...geo, x_geo_lat: lat, x_geo_lng: lng }),
          });
          return { odooId: id, op: "in", at: now, location: near.location.name, distance: near.distance };
        }

        const open = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId], ["check_out", "=", false]], ["id"], { limit: 1, order: "check_in desc" });
        if (!open.length) throw new Error("لا يوجد سجل حضور مفتوح لتسجيل الانصراف.");
        await odoo.write("hr.attendance", open[0].id, {
          check_out: now, ...only({ ...geo, x_out_lat: lat, x_out_lng: lng }),
        });
        return { odooId: open[0].id, op: "out", at: now, location: near.location.name, distance: near.distance };
      },
      async () => ({ odooId: Math.floor(Math.random() * 9000) + 1000, op: params.op }),
      { forceLiveErrors: true }
    );
  },

  // إنشاء مصروف/سلفة في Odoo (hr.expense) — يُستدعى عند اعتماد طلب مالي
  async "expense.create"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        const id = await odoo.create("hr.expense", {
          name: params.title || "مصروف عبر البوابة",
          employee_id: empId,
          total_amount: Number(params.amount) || 0,
          // product_id قد يكون مطلوبًا حسب إعداد Odoo — يُضبط لصنف عام إن لزم
          ...(params.productId ? { product_id: params.productId } : {}),
        });
        return { odooId: id, model: "hr.expense" };
      },
      async () => ({ odooId: Math.floor(Math.random() * 9000) + 1000, model: "hr.expense" }),
      { forceLiveErrors: true }
    );
  },

  // إنشاء طلب موافقة عام (approval.request) — للطلبات البسيطة إن رغبت باستخدام تطبيق Approvals
  async "approval.create"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        // يتطلب وجود approval.category مناسبة؛ params.categoryId يحدّدها
        const id = await odoo.create("approval.request", {
          name: params.title || "طلب موافقة",
          category_id: params.categoryId,
          request_owner_id: ctx?.user?.odooUserId || false,
          reason: params.desc || "",
          ...(empId ? { employee_id: empId } : {}),
        });
        return { odooId: id, model: "approval.request" };
      },
      async () => ({ odooId: Math.floor(Math.random() * 9000) + 1000, model: "approval.request" }),
      { forceLiveErrors: true }
    );
  },

  // فحص توفّر تطبيق Approvals في نسخة Odoo لديك
  async "approval.available"() {
    return withOdoo(
      async () => {
        const m = await odoo.searchRead("ir.model", [["model", "=", "approval.request"]], ["id"], { limit: 1 });
        return { available: m.length > 0 };
      },
      async () => ({ available: false })
    );
  },

  // ---- محرّك الطلبات في Odoo (sharqia.portal.request) — Odoo مصدر الحقيقة ----
  async "request.create"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const details = collectDetails(params);            // كل ما أرسله التطبيق
    const detailVals = mapDetailFields(details);       // ما يُعيَّن منه على أعمدة
    return withOdoo(
      async () => {
        const vals = {
          employee_id: empId,
          category: params.category || "general",
          service: params.service,
          title: params.title || params.service,
          description: params.desc || params.description || "",
          priority: { "عادية": "0", "متوسطة": "1", "عاجلة": "2" }[params.priority] || "0",
          confidential: !!params.confidential,
          extra_json: JSON.stringify(details),         // التفاصيل كاملة دائمًا
          ...detailVals,
        };

        // أرسل فقط الحقول الموجودة فعلًا في الموديل (أدون قديم لا يُفشل الطلب)
        const known = await requestFieldNames();
        const dropped = [];
        let payload;
        if (known) {
          payload = {};
          for (const [k, v] of Object.entries(vals)) {
            if (known.has(k)) payload[k] = v;
            else dropped.push(k);
          }
        } else {
          payload = {};
          for (const [k, v] of Object.entries(vals)) {
            if (REQUEST_BASE_FIELDS.includes(k)) payload[k] = v;
            else dropped.push(k);
          }
        }
        // لو تعذّر تخزين التفاصيل في أعمدتها، ألحِقها بالوصف حتى تبقى مرئية
        if (dropped.length && Object.keys(details).length) {
          const summary = detailsSummary(details);
          if (summary) payload.description = `${payload.description || ""}\n\n— تفاصيل الطلب —\n${summary}`.trim();
        }

        const id = await odoo.create("sharqia.portal.request", payload);

        // ارفع المرفقات التي وصلت بمحتواها واربطها بالطلب
        const files = (params.attachments || []).filter((a) => a && (a.base64 || a.data));
        const attIds = [];
        for (const f of files) {
          try {
            attIds.push(await odoo.create("ir.attachment", {
              name: f.name || f.fileName || "مرفق",
              datas: f.base64 || f.data,
              res_model: "sharqia.portal.request",
              res_id: id,
            }));
          } catch (e) {
            // المرفق لا يُفشل الطلب — يُسجَّل فقط
            console.warn("تعذّر رفع مرفق للطلب", id, e.message);
          }
        }
        if (attIds.length && (!known || known.has("attachment_ids"))) {
          try { await odoo.write("sharqia.portal.request", id, { attachment_ids: [[6, 0, attIds]] }); }
          catch (e) { console.warn("تعذّر ربط المرفقات بالطلب", id, e.message); }
        }

        const recs = await odoo.searchRead("sharqia.portal.request", [["id", "=", id]],
          ["name", "state", "category", "service", "title"], { limit: 1 });
        return { odooId: id, ...recs[0] };
      },
      async () => ({ odooId: Math.floor(Math.random() * 9000) + 1000, name: "HR-REQ-DEMO", state: "submitted" }),
      { forceLiveErrors: true }
    );
  },

  async "request.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    // inbox = ما ينتظر إجراء صاحب الجلسة.
    //   المدير: مرؤوسوه المباشرون عبر hr.employee.parent_id (أودو يدعم المسار
    //   المنقّط في الـ domain، فلا حاجة لتخزين شجرة الإدارة في users.json).
    //   الموارد البشرية/المالية/التقنية: كل ما هو مفتوح — والواجهة تفلتر المرحلة.
    let domain;
    if (params?.scope === "all") domain = [];
    else if (params?.scope === "inbox") {
      if (role === "manager" && empId) {
        domain = [["employee_id.parent_id", "=", empId],
          ["employee_id", "!=", empId],              // لا اعتماد ذاتي
          ["state", "not in", CLOSED_STATES]];
      } else if (["hr", "finance", "it", "admin"].includes(role)) {
        domain = [["state", "not in", CLOSED_STATES]];
      } else {
        domain = [["id", "=", 0]];                   // لا صندوق وارد لهذا الدور
      }
    } else domain = [["employee_id", "=", empId]];
    return withOdoo(
      async () => {
        const fields = await requestReadFields();
        const recs = await odoo.searchRead("sharqia.portal.request", domain, fields,
          { order: "create_date desc", limit: 200 });
        // inbox=true تعلّم الطلب بأنه ينتظر إجراء صاحب الجلسة، فتعرضه شاشة
        // المدير حتى لو تعذّر تحميل قائمة الفريق.
        const inbox = params?.scope === "inbox";
        return { records: recs.map((r) => ({ ...mapRequestRecord(r), inbox })) };
      },
      async () => ({ records: [] })
    );
  },

  // قراءة طلب واحد بالتفاصيل — يقبل رقم Odoo أو رقم الطلب النصي (HR-REQ-000x)
  async "request.read"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const raw = String(params?.id ?? "");
    const numeric = /^\d+$/.test(raw) ? Number(raw) : null;
    return withOdoo(
      async () => {
        const domain = numeric ? [["id", "=", numeric]] : [["name", "=", raw]];
        // موظف عادي لا يقرأ طلب غيره
        if (params?.scope !== "all" && empId) domain.push(["employee_id", "=", empId]);
        const fields = await requestReadFields();
        const recs = await odoo.searchRead("sharqia.portal.request", domain, fields, { limit: 1 });
        if (!recs.length) return null;
        return mapRequestRecord(recs[0]);
      },
      async () => null
    );
  },

  // اعتماد/رفض من التطبيق: التحقق من الصلاحية يتم في الـ backend، ثم ينفّذ Odoo الانتقال
  async "request.approve"(params, ctx) {
    return withOdoo(
      async () => {
        await odoo.execKw("sharqia.portal.request", "action_approve", [[params.id]],
          { context: { portal_actor: ctx?.user?.name || "" } });
        return { ok: true };
      },
      async () => ({ ok: true }),
      { forceLiveErrors: true }
    );
  },
  async "request.reject"(params, ctx) {
    return withOdoo(
      async () => {
        await odoo.execKw("sharqia.portal.request", "action_reject", [[params.id]],
          { context: { portal_actor: ctx?.user?.name || "" } });
        return { ok: true };
      },
      async () => ({ ok: true }),
      { forceLiveErrors: true }
    );
  },

  // رفع مرفق إلى ir.attachment
  async "attachment.upload"(params) {
    return withOdoo(
      async () => {
        const id = await odoo.create("ir.attachment", {
          name: params.fileName, datas: params.base64,
          res_model: params.resModel || false, res_id: params.resId || false,
        });
        return { odooAttachmentId: id };
      },
      async () => ({ odooAttachmentId: Math.floor(Math.random() * 9999) }),
      { forceLiveErrors: true }
    );
  },

  // ---- التعاميم (sharqia.portal.announcement) — تُقرأ من Odoo ----
  async "announcement.list"(params, ctx) {
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("sharqia.portal.announcement", [],
          ["title", "body_html", "priority", "pinned", "publish_date", "require_ack"],
          { limit: 50, order: "pinned desc, publish_date desc" });
        return {
          records: recs.map((r) => ({
            id: r.id,
            title: r.title,
            body: (r.body_html || "").replace(/<[^>]*>/g, "").trim(),
            priority: r.priority === "important" ? "مهم" : "عادي",
            pinned: !!r.pinned,
            requireAck: !!r.require_ack,
            at: r.publish_date || null,
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },
};

export async function runAction(action, params = {}, ctx = {}) {
  const fn = actions[action];
  if (!fn) throw new Error(`إجراء غير معروف: ${action}`);
  return fn(params, ctx);
}

export const ACTION_NAMES = Object.keys(actions);
