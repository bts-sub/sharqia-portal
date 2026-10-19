import { useCallback, useEffect, useState } from "react";
import { useMe } from "../App.jsx";
import { api, fmtDate, fmtUsd } from "../lib/api.js";
import Icon from "./Icon.jsx";
import { AgentAvatar, Meter, toast } from "./ui.jsx";
import Chat from "./Chat.jsx";
import Settings from "./Settings.jsx";
import Admin from "./Admin.jsx";

function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [view, id] = h.split("/");
  if (view === "c" && id) return { view: "chat", id };
  if (view === "settings") return { view: "settings" };
  if (view === "admin") return { view: "admin" };
  return { view: "chat", id: null };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (hash) => { window.location.hash = hash; };

export default function Shell() {
  const { me, logout } = useMe();
  const route = useHashRoute();
  const [convs, setConvs] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [chat, setChat] = useState({ key: 0, id: route.view === "chat" ? route.id : null });

  const loadConvs = useCallback(async () => {
    try { setConvs((await api("/conversations")).conversations); } catch {}
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    if (route.view === "chat" && route.id !== chat.id) setChat((c) => ({ key: c.key + 1, id: route.id }));
    setDrawer(false);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCreated = (id) => {
    setChat((c) => ({ ...c, id }));
    go(`#/c/${id}`);
  };

  const newChat = () => {
    if (route.view === "chat" && !route.id) setChat((c) => ({ key: c.key + 1, id: null }));
    go("");
  };

  const remove = async (c, e) => {
    e.stopPropagation();
    if (!confirm(`حذف المحادثة «${c.title}» نهائيًا مع مرفقاتها؟`)) return;
    try {
      await api(`/conversations/${c.id}`, { method: "DELETE" });
      setConvs((xs) => xs.filter((x) => x.id !== c.id));
      if (chat.id === c.id) newChat();
    } catch (err) { toast(err.message, "error"); }
  };

  const u = me.user;
  const limit = u.limits?.monthlyUsd || 0;
  const used = me.usage.month.usd;

  return (
    <div className="shell">
      <aside className={`sidebar ${drawer ? "is-open" : ""}`} aria-label="القائمة">
        <div className="side-top">
          <div className="brand">
            <img src="/icons/icon-192.png" alt="" />
            <div>
              <strong>مساعدي الذكي</strong>
              <small>{me.org.name}</small>
            </div>
          </div>
          <button className="icon-btn only-mobile" onClick={() => setDrawer(false)} aria-label="إغلاق القائمة"><Icon name="x" /></button>
        </div>

        <button className="btn btn-primary btn-block new-chat" onClick={newChat}>
          <Icon name="plus" size={18} /> محادثة جديدة
        </button>

        <nav className="conv-list" aria-label="المحادثات">
          {!convs.length && <p className="muted side-empty">لا توجد محادثات بعد</p>}
          {convs.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`conv-item ${route.view === "chat" && chat.id === c.id ? "is-active" : ""}`}
              onClick={() => go(`#/c/${c.id}`)}
              onKeyDown={(e) => e.key === "Enter" && go(`#/c/${c.id}`)}
            >
              <span className="conv-title">{c.title}</span>
              <span className="conv-date">{fmtDate(c.updatedAt)}</span>
              <button className="conv-del" onClick={(e) => remove(c, e)} aria-label="حذف المحادثة"><Icon name="trash" size={15} /></button>
            </div>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="me-card">
            <AgentAvatar name={u.agent?.name} gender={u.agent?.gender} size={36} />
            <div className="me-meta">
              <strong>{u.displayName}</strong>
              <small>مساعدك: {u.agent?.name} · {me.role.title}</small>
            </div>
          </div>
          <div className="usage-mini">
            <div className="usage-row">
              <span>استهلاك الشهر</span>
              <span dir="ltr">{fmtUsd(used)}{limit ? ` / ${fmtUsd(limit)}` : ""}</span>
            </div>
            {limit > 0 && <Meter value={used} max={limit} />}
          </div>
          <div className="side-links">
            <button className={`side-link ${route.view === "settings" ? "is-active" : ""}`} onClick={() => go("#/settings")}>
              <Icon name="settings" size={18} /> الإعدادات
            </button>
            {u.isAdmin && (
              <button className={`side-link ${route.view === "admin" ? "is-active" : ""}`} onClick={() => go("#/admin")}>
                <Icon name="users" size={18} /> لوحة الإدارة
              </button>
            )}
            <button className="side-link" onClick={logout}><Icon name="logout" size={18} /> خروج</button>
          </div>
        </div>
      </aside>
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}

      <main className="main">
        {route.view === "settings" && <Settings onMenu={() => setDrawer(true)} />}
        {route.view === "admin" && u.isAdmin && <Admin onMenu={() => setDrawer(true)} />}
        {route.view === "chat" && (
          <Chat
            key={chat.key}
            convId={chat.id}
            onCreated={onCreated}
            onChanged={loadConvs}
            onMenu={() => setDrawer(true)}
          />
        )}
      </main>
    </div>
  );
}
