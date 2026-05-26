"use client";

import { useState, useEffect, useRef } from "react";
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
  RiTimeLine,
  RiUserLine,
  RiCheckLine,
  RiRefreshLine,
  RiUpload2Line,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiMailLine,
  RiHammerLine,
  RiGroupLine,
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
  downloadAttachment,
  uploadTaskAttachment,
  uploadAttachmentVersion,
  getAttachmentGroupHistory,
  reviewAttachment,
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
  new:                  "New",
  in_review:            "In Review",
  waiting_on_external:  "Waiting on External",
  needs_decision:       "Needs Decision",
  approved_closed:      "Approved / Closed",
};

const STATUS_COLOR = {
  new:                 { bg: "#f3f4f6", text: "#374151",  dot: "#9ca3af" },
  in_review:           { bg: "#f5f3ff", text: "#6d28d9",  dot: "#8b5cf6" },
  waiting_on_external: { bg: "#fffbeb", text: "#d97706",  dot: "#f59e0b" },
  needs_decision:      { bg: "#fff7ed", text: "#c2410c",  dot: "#f97316" },
  approved_closed:     { bg: "#f0fdf4", text: "#15803d",  dot: "#22c55e" },
};

const PRIORITY_COLOR = {
  high:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  medium: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  low:    { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
};

const SOURCE_CONFIG = {
  email:       { label: "Email",       icon: RiMailLine,    color: "#6b7280", bg: "#f3f4f6" },
  builder:     { label: "Builder",     icon: RiHammerLine,  color: "#2563eb", bg: "#eff6ff" },
  stakeholder: { label: "Stakeholder", icon: RiGroupLine,   color: "#7c3aed", bg: "#f5f3ff" },
};

const REVIEW_STATUS_CONFIG = {
  pending:            { label: "Pending Review",     color: "#d97706", bg: "#fffbeb" },
  approved:           { label: "Approved",           color: "#16a34a", bg: "#f0fdf4" },
  revision_requested: { label: "Revision Requested", color: "#dc2626", bg: "#fef2f2" },
};

/* ── Helpers ── */
function fileIcon(filename = "") {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return RiFilePdfLine;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return RiFileImageLine;
  return RiFileTextLine;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
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

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const action    = entry.action || "";
  const isMove    = action === "status_changed";
  const isAssign  = action === "assigned";
  const isCreated = action === "created";
  const fromLabel = TASK_STATUS_LABEL[entry.old_value] || entry.old_value || "";
  const toLabel   = TASK_STATUS_LABEL[entry.new_value] || entry.new_value || "";
  const toColor   = STATUS_COLOR[entry.new_value] || STATUS_COLOR.new;
  const initials  = getInitials(entry.actor_name || "?");
  const color     = avatarColor(entry.changed_by_id || 0);

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
      due_date_changed:              "updated due date",
      title_changed:                 "renamed task",
      description_changed:           "updated description",
      attachment_version_uploaded:   "uploaded a new attachment version",
      attachment_approved:           "approved an attachment",
      attachment_revision_requested: "requested a revision",
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
        {(entry.old_value || entry.new_value) && !isMove && !isAssign && !isCreated && (
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.2rem" }}>
            {entry.old_value && <span style={{ textDecoration: "line-through", marginRight: 6 }}>{entry.old_value}</span>}
            {entry.new_value && <span style={{ color: "#374151" }}>{entry.new_value}</span>}
          </div>
        )}
        <div className="tdHistoryTime">
          <RiTimeLine style={{ fontSize: 11 }} />
          {fullTime(entry.created_at)}
        </div>
      </div>
    </div>
  );
}

