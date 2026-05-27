"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  RiBriefcase2Line,
  RiLayoutColumnLine,
  RiBellLine,
  RiCheckLine,
  RiCalendarLine,
  RiLogoutBoxLine,
  RiLoader4Line,
  RiAlertLine,
  RiArrowUpLine,
  RiTimeLine,
  RiFileTextLine,
  RiArrowRightSLine,
  RiMailLine,
  RiChat3Line,
  RiAttachment2,
  RiMapPinLine,
  RiSendPlaneLine,
  RiDownloadLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import {
  getStakeholderKanban,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getSseUrl,
  getMe,
  clearTokens,
  getMyWork,
  getStakeholderTaskComments,
  addStakeholderTaskComment,
  getStakeholderTaskHistory,
  getTaskAttachments,
  downloadAttachment,
} from "../../lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const COLS = [
  { key: "new",                  label: "New",                 color: "#6b7280" },
  { key: "in_review",            label: "In Review",           color: "#2563eb" },
  { key: "waiting_on_external",  label: "Waiting on External", color: "#d97706" },
  { key: "needs_decision",       label: "Needs Decision",      color: "#dc2626" },
  { key: "approved_closed",      label: "Approved / Closed",   color: "#16a34a" },
];

const STATUS_COLOR = Object.fromEntries(COLS.map((c) => [c.key, c.color]));
const STATUS_LABEL = Object.fromEntries(COLS.map((c) => [c.key, c.label]));

const DISC_COLOR = {
  architecture:     { color: "#2563eb", bg: "#eff6ff" },
  mep:              { color: "#7c3aed", bg: "#f5f3ff" },
  structural:       { color: "#d97706", bg: "#fffbeb" },
  legal:            { color: "#dc2626", bg: "#fef2f2" },
  landscape:        { color: "#16a34a", bg: "#f0fdf4" },
  developer:        { color: "#0891b2", bg: "#ecfeff" },
  fire_protection:  { color: "#ea580c", bg: "#fff7ed" },
  sales:            { color: "#db2777", bg: "#fdf2f8" },
};

const PRI_COLOR = {
  critical: { color: "#dc2626", bg: "#fef2f2" },
  high:     { color: "#ea580c", bg: "#fff7ed" },
  medium:   { color: "#d97706", bg: "#fffbeb" },
  low:      { color: "#6b7280", bg: "#f3f4f6" },
};

