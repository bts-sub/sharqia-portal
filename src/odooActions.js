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
    const ex = params.extra || {};
    // استخرج التفاصيل من الحقول المباشرة أو من extra
    const pick = (...keys) => { for (const k of keys) { if (params[k] != null && params[k] !== "") return params[k]; if (ex[k] != null && ex[k] !== "") return ex[k]; } return null; };
    const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const toDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
    return withOdoo(
      async () => {
        const vals = {
          employee_id: empId,
          category: params.category || "general",
          service: params.service,
          title: params.title || params.service,
          description: params.desc || "",
          priority: { "عادية": "0", "متوسطة": "1", "عاجلة": "2" }[params.priority] || "0",
          confidential: !!params.confidential,
          extra_json: JSON.stringify(ex),
        };
        // حقول تفصيلية منفصلة (تُملأ إن وُجدت)
        const subType = pick("leaveType", "assetType", "letterType", "sub_type", "subType");
        const dateFrom = toDate(pick("from", "dateFrom", "startDate", "date", "needDate"));
        const dateTo = toDate(pick("to", "dateTo", "endDate", "returnDate"));
        const days = toNum(pick("days", "duration"));
        const amount = toNum(pick("amount"));
        const quantity = toNum(pick("quantity", "copies"));
        const purpose = pick("purpose", "to_entity", "to_entity", "delivery");
        const reason = pick("reason");
        if (subType != null) vals.sub_type = String(subType);
        if (dateFrom) vals.date_from = dateFrom;
        if (dateTo) vals.date_to = dateTo;
        if (days != null) vals.days = days;
        if (amount != null) vals.amount = amount;
        if (quantity != null) vals.quantity = quantity;
        if (purpose != null) vals.purpose = String(purpose);
        if (reason != null) vals.reason = String(reason);

        const id = await odoo.create("sharqia.portal.request", vals);
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
      async () => ({
        records: await odoo.searchRead("sharqia.portal.request", domain,
          ["name", "employee_id", "category", "service", "title", "state", "current_stage", "create_date"],
          { order: "create_date desc", limit: 200 }),
      }),
      async () => ({ records: [] })
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
