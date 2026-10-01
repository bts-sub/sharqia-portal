// ===========================================================================
// certs.js — الشهادات المهنية للموظف (تُخزَّن عندنا، يديرها الموظف بنفسه).
//   GET    /api/me/certs            قائمة شهاداته (بلا محتوى الملفات)
//   GET    /api/me/certs/:id/file   يفتح مرفقَ شهادةٍ بعينها
//   POST   /api/me/certs            إضافة شهادة {name, dateKind, date, file}
//   DELETE /api/me/certs/:id        حذف شهادة
// لا اعتماد من Odoo — تخزينٌ ذاتيّ بسيط لكل موظف.
// ===========================================================================
import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { readAll, writeAll } from "../lib/store.js";
import * as odoo from "./../lib/odooClient.js";

const router = Router();
const KEY = "certs";
const MAX_FILE = 6_000_000; // ~4.5MB أصلية بعد base64

// أنواعٌ تُعرض في المتصفّح ولا تُنفَّذ فيه: الشهادةُ صورةٌ أو PDF، وما عداهما
// يُنزَّل ولا يُفتح — فملفٌّ يحمل HTML يُفتح في نطاقنا يقرأ جلسةَ صاحبه.
const VIEWABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

/** يفكّ وصلةَ data إلى نوعٍ وبايتات، أو يردّ فارغًا إن لم تكن وصلةً صالحة. */
function decodeDataUrl(raw) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(raw || ""));
  if (!m) return null;
  const type = (m[1] || "application/octet-stream").toLowerCase();
  try {
    const buf = m[2] ? Buffer.from(m[3], "base64")
                     : Buffer.from(decodeURIComponent(m[3]), "utf8");
    return buf.length ? { type, buf } : null;
  } catch { return null; }
}

// ⚠️ وتُرفع إلى بطاقة الموظف في أودو: كانت تبقى عندنا وحدنا — ملفٌّ على
// خادمنا لا تراه الموارد البشرية ولا يظهر في ملفّ صاحبه. يرفعها الموظفُ
// ظانًّا أنّه أبلغ، ولا أحدَ أُبلغ. وموضعُها «السيرة الذاتية» في بطاقته.
//
// وفشلُ الرفع لا يُسقط الحفظ عندنا: الشهادةُ محفوظةٌ ولو تعذّر أودو، ويُعاد
// دفعُها بإجراءٍ مستقلّ.
async function pushToOdoo(empId, rec) {
  if (!empId) return { ok: false, error: "لا موظف مرتبط بالحساب" };
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(rec.file || ""));
  const b64 = m && m[2] ? m[3] : "";
  const ext = ((m && m[1]) || "").split("/")[1] || "pdf";
  return odoo.execKw("hr.employee", "sharqia_add_certificate", [], {
    employee_id: Number(empId),
    name: rec.name,
    date: rec.date || false,
    date_kind: rec.dateKind || "expiry",
    file_b64: b64 || false,
    filename: `${rec.name}.${ext.replace("jpeg", "jpg")}`,
  });
}

router.use("/api/me/certs", requireAuth);

router.get("/api/me/certs", (req, res) => {
  // ⚠️ بلا محتوى الملفات: كانت القائمةُ تحمل كلَّ مرفقٍ كاملًا داخلها، فمن
  // له خمسُ شهاداتٍ تُنقل إليه عشرون ميجابايت ليقرأ خمسة أسماء — ومع كلّ
  // فتحةِ شاشة. والمحتوى يُطلب حين يُطلب.
  const mine = readAll(KEY)
    .filter((c) => c.userId === req.user.id)
    .map(({ file, ...rest }) => {
      const d = file ? decodeDataUrl(file) : null;
      return { ...rest, hasFile: !!d, fileType: d ? d.type : "", fileSize: d ? d.buf.length : 0 };
    });
  res.set("Cache-Control", "private, no-store");
  res.json({ records: mine });
});

