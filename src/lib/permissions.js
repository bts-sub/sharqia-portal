// ===========================================================================
// permissions.js — مصفوفة الصلاحيات ثنائية المستوى (تصنيف × خدمة × دور)
//   قاعدة: الرتبة الفعلية لخدمة = min(رتبة التصنيف, رتبة الخدمة).
//   الافتراضات تُشتق من الدور، ويمكن تجاوزها من data/permissions.json (إدارة النظام).
//   (نقل أمين لمنطق effRankOf/svcPerm/catPerm من الواجهة إلى الـ backend.)
// ===========================================================================
import { readAll, writeAll } from "./store.js";

// ترتيب رتب المستويات (كلما زاد الرقم زادت الصلاحية)
export const LVL_RANK = {
  "إخفاء الخدمة": 0, "غير ظاهر": 0, "عرض فقط": 1,
  "إنشاء طلب": 2, "استخدام الخدمات المسموحة": 2, "إنشاء لنفسي": 2, "إنشاء لنفسي فقط": 2,
  "إنشاء لموظفي فريقي": 3, "إنشاء لنفسي ولموظفي فريقي": 4,
  "مراجعة": 5, "مراجعة طلبات التصنيف": 5, "اعتماد الطلبات": 6, "اعتماد طلبات التصنيف": 6, "إدارة كاملة": 7,
};
export const rankOf = (lvl) => (LVL_RANK[lvl] ?? 2);

// الأدوار بالعربية (مطابقة للواجهة)
const ROLE_AR = { employee: "موظف", manager: "مدير قسم", hr: "موارد بشرية", finance: "مسؤول مالي", it: "تقنية المعلومات", admin: "مدير النظام" };

// المستوى الافتراضي على مستوى الخدمة حسب الدور
function defaultSvcLevel(roleAr) {
  if (["موارد بشرية", "مدير موارد بشرية", "مدير النظام"].includes(roleAr)) return "إدارة كاملة";
  if (["مدير قسم", "مدير إدارة"].includes(roleAr)) return "إنشاء لنفسي ولموظفي فريقي";
  if (roleAr === "موظف") return "إنشاء لنفسي فقط";
  return "عرض فقط";
}
// المستوى الافتراضي على مستوى التصنيف حسب الدور
function defaultCatLevel(roleAr) {
  if (["موارد بشرية", "مدير موارد بشرية", "مدير النظام"].includes(roleAr)) return "إدارة كاملة";
  if (["مدير قسم", "مدير إدارة"].includes(roleAr)) return "إنشاء لنفسي ولموظفي فريقي";
  if (roleAr === "موظف") return "إنشاء لنفسي";
  return "عرض فقط";
}

// تجاوزات مخزّنة: { [roleAr]: { services: {unit:level}, categories: {catId:level} } }
function overrides() {
  const o = readAll("permissions", null);
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
}
export function getOverrides() { return overrides(); }
export function setOverrides(next) { writeAll("permissions", next || {}); return next; }

const toAr = (role) => ROLE_AR[role] || role;

// افتراضٌ خاصٌّ بخدماتٍ بعينها — يسبق افتراض الدور ويتأخّر عن تجاوزات
// الإدارة، فتبقى الإدارة قادرةً على إظهارها من شاشة الصلاحيات.
//
// زيادة الراتب والمكافأة يرفعهما المدير لموظفه، فظهورهما للموظف نفسه
// يدعوه إلى طلب زيادةٍ لنفسه — وليس ذلك مسار أيٍّ منهما.
const SVC_DEFAULT = {
  "زيادة راتب": { "موظف": "إخفاء الخدمة" },
  "مكافأة": { "موظف": "إخفاء الخدمة" },
  "تعديل راتب": { "موظف": "إخفاء الخدمة" },   // الاسم القديم: طلباتٌ قائمة به
};

export function svcPerm(role, unit) {
  const roleAr = toAr(role);
  return overrides()?.[roleAr]?.services?.[unit] ?? SVC_DEFAULT[unit]?.[roleAr] ?? defaultSvcLevel(roleAr);
}
export function catPerm(role, catId) {
  const roleAr = toAr(role);
  return overrides()?.[roleAr]?.categories?.[catId] ?? defaultCatLevel(roleAr);
}

// الرتبة الفعلية لخدمة = الأقل بين رتبة تصنيفها ورتبة الخدمة نفسها
export function effRank(role, category, unit) {
  return Math.min(rankOf(catPerm(role, category)), rankOf(svcPerm(role, unit)));
}

// دوال قرار جاهزة للاستخدام في المسارات
export const canView = (role, category, unit) => effRank(role, category, unit) >= 1;
export const canCreate = (role, category, unit) => effRank(role, category, unit) >= 2;
export const canCreateForTeam = (role, category, unit) => effRank(role, category, unit) >= 3;
export const canApprove = (role, category, unit) => effRank(role, category, unit) >= 6;
export const isHidden = (role, category, unit) => effRank(role, category, unit) === 0;

export { ROLE_AR };

// ---------------------------------------------------------------------------
// استثناءاتُ المستخدم الواحد — تُكتب في أودو (تبويب «الصلاحيات» على بطاقته)
// وتسبق حكمَ الدور. والقراءةُ مُخزَّنةٌ دقيقةً: الشاشة تسأل عن عشرات الخدمات
// في الضغطة الواحدة، فنداءٌ لأودو مع كلّ خدمةٍ يشلّها.
const USER_PERM = new Map();   // login → { at, map }
const USER_TTL = 60 * 1000;

export async function userPerms(login, odooCall) {
  const key = String(login || "").toLowerCase();
  if (!key || typeof odooCall !== "function") return {};
  const hit = USER_PERM.get(key);
  if (hit && Date.now() - hit.at < USER_TTL) return hit.map;
  let map = {};
  try {
    map = (await odooCall("sharqia.portal.permission", "sharqia_for_login", [key])) || {};
  } catch (e) {
    // الموديول لم يُحدَّث بعد، أو تعذّر أودو: يبقى حكمُ الدور ولا يتعطّل أحد
    map = hit?.map || {};
  }
  USER_PERM.set(key, { at: Date.now(), map });
  return map;
}

export function forgetUserPerms(login) {
  if (login) USER_PERM.delete(String(login).toLowerCase());
  else USER_PERM.clear();
}

// الرتبة الفعلية مع استثناء المستخدم: الاستثناء يسبق الدور صعودًا ونزولًا —
// يُرفع به شخصٌ على دوره، أو يُحجب عنه ما لدوره. وما لم يُذكر يبقى بحكمه.
export function effRankFor(role, category, unit, uperms) {
  const own = uperms && uperms[unit];
  if (own) return Math.min(rankOf(catPerm(role, category)), rankOf(own));
  return effRank(role, category, unit);
}
