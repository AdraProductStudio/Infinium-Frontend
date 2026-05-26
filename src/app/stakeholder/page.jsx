"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RiLayoutColumnLine,
  RiListCheck2,
  RiBellLine,
  RiCheckLine,
  RiTimeLine,
  RiCalendarLine,
  RiFolderLine,
  RiLogoutBoxLine,
  RiCircleLine,
  RiLoader4Line,
} from "react-icons/ri";
import toast from "react-hot-toast";
import {
  getStakeholderKanban,
  getStakeholderTasks,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getSseUrl,
  getMe,
  logout,
  clearTokens,
} from "../../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS = [
  { key: "new",              label: "New",              color: "#6b7280" },
  { key: "in_review",        label: "In Review",        color: "#2563eb" },
  { key: "pending_approval", label: "Pending Approval", color: "#d97706" },
  { key: "needs_decision",   label: "Needs Decision",   color: "#dc2626" },
  { key: "approved_closed",  label: "Closed",           color: "#16a34a" },
];

const STATUS_LABEL = Object.fromEntries(COLS.map((c) => [c.key, c.label]));
const STATUS_COLOR = Object.fromEntries(COLS.map((c) => [c.key, c.color]));

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date();
}

// ── Task Card (Kanban) ────────────────────────────────────────────────────────

