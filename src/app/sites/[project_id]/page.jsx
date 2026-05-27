"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useRouter, useParams } from "next/navigation";
import {
  RiBriefcaseLine,
  RiArrowDownSLine,
  RiMailLine,
  RiBellLine,
  RiStarLine,
  RiStarFill,
  RiShareLine,
  RiCalendarLine,
  RiChat3Line,
  RiAttachment2,
  RiCheckLine,
  RiMoreLine,
  RiMapPin2Line,
  RiUserAddLine,
  RiTaskLine,
  RiAlertLine,
  RiAddLine,
  RiCloseLine,
  RiFilePdfLine,
  RiFileImageLine,
  RiFileTextLine,
  RiDownload2Line,
  RiUpload2Line,
  RiRefreshLine,
  RiArrowUpSLine,
  RiMailLine as RiMailIcon,
  RiHammerLine,
  RiGroupLine,
  RiArrowRightLine,
} from "react-icons/ri";
import Sidebar from "../../../components/Sidebar";
import toast from "react-hot-toast";
import {
  getProject,
  getProjectKanban,
  getProjectUpcomingDeadlines,
  getProjectDecisions,
  getProjectStakeholders,
  getProjectReviewItems,
  listProjects,
  updateProjectTaskStatus,
  updateProjectReviewItemStatus,
  getKanbanColumns,
  createKanbanColumn,
  updateKanbanColumn,
  deleteKanbanColumn,
  getProjectAttachmentVersions,
  downloadAttachment,
  reviewAttachment,
  getAttachmentUrl,
  listStakeholders,
  assignStakeholderToProject,
  removeStakeholderFromProject,
  assignStakeholderToTask,
} from "../../../lib/api";
import {
  PHASES,
  TASK_KANBAN_COLS,
  DISC_LABEL,
  DISC_KEY,
  DISC_TAG_CLASS,
  DISC_ICON,
  RI_ACCENT_COLORS,
  RI_KANBAN_COLS,
  RI_PRIORITY_COLORS,
  STAGE_COLORS,
  getInitials,
  avatarColor,
  formatDate,
  formatLongDate,
  getTimelineSteps,
  Avatar,
} from "../utils";
import "../sites.css";

/* ── Asset version helpers ── */
const AV_SOURCE = {
  email:       { label: "Email",       color: "#6b7280", bg: "#f3f4f6" },
  builder:     { label: "Builder",     color: "#2563eb", bg: "#eff6ff" },
  stakeholder: { label: "Stakeholder", color: "#7c3aed", bg: "#f5f3ff" },
};
const AV_REVIEW = {
  pending:            { label: "Pending",          color: "#d97706", dot: "#f59e0b" },
  approved:           { label: "Approved",          color: "#16a34a", dot: "#22c55e" },
  revision_requested: { label: "Needs Revision",    color: "#dc2626", dot: "#ef4444" },
};
const SPINE_COLOR = "#d8b4fe";

