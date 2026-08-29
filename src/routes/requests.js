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
import { runAction, flowFor, producesLetter, managerStageIsVacant, stageRoleIsVacant, SIGN_ON_EMPLOYEE_STAGE } from "../odooActions.js";
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
  // صندوق الوارد مفتوح لكل دور: النطاق في odooActions هو الحارس، وهو يضع
  // في وارد الموظف العادي شيئًا واحدًا — مخالصته حين تبلغ مرحلة إقراره.
  if (asked === "inbox") return "inbox";
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
async function assertCanAct(user, id, verb = "الاعتماد", expectStage = null) {
  // المرحلة تُقرأ من الطلب نفسه لا من صندوق وارد المستخدم. كانت تُستنتج من
  // الوارد، فمن ليس الطلب في وارده تصير مرحلته null — ثم يمرّ الأدمن بلا
  // فحص إطلاقًا. وبها اعتمد شخصٌ واحد المراحلَ الثلاث: مرحلته، ومرحلة
  // الإدارة المالية، وإقرار الموظف بنفسه.
  const { data: rec } = await runAction("request.stage", { id }, { user });
  const stage = rec.stage;

  // ⚠️ تحصينٌ ضد الضغط المتكرّر: الواجهة ترسل المرحلة التي عرضتها، فإن كان
  // الطلب قد تحرّك بينهما رُدَّ الطلب. بدونه تُحوّل كل ضغطةٍ مرحلةً كاملة،
  // ويعبر الطلبُ مساره في ثوانٍ بيدٍ واحدة.
  if (expectStage != null && String(expectStage) !== String(rec.stageIndex))
    throw badRequest("تحرّك الطلب منذ أن فُتحت الشاشة — حدّثها وأعد المحاولة.");

  if (stage === "employee") {
    // إقرارٌ شخصي لا ينوب فيه أحد عن صاحبه — ولا الأدمن. وهو توقيعُ إبراء
    // ذمّة: من يوقّعه عن غيره يُسقط حقًّا ليس له.
    if (rec.empId && rec.empId === "E" + user.odooEmployeeId) return;
    throw forbidden("هذه المرحلة إقرارٌ شخصي لصاحب الطلب وحده");
  }

  if (!APPROVER_ROLES.includes(user.role)) throw forbidden(`لا تملك صلاحية ${verb}`);
  // ⚠️ كان هنا «إن كان أدمن فاسمح» — تجاوزٌ لكل ما تحته. والأدمن دورٌ تقنيّ
  // لا صاحبُ كل مرحلة: مرورُه من مرحلة الإدارة المالية يعني اعتمادَ مبلغٍ
  // بلا مراجعة من يملكها. فصار يخضع لقواعد الموارد البشرية نفسها: مرحلته
  // أو مرحلةٌ لا صاحب لها.
  if (stage === "manager") {
    if (user.role === "manager") {
      if (String(rec.empId) === "E" + user.odooEmployeeId) throw forbidden("لا يمكنك اعتماد طلبك بنفسك");
      return;
    }
    // مرحلةٌ بلا صاحب (الموظف بلا مدير، أو مديره بلا حساب يعتمد) تحبس الطلب
    // إلى الأبد: صاحبه لا يعتمد لنفسه وغيره ليست مرحلته. الموارد البشرية
    // والإدارة يفكّان الاحتباس — وهما من يقع عليهما البديل تنظيميًّا.
    if (["hr", "admin"].includes(user.role) && await managerStageIsVacant(rec.empId)) return;
    throw forbidden("هذا الطلب بانتظار المدير المباشر");
  }
  if (user.role !== stage) {
    // مرحلةٌ لا يحمل دورَها أحد (لا مستخدم مالية مثلًا) تحبس الطلب كما
    // تحبسه مرحلة المدير الشاغرة — والموارد البشرية والإدارة يفكّانها.
    if (["hr", "admin"].includes(user.role) && await stageRoleIsVacant(stage)) return;
    throw forbidden(`هذا الطلب في مرحلة «${stage}» وليست مرحلتك`);
  }
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

// ---------------------------------------------------------------------------
// «الاعتماد يوقّع»: طلبُ خطابٍ أو شهادةٍ يصدر مستندًا رسميًّا باسم المعتمِد،
// والأدون يطبع توقيعه المحفوظ لحظةَ إصدار المستند. فالاعتماد بلا توقيع محفوظ
// يُخرج ورقةً بسطر توقيع فارغ لا تنفع الموظف — ومن ثمّ يُمنع.
// ---------------------------------------------------------------------------
async function assertSignedIfLetter(user, id) {
  const { data } = await runAction("request.read", { id, scope: "all" }, { user });
  if (!producesLetter(data)) return;
  const { data: sig } = await runAction("me.signature.read", {}, { user });
  if (!sig?.hasSignature)
    throw badRequest("هذا الطلب يُصدر خطابًا رسميًّا فلا يُعتمد بلا توقيع. "
      + "ارسم توقيعك أو ارفع صورته من شاشة الاعتماد، ثم أعد المحاولة.");
}

// ---------------------------------------------------------------------------
// المخالصة يوقّعها العامل بيده. وضغطةُ زرٍّ في تطبيق ليست توقيعًا: المخالصة
// إبراءُ ذمّة، وما يُحتجّ به عند الخلاف هو الخطّ لا سجلّ نقرة. فمرحلةُ العامل
// فيها لا تمرّ إلا بتوقيع محفوظ باسمه.
// ---------------------------------------------------------------------------
async function assertSignedIfSettlement(user, id) {
  const { data } = await runAction("request.read", { id, scope: "all" }, { user });
  if (!data) return;
  const flow = flowFor(data.category, data.service);
  const stage = data.state === "submitted" ? flow[0] : data.state;
  if (stage !== "employee") return;
  if (!SIGN_ON_EMPLOYEE_STAGE.has(String(data.service || "").trim())) return;
  const { data: sig } = await runAction("me.signature.read", {}, { user });
  if (!sig?.hasSignature)
    throw badRequest("المخالصة إبراءُ ذمّة فلا تُقَرّ بلا توقيعك. "
      + "ارسم توقيعك أو ارفع صورته، ثم أعد المحاولة.");
}

router.post("/requests/:id/approve", async (req, res, next) => {
  try {
    if (!isTestMode()) {
      await assertCanAct(req.user, req.params.id, "الاعتماد",
        req.body?.expectStage);
      // التوقيع يُحفظ قبل الاعتماد لا بعده: الخطاب يُولَّد داخل الاعتماد نفسه،
      // فتوقيعٌ يُحفظ بعده يأتي متأخرًا عن المستند الذي صدر بلا توقيع.
      if (req.body?.signature)
        await runAction("me.signature", { image: req.body.signature }, { user: req.user });
      await assertSignedIfLetter(req.user, req.params.id);
      await assertSignedIfSettlement(req.user, req.params.id);
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

// التعليق يذهب إلى محادثة الطلب في Odoo فيصل متابعيه، لا إلى ذاكرة المتصفح
// GET /api/requests/:id/letter → مستند الطلب الصادر (المخالصة/الخطاب) PDF
router.get("/requests/:id/letter", async (req, res, next) => {
  try {
    const { data } = await runAction("request.letterPdf",
      { id: req.params.id }, { user: req.user });
    const buf = Buffer.from(data.base64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(data.name)}`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر فتح المستند"));
  }
});

// تسجيل مبلغ المستحقات — الموارد البشرية تحسبه قبل تحويل المخالصة للمالية
router.post("/requests/:id/amount", async (req, res, next) => {
  try {
    if (isTestMode()) throw badRequest("غير متاح في وضع الاختبار");
    await assertCanAct(req.user, req.params.id, "تسجيل المبلغ");
    const { data } = await runAction("request.setAmount",
      { id: Number(req.params.id), amount: req.body?.amount }, { user: req.user });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر تسجيل المبلغ"));
  }
});

router.post("/requests/:id/comment", async (req, res, next) => {
  try {
    if (!req.body?.text) throw badRequest("text مطلوب");
    if (!isTestMode()) {
      const { data } = await runAction("request.comment",
        { id: req.params.id, text: req.body.text }, { user: req.user });
      return res.json(data);
    }
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