function TaskCard({ task, onClick }) {
  const overdue = isOverdue(task.due_date) && task.status !== "approved_closed";
  return (
    <div className="shTaskCard" onClick={() => onClick(task)}>
      <div className="shTaskCardTitle">{task.title}</div>
      <div className="shTaskCardMeta">
        <span className="shTaskCardProject">
          <RiFolderLine style={{ fontSize: 11 }} /> {task.project_name}
        </span>
        {task.due_date && (
          <span className={`shTaskCardDue ${overdue ? "shTaskCardDueOver" : ""}`}>
            <RiCalendarLine style={{ fontSize: 11 }} /> {fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Notification Panel ────────────────────────────────────────────────────────

function NotifPanel({ notifications, onMarkRead, onMarkAll, onClose }) {
  const unread = notifications.filter((n) => !n.is_read);
  return (
    <div className="shNotifPanel">
      <div className="shNotifHeader">
        <span className="shNotifTitle">Notifications</span>
        {unread.length > 0 && (
          <button className="shNotifMarkAll" onClick={onMarkAll}>
            Mark all read
          </button>
        )}
      </div>
      <div className="shNotifList">
        {notifications.length === 0 ? (
          <div className="shNotifEmpty">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`shNotifItem ${!n.is_read ? "shNotifItemUnread" : ""}`}
              onClick={() => !n.is_read && onMarkRead(n.id)}
            >
              <div className="shNotifItemTitle">{n.title}</div>
              <div className="shNotifItemBody">{n.body}</div>
              <div className="shNotifItemTime">
                {new Date(n.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Task Detail Drawer ────────────────────────────────────────────────────────

function TaskDrawer({ task, onClose }) {
  if (!task) return null;
  const overdue = isOverdue(task.due_date) && task.status !== "approved_closed";
  return (
    <div className="shDrawerOverlay" onClick={onClose}>
      <div className="shDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="shDrawerHeader">
          <div>
            <div className="shDrawerProject">
              <RiFolderLine style={{ fontSize: 12 }} /> {task.project_name}
            </div>
            <div className="shDrawerTitle">{task.title}</div>
          </div>
          <button className="shDrawerClose" onClick={onClose}>✕</button>
        </div>
        <div className="shDrawerBody">
          <div className="shDrawerRow">
            <span className="shDrawerLabel">Status</span>
            <span className="shDrawerBadge" style={{ background: `${STATUS_COLOR[task.status]}18`, color: STATUS_COLOR[task.status], borderColor: `${STATUS_COLOR[task.status]}40` }}>
              {STATUS_LABEL[task.status] || task.status}
            </span>
          </div>
          {task.due_date && (
            <div className="shDrawerRow">
              <span className="shDrawerLabel">Due</span>
              <span style={{ fontSize: "0.8125rem", color: overdue ? "#dc2626" : "#374151", fontWeight: overdue ? 600 : 400 }}>
                {fmtDate(task.due_date)} {overdue ? "· Overdue" : ""}
              </span>
            </div>
          )}
          {task.review_item_title && (
            <div className="shDrawerRow">
              <span className="shDrawerLabel">Review item</span>
              <span style={{ fontSize: "0.8125rem", color: "#374151" }}>{task.review_item_title}</span>
            </div>
          )}
          {task.description && (
            <div style={{ marginTop: "1rem" }}>
              <div className="shDrawerLabel" style={{ marginBottom: "0.375rem" }}>Description</div>
              <div style={{ fontSize: "0.8125rem", color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {task.description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StakeholderPage() {
  const router = useRouter();
  const [tab,           setTab]           = useState("kanban"); // kanban | mywork
  const [kanban,        setKanban]        = useState(null);
  const [tasks,         setTasks]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [me,            setMe]            = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif]     = useState(false);
  const [selectedTask,  setSelectedTask]  = useState(null);
  const notifRef = useRef(null);
  const sseRef   = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Load initial data
  useEffect(() => {
    Promise.all([
      getStakeholderKanban().then((r) => setKanban(r?.data || r)),
      getStakeholderTasks().then((r)  => setTasks(r?.data  || [])),
      getNotifications().then((r)     => setNotifications((r?.data || []).reverse())),
      getMe().then((r)                => setMe(r?.data || r)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // SSE real-time notifications
  useEffect(() => {
    let es;
    try {
      es = new EventSource(getSseUrl());
      es.onmessage = (e) => {
        try {
          const notif = JSON.parse(e.data);
          if (notif.type === "connected") return;
          setNotifications((prev) => [notif, ...prev]);
          toast(notif.title, { icon: "🔔" });
        } catch {}
      };
      sseRef.current = es;
    } catch {}
    return () => { es?.close(); };
  }, []);

  // Close notif panel on outside click
  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleMarkRead(id) {
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function handleMarkAll() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleLogout() {
    clearTokens();
    router.push("/login");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="shPortal">

      {/* Top bar */}
      <header className="shPortalTop">
        <div className="shPortalLogo">
          <div className="shPortalLogoIcon" />
          <span className="shPortalLogoText">Infinium</span>
          <span className="shPortalBadge">Stakeholder</span>
        </div>
        <div className="shPortalTopRight">
          {/* Notification bell */}
          <div style={{ position: "relative" }} ref={notifRef}>
            <button
              className="shPortalBellBtn"
              onClick={() => setShowNotif((v) => !v)}
              aria-label="Notifications"
            >
              <RiBellLine />
              {unreadCount > 0 && (
                <span className="shPortalBellBadge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
            {showNotif && (
              <NotifPanel
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onMarkAll={handleMarkAll}
                onClose={() => setShowNotif(false)}
              />
            )}
          </div>
          {/* User info */}
          {me && (
            <div className="shPortalUser">
              <div className="shPortalUserAvatar">
                {(me.name || me.email || "?")[0].toUpperCase()}
              </div>
              <span className="shPortalUserName">{me.name || me.email}</span>
            </div>
          )}
          <button className="shPortalLogoutBtn" onClick={handleLogout} title="Sign out">
            <RiLogoutBoxLine />
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="shPortalTabs">
        <button
          className={`shPortalTab ${tab === "kanban" ? "shPortalTabActive" : ""}`}
          onClick={() => setTab("kanban")}
        >
          <RiLayoutColumnLine /> Kanban
        </button>
        <button
          className={`shPortalTab ${tab === "mywork" ? "shPortalTabActive" : ""}`}
          onClick={() => setTab("mywork")}
        >
          <RiListCheck2 /> My Work
        </button>
      </div>

      {/* Main content */}
      <main className="shPortalMain">
        {loading ? (
          <div className="shPortalLoading">
            <RiLoader4Line style={{ fontSize: "1.5rem", animation: "shSpin 1s linear infinite" }} />
            <span>Loading your tasks…</span>
          </div>
        ) : tab === "kanban" ? (
          <KanbanView kanban={kanban} onTaskClick={setSelectedTask} />
        ) : (
          <MyWorkView tasks={tasks} onTaskClick={setSelectedTask} />
        )}
      </main>

      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .shPortal {
          min-height: 100vh;
          background: #f9fafb;
          font-family: var(--font-inter), Inter, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Top bar */
        .shPortalTop {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.5rem; height: 3.25rem;
          background: #fff; border-bottom: 1px solid #e5e7eb;
          position: sticky; top: 0; z-index: 50;
        }
        .shPortalLogo { display: flex; align-items: center; gap: 0.5rem; }
        .shPortalLogoIcon {
          width: 1.5rem; height: 1.5rem; background: #111827;
          border-radius: 0.375rem; position: relative;
        }
        .shPortalLogoIcon::after {
          content: ""; position: absolute; inset: 0.375rem;
          background: #fff; border-radius: 0.125rem;
        }
        .shPortalLogoText { font-size: 0.875rem; font-weight: 700; color: #111827; }
        .shPortalBadge {
          font-size: 0.625rem; font-weight: 600; color: #6b7280;
          background: #f3f4f6; border: 1px solid #e5e7eb;
          border-radius: 99px; padding: 0.125rem 0.5rem;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .shPortalTopRight { display: flex; align-items: center; gap: 0.75rem; }

        /* Bell */
        .shPortalBellBtn {
          position: relative; background: none; border: none;
          cursor: pointer; color: #374151; font-size: 1.125rem;
          width: 2rem; height: 2rem; border-radius: 0.375rem;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .shPortalBellBtn:hover { background: #f3f4f6; }
        .shPortalBellBadge {
          position: absolute; top: 0; right: 0;
          background: #ef4444; color: #fff;
          font-size: 0.5625rem; font-weight: 700;
          border-radius: 99px; min-width: 1rem; height: 1rem;
          display: flex; align-items: center; justify-content: center;
          padding: 0 0.2rem; border: 1.5px solid #fff;
        }

        /* User */
        .shPortalUser { display: flex; align-items: center; gap: 0.5rem; }
        .shPortalUserAvatar {
          width: 1.75rem; height: 1.75rem; border-radius: 50%;
          background: #111827; color: #fff;
          font-size: 0.75rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .shPortalUserName { font-size: 0.8125rem; font-weight: 500; color: #374151; }

        .shPortalLogoutBtn {
          background: none; border: none; cursor: pointer;
          color: #9ca3af; font-size: 1rem;
          width: 1.75rem; height: 1.75rem;
          display: flex; align-items: center; justify-content: center;
          border-radius: 0.375rem; transition: all 0.15s;
        }
        .shPortalLogoutBtn:hover { color: #ef4444; background: #fef2f2; }

        /* Tab bar */
        .shPortalTabs {
          display: flex; gap: 0; padding: 0 1.5rem;
          background: #fff; border-bottom: 1px solid #e5e7eb;
        }
        .shPortalTab {
          display: flex; align-items: center; gap: 0.375rem;
          padding: 0.75rem 1rem;
          font-size: 0.8125rem; font-weight: 500; color: #6b7280;
          background: none; border: none; border-bottom: 2px solid transparent;
          cursor: pointer; font-family: inherit; transition: all 0.15s;
          margin-bottom: -1px;
        }
        .shPortalTab:hover { color: #374151; }
        .shPortalTabActive { color: #111827; border-bottom-color: #111827; font-weight: 600; }

        /* Main */
        .shPortalMain { flex: 1; overflow: auto; }
        .shPortalLoading {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 0.75rem; padding: 4rem;
          color: #9ca3af; font-size: 0.875rem;
        }
        @keyframes shSpin { to { transform: rotate(360deg); } }

        /* Kanban */
        .shKanban {
          display: flex; gap: 1rem; padding: 1.5rem;
          overflow-x: auto; min-height: calc(100vh - 7rem);
          align-items: flex-start;
        }
        .shKanbanCol {
          flex: 0 0 15rem; min-width: 15rem;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .shKanbanColHead {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.25rem;
        }
        .shKanbanColDot {
          width: 0.5rem; height: 0.5rem; border-radius: 50%; flex-shrink: 0;
        }
        .shKanbanColLabel { font-size: 0.75rem; font-weight: 600; color: #374151; }
        .shKanbanColCount {
          font-size: 0.6875rem; color: #9ca3af; font-weight: 500;
          background: #f3f4f6; border-radius: 99px; padding: 0.05rem 0.4rem;
        }
        .shKanbanCards { display: flex; flex-direction: column; gap: 0.5rem; }
        .shKanbanEmpty {
          padding: 1.5rem 0.75rem; text-align: center;
          font-size: 0.75rem; color: #d1d5db;
          border: 1.5px dashed #e5e7eb; border-radius: 0.5rem;
        }

        /* Task card */
        .shTaskCard {
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 0.5rem; padding: 0.75rem;
          cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s;
        }
        .shTaskCard:hover { border-color: #d1d5db; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        .shTaskCardTitle { font-size: 0.8125rem; font-weight: 500; color: #111827; line-height: 1.4; margin-bottom: 0.5rem; }
        .shTaskCardMeta { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .shTaskCardProject, .shTaskCardDue {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-size: 0.6875rem; color: #9ca3af;
        }
        .shTaskCardDueOver { color: #dc2626; font-weight: 600; }

        /* My Work list */
        .shMyWork { padding: 1.5rem; max-width: 52rem; }
        .shMyWorkTitle { font-size: 1rem; font-weight: 700; color: #111827; margin: 0 0 1rem; }
        .shMyWorkTable {
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 0.625rem; overflow: hidden;
        }
        .shMyWorkRow {
          display: grid; grid-template-columns: 1fr 10rem 8rem 9rem;
          padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6;
          align-items: center; cursor: pointer; transition: background 0.1s;
        }
        .shMyWorkRow:last-child { border-bottom: none; }
        .shMyWorkRow:hover { background: #fafafa; }
        .shMyWorkRowHead {
          display: grid; grid-template-columns: 1fr 10rem 8rem 9rem;
          padding: 0.5rem 1rem; background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.6875rem; font-weight: 600; color: #6b7280;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .shMyWorkTaskName { font-size: 0.8125rem; font-weight: 500; color: #111827; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .shMyWorkProject { font-size: 0.75rem; color: #6b7280; }
        .shMyWorkStatus {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-size: 0.6875rem; font-weight: 600;
          border-radius: 99px; padding: 0.2rem 0.6rem;
        }
        .shMyWorkDue { font-size: 0.75rem; }
        .shMyWorkEmpty {
          padding: 3rem; text-align: center;
          font-size: 0.875rem; color: #9ca3af;
        }

        /* Notification panel */
        .shNotifPanel {
          position: absolute; right: 0; top: calc(100% + 0.5rem);
          width: 22rem; background: #fff;
          border: 1px solid #e5e7eb; border-radius: 0.75rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          z-index: 100; overflow: hidden;
        }
        .shNotifHeader {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.875rem 1rem 0.625rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .shNotifTitle { font-size: 0.875rem; font-weight: 700; color: #111827; }
        .shNotifMarkAll {
          font-size: 0.75rem; color: #2563eb; font-weight: 500;
          background: none; border: none; cursor: pointer; padding: 0;
          font-family: inherit;
        }
        .shNotifMarkAll:hover { text-decoration: underline; }
        .shNotifList { max-height: 22rem; overflow-y: auto; }
        .shNotifEmpty { padding: 2rem; text-align: center; font-size: 0.8125rem; color: #9ca3af; }
        .shNotifItem {
          padding: 0.75rem 1rem; border-bottom: 1px solid #f9fafb;
          cursor: pointer; transition: background 0.1s;
        }
        .shNotifItem:hover { background: #fafafa; }
        .shNotifItemUnread { background: #eff6ff; }
        .shNotifItemUnread:hover { background: #dbeafe; }
        .shNotifItemTitle { font-size: 0.8125rem; font-weight: 600; color: #111827; margin-bottom: 0.125rem; }
        .shNotifItemBody { font-size: 0.75rem; color: #6b7280; line-height: 1.4; margin-bottom: 0.25rem; }
        .shNotifItemTime { font-size: 0.6875rem; color: #9ca3af; }

        /* Task drawer */
        .shDrawerOverlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.3); z-index: 200;
          display: flex; justify-content: flex-end;
        }
        .shDrawer {
          width: 24rem; max-width: 90vw; height: 100%;
          background: #fff; display: flex; flex-direction: column;
          box-shadow: -4px 0 24px rgba(0,0,0,0.12);
          animation: shDrawerIn 0.2s ease;
        }
        @keyframes shDrawerIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .shDrawerHeader {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 1.25rem 1.25rem 1rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .shDrawerProject {
          display: flex; align-items: center; gap: 0.25rem;
          font-size: 0.6875rem; font-weight: 600; color: #9ca3af;
          text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.375rem;
        }
        .shDrawerTitle { font-size: 0.9375rem; font-weight: 700; color: #111827; line-height: 1.4; }
        .shDrawerClose {
          background: none; border: none; cursor: pointer;
          color: #9ca3af; font-size: 1rem; padding: 0.25rem;
          line-height: 1; border-radius: 0.25rem;
          transition: color 0.15s;
        }
        .shDrawerClose:hover { color: #374151; }
        .shDrawerBody { padding: 1.25rem; flex: 1; overflow-y: auto; }
        .shDrawerRow {
          display: flex; align-items: center; gap: 1rem;
          margin-bottom: 0.875rem;
        }
        .shDrawerLabel { font-size: 0.75rem; font-weight: 600; color: #9ca3af; min-width: 5.5rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .shDrawerBadge {
          display: inline-flex; align-items: center;
          font-size: 0.6875rem; font-weight: 600;
          border: 1px solid; border-radius: 99px; padding: 0.2rem 0.6rem;
        }
      `}</style>
    </div>
  );
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ kanban, onTaskClick }) {
  if (!kanban) return null;
  const cols = kanban.columns || {};
  return (
    <div className="shKanban">
      {COLS.map((col) => {
        const colTasks = cols[col.key] || [];
        return (
          <div key={col.key} className="shKanbanCol">
            <div className="shKanbanColHead">
              <div className="shKanbanColDot" style={{ background: col.color }} />
              <span className="shKanbanColLabel">{col.label}</span>
              <span className="shKanbanColCount">{colTasks.length}</span>
            </div>
            <div className="shKanbanCards">
              {colTasks.length === 0 ? (
                <div className="shKanbanEmpty">No tasks</div>
              ) : (
                colTasks.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={onTaskClick} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── My Work View ──────────────────────────────────────────────────────────────

function MyWorkView({ tasks, onTaskClick }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? tasks
    : tasks.filter((t) => t.status === filter);

  return (
    <div className="shMyWork">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 className="shMyWorkTitle" style={{ margin: 0 }}>My Work</h2>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          {[{ key: "all", label: "All" }, ...COLS].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "0.3rem 0.625rem",
                fontSize: "0.75rem",
                fontWeight: filter === f.key ? 600 : 400,
                background: filter === f.key ? "#111827" : "#fff",
                color: filter === f.key ? "#fff" : "#6b7280",
                border: "1px solid " + (filter === f.key ? "#111827" : "#e5e7eb"),
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="shMyWorkEmpty">No tasks in this category.</div>
      ) : (
        <div className="shMyWorkTable">
          <div className="shMyWorkRowHead">
            <div>Task</div>
            <div>Project</div>
            <div>Status</div>
            <div>Due</div>
          </div>
          {filtered.map((t) => {
            const overdue = isOverdue(t.due_date) && t.status !== "approved_closed";
            return (
              <div key={t.id} className="shMyWorkRow" onClick={() => onTaskClick(t)}>
                <div className="shMyWorkTaskName" title={t.title}>{t.title}</div>
                <div className="shMyWorkProject">{t.project_name}</div>
                <div>
                  <span
                    className="shMyWorkStatus"
                    style={{
                      background: `${STATUS_COLOR[t.status]}14`,
                      color: STATUS_COLOR[t.status],
                      borderColor: `${STATUS_COLOR[t.status]}30`,
                    }}
                  >
                    {STATUS_LABEL[t.status] || t.status}
                  </span>
                </div>
                <div
                  className="shMyWorkDue"
                  style={{ color: overdue ? "#dc2626" : "#6b7280", fontWeight: overdue ? 600 : 400 }}
                >
                  {fmtDate(t.due_date) || "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
