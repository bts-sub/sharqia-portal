// ===========================================================================
// routes/mes.js — بوّابة تطبيق التصنيع (Sharqia MES) إلى أودو
//   POST /api/mes/login   { login, password } → حساب التطبيق { u, fullName, role, station }
//   GET  /api/mes/me      → الحساب نفسه لجلسةٍ قائمة
//   POST /api/mes/logout
//   POST /api/mes/call    { model, method, args, kwargs } → { result }
//
// لماذا عبر البوابة لا من المتصفح إلى أودو مباشرة: عمّالُ المصنع لا يملكون
// مستخدمي أودو (وكلُّ مستخدمٍ رخصةٌ مدفوعة)، لكنّهم يملكون حساب البوابة.
// فيدخلون به، ويُعرف دورهم من حقل «دور تطبيق التصنيع» (mes_role) على بطاقتهم،
// وتنفّذ البوابة طلباتهم بحساب الخدمة — محصورةً في نماذج التصنيع وحقولها،
// وفي ما يسمح به دورهم كتابةً. لا حذف إطلاقًا.
// ===========================================================================
import { Router } from "express";
import { findByLogin, verifyPassword, touchLastLogin } from "../lib/users.js";
import { signToken, setSessionCookie, clearSessionCookie } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { badRequest, unauthorized, forbidden } from "../lib/errors.js";
import { execKw, searchRead } from "../lib/odooClient.js";

const router = Router();

// ─────────────────────────── الحساب والدور ───────────────────────────
const ROLE_TTL_MS = 60 * 1000;
const roleCache = new Map();   // login → { at, account }

async function mesAccount(user, { force = false } = {}) {
  const hit = roleCache.get(user.login);
  if (!force && hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.account;
  let account = null;
  if (user.odooEmployeeId) {
    const [emp] = await searchRead("hr.employee", [["id", "=", Number(user.odooEmployeeId)]],
      ["name", "mes_role", "mes_station"], { limit: 1 });
    if (emp && emp.mes_role) {
      const name = emp.name || user.name || user.login;
      account = {
        u: user.login,
        employeeId: emp.id,
        fullName: { ar: name, en: name, ur: name, fr: name },
        role: emp.mes_role,
        station: emp.mes_station || null,
        odooLang: null,
      };
    }
  }
  // مدير نظام البوابة يدير التطبيق ولو لم يكن له بطاقة موظف (حساب admin
  // لا موظف خلفه) — وإلا لم يدخل أحدٌ ليبدأ الربط قبل توزيع الأدوار.
  if (!account && user.role === "admin") {
    const name = user.name || user.login;
    account = { u: user.login, employeeId: null, fullName: { ar: name, en: name, ur: name, fr: name },
      role: "admin", station: null, odooLang: null };
  }
  roleCache.set(user.login, { at: Date.now(), account });
  return account;
}

const NO_ROLE = "لا صلاحية لك على تطبيق التصنيع. تُمنح من «دور تطبيق التصنيع» في بطاقة الموظف بأودو.";

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) throw badRequest("يرجى إدخال اسم المستخدم وكلمة المرور");
    const user = findByLogin(login);
    const ok = user && user.status === "active" && (await verifyPassword(user, password));
    if (!ok) throw unauthorized("بيانات الدخول غير صحيحة");
    const account = await mesAccount(user, { force: true });
    if (!account) throw forbidden(NO_ROLE);
    touchLastLogin(user.id);
    setSessionCookie(res, signToken({ sub: user.id, role: user.role, login: user.login }));
    res.json({ ok: true, account });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// كل ما بعد هذا يحتاج جلسةً ودورًا في التطبيق.
router.use(requireAuth, async (req, res, next) => {
  try {
    req.mes = await mesAccount(req.user);
    if (!req.mes) throw forbidden(NO_ROLE);
    next();
  } catch (e) { next(e); }
});

router.get("/me", (req, res) => res.json({ account: req.mes }));

// ─────────────────────────── الصلاحيات ───────────────────────────
// نماذج أودو القياسية تُقرأ بحقولٍ محدّدة فقط: بطاقة الموظف فيها الراتب
// والهوية، وأوامر التصنيع فيها التكاليف — والتطبيق لا يحتاج شيئًا من ذلك.
const FIELDS = {
  "hr.employee": ["id", "name", "active", "mes_role", "mes_station", "mes_skill", "mes_shift",
    "mes_efficiency", "mes_attendance"],
  "mrp.workcenter": ["id", "name", "code", "active", "mes_type", "mes_department", "mes_capacity",
    "mes_std_time"],
  "product.product": ["id", "name", "default_code", "barcode", "product_tmpl_id",
    "product_template_attribute_value_ids"],
  "mrp.production": ["id", "name", "product_id", "product_qty", "qty_produced", "state",
    "date_start", "date_finished", "date_deadline", "origin", "mes_priority", "mes_route_ids"],
  "mrp.workorder": ["id", "name", "production_id", "workcenter_id", "state", "qty_produced",
    "qty_producing", "duration", "mes_route_id", "mes_status"],
};
const MES_MODELS = ["sharqia.mes.route", "sharqia.mes.route.point", "sharqia.mes.buffer",
  "sharqia.mes.template", "sharqia.mes.hanger", "sharqia.mes.defect", "sharqia.mes.qc.check",
  "sharqia.mes.announcement"];
const MODELS = new Set([...Object.keys(FIELDS), ...MES_MODELS]);

