#!/usr/bin/env node
// ===========================================================================
// users-cli.js — إدارة مستخدمي البوابة من سطر الأوامر
//   node bin/users-cli.js list
//   node bin/users-cli.js add --login m@sharqia.sa --name "الاسم" --role employee \
//        --password "..." --odoo 1042 --dept المشتريات --branch الرياض
//   node bin/users-cli.js passwd --login m@sharqia.sa --password "جديدة"
//   node bin/users-cli.js del --login m@sharqia.sa
//   node bin/users-cli.js seed          (ينشئ أدمن من متغيرات البيئة)
// ===========================================================================
import { listUsers, createUser, setPassword, deleteUser, seedAdminIfEmpty, ROLES } from "../src/lib/users.js";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { out[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

const [, , cmd, ...rest] = process.argv;
const a = parseArgs(rest);

try {
  switch (cmd) {
    case "list": {
      const users = listUsers();
      if (!users.length) console.log("لا يوجد مستخدمون.");
      else console.table(users.map((u) => ({ login: u.login, name: u.name, role: u.role, odoo: u.odooEmployeeId, status: u.status })));
      break;
    }
    case "add": {
      if (!a.login || !a.password) throw new Error("مطلوب --login و --password");
      const u = await createUser({
        login: a.login, password: a.password, name: a.name || a.login,
        role: a.role || "employee", odooEmployeeId: a.odoo ? Number(a.odoo) : null,
        empNo: a.empno || null, dept: a.dept || "", branch: a.branch || "",
      });
      console.log(`✅ أُنشئ المستخدم: ${u.login} (${u.role})`);
      break;
    }
    case "passwd": {
      if (!a.login || !a.password) throw new Error("مطلوب --login و --password");
      await setPassword(a.login, a.password);
      console.log(`✅ تم تغيير كلمة مرور: ${a.login}`);
      break;
    }
    case "del": {
      if (!a.login) throw new Error("مطلوب --login");
      deleteUser(a.login);
      console.log(`✅ حُذف المستخدم: ${a.login}`);
      break;
    }
    case "seed": {
      const done = await seedAdminIfEmpty();
      console.log(done ? "✅ أُنشئ حساب مدير النظام من متغيرات البيئة." : "لا حاجة للـ seed (يوجد مستخدمون أو لم تُضبط ADMIN_PASSWORD).");
      break;
    }
    default:
      console.log(`الاستخدام:
  node bin/users-cli.js list
  node bin/users-cli.js add --login <email> --password <pw> --name <الاسم> --role <${ROLES.join("|")}> --odoo <employeeId> [--dept .. --branch ..]
  node bin/users-cli.js passwd --login <email> --password <جديدة>
  node bin/users-cli.js del --login <email>
  node bin/users-cli.js seed`);
  }
  process.exit(0);
} catch (e) {
  console.error("❌", e.message);
  process.exit(1);
}
