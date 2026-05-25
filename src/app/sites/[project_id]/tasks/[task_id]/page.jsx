"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCalendarLine,
  RiAttachment2,
  RiChat3Line,
  RiAlertLine,
  RiDownload2Line,
  RiFilePdfLine,
  RiFileImageLine,
  RiFileTextLine,
  RiHistoryLine,
  RiArrowRightLine,
  RiTimeLine,
  RiUserLine,
} from "react-icons/ri";
import Sidebar from "../../../../../components/Sidebar";
import toast from "react-hot-toast";
import {
  getProject,
  getProjectKanban,
  getTaskAttachments,
  getTaskHistory,
} from "../../../../../lib/api";
import {
  DISC_LABEL,
  DISC_KEY,
  DISC_TAG_CLASS,
  DISC_ICON,
  RI_ACCENT_COLORS,
  getInitials,
  avatarColor,
  formatDate,
  formatLongDate,
  Avatar,
} from "../../../utils";
import "../../../sites.css";

/* ── Constants ── */
const TASK_STATUS_LABEL = {
  new:                 "New",
  in_review:           "In Review",
  waiting_on_external: "Waiting on External",
  needs_decision:      "Needs Decision",
  closed:              "Approved / Closed",
  open:                "New",
  in_progress:         "In Review",
  blocked:             "Needs Decision",
  done:                "Approved / Closed",
};

