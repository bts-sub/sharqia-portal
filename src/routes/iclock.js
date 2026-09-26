// ===========================================================================
// routes/iclock.js — مستقبِل ADMS/Push لأجهزة ZKTeco (بروتوكول iclock).
//
//   الفكرة: أجهزة البصمة (ZK Uface 800) موجودة داخل الشبكة المحلية، وأودو على
//   السحابة (Odoo.sh) لا يقدر أن يتصل بها مباشرة. فبدل السحب (PULL) نستخدم
//   الدفع (PUSH): الجهاز نفسه يفتح اتصالًا خارجيًّا ويرسل البصمات إلى سيرفرنا
//   العام، فيعبر NAT بلا فتح أي منفذ على الجهاز.
//
//   المسارات القياسية للبروتوكول (يطلبها الجهاز تلقائيًّا):
//     GET  /iclock/cdata?SN=..&options=all   → المصافحة: نُرجع إعدادات الجهاز
//     GET  /iclock/getrequest?SN=..          → استعلام الأوامر: لا أوامر الآن → OK
//     POST /iclock/cdata?SN=..&table=ATTLOG  → دفع البصمات (نصّ tab-separated)
//     POST /iclock/{devicecmd,fdata,edata}   → نتائج الأوامر/القوالب/الصور → OK
//
//   المرحلة 1 (هنا): نستقبل ونخزّن النبضات محليًّا للتأكد من وصولها.
//   المرحلة 2 (لاحقًا): مطابقة PIN→موظف وإنشاء hr.attendance.raw في أودو.
//
//   الأمان: المسار عام (الجهاز لا يصادِق)، لذا:
//     - ZK_ALLOWED_SN=SN1,SN2  → إن ضُبط نقبل هذه الأجهزة فقط (وإلا وضع اكتشاف).
//     - نردّ 200/OK دائمًا حتى للمرفوض كي لا نكشف المنطق للطرف المجهول.
// ===========================================================================
import { Router } from "express";
import express from "express";
import { readAll, writeAll } from "../lib/store.js";

const router = Router();
const KEY = "zkpunches";
const MAX = 5000; // نحتفظ بآخر 5000 نبضة في المخزن المحلي (المرحلة 2 تنقلها لأودو)

const ALLOW = (process.env.ZK_ALLOWED_SN || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const snAllowed = (sn) => ALLOW.length === 0 || ALLOW.includes(sn);
const DIAG_KEY = process.env.ZK_DIAG_KEY || "zkdiag";

const log = (...a) => console.log("🕒 ZK", ...a);

// جسم iclock نصّي (tab-separated) وليس JSON — نلتقطه خامًا كـ Buffer.
router.use("/iclock", express.raw({ type: "*/*", limit: "8mb" }));

// 1) المصافحة: الجهاز يطلب إعداداته عند الإقلاع/الاتصال.
router.get("/iclock/cdata", (req, res) => {
  const sn = String(req.query.SN || "");
  log("cdata GET (handshake) SN=", sn, "options=", req.query.options || "", "pushver=", req.query.pushver || "");
  // TimeZone=3 للسعودية (UTC+3)، Realtime=1 لإرسال البصمات فور حدوثها.
  res.type("text/plain").send(
    [
      `GET OPTION FROM: ${sn}`,
      "ATTLOGStamp=None",
      "OPERLOGStamp=None",
      "ATTPHOTOStamp=None",
      "ErrorDelay=30",
      "Delay=10",
      "TransTimes=00:00;14:05",
      "TransInterval=1",
      "TransFlag=TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP FPImag",
      "TimeZone=3",
      "Realtime=1",
      "Encrypt=0",
      "",
    ].join("\n"),
  );
});

// 2) استعلام الأوامر: لا أوامر معلّقة الآن.
router.get("/iclock/getrequest", (req, res) => {
  res.type("text/plain").send("OK");
});

// 3) استقبال البيانات المدفوعة (حضور/عمليات).
router.post("/iclock/cdata", (req, res) => {
  const sn = String(req.query.SN || "");
  const table = String(req.query.table || "").toUpperCase();
  const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");

  if (!snAllowed(sn)) {
    log("REJECT unknown SN=", sn, "(not in ZK_ALLOWED_SN)");
    return res.type("text/plain").send("OK");
  }

  if (table === "ATTLOG") {
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const now = new Date().toISOString();
    const recs = lines.map((line) => {
      const f = line.split("\t");
      return {
        sn,
        pin: (f[0] || "").trim(),      // رقم المستخدم على الجهاز
        time: (f[1] || "").trim(),     // "YYYY-MM-DD HH:MM:SS" بتوقيت الجهاز
        status: (f[2] || "").trim(),   // 0=دخول 1=خروج ... (كثير من الأجهزة ترسل 0 دائمًا)
        verify: (f[3] || "").trim(),   // 1=بصمة 15=وجه 2=كلمة 4=بطاقة
        workcode: (f[4] || "").trim(),
        raw: line,
        at: now,
      };
    });
    const merged = readAll(KEY).concat(recs).slice(-MAX);
    writeAll(KEY, merged);
    log(`ATTLOG SN=${sn} received ${recs.length} punch(es). sample:`, recs[0]?.raw || "(none)");
    return res.type("text/plain").send("OK");
  }

  log(`cdata POST SN=${sn} table=${table} bytes=${body.length}`);
  return res.type("text/plain").send("OK");
});

// 4) نتائج الأوامر / القوالب / الصور — نقبلها فقط دون معالجة الآن.
router.post(
  ["/iclock/devicecmd", "/iclock/fdata", "/iclock/edata", "/iclock/querydata"],
  (req, res) => res.type("text/plain").send("OK"),
);

// 5) تشخيص: رؤية آخر النبضات المستلمة (بمفتاح ?k=…).
router.get("/iclock/_recent", (req, res) => {
  if (String(req.query.k || "") !== DIAG_KEY) return res.status(403).json({ error: "forbidden" });
  const all = readAll(KEY);
  res.set("Cache-Control", "no-store");
  res.json({ count: all.length, allowedSn: ALLOW, last: all.slice(-50).reverse() });
});

export default router;
