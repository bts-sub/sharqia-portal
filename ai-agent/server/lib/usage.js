// عدّاد الاستهلاك لكل مستخدم (أرقام فقط — بلا أي محتوى) لتطبيق الحدود والتقارير.
import { usageStore } from "./store.js";

const tz = "Asia/Riyadh";
export const monthKey = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(d);
export const dayKey = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const empty = () => ({ usd: 0, inTok: 0, outTok: 0, messages: 0 });

export function getUsage(uid) {
  const u = usageStore.get()[uid] || {};
  const month = u.months?.[monthKey()] || empty();
  const todayMessages = u.days?.[dayKey()] || 0;
  return { month, todayMessages, total: u.total || empty(), lastActive: u.lastActive || null };
}

export function addCost(uid, { usd = 0, inTok = 0, outTok = 0 }) {
  usageStore.update((all) => {
    const u = (all[uid] ||= {});
    const m = ((u.months ||= {})[monthKey()] ||= empty());
    const t = (u.total ||= empty());
    for (const x of [m, t]) { x.usd += usd; x.inTok += inTok; x.outTok += outTok; }
    u.lastActive = new Date().toISOString();
  });
}

export function countMessage(uid) {
  usageStore.update((all) => {
    const u = (all[uid] ||= {});
    const m = ((u.months ||= {})[monthKey()] ||= empty());
    const t = (u.total ||= empty());
    m.messages += 1; t.messages += 1;
    const days = (u.days ||= {});
    const k = dayKey();
    days[k] = (days[k] || 0) + 1;
    // احتفظ بآخر 40 يومًا فقط
    for (const d of Object.keys(days).sort().slice(0, -40)) delete days[d];
    u.lastActive = new Date().toISOString();
  });
}

export function dropUsage(uid) {
  usageStore.update((all) => { delete all[uid]; });
}

// هل يسمح الحدّ بإرسال رسالة جديدة؟ يرجع null أو رسالة سبب المنع.
export function limitBlock(user) {
  const { month, todayMessages } = getUsage(user.id);
  const L = user.limits || {};
  if (L.monthlyUsd > 0 && month.usd >= L.monthlyUsd) {
    return "وصلت للحدّ الشهري المسموح لك. تواصل مع الإدارة لرفع الحدّ، أو انتظر بداية الشهر القادم.";
  }
  if (L.dailyMessages > 0 && todayMessages >= L.dailyMessages) {
    return `وصلت لعدد الرسائل اليومي المسموح (${L.dailyMessages}). يتجدّد الحدّ غدًا.`;
  }
  return null;
}

export function overBudget(user) {
  const L = user.limits || {};
  return L.monthlyUsd > 0 && getUsage(user.id).month.usd >= L.monthlyUsd;
}