function avFileIcon(name = "") {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return RiFilePdfLine;
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return RiFileImageLine;
  return RiFileTextLine;
}
function avTimeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function avDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())       return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ── Version detail modal (opens when a commit card is clicked) ── */
function VersionDetailModal({ version, allGroups, onClose, onDownload, onReview }) {
  const [reviewing, setReviewing] = useState(null); // 'approved' | 'revision_requested'
  const [previewUrl, setPreviewUrl] = useState(null);

  const v       = version;
  const srcCfg  = AV_SOURCE[v.source]        || AV_SOURCE.email;
  const rvCfg   = AV_REVIEW[v.review_status] || AV_REVIEW.pending;
  const Icon    = avFileIcon(v.groupName || v.file_name);
  const context = v.taskTitle || v.riTitle || "";

  /* find all versions of the same file group */
  const group     = (allGroups || []).find((g) => g.group_id === v.group_id);
  const allVers   = (group?.versions || []).slice().sort((a, b) => b.version - a.version);
  const isImg     = ["png","jpg","jpeg","gif","webp","svg"].includes((v.file_name||"").split(".").pop().toLowerCase());

  useEffect(() => {
    if (isImg) getAttachmentUrl(v.id).then(setPreviewUrl).catch(() => {});
  }, [v.id, isImg]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleReview(status) {
    setReviewing(status);
    try {
      await onReview(v.id, status);
      onClose();
    } catch { /* toast shown by parent */ }
    finally { setReviewing(null); }
  }

  function fmt(bytes) {
    if (!bytes) return "–";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  }
  function fullDate(iso) {
    if (!iso) return "–";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 12,
        width: "min(540px, 95vw)", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", background: "#faf5ff",
          borderBottom: "1px solid #e9d5ff",
        }}>
          <Icon style={{ fontSize: 18, color: "#7c3aed", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v.groupName || v.file_name}
            </div>
            {context && (
              <div style={{ fontSize: "0.688rem", color: "#9ca3af", marginTop: 1 }}>
                {context}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {v.is_latest && (
              <span style={{ fontSize: "0.594rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                HEAD
              </span>
            )}
            <code style={{ fontSize: "0.688rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: "#ede9fe", color: "#6d28d9", fontFamily: "monospace" }}>
              v{v.version}
            </code>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
            color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: 2, flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

          {/* Status banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 8, marginBottom: 16,
            background: rvCfg.dot + "18",
            border: `1px solid ${rvCfg.dot}44`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: rvCfg.dot, flexShrink: 0 }} />
            <span style={{ fontSize: "0.812rem", fontWeight: 700, color: rvCfg.color }}>{rvCfg.label}</span>
          </div>

          {/* Image preview */}
          {isImg && previewUrl && (
            <div style={{ marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <img src={previewUrl} alt={v.file_name} style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "contain" }} />
            </div>
          )}

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 16 }}>
            <InfoRow label="Attached by" value={
              <span>
                <span style={{ fontWeight: 600, color: srcCfg.color, background: srcCfg.bg,
                  padding: "1px 6px", borderRadius: 999, fontSize: "0.688rem" }}>{srcCfg.label}</span>
                {v.uploaded_by_name && <span style={{ marginLeft: 5, fontSize: "0.75rem", color: "#374151", fontWeight: 600 }}>{v.uploaded_by_name}</span>}
              </span>
            } />
            <InfoRow label="Attached on"  value={fullDate(v.created_at)} />
            {v.reviewed_by_name && <>
              <InfoRow label="Reviewed by" value={
                <span style={{ fontWeight: 600, color: rvCfg.color }}>{v.reviewed_by_name}</span>
              } />
              <InfoRow label="Reviewed on" value={fullDate(v.reviewed_at)} />
            </>}
            <InfoRow label="File size"    value={fmt(v.file_size)} />
            <InfoRow label="Type"         value={v.mime_type || "–"} />
            {v.version_note && (
              <div style={{ gridColumn: "1 / -1" }}>
                <InfoRow label="Note" value={<em style={{ color: "#6b7280" }}>"{v.version_note}"</em>} />
              </div>
            )}
          </div>

          {/* All versions of this file */}
          {allVers.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.688rem", fontWeight: 700, color: "#374151",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                All versions
              </div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                {allVers.map((ver, idx) => {
                  const vRv  = AV_REVIEW[ver.review_status] || AV_REVIEW.pending;
                  const VIco = avFileIcon(ver.file_name || "");
                  const isActive = ver.id === v.id;
                  return (
                    <div key={ver.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px",
                      background: isActive ? "#faf5ff" : "#fff",
                      borderBottom: idx < allVers.length - 1 ? "1px solid #f3f4f6" : "none",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%",
                        background: ver.is_latest ? vRv.dot : "#d1d5db", flexShrink: 0 }} />
                      <code style={{ fontSize: "0.594rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                        background: ver.is_latest ? "#ede9fe" : "#f3f4f6",
                        color: ver.is_latest ? "#6d28d9" : "#9ca3af", fontFamily: "monospace" }}>
                        v{ver.version}
                      </code>
                      {ver.is_latest && (
                        <span style={{ fontSize: "0.563rem", fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                          background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>HEAD</span>
                      )}
                      <span style={{ flex: 1, fontSize: "0.688rem", color: "#6b7280" }}>
                        {ver.uploaded_by_name || AV_SOURCE[ver.source]?.label || "Unknown"}
                      </span>
                      <span style={{ fontSize: "0.594rem", color: vRv.color, fontWeight: 500 }}>{vRv.label}</span>
                      <span style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{avTimeAgo(ver.created_at)}</span>
                      <button onClick={() => onDownload(ver.id)} title="Download"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#c4b5fd", padding: 0, lineHeight: 1 }}>
                        <RiDownload2Line style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          padding: "12px 18px",
          borderTop: "1px solid #e5e7eb",
          display: "flex", gap: 8,
          background: "#fafafa",
        }}>
          <button
            onClick={() => onDownload(v.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: "0.75rem", fontWeight: 600, padding: "7px 14px", borderRadius: 7,
              border: "1px solid #d1d5db", background: "#fff", color: "#374151",
              cursor: "pointer",
            }}
          >
            <RiDownload2Line style={{ fontSize: 13 }} /> Download
          </button>

          {v.is_latest && v.review_status === "pending" && (<>
            <button
              disabled={reviewing === "approved"}
              onClick={() => handleReview("approved")}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                fontSize: "0.75rem", fontWeight: 600, padding: "7px 0", borderRadius: 7,
                border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a",
                cursor: "pointer",
              }}
            >
              <RiCheckLine style={{ fontSize: 13 }} />
              {reviewing === "approved" ? "Approving…" : "Approve"}
            </button>
            <button
              disabled={reviewing === "revision_requested"}
              onClick={() => handleReview("revision_requested")}
              style={{
                flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                fontSize: "0.75rem", fontWeight: 600, padding: "7px 0", borderRadius: 7,
                border: "1px solid #dc2626", background: "#fef2f2", color: "#dc2626",
                cursor: "pointer",
              }}
            >
              <RiRefreshLine style={{ fontSize: 13 }} />
              {reviewing === "revision_requested" ? "Sending…" : "Request Revision"}
            </button>
          </>)}

          {v.is_latest && v.review_status === "approved" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5,
              fontSize: "0.75rem", color: "#16a34a", fontWeight: 600 }}>
              <RiCheckLine style={{ fontSize: 14 }} /> Already approved
            </div>
          )}
          {v.is_latest && v.review_status === "revision_requested" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5,
              fontSize: "0.75rem", color: "#dc2626", fontWeight: 600 }}>
              <RiRefreshLine style={{ fontSize: 14 }} /> Revision requested
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.75rem", color: "#374151" }}>{value}</div>
    </div>
  );
}

/* ── Option 1: Commit timeline grouped by date ── */
function CommitTimeline({ groups, onDownload, onSelect }) {
  const entries = [];
  (groups || []).forEach((g) => {
    (g.versions || []).forEach((v) => {
      entries.push({
        ...v,
        group_id:  g.group_id,
        groupName: g.name,
        taskTitle: g.task_title,
        riTitle:   g.ri_title,
      });
    });
  });
  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!entries.length) return null;

  const buckets = [];
  entries.forEach((v) => {
    const lbl = avDateLabel(v.created_at);
    if (!buckets.length || buckets[buckets.length - 1].label !== lbl)
      buckets.push({ label: lbl, items: [] });
    buckets[buckets.length - 1].items.push(v);
  });

  return (
    <div style={{ padding: "2px 0 4px" }}>
      {buckets.map((bucket) => (
        <div key={bucket.label}>

          {/* Date separator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 6px" }}>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            <span style={{ fontSize: "0.594rem", fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
              {bucket.label}
            </span>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          {bucket.items.map((v, i) => {
            const isLast = i === bucket.items.length - 1;
            const srcCfg = AV_SOURCE[v.source]        || AV_SOURCE.email;
            const rvCfg  = AV_REVIEW[v.review_status] || AV_REVIEW.pending;
            const Icon   = avFileIcon(v.groupName);
            const context = v.taskTitle || v.riTitle || "";

            return (
              <div key={v.id} style={{ display: "flex" }}>

                {/* Spine */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
                  <div style={{ position: "relative", marginTop: 10, flexShrink: 0 }}>
                    {v.is_latest && (
                      <div style={{ position: "absolute", inset: -3, borderRadius: "50%",
                        border: `2px solid ${rvCfg.dot}`, opacity: 0.3 }} />
                    )}
                    <div style={{
                      width: v.is_latest ? 11 : 9, height: v.is_latest ? 11 : 9,
                      borderRadius: "50%",
                      background: v.is_latest ? rvCfg.dot : "#fff",
                      border: `2px solid ${v.is_latest ? rvCfg.dot : SPINE_COLOR}`,
                      zIndex: 1, position: "relative",
                    }} />
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, minHeight: 14, background: SPINE_COLOR, borderRadius: 1, marginTop: 3 }} />
                  )}
                </div>

                {/* Commit card — clickable */}
                <div
                  onClick={() => onSelect(v)}
                  style={{
                    flex: 1, marginLeft: 5, marginTop: 5,
                    marginBottom: isLast ? 2 : 8,
                    background: v.is_latest ? "#faf5ff" : "#fff",
                    border: `1px solid ${v.is_latest ? "#ddd6fe" : "#e5e7eb"}`,
                    borderRadius: 7, padding: "8px 10px",
                    cursor: "pointer",
                    transition: "box-shadow 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(124,58,237,0.12)";
                    e.currentTarget.style.borderColor = "#c4b5fd";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = v.is_latest ? "#ddd6fe" : "#e5e7eb";
                  }}
                >
                  {/* row 1: file name + version hash */}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <Icon style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.719rem", fontWeight: 600, color: "#111827",
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.groupName}
                    </span>
                    <code style={{
                      fontSize: "0.563rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                      background: v.is_latest ? "#ede9fe" : "#f3f4f6",
                      color:      v.is_latest ? "#6d28d9" : "#6b7280",
                      fontFamily: "monospace", flexShrink: 0,
                    }}>
                      v{v.version}
                    </code>
                  </div>

                  {/* row 2: who + status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 3 }}>
                    {v.is_latest && (
                      <span style={{ fontSize: "0.563rem", fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                        background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", flexShrink: 0 }}>
                        HEAD
                      </span>
                    )}
                    <span style={{ fontSize: "0.594rem", fontWeight: 600, padding: "1px 6px", borderRadius: 999,
                      background: srcCfg.bg, color: srcCfg.color, flexShrink: 0 }}>
                      {srcCfg.label}
                    </span>
                    {v.uploaded_by_name && (
                      <span style={{ fontSize: "0.594rem", fontWeight: 600, color: "#374151" }}>
                        {v.uploaded_by_name}
                      </span>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: "0.563rem", color: rvCfg.color, fontWeight: 500 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: rvCfg.dot, display: "inline-block" }} />
                      {rvCfg.label}
                    </span>
                  </div>

                  {/* row 3: reviewer + context + time + download */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {v.reviewed_by_name && (
                      <span style={{ fontSize: "0.563rem", color: "#6b7280" }}>
                        ✓ <span style={{ fontWeight: 600 }}>{v.reviewed_by_name}</span>
                      </span>
                    )}
                    {context && (
                      <span style={{ fontSize: "0.563rem", color: "#9ca3af",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 72 }}>
                        · {context}
                      </span>
                    )}
                    <span style={{ fontSize: "0.563rem", color: "#9ca3af", marginLeft: "auto" }}>
                      {avTimeAgo(v.created_at)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDownload(v.id); }}
                      title="Download"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#c4b5fd", padding: 0, lineHeight: 1 }}
                    >
                      <RiDownload2Line style={{ fontSize: 12 }} />
                    </button>
                  </div>

                  {v.version_note && (
                    <div style={{ fontSize: "0.594rem", color: "#6b7280", marginTop: 3, fontStyle: "italic" }}>
                      "{v.version_note}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
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

/* ── Task card ── */
function TaskCard({ card, onClick, projectStakeholders, onAssignTask }) {
  const isOverdue   = card.is_overdue;
  const riColor     = card.riColor || RI_ACCENT_COLORS[0];
  const borderColor = isOverdue ? "#ef4444" : riColor.border;

  const priBadgeLabel = card.status === "done"
    ? "Approved"
    : card.priority
      ? card.priority.charAt(0).toUpperCase() + card.priority.slice(1)
      : "Medium";
  const priBadgeCls = card.status === "done"
    ? "tcBadgeApproved"
    : card.priority === "high"
      ? "tcBadgeHigh"
      : card.priority === "low"
        ? "tcBadgeLow"
        : "tcBadgeMedium";

  const [showAssign, setShowAssign] = useState(false);
  const assignRef = useRef(null);

  useEffect(() => {
    if (!showAssign) return;
    function handler(e) {
      if (assignRef.current && !assignRef.current.contains(e.target)) setShowAssign(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssign]);

  return (
    <div
      className={`taskCard${isOverdue ? " taskCardOverdue" : ""}`}
      style={{ borderLeftColor: borderColor, cursor: "pointer" }}
      onClick={onClick}
    >
      <div className="taskCardDisc" style={{ color: borderColor }}>{card.disc}</div>
      <div className="taskCardTitle">{card.title}</div>
      {card.desc && <div className="taskCardDesc">{card.desc}</div>}
      <div className="taskCardMeta">
        {/* Assignee — click to assign/change without navigating */}
        <div ref={assignRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <div
            onClick={(e) => { e.stopPropagation(); setShowAssign((s) => !s); }}
            style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
            title={card.stakeholder_name || "Assign stakeholder"}
          >
            {card.av
              ? <Avatar initials={card.av} color={card.avColor} size="Xs" />
              : (
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#f3f4f6", border: "1.5px dashed #d1d5db",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <RiUserAddLine style={{ fontSize: 9, color: "#9ca3af" }} />
                </div>
              )
            }
            {card.stakeholder_name && (
              <span className="taskCardAssignee">{card.stakeholder_name}</span>
            )}
          </div>
          {showAssign && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
              background: "#fff", borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
              border: "1px solid #e5e7eb", minWidth: 175, padding: "4px 0",
            }}>
              {card.stakeholder_id && (
                <div
                  onClick={(e) => { e.stopPropagation(); onAssignTask(card.id, null); setShowAssign(false); }}
                  style={{ padding: "6px 10px", fontSize: "0.688rem", color: "#ef4444",
                    cursor: "pointer", fontWeight: 500, borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#fff5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  Remove assignee
                </div>
              )}
              {(projectStakeholders || []).length === 0 && !card.stakeholder_id && (
                <div style={{ padding: "10px 12px", fontSize: "0.688rem", color: "#9ca3af" }}>
                  No team members on this project
                </div>
              )}
              {(projectStakeholders || []).map((sh) => (
                <div
                  key={sh.id}
                  onClick={(e) => { e.stopPropagation(); onAssignTask(card.id, sh.id); setShowAssign(false); }}
                  style={{
                    padding: "7px 10px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 7,
                    background: sh.id === card.stakeholder_id ? "#f5f3ff" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (sh.id !== card.stakeholder_id) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { if (sh.id !== card.stakeholder_id) e.currentTarget.style.background = sh.id === card.stakeholder_id ? "#f5f3ff" : "transparent"; }}
                >
                  <Avatar initials={getInitials(sh.name)} color={avatarColor(sh.id)} size="Xs" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.719rem", fontWeight: 600, color: "#111827",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.name}</div>
                    {sh.discipline && <div style={{ fontSize: "0.594rem", color: "#9ca3af" }}>{sh.discipline}</div>}
                  </div>
                  {sh.id === card.stakeholder_id && (
                    <RiCheckLine style={{ fontSize: 12, color: "#7c3aed", flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {card.due_date && (
          <span className={`taskCardDue${isOverdue ? " taskCardDueOverdue" : ""}`}>
            <RiCalendarLine style={{ fontSize: 10 }} />
            {formatDate(card.due_date)}
          </span>
        )}
        <span className={priBadgeCls}>{priBadgeLabel}</span>
      </div>
      <div className="taskCardCounts">
        <span className="taskCardCount">
          <RiChat3Line style={{ fontSize: 11 }} />
          {card.comment_count || 0}
        </span>
        <span className="taskCardCount">
          <RiAttachment2 style={{ fontSize: 11 }} />
          {card.attachment_count || 0}
        </span>
      </div>
    </div>
  );
}

/* ── Kanban column (tasks) ── */
function KanbanColumn({ col, onCardClick, onRename, onDelete, projectStakeholders, onAssignTask }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(col.title);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== col.title) onRename(col.id, col.dbId, draft.trim());
    else setDraft(col.title);
  }

  return (
    <Droppable droppableId={col.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`kanbanCol${snapshot.isDraggingOver ? " kanbanColOver" : ""}`}
        >
          <div className="kanbanColHeader kanbanColHeaderEditable">
            {editing ? (
              <input
                ref={inputRef}
                className="kanbanColTitleInput"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setEditing(false); setDraft(col.title); }
                }}
              />
            ) : (
              <span className="kanbanColTitle" onClick={() => { setDraft(col.title); setEditing(true); }} title="Click to rename">
                {col.title}
              </span>
            )}
            <span className="kanbanColCount">{col.cards.length}</span>
          </div>
          <div className="kanbanCards">
            {col.cards.map((card, index) => (
              <Draggable key={String(card.id)} draggableId={String(card.id)} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <TaskCard
                      card={card}
                      onClick={() => onCardClick(card)}
                      projectStakeholders={projectStakeholders}
                      onAssignTask={onAssignTask}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

const RI_TASK_STATUS_DOT = {
  open:        "#f59e0b",
  in_progress: "#3b82f6",
  blocked:     "#ef4444",
  done:        "#22c55e",
};

/* ── RI card ── */
function RICard({ ri }) {
  const tagClass = DISC_TAG_CLASS[DISC_KEY[ri.discipline]] || "tagDev";
  const DiscIcon = DISC_ICON[ri.discipline] || RiAlertLine;
  const priColor = RI_PRIORITY_COLORS[ri.priority] || RI_PRIORITY_COLORS.medium;
  const tasks    = ri.tasks || [];

  return (
    <div
      className="reviewCard"
      style={{ borderLeftColor: priColor.border, background: priColor.bg }}
    >
      <div className="cardDiscipline">
        <span className={`tag ${tagClass}`}>
          <DiscIcon style={{ fontSize: 10, marginRight: 3, verticalAlign: "middle" }} />
          {DISC_LABEL[ri.discipline] || "Other"}
        </span>
        <span
          className={ri.priority === "high" ? "badgeHigh" : ri.priority === "low" ? "badgeLow" : "badgeMedium"}
          style={{ marginLeft: "auto" }}
        >
          {ri.priority}
        </span>
      </div>
      <div className="cardTitle">{ri.title}</div>
      {ri.description && <div className="cardDesc">{ri.description}</div>}
      {tasks.length > 0 && (
        <div className="riCardTaskList">
          {tasks.map((task) => (
            <div key={task.id} className="riCardTaskRow">
              <span
                className="riCardTaskDot"
                style={{ background: RI_TASK_STATUS_DOT[task.status] || "#d1d5db" }}
              />
              <span className="riCardTaskTitle">{task.title}</span>
              {task.due_date && (
                <span className="riCardTaskDate">{formatDate(task.due_date)}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="cardFooter" style={{ marginTop: 8 }}>
        {ri.owner_name ? (
          <Avatar initials={getInitials(ri.owner_name)} color={avatarColor(ri.owner_id)} size="Xs" />
        ) : (
          <span style={{ width: 22 }} />
        )}
        {ri.due_date && (
          <span className="cardDate">
            <RiCalendarLine className="iconSize12" />
            {formatDate(ri.due_date)}
          </span>
        )}
        {tasks.length > 0 && (
          <span className="riKanbanTaskBadge">
            <RiTaskLine style={{ fontSize: 10, marginRight: 2 }} />
            {tasks.length}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── RI Kanban column ── */
function RIKanbanColumn({ col, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(col.title);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== col.title) onRename(col.id, col.dbId, draft.trim());
    else setDraft(col.title);
  }

  return (
    <Droppable droppableId={`ri-${col.id}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`kanbanCol${snapshot.isDraggingOver ? " kanbanColOver" : ""}`}
        >
          <div className="kanbanColHeader kanbanColHeaderEditable">
            {editing ? (
              <input
                ref={inputRef}
                className="kanbanColTitleInput"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setEditing(false); setDraft(col.title); }
                }}
              />
            ) : (
              <span className="kanbanColTitle" onClick={() => { setDraft(col.title); setEditing(true); }} title="Click to rename">
                {col.title}
              </span>
            )}
            <span className="kanbanColCount">{col.cards.length}</span>
          </div>
          <div className="kanbanCards">
            {col.cards.map((ri, index) => (
              <Draggable key={String(ri.id)} draggableId={String(ri.id)} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <RICard ri={ri} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

/* ── Page ── */
export default function ProjectDetailPage() {
  const router     = useRouter();
  const { project_id } = useParams();
  const projectId  = parseInt(project_id, 10);

  const [loading,      setLoading]      = useState(true);
  const [projects,     setProjects]     = useState([]);
  const [project,      setProject]      = useState(null);
  const [kanban,       setKanban]       = useState(null);
  const [kanbanCols,   setKanbanCols]   = useState([]);
  const [riColDefs,    setRiColDefs]    = useState(RI_KANBAN_COLS.map((c) => ({ ...c, dbId: null })));
  const [deadlines,    setDeadlines]    = useState([]);
  const [decisions,    setDecisions]    = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [reviewItems,  setReviewItems]  = useState([]);
  const [riKanbanCols, setRiKanbanCols] = useState([]);
  const [activeTab,    setActiveTab]    = useState("tasks");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  const [attVersions,     setAttVersions]     = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [allStakeholders, setAllStakeholders] = useState([]);
  const [showTeamAssign,  setShowTeamAssign]  = useState(false);
  const [rightTab,        setRightTab]        = useState("assets");
  const teamAssignRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, projRes, kanbanRes, dlRes, decRes, shRes, riRes, riColRes, attVerRes, allShRes] = await Promise.all([
        listProjects(),
        getProject(projectId),
        getProjectKanban(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
        getProjectReviewItems(projectId),
        getKanbanColumns("review_item"),
        getProjectAttachmentVersions(projectId).catch(() => ({ data: [] })),
        listStakeholders().catch(() => ({ data: [] })),
      ]);
      setProjects(listRes?.data || []);
      setProject(projRes?.data || null);
      setKanban(kanbanRes?.data || null);
      setDeadlines(dlRes?.data  || []);
      setDecisions(decRes?.data || []);
      setStakeholders(shRes?.data || []);
      setReviewItems(riRes?.data || []);
      setAttVersions(attVerRes?.data || []);
      setAllStakeholders(allShRes?.data || []);

      const riCols = (riColRes?.data || []).map((c) => ({ id: c.name, dbId: c.id, title: c.label, color: c.color }));
      if (riCols.length) setRiColDefs(riCols);
    } catch (err) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function handleClick(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const cols = kanban?.columns || {};
    const allTasks = Object.values(cols).flat();
    const riIds = [...new Set(allTasks.map((t) => t.review_item_id).filter(Boolean))].sort((a, b) => a - b);
    const riColorMap = Object.fromEntries(riIds.map((id, i) => [id, RI_ACCENT_COLORS[i % RI_ACCENT_COLORS.length]]));

    setKanbanCols(riColDefs.map((col) => ({
      ...col,
      cards: (cols[col.id] || []).map((t) => ({
        ...t,
        desc:    t.description,
        riTitle: t.review_item_title,
        disc:    DISC_LABEL[t.discipline] || "Other",
        discKey: DISC_KEY[t.discipline]   || "Dev",
        av:      getInitials(t.stakeholder_name || ""),
        avColor: avatarColor(t.stakeholder_id),
        riColor: riColorMap[t.review_item_id] || RI_ACCENT_COLORS[0],
      })),
    })));
  }, [kanban, riColDefs]);

  useEffect(() => {
    setRiKanbanCols(riColDefs.map((col) => ({
      ...col,
      cards: reviewItems.filter((ri) => ri.status === col.id),
    })));
  }, [reviewItems, riColDefs]);

  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const cardId    = parseInt(draggableId, 10);
    const fromColId = source.droppableId;
    const toColId   = destination.droppableId;

    setKanbanCols((prev) => {
      const next = prev.map((col) => ({ ...col, cards: [...col.cards] }));
      const from = next.find((c) => c.id === fromColId);
      const to   = next.find((c) => c.id === toColId);
      if (!from || !to) return prev;
      const [moved] = from.cards.splice(source.index, 1);
      to.cards.splice(destination.index, 0, { ...moved, status: toColId });
      return next;
    });

    updateProjectTaskStatus(project.id, cardId, toColId).catch(() => {
      toast.error("Failed to update task status");
      loadData();
    });
  }

  function onRIDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const riId      = parseInt(draggableId, 10);
    const fromColId = source.droppableId.replace("ri-", "");
    const toColId   = destination.droppableId.replace("ri-", "");

    setRiKanbanCols((prev) => {
      const next = prev.map((col) => ({ ...col, cards: [...col.cards] }));
      const from = next.find((c) => c.id === fromColId);
      const to   = next.find((c) => c.id === toColId);
      if (!from || !to) return prev;
      const [moved] = from.cards.splice(source.index, 1);
      to.cards.splice(destination.index, 0, { ...moved, status: toColId });
      return next;
    });

    updateProjectReviewItemStatus(project.id, riId, toColId).catch(() => {
      toast.error("Failed to update review item status");
      loadData();
    });
  }

  /* ── kanban column CRUD (shared by both boards — tasks use RI stages) ── */
  async function handleRenameRICol(colId, dbId, label) {
    if (!label.trim() || !dbId) return;
    setRiColDefs((prev) => prev.map((c) => c.id === colId ? { ...c, title: label } : c));
    try { await updateKanbanColumn(dbId, { label: label.trim() }); }
    catch { toast.error("Failed to rename column"); loadData(); }
  }

  async function handleDeleteRICol(colId, dbId) {
    if (!dbId) return;
    setRiColDefs((prev) => prev.filter((c) => c.id !== colId));
    try { await deleteKanbanColumn(dbId); }
    catch (err) { toast.error(err.message || "Failed to delete column"); loadData(); }
  }

  async function handleAddRICol() {
    const label = "New Column";
    const name  = `col_${Date.now()}`;
    const tempCol = { id: name, dbId: null, title: label, color: "#6b7280" };
    setRiColDefs((prev) => [...prev, tempCol]);
    try {
      const res = await createKanbanColumn({ entity_type: "review_item", name, label, color: "#6b7280" });
      const created = res?.data;
      setRiColDefs((prev) => prev.map((c) => c.id === name
        ? { id: created.name, dbId: created.id, title: created.label, color: created.color }
        : c
      ));
    } catch (err) {
      toast.error(err.message || "Failed to add column");
      setRiColDefs((prev) => prev.filter((c) => c.id !== name));
    }
  }

  useEffect(() => {
    function handleClick(e) {
      if (teamAssignRef.current && !teamAssignRef.current.contains(e.target)) {
        setShowTeamAssign(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleAssignToProject(stakeholderId) {
    try {
      await assignStakeholderToProject(projectId, stakeholderId);
      await loadData();
      toast.success("Stakeholder assigned to project");
    } catch (err) {
      toast.error(err.message || "Failed to assign stakeholder");
    }
  }

  async function handleRemoveFromProject(stakeholderId) {
    setStakeholders((prev) => prev.filter((s) => s.id !== stakeholderId));
    try {
      await removeStakeholderFromProject(projectId, stakeholderId);
      toast.success("Removed from project");
    } catch (err) {
      toast.error(err.message || "Failed to remove stakeholder");
      loadData();
    }
  }

  async function handleAssignToTask(taskId, stakeholderId) {
    const sh = stakeholderId ? stakeholders.find((s) => s.id === stakeholderId) : null;
    setKanbanCols((prev) => prev.map((col) => ({
      ...col,
      cards: col.cards.map((c) => c.id !== taskId ? c : {
        ...c,
        stakeholder_id:   stakeholderId || null,
        stakeholder_name: sh?.name || null,
        av:               sh ? getInitials(sh.name) : "",
        avColor:          sh ? avatarColor(sh.id)   : "",
      }),
    })));
    try {
      await assignStakeholderToTask(taskId, stakeholderId);
    } catch (err) {
      toast.error(err.message || "Failed to assign stakeholder");
      loadData();
    }
  }

  async function handleDownloadVersion(attachmentId) {
    try { await downloadAttachment(attachmentId); }
    catch { toast.error("Failed to download"); }
  }

  async function handleReviewVersion(attachmentId, status) {
    try {
      await reviewAttachment(attachmentId, status, null);
      await loadData();
      toast.success(status === "approved" ? "Approved" : "Revision requested");
    } catch (err) {
      toast.error(err.message || "Review failed");
      throw err;
    }
  }

  if (loading) return <LoadingShell />;

  if (!project) {
    return (
      <div className="sitesShell">
        <Sidebar />
        <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Project not found</div>
            <div
              style={{ fontSize: "0.812rem", color: "#2563eb", cursor: "pointer" }}
              onClick={() => router.push("/sites")}
            >
              ← Back to projects
            </div>
          </div>
        </div>
        <div className="rightPanel" />
        <div className="topNav" />
      </div>
    );
  }

  const colMap             = Object.fromEntries(kanbanCols.map((c) => [c.id, c.cards.length]));
  const totalTasks         = kanbanCols.reduce((s, c) => s + c.cards.length, 0);
  const newCount           = colMap.new                || 0;
  const inReviewCount      = colMap.in_review          || 0;
  const waitingCount       = colMap.waiting_on_external || 0;
  const needsDecisionCount = colMap.needs_decision     || 0;
  const closedCount        = colMap.closed             || 0;

  const deadlines5      = deadlines.slice(0, 5);
  const latestDecisions = decisions.slice(0, 4);
  const unassignedAll   = allStakeholders.filter((sh) => !stakeholders.some((s) => s.id === sh.id));
  const taskCountBySh   = {};
  kanbanCols.forEach((col) => col.cards.forEach((c) => {
    if (c.stakeholder_id) taskCountBySh[c.stakeholder_id] = (taskCountBySh[c.stakeholder_id] || 0) + 1;
  }));
  const timelineSteps = getTimelineSteps(project.stage);
  const phaseBadgeLabel = project.stage
    ? project.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

  return (
    <div className="sitesShell">
      <Sidebar />

      {/* ── Main ── */}
      <div className="main">
        <div className="breadcrumbBar">
          <span className="breadcrumbLink" onClick={() => router.push("/sites")}>Sites</span>
          <span className="breadcrumbSep">›</span>
          <span className="breadcrumbCurrent">{project.name}</span>
          <div className="breadcrumbActions">
            <button className="iconBtn" title="Star project">
              {project.is_starred
                ? <RiStarFill className="iconSize15" style={{ color: "#f59e0b" }} />
                : <RiStarLine className="iconSize15" />}
            </button>
            <button className="outlineBtn">
              <RiShareLine className="iconSize13" /> Share
            </button>
          </div>
        </div>

        <div className="projectHeader">
          <div className="projectMeta">
            <div className="projectThumb">
              {project.image_url
                ? <img src={project.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                : <RiMapPin2Line style={{ fontSize: 26 }} />
              }
            </div>
            <div className="projectInfo">
              <h1 className="projectName">{project.name}</h1>
              {project.location && <div className="projectLocation">{project.location}</div>}
              <span className="phaseBadge">{phaseBadgeLabel}</span>
            </div>

            <div className="statsRow">
              <div className="statItem">
                <div className="statLabel">New</div>
                <div className="statValue">{newCount}</div>
                <div className="statSub">{totalTasks} total tasks</div>
              </div>
              <div className="statItem">
                <div className="statLabel">In Review</div>
                <div className="statValue">{inReviewCount}</div>
                <div className="statSub">
                  {totalTasks ? `${Math.round((inReviewCount / totalTasks) * 100)}% of total` : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Waiting on External</div>
                <div className="statValue">{waitingCount}</div>
                <div className="statSub">
                  {totalTasks ? `${Math.round((waitingCount / totalTasks) * 100)}% of total` : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Needs Decision</div>
                <div className="statValue">{needsDecisionCount}</div>
                <div className="statSub">
                  {totalTasks ? `${Math.round((needsDecisionCount / totalTasks) * 100)}% of total` : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Approved / Closed</div>
                <div className="statValue">{closedCount}</div>
                <div className="statSub">
                  {totalTasks ? `${Math.round((closedCount / totalTasks) * 100)}% done` : "—"}
                </div>
              </div>
            </div>

            <button className="iconBtn" style={{ alignSelf: "flex-start", marginTop: 6 }}>
              <RiMoreLine className="iconSize16" />
            </button>
          </div>

          <div className="timeline">
            {timelineSteps.map((step, i) => (
              <div key={i} className={`timelineStep ${step.state}`}>
                <div className="timelineCircle">
                  {step.state === "done" && <RiCheckLine className="iconSize12" />}
                  {step.state === "current" && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", display: "block" }} />
                  )}
                </div>
                <div className="timelineLabel">{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* <div className="projectTabBar">
          <button
            className={`projectTab${activeTab === "tasks" ? " projectTabActive" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            Tasks
            <span className="projectTabCount">{totalTasks}</span>
          </button>
          <button
            className={`projectTab${activeTab === "review-items" ? " projectTabActive" : ""}`}
            onClick={() => setActiveTab("review-items")}
          >
            Review Items
            <span className="projectTabCount">{reviewItems.length}</span>
          </button>
        </div> */}

        {activeTab === "tasks" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="kanbanOuter">
              {kanbanCols.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  onCardClick={(card) => router.push(`/sites/${projectId}/tasks/${card.id}`)}
                  onRename={handleRenameRICol}
                  onDelete={handleDeleteRICol}
                  projectStakeholders={stakeholders}
                  onAssignTask={handleAssignToTask}
                />
              ))}
              {/* <button className="kanbanAddColBtn" onClick={handleAddRICol} title="Add column">
                <RiAddLine style={{ fontSize: 16 }} />
                Add column
              </button> */}
            </div>
          </DragDropContext>
        )}

        {activeTab === "review-items" && (
          <DragDropContext onDragEnd={onRIDragEnd}>
            <div className="kanbanOuter">
              {riKanbanCols.map((col) => (
                <RIKanbanColumn
                  key={col.id}
                  col={col}
                  onRename={handleRenameRICol}
                  onDelete={handleDeleteRICol}
                />
              ))}
              {/* <button className="kanbanAddColBtn" onClick={handleAddRICol} title="Add column">
                <RiAddLine style={{ fontSize: 16 }} />
                Add column
              </button> */}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* ── Right Panel: Team + Asset Versions ── */}
      <div className="rightPanel">
        {/* Tab bar */}
        <div className="rightPanelHeader" style={{ padding: 0 }}>
          <div style={{ display: "flex" }}>
            {/* <button
              onClick={() => setRightTab("team")}
              style={{
                flex: 1, padding: "10px 0", fontSize: "0.719rem", fontWeight: 600,
                border: "none", background: rightTab === "team" ? "#faf5ff" : "transparent",
                color: rightTab === "team" ? "#7c3aed" : "#9ca3af", cursor: "pointer",
                borderBottom: rightTab === "team" ? "2px solid #7c3aed" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              <RiGroupLine style={{ fontSize: 13 }} />
              Team
              {stakeholders.length > 0 && (
                <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 999,
                  padding: "1px 5px", fontSize: "0.563rem", fontWeight: 700 }}>
                  {stakeholders.length}
                </span>
              )}
            </button> */}
            <button
              onClick={() => setRightTab("assets")}
              style={{
                flex: 1, padding: "10px 0", fontSize: "0.719rem", fontWeight: 600,
                border: "none", background: rightTab === "assets" ? "#faf5ff" : "transparent",
                color: rightTab === "assets" ? "#7c3aed" : "#9ca3af", cursor: "pointer",
                borderBottom: rightTab === "assets" ? "2px solid #7c3aed" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              <RiAttachment2 style={{ fontSize: 13 }} />
              Assets History
              {attVersions.length > 0 && (
                <span style={{ background: "#e0e7ff", color: "#4338ca", borderRadius: 999,
                  padding: "1px 5px", fontSize: "0.563rem", fontWeight: 700 }}>
                  {attVersions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="rightPanelBody">

          {/* ── Team tab ── */}
          {/* {rightTab === "team" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <div style={{ position: "relative" }} ref={teamAssignRef}>
                  <button
                    onClick={() => setShowTeamAssign((s) => !s)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: "0.719rem", fontWeight: 600,
                      color: "#7c3aed", background: "#f5f3ff",
                      border: "1px solid #e9d5ff", borderRadius: 6,
                      padding: "5px 10px", cursor: "pointer",
                    }}
                  >
                    <RiUserAddLine style={{ fontSize: 12 }} /> Assign
                  </button>
                  {showTeamAssign && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200,
                      background: "#fff", borderRadius: 8,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                      border: "1px solid #e5e7eb", minWidth: 210, maxHeight: 250, overflowY: "auto",
                    }}>
                      {unassignedAll.length === 0 ? (
                        <div style={{ padding: "12px 14px", fontSize: "0.75rem", color: "#9ca3af" }}>
                          {allStakeholders.length === 0 ? "No stakeholders in account yet" : "All stakeholders assigned"}
                        </div>
                      ) : (
                        unassignedAll.map((sh) => (
                          <div key={sh.id}
                            onClick={() => { handleAssignToProject(sh.id); setShowTeamAssign(false); }}
                            style={{ padding: "8px 12px", cursor: "pointer",
                              display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <Avatar initials={getInitials(sh.name)} color={avatarColor(sh.id)} size="Xs" />
                            <div>
                              <div style={{ fontWeight: 600, color: "#111827" }}>{sh.name}</div>
                              {sh.discipline && <div style={{ fontSize: "0.625rem", color: "#9ca3af" }}>{sh.discipline}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {stakeholders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <RiGroupLine style={{ fontSize: 24, color: "#d1d5db", display: "block", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 }}>No team members yet</div>
                  <div style={{ fontSize: "0.688rem", color: "#9ca3af", marginTop: 3 }}>
                    Assign stakeholders to collaborate on this project
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {stakeholders.map((sh) => (
                    <div key={sh.id} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 10px", borderRadius: 8,
                      background: "#fafafa", border: "1px solid #f3f4f6",
                    }}>
                      <Avatar initials={getInitials(sh.name)} color={avatarColor(sh.id)} size="Xs" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#111827",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sh.name}
                        </div>
                        <div style={{ fontSize: "0.625rem", color: "#9ca3af" }}>
                          {sh.discipline || sh.email || "–"}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromProject(sh.id)}
                        title="Remove from project"
                        style={{ background: "none", border: "none", cursor: "pointer",
                          color: "#d1d5db", padding: 2, fontSize: 16, lineHeight: 1, borderRadius: 4 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#d1d5db"}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )} */}

          {/* ── Assets tab ── */}
          {rightTab === "assets" && (
            attVersions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <RiAttachment2 style={{ fontSize: 24, color: "#d1d5db", display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 }}>No assets yet</div>
                <div style={{ fontSize: "0.688rem", color: "#9ca3af", marginTop: 3 }}>
                  Attach files to tasks to see versions here
                </div>
              </div>
            ) : (
              <CommitTimeline groups={attVersions} onDownload={handleDownloadVersion} onSelect={setSelectedVersion} />
            )
          )}
        </div>
      </div>

      {/* ── Top Nav ── */}
      <div className="topNav">
        <div className="topNavLeft">
          <div className="orgSwitcherWrap" ref={switcherRef}>
            <button
              className="orgSwitcher"
              onClick={() => setSwitcherOpen((o) => !o)}
            >
              <RiBriefcaseLine className="iconSize15" />
              {project.name}
              <RiArrowDownSLine className="iconSize14" />
            </button>
            {switcherOpen && (
              <div className="orgSwitcherDropdown">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`orgSwitcherItem${p.id === project.id ? " orgSwitcherItemActive" : ""}`}
                    onClick={() => {
                      setSwitcherOpen(false);
                      router.push(`/sites/${p.id}`);
                    }}
                  >
                    <RiBriefcaseLine style={{ fontSize: "0.812rem", flexShrink: 0 }} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="topNavRight">
          <div className="statusChip">
            <RiMailLine className="iconSize14" />
            <span>Gmail Connected</span>
            <span className="statusDot" />
          </div>
          <button className="iconBtn">
            <RiBellLine className="iconSize18" />
          </button>
        </div>
      </div>

      {selectedVersion && (
        <VersionDetailModal
          version={selectedVersion}
          allGroups={attVersions}
          onClose={() => setSelectedVersion(null)}
          onDownload={handleDownloadVersion}
          onReview={handleReviewVersion}
        />
      )}
    </div>
  );
}
