// ===========================================================================
// routes/odoo.js — عمليات Odoo + إعداد الاتصال
//   POST /api/odoo/connect  { serverUrl?, database?, login, password }
//     - لو أُرسلت بيانات خادم كاملة → تُختبر وتُحفظ (إعداد أولي من الواجهة)
//     - لو أُرسل login/password فقط → يُصادَق على أودو ببيانات الخادم المحفوظة
//   POST /api/odoo/test     فحص اتصال
//   POST /api/odoo          { action, params }   (محمي)
//   POST /api/read/:model   قراءة عامة (محمي)
// ===========================================================================
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAction } from "../odooActions.js";
import * as odoo from "../lib/odooClient.js";
import { isTestMode, setTestMode } from "../lib/settings.js";
import { saveCreds, maskCreds, getEffectiveCreds, hasStoredCreds } from "../lib/odooCreds.js";
import { signToken, setSessionCookie } from "../lib/jwt.js";
import { FX_VERSION } from "../fixtures.js";

const router = Router();

// فحص اتصال (عام)
router.post("/odoo/test", async (req, res) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const u = serverUrl || url;
    if (u && (login || user) && password) {
      const r = await odoo.testCreds({ url: u, db: database || db, user: login || user, password });
      return res.json({ ok: true, odooVersion: r.odooVersion });
    }
    if (isTestMode()) return res.json({ ok: true, odooVersion: FX_VERSION, testMode: true });
    const r = await odoo.testConnection();
    res.json({ ok: true, odooVersion: r.odooVersion });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ربط أودو / تسجيل دخول عبر أودو
router.post("/odoo/connect", async (req, res) => {
  try {
    const { serverUrl, url, database, db, login, user, password } = req.body || {};
    const sentUrl = serverUrl || url;
    const sentDb = database || db;
    const userName = login || user;

    if (!userName || !password) {
      return res.status(400).json({ ok: false, error: "يرجى إدخال المستخدم وكلمة المرور" });
    }

    // حدّد بيانات الخادم: المُرسَلة من الواجهة أولًا، وإلا المحفوظة على الخادم
    const stored = getEffectiveCreds();
    const finalUrl = sentUrl || stored.url;
    const finalDb = sentDb || stored.db;

    if (!finalUrl || !finalDb) {
      return res.status(400).json({
        ok: false,
        error: "بيانات خادم أودو غير مضبوطة. اطلب من مدير النظام ضبط رابط الخادم وقاعدة البيانات أولًا.",
      });
    }

    // اختبر البيانات فعليًا على أودو
    const r = await odoo.testCreds({ url: finalUrl, db: finalDb, user: userName, password });

    // احفظ بيانات الاتصال (تصبح مصدر الاتصال الفعّال) واطفِ وضع الاختبار
    saveCreds({ url: finalUrl, db: finalDb, user: userName, password });
    setTestMode(false);
    odoo.clearUidCache();

    // افتح جلسة للمستخدم (JWT cookie) — دوره يُحدَّد لاحقًا من أودو
    const token = signToken({ sub: `odoo:${userName}`, role: "employee", login: userName });
    setSessionCookie(res, token);

    res.json({ ok: true, uid: r.uid, odooVersion: r.odooVersion, connection: maskCreds() });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// محمي بتسجيل الدخول
router.use(requireAuth);

// ---------------------------------------------------------------------------
// إجراءات Odoo العامة — بقائمة سماح
//   كان هذا المسار ينفّذ أي action بأي معاملات لأي موظف مسجّل، فيتيح مثلًا
//   request.approve لاعتماد طلب الغير أو request.list بـ scope=all لقراءة
//   طلبات الشركة كلها — متجاوزًا كل فحوص الأدوار في المسارات المتخصّصة.
//   الحل: قائمة إجراءات قراءة آمنة للجميع، وقائمة أوسع للأدوار الإدارية،
//   ومعاملات الهوية (scope/employeeId) تُحقن من الجلسة لا من العميل.
// ---------------------------------------------------------------------------
const SAFE_ACTIONS = new Set([
  "connection.test", "employee.me", "leave.balance", "leave.list", "leave.current",
  "leaveType.list", "attendance.log", "announcement.list",
  "request.list", "request.read", "approval.available",
]);
// إجراءات إدارية إضافية (تتطلب دورًا إداريًا)
const ADMIN_ACTIONS = new Set([...SAFE_ACTIONS,
  "request.create", "request.approve", "request.reject",
  "attachment.upload", "leave.create", "expense.create", "approval.create",
  "attendance.punch",
]);
const ADMIN_ROLES = ["admin", "hr"];
// معاملات لا يُسمح للعميل بتحديدها إطلاقًا — تُشتق من الجلسة
const CLIENT_FORBIDDEN_PARAMS = ["employeeId", "scope"];

router.post("/odoo", async (req, res, next) => {
  try {
    const { action, params } = req.body || {};
    if (!action) return res.status(400).json({ error: "action مطلوب" });
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    const allowed = isAdmin ? ADMIN_ACTIONS : SAFE_ACTIONS;
    if (!allowed.has(action)) {
      return res.status(403).json({ error: `الإجراء «${action}» غير مسموح لدورك` });
    }
    // نظّف معاملات الهوية؛ الأدوار الإدارية وحدها يمكنها طلب scope موسّع
    const clean = { ...(params || {}) };
    for (const k of CLIENT_FORBIDDEN_PARAMS) delete clean[k];
    if (isAdmin && params?.scope === "all") clean.scope = "all";
    const result = await runAction(action, clean, { user: req.user });
    res.json(result);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// قراءة عامة من Odoo — بقائمة موديلات وحقول مسموحة وفلتر ملكية إجباري
//   كان يقبل أي موديل وأي domain بصلاحيات حساب الخدمة، فيتيح قراءة
//   hr.contract (الرواتب) أو ir.config_parameter (مفتاح التكامل).
// ---------------------------------------------------------------------------
const READABLE_MODELS = {
  "hr.leave": {
    fields: ["holiday_status_id", "request_date_from", "request_date_to",
      "number_of_days", "state", "manager_id", "employee_id"],
    // الموظف يرى إجازاته فقط؛ الأدوار الإدارية ترى الكل
    ownDomain: (user) => [["employee_id", "=", user.odooEmployeeId]],
  },
  "hr.leave.type": { fields: ["name"], ownDomain: () => [] },
  "hr.attendance": {
    fields: ["check_in", "check_out", "employee_id"],
    ownDomain: (user) => [["employee_id", "=", user.odooEmployeeId]],
  },
};

router.post("/read/:model", async (req, res, next) => {
  try {
    const { model } = req.params;
    const spec = READABLE_MODELS[model];
    if (!spec) return res.status(403).json({ error: `القراءة من «${model}» غير مسموحة` });
    const { domain = [], fields = [], limit, order, offset } = req.body || {};
    if (isTestMode()) return res.json({ records: [] });

    // hr.leave: تمرّ عبر الـ action لتُحوَّل السجلات لشكل الواجهة
    //   (from/to/type/days/status). كانت تُعاد خامًا من أودو
    //   (request_date_from/state/holiday_status_id) فتقرأها شاشة سجل
    //   الإجازات على أنها فارغة — ولهذا كان السجل لا يظهر إطلاقًا.
    if (model === "hr.leave") {
      const onlyApproved = JSON.stringify(domain || []).includes('"validate"');
      const { data } = await runAction("leave.list", { onlyApproved }, { user: req.user });
      return res.json({ records: data.records || [] });
    }

    // فلتر الملكية يُفرض على الخادم دائمًا (الأدوار الإدارية ترى الكل)
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    const own = isAdmin ? [] : spec.ownDomain(req.user);
    if (!isAdmin && !req.user.odooEmployeeId) return res.json({ records: [] });

    // من domain العميل نقبل فقط الشروط التي لا تمسّ هوية الموظف
    const safeClient = (Array.isArray(domain) ? domain : []).filter(
      (c) => Array.isArray(c) && typeof c[0] === "string" && c[0] !== "employee_id"
    );
    const askFields = (Array.isArray(fields) ? fields : []).filter((f) => spec.fields.includes(f));

    const records = await odoo.searchRead(model, [...own, ...safeClient],
      askFields.length ? askFields : spec.fields,
      { limit: Math.min(Number(limit) || 200, 500), order, offset });
    res.json({ records });
  } catch (e) { next(e); }
});

export default router;
