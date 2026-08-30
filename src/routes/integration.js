// ===========================================================================
// routes/integration.js — جسر Odoo → backend (منصّة التحكّم في المستخدمين)
//   محمي بالمفتاح المشترك فقط (ليس بجلسة مستخدم). يستقبل إجراءات من موديول Odoo:
//   إنشاء/تحديث مستخدم، تفعيل/إيقاف، تصفير كلمة مرور، وإرسال إشعارات.
// ===========================================================================
import { Router } from "express";
import { requireIntegrationToken } from "../middleware/integrationAuth.js";
import { upsertFromOdoo, updateByLogin, setPassword, findByLogin } from "../lib/users.js";
import { insert } from "../lib/store.js";
import { badRequest, notFound, unauthorized } from "../lib/errors.js";
import * as odoo from "../lib/odooClient.js";
import { config } from "../config.js";
import { listUsers } from "../lib/users.js";

const router = Router();
router.use("/integration", requireIntegrationToken);

router.get("/integration/health", (req, res) => res.json({ ok: true, bridge: "up" }));

// إنشاء/تحديث مستخدم التطبيق وربطه بموظف Odoo
router.post("/integration/users/upsert", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.login) throw badRequest("login مطلوب");
    const user = await upsertFromOdoo(b);
    res.json({ ok: true, id: user.id, login: user.login });
  } catch (e) { next(e); }
});

// تفعيل/إيقاف مستخدم
router.post("/integration/users/:login/status", (req, res, next) => {
  try {
    const status = req.body?.status === "suspended" ? "suspended" : "active";
    const u = updateByLogin(req.params.login, { status });
    if (!u) throw notFound("المستخدم غير موجود");
    res.json({ ok: true, status });
  } catch (e) { next(e); }
});

