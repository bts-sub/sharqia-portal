// ===========================================================================
// routes/requests.js — إنشاء/متابعة/اعتماد الطلبات (محرّك الموافقات)
//   POST   /api/requests                 إنشاء طلب (توافق createRequest)
//   GET    /api/requests?scope=mine|inbox|all
//   GET    /api/requests/:id
//   POST   /api/requests/:id/approve     { note }
//   POST   /api/requests/:id/reject      { note }
//   POST   /api/requests/:id/comment     { text }
//   POST   /api/requests/:id/cancel
//   PATCH  /api/requests/:model/:id      (توافق updateRequest — تحديث عام)
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as wf from "../lib/workflow.js";
import { runAction, FLOW } from "../odooActions.js";
import { isTestMode } from "../lib/settings.js";
import { badRequest, notFound, forbidden } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

// عند اكتمال طلب إجازة: أنشئ hr.leave في Odoo (مزامنة النتيجة)
async function syncToOdoo(reqObj, user) {
  if (reqObj.category === "leave" && reqObj.extra?.from && reqObj.extra?.to) {
    const r = await runAction("leave.create", {
      from: reqObj.extra.from, to: reqObj.extra.to,
      leaveTypeId: reqObj.extra.leaveTypeId || 1, reason: reqObj.title,
    }, { user });
    return { model: "hr.leave", ...r.data };
  }
  // الطلبات المالية (سلفة/مصروف) → hr.expense عند الاعتماد
  if (reqObj.category === "finance" && reqObj.extra?.amount) {
    const r = await runAction("expense.create", {
      title: reqObj.title, amount: reqObj.extra.amount, productId: reqObj.extra.productId,
    }, { user });
    return r.data;
  }
  return null; // بقية الأنواع تبقى في الـ backend (خطابات/عهد/تعاميم…) أو تُضاف لاحقًا
}

router.post("/requests", async (req, res, next) => {
  try {
    const p = req.body || {};
    if (!p.service) throw badRequest("service مطلوب");
    // Odoo مصدر الحقيقة: في الوضع الحقيقي يُنشأ الطلب في Odoo؛ في الاختبار محليًا
    if (!isTestMode()) {
      const { data } = await runAction("request.create", p, { user: req.user });
      return res.status(201).json({ odooId: data.odooId, ...data });
    }
    const created = wf.createRequest({ user: req.user, payload: { ...p, idempotencyKey: undefined } });
    res.status(201).json({ odooId: created.id, ...created });
  } catch (e) { next(e); }
});

// أدوار مسموح لها بالاعتماد
const APPROVER_ROLES = ["manager", "hr", "finance", "it", "admin"];

// النطاق يُشتق من الدور: الموظف يرى طلباته فقط مهما أرسل في الاستعلام.
//   all   = كل طلبات المنشأة (موارد بشرية/أدمن فقط)
//   inbox = ما ينتظر إجراء صاحب الجلسة (كل الأدوار المعتمِدة)
function allowedScope(user, asked) {
  if (asked === "all") return ["hr", "admin"].includes(user.role) ? "all" : "mine";
  if (asked === "inbox") return APPROVER_ROLES.includes(user.role) ? "inbox" : "mine";
  return "mine";
}

// قراءة طلب مفرد: المعتمِد يفتح تفاصيل ما يعتمده.
// ⚠️ لا تُستخدم allowedScope هنا — تضييقها يمنع المدير من فتح طلب موظفه.
function readScope(user) {
  return APPROVER_ROLES.includes(user.role) ? "all" : "mine";
}

