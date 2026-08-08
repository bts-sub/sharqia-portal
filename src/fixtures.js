// ===========================================================================
// fixtures.js — بيانات تجريبية آمنة وصغيرة (وضع الاختبار فقط)
//   تُستخدم عندما TEST_MODE=true أو عند فشل الاتصال بـ Odoo.
//   ملاحظة: هذه بيانات وهمية بحتة — نُقلت من الواجهة إلى الـ backend كما طُلب.
// ===========================================================================

export const FX_EMPLOYEE = {
  id: "E1042", odooId: 1042, name: "محمد عبدالله العتيبي", jobTitle: "أخصائي مشتريات",
  dept: "إدارة المشتريات", branch: "فرع الرياض", empNo: "1042",
  manager: "صلاح الدين محمود", managerId: "M1", hrOfficer: "سارة القحطاني",
  company: "بيت العباءة الشرقية", email: "m.alotaibi@sharqia.sa", phone: "05xxxxxx42",
  hireDate: "2022-03-14", contract: "دوام كامل", leaveBalance: 21,
  nationalIdMasked: "1•••••••42", iban: "SA•• •••• •••• •••• 8841",
};

export const FX_LEAVES = [
  { id: "LV-00188", type: "إجازة سنوية", from: "2026-08-10", to: "2026-08-15", days: 6, status: "معتمدة", approver: "صلاح الدين محمود", submitted: "2026-07-01", balanceAfter: 15, started: false },
  { id: "LV-00191", type: "إجازة اضطرارية", from: "2026-09-02", to: "2026-09-03", days: 2, status: "في انتظار المدير", approver: "صلاح الدين محمود", submitted: "2026-07-10", balanceAfter: 13, started: false },
  { id: "LV-00097", type: "إجازة سنوية", from: "2026-02-18", to: "2026-02-25", days: 8, status: "معتمدة", approver: "صلاح الدين محمود", submitted: "2026-02-05", balanceAfter: 13, started: false },
];

export const FX_ATTENDANCE = [
  { date: "2026-07-09", in: "07:58", out: "16:04", status: "منتظم", manual: false },
  { date: "2026-07-08", in: "08:22", out: "16:01", status: "تأخّر", manual: false },
  { date: "2026-07-07", in: "07:55", out: "—", status: "لم يسجل انصراف", manual: false },
];

export const FX_LEAVE_BALANCE = 21;

export const FX_LEAVE_TYPES = [
  { id: 1, name: "إجازة سنوية" }, { id: 2, name: "إجازة مرضية" }, { id: 3, name: "إجازة اضطرارية" },
];

export const FX_VERSION = "19.0 (وضع الاختبار)";