// تصفير كلمة المرور (تأتي مؤقتة من Odoo — تُخزَّن bcrypt فقط)
router.post("/integration/users/:login/reset-password", async (req, res, next) => {
  try {
    if (!req.body?.password) throw badRequest("password مطلوب");
    if (!findByLogin(req.params.login)) throw notFound("المستخدم غير موجود");
    await setPassword(req.params.login, req.body.password);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// إرسال إشعار لمستخدم (يظهر في التطبيق عبر /api/notifications)
router.post("/integration/notifications", (req, res, next) => {
  try {
    const { login, title, body = "", type = "system", reqId = "",
      link = "", penaltyId = 0 } = req.body || {};
    if (!login || !title) throw badRequest("login و title مطلوبان");
    const user = findByLogin(login);
    if (!user) throw notFound("المستخدم غير موجود");
    const notif = insert("notifs", {
      id: Date.now() + Math.floor(Math.random() * 1000),
      userId: user.id, type, title, body, read: false,
      // reqId = رقم الطلب النصّي؛ التطبيق يفتح تفاصيل الطلب عند الضغط عليه.
      // بدونه يصل الإشعار بلا رابط فلا يفتح شيئًا.
      ...(reqId ? { reqId } : {}),
      // link = الشاشة التي يفتحها الضغط على الإشعار، وpenaltyId المخالفة
      // بعينها. تُخزَّن فقط حين تصل، فلا تتضخّم إشعارات الطلبات بمفاتيح فارغة.
      ...(link ? { link } : {}),
      ...(penaltyId ? { penaltyId: Number(penaltyId) } : {}),
      at: new Date().toISOString(), source: "odoo",
    });
    res.json({ ok: true, id: notif.id });
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// استقبال بصمات أجهزة Virdi من وكيل UNIS → Odoo (hr.attendance.raw)
//   وكيلٌ على جهاز UNIS يقرأ الجديد من قاعدته ويرسله هنا. البوابة تكتبه في
//   Odoo بحساب الخدمة نفسه الذي تعمل به — فلا يحتاج الوكيلُ حسابَ Odoo ولا
//   يُوضع مفتاحٌ على جهاز العميل. الدالة idempotent: إعادة الإرسال created=0.
// ---------------------------------------------------------------------------
function requireAttendanceToken(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  // يُقبل المفتاح المخصّص للبصمة، أو مفتاح التكامل العام (بديلٌ حتى يُضبط
  // المخصّص). فارغٌ مقابل فارغ لا يمرّ.
  const ok = (config.attendanceToken && token === config.attendanceToken)
    || (config.integrationToken && token === config.integrationToken);
  if (!ok) return next(unauthorized("مفتاح بصمة غير صالح"));
  next();
}

router.post("/device/punches", requireAttendanceToken, async (req, res, next) => {
  try {
    const punches = Array.isArray(req.body?.punches) ? req.body.punches : null;
    if (!punches) throw badRequest("punches مصفوفة مطلوبة");
    if (punches.length > 1000) throw badRequest("الدفعة كبيرة — 1000 بصمة كحدٍّ أقصى للنداء");
    // كل بصمة لا بدّ لها من مفتاح فريد؛ ما دونه لا يُميَّز فيتكرّر.
    const clean = punches.filter((p) => p && p.unique_key);
    if (!clean.length) throw badRequest("لا بصمة صالحة (unique_key مطلوب لكلٍّ)");
    // flagChanges يفعّله المسحُ الرقابيّ فقط: يوسم البصمة الرجعية التاريخ.
    const flagChanges = req.body?.flagChanges === true;
    const result = await odoo.execKw(
      "hr.attendance.raw", "import_punches", [clean, flagChanges]);
    // إشعار أصحاب البصمات اللحظية في التطبيق — مطابَقةٌ لموظفٍ له حساب فقط.
    try {
      const notify = Array.isArray(result?.notify) ? result.notify : [];
      if (notify.length) {
        const byEmp = new Map();
        for (const u of listUsers()) {
          if (u.odooEmployeeId != null) byEmp.set(Number(u.odooEmployeeId), u);
        }
        for (const n of notify) {
          const u = byEmp.get(Number(n.employee_id));
          if (!u || u.status !== "active") continue;
          const kind = n.direction === "out" ? "انصراف" : "حضور";
          insert("notifs", {
            id: Date.now() + Math.floor(Math.random() * 100000),
            userId: u.id, type: "system",
            title: `تم تسجيل بصمة ${kind}`,
            body: `سجّلت بصمة ${kind} الساعة ${n.punch_hm}`
              + (n.device_name ? ` — ${n.device_name}` : ""),
            read: false, at: new Date().toISOString(), source: "device",
          });
        }
      }
    } catch (e) { console.warn("⚠️ تعذّر إرسال إشعارات البصمة:", e.message); }
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر استقبال البصمات"));
  }
});

// تنزيل سكريبت الوكيل نفسه — ليُثبَّت على جهاز UNIS بأمرٍ قصير بدل لصق مئة سطر.
// محميٌّ بمفتاح البصمة (السكريبت يحمل المفتاح، فلا يُخدَم مكشوفًا).
router.get("/device/agent", requireAttendanceToken, async (req, res, next) => {
  try {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const p = join(here, "..", "..", "assets", "unis_agent.ps1");
    res.type("text/plain; charset=utf-8").send(readFileSync(p, "utf8"));
  } catch (e) {
    next(badRequest("تعذّر تحميل الوكيل: " + (e?.message || "")));
  }
});

// المطابقة الرقابية: الوكيل يبعث كل مفاتيح البصمات الموجودة الآن على الجهاز في
// نافذةٍ زمنية، فيَكشف Odoo ما اختفى منها (حُذف أو عُدّل وقته). كشفُ التلاعب.
router.post("/device/audit", requireAttendanceToken, async (req, res, next) => {
  try {
    const { start, end } = req.body || {};
    const keys = Array.isArray(req.body?.keys) ? req.body.keys : null;
    if (!start || !end || !keys) throw badRequest("start و end و keys مطلوبة");
    if (keys.length > 200000) throw badRequest("النافذة كبيرة جدًّا");
    const result = await odoo.execKw(
      "hr.attendance.raw", "audit_reconcile", [start, end, keys]);
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر المسح الرقابي"));
  }
});

// روستر مستخدمي الأجهزة — مرّةً واحدة أو دوريًّا: يبني قائمة الأرقام بأسمائها
// ليربطها فريقُ الموارد البشرية بالموظفين من داخل Odoo.
router.post("/device/users", requireAttendanceToken, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.users) ? req.body.users : null;
    if (!rows) throw badRequest("users مصفوفة مطلوبة");
    if (rows.length > 20000) throw badRequest("الدفعة كبيرة جدًّا");
    const clean = rows.filter((u) => u && u.code);
    const result = await odoo.execKw(
      "attendance.device.user", "import_device_users", [clean]);
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e?.status ? e : badRequest(e?.message || "تعذّر استقبال الروستر"));
  }
});

export default router;