const STATUS_COLOR = {
  new:                 { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  in_review:           { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  waiting_on_external: { bg: "#fefce8", text: "#a16207", dot: "#eab308" },
  needs_decision:      { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  closed:              { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  open:                { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  in_progress:         { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  blocked:             { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  done:                { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
};

const PRIORITY_COLOR = {
  high:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  medium: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  low:    { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
};

const STATUS_COMPAT = {
  open:        "new",
  in_progress: "in_review",
  blocked:     "needs_decision",
  done:        "closed",
};

/* ── Helpers ── */
function fileIcon(filename = "") {
  const ext = filename.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return RiFilePdfLine;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return RiFileImageLine;
  return RiFileTextLine;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}

function fullTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Loading shell ── */
function LoadingShell() {
  return (
    <div className="sitesShell">
      <Sidebar />
      <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Loading…</div>
      </div>
      <div className="rightPanel" />
      <div className="topNav" />
    </div>
  );
}

/* ── History timeline entry ── */
function HistoryEntry({ entry }) {
  const isMove   = entry.type === "status_change" || entry.from_status || entry.to_status;
  const fromLabel = TASK_STATUS_LABEL[entry.from_status] || entry.from_status || "";
  const toLabel   = TASK_STATUS_LABEL[entry.to_status]   || entry.to_status   || "";
  const toColor   = STATUS_COLOR[entry.to_status] || STATUS_COLOR.new;
  const initials  = getInitials(entry.actor_name || entry.changed_by || "?");
  const color     = avatarColor(entry.actor_id || 0);

  return (
    <div className="tdHistoryEntry">
      <div className="tdHistoryAvatarCol">
        <div className="tdHistoryAvatar" style={{ background: color }}>{initials}</div>
        <div className="tdHistoryLine" />
      </div>
      <div className="tdHistoryContent">
        <div className="tdHistoryTop">
          <span className="tdHistoryActor">{entry.actor_name || entry.changed_by || "Someone"}</span>
          {isMove ? (
            <span className="tdHistoryAction">
              moved task
              {fromLabel && (
                <> from <span className="tdHistoryFrom">{fromLabel}</span></>
              )}
              {toLabel && (
                <> to <span className="tdHistoryTo" style={{ background: toColor.bg, color: toColor.text }}>{toLabel}</span></>
              )}
            </span>
          ) : (
            <span className="tdHistoryAction">{entry.description || "updated task"}</span>
          )}
        </div>
        <div className="tdHistoryTime" title={fullTime(entry.created_at || entry.changed_at)}>
          <RiTimeLine style={{ fontSize: 11 }} />
          {timeAgo(entry.created_at || entry.changed_at)}
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function TaskDetailPage() {
  const router = useRouter();
  const { project_id, task_id } = useParams();
  const projectId = parseInt(project_id, 10);
  const taskId    = parseInt(task_id, 10);

  const [loading,     setLoading]     = useState(true);
  const [project,     setProject]     = useState(null);
  const [task,        setTask]        = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [history,     setHistory]     = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projRes, kanbanRes, attRes, histRes] = await Promise.all([
          getProject(projectId),
          getProjectKanban(projectId),
          getTaskAttachments(projectId, taskId).catch(() => ({ data: [] })),
          getTaskHistory(projectId, taskId).catch(() => ({ data: [] })),
        ]);

        setProject(projRes?.data || null);
        setAttachments(attRes?.data || []);
        setHistory(histRes?.data || []);

        const cols = kanbanRes?.data?.columns || {};
        const normalizedCols = {};
        Object.entries(cols).forEach(([status, tasks]) => {
          const key = STATUS_COMPAT[status] || status;
          normalizedCols[key] = [...(normalizedCols[key] || []), ...tasks];
        });

        const allTasks = Object.values(normalizedCols).flat();
        const riIds = [...new Set(allTasks.map((t) => t.review_item_id).filter(Boolean))].sort((a, b) => a - b);
        const riColorMap = Object.fromEntries(riIds.map((id, i) => [id, RI_ACCENT_COLORS[i % RI_ACCENT_COLORS.length]]));

        const found = allTasks.find((t) => t.id === taskId);
        if (found) {
          setTask({
            ...found,
            desc:    found.description,
            disc:    DISC_LABEL[found.discipline] || "Other",
            discKey: DISC_KEY[found.discipline]   || "Dev",
            av:      getInitials(found.stakeholder_name || ""),
            avColor: avatarColor(found.stakeholder_id),
            riColor: riColorMap[found.review_item_id] || RI_ACCENT_COLORS[0],
          });
        }
      } catch (err) {
        toast.error(err.message || "Failed to load task");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, taskId]);

  if (loading) return <LoadingShell />;

  if (!task) {
    return (
      <div className="sitesShell">
        <Sidebar />
        <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Task not found</div>
            <div style={{ fontSize: "0.812rem", color: "#2563eb", cursor: "pointer" }}
              onClick={() => router.push(`/sites/${projectId}`)}>
              ← Back to project
            </div>
          </div>
        </div>
        <div className="rightPanel" />
        <div className="topNav" />
      </div>
    );
  }

  const isOverdue     = task.is_overdue;
  const riColor       = task.riColor || RI_ACCENT_COLORS[0];
  const borderColor   = isOverdue ? "#ef4444" : riColor.border;
  const tagClass      = DISC_TAG_CLASS[task.discKey] || "tagDev";
  const DiscIcon      = DISC_ICON[task.discipline]  || RiAlertLine;
  const statusKey     = STATUS_COMPAT[task.status] || task.status || "new";
  const statusLabel   = TASK_STATUS_LABEL[statusKey];
  const statusColors  = STATUS_COLOR[statusKey] || STATUS_COLOR.new;
  const priorityKey   = (task.priority || "medium").toLowerCase();
  const priorityLabel = priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1);
  const priColors     = PRIORITY_COLOR[priorityKey] || PRIORITY_COLOR.medium;

  return (
    <div className="sitesShell">
      <Sidebar />

      {/* ── Main ── */}
      <div className="main">
        <div className="breadcrumbBar">
          <span className="breadcrumbLink" onClick={() => router.push("/sites")}>Sites</span>
          <span className="breadcrumbSep">›</span>
          <span className="breadcrumbLink" onClick={() => router.push(`/sites/${projectId}`)}>
            {project?.name || "Project"}
          </span>
          <span className="breadcrumbSep">›</span>
          <span className="breadcrumbCurrent">{task.title}</span>
        </div>

        <div className="tdBody">

          {/* ── Header card ── */}
          <div className="tdHeaderCard" style={{ borderTopColor: borderColor }}>
            <div className="tdHeaderTop">
              <span className={`tag ${tagClass}`}>
                <DiscIcon style={{ fontSize: 10, marginRight: 3, verticalAlign: "middle" }} />
                {task.disc}
              </span>
              {isOverdue && (
                <span className="tdOverduePill">Overdue</span>
              )}
            </div>
            <h1 className="tdTitle">{task.title}</h1>
            <div className="tdStatusRow">
              <span className="tdStatusBadge" style={{ background: statusColors.bg, color: statusColors.text }}>
                <span className="tdStatusDot" style={{ background: statusColors.dot }} />
                {statusLabel}
              </span>
              <span className="tdPriorityBadge" style={{ background: priColors.bg, color: priColors.text }}>
                <span className="tdStatusDot" style={{ background: priColors.dot }} />
                {priorityLabel} priority
              </span>
            </div>
          </div>

          {/* ── Meta card ── */}
          <div className="tdCard">
            <div className="tdCardTitle">Details</div>
            <div className="tdMetaGrid">
              <div className="tdMetaItem">
                <div className="tdMetaLabel">Assignee</div>
                <div className="tdMetaValue">
                  {task.av
                    ? <Avatar initials={task.av} color={task.avColor} size="Sm" />
                    : <div className="tdMetaNoAvatar"><RiUserLine style={{ fontSize: 13 }} /></div>}
                  <span>{task.stakeholder_name || "Unassigned"}</span>
                </div>
              </div>
              <div className="tdMetaItem">
                <div className="tdMetaLabel">Due Date</div>
                <div className={`tdMetaValue${isOverdue ? " tdOverdueText" : ""}`}>
                  <RiCalendarLine style={{ fontSize: 13 }} />
                  {task.due_date ? formatLongDate(task.due_date) : "No due date"}
                </div>
              </div>
              {task.review_item_title && (
                <div className="tdMetaItem" style={{ gridColumn: "1 / -1" }}>
                  <div className="tdMetaLabel">Review Item</div>
                  <div className="tdMetaValue tdMetaReviewItem">
                    {task.review_item_title}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Description card ── */}
          {task.desc && (
            <div className="tdCard">
              <div className="tdCardTitle">Description</div>
              <p className="tdDesc">{task.desc}</p>
            </div>
          )}

          {/* ── Attachments card ── */}
          <div className="tdCard">
            <div className="tdCardTitle">
              Attachments
              {attachments.length > 0 && <span className="tdCardCount">{attachments.length}</span>}
            </div>
            {attachments.length === 0 ? (
              <div className="tdEmpty">No attachments</div>
            ) : (
              <div className="tdAttachmentList">
                {attachments.map((a, i) => {
                  const Icon = fileIcon(a.filename || a.file_url || "");
                  return (
                    <div key={a.id || i} className="tdAttachment">
                      <div className="tdAttachmentIcon">
                        <Icon style={{ fontSize: 15 }} />
                      </div>
                      <span className="tdAttachmentName">{a.filename || a.file_url || "File"}</span>
                      {a.file_url && (
                        <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                          className="tdAttachmentDownload" onClick={(e) => e.stopPropagation()}>
                          <RiDownload2Line style={{ fontSize: 13 }} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Counts footer ── */}
          <div className="tdCounts">
            <span className="tdCount"><RiChat3Line style={{ fontSize: 14 }} />{task.comment_count || 0} comments</span>
            <span className="tdCount"><RiAttachment2 style={{ fontSize: 14 }} />{task.attachment_count || 0} attachments</span>
          </div>

        </div>
      </div>

      {/* ── Right Panel: History ── */}
      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiHistoryLine className="iconSize15" />
            Activity History
          </div>
        </div>
        <div className="rightPanelBody">
          {history.length === 0 ? (
            <div className="tdHistoryEmpty">
              <RiHistoryLine style={{ fontSize: 22, color: "#d1d5db", marginBottom: "0.5rem" }} />
              <div style={{ fontSize: "0.812rem", color: "#9ca3af", fontWeight: 500 }}>No activity yet</div>
              <div style={{ fontSize: "0.719rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                Status changes will appear here
              </div>
            </div>
          ) : (
            <div className="tdHistoryList">
              {history.map((entry, i) => (
                <HistoryEntry key={entry.id || i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Nav ── */}
      <div className="topNav">
        <div className="topNavLeft">
          <button className="tdBackBtn" onClick={() => router.push(`/sites/${projectId}`)}>
            <RiArrowLeftLine style={{ fontSize: "0.875rem" }} />
            {project?.name || "Back to project"}
          </button>
        </div>
        <div className="topNavRight" />
      </div>
    </div>
  );
}
