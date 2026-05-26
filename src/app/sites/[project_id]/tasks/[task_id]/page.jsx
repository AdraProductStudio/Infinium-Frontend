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
  getTaskComments,
  addTaskComment,
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
  new:              "New",
  in_review:        "In Review",
  pending_approval: "Pending Approval",
  needs_decision:   "Needs Decision",
  approved_closed:  "Approved / Closed",
};

const STATUS_COLOR = {
  new:              { bg: "#f3f4f6", text: "#374151",  dot: "#9ca3af" },
  in_review:        { bg: "#f5f3ff", text: "#6d28d9",  dot: "#8b5cf6" },
  pending_approval: { bg: "#fffbeb", text: "#d97706",  dot: "#f59e0b" },
  needs_decision:   { bg: "#fff7ed", text: "#c2410c",  dot: "#f97316" },
  approved_closed:  { bg: "#f0fdf4", text: "#15803d",  dot: "#22c55e" },
};

const PRIORITY_COLOR = {
  high:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  medium: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  low:    { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
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
  const action = entry.action || "";
  const isMove     = action === "status_changed";
  const isAssign   = action === "assigned";
  const isCreated  = action === "created";
  const fromLabel  = TASK_STATUS_LABEL[entry.old_value] || entry.old_value || "";
  const toLabel    = TASK_STATUS_LABEL[entry.new_value] || entry.new_value || "";
  const toColor    = STATUS_COLOR[entry.new_value] || STATUS_COLOR.new;
  const initials   = getInitials(entry.actor_name || "?");
  const color      = avatarColor(entry.changed_by_id || 0);

  function renderAction() {
    if (isCreated) return <span className="tdHistoryAction">created this task</span>;
    if (isMove) return (
      <span className="tdHistoryAction">
        moved task
        {fromLabel && <> from <span className="tdHistoryFrom">{fromLabel}</span></>}
        {toLabel   && <> to <span className="tdHistoryTo" style={{ background: toColor.bg, color: toColor.text }}>{toLabel}</span></>}
      </span>
    );
    if (isAssign) return (
      <span className="tdHistoryAction">
        {entry.old_value ? "reassigned" : "assigned"} to{" "}
        <strong>{entry.new_value || "Unassigned"}</strong>
        {entry.old_value && <> (was <span className="tdHistoryFrom">{entry.old_value}</span>)</>}
      </span>
    );
    const labelMap = {
      due_date_changed:  "updated due date",
      title_changed:     "renamed task",
      description_changed: "updated description",
    };
    return <span className="tdHistoryAction">{labelMap[action] || action.replace(/_/g, " ")}</span>;
  }

  return (
    <div className="tdHistoryEntry">
      <div className="tdHistoryAvatarCol">
        <div className="tdHistoryAvatar" style={{ background: color }}>{initials}</div>
        <div className="tdHistoryLine" />
      </div>
      <div className="tdHistoryContent">
        <div className="tdHistoryTop">
          <span className="tdHistoryActor">{entry.actor_name || "Someone"}</span>
          {renderAction()}
        </div>
        <div className="tdHistoryTime">
          <RiTimeLine style={{ fontSize: 11 }} />
          {fullTime(entry.created_at)}
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
  const [comments,    setComments]    = useState([]);
  const [commentText, setCommentText] = useState("");
  const [posting,     setPosting]     = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projRes, kanbanRes, attRes, histRes, commRes] = await Promise.all([
          getProject(projectId),
          getProjectKanban(projectId),
          getTaskAttachments(projectId, taskId).catch(() => ({ data: [] })),
          getTaskHistory(projectId, taskId).catch(() => ({ data: [] })),
          getTaskComments(projectId, taskId).catch(() => ({ data: [] })),
        ]);

        setProject(projRes?.data || null);
        setAttachments(attRes?.data || []);
        setHistory(histRes?.data || []);
        setComments(commRes?.data || []);

        const cols = kanbanRes?.data?.columns || {};
        const allTasks = Object.values(cols).flat();
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

  async function handlePostComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const res = await addTaskComment(projectId, taskId, commentText.trim());
      setComments((prev) => [...prev, res?.data || res]);
      setCommentText("");
    } catch (err) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  const isOverdue     = task.is_overdue;
  const riColor       = task.riColor || RI_ACCENT_COLORS[0];
  const borderColor   = isOverdue ? "#ef4444" : riColor.border;
  const tagClass      = DISC_TAG_CLASS[task.discKey] || "tagDev";
  const DiscIcon      = DISC_ICON[task.discipline]  || RiAlertLine;
  const statusKey    = task.status || "new";
  const statusLabel  = TASK_STATUS_LABEL[statusKey] || statusKey;
  const statusColors = STATUS_COLOR[statusKey] || STATUS_COLOR.new;
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

          {/* ── Discussion card ── */}
          <div className="tdCard">
            <div className="tdCardTitle">
              Discussion
              {comments.length > 0 && <span className="tdCardCount">{comments.length}</span>}
            </div>

            {comments.length === 0 ? (
              <div className="tdEmpty">No comments yet — start the discussion</div>
            ) : (
              <div className="tdCommentList">
                {comments.map((c, i) => {
                  const initials = getInitials(c.author_name || "?");
                  const color    = avatarColor(c.author_id || 0);
                  return (
                    <div key={c.id || i} className="tdComment">
                      <div className="tdCommentAvatar" style={{ background: color }}>{initials}</div>
                      <div className="tdCommentBody">
                        <div className="tdCommentHeader">
                          <span className="tdCommentAuthor">{c.author_name || "Someone"}</span>
                          <span className="tdCommentTime">{fullTime(c.created_at)}</span>
                        </div>
                        <div className="tdCommentText">{c.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form className="tdCommentForm" onSubmit={handlePostComment}>
              <textarea
                className="tdCommentInput"
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePostComment(e);
                }}
                rows={3}
              />
              <div className="tdCommentFormFooter">
                <span className="tdCommentHint">Ctrl+Enter to send</span>
                <button
                  type="submit"
                  className="tdCommentBtn"
                  disabled={posting || !commentText.trim()}
                >
                  {posting ? "Posting…" : "Post comment"}
                </button>
              </div>
            </form>
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
