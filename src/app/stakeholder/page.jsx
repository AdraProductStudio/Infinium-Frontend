"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  RiBriefcase2Line,
  RiBellLine,
  RiCalendarLine,
  RiLogoutBoxLine,
  RiLoader4Line,
  RiAlertLine,
  RiTimeLine,
  RiMailLine,
  RiMapPin2Line,
  RiTaskLine,
  RiFolder3Line,
} from "react-icons/ri";
import toast from "react-hot-toast";
import {
  getStakeholderSites,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getSseUrl,
  getMe,
  clearTokens,
  getMyWork,
} from "../../lib/api";
import { STAGE_COLORS } from "../sites/utils";
import "../sites/sites.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  new:                 "New",
  in_review:           "In Review",
  waiting_on_external: "Waiting on External",
  needs_decision:      "Needs Decision",
  approved_closed:     "Approved / Closed",
};
const STATUS_COLOR = {
  new:                 { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  in_review:           { bg: "#f5f3ff", text: "#6d28d9", dot: "#8b5cf6" },
  waiting_on_external: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  needs_decision:      { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  approved_closed:     { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
};

const DISC_TAG_CLASS = {
  Arch:      "tagArch",
  Mep:       "tagMep",
  Legal:     "tagLegal",
  Sales:     "tagSales",
  Landscape: "tagLandscape",
  Dev:       "tagDev",
};
const DISC_KEY = {
  architect:  "Arch",
  engineer:   "Mep",
  contractor: "Dev",
  consultant: "Legal",
  other:      "Dev",
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtLongDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function isOverdue(d) {
  return d ? new Date(d) < new Date() : false;
}
function stageLabel(s) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function avatarColor(id) {
  const palette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
  return palette[(id || 0) % palette.length];
}

// ── Notification Panel ────────────────────────────────────────────────────────

function NotifPanel({ notifications, onMarkRead, onMarkAll }) {
  const unread = notifications.filter((n) => !n.is_read);
  return (
    <div style={{
      position: "absolute", right: 0, top: "calc(100% + 6px)",
      width: 320, background: "#fff", borderRadius: 10,
      border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
      zIndex: 200, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: "0.812rem", fontWeight: 700, color: "#111827" }}>Notifications</span>
        {unread.length > 0 && (
          <button onClick={onMarkAll}
            style={{ fontSize: "0.719rem", color: "#2563eb", background: "none",
              border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ maxHeight: "20rem", overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "#9ca3af" }}>
            No notifications yet
          </div>
        ) : notifications.map((n) => (
          <div key={n.id}
            onClick={() => !n.is_read && onMarkRead(n.id)}
            style={{
              padding: "9px 14px", borderBottom: "1px solid #f9fafb", cursor: "pointer",
              background: n.is_read ? "transparent" : "#eff6ff",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = n.is_read ? "#f9fafb" : "#dbeafe"}
            onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? "transparent" : "#eff6ff"}
          >
            <div style={{ fontSize: "0.781rem", fontWeight: n.is_read ? 400 : 600, color: "#111827", marginBottom: 2 }}>
              {n.title}
            </div>
            {n.body && (
              <div style={{ fontSize: "0.719rem", color: "#6b7280", lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
            )}
            <div style={{ fontSize: "0.656rem", color: "#9ca3af" }}>{timeAgo(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── My Work Item Detail Drawer ─────────────────────────────────────────────────────

function MyWorkDetailDrawer({ item, onClose }) {
  if (!item) return null;
  const overdue = isOverdue(item.due_date) && item.status !== "approved_closed";
  return (
    <>
      <div className="drawerBackdrop" onClick={onClose} />
      <div className="taskDrawer">
        <div className="taskDrawerHeader" style={{ borderLeftColor: "#2563eb" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.688rem", fontWeight: 600, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {item.project_name}
            </div>
            <div className="taskDrawerTitle">{item.title}</div>
          </div>
          <button onClick={onClose} className="iconBtn" style={{ alignSelf: "flex-start" }}>✕</button>
        </div>
        <div className="taskDrawerBody">
          <div className="taskDrawerGrid">
            <div className="taskDrawerField">
              <div className="taskDrawerLabel">Status</div>
              <div className="taskDrawerValue">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px",
                  borderRadius: 999, background: (STATUS_COLOR[item.status] || STATUS_COLOR.new).bg,
                  color: (STATUS_COLOR[item.status] || STATUS_COLOR.new).text }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%",
                    background: (STATUS_COLOR[item.status] || STATUS_COLOR.new).dot }} />
                  {STATUS_LABEL[item.status] || item.status}
                </span>
              </div>
            </div>
            <div className="taskDrawerField">
              <div className="taskDrawerLabel">Due Date</div>
              <div className={`taskDrawerValue${overdue ? " taskDrawerOverdue" : ""}`}>
                <RiCalendarLine style={{ fontSize: 13 }} />
                {fmtLongDate(item.due_date) || "—"}{overdue ? " · Overdue" : ""}
              </div>
            </div>
            {item.discipline && (
              <div className="taskDrawerField">
                <div className="taskDrawerLabel">Discipline</div>
                <div className="taskDrawerValue">{item.discipline}</div>
              </div>
            )}
            {item.priority && (
              <div className="taskDrawerField">
                <div className="taskDrawerLabel">Priority</div>
                <div className="taskDrawerValue">{item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}</div>
              </div>
            )}
            {item.stage && (
              <div className="taskDrawerField" style={{ gridColumn: "1 / -1" }}>
                <div className="taskDrawerLabel">Phase</div>
                <div className="taskDrawerValue">{stageLabel(item.stage)}</div>
              </div>
            )}
          </div>
          {item.description && (
            <div className="taskDrawerSection">
              <div className="taskDrawerLabel">Description</div>
              <div className="taskDrawerDesc">{item.description}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StakeholderPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab,           setTab]          = useState("mywork");
  const [myWork,        setMyWork]       = useState(null);
  const [sites,         setSites]        = useState(null);
  const [loading,       setLoading]      = useState(true);
  const [me,            setMe]           = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif]    = useState(false);
  const [selectedItem,  setSelectedItem] = useState(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "user") router.push("/inbox");
  }, [authLoading, user, router]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    Promise.all([
      getMyWork().then((r)           => setMyWork(r?.data || r)),
      getStakeholderSites().then((r) => setSites(r?.data || r)),
      getNotifications().then((r)    => setNotifications((r?.data || []).slice().reverse())),
      getMe().then((r)               => setMe(r?.data || r)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    } catch {}
    return () => { es?.close(); };
  }, []);

  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
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

  const dueItems     = myWork?.due_this_week      || [];
  const waitingItems = myWork?.waiting_on_external || [];
  const escalations  = myWork?.escalations         || [];
  const totalOpen    = dueItems.length + waitingItems.length + escalations.length;
  const blockers     = escalations.filter((e) => e.priority === "critical" || e.priority === "high");

  return (
    <div className="sitesShell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebarLogo">
          <div className="logoIcon"><span className="logoSquare" /></div>
          <span className="logoText">Infinium</span>
          <span style={{
            fontSize: "0.563rem", fontWeight: 600, color: "#6b7280",
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            borderRadius: 99, padding: "1px 6px",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>Portal</span>
        </div>
        <nav className="sidebarNav">
          <div
            className={`sidebarItem${tab === "mywork" ? " sidebarItemActive" : ""}`}
            onClick={() => setTab("mywork")}
          >
            <span className="sidebarIcon"><RiBriefcase2Line /></span>
            <span className="sidebarLabel">My Work</span>
            {totalOpen > 0 && (
              <span className="sidebarBadge" style={{ background: "#fee2e2", color: "#dc2626" }}>
                {totalOpen}
              </span>
            )}
          </div>
          <div
            className={`sidebarItem${tab === "sites" ? " sidebarItemActive" : ""}`}
            onClick={() => setTab("sites")}
          >
            <span className="sidebarIcon"><RiMapPin2Line /></span>
            <span className="sidebarLabel">Sites</span>
            {!loading && sites && (
              <span className="sidebarBadge">{sites.length}</span>
            )}
          </div>
        </nav>
        {me && (
          <div className="sidebarBottom">
            <div className="sidebarItem" style={{ cursor: "default", gap: 7 }}>
              <div className="avatar avatarSm" style={{ background: avatarColor(me.id) }}>
                {getInitials(me.name || me.email || "?")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="userName" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me.name || me.email}
                </div>
                {me.role && <div className="userRole">{me.role}</div>}
              </div>
              <button
                onClick={() => { clearTokens(); router.push("/login"); }}
                className="iconBtn"
                title="Sign out"
                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={(e) => e.currentTarget.style.color = ""}
              >
                <RiLogoutBoxLine style={{ fontSize: 15 }} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Top Nav ── */}
      <div className="topNav">
        <div className="topNavLeft">
          <span style={{ fontSize: "0.812rem", fontWeight: 600, color: "#374151" }}>
            {tab === "mywork" ? "My Work" : "Sites"}
          </span>
          {!loading && tab === "mywork" && (
            <span className="sidebarBadge">{totalOpen} open</span>
          )}
          {!loading && tab === "sites" && sites && (
            <span className="sidebarBadge">{sites.length} {sites.length === 1 ? "site" : "sites"}</span>
          )}
        </div>
        <div className="topNavRight">
          <div className="statusChip">
            <RiMailLine style={{ fontSize: 12 }} />
            Gmail Connected
            <span className="statusDot" />
          </div>
          <div style={{ position: "relative" }} ref={notifRef}>
            <button
              className="iconBtn"
              onClick={() => setShowNotif((v) => !v)}
              style={{ position: "relative" }}
            >
              <RiBellLine className="iconSize18" />
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: 0, right: 0,
                  background: "#ef4444", color: "#fff", fontSize: "0.5rem",
                  fontWeight: 700, borderRadius: 99, minWidth: 14, height: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 2px", border: "1.5px solid #fff",
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <NotifPanel notifications={notifications}
                onMarkRead={handleMarkRead} onMarkAll={handleMarkAll} />
            )}
          </div>
          {me && (
            <div className="avatarChip">
              <div className="avatar avatarSm" style={{ background: avatarColor(me.id) }}>
                {getInitials(me.name || me.email || "?")}
              </div>
              <div>
                <div className="userName">{me.name || me.email}</div>
                {me.role && <div className="userRole">{me.role}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", flex: 1, gap: 10, color: "#9ca3af" }}>
            <RiLoader4Line style={{ fontSize: 26, animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "0.875rem" }}>Loading your workspace…</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : tab === "mywork" ? (
          <MyWorkMain
            me={me}
            dueItems={dueItems}
            waitingItems={waitingItems}
            escalations={escalations}
            onItemClick={setSelectedItem}
          />
        ) : (
          <SitesMain sites={sites} />
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiBellLine className="iconSize15" />
            Thread Updates
            {unreadCount > 0 && (
              <span className="sidebarBadge" style={{ marginLeft: 2 }}>{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAll}
              style={{ fontSize: "0.719rem", color: "#2563eb", background: "none",
                border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              Mark all read
            </button>
          )}
        </div>
        <div className="rightPanelBody">

          {/* Recent notifications */}
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Recent Updates</span>
            </div>
            {notifications.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "8px 0" }}>No updates yet</div>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <div key={n.id}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className="deadlineItem"
                  style={{ cursor: "pointer", background: n.is_read ? "transparent" : "#f0f9ff",
                    borderRadius: 6, padding: "6px 8px", marginBottom: 2 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                  onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? "transparent" : "#f0f9ff"}
                >
                  <div className="avatar avatarXs" style={{ background: avatarColor(n.id), flexShrink: 0 }}>
                    {n.title?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.719rem", fontWeight: n.is_read ? 400 : 600,
                      color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: "0.625rem", color: "#6b7280",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: "0.563rem", color: "#9ca3af", marginTop: 1 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.is_read && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Active Blockers */}
          {blockers.length > 0 && (
            <div className="rSection">
              <div className="rSectionHeader">
                <span className="rSectionTitle">
                  <RiAlertLine style={{ fontSize: 13, color: "#ef4444", marginRight: 4, verticalAlign: "middle" }} />
                  Active Blockers
                </span>
              </div>
              {blockers.map((item) => (
                <div key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="deadlineItem" style={{ cursor: "pointer" }}>
                  <RiAlertLine style={{ fontSize: 13, color: item.priority === "critical" ? "#dc2626" : "#f97316", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="deadlineTitle">{item.title}</div>
                    <div style={{ fontSize: "0.625rem", color: "#9ca3af" }}>{item.project_name}</div>
                  </div>
                  <span style={{
                    fontSize: "0.594rem", fontWeight: 700, padding: "1px 6px",
                    borderRadius: 999, flexShrink: 0,
                    background: item.priority === "critical" ? "#fef2f2" : "#fff7ed",
                    color: item.priority === "critical" ? "#dc2626" : "#ea580c",
                  }}>
                    {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Site summary */}
          {sites && sites.length > 0 && (
            <div className="rSection">
              <div className="rSectionHeader">
                <span className="rSectionTitle"><RiFolder3Line style={{ fontSize: 12, marginRight: 4, verticalAlign: "middle" }} />My Sites</span>
              </div>
              {sites.slice(0, 4).map((site) => {
                const sc = STAGE_COLORS[site.status] || { dot: "#9ca3af", bg: "#f3f4f6", text: "#6b7280" };
                return (
                  <div key={site.id} className="deadlineItem" style={{ cursor: "default" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="deadlineTitle">{site.name}</div>
                      <div style={{ fontSize: "0.625rem", color: "#9ca3af" }}>{site.open_items ?? 0} open items</div>
                    </div>
                    <span style={{ fontSize: "0.594rem", fontWeight: 600, padding: "1px 6px", borderRadius: 999,
                      background: sc.bg, color: sc.text, flexShrink: 0 }}>
                      {site.my_tasks ?? 0} tasks
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Detail Drawer */}
      {selectedItem && (
        <MyWorkDetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

// ── My Work Main Content ──────────────────────────────────────────────────────

function MyWorkMain({ me, dueItems, waitingItems, escalations, onItemClick }) {
  return (
    <>
      <div className="breadcrumbBar">
        <span className="breadcrumbCurrent">My Work</span>
        <span style={{ marginLeft: "auto", fontSize: "0.719rem", color: "#9ca3af" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>

        {/* User header */}
        {me && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
            padding: "14px 18px", background: "#fff", borderRadius: 12,
            border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="avatar avatarMd" style={{ background: avatarColor(me.id), flexShrink: 0,
                width: "2.75rem", height: "2.75rem", minWidth: "2.75rem", fontSize: "0.875rem" }}>
              {getInitials(me.name || me.email || "?")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                {me.name || me.email}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>Stakeholder</div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="statsRow" style={{ border: "1px solid #e5e7eb", borderRadius: 10,
          background: "#fff", marginBottom: 24, overflow: "hidden" }}>
          <div className="statItem">
            <div className="statLabel">Open Items</div>
            <div className="statValue">{dueItems.length + waitingItems.length + escalations.length}</div>
            <div className="statSub">Across all sites</div>
          </div>
          <div className="statItem">
            <div className="statLabel">Due This Week</div>
            <div className="statValue">{dueItems.length}</div>
            <div className="statSub">{dueItems.length === 1 ? "1 item" : `${dueItems.length} items`}</div>
          </div>
          <div className="statItem">
            <div className="statLabel">Waiting on Others</div>
            <div className="statValue">{waitingItems.length}</div>
            <div className="statSub">Pending external</div>
          </div>
          <div className="statItem">
            <div className="statLabel">Escalations</div>
            <div className="statValue" style={{ color: escalations.length > 0 ? "#ef4444" : "#111827" }}>
              {escalations.length}
            </div>
            <div className="statSub">{escalations.length > 0 ? "Needs attention" : "All clear"}</div>
          </div>
        </div>

        {/* Due This Week */}
        <SectionGroup
          title="Due This Week"
          icon={RiCalendarLine}
          color="#dc2626"
          items={dueItems}
          onItemClick={onItemClick}
        />

        {/* Waiting on Others */}
        <SectionGroup
          title="Waiting on Others"
          icon={RiTimeLine}
          color="#d97706"
          items={waitingItems}
          onItemClick={onItemClick}
        />

        {/* Escalations */}
        <SectionGroup
          title="Escalations"
          icon={RiAlertLine}
          color="#7c3aed"
          items={escalations}
          onItemClick={onItemClick}
        />
      </div>
    </>
  );
}

function SectionGroup({ title, icon: Icon, color, items, onItemClick }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {Icon && <Icon style={{ fontSize: 14, color }} />}
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>{title}</span>
        <span className="kanbanColCount" style={{ background: color + "18", color }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="tdEmpty">Nothing here right now</div>
      ) : (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
          {items.map((item) => (
            <MyWorkCard key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── My Work Card (builder-style projectCard) ──────────────────────────────────

function MyWorkCard({ item, onClick }) {
  const overdue   = isOverdue(item.due_date) && item.status !== "approved_closed";
  const sc        = STAGE_COLORS[item.stage] || { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" };
  const discKey   = DISC_KEY[item.discipline] || null;
  const discClass = discKey ? DISC_TAG_CLASS[discKey] : null;

  return (
    <div
      className="projectCard"
      onClick={() => onClick(item)}
      style={{ width: 240, flexShrink: 0, cursor: "pointer" }}
    >
      {/* Colored top area representing the project */}
      <div className="projectCardTop" style={{ background: sc.bg, borderRadius: "8px 8px 0 0", height: 56 }}>
        <div className="projectCardIcon" style={{ background: "rgba(255,255,255,0.7)" }}>
          <RiMapPin2Line style={{ fontSize: 18, color: sc.dot }} />
        </div>
      </div>

      {/* Project name + stage */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6, gap: 6 }}>
        <div style={{ fontSize: "0.719rem", fontWeight: 600, color: "#6b7280",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {item.project_name}
        </div>
        {item.stage && (
          <span className="projectCardStagePill" style={{ background: sc.bg, color: sc.text, flexShrink: 0 }}>
            {stageLabel(item.stage)}
          </span>
        )}
      </div>

      {/* Item title */}
      <div className="projectCardName" style={{ fontSize: "0.812rem", marginBottom: 8, lineHeight: 1.35 }}>
        {item.title}
      </div>

      {/* Discipline tag */}
      {discKey && discClass && (
        <div style={{ marginBottom: 8 }}>
          <span className={discClass}>{discKey}</span>
        </div>
      )}

      {/* Stats row: due date + priority */}
      <div className="projectCardStats" style={{ marginTop: "auto" }}>
        <div className="projectCardStatItem">
          <span className="projectCardStatVal" style={{ color: overdue ? "#ef4444" : "#111827", fontSize: "0.75rem" }}>
            {fmtDate(item.due_date) || "—"}
          </span>
          <span className="projectCardStatLabel">{overdue ? "Overdue" : "Due date"}</span>
        </div>
        {item.priority && (
          <>
            <div className="projectCardStatDivider" />
            <div className="projectCardStatItem">
              <span className="projectCardStatVal" style={{
                fontSize: "0.75rem",
                color: item.priority === "high" || item.priority === "critical" ? "#dc2626"
                  : item.priority === "low" ? "#16a34a" : "#d97706"
              }}>
                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
              </span>
              <span className="projectCardStatLabel">Priority</span>
            </div>
          </>
        )}
        {item.is_escalated && (
          <>
            <div className="projectCardStatDivider" />
            <div className="projectCardStatItem">
              <RiAlertLine style={{ fontSize: 14, color: "#ef4444" }} />
              <span className="projectCardStatLabel">Escalated</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sites Main Content ────────────────────────────────────────────────────────

function SitesMain({ sites }) {
  if (!sites) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <div className="tdEmpty">Loading sites…</div>
    </div>
  );

  return (
    <>
      <div className="breadcrumbBar">
        <span className="breadcrumbCurrent">Sites</span>
        <span style={{ marginLeft: "auto", fontSize: "0.719rem", color: "#9ca3af" }}>
          {sites.length} {sites.length === 1 ? "site" : "sites"} assigned
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>
        {sites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "#9ca3af" }}>
            <RiMapPin2Line style={{ fontSize: 32, display: "block", margin: "0 auto 10px", opacity: 0.4 }} />
            <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>No sites assigned yet</div>
          </div>
        ) : (
          <div className="projectsGrid">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SiteCard({ site }) {
  const sc = STAGE_COLORS[site.status] || { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" };

  return (
    <div className="projectCard">
      <div className="projectCardTop">
        <div className="projectCardIcon" style={{ background: sc.bg }}>
          {site.image_url
            ? <img src={site.image_url} alt="" className="projectCardImg" />
            : <RiMapPin2Line style={{ fontSize: 20, color: sc.dot }} />
          }
        </div>
      </div>

      <div className="projectCardName">{site.name}</div>

      <span className="projectCardStagePill" style={{ background: sc.bg, color: sc.text }}>
        {site.status ? site.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Active"}
      </span>

      <div className="projectCardStats">
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">{site.open_items ?? 0}</span>
          <span className="projectCardStatLabel">Open items</span>
        </div>
        <div className="projectCardStatDivider" />
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">{site.my_tasks ?? 0}</span>
          <span className="projectCardStatLabel">My tasks</span>
        </div>
        <div className="projectCardStatDivider" />
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">
            {site.created_at
              ? new Date(site.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—"}
          </span>
          <span className="projectCardStatLabel">Created</span>
        </div>
      </div>
    </div>
  );
}
