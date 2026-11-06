// ===========================================================================
// routes/schedule.js — تبويب «جدولي»: المهامّ والاجتماعات
//   GET   /api/schedule/tasks            مهامّي
//   GET   /api/schedule/tasks/dept       مهامّ قسمي (للمدير) + أقسامي
//   GET   /api/schedule/team             موظّفو قسمي وعددُ مهامِّ كلٍّ
//   POST  /api/schedule/tasks            { name, departmentId?, employeeId?,
//                                          description?, deadline?, priority? }
//   POST  /api/schedule/tasks/:id/assign { employeeId }
//   POST  /api/schedule/tasks/:id/move   { to: doing|review }
//   POST  /api/schedule/tasks/:id/decide { approve } أو { note }
//   GET   /api/schedule/meetings         اجتماعاتي
//   POST  /api/schedule/meetings/slots   { employeeIds, from, to, minutes }
//   POST  /api/schedule/meetings         { title, start, stop, mode,
//                                          employeeIds, place?, note? }
//   POST  /api/schedule/meetings/:id/respond { accept }
//
// ⚠️ الصلاحيةُ تُفحص في الإجراء لا هنا: المسارُ بابٌ، والحارسُ عند
//    المورد — فلا يُنسى عند إضافة بابٍ ثانٍ إلى الشيء نفسِه.
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { badRequest } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

// ─────────────────────────── المهامّ ───────────────────────────
router.get("/schedule/tasks", async (req, res, next) => {
  try {
    const { data } = await runAction("task.mine", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/schedule/tasks/dept", async (req, res, next) => {
  try {
    const { data } = await runAction("task.dept", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/schedule/team", async (req, res, next) => {
  try {
    const { data } = await runAction("task.team", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/tasks", async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!String(name || "").trim()) throw badRequest("اكتب عنوانَ المهمّة");
    const { data } = await runAction("task.create", req.body || {},
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/tasks/:id/assign", async (req, res, next) => {
  try {
    const { data } = await runAction("task.assign",
      { id: req.params.id, employeeId: (req.body || {}).employeeId },
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/tasks/:id/move", async (req, res, next) => {
  try {
    const { data } = await runAction("task.move",
      { id: req.params.id, to: (req.body || {}).to }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/tasks/:id/decide", async (req, res, next) => {
  try {
    const b = req.body || {};
    const { data } = await runAction("task.decide",
      { id: req.params.id, approve: !!b.approve, note: b.note },
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// ────────────────────────── الاجتماعات ──────────────────────────
router.get("/schedule/meetings", async (req, res, next) => {
  try {
    const { data } = await runAction("meeting.mine",
      { past: req.query.past === "1" }, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/meetings/slots", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.from || !b.to) throw badRequest("حدّد المدى");
    const { data } = await runAction("meeting.slots", b, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/meetings", async (req, res, next) => {
  try {
    const { data } = await runAction("meeting.create", req.body || {},
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/schedule/meetings/:id/respond", async (req, res, next) => {
  try {
    const { data } = await runAction("meeting.respond",
      { id: req.params.id, accept: !!(req.body || {}).accept },
      { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

export default router;
