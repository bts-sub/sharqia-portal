import { runAction, managerStageIsVacant } from "/app/src/odooActions.js";
const C = (login, name, role, emp) => ({ user: { id: "t", login, name, role, odooEmployeeId: emp } });
const hr = C("hr@a.com", "موارد بشرية", "hr", 6);
const mgr = C("a@a..com", "محمد حسن", "manager", 3);

console.log("=== هل مرحلة المدير بلا صاحب؟ ===");
for (const [tag, id] of [["م سارة #4 (مديرها محمد بحساب مدير)", 4], ["محمد حسن #3 (مديره Administrator بلا حساب)", 3],
                         ["تقنية المعلومات #8 (بلا مدير)", 8], ["متدرب #5 (مديره سارة بدور موظف)", 5]])
  console.log(`   ${tag.padEnd(46)} → ${await managerStageIsVacant(id)}`);

console.log("\n=== صندوق وارد الموارد البشرية: الطلبات العالقة ===");
const { data } = await runAction("request.list", { scope: "inbox" }, hr);
for (const r of (data.records || []).filter((x) => x.state === "submitted"))
  console.log(`   ${r.name} · ${r.service} · ${r.empName} · مرحلة مدير بلا صاحب=${r.mgrVacant}`);

console.log("\n=== طلب واحد بالتفصيل ===");
const one = await runAction("request.read", { id: "HR-REQ-00360", scope: "all" }, hr);
console.log(`   ${one.data?.name} · ${one.data?.empName} · حالة=${one.data?.state} · mgrVacant=${one.data?.mgrVacant}`);
