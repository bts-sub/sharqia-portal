// ===========================================================================
// routes/discipline.js — المخالفات والجزاءات
//   GET  /api/discipline/violations   لائحة المخالفات (لمن يرفعها)
//   GET  /api/discipline/employees    من يجوز رفع مخالفة عليه
//   GET  /api/discipline/mine         جزاءاتي — ما خرج من المسودة
//   GET  /api/discipline/team         جزاءات فريقي (مدير/موارد بشرية)
//   POST /api/discipline              رفع مخالفة { employeeId, violationId, … }
//   POST /api/discipline/:id/statement { text, grievance }
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import { badRequest, forbidden } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

// من يرفع المخالفة: المدير المباشر والموارد البشرية والإدارة. والعامل لا
// يرفع على نفسه ولا على غيره — الجزاء سلطةٌ لا يملكها كل أحد.
const FILER_ROLES = ["manager", "hr", "admin"];

router.get("/discipline/violations", async (req, res, next) => {
  try {
    if (!FILER_ROLES.includes(req.user.role))
      throw forbidden("لائحة المخالفات لمن يرفعها");
    const { data } = await runAction("discipline.violations", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

// من يجوز رفع مخالفة عليه — يغذّي قائمة الاختيار في الشاشة
router.get("/discipline/employees", async (req, res, next) => {
  try {
    if (!FILER_ROLES.includes(req.user.role))
      throw forbidden("رفع المخالفات للمدير المباشر والموارد البشرية");
    const { data } = await runAction("discipline.employees", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/discipline/mine", async (req, res, next) => {
  try {
    const { data } = await runAction("discipline.mine", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/discipline/team", async (req, res, next) => {
  try {
    if (!FILER_ROLES.includes(req.user.role))
      throw forbidden("لا تملك صلاحية متابعة جزاءات غيرك");
    const { data } = await runAction("discipline.team", {}, { user: req.user });
    res.json(data);
  } catch (e) { next(e); }
});

router.post("/discipline", async (req, res, next) => {
  try {
    if (!FILER_ROLES.includes(req.user.role))
      throw forbidden("رفع المخالفات للمدير المباشر والموارد البشرية");
    const b = req.body || {};
    if (!b.employeeId || !b.violationId)
      throw badRequest("الموظف والمخالفة مطلوبان");
    // لا يرفع أحدٌ مخالفةً على نفسه: خصمٌ يوقّعه صاحبه على نفسه ليس جزاءً
    if (String(b.employeeId) === String(req.user.odooEmployeeId))
      throw badRequest("لا تُرفع مخالفة على نفسك");
    const { data } = await runAction("discipline.create", b, { user: req.user });
    res.status(201).json(data);
  } catch (e) {
    // أخطاء أودو هنا أسبابٌ يفهمها من يرفع — تجاوزُ نافذة الثلاثين يومًا،
    // أو خروج الموظف عن نطاقه. تُعاد 400 برسالتها لا 500 صامتة.
    next(e?.status ? e : badRequest(e?.message || "تعذّر رفع المخالفة"));
  }
});

router.post("/discipline/:id/statement", async (req, res, next) => {
  try {
    const { data } = await runAction("discipline.statement", {
      id: req.params.id, text: req.body?.text,
      grievance: !!req.body?.grievance,
    }, { user: req.user });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر تسجيل أقوالك"));
  }
});

// GET /api/discipline/:id/pdf → محضر التحقيق وقرار الجزاء
router.get("/discipline/:id/pdf", async (req, res, next) => {
  try {
    const { data } = await runAction("discipline.pdf",
      { id: req.params.id }, { user: req.user });
    const buf = Buffer.from(data.base64, "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(data.name)}`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر فتح المحضر"));
  }
});

// اعتماد الجزاء ثم تنفيذه — للموارد البشرية، وأودو يفرض سقوف المواد 69/71/72
router.post("/discipline/:id/decide", async (req, res, next) => {
  try {
    if (!["hr", "admin"].includes(req.user.role))
      throw forbidden("اعتماد الجزاء للموارد البشرية");
    const { data } = await runAction("discipline.decide",
      { id: req.params.id, apply: !!req.body?.apply }, { user: req.user });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر إتمام الإجراء"));
  }
});

// توقيع المحضر. الطرف يُستنتج على الخادم من صاحب المخالفة ودور الموقّع،
// فلا يقول العميل من هو.
router.post("/discipline/:id/sign", async (req, res, next) => {
  try {
    const { data } = await runAction("discipline.sign",
      { id: req.params.id, image: req.body?.image }, { user: req.user });
    res.json(data);
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر حفظ التوقيع"));
  }
});

export default router;
