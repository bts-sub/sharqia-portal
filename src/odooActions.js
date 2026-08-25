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

// حقول شاشة «ملفي الوظيفي» — أوسع من EMP_FIELDS التي تُقرأ لكل عضو فريق.
//   الأسماء مأخوذة من فحص hr.employee على أودو 19: رقم الموظف
//   registration_number لا حقل id، وتاريخ التعيين joining_date،
//   والجوال mobile_phone (كان يُقرأ work_phone وحده فيظهر فارغًا دائمًا
//   رغم وجود الرقم في أودو).
const EMP_ME_FIELDS = [...EMP_FIELDS, "job_id", "mobile_phone", "private_phone", "private_email",
  "registration_number", "barcode", "joining_date", "identification_id", "passport_id",
  "permit_no", "marital", "birthday", "primary_bank_account_id"];

// نوع التوظيف في أودو إنجليزي — يُعرض في التطبيق تحت «على رأس العمل»
const EMP_TYPE_AR = {
  employee: "موظف", worker: "عامل", student: "طالب",
  trainee: "متدرّب", contractor: "متعاقد", freelance: "مستقل",
};
const MARITAL_AR = {
  single: "أعزب/عزباء", married: "متزوج/متزوجة", cohabitant: "شريك قانوني",
  widower: "أرمل/أرملة", divorced: "مطلق/مطلقة",
};

// وقت إغلاق بصمة نُسيت مفتوحة: بداية الدوام + ساعات اليوم المعتادة من تقويم
// عمل الموظف. لا نُغلقها عند منتصف الليل (يوم بأربع عشرة ساعة) ولا عند وقت
// الحضور نفسه (يوم بصفر ساعات) — كلاهما رقم كاذب في تقارير الدوام.
async function autoCloseStamp(empId, checkIn) {
  let hours = 8;
  try {
    const emp = await odoo.searchRead("hr.employee", [["id", "=", empId]],
      await availableFields("hr.employee", ["resource_calendar_id"]), { limit: 1 });
    const calId = emp[0]?.resource_calendar_id?.[0];
    if (calId) {
      const cal = await odoo.searchRead("resource.calendar", [["id", "=", calId]],
        ["hours_per_day"], { limit: 1 });
      if (cal[0]?.hours_per_day > 0) hours = cal[0].hours_per_day;
    }
  } catch { /* التقويم اختياري — ثماني ساعات افتراض معقول */ }
  const start = new Date(String(checkIn).replace(" ", "T") + "Z");
  const end = new Date(start.getTime() + hours * 3600e3);
  // لا نتجاوز نهاية يوم الحضور نفسه
  const dayEnd = new Date(start.toISOString().slice(0, 10) + "T23:59:00Z");
  return (end > dayEnd ? dayEnd : end).toISOString().slice(0, 19).replace("T", " ");
}

// نوع الصورة يُستنتج من بايتاتها لا بالتخمين: أودو يخزّن ما رُفع كما هو
// (JPEG في الغالب)، ووسمُها png في الـ data URI وسمٌ كاذب يرفضه بعض العملاء.
function imgDataUri(b64) {
  if (!b64) return "";
  const head = String(b64).slice(0, 12);
  const mime = head.startsWith("/9j/") ? "jpeg"
    : head.startsWith("iVBORw0") ? "png"
    : head.startsWith("UklGR") ? "webp"
    : head.startsWith("R0lGOD") ? "gif"
    : "jpeg";
  return `data:image/${mime};base64,${b64}`;
}

// أنواع الخطابات وحالاتها → عربي (مطابقة لـ portal_letter.py في الأدون)
const LETTER_TYPE_AR = {
  salary_def: "تعريف بالراتب", emp_def: "تعريف موظف", experience: "شهادة خبرة",
  bank: "خطاب للبنك", embassy: "خطاب للسفارة", traffic: "خطاب للمرور",
  noc: "خطاب عدم ممانعة", custom: "خطاب مخصّص",
};
const LETTER_STATE_AR = {
  draft: "مسودة", submitted: "مُرسَل", hr: "لدى الموارد البشرية", done: "صادر",
};

// نصّ مقروء من HTML المحرّر: نزع الوسوم وحده يلصق الكلمات عبر الفقرات
// («...الدوام<p>اعتباراً» → «الدوامعتباراً»)، فنحوّل نهايات الكتل إلى مسافات.
function htmlToText(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// نص المستخدم يدخل جسم رسالة HTML في محادثة أودو — بلا تهريب يصير أي تعليق
// ثغرة حقن سكربت في واجهة أودو نفسها
const HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => HTML_ESC[c]);

// إخفاء جزئي للأرقام الحسّاسة (هوية/آيبان) — تُعرض في شاشة «مخفية جزئياً»
function maskTail(v, keep = 4) {
  const s = String(v ?? "").trim();
  if (!s || s === "false") return "";
  return s.length > keep ? "•••• " + s.slice(-keep) : s;
}

// أدوار مستخدم التطبيق — نفس قيم sharqia.portal.user.role في أودو ونفس
// تسمياتها العربية، فلا تعرض شاشة الأدوار أدوارًا لا وجود لها ولا تُسقط دورًا
// موجودًا (كانت تعرض تسع تسميات مخترعة وتُسقط «تقنية المعلومات» كليًّا).
export const PORTAL_ROLES = ["employee", "manager", "hr", "finance", "it", "admin"];
export const ROLE_LABEL_AR = {
  employee: "موظف", manager: "مدير قسم", hr: "موارد بشرية",
  finance: "مسؤول مالي", it: "تقنية المعلومات", admin: "مدير النظام",
};

// سجل sharqia.portal.user → الشكل الذي ترسمه شاشة «إدارة المستخدمين»
function mapPortalUser(r) {
  if (!r) return null;
  const suspended = r.status === "suspended";
  return {
    id: r.id,
    name: r.name || "",
    login: r.login || "",
    roleKey: r.role || "employee",
    role: ROLE_LABEL_AR[r.role] || r.role || "",
    status: suspended ? "موقوف" : "فعال",
    empNo: r.employee_id?.[0] ? String(r.employee_id[0]) : "",
    employeeName: r.employee_id?.[1] || "",
    odooEmployeeId: r.employee_id?.[0] || null,
    dept: r.department_id?.[1] || "",
    branch: "",
    lastLogin: r.last_login || "—",
    backendId: r.backend_id || "",
  };
}

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
  // المستفيد ليس تفصيلًا من تفاصيل الطلب بل هو صاحبه — يُعيَّن على employee_id
  "beneficiaryId", "beneficiaryName", "onBehalf",
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
  "priority", "confidential", "state", "current_stage", "create_date",
  // المرفقات ومقدّم الطلب: بدونهما لا يرى المدير ما أرفقه الموظف ولا يعرف
  // من قدّم الطلب حين يُقدَّم نيابةً عن غيره
  "attachment_ids", "requested_by",
  // مرجع السجل المُنشأ عند الاعتماد — به يعرف التطبيق أن نتيجة هذا الطلب
  // خطابٌ فيعرض زر تنزيله. بدونه لا يصل المرجع للواجهة إطلاقًا.
  "odoo_ref_model", "odoo_ref_id"];
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
// ---------------------------------------------------------------------------
// البلاغ السري: الهوية تُحجب عمّن يعتمده.
//   الغرض من البلاغ السري أن يُقال ما لا يُقال باسم — فإبقاء اسم المُبلِّغ
//   ظاهرًا لمن يستقبل البلاغ يُبطله من أصله. الهوية تبقى محفوظة في سجلّ أودو
//   لمن يملك صلاحيةَ السجلّ نفسِه عند حاجة تحقيق، ولا تخرج إلى التطبيق لأحد
//   سوى صاحبها. والحجب هنا — عند تشكيل الرد — لا في الواجهة: ما لا يُرسَل
//   لا يُكشف بفتح أدوات المتصفّح.
// ---------------------------------------------------------------------------
const CONFIDENTIAL_MASK = "بلاغ سري — الهوية محجوبة";
function maskConfidential(out, viewerEmpKey) {
  if (!out?.confidential) return out;
  if (viewerEmpKey && out.empId && out.empId === viewerEmpKey) return out;
  return {
    ...out,
    empId: "", empName: CONFIDENTIAL_MASK, employee_id: false,
    requestedBy: "", requested_by: "", beneficiaryName: "",
  };
}

function mapRequestRecord(rec) {
  let extra = {};
  try { extra = JSON.parse(rec.extra_json || "{}") || {}; } catch { extra = {}; }
  if (typeof extra !== "object" || Array.isArray(extra)) extra = {};
  const emp = Array.isArray(rec.employee_id) ? rec.employee_id : null;
  // attachment_ids تصل معرّفات فقط. نحوّلها لروابط تنزيل عبر الباك إند —
  // لا نُرسل محتوى الملفات في قائمة الطلبات (رد بعشرات الميغابايت لكل فتحة).
  const attachments = (Array.isArray(rec.attachment_ids) ? rec.attachment_ids : [])
    .map((id) => ({ id, name: `مرفق ${id}`, url: `/api/attachments/${id}` }));
  return {
    ...rec,
    empId: emp ? "E" + emp[0] : "",
    empName: emp ? emp[1] : "",
    requestedBy: rec.requested_by || "",
    attachments,
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
    // المسمّى قد يكون نصًّا حرًّا أو مرتبطًا بوظيفة hr.job — نقبل الاثنين
    jobTitle: rec.job_title || rec.job_id?.[1] || "",
    dept: rec.department_id?.[1] || "",
    branch: rec.work_location_id?.[1] || "",
    // الرقم الوظيفي الحقيقي إن وُجد، وإلا رقم السجل كملاذ أخير
    empNo: rec.registration_number || rec.barcode || String(rec.id),
    manager: rec.parent_id?.[1] || "",
    email: rec.work_email || rec.private_email || "",
    // الجوال أولًا: هو ما يملؤه الناس فعلًا، وwork_phone يبقى فارغًا غالبًا
    phone: rec.mobile_phone || rec.work_phone || rec.private_phone || "",
    contract: EMP_TYPE_AR[rec.employee_type] || rec.employee_type || "",
    company: rec.company_id?.[1] || "",
    hireDate: rec.joining_date || "",
    nationalIdMasked: maskTail(rec.identification_id),
    iban: maskTail(rec.primary_bank_account_id?.[1]),
    passport: maskTail(rec.passport_id),
    iqama: maskTail(rec.permit_no),
    marital: MARITAL_AR[rec.marital] || "",
    birthday: rec.birthday || "",
    // صورة الموظف من أودو كـ data URI جاهزة للعرض في <img> مباشرة
    photo: imgDataUri(rec.image_128),
    leaveBalance: rec.leaveBalance ?? null,
  };
}

// حالات الطلب المغلقة — لا تظهر في صندوق وارد أحد
const CLOSED_STATES = ["done", "rejected", "cancelled"];

// أبواب لائحة الجزاءات ومراحلها بالعربية
const DISC_CATEGORY_AR = {
  timing: "مواعيد العمل", organization: "تنظيم العمل", conduct: "سلوك العامل",
};
const DISC_STATE_AR = {
  draft: "مسودة", investigation: "قيد التحقيق", decided: "معتمَد",
  applied: "نُفِّذ", dismissed: "حُفظت بلا جزاء", cancelled: "ملغاة",
};
const DISC_FIELDS = ["name", "employee_id", "violation_id", "category",
  "occurred_on", "discovered_on", "occurrence", "penalty_label",
  "deduction_days", "state", "description", "employee_statement",
  "statement_taken", "investigation_notes", "decision_notes", "grievance",
  "decided_on", "applied_on", "reported_by_id"];

const nowOdooDate = () => new Date().toISOString().slice(0, 10);