// ⚠️ مسارٌ يفتح المرفق بدل وصلة data: المتصفّحاتُ تمنع الانتقالَ إلى
// data: في تبويبٍ جديد منذ سنوات، فكان الموظف يضغط «عرض» ولا يحدث شيء —
// لا رسالةَ خطأ ولا ملفّ. وهذا يردّه ملفًّا حقيقيًّا بنوعه.
router.get("/api/me/certs/:id/file", (req, res) => {
  const rec = readAll(KEY).find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!rec) return res.status(404).json({ error: "لا شهادة بهذا الرقم." });
  const d = rec.file ? decodeDataUrl(rec.file) : null;
  if (!d) return res.status(404).json({ error: "لا مرفق لهذه الشهادة." });
  const inline = VIEWABLE.has(d.type);
  const ext = (d.type.split("/")[1] || "bin").replace("jpeg", "jpg");
  const name = `${rec.name || "شهادة"}.${ext}`;
  res.setHeader("Content-Type", inline ? d.type : "application/octet-stream");
  res.setHeader("Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Content-Length", d.buf.length);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(d.buf);
});

router.post("/api/me/certs", async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const date = String(b.date || "").slice(0, 10);
  if (!name) return res.status(400).json({ error: "اسم الشهادة مطلوب." });
  if (!date) return res.status(400).json({ error: "تاريخ الشهادة مطلوب." });
  // ⚠️ المرفقُ إلزاميّ: شهادةٌ بلا صورتها سطرٌ يدّعيه صاحبُه ولا يُثبته،
  // ولا تُقبل في ملفٍّ ولا تُراجَع.
  const file = b.file ? String(b.file) : "";
  if (!file) return res.status(400).json({ error: "أرفق صورة الشهادة أو ملفها — المرفق إلزامي." });
  if (file.length > MAX_FILE) {
    return res.status(400).json({ error: "حجم ملف الشهادة كبير — الحد نحو 4.5 ميجابايت." });
  }
  const d = decodeDataUrl(file);
  if (!d) return res.status(400).json({ error: "تعذّرت قراءة الملف المرفق — أعد اختياره." });
  if (!VIEWABLE.has(d.type)) {
    return res.status(400).json({ error: "المرفق يكون صورة (PNG أو JPG) أو ملف PDF." });
  }
  const rec = {
    id: crypto.randomBytes(8).toString("hex"),
    userId: req.user.id,
    name: name.slice(0, 140),
    dateKind: b.dateKind === "issue" ? "issue" : "expiry",
    date,
    file,
    at: new Date().toISOString(),
  };
  const all = readAll(KEY);
  all.unshift(rec);
  writeAll(KEY, all);
  let odooOk = false;
  try {
    const r = await pushToOdoo(req.user?.odooEmployeeId, rec);
    odooOk = !!(r && r.ok);
    if (!odooOk) console.warn("⚠️ لم تُرفع الشهادة إلى أودو:", r && r.error);
  } catch (e) {
    console.warn("⚠️ تعذّر رفع الشهادة إلى أودو:", e.message);
  }
  res.json({ ok: true, id: rec.id, inOdoo: odooOk });
});

/** دفعُ ما لم يصل أودو — للشهادات المسجّلة قبل الربط أو التي تعثّر رفعُها. */
router.post("/api/me/certs/sync", async (req, res) => {
  const mine = readAll(KEY).filter((c) => c.userId === req.user.id);
  let done = 0, failed = 0;
  for (const rec of mine) {
    try {
      const r = await pushToOdoo(req.user?.odooEmployeeId, rec);
      if (r && r.ok) done++; else failed++;
    } catch { failed++; }
  }
  res.json({ ok: true, total: mine.length, done, failed });
});

router.delete("/api/me/certs/:id", (req, res) => {
  const all = readAll(KEY);
  const rest = all.filter((c) => !(c.id === req.params.id && c.userId === req.user.id));
  if (rest.length !== all.length) writeAll(KEY, rest);
  res.json({ ok: true, removed: all.length - rest.length });
});

export default router;