/* ── Attachment Group component ── */
function AttachmentGroup({ group, onUploadVersion, onReview, onDownload }) {
  const [expanded, setExpanded]   = useState(false);
  const [history, setHistory]     = useState(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const fileRef = useRef(null);

  const att       = group;  // latest version fields are on the group object
  const source    = att.source || "email";
  const srcCfg    = SOURCE_CONFIG[source] || SOURCE_CONFIG.email;
  const SrcIcon   = srcCfg.icon;
  const rvStatus  = att.review_status || "pending";
  const rvCfg     = REVIEW_STATUS_CONFIG[rvStatus] || REVIEW_STATUS_CONFIG.pending;
  const Icon      = fileIcon(att.file_name || "");
  const vCount    = att.version_count || 1;

  async function handleToggleHistory() {
    if (expanded) { setExpanded(false); return; }
    setLoadingHist(true);
    try {
      const res = await getAttachmentGroupHistory(att.group_id);
      setHistory(res?.data || []);
      setExpanded(true);
    } catch { toast.error("Failed to load history"); }
    finally { setLoadingHist(false); }
  }

  async function handleReviewClick(status) {
    setReviewing(true);
    try {
      await onReview(att.attachment_id, att.group_id, status);
    } finally { setReviewing(false); }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUploadVersion(att.group_id, file);
    e.target.value = "";
  }

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: "0.5rem",
      overflow: "hidden",
      marginBottom: "0.625rem",
    }}>
      {/* ── Group header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.625rem 0.75rem",
        background: "#fafafa",
        borderBottom: expanded ? "1px solid #e5e7eb" : "none",
      }}>
        <Icon style={{ fontSize: 16, color: "#6b7280", flexShrink: 0 }} />
        <span style={{ fontSize: "0.812rem", fontWeight: 600, color: "#111827", flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {att.name || att.file_name}
        </span>
        {/* source badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: "0.688rem", fontWeight: 500, padding: "2px 6px",
          borderRadius: "999px", background: srcCfg.bg, color: srcCfg.color,
          flexShrink: 0,
        }}>
          <SrcIcon style={{ fontSize: 10 }} />
          {srcCfg.label}
        </span>
        {/* version badge */}
        <span style={{
          fontSize: "0.688rem", fontWeight: 600, padding: "2px 6px",
          borderRadius: "999px", background: "#e0e7ff", color: "#4338ca",
          flexShrink: 0,
        }}>
          v{att.version}
        </span>
      </div>

      {/* ── Latest version row ── */}
      <div style={{ padding: "0.5rem 0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "#6b7280", flex: 1 }}>
            {att.file_name}
            {att.file_size ? <span style={{ marginLeft: 6, color: "#9ca3af" }}>({formatBytes(att.file_size)})</span> : null}
          </span>
          {/* review status */}
          <span style={{
            fontSize: "0.688rem", fontWeight: 500, padding: "2px 7px",
            borderRadius: "999px", background: rvCfg.bg, color: rvCfg.color,
            flexShrink: 0,
          }}>
            {rvCfg.label}
          </span>
          {/* download */}
          <button
            onClick={() => onDownload(att.attachment_id)}
            title="Download"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}
          >
            <RiDownload2Line style={{ fontSize: 14 }} />
          </button>
        </div>

        {att.version_note && (
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem", fontStyle: "italic" }}>
            {att.version_note}
          </div>
        )}

        {/* actions row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          {/* upload new version */}
          <input type="file" ref={fileRef} style={{ display: "none" }} onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: "0.719rem", padding: "3px 8px", borderRadius: "0.25rem",
              border: "1px solid #d1d5db", background: "#fff", color: "#374151",
              cursor: "pointer",
            }}
          >
            <RiUpload2Line style={{ fontSize: 11 }} /> Upload v{(att.version || 1) + 1}
          </button>

          {/* builder review actions (shown when pending) */}
          {rvStatus === "pending" && (
            <>
              <button
                disabled={reviewing}
                onClick={() => handleReviewClick("approved")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: "0.719rem", padding: "3px 8px", borderRadius: "0.25rem",
                  border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a",
                  cursor: "pointer",
                }}
              >
                <RiCheckLine style={{ fontSize: 11 }} /> Approve
              </button>
              <button
                disabled={reviewing}
                onClick={() => handleReviewClick("revision_requested")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: "0.719rem", padding: "3px 8px", borderRadius: "0.25rem",
                  border: "1px solid #dc2626", background: "#fef2f2", color: "#dc2626",
                  cursor: "pointer",
                }}
              >
                <RiRefreshLine style={{ fontSize: 11 }} /> Request Revision
              </button>
            </>
          )}

          {/* history toggle */}
          {vCount > 1 && (
            <button
              onClick={handleToggleHistory}
              disabled={loadingHist}
              style={{
                marginLeft: "auto",
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: "0.719rem", padding: "3px 8px", borderRadius: "0.25rem",
                border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280",
                cursor: "pointer",
              }}
            >
              {loadingHist ? "Loading…" : (
                <>
                  {vCount} versions
                  {expanded ? <RiArrowUpSLine style={{ fontSize: 12 }} /> : <RiArrowDownSLine style={{ fontSize: 12 }} />}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Version history list ── */}
      {expanded && history && (
        <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
          {history.map((v, idx) => {
            const isLatest = v.is_latest;
            const vSrc     = SOURCE_CONFIG[v.source] || SOURCE_CONFIG.email;
            const vRv      = REVIEW_STATUS_CONFIG[v.review_status] || REVIEW_STATUS_CONFIG.pending;
            return (
              <div key={v.id} style={{
                display: "flex", alignItems: "flex-start", gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                borderBottom: idx < history.length - 1 ? "1px solid #f3f4f6" : "none",
                opacity: isLatest ? 1 : 0.7,
              }}>
                <span style={{
                  fontSize: "0.688rem", fontWeight: 700, padding: "2px 6px",
                  borderRadius: "999px", background: isLatest ? "#e0e7ff" : "#f3f4f6",
                  color: isLatest ? "#4338ca" : "#9ca3af",
                  flexShrink: 0, marginTop: 2,
                }}>
                  v{v.version}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.75rem", color: "#374151", fontWeight: isLatest ? 600 : 400 }}>
                    {v.file_name}
                    {v.file_size ? <span style={{ marginLeft: 5, color: "#9ca3af", fontWeight: 400 }}>({formatBytes(v.file_size)})</span> : null}
                  </div>
                  {v.version_note && (
                    <div style={{ fontSize: "0.7rem", color: "#6b7280", fontStyle: "italic" }}>{v.version_note}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "0.2rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.688rem", color: vSrc.color }}>{vSrc.label}</span>
                    <span style={{ fontSize: "0.625rem", color: "#d1d5db" }}>·</span>
                    <span style={{ fontSize: "0.688rem", color: vRv.color }}>{vRv.label}</span>
                    <span style={{ fontSize: "0.625rem", color: "#d1d5db" }}>·</span>
                    <span style={{ fontSize: "0.688rem", color: "#9ca3af" }}>{timeAgo(v.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onDownload(v.id)}
                  title="Download this version"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 2, flexShrink: 0 }}
                >
                  <RiDownload2Line style={{ fontSize: 13 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function TaskDetailPage() {
  const router = useRouter();
  const { project_id, task_id } = useParams();
  const projectId = parseInt(project_id, 10);
  const taskId    = parseInt(task_id, 10);

  const [loading,      setLoading]      = useState(true);
  const [project,      setProject]      = useState(null);
  const [task,         setTask]         = useState(null);
  const [attachments,  setAttachments]  = useState([]);
  const [history,      setHistory]      = useState([]);
  const [comments,     setComments]     = useState([]);
  const [commentText,  setCommentText]  = useState("");
  const [posting,      setPosting]      = useState(false);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const attachFileRef = useRef(null);

  async function loadAttachments() {
    try {
      const res = await getTaskAttachments(projectId, taskId);
      setAttachments(res?.data || []);
    } catch {}
  }

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

  async function handleUploadVersion(groupId, file) {
    try {
      await uploadAttachmentVersion(groupId, file, null);
      toast.success("New version uploaded");
      await loadAttachments();
    } catch {
      toast.error("Failed to upload version");
    }
  }

  async function handleReview(attachmentId, groupId, status) {
    try {
      await reviewAttachment(attachmentId, status, null);
      toast.success(status === "approved" ? "Attachment approved" : "Revision requested");
      await loadAttachments();
    } catch {
      toast.error("Failed to submit review");
    }
  }

  async function handleDownload(attachmentId) {
    try {
      await downloadAttachment(attachmentId);
    } catch {
      toast.error("Failed to download file");
    }
  }

  async function handleAttachFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingAtt(true);
    try {
      await uploadTaskAttachment(projectId, taskId, file);
      toast.success("File attached");
      await loadAttachments();
    } catch {
      toast.error("Failed to attach file");
    } finally {
      setUploadingAtt(false);
    }
  }

  const isOverdue     = task.is_overdue;
  const riColor       = task.riColor || RI_ACCENT_COLORS[0];
  const borderColor   = isOverdue ? "#ef4444" : riColor.border;
  const tagClass      = DISC_TAG_CLASS[task.discKey] || "tagDev";
  const DiscIcon      = DISC_ICON[task.discipline]  || RiAlertLine;
  const statusKey     = task.status || "new";
  const statusLabel   = TASK_STATUS_LABEL[statusKey] || statusKey;
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
              {isOverdue && <span className="tdOverduePill">Overdue</span>}
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
                  <div className="tdMetaValue tdMetaReviewItem">{task.review_item_title}</div>
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

          {/* ── Attachments card (versioned) ── */}
          <div className="tdCard">
            <div className="tdCardTitle">
              Attachments
              {attachments.length > 0 && <span className="tdCardCount">{attachments.length}</span>}
              <input
                type="file"
                ref={attachFileRef}
                style={{ display: "none" }}
                onChange={handleAttachFile}
              />
              <button
                onClick={() => attachFileRef.current?.click()}
                disabled={uploadingAtt}
                style={{
                  marginLeft: "auto",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: "0.719rem", padding: "3px 10px", borderRadius: "0.25rem",
                  border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb",
                  cursor: "pointer", fontWeight: 500,
                }}
              >
                <RiUpload2Line style={{ fontSize: 12 }} />
                {uploadingAtt ? "Uploading…" : "Attach file"}
              </button>
            </div>
            {attachments.length === 0 ? (
              <div className="tdEmpty">No attachments</div>
            ) : (
              <div style={{ marginTop: "0.25rem" }}>
                {attachments.map((group, i) => (
                  <AttachmentGroup
                    key={group.group_id || i}
                    group={group}
                    onUploadVersion={handleUploadVersion}
                    onReview={handleReview}
                    onDownload={handleDownload}
                  />
                ))}
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

      {/* ── Right Panel: Activity History ── */}
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