/** جزاء بالشكل الذي يقرؤه التطبيق. */
function mapPenalty(rec) {
  return {
    id: rec.id, ref: rec.name || "",
    employeeName: rec.employee_id?.[1] || "",
    employeeId: rec.employee_id?.[0] || 0,
    violation: rec.violation_id?.[1] || "",
    category: DISC_CATEGORY_AR[rec.category] || rec.category || "",
    occurredOn: rec.occurred_on || "", discoveredOn: rec.discovered_on || "",
    occurrence: rec.occurrence || 1,
    penalty: rec.penalty_label || "", days: Number(rec.deduction_days || 0),
    state: rec.state || "draft",
    stateAr: DISC_STATE_AR[rec.state] || rec.state || "",
    description: rec.description || "",
    statement: rec.employee_statement || "",
    statementTaken: !!rec.statement_taken,
    investigation: rec.investigation_notes || "",
    decision: rec.decision_notes || "",
    grievance: rec.grievance || "",
    decidedOn: rec.decided_on || null, appliedOn: rec.applied_on || null,
    reportedBy: rec.reported_by_id?.[1] || "",
  };
}

// تصنيف الدورة يُخزَّن مفتاحًا ويُعرَض عربيًّا — والترجمة هنا لا في الواجهة
// حتى لا يتكرّر القاموس في موضعين ويفترقا.
const COURSE_CAT_AR = {
  orientation: "تعريفية", safety: "السلامة", skills: "مهارات",
  systems: "أنظمة وسياسات", service: "خدمة العملاء",
  technical: "تقنية", other: "أخرى",
};
const APPRAISAL_STATE_AR = {
  draft: "مسودة", submitted: "مُعتمَد", acknowledged: "اطّلعت عليه",
};

/** بطاقة تقييم بالشكل الذي يقرؤه التطبيق. */
function mapAppraisal(rec) {
  const pct = Number(rec.percent || 0);
  return {
    id: rec.id, ref: rec.name || "",
    employeeName: rec.employee_id?.[1] || "",
    employeeId: rec.employee_id?.[0] || 0,
    managerName: rec.manager_id?.[1] || "",
    period: rec.period === "weekly" ? "أسبوعي" : "شهري",
    periodKey: rec.period || "monthly",
    from: rec.date_from || "", to: rec.date_to || "",
    percent: Math.round(pct * 10) / 10,
    rating: rec.rating || "—",
    score: Number(rec.score || 0), maxScore: Number(rec.max_score || 0),
    rated: rec.rated_count || 0,
    state: rec.state || "draft",
    stateAr: APPRAISAL_STATE_AR[rec.state] || rec.state || "",
    strengths: rec.strengths || "", improvements: rec.improvements || "",
    managerNote: rec.manager_note || "", employeeNote: rec.employee_note || "",
    submittedAt: rec.submitted_at || null,
    acknowledgedAt: rec.acknowledged_at || null,
  };
}

// دمج نطاقين بـ «أو». نطاق أودو بادئيّ التدوين: قائمةُ n شرطًا تعني ضمنًا
// «و»، فلجمعها بـ «أو» يلزم إظهار الـ n-1 عاملَ «&» أولًا.
const andAll = (leaves) =>
  leaves.length <= 1 ? [...leaves] : [...Array(leaves.length - 1).fill("&"), ...leaves];
const orDomains = (a, b) => {
  if (!a?.length) return b?.length ? b : null;
  if (!b?.length) return a;
  return ["|", ...andAll(a), ...andAll(b)];
};

// مسارات الاعتماد — مطابقة لـ FLOW في الأدون (models/portal_request.py)
// وتُستخدم لفرض المرحلة على الخادم قبل تمرير الاعتماد إلى Odoo.
// خدمات تُصدر خطابًا رسميًّا — نفس قائمة الأدون بالضبط.
//   التصنيف وحده لا يكفي: «تعريف راتب» يعيش في «الطلبات المالية» في التطبيق
//   وهو شهادة راتب، فلو اعتُمد بلا توقيع خرجت الورقة بسطر توقيع فارغ.
const LETTER_SERVICE_TOKENS = ["تعريف بالراتب", "تعريف راتب", "تعريف موظف", "شهادة خبرة",
  "خطاب للبنك", "خطاب للسفارة", "خطاب للمرور", "عدم ممانعة"];
export function producesLetter(rec) {
  if (rec?.category === "letters") return true;
  const svc = String(rec?.service || "");
  return LETTER_SERVICE_TOKENS.some((t) => svc.includes(t));
}

export const FLOW = {
  leave: ["manager", "hr", "done"], attend: ["manager", "hr", "done"],
  finance: ["manager", "hr", "finance", "done"], custody: ["manager", "it", "done"],
  transfer: ["manager", "hr", "done"], personal: ["hr", "done"], letters: ["hr", "done"],
  training: ["manager", "hr", "done"], insurance: ["hr", "done"], complaint: ["hr", "done"],
  offboard: ["manager", "hr", "done"], general: ["manager", "hr", "done"],
};

// مسار خاص بخدمة بعينها — يتقدّم على مسار تصنيفها. مطابق لما في الموديول
// (models/portal_request.py) وفي محرّك الاختبار (lib/workflow.js): ثلاثة
// مواضع تصف المسار نفسه، فأي تعديل هنا يلزم أخويه.
export const SERVICE_FLOW = {
  "استئذان بالساعات": ["manager", "done"],
  "ترقية": ["manager", "done"],
  "مستحقات نهاية الخدمة": ["manager", "hr", "finance", "employee", "hr", "done"],
  "مخالصة": ["manager", "hr", "finance", "employee", "hr", "done"],
};

// خدماتٌ يوقّعها العامل بيده عند مرحلته، لا يكتفى منه بضغطة إقرار.
// المخالصة إبراءُ ذمّة: توقيعُها هو ما يُحتجّ به، وضغطةٌ في تطبيق ليست توقيعًا.
export const SIGN_ON_EMPLOYEE_STAGE = new Set(["مخالصة", "مستحقات نهاية الخدمة"]);

/** مسار الطلب: الخدمة أولًا ثم التصنيف — الأخصّ يغلب الأعمّ. */
export const flowFor = (category, service) =>
  SERVICE_FLOW[String(service || "").trim()] || FLOW[category] || FLOW.general;

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

// حالات طلب السلفة في Advanced Loan Management → نص عربي
const LOAN_STATE_AR = {
  draft: "مسودة", confirmed: "مؤكّدة", waiting: "بانتظار الاعتماد",
  approved: "معتمدة", disbursed: "مصروفة", rejected: "مرفوضة", closed: "مسدّدة",
};
function mapLoan(rec) {
  return {
    id: rec.name || String(rec.id), odooId: rec.id,
    type: rec.loan_type_id?.[1] || "سلفة",
    amount: rec.loan_amount || 0, months: rec.tenure || 0,
    interest: rec.interest_rate || 0, date: rec.date || "",
    status: LOAN_STATE_AR[rec.state] || rec.state || "",
  };
}

