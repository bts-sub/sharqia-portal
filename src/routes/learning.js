// ===========================================================================
// routes/learning.js — التدريب وتقييم الأداء
//   GET   /api/courses                    دورات الموظف وحالته فيها
//   GET   /api/courses/:id                دورة بدروسها وأسئلتها (بلا الإجابات)
//   POST  /api/courses/:id/progress       { lessonsDone }
//   POST  /api/courses/:id/submit         { answers: {qid: [optId,…]} }
//   GET   /api/appraisals                 تقييماتي المُعتمَدة
//   GET   /api/appraisals/team            بطاقات فريقي (للمدير/الموارد)
//   GET   /api/appraisals/:id             بطاقة بمعاييرها
//   POST  /api/appraisals/:id/save        { scores, strengths, improvements, note }
//   POST  /api/appraisals/:id/submit      اعتماد المدير
//   POST  /api/appraisals/:id/acknowledge { reply }
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

// ─────────────────────────── التدريب ───────────────────────────
router.get("/courses", async (req, res, next) => {
  try {
    const { data } = await runAction("course.list", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/courses/:id", async (req, res, next) => {
  try {
    const { data } = await runAction("course.read", { id: req.params.id },
      { user: req.user });
    if (!data) throw notFound("الدورة غير موجودة");
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/courses/:id/progress", async (req, res, next) => {
  try {
    const { data } = await runAction("course.progress",
      { id: req.params.id, lessonsDone: req.body?.lessonsDone },
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/courses/:id/submit", async (req, res, next) => {
  try {
    const answers = req.body?.answers;
    if (!answers || typeof answers !== "object")
      throw badRequest("answers مطلوبة");
    const { data } = await runAction("course.submit",
      { id: req.params.id, answers }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// ─────────────────────────── التقييم ───────────────────────────
// أدوار ترى بطاقات غيرها. الموظف العادي يرى تقييمه هو فقط، عبر /appraisals.
const APPRAISER_ROLES = ["manager", "hr", "admin"];

router.get("/appraisals", async (req, res, next) => {
  try {
    const { data } = await runAction("appraisal.mine", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/appraisals/team", async (req, res, next) => {
  try {
    if (!APPRAISER_ROLES.includes(req.user.role))
      throw forbidden("لا تملك صلاحية تقييم موظفين");
    const { data } = await runAction("appraisal.team",
      { state: req.query.state }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// حارس البطاقة. البطاقةُ إمّا بطاقتُك — فتقرأها وتُقرّ بها ولا تُعدّل درجاتها —
// وإمّا بطاقةُ مرؤوسك فتملأها وتعتمدها ولا تُقرّ عنه. وأي خلط بين الأمرين
// يُفقد التقييمَ معناه: مقيَّمٌ يرفع درجته، أو مديرٌ يوقّع نيابةً عن موظفه.
// ---------------------------------------------------------------------------
async function loadCard(user, id) {
  const { data } = await runAction("appraisal.read", { id }, { user });
  if (!data) throw notFound("التقييم غير موجود");
  const mine = String(data.employeeId) === String(user.odooEmployeeId);
  const canRate = APPRAISER_ROLES.includes(user.role) && !mine;
  return { card: data, mine, canRate };
}

router.get("/appraisals/:id", async (req, res, next) => {
  try {
    const { card, mine, canRate } = await loadCard(req.user, req.params.id);
    if (!mine && !canRate) throw forbidden("هذا التقييم ليس ضمن صلاحيتك");
    // المسوّدة ورقةُ عملٍ عند المدير لم تُقَل بعد — لا تُعرض لصاحبها
    if (mine && card.state === "draft") throw notFound("التقييم لم يصدر بعد");
    res.json({ ...card, canRate, mine });
  } catch (e) { next(e); }
});

router.post("/appraisals/:id/save", async (req, res, next) => {
  try {
    const { canRate, card } = await loadCard(req.user, req.params.id);
    if (!canRate) throw forbidden("التقييم يملؤه المدير المباشر");
    if (card.state !== "draft") throw badRequest("هذا التقييم اعتُمد ولا يُعدَّل");
    const { data } = await runAction("appraisal.save",
      { id: req.params.id, ...req.body }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/appraisals/:id/submit", async (req, res, next) => {
  try {
    const { canRate, card } = await loadCard(req.user, req.params.id);
    if (!canRate) throw forbidden("التقييم يعتمده المدير المباشر");
    if (card.state !== "draft") throw badRequest("هذا التقييم اعتُمد من قبل");
    const { data } = await runAction("appraisal.submit",
      { id: req.params.id, ...req.body }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/appraisals/:id/acknowledge", async (req, res, next) => {
  try {
    const { mine } = await loadCard(req.user, req.params.id);
    if (!mine) throw forbidden("الإقرار لصاحب التقييم وحده");
    const { data } = await runAction("appraisal.acknowledge",
      { id: req.params.id, reply: req.body?.reply }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