// من يكتب ماذا — على غرار صلاحيات الموديل في أودو (ir.model.access.csv).
const MANAGERS = ["pm", "plant", "admin"];
const WRITE = {
  "sharqia.mes.route.point": ["station", ...MANAGERS],
  "sharqia.mes.hanger": ["station", "store", ...MANAGERS],
  "sharqia.mes.defect": ["station", "qc", ...MANAGERS],
  "sharqia.mes.qc.check": ["station", "qc", ...MANAGERS],
  "sharqia.mes.buffer": ["store", ...MANAGERS],
  "sharqia.mes.route": MANAGERS,
  "sharqia.mes.template": MANAGERS,
  "sharqia.mes.announcement": MANAGERS,
  "mrp.workorder": ["station", "qc", ...MANAGERS],
  "mrp.production": MANAGERS,
  "mrp.workcenter": MANAGERS,
  "hr.employee": MANAGERS,
};
// ما يُكتب من النماذج القياسية: حقول التصنيع وحدها.
const WRITABLE_FIELDS = {
  "hr.employee": ["mes_station", "mes_skill", "mes_shift", "mes_efficiency", "mes_attendance"],
  "mrp.workorder": ["qty_produced", "qty_producing", "mes_status", "mes_route_id"],
  "mrp.workcenter": ["name", "code", "mes_type", "mes_department", "mes_capacity", "mes_std_time"],
  "mrp.production": ["product_id", "product_qty", "product_uom_id", "date_start", "date_deadline",
    "origin", "mes_priority"],
};
// أزرار أمر العمل. «إيقاف مؤقّت» اسمه في أودو 19 button_pending.
const BUTTONS = { button_start: "button_start", button_pending: "button_pending",
  button_pause: "button_pending", button_finish: "button_finish" };
const READ_METHODS = new Set(["search_read", "read", "search_count", "fields_get"]);

// لا يرى التطبيق من الموظفين إلا من يخصّ المصنع.
const EMPLOYEE_SCOPE = ["|", ["mes_role", "!=", false], ["mes_station", "!=", false]];

function allowedFields(model, requested) {
  const allow = FIELDS[model];
  if (!allow) return requested && requested.length ? requested : undefined;
  const pick = (requested && requested.length ? requested : allow).filter((f) => allow.includes(f));
  return pick.length ? pick : ["id"];
}

function checkValues(model, vals) {
  if (!vals || typeof vals !== "object" || Array.isArray(vals)) throw badRequest("قيم غير صالحة");
  const allow = WRITABLE_FIELDS[model];
  if (!allow) return vals;
  const bad = Object.keys(vals).filter((k) => !allow.includes(k));
  if (bad.length) throw forbidden(`لا يُسمح بتعديل: ${bad.join(", ")}`);
  return vals;
}

function ids(v) {
  const list = (Array.isArray(v) ? v : [v]).map(Number);
  if (!list.length || list.some((n) => !Number.isInteger(n) || n <= 0)) throw badRequest("معرّفات غير صالحة");
  return list;
}

router.post("/call", async (req, res, next) => {
  try {
    const { model, method } = req.body || {};
    const args = Array.isArray(req.body?.args) ? req.body.args : [];
    const kwargs = (req.body?.kwargs && typeof req.body.kwargs === "object") ? req.body.kwargs : {};
    if (!MODELS.has(model)) throw forbidden(`النموذج غير متاح للتطبيق: ${model}`);
    const role = req.mes.role;

    // ─── قراءة ───
    if (READ_METHODS.has(method)) {
      if (method === "fields_get") {
        return res.json({ result: await execKw(model, "fields_get", [], { attributes: ["string", "type", "selection", "relation"] }) });
      }
      if (method === "read") {
        const fields = allowedFields(model, args[1] || kwargs.fields);
        return res.json({ result: await execKw(model, "read", [ids(args[0])], fields ? { fields } : {}) });
      }
      let domain = Array.isArray(args[0]) ? args[0] : (Array.isArray(kwargs.domain) ? kwargs.domain : []);
      if (model === "hr.employee") domain = [...EMPLOYEE_SCOPE, ...domain];
      if (method === "search_count") {
        return res.json({ result: await execKw(model, "search_count", [domain]) });
      }
      const opts = { limit: Math.min(Number(kwargs.limit) || 0, 5000) || 5000 };
      if (kwargs.offset) opts.offset = Number(kwargs.offset) || 0;
      if (typeof kwargs.order === "string" && /^[\w\s,.]*$/.test(kwargs.order) && kwargs.order) opts.order = kwargs.order;
      const fields = allowedFields(model, kwargs.fields);
      if (fields) opts.fields = fields;
      return res.json({ result: await execKw(model, "search_read", [domain], opts) });
    }

    // ─── كتابة ───
    if (!(WRITE[model] || []).includes(role)) throw forbidden("دورك لا يسمح بهذا التعديل");
    let result;
    if (method === "create") {
      const vals = { ...checkValues(model, Array.isArray(args[0]) ? args[0][0] : args[0]) };
      // من أنشأ السجل يُكتب من الجلسة، لا مما يرسله الجهاز.
      if (model === "sharqia.mes.defect") vals.reported_by = req.mes.fullName.ar;
      if (model === "sharqia.mes.announcement") vals.created_by = req.mes.fullName.ar;
      result = await execKw(model, "create", [vals]);
    } else if (method === "write") {
      result = await execKw(model, "write", [ids(args[0]), checkValues(model, args[1])]);
    } else if (model === "mrp.workorder" && BUTTONS[method]) {
      result = await execKw(model, BUTTONS[method], [ids(args[0])]);
    } else {
      throw forbidden(`العملية غير متاحة: ${method}`);
    }
    console.log(JSON.stringify({ t: new Date().toISOString(), mes: method, model, u: req.mes.u, role }));
    res.json({ result: result ?? true });
  } catch (e) { next(e); }
});

export default router;
