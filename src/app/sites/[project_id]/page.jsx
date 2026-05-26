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
  getTaskAttachments,
  uploadTaskAttachment,
  uploadAttachmentVersion,
  getAttachmentGroupHistory,
  reviewAttachment,
  downloadAttachment,
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

/* ── Attachment helpers ── */
const SOURCE_CFG = {
  email:       { label: "Email",       icon: RiMailIcon,   color: "#6b7280", bg: "#f3f4f6" },
  builder:     { label: "Builder",     icon: RiHammerLine, color: "#2563eb", bg: "#eff6ff" },
  stakeholder: { label: "Stakeholder", icon: RiGroupLine,  color: "#7c3aed", bg: "#f5f3ff" },
};
const REVIEW_CFG = {
  pending:            { label: "Pending",          color: "#d97706", bg: "#fffbeb" },
  approved:           { label: "Approved",         color: "#16a34a", bg: "#f0fdf4" },
  revision_requested: { label: "Needs Revision",   color: "#dc2626", bg: "#fef2f2" },
};

function attFileIcon(name = "") {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return RiFilePdfLine;
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return RiFileImageLine;
  return RiFileTextLine;
}
function fmtBytes(b) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function timeAgoShort(iso) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}

/* ── Attachment Group (kanban panel version) ── */
function KanbanAttGroup({ group, onUpload, onReview, onDownload }) {
  const [expanded,     setExpanded]     = useState(false);
  const [history,      setHistory]      = useState(null);
  const [loadingHist,  setLoadingHist]  = useState(false);
  const [reviewing,    setReviewing]    = useState(false);
  const fileRef = useRef(null);

  const src  = SOURCE_CFG[group.source] || SOURCE_CFG.email;
  const rv   = REVIEW_CFG[group.review_status] || REVIEW_CFG.pending;
  const Icon = attFileIcon(group.file_name);
  const SrcIcon = src.icon;

  async function toggleHistory() {
    if (expanded) { setExpanded(false); return; }
    setLoadingHist(true);
    try {
      const res = await getAttachmentGroupHistory(group.group_id);
      setHistory(res?.data || []);
      setExpanded(true);
    } catch { toast.error("Failed to load history"); }
    finally { setLoadingHist(false); }
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    onUpload(group.group_id, f);
    e.target.value = "";
  }

  async function handleReview(status) {
    setReviewing(true);
    try { await onReview(group.attachment_id, group.group_id, status); }
    finally { setReviewing(false); }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 8, overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#fafafa", borderBottom: expanded ? "1px solid #e5e7eb" : "none" }}>
        <Icon style={{ fontSize: 14, color: "#6b7280", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#111827", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.name || group.file_name}
        </span>
        <span style={{ fontSize: "0.625rem", fontWeight: 500, padding: "1px 5px", borderRadius: 999, background: src.bg, color: src.color, display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <SrcIcon style={{ fontSize: 9 }} />{src.label}
        </span>
        <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "#e0e7ff", color: "#4338ca", flexShrink: 0 }}>
          v{group.version}
        </span>
      </div>

      {/* body */}
      <div style={{ padding: "6px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.688rem", color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {group.file_name}
            {group.file_size ? <span style={{ color: "#9ca3af", marginLeft: 4 }}>({fmtBytes(group.file_size)})</span> : null}
          </span>
          <span style={{ fontSize: "0.625rem", fontWeight: 500, padding: "1px 6px", borderRadius: 999, background: rv.bg, color: rv.color, flexShrink: 0 }}>
            {rv.label}
          </span>
          <button onClick={() => onDownload(group.attachment_id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>
            <RiDownload2Line style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          <input type="file" ref={fileRef} style={{ display: "none" }} onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.625rem", padding: "2px 7px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" }}>
            <RiUpload2Line style={{ fontSize: 10 }} /> Upload v{(group.version || 1) + 1}
          </button>

          {group.review_status === "pending" && (
            <>
              <button disabled={reviewing} onClick={() => handleReview("approved")} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.625rem", padding: "2px 7px", borderRadius: 4, border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", cursor: "pointer" }}>
                <RiCheckLine style={{ fontSize: 10 }} /> Approve
              </button>
              <button disabled={reviewing} onClick={() => handleReview("revision_requested")} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.625rem", padding: "2px 7px", borderRadius: 4, border: "1px solid #dc2626", background: "#fef2f2", color: "#dc2626", cursor: "pointer" }}>
                <RiRefreshLine style={{ fontSize: 10 }} /> Revise
              </button>
            </>
          )}

          {(group.version_count || 1) > 1 && (
            <button onClick={toggleHistory} disabled={loadingHist} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.625rem", padding: "2px 7px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#6b7280", cursor: "pointer" }}>
              {loadingHist ? "…" : <>{group.version_count} ver {expanded ? <RiArrowUpSLine style={{ fontSize: 11 }} /> : <RiArrowDownSLine style={{ fontSize: 11 }} />}</>}
            </button>
          )}
        </div>
      </div>

      {/* history */}
      {expanded && history && (
        <div style={{ borderTop: "1px solid #f3f4f6", background: "#f9fafb" }}>
          {history.map((v, i) => {
            const vRv = REVIEW_CFG[v.review_status] || REVIEW_CFG.pending;
            const vSrc = SOURCE_CFG[v.source] || SOURCE_CFG.email;
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderBottom: i < history.length - 1 ? "1px solid #f3f4f6" : "none", opacity: v.is_latest ? 1 : 0.65 }}>
                <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: v.is_latest ? "#e0e7ff" : "#f3f4f6", color: v.is_latest ? "#4338ca" : "#9ca3af", flexShrink: 0 }}>v{v.version}</span>
                <span style={{ flex: 1, fontSize: "0.688rem", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.file_name}</span>
                <span style={{ fontSize: "0.625rem", color: vSrc.color, flexShrink: 0 }}>{vSrc.label}</span>
                <span style={{ fontSize: "0.625rem", color: vRv.color, flexShrink: 0 }}>{vRv.label}</span>
                <button onClick={() => onDownload(v.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, flexShrink: 0 }}>
                  <RiDownload2Line style={{ fontSize: 12 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
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
function TaskCard({ card, onClick }) {
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
        {card.av && <Avatar initials={card.av} color={card.avColor} size="Xs" />}
        {card.stakeholder_name && (
          <span className="taskCardAssignee">{card.stakeholder_name}</span>
        )}
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
function KanbanColumn({ col, onCardClick, onRename, onDelete }) {
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
                    <TaskCard card={card} onClick={() => onCardClick(card)} />
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

  // ── Asset versioning panel ──
  const [selectedTask,  setSelectedTask]  = useState(null);
  const [taskAtts,      setTaskAtts]      = useState([]);
  const [loadingAtts,   setLoadingAtts]   = useState(false);
  const [uploadingAtt,  setUploadingAtt]  = useState(false);
  const attFileRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, projRes, kanbanRes, dlRes, decRes, shRes, riRes, riColRes] = await Promise.all([
        listProjects(),
        getProject(projectId),
        getProjectKanban(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
        getProjectReviewItems(projectId),
        getKanbanColumns("review_item"),
      ]);
      setProjects(listRes?.data || []);
      setProject(projRes?.data || null);
      setKanban(kanbanRes?.data || null);
      setDeadlines(dlRes?.data  || []);
      setDecisions(decRes?.data || []);
      setStakeholders(shRes?.data || []);
      setReviewItems(riRes?.data || []);

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

  // ── Asset versioning handlers ──
  async function handleTaskCardClick(card) {
    setSelectedTask(card);
    setLoadingAtts(true);
    setTaskAtts([]);
    try {
      const res = await getTaskAttachments(projectId, card.id);
      setTaskAtts(res?.data || []);
    } catch { setTaskAtts([]); }
    finally { setLoadingAtts(false); }
  }

  async function refreshTaskAtts() {
    if (!selectedTask) return;
    try {
      const res = await getTaskAttachments(projectId, selectedTask.id);
      setTaskAtts(res?.data || []);
    } catch {}
  }

  async function handlePanelUploadVersion(groupId, file) {
    try {
      await uploadAttachmentVersion(groupId, file, null);
      toast.success("New version uploaded");
      await refreshTaskAtts();
    } catch { toast.error("Failed to upload version"); }
  }

  async function handlePanelReview(attachmentId, groupId, status) {
    try {
      await reviewAttachment(attachmentId, status, null);
      toast.success(status === "approved" ? "Approved" : "Revision requested");
      await refreshTaskAtts();
    } catch { toast.error("Failed to review"); }
  }

  async function handlePanelDownload(attachmentId) {
    try { await downloadAttachment(attachmentId); }
    catch { toast.error("Failed to download"); }
  }

  async function handlePanelAttachFile(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    e.target.value = "";
    setUploadingAtt(true);
    try {
      await uploadTaskAttachment(projectId, selectedTask.id, file);
      toast.success("File attached");
      await refreshTaskAtts();
    } catch { toast.error("Failed to attach file"); }
    finally { setUploadingAtt(false); }
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

  const deadlines5 = deadlines.slice(0, 5);
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
                  onCardClick={handleTaskCardClick}
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

      {/* ── Right Panel ── */}
      <div className="rightPanel">
        {selectedTask ? (
          /* ── Task attachment versioning panel ── */
          <>
            <div className="rightPanelHeader" style={{ flexDirection: "column", alignItems: "stretch", gap: 0, padding: "10px 14px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <button
                  onClick={() => setSelectedTask(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0, display: "flex", alignItems: "center", gap: 3, fontSize: "0.719rem" }}
                >
                  <RiCloseLine style={{ fontSize: 14 }} /> Close
                </button>
                <button
                  onClick={() => router.push(`/sites/${projectId}/tasks/${selectedTask.id}`)}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#2563eb", padding: 0, display: "flex", alignItems: "center", gap: 3, fontSize: "0.719rem" }}
                >
                  Open task <RiArrowRightLine style={{ fontSize: 12 }} />
                </button>
              </div>
              <div style={{ fontSize: "0.812rem", fontWeight: 700, color: "#111827", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedTask.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <div className="rightPanelTitle" style={{ fontSize: "0.75rem" }}>
                  <RiAttachment2 style={{ fontSize: 13 }} /> Assets
                  {taskAtts.length > 0 && <span style={{ marginLeft: 4, background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "0 5px", fontSize: "0.625rem", fontWeight: 700 }}>{taskAtts.length}</span>}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="file" ref={attFileRef} style={{ display: "none" }} onChange={handlePanelAttachFile} />
                  <button
                    onClick={() => attFileRef.current?.click()}
                    disabled={uploadingAtt}
                    style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.688rem", padding: "3px 8px", borderRadius: 4, border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
                  >
                    <RiUpload2Line style={{ fontSize: 11 }} />
                    {uploadingAtt ? "…" : "Attach"}
                  </button>
                </div>
              </div>
            </div>
            <div className="rightPanelBody">
              {loadingAtts ? (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "1rem 0", textAlign: "center" }}>Loading…</div>
              ) : taskAtts.length === 0 ? (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "1.5rem 0", textAlign: "center" }}>
                  <RiAttachment2 style={{ fontSize: 22, color: "#d1d5db", display: "block", margin: "0 auto 6px" }} />
                  No attachments yet
                </div>
              ) : (
                taskAtts.map((group, i) => (
                  <KanbanAttGroup
                    key={group.group_id || i}
                    group={group}
                    onUpload={handlePanelUploadVersion}
                    onReview={handlePanelReview}
                    onDownload={handlePanelDownload}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          /* ── Site overview (default) ── */
          <>
            <div className="rightPanelHeader">
              <div className="rightPanelTitle">
                <RiCalendarLine className="iconSize15" />
                Site Overview
              </div>
            </div>
            <div className="rightPanelBody">

              <div className="rSection">
                <div className="rSectionHeader">
                  <span className="rSectionTitle">Upcoming Deadlines</span>
                  <span className="rViewAll">View calendar</span>
                </div>
                {deadlines.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "0.25rem 0" }}>No upcoming deadlines</div>
                )}
                {deadlines5.map((d, i) => {
                  const pri = (d.priority || "").toLowerCase();
                  return (
                    <div key={i} className="deadlineItem">
                      <span className="deadlineDate">{formatDate(d.due_date)}</span>
                      <span className="deadlineTitle" title={d.title}>{d.title}</span>
                      <span className={pri === "high" ? "badgeHigh" : "badgeMedium"}>
                        {pri === "high" ? "High" : "Medium"}
                      </span>
                    </div>
                  );
                })}
                {deadlines.length > 5 && (
                  <span className="moreLink">+ {deadlines.length - 5} more</span>
                )}
              </div>

              <div className="rSection">
                <div className="rSectionHeader">
                  <span className="rSectionTitle">Latest Decisions</span>
                  <span className="rViewAll">View all</span>
                </div>
                {decisions.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "0.25rem 0" }}>No decisions yet</div>
                )}
                {decisions.slice(0, 5).map((d, i) => (
                  <div key={i} className="decisionItem">
                    <div className="decisionCheck">
                      <RiCheckLine className="iconSize12" />
                    </div>
                    <div>
                      <div className="decisionTitle">{d.review_item_title || d.notes || "—"}</div>
                      <div className="decisionSub">
                        {d.decided_by_name && <>Approved by {d.decided_by_name}<br /></>}
                        {d.decided_at ? formatLongDate(d.decided_at) : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rSection">
                <div className="rSectionHeader">
                  <span className="rSectionTitle">Stakeholders</span>
                  <span className="rViewAll">View all</span>
                </div>
                {stakeholders.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", padding: "0.25rem 0" }}>No stakeholders yet</div>
                )}
                {stakeholders.slice(0, 6).map((s, i) => (
                  <div key={s.id || i} className="stakeholderItem">
                    <Avatar initials={getInitials(s.name)} color={avatarColor(s.id)} size="Xs" />
                    <span className="stakeholderName">{s.name}</span>
                    <span className="stakeholderRole">{DISC_LABEL[s.discipline] || s.discipline || "—"}</span>
                    <span className="stakeholderCount">{s.open_items || 0}</span>
                  </div>
                ))}
                <div className="inviteRow" onClick={() => router.push("/stakeholders")}>
                  <RiUserAddLine className="iconSize14" /> Manage stakeholders
                </div>
              </div>

            </div>
          </>
        )}
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

    </div>
  );
}
