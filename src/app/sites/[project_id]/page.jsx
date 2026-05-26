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
const SOURCE_LABEL = { email: "Email", builder: "Builder", stakeholder: "Stakeholder" };
const SOURCE_COLOR = { email: "#6b7280", builder: "#2563eb", stakeholder: "#7c3aed" };
const REVIEW_DOT   = { pending: "#f59e0b", approved: "#16a34a", revision_requested: "#ef4444" };
const REVIEW_LABEL = { pending: "Pending", approved: "Approved", revision_requested: "Needs Revision" };
const SPINE_COLOR  = "#d8b4fe"; /* GitHub-style purple graph line */

function attFileIcon(name = "") {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return RiFilePdfLine;
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return RiFileImageLine;
  return RiFileTextLine;
}
function timeAgoShort(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

/* ── GitHub-graph asset feed ── */
function AssetGraph({ groups, onDownload }) {
  /* Flatten all versions across all groups, sort newest first */
  const entries = [];
  (groups || []).forEach((g) => {
    (g.versions || []).forEach((v) => {
      entries.push({ ...v, groupName: g.name, taskTitle: g.task_title, riTitle: g.ri_title });
    });
  });
  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (entries.length === 0) return null;

  return (
    <div style={{ padding: "4px 0" }}>
      {entries.map((v, i) => {
        const isLast   = i === entries.length - 1;
        const dotColor = REVIEW_DOT[v.review_status]  || "#d1d5db";
        const srcColor = SOURCE_COLOR[v.source]        || "#6b7280";
        const srcLabel = SOURCE_LABEL[v.source]        || v.source;
        const rvLabel  = REVIEW_LABEL[v.review_status] || v.review_status;
        const Icon     = attFileIcon(v.groupName);
        const context  = v.taskTitle || v.riTitle || "";

        return (
          <div key={`${v.id}-${i}`} style={{ display: "flex", gap: 0 }}>

            {/* ── Graph spine column ── */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
              {/* dot */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
                {/* outer glow ring for latest */}
                {v.is_latest && (
                  <div style={{
                    position: "absolute",
                    width: 18, height: 18,
                    borderRadius: "50%",
                    border: `2px solid ${dotColor}`,
                    opacity: 0.35,
                  }} />
                )}
                <div style={{
                  width: v.is_latest ? 11 : 9,
                  height: v.is_latest ? 11 : 9,
                  borderRadius: "50%",
                  background: v.is_latest ? dotColor : "#fff",
                  border: `2px solid ${v.is_latest ? dotColor : SPINE_COLOR}`,
                  flexShrink: 0,
                  zIndex: 1,
                }} />
              </div>
              {/* spine line below dot */}
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 16, background: SPINE_COLOR, borderRadius: 1, marginTop: 2 }} />
              )}
            </div>

            {/* ── Commit card ── */}
            <div style={{
              flex: 1,
              marginLeft: 6,
              marginBottom: isLast ? 0 : 10,
              background: v.is_latest ? "#faf5ff" : "#fafafa",
              border: `1px solid ${v.is_latest ? "#e9d5ff" : "#f0f0f0"}`,
              borderRadius: 6,
              padding: "7px 10px",
              marginTop: 4,
            }}>
              {/* file name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <Icon style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }} />
                <span style={{
                  fontSize: "0.719rem", fontWeight: 600,
                  color: "#111827", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {v.groupName}
                </span>
                {/* version badge — like a git hash */}
                <code style={{
                  fontSize: "0.594rem", fontWeight: 700,
                  padding: "1px 6px", borderRadius: 4,
                  background: v.is_latest ? "#ede9fe" : "#f3f4f6",
                  color: v.is_latest ? "#6d28d9" : "#6b7280",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}>
                  v{v.version}
                </code>
              </div>

              {/* badges row */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {v.is_latest && (
                  <span style={{
                    fontSize: "0.594rem", fontWeight: 700,
                    padding: "1px 6px", borderRadius: 999,
                    background: "#dcfce7", color: "#15803d",
                    border: "1px solid #bbf7d0",
                  }}>
                    HEAD
                  </span>
                )}
                <span style={{ fontSize: "0.625rem", color: srcColor, fontWeight: 500 }}>
                  {srcLabel}
                </span>
                <span style={{ fontSize: "0.594rem", color: dotColor, fontWeight: 500 }}>
                  · {rvLabel}
                </span>
                {context && (
                  <span style={{
                    fontSize: "0.594rem", color: "#9ca3af",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 90,
                  }}>
                    · {context}
                  </span>
                )}
                <span style={{ fontSize: "0.594rem", color: "#9ca3af", marginLeft: "auto" }}>
                  {timeAgoShort(v.created_at)}
                </span>
                <button
                  onClick={() => onDownload(v.id)}
                  title="Download"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#c4b5fd", padding: 0, display: "flex" }}
                >
                  <RiDownload2Line style={{ fontSize: 12 }} />
                </button>
              </div>

              {v.version_note && (
                <div style={{ fontSize: "0.625rem", color: "#6b7280", marginTop: 4, fontStyle: "italic" }}>
                  {v.version_note}
                </div>
              )}
            </div>
          </div>
        );
      })}
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
  const [attVersions,  setAttVersions]  = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, projRes, kanbanRes, dlRes, decRes, shRes, riRes, riColRes, attVerRes] = await Promise.all([
        listProjects(),
        getProject(projectId),
        getProjectKanban(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
        getProjectReviewItems(projectId),
        getKanbanColumns("review_item"),
        getProjectAttachmentVersions(projectId).catch(() => ({ data: [] })),
      ]);
      setProjects(listRes?.data || []);
      setProject(projRes?.data || null);
      setKanban(kanbanRes?.data || null);
      setDeadlines(dlRes?.data  || []);
      setDecisions(decRes?.data || []);
      setStakeholders(shRes?.data || []);
      setReviewItems(riRes?.data || []);
      setAttVersions(attVerRes?.data || []);

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

  async function handleDownloadVersion(attachmentId) {
    try { await downloadAttachment(attachmentId); }
    catch { toast.error("Failed to download"); }
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
                  onCardClick={(card) => router.push(`/sites/${projectId}/tasks/${card.id}`)}
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

      {/* ── Right Panel: Asset Versions ── */}
      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiAttachment2 className="iconSize15" />
            Asset Versions
            {attVersions.length > 0 && (
              <span style={{ marginLeft: 5, background: "#e0e7ff", color: "#4338ca", borderRadius: 999, padding: "1px 6px", fontSize: "0.594rem", fontWeight: 700 }}>
                {attVersions.length}
              </span>
            )}
          </div>
        </div>
        <div className="rightPanelBody">
          {attVersions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <RiAttachment2 style={{ fontSize: 24, color: "#d1d5db", display: "block", margin: "0 auto 8px" }} />
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500 }}>No assets yet</div>
              <div style={{ fontSize: "0.688rem", color: "#9ca3af", marginTop: 3 }}>
                Attach files to tasks to see versions here
              </div>
            </div>
          ) : (
            <AssetGraph groups={attVersions} onDownload={handleDownloadVersion} />
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

    </div>
  );
}