const ACTION_MAP = {
  created:             { label: "Task created",        color: "#16a34a" },
  status_changed:      { label: "Status changed",      color: "#2563eb" },
  assigned:            { label: "Assignee changed",    color: "#7c3aed" },
  due_date_changed:    { label: "Due date changed",    color: "#d97706" },
  title_changed:       { label: "Title updated",       color: "#6b7280" },
  description_changed: { label: "Description updated", color: "#6b7280" },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtDateFull(d) {
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
  if (!d) return false;
  return new Date(d) < new Date();
}
function stageLabel(s) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarBg(id) {
  const palette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
  return palette[(id || 0) % palette.length];
}
function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, trend }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "14px 16px", flex: 1, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>{label}</span>
        {Icon && <Icon style={{ fontSize: 16, color: "#d1d5db" }} />}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", lineHeight: 1 }}>{value}</div>
      {sub && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
          {trend && <RiArrowUpLine style={{ fontSize: 11, color: "#16a34a" }} />}
          <span style={{ fontSize: "0.688rem", color: trend ? "#16a34a" : "#9ca3af" }}>{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Review Item Card ───────────────────────────────────────────────────────────

function ReviewCard({ item, onClick }) {
  const disc    = (item.discipline || "").toLowerCase().replace(/ /g, "_");
  const discCfg = DISC_COLOR[disc] || { color: "#6b7280", bg: "#f3f4f6" };
  const priCfg  = PRI_COLOR[item.priority] || PRI_COLOR.medium;
  const overdue = isOverdue(item.due_date) && item.status !== "approved_closed";
  const stageLbl = stageLabel(item.stage);

  return (
    <div
      onClick={() => onClick && onClick(item)}
      style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: "14px", cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s",
        width: 280, flexShrink: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#d1d5db"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RiMapPinLine style={{ fontSize: 14, color: "#9ca3af" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.719rem", fontWeight: 600, color: "#374151" }}>{item.project_name}</div>
            {item.project_location && (
              <div style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{item.project_location}</div>
            )}
          </div>
        </div>
        {stageLbl && (
          <span style={{ fontSize: "0.594rem", fontWeight: 600, padding: "2px 7px", borderRadius: 999,
            background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd", whiteSpace: "nowrap" }}>
            {stageLbl}
          </span>
        )}
      </div>

      <div style={{ fontSize: "0.812rem", fontWeight: 600, color: "#111827",
        lineHeight: 1.4, marginBottom: 8, display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.title}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.625rem", fontWeight: 600, padding: "2px 7px", borderRadius: 999,
          background: discCfg.bg, color: discCfg.color }}>
          {item.discipline || "General"}
        </span>
        <span style={{ fontSize: "0.625rem", fontWeight: 600, padding: "2px 7px", borderRadius: 999,
          background: `${STATUS_COLOR[item.status]}15`, color: STATUS_COLOR[item.status] || "#6b7280" }}>
          {STATUS_LABEL[item.status] || item.status}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {item.due_date && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: "0.625rem", color: overdue ? "#dc2626" : "#9ca3af", fontWeight: overdue ? 600 : 400 }}>
            <RiCalendarLine style={{ fontSize: 10 }} />
            {fmtDate(item.due_date)}{overdue ? " · Overdue" : ""}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.594rem", fontWeight: 700, padding: "2px 7px",
          borderRadius: 999, background: priCfg.bg, color: priCfg.color }}>
          {item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : "—"}
        </span>
        {item.is_escalated && (
          <RiAlertLine style={{ fontSize: 12, color: "#ef4444", flexShrink: 0 }} />
        )}
      </div>
    </div>
  );
}

// ── Item Group ─────────────────────────────────────────────────────────────────