// ---------------------------------------------------------------------------
// سجل الحضور → شكل الشاشة.
//   أودو يخزّن check_in/check_out بتوقيت UTC، والموظف يقرأ ساعة الحائط عنده.
//   بلا تحويل تظهر بصمة التاسعة صباحًا سادسةً — والشاشة تقرأ in/out/status.
// ---------------------------------------------------------------------------
const WORK_TZ = process.env.PORTAL_TZ || "Asia/Riyadh";
const tzFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: WORK_TZ, hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
function localParts(utc) {
  if (!utc) return null;
  // "2026-08-17 10:05:50" من أودو = UTC، وJS يحتاج صيغة ISO ليقرأها كذلك
  const d = new Date(String(utc).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(tzFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}` };
}

// تاريخ اليوم بتوقيت العمل لا بتوقيت UTC — الفارق ثلاث ساعات، وبه تُنسب
// بصمةُ أول الليل إلى اليوم السابق.
function todayLocal() {
  const p = Object.fromEntries(tzFmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// حدّ التأخير: بعده تُعدّ البصمة متأخرة (ساعة الحائط في مقر العمل)
const LATE_AFTER = "08:15";
const SHIFT_END = "16:00";
const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };

function mapAttendance(rec) {
  const i = localParts(rec.check_in);
  const o = localParts(rec.check_out);
  let status = "منتظم";
  if (!o) status = "لم يسجل انصراف";
  else if (i && toMin(i.hhmm) > toMin(LATE_AFTER)) status = "تأخّر";
  return {
    id: rec.id,
    date: i?.date || "",
    in: i?.hhmm || "—",
    out: o?.hhmm || "—",
    hours: typeof rec.worked_hours === "number" ? Math.round(rec.worked_hours * 100) / 100 : null,
    status,
    manual: !!rec.x_manual,
    branch: rec.x_location_id?.[1] || "",
    within: !!rec.x_in_range,
    accuracy: rec.x_accuracy_m || 0,
    dist: rec.x_distance_m || 0,
    // الشاشة تحسب التأخير من 08:00 والخروج المبكّر من 16:00 — نمرّرهما معًا
    shiftStart: "08:00", shiftEnd: SHIFT_END,
  };
}

// حالة الإجازة في Odoo → نص عربي متوافق مع الواجهة
// «في انتظار المدير» كانت تُقال لكل حالة confirm، وهي في أودو تعني
// «بانتظار الاعتماد» أيًّا كان المعتمِد — قد يكون الموارد البشرية لا المدير.
const LEAVE_STATE_AR = {
  draft: "مسودة", confirm: "بانتظار الاعتماد", validate1: "بانتظار الموارد البشرية",
  validate: "معتمدة", refuse: "مرفوضة", cancel: "ملغاة",
};
// الحالات الثلاث التي تعني «لم يُبتّ فيها بعد» — الواجهة تعدّها في «قيد الانتظار»
const LEAVE_PENDING = ["draft", "confirm", "validate1"];
// طلبات الإجازة التي لم تكتمل موافقتها بعد — تُعرض في «سجل إجازاتي» بصفة
// «قيد الاعتماد» حتى لا يختفي طلبُ الموظف من سجله بين إرساله واعتماده.
async function pendingLeaveRequests(empId) {
  if (!empId) return [];
  const recs = await odoo.searchRead("sharqia.portal.request",
    [["employee_id", "=", empId], ["category", "=", "leave"],
      ["state", "not in", CLOSED_STATES]],
    await availableFields("sharqia.portal.request",
      ["name", "service", "sub_type", "date_from", "date_to", "days",
        "create_date", "current_stage", "description", "odoo_ref_id"]),
    { limit: 100, order: "create_date desc" });
  return recs
    // ما صار له سجل إجازة فعليّ يُقرأ من hr.leave لا من هنا (وإلا ظهر مرتين)
    .filter((r) => !r.odoo_ref_id)
    .map((r) => {
      const from = r.date_from || "";
      const to = r.date_to || from;
      const today = new Date().toISOString().slice(0, 10);
      return {
        id: r.name, odooId: null, requestId: r.name,
        type: r.sub_type || r.service || "إجازة",
        from, to,
        days: r.days || (from && to ? Math.round((new Date(to) - new Date(from)) / 864e5) + 1 : 0),
        status: r.current_stage ? `قيد الاعتماد · ${r.current_stage}` : "قيد الاعتماد",
        approver: "", started: !!(from && from <= today),
        ongoing: !!(from && to && from <= today && to >= today),
        submitted: (r.create_date || "").slice(0, 10) || from,
        reason: "", note: r.description || "",
        pending: true, closed: false, approved: false,
        fromRequest: true,          // الواجهة تفتح تفاصيل الطلب لا الإجازة
        lastActor: "", balanceAfter: null,
      };
    });
}

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
    // شاشة سجل الإجازات تقرأ هذه الأربعة. غياب submitted كان يجعلها تنادي
    // Gt(undefined).split("-") فيسقط التطبيق كله إلى «حدث خطأ مؤقت».
    submitted: (rec.create_date || "").slice(0, 10) || from || "",
    // ⚠️ reason تعرضه الشاشة تحت عنوان «سبب الرفض» بخلفية حمراء، وكان يحمل
    // وصف الإجازة — فتقرأ «سبب الرفض: طلب إجازة اضطرارية»، وهو عنوان الطلب
    // لا سببَ رفضه. السبب الحقيقي في أودو حقلٌ اسمه notes («Reasons»)،
    // ولا يُملأ إلا حين يكتبه من رفض أو ألغى.
    reason: ["refuse", "cancel"].includes(rec.state) ? String(rec.notes || "").trim() : "",
    note: rec.private_name || rec.name || "",
    // decided/pending: الشاشة كانت تستنتج الحالة من النص العربي، فيكفي
    // تغيير كلمة ليختلّ العدّ. الحقل صريح ولا يعتمد على صياغة.
    pending: LEAVE_PENDING.includes(rec.state),
    closed: ["refuse", "cancel"].includes(rec.state),
    approved: rec.state === "validate",
    lastActor: rec.first_approver_id?.[1] || rec.second_approver_id?.[1] || "",
    balanceAfter: null,
  };
}

// ---------------------------------------------------------------------------
// مرحلة «المدير المباشر» بلا صاحب.
//   موظفٌ بلا مدير في أودو، أو مديرُه هو نفسه، أو مديره بلا حساب فعّال في
//   التطبيق بدورٍ يعتمد — في كلٍّ منها لا أحد يستطيع اعتماد هذه المرحلة أبدًا:
//   صاحب الطلب لا يعتمد لنفسه، والموارد البشرية تُمنع لأن المرحلة ليست
//   مرحلتها. فيعلق الطلب في «بانتظار المدير المباشر» إلى الأبد.
// ---------------------------------------------------------------------------
const APPROVING_ROLES = ["manager", "hr", "finance", "it", "admin"];

async function managerVacancy(empIds) {
  const ids = [...new Set(empIds.filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  const emps = await odoo.searchRead("hr.employee", [["id", "in", ids]], ["parent_id"], { limit: 500 });
  const bossOf = new Map(emps.map((e) => [e.id, e.parent_id?.[0] || null]));
  const bosses = [...new Set([...bossOf.values()].filter(Boolean))];
  const able = new Set();
  if (bosses.length) {
    const accts = await odoo.searchRead("sharqia.portal.user",
      [["employee_id", "in", bosses], ["status", "=", "active"]],
      ["employee_id", "role"], { limit: 500 });
    for (const a of accts)
      if (APPROVING_ROLES.includes(a.role)) able.add(a.employee_id?.[0]);
  }
  for (const id of ids) {
    const boss = bossOf.get(id);
    out.set(id, !boss || boss === id || !able.has(boss));
  }
  return out;
}

// مرحلةٌ لا يحمل دورَها أحدٌ فعّال في التطبيق (مالية أو تقنية معلومات بلا
// مستخدم) تحبس الطلب كما تحبسه مرحلة المدير الشاغرة. الموارد البشرية
// والإدارة يفكّان الاحتباس، وهما البديل تنظيميًّا.
export async function stageRoleIsVacant(role) {
  if (!["finance", "it", "hr"].includes(role)) return false;
  try {
    const users = await odoo.searchRead("sharqia.portal.user",
      [["role", "=", role], ["status", "=", "active"]], ["id"], { limit: 1 });
    return users.length === 0;
  } catch (e) {
    console.warn("⚠️ تعذّر فحص مستخدمي المرحلة:", e.message);
    return false;
  }
}

export async function managerStageIsVacant(empId) {
  const id = toEmpId(empId);
  if (!id) return true;
  try {
    return (await managerVacancy([id])).get(id) !== false;
  } catch (e) {
    // تعذّرت القراءة: لا نفتح الاعتماد على مصراعيه بناءً على مجهول
    console.warn("⚠️ تعذّر فحص وجود مدير مباشر:", e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// إجازةٌ فوق إجازة: يُمنع الطلب قبل إنشائه لا بعد اعتماده.
//   أودو يرفض إجازةً تتداخل مع أخرى قائمة، لكن الرفض كان يقع متأخرًا — عند
//   الاعتماد — فيمرّ الطلب في المسار كله ثم تفشل المزامنة، ويبقى في أودو
//   سجلٌّ بمدة صفر لا يُعتمد أبدًا ولا يفهم الموظف سببه.
// ---------------------------------------------------------------------------
const LEAVE_BLOCKING = ["draft", "confirm", "validate1", "validate"];

async function assertNoLeaveOverlap(params, empId) {
  if (String(params?.category || "") !== "leave" || !empId) return;
  // خدمة «تعديل إجازة معتمدة» تُغيّر إجازةً قائمة، فتداخلها معها متوقَّع
  if (/تعديل\s*إجازة/.test(String(params?.service || ""))) return;
  const ex = params?.extra || {};
  const from = String(params?.from || ex.from || "").slice(0, 10);
  const to = String(params?.to || ex.to || from).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;

  const clash = await odoo.searchRead("hr.leave",
    [["employee_id", "=", empId], ["state", "in", LEAVE_BLOCKING],
      ["request_date_from", "<=", to], ["request_date_to", ">=", from]],
    ["holiday_status_id", "request_date_from", "request_date_to", "state"], { limit: 1 });
  if (!clash.length) return;
  const c = clash[0];
  const how = c.state === "validate" ? "معتمدة" : "قيد الانتظار";
  throw new Error(
    `لديك ${c.holiday_status_id?.[1] || "إجازة"} ${how} من ${c.request_date_from} إلى ${c.request_date_to} ` +
    "تتداخل مع هذه الفترة. اختر تواريخ أخرى، أو عدّل الإجازة القائمة من «تعديل إجازة معتمدة».");
}

// صاحب الطلب الفعلي: الموظف المستفيد لا مَن ضغط الزر.
//   المدير يقدّم نيابةً عن مرؤوسيه المباشرين فقط، والموارد البشرية/الأدمن عن
//   أي موظف. الصلاحية تُفحص هنا على الخادم لأن الواجهة قابلة للتزوير.
async function resolveBeneficiary(params, ctx) {
  const me = ctx?.user?.odooEmployeeId;
  // onBehalf هو إعلان الواجهة الصريح «هذا الطلب لغيري». بدونه لا يُنظر في
  // beneficiaryId إطلاقًا: شاشات الطلب ترسله دائمًا، وقد يحمل معرّفًا لا
  // يطابق الجلسة (كان يحمل ثابتًا تجريبيًّا للمدير)، فيُرفض طلب الموظف
  // لنفسه برسالة «ليس ضمن فريقك» — وهو يطلب لنفسه.
  if (!params?.onBehalf) return me;
  const want = toEmpId(params?.beneficiaryId);
  if (!want || want === me) return me;

  const role = ctx?.user?.role || "employee";
  if (["hr", "admin"].includes(role)) {
    const ok = await odoo.searchRead("hr.employee", [["id", "=", want]], ["name"], { limit: 1 });
    if (!ok.length) throw new Error(`لا يوجد موظف بالرقم ${want} في أودو`);
    return want;
  }
  if (role === "manager") {
    const sub = await odoo.searchRead("hr.employee",
      [["id", "=", want], ["parent_id", "=", me]], ["name"], { limit: 1 });
    if (!sub.length) throw new Error("لا يمكنك تقديم طلب نيابةً عن موظف ليس ضمن فريقك المباشر.");
    return want;
  }
  throw new Error("لا تملك صلاحية تقديم طلب نيابةً عن موظف آخر.");
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
      // availableFields: حقل واحد غير موجود في نسخة أودو الحالية كان يُفشل
      // قراءة بطاقة الموظف كلها فتظهر الشاشة فارغة بلا سبب ظاهر
      const recs = await odoo.searchRead("hr.employee", [["id", "=", empId]],
        await availableFields("hr.employee", EMP_ME_FIELDS), { limit: 1 });
      if (!recs.length) throw new Error(`لا يوجد موظف بالرقم ${empId} في قاعدة بيانات Odoo الحالية — تحقّق من ربط المستخدم`);
      return { source: "odoo", data: mapEmployee(recs[0]) };
    } catch (e) {
      return { source: "session-fallback", warning: e.message, data: fromSession(e.message) };
    }
  },

  // تسجيل قراءة التعميم في Odoo (sharqia.portal.announcement.ack)
  //   بدونه يبقى «عدد القراءات» صفرًا مهما فتحه الموظفون: لم يكن أحد
  //   ينشئ سجل قراءة إطلاقًا — لا التطبيق ولا الباك إند.
  async "announcement.markRead"(params, ctx) {
    const login = ctx?.user?.login;
    const id = toEmpId(params?.id);
    if (!login || !id) throw new Error("بيانات ناقصة لتسجيل القراءة");
    return withOdoo(
      async () => {
        const ack = await odoo.execKw("sharqia.portal.announcement", "mark_read", [], {
          login, announcement_id: id, acknowledged: !!params?.ack,
        });
        return { ok: true, ack: ack || null };
      },
      async () => ({ ok: true, ack: null }),
      { emptyOnError: () => ({ ok: false, ack: null }) }
    );
  },

  // تعليم الإشعار مقروءًا في Odoo — يعرف مُرسِل التعميم من قرأه ومتى
  async "notification.markRead"(params, ctx) {
    const login = ctx?.user?.login;
    if (!login) throw new Error("جلسة بلا اسم دخول");
    return withOdoo(
      async () => {
        const id = await odoo.execKw("sharqia.portal.notification", "mark_read", [], {
          login,
          title: String(params?.title || "") || null,
          request_name: String(params?.reqId || "") || null,
        });
        return { ok: true, matched: id || null };
      },
      async () => ({ ok: true, matched: null }),
      { emptyOnError: () => ({ ok: false, matched: null }) }
    );
  },

  // تعليق الموظف على طلبه → محادثة الطلب في Odoo (mail.message)
  //   كان زر «إرسال» في التطبيق يضيف التعليق لحالة المتصفح فقط بلا أي نداء
  //   شبكة، فلا يراه أحد في أودو ولا يصل متابعي الطلب إطلاقًا.
  async "request.comment"(params, ctx) {
    const id = toEmpId(params?.id);
    const text = String(params?.text || "").trim();
    if (!id) throw new Error("معرّف الطلب مطلوب");
    if (!text) throw new Error("نص التعليق مطلوب");
    if (text.length > 4000) throw new Error("التعليق طويل — الحد 4000 حرف");
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        // الطلب يجب أن يكون للموظف نفسه أو ضمن ما يحق له الاطلاع عليه؛
        // بدون هذا يعلّق أي موظف على طلب أي زميل بمجرد تخمين الرقم.
        const rec = (await odoo.searchRead("sharqia.portal.request",
          [["id", "=", id]], ["employee_id", "name", "state"], { limit: 1 }))[0];
        if (!rec) throw new Error("الطلب غير موجود في أودو");
        const owner = rec.employee_id?.[0] || null;
        const privileged = ["manager", "hr", "finance", "it", "admin"].includes(ctx?.user?.role);
        if (!privileged && owner !== empId)
          throw new Error("لا تملك صلاحية التعليق على هذا الطلب");

        const author = ctx?.user?.name || ctx?.user?.login || "موظف";
        // post_app_comment في الأدون يبني الجسم كـ Markup. لا نرسل HTML من هنا:
        // message_post يهرّب أي body نصيًّا، وJSON-RPC لا يمرّر Markup — فتظهر
        // الوسوم خامًّا في المحادثة («&lt;p&gt;&lt;b&gt;…»).
        let msgId;
        try {
          msgId = await odoo.execKw("sharqia.portal.request", "post_app_comment",
            [[id], author, text]);
        } catch (e) {
          // أدون أقدم من 19.0.1.11.0 — نصٌّ صِرف أسلم من HTML مهرَّب
          if (!/post_app_comment/i.test(e.message || "")) throw e;
          msgId = await odoo.execKw("sharqia.portal.request", "message_post", [[id]], {
            body: `${author} (عبر التطبيق):\n${text}`,
            message_type: "comment",
            subtype_xmlid: "mail.mt_comment",
          });
        }
        return { ok: true, messageId: msgId, request: rec.name };
      },
      async () => { throw new Error("التعليق غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // تغيير صورة الموظف من التطبيق — لم تكن هناك أي طريقة لتغييرها إطلاقًا
  //   image_1920 هو الحقل القابل للكتابة؛ بقية المقاسات محسوبة منه في أودو.
  async "employee.photo"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
    const raw = String(params?.image || "");
    const m = raw.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
    if (!m) throw new Error("الملف ليس صورة صالحة (المسموح: PNG أو JPG أو WEBP)");
    const b64 = m[2];
    // 4 ميجابايت بعد فك الترميز — base64 يتمدّد ~4/3
    if (b64.length > 4 * 1024 * 1024 * 1.37)
      throw new Error("حجم الصورة كبير — الحد الأقصى 4 ميجابايت");
    return withOdoo(
      async () => {
        await odoo.write("hr.employee", [empId], { image_1920: b64 });
        // أعد قراءة المصغّرة التي ولّدها أودو لتُعرض فورًا بلا إعادة تحميل
        const recs = await odoo.searchRead("hr.employee", [["id", "=", empId]],
          ["image_128"], { limit: 1 });
        const img = recs[0]?.image_128;
        return { ok: true, photo: imgDataUri(img) };
      },
      async () => { throw new Error("تغيير الصورة غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // رصيد الإجازات (allocation - taken) — مبسّط: مجموع الأيام المتبقية من hr.leave.allocation
  async "leave.balance"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        // المصدر الأول: حساب أودو نفسه — وهو ما يظهر في زر «Time Off» على
        // بطاقة الموظف (20/30). أودو يخصم من الرصيد أنواعَ الإجازات ذات
        // المخصَّص وحدها، فالإجازة الاضطرارية أو بدون راتب لا تنقص السنوية.
        // قراءته مباشرةً تُغني عن إعادة الحساب وتضمن رقمًا واحدًا في النظامين.
        const empFields = await availableFields("hr.employee",
          ["allocation_display", "allocation_remaining_display", "allocation_count"]);
        if (empFields.includes("allocation_remaining_display")) {
          const e = (await odoo.searchRead("hr.employee", [["id", "=", empId]], empFields, { limit: 1 }))[0];
          const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? n : null; };
          const remaining = num(e?.allocation_remaining_display);
          const total = num(e?.allocation_display) ?? num(e?.allocation_count);
          if (remaining !== null && total !== null) {
            // المستهلك = المعتمد وحده، والمحجوز = المعلّق. أودو يطرحهما معًا
            // من المتبقّي، وفصلُهما هنا يجعل شاشة الرصيد تشرح الرقم لا تناقضه.
            let used = 0, pending = 0;
            try {
              const ls = await odoo.searchRead("hr.leave",
                [["employee_id", "=", empId], ["state", "in", ["validate", ...LEAVE_PENDING]],
                  ["holiday_status_id.requires_allocation", "=", true]],
                ["number_of_days", "state"], { limit: 300 });
              for (const l of ls) {
                if (l.state === "validate") used += l.number_of_days || 0;
                else pending += l.number_of_days || 0;
              }
            } catch (e2) { used = Math.max(0, total - remaining); }
            return { balance: remaining, allocated: total, used, pending, source: "odoo-employee" };
          }
        }

        // نداءان مستقلان → بالتوازي (كانا متتابعين فيتضاعف زمن الانتظار)
        const [allocs, taken] = await Promise.all([
          odoo.searchRead("hr.leave.allocation",
            [["employee_id", "=", empId], ["state", "=", "validate"]],
            ["number_of_days", "holiday_status_id"]),
          odoo.searchRead("hr.leave",
            [["employee_id", "=", empId], ["state", "=", "validate"]],
            ["number_of_days", "holiday_status_id"]),
        ]);
        // ⚠️ كان يطرح مجموع كل الإجازات من مجموع كل المخصَّصات بلا نظرٍ للنوع،
        // فإجازةٌ بدون راتب (نوعٌ بلا رصيد مخصَّص أصلًا) تُنقص الرصيد السنوي.
        // الرصيد يُحسب لكل نوع على حدة، ولا يُخصم من نوعٍ إلا ما أُخذ منه.
        const byType = new Map();
        const slot = (r) => {
          const id = r.holiday_status_id?.[0] || 0;
          if (!byType.has(id))
            byType.set(id, { id, name: r.holiday_status_id?.[1] || "غير محدّد", allocated: 0, used: 0 });
          return byType.get(id);
        };
        for (const a of allocs) slot(a).allocated += a.number_of_days || 0;
        for (const t of taken) slot(t).used += t.number_of_days || 0;

        let balance = 0, allocated = 0, used = 0, usedUnallocated = 0;
        for (const t of byType.values()) {
          allocated += t.allocated;
          if (t.allocated > 0) {
            balance += Math.max(0, t.allocated - t.used);
            used += t.used;
          } else {
            // نوعٌ بلا رصيد مخصَّص: أيامه تُحصى وتُعرض، ولا تُخصم من غيره
            usedUnallocated += t.used;
          }
        }
        // allocated/used يُعرضان في «ملفي الوظيفي» — كانا رقمين ثابتين في الواجهة
        return { balance, allocated, used, usedUnallocated };
      },
      async () => ({ balance: FX.FX_LEAVE_BALANCE }),
      { emptyOnError: () => ({ balance: null, allocated: null, used: null, unavailable: true }) }
    );
  },

  // رصيد كل نوع إجازة على حدة — شاشة «رصيد الإجازات»
  //   كانت الشاشة تعرض ثلاثة أنواع بأرقام مكتوبة في الحزمة (21/9، 30/3، 5/1)
  //   لا علاقة لها بأودو ولا تتغيّر بين موظف وآخر.
  async "leave.balanceByType"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        // ⚠️ كانت تقرأ الإجازات المعتمدة وحدها، فتقول «25 متبقٍ» بينما زر
        // Time Off في أودو يقول 13: أودو يخصم المعتمدة **والمعلّقة** معًا،
        // لأن أيامًا حُجزت بطلبٍ لم يُبتّ فيه ليست متاحة للحجز مرة أخرى.
        // الشاشتان كانتا تقولان رقمين مختلفين للشيء نفسه.
        const [allocs, leaves] = await Promise.all([
          odoo.searchRead("hr.leave.allocation",
            [["employee_id", "=", empId], ["state", "=", "validate"]],
            ["holiday_status_id", "number_of_days"]),
          odoo.searchRead("hr.leave",
            [["employee_id", "=", empId], ["state", "in", ["validate", ...LEAVE_PENDING]]],
            ["holiday_status_id", "number_of_days", "state"], { limit: 300 }),
        ]);
        const by = new Map();
        const slot = (r) => {
          const id = r.holiday_status_id?.[0] || 0;
          if (!by.has(id))
            by.set(id, { id, name: r.holiday_status_id?.[1] || "غير محدّد", allocated: 0, used: 0, pending: 0 });
          return by.get(id);
        };
        for (const a of allocs) slot(a).allocated += a.number_of_days || 0;
        for (const t of leaves) {
          const s = slot(t);
          if (t.state === "validate") s.used += t.number_of_days || 0;
          else s.pending += t.number_of_days || 0;
        }
        // نوعٌ أُرشِف في أودو (سُحب من الخدمة) يبقى مذكورًا في إجازات قديمة،
        // فيظلّ له سطر في شاشة الرصيد إلى الأبد. الشاشة تعرض ما هو معمولٌ به،
        // والسجل التاريخي يبقى في «سجل إجازاتي».
        let retired = new Set();
        try {
          const ids = [...by.keys()].filter(Boolean);
          if (ids.length) {
            const types = await odoo.searchRead("hr.leave.type",
              [["id", "in", ids]], ["active"], { context: { active_test: false } });
            retired = new Set(types.filter((t) => t.active === false).map((t) => t.id));
          }
        } catch (e) { console.warn("⚠️ تعذّر فحص أنواع الإجازات المؤرشفة:", e.message); }

        const records = [...by.values()].filter((x) => !retired.has(x.id)).map((x) => ({
          ...x,
          // النوع بلا رصيد مخصّص ليس رصيده صفرًا بل «بلا سقف» — وهو حال
          // كل الأنواع التي ينشئها الأدون (requires_allocation=False)
          unlimited: x.allocated <= 0,
          remaining: x.allocated > 0 ? Math.max(0, x.allocated - x.used - x.pending) : null,
        })).sort((a, b) => b.allocated - a.allocated);
        return { records };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
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
            "number_of_days", "state", "first_approver_id", "second_approver_id",
            // شاشة «سجل إجازاتي» تعرض تاريخ التقديم والسبب — وغيابهما كان
            // يُسقط التطبيق كله لا الشاشة وحدها (Gt(undefined).split)
            // notes هو حقل «Reasons» في أودو: سبب الرفض أو الإلغاء الحقيقي
            "create_date", "name", "private_name", "notes"]),
          { order: "request_date_from desc" });
        const out = recs.map(mapLeave);

        // طلبُ إجازةٍ ما زال في مسار الاعتماد لا يوجد له hr.leave بعدُ —
        // الأدون لا ينشئها إلا عند اكتمال الاعتماد. فكان الموظف يرسل طلبه
        // ثم لا يجد له أثرًا في «سجل إجازاتي»، و«قيد الانتظار» صفرٌ عنده.
        if (!params?.onlyApproved) {
          try { out.push(...await pendingLeaveRequests(empId)); }
          catch (e) { console.warn("⚠️ تعذّرت قراءة طلبات الإجازة المعلّقة:", e.message); }
        }
        return { records: out };
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

  // قائمة مستخدمي التطبيق كما هي في أودو (شاشة «إدارة المستخدمين»).
  //   كانت الشاشة تعرض أربعة مستخدمين وهميين مثبّتين في حزمة الواجهة، وإضافة
  //   مستخدم فيها لا تغادر ذاكرة المتصفح — تختفي مع أول تحديث للصفحة.
  async "portalUser.list"() {
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("sharqia.portal.user", [],
          ["name", "login", "role", "status", "employee_id", "department_id",
           "last_login", "backend_id"],
          { limit: 500, order: "name asc" });
        return { records: recs.map(mapPortalUser) };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [] }) }
    );
  },

  // إنشاء مستخدم تطبيق في أودو — أودو مصدر الحقيقة للدور والحالة
  async "portalUser.create"(params) {
    const login = String(params?.login || "").trim();
    const name = String(params?.name || "").trim();
    if (!login || !name) throw new Error("الاسم واسم الدخول مطلوبان");
    if (!PORTAL_ROLES.includes(params?.role)) throw new Error(`دور غير معروف: ${params?.role}`);
    return withOdoo(
      async () => {
        const dup = await odoo.searchRead("sharqia.portal.user",
          [["login", "=ilike", login]], ["id"], { limit: 1 });
        if (dup.length) throw new Error("اسم الدخول مستخدم مسبقًا في أودو");
        const vals = { name, login, role: params.role, status: "active" };
        const empId = toEmpId(params?.odooEmployeeId ?? params?.employeeId);
        if (empId) vals.employee_id = empId;
        const id = await odoo.create("sharqia.portal.user", vals);
        const recs = await odoo.searchRead("sharqia.portal.user", [["id", "=", id]],
          ["name", "login", "role", "status", "employee_id", "department_id",
           "last_login", "backend_id"], { limit: 1 });
        return mapPortalUser(recs[0]);
      },
      async () => { throw new Error("إنشاء المستخدمين غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // تعديل مستخدم: الدور أو الحالة (تفعيل/إيقاف) أو الموظف المرتبط
  async "portalUser.update"(params) {
    const id = toEmpId(params?.id);
    if (!id) throw new Error("معرّف المستخدم مطلوب");
    const vals = {};
    if (params?.role !== undefined) {
      if (!PORTAL_ROLES.includes(params.role)) throw new Error(`دور غير معروف: ${params.role}`);
      vals.role = params.role;
    }
    if (params?.status !== undefined)
      vals.status = params.status === "suspended" ? "suspended" : "active";
    if (params?.odooEmployeeId !== undefined)
      vals.employee_id = toEmpId(params.odooEmployeeId) || false;
    if (!Object.keys(vals).length) throw new Error("لا يوجد ما يُحدَّث");
    return withOdoo(
      async () => {
        await odoo.write("sharqia.portal.user", [id], vals);
        const recs = await odoo.searchRead("sharqia.portal.user", [["id", "=", id]],
          ["name", "login", "role", "status", "employee_id", "department_id",
           "last_login", "backend_id"], { limit: 1 });
        if (!recs.length) throw new Error("لم يُعثر على المستخدم في أودو");
        return mapPortalUser(recs[0]);
      },
      async () => { throw new Error("تعديل المستخدمين غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
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
  //   requiresAllocation: هل يستهلك هذا النوع رصيدًا مخصَّصًا؟ بدونه كانت
  //   شاشة الطلب تقارن أيام أي إجازة برصيد الإجازة السنوية، فتُحذّر «الرصيد
  //   غير كافٍ» على إجازة دراسية أو مرضية — وهي لا تُخصم من رصيد أصلًا.
  async "leaveType.list"() {
    return withOdoo(
      async () => {
        const fields = await availableFields("hr.leave.type",
          ["name", "requires_allocation", "leave_validation_type",
            "sharqia_max_days"]);
        const recs = await odoo.searchRead("hr.leave.type", [], fields, { limit: 100 });
        return {
          records: recs.map((r) => ({
            id: r.id, name: r.name,
            requiresAllocation: r.requires_allocation === true,
            validation: r.leave_validation_type || "",
            // Ø³ÙÙ Ø§ÙØ£ÙØ§Ù ÙØµÙ Ø§ÙØªØ·Ø¨ÙÙ ÙÙÙÙØ¹ Ø§ÙØ·ÙØ¨ ÙØ¨Ù Ø¥Ø±Ø³Ø§ÙÙ. ÙØ§ÙØ­Ø¯Ù ÙÙØ³Ù
            // ÙÙØ±ÙØ¶ ÙÙ Ø£ÙØ¯ÙØ ÙØ§ÙÙØ§Ø¬ÙØ© ØªÙØ­Ø³ÙÙ Ø§ÙØªØ¬Ø±Ø¨Ø© ÙÙØ§ ØªØ­Ø±Ø³ ÙØ­Ø¯ÙØ§.
            maxDays: Number(r.sharqia_max_days || 0),
          })),
        };
      },
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
  //   ⚠️ كان يرجع سجلات أودو خامًّا (check_in/check_out بتوقيت UTC)، والشاشة
  //   تقرأ in/out/status/manual — فتظهر كل الأيام «—» والعدّادات أصفارًا.
  async "attendance.log"(params, ctx) {
    const empId = toEmpId(params?.employeeId) || ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        const fields = await availableFields("hr.attendance",
          ["check_in", "check_out", "worked_hours", "x_manual", "x_location_id",
           "x_in_range", "x_accuracy_m", "x_distance_m"]);
        const recs = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId]], fields, { limit: 60, order: "check_in desc" });
        return { records: recs.map(mapAttendance) };
      },
      async () => ({ records: FX.FX_ATTENDANCE }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // حالة اليوم: هل سجّل حضوره؟ هل أغلقه؟ — تُقرأ من أودو لا من ذاكرة المتصفح.
  //   بدونها كانت شاشة البصمة تبدأ دائمًا بـ«لم يسجّل بعد»، فزر «انصراف»
  //   يردّ «لا يمكن تسجيل الانصراف قبل تسجيل الحضور» ولا يصل الخادم أصلًا.
  async "attendance.today"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const empty = { checkedIn: false, checkedOut: false, open: null, last: null, closedStale: 0 };
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo");
        const fields = await availableFields("hr.attendance",
          ["check_in", "check_out", "worked_hours", "x_location_id", "x_in_range", "x_manual"]);
        const known = await modelFieldNames("hr.attendance");
        const only = (o) => (known ? Object.fromEntries(Object.entries(o).filter(([k]) => known.has(k))) : {});
        const today = todayLocal();

        // ⚠️ كل يوم يقف بنفسه: بصمةٌ من أمسِ نُسي إغلاقها كانت تُحسب حضورًا
        // لليوم، فيجد الموظف زر «انصراف» صباحًا قبل أن يحضر. تُغلق هنا
        // بساعات دوامها وتُعلَّم يدوية ليصحّحها المسؤول، ولا تخصّ يومه.
        let closedStale = 0;
        try {
          const stale = (await odoo.searchRead("hr.attendance",
            [["employee_id", "=", empId], ["check_out", "=", false]],
            ["id", "check_in"], { limit: 20, order: "check_in desc" }))
            .filter((r) => localParts(r.check_in)?.date !== today);
          for (const r of stale) {
            try {
              await odoo.write("hr.attendance", r.id,
                { check_out: await autoCloseStamp(empId, r.check_in), ...only({ x_manual: true }) });
              closedStale++;
            } catch (e) { console.warn("⚠️ تعذّر إغلاق بصمة معلّقة", r.id, e.message); }
          }
        } catch (e) { console.warn("⚠️ تعذّر فحص البصمات المعلّقة:", e.message); }

        // نافذة أوسع من اليوم ثم تصفية بالتوقيت المحلّي: حدود اليوم بتوقيت
        // العمل لا بتوقيت UTC، وإلا زاحت بثلاث ساعات فاختلط آخر الليل بأمس.
        const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
        const recs = (await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId], ["check_in", ">=", since]],
          fields, { limit: 20, order: "check_in desc" }))
          .filter((r) => localParts(r.check_in)?.date === today);

        const open = recs.find((r) => !r.check_out) || null;
        const last = recs[0] || null;
        return {
          checkedIn: !!last,
          checkedOut: !!(last && last.check_out && !open),
          open: open ? mapAttendance(open) : null,
          last: last ? mapAttendance(last) : null,
          closedStale,
        };
      },
      async () => ({ ...empty }),
      { emptyOnError: () => ({ ...empty, unavailable: true }) }
    );
  },

  // سلف الموظف من نظام القروض (loan.request) — يُربط بالموظف عبر جهة اتصاله
  async "loan.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        if (!(await modelFieldNames("loan.request"))) return { records: [] };
        const emp = await odoo.searchRead("hr.employee", [["id", "=", empId]],
          ["work_contact_id", "user_partner_id"], { limit: 1 });
        const partner = emp[0]?.work_contact_id?.[0] || emp[0]?.user_partner_id?.[0];
        if (!partner) return { records: [] };
        const recs = await odoo.searchRead("loan.request", [["partner_id", "=", partner]],
          await availableFields("loan.request",
            ["name", "date", "loan_amount", "tenure", "interest_rate", "state", "loan_type_id"]),
          { order: "date desc", limit: 50 });
        return { records: recs.map(mapLoan) };
      },
      async () => ({ records: [] }),
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
        // 150م هو ما يعطيه جهاز حقيقي داخل مبنى أو على شبكة الجوال. الحد
        // القديم (50) كان يرفض معظم البصمات الصادقة برسالة «دقة الموقع ضعيفة».
        const maxAcc = near.location.max_accuracy_m || 150;
        const acc = Number(params.accuracy);
        if (Number.isFinite(acc) && acc > maxAcc) {
          throw new Error(
            `دقة تحديد موقعك ${Math.round(acc)}م والحد المسموح ${maxAcc}م. ` +
            "اخرج قرب نافذة أو مكان مكشوف، وفعّل «الموقع الدقيق» في إعدادات التطبيق، ثم أعد المحاولة.");
        }
        // هامش عدم اليقين: من يقف على حدّ النطاق وجهازه يخطئ ±40م يُرفض ظلمًا.
        // المسافة المؤكَّدة = المسافة المقيسة ناقص خطأ القياس.
        //   ⚠️ والهامش مسقوف بخمسين مترًا: كان مسقوفًا بحدّ الدقة (150م)،
        //   فمن يقف على 400م من نطاقٍ نصفُ قطره 300 يُحسب داخله لأن جهازه
        //   يخطئ 150 — وهو خارجه يقينًا.
        const SLACK_MAX = 50;
        const slack = Number.isFinite(acc) ? Math.min(Math.round(acc), SLACK_MAX) : 0;
        const inRange = near.within || near.distance - slack <= (near.location.radius_m || 0);
        if (!inRange) {
          throw new Error(
            `أنت خارج نطاق «${near.location.name}» بمسافة ${near.distance} متر ` +
            `(النطاق ${near.location.radius_m || 0}م).`);
        }

        // وقت الخادم دائمًا — لا نثق بوقت الجهاز
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        const geo = {
          x_in_range: true, x_location_id: near.location.id,
          ...(params.device ? { x_device: String(params.device).slice(0, 80) } : {}),
          ...(params.verify ? { x_verify: String(params.verify).slice(0, 60) } : {}),
        };
        const known = await modelFieldNames("hr.attendance");
        const only = (o) => (known ? Object.fromEntries(Object.entries(o).filter(([k]) => known.has(k))) : {});

        // صورة لحظة البصمة (اختيارية): دليلٌ على حضور الشخص لا جهازه وحده
        const photo = (() => {
          const m = String(params.photo || "").match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
          if (!m) return null;
          if (m[2].length > 3 * 1024 * 1024) return null;   // ~2.2 ميجابايت
          return m[2];
        })();

        // أودو 19 يحمل حقول موقع قياسية تعرضها شاشة الحضور نفسها. كانت
        // البوابة تتجاهلها وتكتب حقولها الخاصة فقط — فلا يظهر مكان البصمة
        // في موديول الحضور إطلاقًا مهما سُجّل.
        const native = (dir) => ({
          [`${dir}_latitude`]: lat,
          [`${dir}_longitude`]: lng,
          [`${dir}_location`]: near.location.name || "",
          [`${dir}_mode`]: "systray",
          ...(params.device ? { [`${dir}_browser`]: String(params.device).slice(0, 120) } : {}),
        });

        if (params.op === "in") {
          const openNow = await odoo.searchRead("hr.attendance",
            [["employee_id", "=", empId], ["check_out", "=", false]],
            ["id", "check_in"], { limit: 1, order: "check_in desc" });
          if (openNow.length) {
            const openDay = String(openNow[0].check_in || "").slice(0, 10);
            const today = now.slice(0, 10);
            if (openDay === today) {
              throw new Error("لديك حضور مفتوح اليوم — سجّل الانصراف أولًا.");
            }
            // بصمة يومٍ سابق نُسي إغلاقها: إبقاؤها مفتوحة يحبس الموظف عن
            // الحضور إلى الأبد. نُغلقها بساعات دوامه المعتادة ونُعلّمها يدوية
            // ليصحّحها المسؤول، ولا نمنعه من يومه الجديد.
            const closeAt = await autoCloseStamp(empId, openNow[0].check_in);
            await odoo.write("hr.attendance", openNow[0].id,
              { check_out: closeAt, ...only({ x_manual: true }) });
            console.warn(`⚠️ أُغلقت بصمة معلّقة تلقائيًا للموظف ${empId} عند ${closeAt}`);
          }
          const id = await odoo.create("hr.attendance", {
            employee_id: empId, check_in: now,
            ...only({
              ...geo, ...native("in"),
              x_geo_lat: lat, x_geo_lng: lng,
              x_accuracy_m: Number.isFinite(acc) ? Math.round(acc) : 0,
              x_distance_m: near.distance,
              ...(photo ? { x_photo: photo } : {}),
            }),
          });
          return { odooId: id, op: "in", at: now, location: near.location.name, distance: near.distance };
        }

        const open = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId], ["check_out", "=", false]], ["id"], { limit: 1, order: "check_in desc" });
        if (!open.length) throw new Error("لا يوجد سجل حضور مفتوح لتسجيل الانصراف.");
        await odoo.write("hr.attendance", open[0].id, {
          check_out: now,
          ...only({
            ...geo, ...native("out"),
            x_out_lat: lat, x_out_lng: lng,
            // ⚠️ دقة/مسافة الانصراف كانت تُكتب فوق قيم الحضور فتضيع بيانات الدخول
            x_out_accuracy_m: Number.isFinite(acc) ? Math.round(acc) : 0,
            x_out_distance_m: near.distance,
            ...(photo ? { x_out_photo: photo } : {}),
          }),
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
        // ⚠️ كان employee_id = صاحب الجلسة دائمًا، فطلبُ المدير نيابةً عن
        // موظفه يظهر في أودو باسم المدير: الإجازة تُخصم من رصيد المدير،
        // والخطاب يصدر باسمه، والموظف المستفيد لا أثر له إطلاقًا.
        const owner = await resolveBeneficiary(params, ctx);
        await assertNoLeaveOverlap(params, owner);

        const vals = {
          employee_id: owner,
          category: params.category || "general",
          service: params.service,
          title: params.title || params.service,
          description: params.desc || params.description || "",
          priority: { "عادية": "0", "متوسطة": "1", "عاجلة": "2" }[params.priority] || "0",
          confidential: !!params.confidential,
          extra_json: JSON.stringify(details),         // التفاصيل كاملة دائمًا
          // مقدّم الطلب الفعلي: صاحب الجلسة. حين يُقدَّم الطلب نيابةً عن موظف
          // آخر يبقى employee_id هو المستفيد، فبدون هذا الحقل لا يظهر في أودو
          // من قدّمه إطلاقًا.
          requested_by: [ctx?.user?.name, ctx?.user?.login].filter(Boolean).join(" · ") || "",
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

        // مرحلة أولى بلا صاحب تُتخطّى عند الإنشاء لا تُترك تعلق: طلب المدير
        // لنفسه (ولا مدير فوقه بحساب فعّال) كان يقف في «بانتظار المدير
        // المباشر» فلا يعتمده هو — لا اعتماد ذاتيًّا — ولا الموارد البشرية.
        const flow = FLOW[payload.category] || FLOW.general;
        if (flow[0] === "manager" && flow[1] && flow[1] !== "done"
            && await managerStageIsVacant(owner)) {
          const skip = { state: flow[1] };
          if (!known || known.has("stage_index")) skip.stage_index = 1;
          try {
            await odoo.write("sharqia.portal.request", id, skip);
            console.warn(`↷ الطلب ${id}: تُخطّيت مرحلة المدير (لا مدير مباشر يعتمد للموظف ${owner})`);
          } catch (e) {
            console.warn("⚠️ تعذّر تخطّي مرحلة المدير:", e.message);
          }
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
    const viewerKey = empId ? "E" + empId : "";
    // inbox = ما ينتظر إجراء صاحب الجلسة.
    //   المدير: مرؤوسوه المباشرون عبر hr.employee.parent_id (أودو يدعم المسار
    //   المنقّط في الـ domain، فلا حاجة لتخزين شجرة الإدارة في users.json).
    //   الموارد البشرية/المالية/التقنية: كل ما هو مفتوح — والواجهة تفلتر المرحلة.
    let domain;
    if (params?.scope === "all") domain = [];
    else if (params?.scope === "inbox") {
      // مرحلة «إقرار الموظف» تقلب القاعدة: صاحب الطلب هو المعتمِد. فلكل
      // موظف — مهما كان دوره — صندوقُ واردٍ يضمّ مخالصته حين تبلغ إقراره،
      // ويُستثنى غيرُه منها فلا تظهر للموارد البشرية كأنها تنتظرهم.
      const ownAck = empId
        ? [["employee_id", "=", empId], ["state", "=", "employee"]] : null;
      let roleDomain = null;
      if (role === "manager" && empId) {
        roleDomain = [["employee_id.parent_id", "=", empId],
          ["employee_id", "!=", empId],              // لا اعتماد ذاتي
          ["state", "not in", CLOSED_STATES],
          ["state", "!=", "employee"]];
      } else if (["hr", "finance", "it", "admin"].includes(role)) {
        roleDomain = [["state", "not in", CLOSED_STATES],
          ["state", "!=", "employee"]];
      }
      domain = orDomains(ownAck, roleDomain) || [["id", "=", 0]];
    } else domain = [["employee_id", "=", empId]];
    return withOdoo(
      async () => {
        const fields = await requestReadFields();
        const recs = await odoo.searchRead("sharqia.portal.request", domain, fields,
          { order: "create_date desc", limit: 200 });
        // inbox=true تعلّم الطلب بأنه ينتظر إجراء صاحب الجلسة، فتعرضه شاشة
        // المدير حتى لو تعذّر تحميل قائمة الفريق.
        const inbox = params?.scope === "inbox";
        // mgrVacant: مرحلة المدير بلا صاحب — الواجهة تُظهر أزرار الاعتماد
        // للموارد البشرية عندها بدل «هذا الطلب ليس ضمن مهامك الحالية».
        let vacancy = new Map();
        try {
          vacancy = await managerVacancy(recs.map((r) => r.employee_id?.[0]));
        } catch (e) { console.warn("⚠️ تعذّر فحص مرحلة المدير:", e.message); }
        return {
          records: recs.map((r) => ({
            ...maskConfidential(mapRequestRecord(r), viewerKey), inbox,
            mgrVacant: vacancy.get(r.employee_id?.[0]) === true,
          })),
        };
      },
      async () => ({ records: [] })
    );
  },

  // قراءة طلب واحد بالتفاصيل — يقبل رقم Odoo أو رقم الطلب النصي (HR-REQ-000x)
  async "request.read"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const viewerKey = empId ? "E" + empId : "";
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
        const owner = recs[0].employee_id?.[0];
        let mgrVacant = false;
        try { mgrVacant = (await managerVacancy([owner])).get(owner) === true; }
        catch (e) { console.warn("⚠️ تعذّر فحص مرحلة المدير:", e.message); }
        return maskConfidential({ ...mapRequestRecord(recs[0]), mgrVacant }, viewerKey);
      },
      async () => null
    );
  },

  // اعتماد/رفض من التطبيق: التحقق من الصلاحية يتم في الـ backend، ثم ينفّذ Odoo الانتقال
  async "request.approve"(params, ctx) {
    return withOdoo(
      async () => {
        // اسم المعتمِد للسجل، وحسابه ليُطبع توقيعه المحفوظ على الخطاب الصادر
        await odoo.execKw("sharqia.portal.request", "action_approve", [[params.id]],
          { context: {
            portal_actor: ctx?.user?.name || "",
            portal_actor_login: ctx?.user?.login || "",
          } });
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

  // خطابات الموظف الصادرة (sharqia.portal.letter)
  async "letter.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!(await modelFieldNames("sharqia.portal.letter"))) return { records: [] };
        // الموارد البشرية والإدارة يرون خطابات الجميع ليوقّعوها؛ غيرهم خطاباته
        const wide = ["hr", "admin"].includes(ctx?.user?.role);
        if (!wide && !empId) return { records: [] };
        const fields = await availableFields("sharqia.portal.letter",
          ["name", "letter_type", "to_entity", "lang", "state", "pdf_name",
           "create_date", "request_id", "employee_id", "is_signed", "signed_by", "signed_at"]);
        const recs = await odoo.searchRead("sharqia.portal.letter",
          wide ? [] : [["employee_id", "=", empId]], fields,
          { limit: 100, order: "create_date desc" });
        return {
          records: recs.map((r) => ({
            id: r.id,
            ref: r.name || "",
            type: LETTER_TYPE_AR[r.letter_type] || r.letter_type || "خطاب",
            to: r.to_entity || "من يهمه الأمر",
            status: LETTER_STATE_AR[r.state] || r.state || "",
            issued: r.state === "done",
            at: r.create_date || "",
            // الرابط يُبنى هنا لا في الواجهة، فمصدر واحد للحقيقة
            pdfUrl: r.state === "done" ? `/api/letters/${r.id}/pdf` : "",
            fileName: r.pdf_name || "",
            employee: r.employee_id?.[1] || "",
            signed: !!r.is_signed,
            signedBy: r.signed_by || "",
            signedAt: r.signed_at || "",
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // قراءة التوقيع المحفوظ. بدونها لم يكن للتطبيق سبيلٌ لعرض ما حُفظ، فتفتح
  // لوحة التوقيع فارغة في كل مرة ويظنّ صاحبها أن توقيعه مُسح — وهو محفوظ.
  async "me.signature.read"(params, ctx) {
    const login = ctx?.user?.login;
    if (!login) throw new Error("جلسة بلا اسم دخول");
    return withOdoo(
      async () => {
        const pu = await odoo.searchRead("sharqia.portal.user",
          [["login", "=ilike", login]], ["signature", "name"], { limit: 1 });
        const sig = pu[0]?.signature || "";
        return { hasSignature: !!sig, image: sig ? imgDataUri(sig) : "", name: pu[0]?.name || "" };
      },
      async () => ({ hasSignature: false, image: "", name: "" }),
      { emptyOnError: () => ({ hasSignature: false, image: "", name: "" }) }
    );
  },

  // توقيع المعتمِد المحفوظ في ملفه — يُطبع تلقائيًّا على ما يعتمده من خطابات
  async "me.signature"(params, ctx) {
    const login = ctx?.user?.login;
    if (!login) throw new Error("جلسة بلا اسم دخول");
    // كان الحفظ محصورًا في من يعتمد الطلبات، لأن التوقيع لم يكن يُستعمل إلا
    // على الخطابات الصادرة. ثم صارت المخالصة تُوقَّع من العامل نفسه — وهو
    // موظف لا معتمِد — فحصرُه يمنع صاحب الحقّ من توقيع مخالصته.
    // وتوقيعُ كلٍّ في ملفه هو، فلا يُوقّع أحدٌ عن أحد.
    const m = String(params?.image || "").match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!m) throw new Error("التوقيع يجب أن يكون صورة (PNG أو JPG)");
    const b64 = m[2];
    if (b64.length < 200) throw new Error("التوقيع فارغ — ارسمه أو ارفع صورته");
    if (b64.length > 2 * 1024 * 1024 * 1.37) throw new Error("حجم التوقيع كبير — الحد 2 ميجابايت");
    return withOdoo(
      async () => {
        const pu = await odoo.searchRead("sharqia.portal.user",
          [["login", "=ilike", login]], ["id"], { limit: 1 });
        if (!pu.length) throw new Error("لا يوجد مستخدم مطابق في أودو");
        await odoo.write("sharqia.portal.user", pu[0].id, { signature: b64 });
        return { ok: true };
      },
      async () => { throw new Error("حفظ التوقيع غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // توقيع الخطاب من التطبيق — الموارد البشرية والإدارة فقط
  async "letter.sign"(params, ctx) {
    const id = toEmpId(params?.id);
    const role = ctx?.user?.role || "employee";
    if (!id) throw new Error("معرّف الخطاب مطلوب");
    if (!["hr", "admin"].includes(role))
      throw new Error("التوقيع على الخطابات من صلاحية الموارد البشرية");
    const raw = String(params?.image || "");
    const m = raw.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!m) throw new Error("التوقيع يجب أن يكون صورة (PNG أو JPG)");
    const b64 = m[2];
    if (b64.length < 200) throw new Error("التوقيع فارغ — ارسمه أو ارفع صورته");
    if (b64.length > 2 * 1024 * 1024 * 1.37) throw new Error("حجم التوقيع كبير — الحد 2 ميجابايت");
    return withOdoo(
      async () => {
        const done = await odoo.execKw("sharqia.portal.letter", "apply_signature", [],
          { letter_id: id, image_b64: b64, signer_name: ctx?.user?.name || "" });
        if (!done) throw new Error("لم يُعثر على الخطاب في أودو");
        return { ok: true, id: done };
      },
      async () => { throw new Error("التوقيع غير متاح في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // ملف الخطاب — بفحص ملكية على الخادم لا على الواجهة
  async "letter.pdf"(params, ctx) {
    const id = toEmpId(params?.id);
    if (!id) throw new Error("معرّف الخطاب مطلوب");
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("sharqia.portal.letter", [["id", "=", id]],
          ["employee_id", "state", "pdf_file", "pdf_name", "letter_type"], { limit: 1 });
        const l = recs[0];
        if (!l) throw new Error("الخطاب غير موجود");
        // خطاب الراتب يحمل بيانات أجر — لا يُفتح إلا لصاحبه أو للموارد البشرية
        if (!["hr", "finance", "admin"].includes(role) && l.employee_id?.[0] !== empId)
          throw new Error("لا تملك صلاحية فتح هذا الخطاب");
        if (l.state !== "done") throw new Error("الخطاب لم يُصدَر بعد");
        if (!l.pdf_file) throw new Error("لم يُولَّد ملف لهذا الخطاب — راجع الموارد البشرية");
        return {
          base64: l.pdf_file,
          name: l.pdf_name || `${LETTER_TYPE_AR[l.letter_type] || "خطاب"}.pdf`,
        };
      },
      async () => { throw new Error("الخطابات غير متاحة في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // تنزيل مرفق — بفحص ملكية على الخادم.
  //   الموظف يفتح مرفقات طلبه هو؛ المدير مرفقات مرؤوسيه؛ الأدوار الإدارية الكل.
  //   بدون هذا الفحص يقرأ أي موظف أي مرفق في أودو برقمه فقط.
  async "attachment.read"(params, ctx) {
    const id = toEmpId(params?.id);
    if (!id) throw new Error("معرّف المرفق مطلوب");
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("ir.attachment", [["id", "=", id]],
          ["name", "mimetype", "res_model", "res_id", "datas"], { limit: 1 });
        const a = recs[0];
        if (!a) throw new Error("المرفق غير موجود");

        // صور التعاميم مُذاعة على الموظفين أصلًا — تُفتح بلا فحص ملكية.
        // المرفق المرتبط بتعميم قد يصل بلا res_model (يُربط عبر m2m)، فنتحقّق
        // من ارتباطه بتعميم فعلًا لا من كونه مجهول النسب.
        if (a.res_model !== "sharqia.portal.request") {
          const inAnn = await odoo.searchRead("sharqia.portal.announcement",
            [["image_ids", "in", [id]]], ["id"], { limit: 1 }).catch(() => []);
          if (inAnn.length) {
            return { name: a.name, mimetype: a.mimetype || "image/jpeg", base64: a.datas };
          }
          throw new Error("هذا المرفق غير متاح عبر التطبيق");
        }

        if (!["hr", "finance", "it", "admin"].includes(role)) {
          const owner = await odoo.searchRead("sharqia.portal.request",
            [["id", "=", a.res_id]], ["employee_id"], { limit: 1 });
          const ownerEmp = owner[0]?.employee_id?.[0];
          let allowed = ownerEmp === empId;
          if (!allowed && role === "manager" && empId) {
            const sub = await odoo.searchRead("hr.employee",
              [["id", "=", ownerEmp], ["parent_id", "=", empId]], ["id"], { limit: 1 });
            allowed = sub.length > 0;
          }
          if (!allowed) throw new Error("لا تملك صلاحية فتح هذا المرفق");
        }
        return { name: a.name, mimetype: a.mimetype || "application/octet-stream", base64: a.datas };
      },
      async () => { throw new Error("المرفقات غير متاحة في وضع الاختبار"); },
      { forceLiveErrors: true }
    );
  },

  // ---- التعاميم (sharqia.portal.announcement) — تُقرأ من Odoo ----
  async "announcement.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        // availableFields: الصورة والمقتطف أُضيفا لاحقًا — طلبهما من أدون قديم
        // كان سيُفشل قراءة التعاميم كلها فتختفي من الشاشة الرئيسية
        const fields = await availableFields("sharqia.portal.announcement",
          ["title", "body_html", "summary", "image", "image_ids", "priority", "pinned",
           "publish_date", "require_ack", "audience", "department_id"]);
        const recs = await odoo.searchRead("sharqia.portal.announcement", [], fields,
          { limit: 50, order: "pinned desc, publish_date desc" });

        // حالة القراءة لهذا الموظف. بدونها كانت الواجهة تُولّد إشعارًا لكل
        // تعميم بـ read=false في كل تحميل، فيعود المقروء غير مقروء أبدًا.
        const readAt = new Map();
        if (empId && recs.length) {
          try {
            const acks = await odoo.searchRead("sharqia.portal.announcement.ack",
              [["employee_id", "=", empId], ["announcement_id", "in", recs.map((r) => r.id)]],
              ["announcement_id", "read_at", "is_read"], { limit: 200 });
            for (const a of acks)
              if (a.is_read || a.read_at) readAt.set(a.announcement_id?.[0], a.read_at || true);
          } catch (e) {
            console.warn("⚠️ تعذّرت قراءة إقرارات التعاميم:", e.message);
          }
        }

        return {
          records: recs.map((r) => {
            const text = htmlToText(r.body_html);
            return {
              id: r.id,
              title: r.title,
              body: text,
              bodyHtml: r.body_html || "",
              summary: r.summary || text.slice(0, 140),
              image: imgDataUri(r.image),
              // الصور الإضافية كروابط لا كمحتوى: ألبوم من عشر صور داخل رد
              // قائمة التعاميم يعني عشرات الميغابايت عند كل فتح للرئيسية
              images: (Array.isArray(r.image_ids) ? r.image_ids : [])
                .map((id) => `/api/attachments/${id}`),
              priority: r.priority === "important" ? "مهم" : "عادي",
              pinned: !!r.pinned,
              requireAck: !!r.require_ack,
              audience: r.audience === "dept"
                ? (r.department_id?.[1] || "قسم محدّد") : "جميع الموظفين",
              at: r.publish_date || null,
              read: readAt.has(r.id),
              readAt: typeof readAt.get(r.id) === "string" ? readAt.get(r.id) : null,
            };
          }),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  // ═══════════════════════════════════════════════════════════════════
  // التدريب: دورات وأسئلة
  // ═══════════════════════════════════════════════════════════════════

  /** دورات هذا الموظف مع حالة تسجيله في كلٍّ منها. */
  async "course.list"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        const [emp] = await odoo.searchRead("hr.employee",
          [["id", "=", empId]], ["department_id"], { limit: 1 });
        const deptId = emp?.department_id?.[0] || 0;
        // التوجيه يُصفّى في أودو لا في التطبيق: دورةٌ لقسمٍ آخر لا تُرسَل
        // أصلًا، فلا تُقرأ من أدوات المتصفّح.
        const domain = ["|", "|",
          ["audience", "=", "all"],
          "&", ["audience", "=", "department"], ["department_ids", "in", [deptId]],
          "&", ["audience", "=", "employee"], ["employee_ids", "in", [empId]]];
        const fields = await availableFields("sharqia.portal.course",
          ["name", "summary", "category", "duration_min", "mandatory", "pass_score",
            "deadline", "lesson_count", "question_count", "total_points", "sequence",
            "max_attempts"]);
        const recs = await odoo.searchRead("sharqia.portal.course", domain, fields,
          { limit: 100, order: "mandatory desc, sequence, id" });
        if (!recs.length) return { records: [] };

        const enrolls = await odoo.searchRead("sharqia.portal.course.enrollment",
          [["employee_id", "=", empId], ["course_id", "in", recs.map((r) => r.id)]],
          ["course_id", "state", "score", "attempts", "lessons_done", "finished_at"],
          { limit: 200 });
        const byCourse = new Map(enrolls.map((e) => [e.course_id?.[0], e]));
        return {
          records: recs.map((r) => {
            const e = byCourse.get(r.id);
            return {
              id: r.id, name: r.name, summary: r.summary || "",
              category: COURSE_CAT_AR[r.category] || r.category || "",
              minutes: r.duration_min || 0, mandatory: !!r.mandatory,
              passScore: r.pass_score || 0, deadline: r.deadline || null,
              maxAttempts: Number(r.max_attempts || 0),
              lessons: r.lesson_count || 0, questions: r.question_count || 0,
              points: r.total_points || 0,
              state: e?.state || "assigned",
              score: e?.score || 0, attempts: e?.attempts || 0,
              lessonsDone: e?.lessons_done || 0,
              finishedAt: e?.finished_at || null,
            };
          }),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** دورة واحدة بدروسها وأسئلتها — بلا الإجابات الصحيحة. */
  async "course.read"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!id) return null;
        const cf = await availableFields("sharqia.portal.course",
          ["name", "summary", "description", "category", "duration_min", "mandatory",
            "pass_score", "deadline", "max_attempts"]);
        const [c] = await odoo.searchRead("sharqia.portal.course",
          [["id", "=", id]], cf, { limit: 1 });
        if (!c) return null;

        const lessons = await odoo.searchRead("sharqia.portal.course.lesson",
          [["course_id", "=", id]],
          ["name", "content", "video_url", "duration_min", "sequence"],
          { order: "sequence, id", limit: 100 });
        // ⚠️ is_correct لا يُقرأ هنا إطلاقًا. لو أُرسل مع الخيارات لظهر في
        // استجابة الشبكة، وحُلَّ الاختبار من لوحة أدوات المطوّر قبل تسليمه.
        const questions = await odoo.searchRead("sharqia.portal.course.question",
          [["course_id", "=", id]], ["name", "qtype", "points", "sequence"],
          { order: "sequence, id", limit: 200 });
        let options = [];
        if (questions.length) {
          options = await odoo.searchRead("sharqia.portal.course.option",
            [["question_id", "in", questions.map((q) => q.id)]],
            ["question_id", "name", "sequence"], { order: "sequence, id", limit: 800 });
        }
        const optsByQ = new Map();
        for (const o of options) {
          const qid = o.question_id?.[0];
          if (!optsByQ.has(qid)) optsByQ.set(qid, []);
          optsByQ.get(qid).push({ id: o.id, text: o.name });
        }

        let enrollment = null;
        if (empId) {
          const [e] = await odoo.searchRead("sharqia.portal.course.enrollment",
            [["course_id", "=", id], ["employee_id", "=", empId]],
            ["state", "score", "points", "attempts", "lessons_done", "finished_at"],
            { limit: 1 });
          if (e) enrollment = {
            state: e.state, score: e.score, points: e.points,
            attempts: e.attempts, lessonsDone: e.lessons_done,
            finishedAt: e.finished_at || null,
          };
        }
        return {
          id: c.id, name: c.name, summary: c.summary || "",
          description: htmlToText(c.description || ""),
          category: COURSE_CAT_AR[c.category] || c.category || "",
          minutes: c.duration_min || 0, mandatory: !!c.mandatory,
          passScore: c.pass_score || 0, deadline: c.deadline || null,
          maxAttempts: Number(c.max_attempts || 0),
          lessons: lessons.map((l) => ({
            id: l.id, name: l.name, minutes: l.duration_min || 0,
            content: htmlToText(l.content || ""), video: l.video_url || "",
          })),
          questions: questions.map((q) => ({
            id: q.id, text: q.name, type: q.qtype, points: q.points || 1,
            options: optsByQ.get(q.id) || [],
          })),
          enrollment,
        };
      },
      async () => null
    );
  },

  /** يفتح تسجيل الموظف أو يحدّث عدد دروسه المنجزة. */
  async "course.progress"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!empId || !id) throw new Error("بيانات ناقصة");
        const [e] = await odoo.searchRead("sharqia.portal.course.enrollment",
          [["course_id", "=", id], ["employee_id", "=", empId]],
          ["state", "lessons_done"], { limit: 1 });
        const done = Math.max(0, Number(params?.lessonsDone || 0));
        if (!e) {
          const newId = await odoo.create("sharqia.portal.course.enrollment", {
            course_id: id, employee_id: empId, state: "in_progress",
            lessons_done: done,
          });
          return { ok: true, enrollmentId: newId, state: "in_progress" };
        }
        const vals = { lessons_done: Math.max(done, e.lessons_done || 0) };
        // النجاح لا يُنقَض بإعادة فتح درس
        if (e.state === "assigned") vals.state = "in_progress";
        await odoo.write("sharqia.portal.course.enrollment", [e.id], vals);
        return { ok: true, enrollmentId: e.id, state: vals.state || e.state };
      },
      async () => ({ ok: false })
    );
  },

  /** تسليم الاختبار — التصحيح كله في أودو. */
  async "course.submit"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const id = Number(params?.id || 0);
    const answers = params?.answers && typeof params.answers === "object"
      ? params.answers : {};
    return withOdoo(
      async () => {
        if (!empId || !id) throw new Error("بيانات ناقصة");
        const [e] = await odoo.searchRead("sharqia.portal.course.enrollment",
          [["course_id", "=", id], ["employee_id", "=", empId]], ["id"], { limit: 1 });
        let enrollId = e?.id;
        if (!enrollId) {
          enrollId = await odoo.create("sharqia.portal.course.enrollment", {
            course_id: id, employee_id: empId, state: "in_progress",
          });
        }
        const res = await odoo.execKw("sharqia.portal.course.enrollment",
          "submit_answers", [[enrollId], answers]);
        return res || { ok: false };
      },
      async () => ({ ok: false })
    );
  },

  // ═══════════════════════════════════════════════════════════════════
  // تقييم الأداء
  // ═══════════════════════════════════════════════════════════════════

  /** تقييمات الموظف نفسه — المُعتمَدة منها فقط.
   *
   *  المسوّدة لا تُعرض له: هي ورقةُ عملٍ عند مديره لم تُقَل بعد، وإظهارها
   *  يجعل كل تعديل عابرٍ رسالةً للموظف.
   */
  async "appraisal.mine"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        const recs = await odoo.searchRead("sharqia.portal.appraisal",
          [["employee_id", "=", empId], ["state", "in", ["submitted", "acknowledged"]]],
          ["name", "period", "date_from", "date_to", "percent", "rating", "state",
            "score", "max_score", "rated_count", "manager_id", "employee_id",
            "strengths", "improvements", "manager_note", "submitted_at"],
          { limit: 60, order: "date_to desc, id desc" });
        return { records: recs.map(mapAppraisal) };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** بطاقات المدير: ما ينتظر تقييمه وما اعتمده. */
  async "appraisal.team"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    return withOdoo(
      async () => {
        let domain;
        if (["hr", "admin"].includes(role)) domain = [];
        else if (empId) {
          domain = ["|", ["manager_id", "=", empId],
            ["employee_id.parent_id", "=", empId]];
        } else return { records: [] };
        if (params?.state) {
          domain = domain.length
            ? ["&", ...domain, ["state", "=", params.state]]
            : [["state", "=", params.state]];
        }
        const recs = await odoo.searchRead("sharqia.portal.appraisal", domain,
          ["name", "employee_id", "manager_id", "period", "date_from", "date_to",
            "percent", "rating", "state", "score", "max_score", "rated_count"],
          { limit: 150, order: "state, date_to desc, id desc" });
        return { records: recs.map(mapAppraisal) };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** بطاقة واحدة بمعاييرها مجمّعةً في محاورها. */
  async "appraisal.read"(params, ctx) {
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!id) return null;
        const [a] = await odoo.searchRead("sharqia.portal.appraisal",
          [["id", "=", id]],
          ["name", "employee_id", "manager_id", "period", "date_from", "date_to",
            "percent", "rating", "state", "score", "max_score", "rated_count",
            "strengths", "improvements", "manager_note", "employee_note",
            "submitted_at", "acknowledged_at"], { limit: 1 });
        if (!a) return null;
        const lines = await odoo.searchRead("sharqia.portal.appraisal.line",
          [["appraisal_id", "=", id]],
          ["criterion_id", "section_id", "score", "note", "sequence", "section_sequence"],
          { limit: 300, order: "section_sequence, sequence, id" });
        const sections = [];
        const bySection = new Map();
        for (const l of lines) {
          const sid = l.section_id?.[0] || 0;
          if (!bySection.has(sid)) {
            const sec = { id: sid, name: l.section_id?.[1] || "أخرى", items: [] };
            bySection.set(sid, sec); sections.push(sec);
          }
          bySection.get(sid).items.push({
            id: l.id, name: l.criterion_id?.[1] || "",
            score: l.score ? Number(l.score) : 0, note: l.note || "",
          });
        }
        return { ...mapAppraisal(a), sections };
      },
      async () => null
    );
  },

  /** حفظ درجات المدير من غير اعتماد. */
  async "appraisal.save"(params, ctx) {
    const id = Number(params?.id || 0);
    const scores = params?.scores && typeof params.scores === "object"
      ? params.scores : {};
    return withOdoo(
      async () => {
        if (!id) throw new Error("بيانات ناقصة");
        for (const [lineId, raw] of Object.entries(scores)) {
          const n = Math.round(Number(raw) || 0);
          if (!(n >= 1 && n <= 5)) continue;
          await odoo.write("sharqia.portal.appraisal.line",
            [Number(lineId)], { score: String(n) });
        }
        const head = {};
        if (typeof params?.strengths === "string") head.strengths = params.strengths;
        if (typeof params?.improvements === "string") head.improvements = params.improvements;
        if (typeof params?.note === "string") head.manager_note = params.note;
        if (Object.keys(head).length) {
          await odoo.write("sharqia.portal.appraisal", [id], head);
        }
        return { ok: true };
      },
      async () => ({ ok: false })
    );
  },

  /** اعتماد المدير للبطاقة — يُخطَر الموظف بعده. */
  async "appraisal.submit"(params, ctx) {
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!id) throw new Error("بيانات ناقصة");
        if (params?.scores) await runAction("appraisal.save", params, ctx);
        await odoo.execKw("sharqia.portal.appraisal", "action_submit", [[id]]);
        return { ok: true };
      },
      async () => ({ ok: false })
    );
  },

  /** إقرار الموظف باطّلاعه — ومعه ردّه إن كتبه. */
  async "appraisal.acknowledge"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!id || !empId) throw new Error("بيانات ناقصة");
        // الإقرار لصاحب البطاقة وحده — يُتحقَّق في الخادم لا في الواجهة
        const [a] = await odoo.searchRead("sharqia.portal.appraisal",
          [["id", "=", id]], ["employee_id", "state"], { limit: 1 });
        if (!a || a.employee_id?.[0] !== empId) {
          throw new Error("هذا التقييم ليس تقييمك");
        }
        if (typeof params?.reply === "string" && params.reply.trim()) {
          await odoo.write("sharqia.portal.appraisal", [id],
            { employee_note: params.reply.trim() });
        }
        if (a.state === "submitted") {
          await odoo.execKw("sharqia.portal.appraisal", "action_acknowledge", [[id]]);
        }
        return { ok: true };
      },
      async () => ({ ok: false })
    );
  },

  // ═══════════════════════════════════════════════════════════════════
  // المخالفات والجزاءات
  // ═══════════════════════════════════════════════════════════════════

  /** لائحة المخالفات — يقرؤها المدير ليختار منها عند الرفع. */
  async "discipline.violations"(params, ctx) {
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("sharqia.discipline.violation", [],
          ["code", "name", "category", "sequence"],
          { order: "category, sequence, id", limit: 300 });
        return {
          records: recs.map((r) => ({
            id: r.id, code: r.code, name: r.name,
            category: DISC_CATEGORY_AR[r.category] || r.category || "",
            categoryKey: r.category || "",
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** جزاءات الموظف نفسه — والمسودة تُخفى عنه.
   *
   *  المسودة اتّهامٌ لم يُحقَّق فيه بعد، وإظهارها للعامل قبل التحقيق يجعل كل
   *  اتّهامٍ عقوبةً بذاته. يراها حين يُفتح التحقيق ويُطلب منه قولُه.
   */
  async "discipline.mine"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) return { records: [] };
        const recs = await odoo.searchRead("sharqia.discipline.penalty",
          [["employee_id", "=", empId], ["state", "!=", "draft"]],
          DISC_FIELDS, { limit: 100, order: "occurred_on desc, id desc" });
        return { records: recs.map(mapPenalty) };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** جزاءات الفريق — للمدير المباشر، وكلُّها للموارد البشرية. */
  async "discipline.team"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    return withOdoo(
      async () => {
        let domain;
        if (["hr", "admin"].includes(role)) domain = [];
        else if (empId) domain = [["employee_id.parent_id", "=", empId]];
        else return { records: [] };
        const recs = await odoo.searchRead("sharqia.discipline.penalty", domain,
          DISC_FIELDS, { limit: 200, order: "state, occurred_on desc, id desc" });
        return { records: recs.map(mapPenalty) };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** من يجوز لصاحب الجلسة أن يرفع عليه مخالفة.
   *
   *  القائمة نفسها هي حدّ الصلاحية: المدير لا يرى إلا مرؤوسيه، فلا يستطيع
   *  اختيار من ليس تحته أصلًا. وتُستثنى نفسه — لا يوقّع أحدٌ جزاءً على نفسه.
   *  ولا نستعمل team.list هنا: هي تجلب الحضور والإجازات والطلبات لكل موظف،
   *  وهذه الشاشة لا تحتاج إلا اسمًا ووظيفة.
   */
  async "discipline.employees"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const role = ctx?.user?.role || "employee";
    return withOdoo(
      async () => {
        let domain;
        if (["hr", "admin"].includes(role)) domain = [];
        else if (empId) domain = [["parent_id", "=", empId]];
        else return { records: [] };
        if (empId) domain = domain.length
          ? ["&", ...domain, ["id", "!=", empId]]
          : [["id", "!=", empId]];
        const recs = await odoo.searchRead("hr.employee", domain,
          ["name", "job_title", "department_id"], { limit: 400, order: "name" });
        return {
          records: recs.map((r) => ({
            id: r.id, name: r.name || "",
            job: r.job_title || "",
            department: r.department_id?.[1] || "",
          })),
        };
      },
      async () => ({ records: [] }),
      { emptyOnError: () => ({ records: [], unavailable: true }) }
    );
  },

  /** رفع مخالفة على موظف. */
  async "discipline.create"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        const target = Number(params?.employeeId || 0);
        const violation = Number(params?.violationId || 0);
        if (!target || !violation) throw new Error("الموظف والمخالفة مطلوبان");
        if (!String(params?.description || "").trim())
          throw new Error("وصف الواقعة مطلوب");
        // النطاق يُفرض على الخادم لا على الشاشة: تصفية القائمة تمنع الاختيار
        // الخطأ، ولا تمنع طلبًا مصنوعًا بيده. والمدير سلطته على مرؤوسيه وحدهم.
        const role = ctx?.user?.role || "employee";
        if (!["hr", "admin"].includes(role)) {
          if (target === empId) throw new Error("لا تُرفع مخالفة على نفسك");
          const [t] = await odoo.searchRead("hr.employee",
            [["id", "=", target]], ["parent_id"], { limit: 1 });
          if (!t || t.parent_id?.[0] !== empId)
            throw new Error("لا تملك صلاحية رفع مخالفة على هذا الموظف");
        }
        const id = await odoo.create("sharqia.discipline.penalty", {
          employee_id: target,
          violation_id: violation,
          reported_by_id: empId || false,
          occurred_on: params?.occurredOn || undefined,
          discovered_on: params?.discoveredOn || undefined,
          description: String(params.description).trim(),
        });
        // المسودة اتّهامٌ لا يراه العامل. ورفعها من الهاتف يُقصد به إبلاغه
        // ليردّ، فنفتح التحقيق في الحال: يصله الإشعار ويكتب أقواله.
        // وإن ردّت أودو (مضى ثلاثون يومًا على الاكتشاف — المادة 72) نحذف
        // المسودة ونُعيد سببها، فلا تتراكم اتّهاماتٌ معلّقة لا يعلم بها أحد.
        try {
          await odoo.callButton("sharqia.discipline.penalty",
            "action_open_investigation", [id]);
        } catch (e) {
          await odoo.unlink("sharqia.discipline.penalty", [id]).catch(() => {});
          throw e;
        }
        return { ok: true, id };
      },
      async () => ({ ok: false })
    );
  },

  /** أقوال العامل — يكتبها هو، ولا يكتبها عنه أحد. */
  async "discipline.statement"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    const id = Number(params?.id || 0);
    return withOdoo(
      async () => {
        if (!id || !empId) throw new Error("بيانات ناقصة");
        const [rec] = await odoo.searchRead("sharqia.discipline.penalty",
          [["id", "=", id]], ["employee_id", "state"], { limit: 1 });
        if (!rec || rec.employee_id?.[0] !== empId)
          throw new Error("هذه المخالفة ليست عليك");
        const text = String(params?.text || "").trim();
        if (!text) throw new Error("اكتب أقوالك قبل الإرسال");
        const field = params?.grievance ? "grievance" : "employee_statement";
        const vals = { [field]: text };
        if (params?.grievance) vals.grievance_on = nowOdooDate();
        await odoo.write("sharqia.discipline.penalty", [id], vals);
        return { ok: true };
      },
      async () => ({ ok: false })
    );
  },
};

export async function runAction(action, params = {}, ctx = {}) {
  const fn = actions[action];
  if (!fn) throw new Error(`إجراء غير معروف: ${action}`);
  return fn(params, ctx);
}

export const ACTION_NAMES = Object.keys(actions);
