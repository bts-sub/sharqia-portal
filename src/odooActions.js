// ===========================================================================
// odooActions.js — طبقة العمليات الموحّدة مع Odoo (نقطة الدخول: POST /api/odoo)
//   كل عملية Odoo تُعرّف هنا كـ action باسم، وتُستدعى بـ { action, params }.
//   منطق Test Mode: لو TEST_MODE مفعّل أو فشل الاتصال بأودو → ترجع fixtures.
//   ملاحظة الأمان: ctx.user يأتي من الجلسة (JWT) ويحدّد الموظف المرتبط في Odoo.
// ===========================================================================
import * as odoo from "./lib/odooClient.js";
import { isTestMode } from "./lib/settings.js";
import * as FX from "./fixtures.js";

// غلاف موحّد: يجرّب Odoo، ويسقط لبيانات الاختبار عند التفعيل اليدوي أو فشل الاتصال
async function withOdoo(liveFn, fixtureFn, { forceLiveErrors = false } = {}) {
  if (isTestMode()) return { source: "test", data: await fixtureFn() };
  try {
    return { source: "odoo", data: await liveFn() };
  } catch (e) {
    if (forceLiveErrors) throw e;            // عمليات الكتابة الحسّاسة: لا تُخفِ الخطأ خلف fixtures
    return { source: "test-fallback", data: await fixtureFn(), warning: e.message };
  }
}

// حقول hr.employee التي نقرأها ونحوّلها لشكل الواجهة
const EMP_FIELDS = ["name", "job_title", "department_id", "work_email", "work_phone", "parent_id", "employee_type"];

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
function mapRequestRecord(rec) {
  let extra = {};
  try { extra = JSON.parse(rec.extra_json || "{}") || {}; } catch { extra = {}; }
  if (typeof extra !== "object" || Array.isArray(extra)) extra = {};
  return { ...rec, extra, details: pickDetailValues(rec) };
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
    contract: rec.employee_type || "", leaveBalance: rec.leaveBalance ?? null,
  };
}

// حالة الإجازة في Odoo → نص عربي متوافق مع الواجهة
const LEAVE_STATE_AR = {
  draft: "مسودة", confirm: "في انتظار المدير", validate1: "بانتظار الموارد البشرية",
  validate: "معتمدة", refuse: "مرفوضة", cancel: "ملغاة",
};
function mapLeave(rec) {
  return {
    id: "LV-" + String(rec.id).padStart(5, "0"), odooId: rec.id,
    type: rec.holiday_status_id?.[1] || "", from: rec.request_date_from || rec.date_from,
    to: rec.request_date_to || rec.date_to, days: rec.number_of_days,
    status: LEAVE_STATE_AR[rec.state] || rec.state, approver: rec.manager_id?.[1] || "",
    started: false,
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
  async "employee.me"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        if (!empId) throw new Error("المستخدم غير مربوط بموظف في Odoo (odooEmployeeId)");
        const recs = await odoo.searchRead("hr.employee", [["id", "=", empId]], EMP_FIELDS, { limit: 1 });
        return mapEmployee(recs[0]);
      },
      async () => FX.FX_EMPLOYEE
    );
  },

  // رصيد الإجازات (allocation - taken) — مبسّط: مجموع الأيام المتبقية من hr.leave.allocation
  async "leave.balance"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        const allocs = await odoo.searchRead("hr.leave.allocation",
          [["employee_id", "=", empId], ["state", "=", "validate"]], ["number_of_days"]);
        const taken = await odoo.searchRead("hr.leave",
          [["employee_id", "=", empId], ["state", "=", "validate"]], ["number_of_days"]);
        const allocated = allocs.reduce((s, a) => s + (a.number_of_days || 0), 0);
        const used = taken.reduce((s, a) => s + (a.number_of_days || 0), 0);
        return { balance: Math.max(0, allocated - used) };
      },
      async () => ({ balance: FX.FX_LEAVE_BALANCE })
    );
  },

  // إجازات الموظف — كل الحالات أو المعتمدة فقط (onlyApproved)
  async "leave.list"(params, ctx) {
    const empId = params?.employeeId || ctx?.user?.odooEmployeeId;
    const domain = [["employee_id", "=", empId]];
    if (params?.onlyApproved) domain.push(["state", "=", "validate"]);
    return withOdoo(
      async () => {
        const recs = await odoo.searchRead("hr.leave", domain,
          ["holiday_status_id", "request_date_from", "request_date_to", "number_of_days", "state", "manager_id"]);
        return { records: recs.map(mapLeave) };
      },
      async () => ({ records: params?.onlyApproved ? FX.FX_LEAVES.filter((l) => l.status === "معتمدة") : FX.FX_LEAVES })
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
        const recs = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId]], ["check_in", "check_out"], { limit: 30, order: "check_in desc" });
        return { records: recs };
      },
      async () => ({ records: FX.FX_ATTENDANCE })
    );
  },

  // تسجيل حضور/انصراف (يكتب في hr.attendance — الكتابة حسّاسة)
  async "attendance.punch"(params, ctx) {
    const empId = ctx?.user?.odooEmployeeId;
    return withOdoo(
      async () => {
        // params.op = "in" | "out" ؛ params.lat/lng محفوظة في الـ backend (geofence) قبل النداء
        if (params.op === "in") {
          const id = await odoo.create("hr.attendance", { employee_id: empId, check_in: params.at });
          return { odooId: id, op: "in" };
        }
        // انصراف: أوجد آخر سجل مفتوح واكتب check_out
        const open = await odoo.searchRead("hr.attendance",
          [["employee_id", "=", empId], ["check_out", "=", false]], ["id"], { limit: 1, order: "check_in desc" });
        if (!open.length) throw new Error("لا يوجد سجل حضور مفتوح لتسجيل الانصراف");
        await odoo.write("hr.attendance", open[0].id, { check_out: params.at });
        return { odooId: open[0].id, op: "out" };
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
    const domain = params?.scope === "all" ? [] : [["employee_id", "=", empId]];
    return withOdoo(
      async () => {
        const fields = await requestReadFields();
        const recs = await odoo.searchRead("sharqia.portal.request", domain, fields,
          { order: "create_date desc", limit: 200 });
        // التطبيق يقرأ التفاصيل من extra — نعيد بناءه من extra_json والأعمدة
        return { records: recs.map(mapRequestRecord) };
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
      async () => ({ records: [] })
    );
  },
};

export async function runAction(action, params = {}, ctx = {}) {
  const fn = actions[action];
  if (!fn) throw new Error(`إجراء غير معروف: ${action}`);
  return fn(params, ctx);
}

export const ACTION_NAMES = Object.keys(actions);