function ItemGroup({ title, items, icon: Icon, color, onItemClick }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {Icon && <Icon style={{ fontSize: 15, color }} />}
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>{title}</span>
        <span style={{ fontSize: "0.688rem", fontWeight: 600, padding: "1px 7px", borderRadius: 999,
          background: color + "18", color }}>{items.length}</span>
        <span style={{ marginLeft: "auto", fontSize: "0.719rem", color: "#6b7280", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 2 }}>
          View all <RiArrowRightSLine style={{ fontSize: 13 }} />
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: "0.812rem", color: "#9ca3af", padding: "12px 0" }}>Nothing here</div>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} onClick={onItemClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kanban Task Card ───────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }) {
  const overdue = isOverdue(task.due_date) && task.status !== "approved_closed";
  return (
    <div
      onClick={() => onClick(task)}
      style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
        padding: "10px 12px", cursor: "pointer", transition: "box-shadow 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827", lineHeight: 1.4, marginBottom: 6 }}>
        {task.title}
      </div>
      {task.description && (
        <div style={{ fontSize: "0.688rem", color: "#6b7280", marginBottom: 8, lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {task.description}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.594rem", color: "#6b7280" }}>{task.project_name}</span>
        {task.due_date && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: "0.594rem", color: overdue ? "#dc2626" : "#9ca3af", marginLeft: "auto",
            fontWeight: overdue ? 600 : 400 }}>
            <RiCalendarLine style={{ fontSize: 10 }} />
            {fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Review Item Detail Drawer (My Work) ────────────────────────────────────────

function DetailDrawer({ item, onClose }) {
  if (!item) return null;
  const disc    = (item.discipline || "").toLowerCase().replace(/ /g, "_");
  const discCfg = DISC_COLOR[disc] || { color: "#6b7280", bg: "#f3f4f6" };
  const priCfg  = PRI_COLOR[item.priority] || PRI_COLOR.medium;
  const overdue = isOverdue(item.due_date) && item.status !== "approved_closed";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200,
        display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          width: 400, maxWidth: "90vw", height: "100%", background: "#fff",
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          animation: "shDrawerIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.688rem", fontWeight: 600, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {item.project_name}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
              {item.title}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
            color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 20 }}>
            <DrawerField label="Status">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                background: `${STATUS_COLOR[item.status] || "#6b7280"}15`,
                color: STATUS_COLOR[item.status] || "#6b7280" }}>
                {STATUS_LABEL[item.status] || item.status}
              </span>
            </DrawerField>
            <DrawerField label="Priority">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                background: priCfg.bg, color: priCfg.color }}>
                {item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : "—"}
              </span>
            </DrawerField>
            <DrawerField label="Discipline">
              <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 10px", borderRadius: 999,
                background: discCfg.bg, color: discCfg.color }}>
                {item.discipline || "—"}
              </span>
            </DrawerField>
            <DrawerField label="Due Date">
              <span style={{ fontSize: "0.8125rem", color: overdue ? "#dc2626" : "#374151",
                fontWeight: overdue ? 600 : 400 }}>
                {fmtDateFull(item.due_date) || "—"}{overdue ? " · Overdue" : ""}
              </span>
            </DrawerField>
            {item.stage && (
              <DrawerField label="Phase">
                <span style={{ fontSize: "0.8125rem", color: "#374151" }}>{stageLabel(item.stage)}</span>
              </DrawerField>
            )}
          </div>
          {item.description && (
            <div>
              <div style={{ fontSize: "0.688rem", fontWeight: 700, color: "#9ca3af",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Description</div>
              <div style={{ fontSize: "0.875rem", color: "#374151", lineHeight: 1.6,
                whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes shDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}

function DrawerField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Notification Panel ─────────────────────────────────────────────────────────

function NotifPanel({ notifications, onMarkRead, onMarkAll }) {
  const unread = notifications.filter((n) => !n.is_read);
  return (
    <div style={{
      position: "absolute", right: 0, top: "calc(100% + 8px)",
      width: 340, background: "#fff", borderRadius: 12,
      border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
      zIndex: 100, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px 10px", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>Notifications</span>
        {unread.length > 0 && (
          <button onClick={onMarkAll}
            style={{ fontSize: "0.75rem", color: "#2563eb", background: "none",
              border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ maxHeight: "22rem", overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", fontSize: "0.8125rem", color: "#9ca3af" }}>
            No notifications yet
          </div>
        ) : notifications.map((n) => (
          <div key={n.id}
            onClick={() => !n.is_read && onMarkRead(n.id)}
            style={{
              padding: "10px 16px", borderBottom: "1px solid #f9fafb", cursor: "pointer",
              background: n.is_read ? "transparent" : "#eff6ff",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = n.is_read ? "#fafafa" : "#dbeafe"}
            onMouseLeave={(e) => e.currentTarget.style.background = n.is_read ? "transparent" : "#eff6ff"}
          >
            <div style={{ fontSize: "0.8125rem", fontWeight: n.is_read ? 400 : 600, color: "#111827", marginBottom: 2 }}>
              {n.title}
            </div>
            {n.body && (
              <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
            )}
            <div style={{ fontSize: "0.6875rem", color: "#9ca3af" }}>{timeAgo(n.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comment Bubble ─────────────────────────────────────────────────────────────

function CommentBubble({ comment }) {
  const isMe = comment.author_type === "stakeholder";
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14,
      flexDirection: isMe ? "row-reverse" : "row" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: avatarBg(comment.author_id), color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.625rem", fontWeight: 700, marginTop: 2 }}>
        {getInitials(comment.author_name || "?")}
      </div>
      <div style={{ maxWidth: "75%", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6,
          flexDirection: isMe ? "row-reverse" : "row", marginBottom: 3 }}>
          <span style={{ fontSize: "0.719rem", fontWeight: 600, color: "#374151" }}>
            {comment.author_name || (isMe ? "You" : "Builder")}
          </span>
          <span style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{timeAgo(comment.created_at)}</span>
        </div>
        <div style={{
          background: isMe ? "#ede9fe" : "#f9fafb",
          border: `1px solid ${isMe ? "#ddd6fe" : "#e5e7eb"}`,
          borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
          padding: "8px 12px", fontSize: "0.8125rem", color: "#111827",
          lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {comment.content}
        </div>
      </div>
    </div>
  );
}

// ── Activity Entry ─────────────────────────────────────────────────────────────

function ActivityEntry({ entry }) {
  const cfg = ACTION_MAP[entry.action] || { label: entry.action, color: "#9ca3af" };
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #f9fafb" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
        background: cfg.color + "18", display: "flex", alignItems: "center",
        justifyContent: "center", marginTop: 2 }}>
        <RiTimeLine style={{ fontSize: 11, color: cfg.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8125rem", color: "#111827", lineHeight: 1.4 }}>
          <span style={{ fontWeight: 500 }}>{cfg.label}</span>
          {entry.new_value && (
            <span style={{ color: cfg.color, fontWeight: 600 }}> → {entry.new_value}</span>
          )}
        </div>
        {entry.old_value && entry.new_value && (
          <div style={{ fontSize: "0.688rem", color: "#9ca3af" }}>
            from <span style={{ textDecoration: "line-through" }}>{entry.old_value}</span>
          </div>
        )}
        <div style={{ fontSize: "0.625rem", color: "#9ca3af", marginTop: 2 }}>
          {entry.actor_name} · {timeAgo(entry.created_at)}
        </div>
      </div>
    </div>
  );
}

// ── Attachment Row ─────────────────────────────────────────────────────────────

function AttachmentRow({ attachment }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
      borderBottom: "1px solid #f9fafb" }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f3f4f6",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <RiFileTextLine style={{ fontSize: 14, color: "#9ca3af" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#111827",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {attachment.filename || attachment.original_name || "Attachment"}
        </div>
        <div style={{ fontSize: "0.625rem", color: "#9ca3af", marginTop: 1 }}>
          {fmtSize(attachment.file_size)}{attachment.file_size ? " · " : ""}{fmtDate(attachment.created_at)}
        </div>
      </div>
      <button
        onClick={() => downloadAttachment(attachment.id).catch(() => toast.error("Download failed"))}
        style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6,
          cursor: "pointer", padding: "4px 10px", fontSize: "0.688rem", color: "#374151",
          display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
          transition: "border-color 0.1s" }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#9ca3af"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e5e7eb"}
      >
        <RiDownloadLine style={{ fontSize: 11 }} />
        Download
      </button>
    </div>
  );
}

// ── Task Detail Drawer (Kanban) ────────────────────────────────────────────────

function TaskDetailDrawer({ task, onClose, latestSseNotif }) {
  const [activeTab,      setActiveTab]      = useState("discussion");
  const [comments,       setComments]       = useState([]);
  const [history,        setHistory]        = useState([]);
  const [attachments,    setAttachments]    = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingHistory,  setLoadingHistory]  = useState(false);
  const [loadingAssets,   setLoadingAssets]   = useState(false);
  const [commentText,    setCommentText]    = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!task) return;
    fetchComments();
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;
    if (activeTab === "activity" && history.length === 0) fetchHistory();
    if (activeTab === "assets"   && attachments.length === 0) fetchAssets();
  }, [activeTab]);

  // Auto-refresh discussion when builder posts a comment on this task via SSE
  useEffect(() => {
    if (!latestSseNotif || !task) return;
    if (latestSseNotif.type === "task_comment") {
      const incomingId = latestSseNotif.data?.task_id ?? latestSseNotif.task_id;
      if (incomingId === task.id) {
        fetchComments();
        if (activeTab !== "discussion") setActiveTab("discussion");
      }
    }
  }, [latestSseNotif]);

  async function fetchComments() {
    setLoadingComments(true);
    try {
      const r = await getStakeholderTaskComments(task.project_id, task.id);
      setComments(r?.data || r || []);
    } catch {}
    finally { setLoadingComments(false); }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const r = await getStakeholderTaskHistory(task.project_id, task.id);
      setHistory(r?.data || r || []);
    } catch {}
    finally { setLoadingHistory(false); }
  }

  async function fetchAssets() {
    setLoadingAssets(true);
    try {
      const r = await getTaskAttachments(task.project_id, task.id);
      setAttachments(r?.data || r || []);
    } catch {}
    finally { setLoadingAssets(false); }
  }

  async function handleSend() {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await addStakeholderTaskComment(task.project_id, task.id, commentText.trim());
      const newComment = r?.data || r;
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err.message || "Failed to send");
    } finally { setSubmitting(false); }
  }

  const overdue = isOverdue(task.due_date) && task.status !== "approved_closed";

  const TABS = [
    { key: "discussion", label: "Discussion", icon: RiChat3Line },
    { key: "activity",   label: "Activity",   icon: RiTimeLine },
    { key: "assets",     label: "Assets",     icon: RiAttachment2 },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200,
        display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480, maxWidth: "92vw", height: "100%", background: "#fff",
          display: "flex", flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          animation: "shDrawerIn 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #f3f4f6",
          display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.688rem", fontWeight: 600, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {task.project_name}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
              {task.title}
            </div>
            {task.description && (
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4, lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {task.description}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: "0.688rem", fontWeight: 600, padding: "3px 8px",
              borderRadius: 999, background: `${STATUS_COLOR[task.status] || "#6b7280"}18`,
              color: STATUS_COLOR[task.status] || "#6b7280" }}>
              {STATUS_LABEL[task.status] || task.status}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none",
              cursor: "pointer", color: "#9ca3af", fontSize: 18, padding: 4,
              lineHeight: 1, borderRadius: 4 }}>✕</button>
          </div>
        </div>

        {/* Meta row */}
        {(task.due_date || task.review_item_title) && (
          <div style={{ padding: "7px 18px", borderBottom: "1px solid #f3f4f6",
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {task.due_date && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: "0.688rem", color: overdue ? "#dc2626" : "#6b7280",
                fontWeight: overdue ? 600 : 400 }}>
                <RiCalendarLine style={{ fontSize: 12 }} />
                {fmtDateFull(task.due_date)}{overdue ? " · Overdue" : ""}
              </span>
            )}
            {task.review_item_title && (
              <span style={{ fontSize: "0.688rem", color: "#9ca3af" }}>
                {task.review_item_title}
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "0 18px" }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "10px 14px 8px", border: "none", background: "none", cursor: "pointer",
              fontSize: "0.8125rem", fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? "#7c3aed" : "#6b7280",
              borderBottom: activeTab === key ? "2px solid #7c3aed" : "2px solid transparent",
              marginBottom: -1, transition: "color 0.1s", fontFamily: "inherit",
            }}>
              <Icon style={{ fontSize: 14 }} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Discussion */}
          {activeTab === "discussion" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
                {loadingComments ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
                    <RiLoader4Line style={{ fontSize: 20, animation: "spin 1s linear infinite" }} />
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#9ca3af",
                    fontSize: "0.8125rem" }}>
                    <RiChat3Line style={{ fontSize: 28, marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                    No messages yet. Start the conversation.
                  </div>
                ) : (
                  comments.map((c) => <CommentBubble key={c.id} comment={c} />)
                )}
                <div ref={commentsEndRef} />
              </div>
              <div style={{ padding: "12px 18px 16px", borderTop: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
                    rows={2}
                    style={{
                      flex: 1, resize: "none", border: "1px solid #e5e7eb", borderRadius: 8,
                      padding: "8px 12px", fontSize: "0.8125rem", color: "#111827",
                      fontFamily: "inherit", outline: "none", lineHeight: 1.5,
                      transition: "border-color 0.1s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#7c3aed"}
                    onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!commentText.trim() || submitting}
                    style={{
                      width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
                      background: commentText.trim() ? "#7c3aed" : "#e5e7eb",
                      color: commentText.trim() ? "#fff" : "#9ca3af",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, transition: "background 0.15s", flexShrink: 0,
                    }}
                  >
                    {submitting
                      ? <RiLoader4Line style={{ animation: "spin 1s linear infinite" }} />
                      : <RiSendPlaneLine />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Activity */}
          {activeTab === "activity" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
                  <RiLoader4Line style={{ fontSize: 20, animation: "spin 1s linear infinite" }} />
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#9ca3af",
                  fontSize: "0.8125rem" }}>
                  <RiTimeLine style={{ fontSize: 28, display: "block", margin: "0 auto 8px" }} />
                  No activity recorded yet
                </div>
              ) : (
                history.map((entry) => <ActivityEntry key={entry.id} entry={entry} />)
              )}
            </div>
          )}

          {/* Assets */}
          {activeTab === "assets" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
              {loadingAssets ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
                  <RiLoader4Line style={{ fontSize: 20, animation: "spin 1s linear infinite" }} />
                </div>
              ) : attachments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#9ca3af",
                  fontSize: "0.8125rem" }}>
                  <RiAttachment2 style={{ fontSize: 28, display: "block", margin: "0 auto 8px" }} />
                  No assets attached to this task
                </div>
              ) : (
                attachments.map((att) => <AttachmentRow key={att.id} attachment={att} />)
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes shDrawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function StakeholderPage() {
  const router = useRouter();
  const [tab,             setTab]            = useState("mywork");
  const [myWork,          setMyWork]         = useState(null);
  const [kanban,          setKanban]         = useState(null);
  const [loading,         setLoading]        = useState(true);
  const [me,              setMe]             = useState(null);
  const [notifications,   setNotifications]  = useState([]);
  const [showNotif,       setShowNotif]      = useState(false);
  const [selectedItem,    setSelectedItem]   = useState(null);  // My Work review items
  const [selectedTask,    setSelectedTask]   = useState(null);  // Kanban tasks
  const [latestSseNotif,  setLatestSseNotif] = useState(null);
  const notifRef = useRef(null);
  const sseRef   = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    Promise.all([
      getMyWork().then((r)            => setMyWork(r?.data || r)),
      getStakeholderKanban().then((r) => setKanban(r?.data || r)),
      getNotifications().then((r)     => setNotifications((r?.data || []).slice().reverse())),
      getMe().then((r)                => setMe(r?.data || r)),
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
          setLatestSseNotif(notif);
          toast(notif.title, { icon: "🔔" });
        } catch {}
      };
      sseRef.current = es;
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

  const dueItems      = myWork?.due_this_week      || [];
  const waitingItems  = myWork?.waiting_on_external || [];
  const escalations   = myWork?.escalations         || [];
  const openCount     = dueItems.length + waitingItems.length + escalations.length;
  const blockers      = escalations.filter((e) => e.priority === "critical" || e.priority === "high");
  const recentNotifs  = notifications.slice(0, 6);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9fafb",
      fontFamily: "var(--font-inter), Inter, sans-serif" }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        width: 200, background: "#fff", borderRight: "1px solid #e5e7eb",
        display: "flex", flexDirection: "column", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "18px 16px 14px", display: "flex", alignItems: "center", gap: 8,
          borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ width: 24, height: 24, background: "#111827", borderRadius: 6, flexShrink: 0,
            position: "relative" }}>
            <div style={{ position: "absolute", inset: 6, background: "#fff", borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>Infinium</span>
          <span style={{ fontSize: "0.563rem", fontWeight: 600, color: "#6b7280", background: "#f3f4f6",
            border: "1px solid #e5e7eb", borderRadius: 99, padding: "1px 6px",
            textTransform: "uppercase", letterSpacing: "0.04em" }}>Portal</span>
        </div>

        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {[
            { key: "mywork",  label: "My Work",  icon: RiBriefcase2Line },
            { key: "kanban",  label: "Kanban",   icon: RiLayoutColumnLine },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === key ? "#f5f3ff" : "transparent",
              color: tab === key ? "#7c3aed" : "#6b7280",
              fontWeight: tab === key ? 600 : 400, fontSize: "0.8125rem",
              fontFamily: "inherit", marginBottom: 2, transition: "all 0.1s",
            }}>
              <Icon style={{ fontSize: 16, flexShrink: 0 }} />
              {label}
              {key === "mywork" && unreadCount > 0 && (
                <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff",
                  fontSize: "0.563rem", fontWeight: 700, borderRadius: 99,
                  padding: "1px 5px", minWidth: 16, textAlign: "center" }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {me && (
          <div style={{ padding: "12px 12px 16px", borderTop: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: avatarBg(me.id), color: "#fff", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700 }}>
                {getInitials(me.name || me.email || "?")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#111827",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me.name || me.email}
                </div>
                {me.role && (
                  <div style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{me.role}</div>
                )}
              </div>
              <button onClick={() => { clearTokens(); router.push("/login"); }}
                title="Sign out"
                style={{ background: "none", border: "none", cursor: "pointer",
                  color: "#d1d5db", fontSize: 14, padding: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#d1d5db"}
              >
                <RiLogoutBoxLine />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Center content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{
          height: 52, background: "#fff", borderBottom: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", position: "sticky", top: 0, zIndex: 40, flexShrink: 0,
        }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>
            {tab === "mywork" ? "My Work" : "Kanban"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem",
              color: "#374151", background: "#f0fdf4", padding: "4px 10px",
              borderRadius: 99, border: "1px solid #bbf7d0" }}>
              <RiMailLine style={{ fontSize: 12 }} />
              <span style={{ fontWeight: 500 }}>Gmail Connected</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            </div>
            <div style={{ position: "relative" }} ref={notifRef}>
              <button onClick={() => setShowNotif((v) => !v)}
                style={{ position: "relative", background: "none", border: "none",
                  cursor: "pointer", color: "#374151", fontSize: 18, width: 32, height: 32,
                  borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <RiBellLine />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: 0, right: 0,
                    background: "#ef4444", color: "#fff", fontSize: "0.5625rem",
                    fontWeight: 700, borderRadius: 99, minWidth: 16, height: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px", border: "1.5px solid #fff" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%",
                  background: avatarBg(me.id), color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 700 }}>
                  {getInitials(me.name || me.email || "?")}
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#111827" }}>
                    {me.name || me.email}
                  </div>
                  {me.role && (
                    <div style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{me.role}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main scrollable content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 12, padding: "4rem", color: "#9ca3af" }}>
              <RiLoader4Line style={{ fontSize: 28, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "0.875rem" }}>Loading your workspace…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : tab === "mywork" ? (
            <MyWorkContent
              me={me}
              dueItems={dueItems}
              waitingItems={waitingItems}
              escalations={escalations}
              openCount={openCount}
              onItemClick={setSelectedItem}
            />
          ) : (
            <KanbanContent kanban={kanban} onTaskClick={setSelectedTask} />
          )}
        </main>
      </div>

      {/* ── Right Panel (My Work only) ── */}
      {tab === "mywork" && !loading && (
        <aside style={{
          width: 280, background: "#fff", borderLeft: "1px solid #e5e7eb",
          overflowY: "auto", flexShrink: 0, padding: "20px 0",
        }}>
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#111827" }}>Recent Thread Updates</span>
              <span style={{ fontSize: "0.688rem", color: "#6b7280", cursor: "pointer" }}>View all</span>
            </div>
            {recentNotifs.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "4px 0" }}>No updates yet</div>
            ) : (
              recentNotifs.map((n) => (
                <div key={n.id} style={{ display: "flex", gap: 8, padding: "6px 0",
                  borderBottom: "1px solid #f9fafb" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: avatarBg(n.id), color: "#fff", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "0.594rem", fontWeight: 700 }}>
                    {n.title?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.719rem", fontWeight: n.is_read ? 400 : 600,
                      color: "#111827", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}>{n.title}</div>
                    {n.body && (
                      <div style={{ fontSize: "0.625rem", color: "#6b7280",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.563rem", color: "#9ca3af", flexShrink: 0, marginTop: 2 }}>
                    {timeAgo(n.created_at)}
                  </span>
                  {!n.is_read && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%",
                      background: "#3b82f6", flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0 16px" }} />

          <div style={{ padding: "0 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#111827" }}>Active Blockers</span>
            </div>
            {blockers.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "4px 0" }}>No active blockers</div>
            ) : (
              blockers.map((item) => {
                const priCfg = PRI_COLOR[item.priority] || PRI_COLOR.high;
                return (
                  <div key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{ display: "flex", gap: 8, padding: "7px 0",
                      borderBottom: "1px solid #f9fafb", cursor: "pointer" }}>
                    <RiAlertLine style={{ fontSize: 14, color: priCfg.color, flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.719rem", fontWeight: 600, color: "#111827",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "0.625rem", color: "#9ca3af", marginTop: 2 }}>
                        {item.project_name}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.594rem", fontWeight: 700, padding: "1px 6px",
                      borderRadius: 999, background: priCfg.bg, color: priCfg.color,
                      flexShrink: 0, alignSelf: "flex-start" }}>
                      {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* My Work review item detail drawer */}
      {selectedItem && (
        <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Kanban task detail drawer with Discussion / Activity / Assets */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          latestSseNotif={latestSseNotif}
        />
      )}
    </div>
  );
}

// ── My Work Content ────────────────────────────────────────────────────────────

function MyWorkContent({ me, dueItems, waitingItems, escalations, openCount, onItemClick }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: avatarBg(me?.id), color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.125rem", fontWeight: 700 }}>
            {getInitials(me?.name || me?.email || "?")}
          </div>
          <div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
              {me?.name || me?.email || "—"}
            </div>
            {me?.role && (
              <div style={{ fontSize: "0.812rem", color: "#6b7280", marginTop: 2 }}>{me.role}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize: "0.719rem", color: "#9ca3af" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Open Items"        value={openCount}          icon={RiFileTextLine} sub="Across all sites" />
        <StatCard label="Due This Week"     value={dueItems.length}    icon={RiCalendarLine} sub={`${dueItems.length} items`} />
        <StatCard label="Waiting on Others" value={waitingItems.length} icon={RiTimeLine}    sub="Pending external" />
        <StatCard label="Escalations"       value={escalations.length} icon={RiAlertLine}   sub={escalations.length > 0 ? "Needs attention" : "All clear"} trend={escalations.length > 0} />
      </div>

      <ItemGroup title="Due This Week"     items={dueItems}     icon={RiCalendarLine} color="#dc2626" onItemClick={onItemClick} />
      <ItemGroup title="Waiting on Others" items={waitingItems} icon={RiTimeLine}     color="#d97706" onItemClick={onItemClick} />
      <ItemGroup title="Escalations"       items={escalations}  icon={RiAlertLine}    color="#7c3aed" onItemClick={onItemClick} />
    </div>
  );
}

// ── Kanban Content ─────────────────────────────────────────────────────────────

function KanbanContent({ kanban, onTaskClick }) {
  if (!kanban) return (
    <div style={{ textAlign: "center", padding: "4rem", color: "#9ca3af", fontSize: "0.875rem" }}>
      No kanban data available
    </div>
  );
  const cols = kanban.columns || {};
  return (
    <div style={{ display: "flex", gap: 14, overflowX: "auto", alignItems: "flex-start", paddingBottom: 8 }}>
      {COLS.map((col) => {
        const items = cols[col.key] || [];
        return (
          <div key={col.key} style={{ flex: "0 0 240px", minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151" }}>{col.label}</span>
              <span style={{ fontSize: "0.688rem", color: "#9ca3af", background: "#f3f4f6",
                borderRadius: 99, padding: "1px 6px" }}>{items.length}</span>
            </div>
            <div>
              {items.length === 0 ? (
                <div style={{ padding: "20px 12px", textAlign: "center", fontSize: "0.75rem",
                  color: "#d1d5db", border: "1.5px dashed #e5e7eb", borderRadius: 8 }}>
                  No items
                </div>
              ) : items.map((t) => (
                <KanbanCard key={t.id} task={t} onClick={onTaskClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
