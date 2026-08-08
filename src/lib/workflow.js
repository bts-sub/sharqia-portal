// ===========================================================================
// workflow.js — محرّك الطلبات ومسارات الموافقة (مصدر الحقيقة في الـ backend)
//   يخزّن الطلبات في data/requests.json ويطبّق نفس منطق مسارات الواجهة:
//   CREATE / APPROVE / REJECT / COMMENT / CANCEL مع سجل تدقيق وإشعارات.
//   عند بلوغ الطلب مرحلة "done" لبعض الأنواع، يُزامَن للنتيجة إلى Odoo (hook).
// ===========================================================================
import { readAll, writeAll, insert, updateById, findById } from "./store.js";

// مسارات الموافقة و SLA حسب التصنيف (مطابقة للواجهة)
export const FLOW = {
  leave: { flow: ["manager", "hr", "done"], sla: 2 },
  attend: { flow: ["manager", "hr", "done"], sla: 2 },
  finance: { flow: ["manager", "hr", "finance", "done"], sla: 5 },
  custody: { flow: ["manager", "it", "done"], sla: 3 },
  transfer: { flow: ["manager", "hr", "done"], sla: 5 },
  personal: { flow: ["hr", "done"], sla: 2 },
  letters: { flow: ["hr", "done"], sla: 1 },
  training: { flow: ["manager", "hr", "done"], sla: 4 },
  insurance: { flow: ["hr", "done"], sla: 3 },
  complaint: { flow: ["hr", "done"], sla: 3 },
  offboard: { flow: ["manager", "hr", "done"], sla: 7 },
  general: { flow: ["manager", "hr", "done"], sla: 3 },
};
const flowOf = (cat) => FLOW[cat] || FLOW.general;

const STATUS_AR = {
  submitted: "تم الإرسال", manager: "بانتظار المدير المباشر", hr: "بانتظار الموارد البشرية",
  finance: "بانتظار الإدارة المالية", it: "بانتظار تقنية المعلومات",
  approved: "تمت الموافقة", rejected: "تم الرفض", cancelled: "تم الإلغاء", done: "تم التنفيذ",
};

let SEQ = 250;
function nextId() {
  const all = readAll("requests");
  const max = all.reduce((m, r) => Math.max(m, +String(r.id).replace(/\D/g, "").slice(-5) || 0), SEQ);
  SEQ = max + 1;
  return `HR-REQ-${String(SEQ).padStart(5, "0")}`;
}

function notify(userId, notif) {
  const n = { id: Date.now() + Math.floor(Math.random() * 1000), read: false, at: new Date().toISOString(), ...notif };
  insert("notifs", { ...n, userId });
  return n;
}

// أي دور يعتمد المرحلة الحالية
const roleForStage = (stage) => ({ manager: "manager", hr: "hr", finance: "finance", it: "it" }[stage] || null);

export function canActOnStage(user, req) {
  if (!req || req.status === "done" || req.status === "rejected" || req.status === "cancelled") return false;
  if (user.role === "admin") return true;
  const stage = req.flow[req.stageIndex];
  return roleForStage(stage) === user.role;
}

export function createRequest({ user, payload }) {
  const category = payload.category || "general";
  const f = flowOf(category);
  const id = nextId();
  const now = new Date().toISOString();
  const req = {
    id, service: payload.service, category,
    title: payload.title || `طلب ${payload.service}`, desc: payload.desc || "",
    empName: user.name, empId: user.id, odooEmployeeId: user.odooEmployeeId || null,
    priority: payload.priority || "عادية", confidential: !!payload.confidential,
    onBehalf: !!payload.onBehalf, requesterName: payload.onBehalf ? user.name : null,
    beneficiaryId: payload.beneficiaryId || user.id,
    flow: f.flow, stageIndex: 0, sla: f.sla, createdAt: now,
    status: f.flow[0] === "done" ? "done" : "submitted",
    comments: [], attachments: payload.attachments || [], extra: payload.extra || {},
    audit: [{ user: user.name, action: "إنشاء الطلب", from: "-", to: "تم الإرسال", at: now, note: "" }],
  };
  insert("requests", req);
  notify(user.id, { type: "request", title: "تم إنشاء الطلب بنجاح", body: `${req.title} — رقم ${req.id}`, reqId: req.id });
  return req;
}