// ---------------------------------------------------------------------------
// فرض المرحلة على الخادم قبل تمرير الاعتماد إلى Odoo.
//   ⚠️ Odoo ينفّذ كل الاعتمادات بحساب الخدمة الواحد، و_can_act_current_stage
//   هناك تبدأ بـ (إن كان أدمن → اسمح) — فحساب الخدمة يتجاوزها دائمًا.
//   ⇒ هذا هو الحارس الحقيقي الوحيد. وصندوق الوارد نفسه مصدر الصلاحية:
//   ما لا يظهر في inbox لا يجوز اعتماده.
// ---------------------------------------------------------------------------
async function assertCanAct(user, id, verb = "الاعتماد") {
  if (!APPROVER_ROLES.includes(user.role)) throw forbidden(`لا تملك صلاحية ${verb}`);
  if (user.role === "admin") return;
  const { data } = await runAction("request.list", { scope: "inbox" }, { user });
  const rec = (data?.records || []).find(
    (x) => String(x.id) === String(id) || x.name === String(id));
  if (!rec) throw forbidden("هذا الطلب ليس ضمن الطلبات التي تنتظر إجراءك");
  const flow = FLOW[rec.category] || FLOW.general;
  // state يحمل اسم المرحلة بعد أول اعتماد، و"submitted" تعني المرحلة الأولى
  const stage = rec.state === "submitted" ? flow[0] : rec.state;
  if (stage === "manager") {
    if (user.role !== "manager") throw forbidden("هذا الطلب بانتظار المدير المباشر");
    if (String(rec.empId) === "E" + user.odooEmployeeId) throw forbidden("لا يمكنك اعتماد طلبك بنفسك");
    return;
  }
  if (user.role !== stage) throw forbidden(`هذا الطلب في مرحلة «${stage}» وليست مرحلتك`);
}

router.get("/requests", async (req, res, next) => {
  try {
    const scope = allowedScope(req.user, req.query.scope);
    if (!isTestMode()) {
      const { data } = await runAction("request.list", { scope }, { user: req.user });
      return res.json(data);
    }
    res.json({ records: wf.listRequests(req.user, scope) });
  } catch (e) { next(e); }
});

router.get("/requests/:id", async (req, res, next) => {
  try {
    // Odoo مصدر الحقيقة: اقرأ منه أولًا (يقبل رقم Odoo أو رقم الطلب النصي)
    if (!isTestMode()) {
      const { data } = await runAction("request.read",
        { id: req.params.id, scope: readScope(req.user) },
        { user: req.user });
      if (data) return res.json(data);
    }
    const r = wf.getRequest(req.params.id);
    if (!r) throw notFound("الطلب غير موجود");
    res.json(r);
  } catch (e) { next(e); }
});

router.post("/requests/:id/approve", async (req, res, next) => {
  try {
    if (!isTestMode()) {
      await assertCanAct(req.user, req.params.id, "الاعتماد");
      const { data } = await runAction("request.approve", { id: Number(req.params.id) }, { user: req.user });
      return res.json(data);
    }
    const r = await wf.approveRequest({
      user: req.user, id: req.params.id, note: req.body?.note || "",
      onSyncToOdoo: (obj) => syncToOdoo(obj, req.user),
    });
    res.json(r);
  } catch (e) { next(e); }
});

router.post("/requests/:id/reject", async (req, res, next) => {
  try {
    if (!isTestMode()) {
      await assertCanAct(req.user, req.params.id, "الرفض");
      const { data } = await runAction("request.reject", { id: Number(req.params.id) }, { user: req.user });
      return res.json(data);
    }
    res.json(wf.rejectRequest({ user: req.user, id: req.params.id, note: req.body?.note || "" }));
  } catch (e) { next(e); }
});

router.post("/requests/:id/comment", (req, res, next) => {
  try {
    if (!req.body?.text) throw badRequest("text مطلوب");
    res.json(wf.commentRequest({ user: req.user, id: req.params.id, text: req.body.text }));
  } catch (e) { next(e); }
});

router.post("/requests/:id/cancel", (req, res, next) => {
  try { res.json(wf.cancelRequest({ user: req.user, id: req.params.id })); }
  catch (e) { next(e); }
});

// توافق updateRequest("model", id, values) — تحديث عام على الطلب المحلي
router.patch("/requests/:model/:id", (req, res, next) => {
  try {
    const r = wf.getRequest(req.params.id);
    if (!r) throw notFound("الطلب غير موجود");
    // تحديث آمن للحقول المسموحة فقط
    const values = req.body?.values || {};
    const allowed = ["title", "desc", "priority", "extra"];
    const patch = {};
    for (const k of allowed) if (k in values) patch[k] = values[k];
    res.json({ odooId: req.params.id, ...patch });
  } catch (e) { next(e); }
});

export default router;