export async function approveRequest({ user, id, note = "", onSyncToOdoo }) {
  const req = findById("requests", id);
  if (!req) throw new Error("الطلب غير موجود");
  if (!canActOnStage(user, req)) throw new Error("لا تملك صلاحية اعتماد هذه المرحلة");
  const idx = Math.min(req.stageIndex + 1, req.flow.length - 1);
  const to = req.flow[idx];
  const status = to === "done" ? "done" : to;
  const updated = updateById("requests", id, (r) => ({
    ...r, stageIndex: idx, status,
    audit: [...r.audit, { user: user.name, action: "موافقة", from: STATUS_AR[r.flow[r.stageIndex]] || "-", to: STATUS_AR[status], at: new Date().toISOString(), note }],
  }));
  notify(updated.empId, {
    type: "approval",
    title: status === "done" ? "تم تنفيذ طلبك وإغلاقه" : "تمت الموافقة على مرحلة من طلبك",
    body: `${updated.title} — رقم ${updated.id}`, reqId: updated.id,
  });
  // مزامنة النتيجة النهائية إلى Odoo عند الاكتمال (مثلاً إنشاء إجازة معتمدة)
  if (status === "done" && typeof onSyncToOdoo === "function") {
    try { updated.odooSync = await onSyncToOdoo(updated); updateById("requests", id, { odooSync: updated.odooSync }); }
    catch (e) { updateById("requests", id, { odooSyncError: e.message }); }
  }
  return updated;
}

export function rejectRequest({ user, id, note = "" }) {
  const req = findById("requests", id);
  if (!req) throw new Error("الطلب غير موجود");
  if (!canActOnStage(user, req)) throw new Error("لا تملك صلاحية رفض هذه المرحلة");
  const updated = updateById("requests", id, (r) => ({
    ...r, status: "rejected",
    audit: [...r.audit, { user: user.name, action: "رفض", from: STATUS_AR[r.flow[r.stageIndex]] || "-", to: STATUS_AR.rejected, at: new Date().toISOString(), note }],
  }));
  notify(updated.empId, { type: "approval", title: "تم رفض طلبك", body: `${updated.title} — السبب: ${note}`, reqId: updated.id });
  return updated;
}

export function commentRequest({ user, id, text }) {
  const req = findById("requests", id);
  if (!req) throw new Error("الطلب غير موجود");
  return updateById("requests", id, (r) => ({
    ...r,
    comments: [...r.comments, { by: user.name, text, at: new Date().toISOString() }],
    audit: [...r.audit, { user: user.name, action: "إضافة تعليق", from: "-", to: "-", at: new Date().toISOString(), note: text }],
  }));
}

export function cancelRequest({ user, id }) {
  const req = findById("requests", id);
  if (!req) throw new Error("الطلب غير موجود");
  if (req.empId !== user.id && user.role !== "admin") throw new Error("يمكن فقط لصاحب الطلب إلغاؤه");
  return updateById("requests", id, (r) => ({
    ...r, status: "cancelled",
    audit: [...r.audit, { user: user.name, action: "إلغاء الطلب", from: STATUS_AR[r.status] || "-", to: STATUS_AR.cancelled, at: new Date().toISOString(), note: "" }],
  }));
}

// قوائم حسب الدور: الموظف يرى طلباته؛ المعتمِد يرى ما ينتظر مرحلته؛ الأدمن/HR يرى الكل
export function listRequests(user, scope = "mine") {
  const all = readAll("requests");
  if (scope === "all" && (user.role === "admin" || user.role === "hr")) return all;
  if (scope === "inbox") return all.filter((r) => canActOnStage(user, r));
  return all.filter((r) => r.empId === user.id);
}
export const getRequest = (id) => findById("requests", id);
