"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiBriefcaseLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiMailLine,
  RiBellLine,
  RiStarLine,
  RiStarFill,
  RiShareLine,
  RiAddLine,
  RiCalendarLine,
  RiChat3Line,
  RiAttachment2,
  RiCheckLine,
  RiMoreLine,
  RiMapPin2Line,
  RiUserAddLine,
  RiCloseLine,
  RiAlertLine,
  RiBuildingLine,
  RiFlashlightLine,
  RiHammerLine,
  RiShieldLine,
  RiTimeLine,
  RiFolder3Line,
  RiTeamLine,
  RiTaskLine,
  RiSearchLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiImageLine,
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import toast from "react-hot-toast";
import {
  listProjects,
  getProject,
  getProjectKanban,
  getProjectUpcomingDeadlines,
  getProjectDecisions,
  getProjectStakeholders,
  getProjectReviewItems,
  updateProjectTaskStatus,
  updateProjectReviewItemStatus,
  createProject,
  updateProject,
  deleteProject,
  uploadProjectLogo,
} from "../../lib/api";
import "./sites.css";

/* ── Constants ─────────────────────────────────────── */

const PHASES = [
  "Concept",
  "Test Fit",
  "Due Diligence",
  "Schematic Design",
  "Design Development",
  "Gate Review",
  "Handoff",
  "Exec. Response",
];

const TASK_KANBAN_COLS = [
  { id: "open",        title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "blocked",     title: "Blocked" },
  { id: "done",        title: "Done" },
];

const DISC_LABEL = {
  architect:  "Architecture",
  engineer:   "MEP",
  contractor: "Contractor",
  consultant: "Legal",
  other:      "Other",
};

const DISC_KEY = {
  architect:  "Arch",
  engineer:   "Mep",
  contractor: "Dev",
  consultant: "Legal",
  other:      "Dev",
};

const DISC_TAG_CLASS = {
  Arch:      "tagArch",
  Mep:       "tagMep",
  Legal:     "tagLegal",
  Sales:     "tagSales",
  Landscape: "tagLandscape",
  Dev:       "tagDev",
};

const DISC_ICON = {
  architect:  RiBuildingLine,
  engineer:   RiFlashlightLine,
  contractor: RiHammerLine,
  consultant: RiShieldLine,
  other:      RiAlertLine,
};

const STATUS_BADGE = {
  open:        { label: "To Do",       cls: "badgeMedium" },
  in_progress: { label: "In Progress", cls: "badgeInProgress" },
  blocked:     { label: "Blocked",     cls: "badgeHigh" },
  done:        { label: "Done",        cls: "badgeApproved" },
};

const AVATAR_COLORS = [
  "#4f6bed", "#059669", "#6b7280", "#0891b2",
  "#d97706", "#dc2626", "#7c3aed", "#ea580c",
];

const RI_ACCENT_COLORS = [
  { border: "#2563eb", bg: "#eff6ff" }, // blue
  { border: "#16a34a", bg: "#f0fdf4" }, // green
  { border: "#9333ea", bg: "#faf5ff" }, // purple
  { border: "#ea580c", bg: "#fff7ed" }, // orange
  { border: "#0891b2", bg: "#ecfeff" }, // cyan
  { border: "#db2777", bg: "#fdf2f8" }, // pink
  { border: "#65a30d", bg: "#f7fee7" }, // lime
  { border: "#d97706", bg: "#fffbeb" }, // amber
];

const RI_KANBAN_COLS = [
  { id: "new",              title: "New" },
  { id: "open",             title: "Open" },
  { id: "in_review",        title: "In Review" },
  { id: "pending_approval", title: "Pending Approval" },
  { id: "approved_closed",  title: "Closed" },
];

const RI_PRIORITY_COLORS = {
  high:   { border: "#ef4444", bg: "#fef2f2" },
  medium: { border: "#f59e0b", bg: "#fffbeb" },
  low:    { border: "#22c55e", bg: "#f0fdf4" },
};

const STAGE_OPTIONS = [
  { label: "Concept",            value: "concept" },
  { label: "Test Fit",           value: "test_fit" },
  { label: "Due Diligence",      value: "due_diligence" },
  { label: "Schematic Design",   value: "schematic_design" },
  { label: "Design Development", value: "design_development" },
  { label: "Gate Review",        value: "gate_review" },
  { label: "Handoff",            value: "handoff" },
  { label: "Exec. Response",     value: "exec_response" },
];

const STAGE_COLORS = {
  concept:            { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" },
  test_fit:           { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6" },
  due_diligence:      { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  schematic_design:   { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  design_development: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981" },
  gate_review:        { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  handoff:            { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  exec_response:      { bg: "#fefce8", text: "#a16207", dot: "#eab308" },
};

/* ── Helpers ─────────────────────────────────────────── */

function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

function avatarColor(id) {
  return AVATAR_COLORS[(Math.abs(id || 0)) % AVATAR_COLORS.length];
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getTimelineSteps(stage) {
  const normalized = (stage || "").toLowerCase().replace(/_/g, " ");
  const idx = PHASES.findIndex((p) => p.toLowerCase() === normalized);
  return PHASES.map((label, i) => ({
    label,
    state: i < idx ? "done" : i === idx ? "current" : "future",
  }));
}

/* ── Sub-components ──────────────────────────────────── */

function Avatar({ initials, color, size = "Md" }) {
  return (
    <div className={`avatar avatar${size}`} style={{ background: color }}>
      {initials}
    </div>
  );
}

function TaskCard({ card }) {
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
      style={{ borderLeftColor: borderColor }}
    >
      {/* Discipline label — colored to match border */}
      <div className="taskCardDisc" style={{ color: borderColor }}>
        {card.disc}
      </div>

      {/* Title */}
      <div className="taskCardTitle">{card.title}</div>

      {/* Description */}
      {card.desc && <div className="taskCardDesc">{card.desc}</div>}

      {/* Meta row: avatar · name · date · priority badge */}
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

      {/* Counts row: comments · attachments */}
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

function KanbanColumn({ col }) {
  return (
    <Droppable droppableId={col.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`kanbanCol${snapshot.isDraggingOver ? " kanbanColOver" : ""}`}
        >
          <div className="kanbanColHeader">
            <span className="kanbanColTitle">{col.title}</span>
            <span className="kanbanColCount">{col.cards.length}</span>
            <button className="iconBtn" style={{ padding: "2px 4px" }}>
              <RiMoreLine className="iconSize14" />
            </button>
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
                    <TaskCard card={card} />
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
      {/* Header row */}
      <div className="cardDiscipline">
        <span className={`tag ${tagClass}`}>
          <DiscIcon style={{ fontSize: 10, marginRight: 3, verticalAlign: "middle" }} />
          {DISC_LABEL[ri.discipline] || "Other"}
        </span>
        <span className={ri.priority === "high" ? "badgeHigh" : ri.priority === "low" ? "badgeLow" : "badgeMedium"}
          style={{ marginLeft: "auto" }}>
          {ri.priority}
        </span>
      </div>

      {/* Title */}
      <div className="cardTitle">{ri.title}</div>

      {/* Description */}
      {ri.description && <div className="cardDesc">{ri.description}</div>}

      {/* Tasks list */}
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

      {/* Footer */}
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

function RIKanbanColumn({ col }) {
  return (
    <Droppable droppableId={`ri-${col.id}`}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`kanbanCol${snapshot.isDraggingOver ? " kanbanColOver" : ""}`}
        >
          <div className="kanbanColHeader">
            <span className="kanbanColTitle">{col.title}</span>
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

/* ── Project modal (create / edit) ──────────────────── */

function ProjectModal({ mode, project, onSave, onClose }) {
  const [name,       setName]       = useState(project?.name     || "");
  const [location,   setLocation]   = useState(project?.location || "");
  const [stage,      setStage]      = useState(project?.stage    || "concept");
  const [logoFile,   setLogoFile]   = useState(null);
  const [logoPreview, setLogoPreview] = useState(project?.image_url || null);
  const [saving,     setSaving]     = useState(false);
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let imageUrl = project?.image_url || null;
      if (logoFile) {
        const res = await uploadProjectLogo(logoFile);
        imageUrl = res?.data?.url || imageUrl;
      } else if (logoPreview === null) {
        imageUrl = null;
      }

      if (mode === "create") {
        await createProject({ name: name.trim(), location: location.trim(), stage, image_url: imageUrl });
      } else {
        await updateProject(project.id, { name: name.trim(), location: location.trim(), stage, image_url: imageUrl });
      }
      onSave();
    } catch (err) {
      toast.error(err.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalBox" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <span className="modalTitle">{mode === "create" ? "New Project" : "Edit Project"}</span>
          <button className="iconBtn" onClick={onClose}><RiCloseLine className="iconSize16" /></button>
        </div>
        <div className="modalBody">
          {/* Logo upload */}
          <div className="modalField">
            <label className="modalLabel">Logo <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
            <div className="logoUploadRow">
              <div
                className="logoUploadPreview"
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload logo"
              >
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="logoUploadImg" />
                  : <RiImageLine style={{ fontSize: 22, color: "#9ca3af" }} />
                }
              </div>
              <div className="logoUploadActions">
                <button
                  type="button"
                  className="logoUploadBtn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? "Change image" : "Upload image"}
                </button>
                {logoPreview && (
                  <button type="button" className="logoRemoveBtn" onClick={handleRemoveLogo}>
                    Remove
                  </button>
                )}
                <span className="logoUploadHint">PNG, JPG, WebP · max 5 MB</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="modalField">
            <label className="modalLabel">Project Name <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              className="modalInput"
              placeholder="e.g. Ground Floor Plan – Riverside"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modalField">
            <label className="modalLabel">Location</label>
            <input
              className="modalInput"
              placeholder="e.g. Coimbatore"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="modalField">
            <label className="modalLabel">Stage</label>
            <select className="modalSelect" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modalFooter">
          <button className="modalBtnCancel" onClick={onClose}>Cancel</button>
          <button
            className="modalBtnPrimary"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving…" : mode === "create" ? "Create Project" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Project card (grid view) ────────────────────────── */

function ProjectCard({ project, onClick, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const stageBadge = project.stage
    ? project.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";
  const sc = STAGE_COLORS[project.stage] || { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };

  return (
    <div className="projectCard" onClick={onClick}>
      {/* Top row: icon (top-left) + ⋮ menu (top-right) */}
      <div className="projectCardTop">
        <div className="projectCardIcon" style={{ background: sc.bg }}>
          {project.image_url
            ? <img src={project.image_url} alt="" className="projectCardImg" />
            : <RiMapPin2Line style={{ fontSize: 20, color: sc.dot }} />
          }
        </div>

        <div className="projectCardMenu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button className="projectCardMenuBtn" onClick={() => setMenuOpen((o) => !o)}>
            <RiMoreLine style={{ fontSize: 16 }} />
          </button>
          {menuOpen && (
            <div className="projectCardMenuDropdown">
              <div className="projectCardMenuItem" onClick={() => { setMenuOpen(false); onEdit(); }}>
                <RiPencilLine style={{ fontSize: 13 }} /> Edit
              </div>
              <div className="projectCardMenuItem projectCardMenuItemDanger" onClick={() => { setMenuOpen(false); onDelete(); }}>
                <RiDeleteBinLine style={{ fontSize: 13 }} /> Delete
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="projectCardName">{project.name}</div>

      {project.location && (
        <div className="projectCardLocation">
          <RiMapPin2Line style={{ fontSize: 11, flexShrink: 0 }} />
          {project.location}
        </div>
      )}

      <span className="projectCardStagePill" style={{ background: sc.bg, color: sc.text }}>
        {stageBadge}
      </span>

      <div className="projectCardStats">
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">{project.open_items || 0}</span>
          <span className="projectCardStatLabel">Open items</span>
        </div>
        <div className="projectCardStatDivider" />
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">{project.stakeholder_count || 0}</span>
          <span className="projectCardStatLabel">Members</span>
        </div>
        <div className="projectCardStatDivider" />
        <div className="projectCardStatItem">
          <span className="projectCardStatVal">{formatDate(project.created_at)}</span>
          <span className="projectCardStatLabel">Created</span>
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────── */

function LoadingState() {
  return (
    <div className="sitesShell">
      <Sidebar />
      <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading…</div>
      </div>
      <div className="rightPanel" />
      <div className="topNav" />
    </div>
  );
}

/* ── Inner page ──────────────────────────────────────── */

function SitesPageInner() {
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const projectIdParam = searchParams.get("project_id");

  const [loading,        setLoading]        = useState(true);
  const [projects,       setProjects]       = useState([]);   // grid + switcher
  const [gridSearch,     setGridSearch]     = useState("");
  const [projectModal,   setProjectModal]   = useState(null); // null | {mode,project?}
  const [project,        setProject]        = useState(null);
  const [kanban,         setKanban]         = useState(null);
  const [kanbanCols,     setKanbanCols]     = useState([]);
  const [deadlines,      setDeadlines]      = useState([]);
  const [decisions,      setDecisions]      = useState([]);
  const [stakeholders,   setStakeholders]   = useState([]);
  const [switcherOpen,   setSwitcherOpen]   = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(null); // { id, name }
  const [activeTab,      setActiveTab]      = useState("tasks"); // "tasks" | "review-items"
  const [reviewItems,    setReviewItems]    = useState([]);
  const [expandedRIs,    setExpandedRIs]    = useState(new Set());
  const [riKanbanCols,   setRiKanbanCols]   = useState([]);
  const switcherRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const listRes = await listProjects();
      const list = listRes?.data || [];
      setProjects(list);

      let projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;
      if (!projectId) {
        if (!list.length) { setLoading(false); return; }
        projectId = list[0].id;
      }

      const [projRes, kanbanRes, dlRes, decRes, shRes, riRes] = await Promise.all([
        getProject(projectId),
        getProjectKanban(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
        getProjectReviewItems(projectId),
      ]);
      setProject(projRes?.data || null);
      setKanban(kanbanRes?.data || null);
      setDeadlines(dlRes?.data  || []);
      setDecisions(decRes?.data || []);
      setStakeholders(shRes?.data || []);
      setReviewItems(riRes?.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

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

  /* ── sync kanbanCols when server data changes ── */
  useEffect(() => {
    const cols = kanban?.columns || {};
    // build stable review-item → color index map (sorted IDs for consistency)
    const allTasks = Object.values(cols).flat();
    const riIds = [...new Set(allTasks.map((t) => t.review_item_id).filter(Boolean))].sort((a, b) => a - b);
    const riColorMap = Object.fromEntries(riIds.map((id, i) => [id, RI_ACCENT_COLORS[i % RI_ACCENT_COLORS.length]]));

    setKanbanCols(TASK_KANBAN_COLS.map((col) => ({
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
  }, [kanban]);

  /* ── sync riKanbanCols when reviewItems change ── */
  useEffect(() => {
    setRiKanbanCols(RI_KANBAN_COLS.map((col) => ({
      ...col,
      cards: reviewItems.filter((ri) => ri.status === col.id),
    })));
  }, [reviewItems]);

  /* ── drag & drop ── */
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

    updateProjectTaskStatus(project.id, cardId, toColId).catch((err) => {
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

  /* ── derived ── */
  const stats = kanban?.stats || {};

  const colMap        = Object.fromEntries(kanbanCols.map((c) => [c.id, c.cards.length]));
  const openCount     = (colMap.open || 0) + (colMap.in_progress || 0);
  const blockedCount  = colMap.blocked || 0;
  const doneCount     = colMap.done    || 0;
  const dueWeekCount  = stats.due_this_week || 0;
  const totalTasks    = kanbanCols.reduce((s, c) => s + c.cards.length, 0);

  const dueThisWeek = deadlines.filter((d) => {
    if (!d.due_date) return false;
    const due  = new Date(d.due_date);
    const now  = new Date();
    const week = new Date(now);
    week.setDate(week.getDate() + 7);
    return due >= now && due <= week;
  });

  const timelineSteps = project
    ? getTimelineSteps(project.stage)
    : PHASES.map((label) => ({ label, state: "future" }));

  const nextGate = project?.next_gate_review_date
    ? formatLongDate(project.next_gate_review_date)
    : "—";

  if (loading) return <LoadingState />;

  /* ── Projects grid view ── */
  if (!projectIdParam) {
    const q               = gridSearch.trim().toLowerCase();
    const filtered        = q
      ? projects.filter((p) =>
          (p.name     || "").toLowerCase().includes(q) ||
          (p.location || "").toLowerCase().includes(q)
        )
      : projects;
    const totalOpenItems  = projects.reduce((s, p) => s + (p.open_items || 0), 0);
    const totalMembers    = projects.reduce((s, p) => s + (p.stakeholder_count || 0), 0);
    const stageBreakdown  = PHASES
      .map((label) => {
        const key   = label.toLowerCase().replace(/ /g, "_");
        const count = projects.filter((p) => p.stage === key).length;
        const sc    = STAGE_COLORS[key] || { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };
        return { label, key, count, sc };
      })
      .filter((s) => s.count > 0);
    const recentProjects  = projects.slice(0, 5);

    return (
      <div className="sitesShell">
        <Sidebar />

        {/* ── Main: project grid ── */}
        <div className="main">
          <div className="breadcrumbBar">
            <span className="breadcrumbCurrent">Sites</span>
            <div className="breadcrumbActions">
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                {filtered.length} project{filtered.length !== 1 ? "s" : ""}
              </span>
              <button
                className="primaryBtn"
                onClick={() => setProjectModal({ mode: "create" })}
              >
                <RiAddLine style={{ fontSize: 14 }} /> Add Project
              </button>
            </div>
          </div>

          {projects.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
                <div style={{ fontSize: 13 }}>Confirm an email thread from the inbox to create one.</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center", color: "#6b7280" }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No results for "{gridSearch}"</div>
                <div style={{ fontSize: 12, cursor: "pointer", color: "#2563eb" }} onClick={() => setGridSearch("")}>
                  Clear search
                </div>
              </div>
            </div>
          ) : (
            <div className="projectsGrid">
              {filtered.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onClick={() => router.push(`/sites?project_id=${p.id}`)}
                  onEdit={() => setProjectModal({ mode: "edit", project: p })}
                  onDelete={() => setDeleteConfirm({ id: p.id, name: p.name })}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: portfolio overview ── */}
        <div className="rightPanel">
          <div className="rightPanelHeader">
            <div className="rightPanelTitle">
              <RiFolder3Line className="iconSize15" />
              Portfolio Overview
            </div>
          </div>
          <div className="rightPanelBody">

            {/* Summary stats */}
            <div className="rSection">
              <div className="rSectionHeader">
                <span className="rSectionTitle">Summary</span>
              </div>
              <div className="portfolioStats">
                <div className="portfolioStat">
                  <div className="portfolioStatVal">{projects.length}</div>
                  <div className="portfolioStatLabel">
                    <RiFolder3Line style={{ fontSize: 11 }} /> Projects
                  </div>
                </div>
                <div className="portfolioStat">
                  <div className="portfolioStatVal">{totalOpenItems}</div>
                  <div className="portfolioStatLabel">
                    <RiTaskLine style={{ fontSize: 11 }} /> Open Items
                  </div>
                </div>
                <div className="portfolioStat">
                  <div className="portfolioStatVal">{totalMembers}</div>
                  <div className="portfolioStatLabel">
                    <RiTeamLine style={{ fontSize: 11 }} /> Members
                  </div>
                </div>
              </div>
            </div>

            {/* By stage */}
            <div className="rSection">
              <div className="rSectionHeader">
                <span className="rSectionTitle">By Stage</span>
              </div>
              {stageBreakdown.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>No projects</div>
              ) : stageBreakdown.map((s) => (
                <div key={s.key} className="stageBreakRow">
                  <span className="stageBreakDot" style={{ background: s.sc.dot }} />
                  <span className="stageBreakLabel">{s.label}</span>
                  <span className="stageBreakCount"
                    style={{ background: s.sc.bg, color: s.sc.text }}>
                    {s.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Recently added */}
            <div className="rSection">
              <div className="rSectionHeader">
                <span className="rSectionTitle">Recently Added</span>
              </div>
              {recentProjects.map((p) => {
                const sc = STAGE_COLORS[p.stage] || { dot: "#9ca3af" };
                return (
                  <div
                    key={p.id}
                    className="recentProjItem"
                    onClick={() => router.push(`/sites?project_id=${p.id}`)}
                  >
                    <span className="recentProjDot" style={{ background: sc.dot }} />
                    <div className="recentProjInfo">
                      <div className="recentProjName">{p.name}</div>
                      <div className="recentProjMeta">
                        {p.location && <span>{p.location} · </span>}
                        {formatDate(p.created_at)}
                      </div>
                    </div>
                    <RiArrowRightSLine style={{ fontSize: 14, color: "#d1d5db", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* ── Project modal ── */}
        {projectModal && (
          <ProjectModal
            mode={projectModal.mode}
            project={projectModal.project}
            onSave={() => { setProjectModal(null); loadData(); }}
            onClose={() => setProjectModal(null)}
          />
        )}

        {deleteConfirm && (
          <div className="modalOverlay" onClick={() => setDeleteConfirm(null)}>
            <div className="modalBox" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <span className="modalTitle">Delete Project</span>
                <button className="modalClose" onClick={() => setDeleteConfirm(null)}>
                  <RiCloseLine style={{ fontSize: 18 }} />
                </button>
              </div>
              <div className="modalBody" style={{ padding: "20px 24px" }}>
                <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                  Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?
                  This cannot be undone.
                </p>
              </div>
              <div className="modalFooter">
                <button className="modalBtnCancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button
                  className="modalBtnPrimary"
                  style={{ background: "#ef4444" }}
                  onClick={async () => {
                    try {
                      await deleteProject(deleteConfirm.id);
                      setDeleteConfirm(null);
                      loadData();
                    } catch (err) {
                      toast.error(err.message || "Failed to delete project");
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Top Nav ── */}
        <div className="topNav">
          <div className="topNavLeft">
            <button className="orgSwitcher">
              <RiBriefcaseLine className="iconSize15" />
              Sites
              <RiArrowDownSLine className="iconSize14" />
            </button>
          </div>
          <div className="topNavCenter">
            <div className="searchBox">
              <RiSearchLine className="searchIcon" />
              <input
                className="searchInput"
                placeholder="Search projects…"
                value={gridSearch}
                onChange={(e) => setGridSearch(e.target.value)}
              />
              {gridSearch
                ? <button className="gridSearchClear" onClick={() => setGridSearch("")}><RiCloseLine style={{ fontSize: 13 }} /></button>
                : <span className="searchKbd">⌘K</span>
              }
            </div>
          </div>
          <div className="topNavRight">
            <button className="iconBtn"><RiBellLine className="iconSize18" /></button>
          </div>
        </div>
      </div>
    );
  }

  /* ── No project found for this ID ── */
  if (!project) {
    return (
      <div className="sitesShell">
        <Sidebar />
        <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Project not found</div>
            <div
              style={{ fontSize: 13, color: "#2563eb", cursor: "pointer" }}
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

  const phaseBadgeLabel = project.stage
    ? project.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

  return (
    <div className="sitesShell">

      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <div className="main">

        {/* Breadcrumb */}
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

        {/* Project header */}
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
              {project.location && (
                <div className="projectLocation">{project.location}</div>
              )}
              <span className="phaseBadge">{phaseBadgeLabel}</span>
            </div>

            <div className="statsRow">
              <div className="statItem">
                <div className="statLabel">Next Gate Review</div>
                <div className="statDate">
                  <RiCalendarLine className="iconSize13" /> {nextGate}
                </div>
                <div className="statSub">Gate – {phaseBadgeLabel}</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Open Tasks</div>
                <div className="statValue">{openCount}</div>
                <div className="statSub">{totalTasks} total tasks</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Blocked</div>
                <div className="statValue">{blockedCount}</div>
                <div className="statSub">
                  {openCount
                    ? `${Math.round((blockedCount / (openCount + blockedCount)) * 100)}% of open`
                    : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Completed</div>
                <div className="statValue">{doneCount}</div>
                <div className="statSub">
                  {totalTasks
                    ? `${Math.round((doneCount / totalTasks) * 100)}% done`
                    : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Due This Week</div>
                <div className="statValue">{dueWeekCount}</div>
                <div className="statSub">{deadlines.length} upcoming deadlines</div>
              </div>
            </div>

            <button className="iconBtn" style={{ alignSelf: "flex-start", marginTop: 6 }}>
              <RiMoreLine className="iconSize16" />
            </button>
          </div>

          {/* Timeline */}
          <div className="timeline">
            {timelineSteps.map((step, i) => (
              <div key={i} className={`timelineStep ${step.state}`}>
                <div className="timelineCircle">
                  {step.state === "done"    && <RiCheckLine className="iconSize12" />}
                  {step.state === "current" && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", display: "block" }} />
                  )}
                </div>
                <div className="timelineLabel">{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="projectTabBar">
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
        </div>

        {/* Kanban */}
        {activeTab === "tasks" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="kanbanOuter">
              {kanbanCols.map((col) => (
                <KanbanColumn key={col.id} col={col} />
              ))}
            </div>
          </DragDropContext>
        )}

        {/* Review Items kanban */}
        {activeTab === "review-items" && (
          <DragDropContext onDragEnd={onRIDragEnd}>
            <div className="kanbanOuter">
              {riKanbanCols.map((col) => (
                <RIKanbanColumn key={col.id} col={col} />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiCalendarLine className="iconSize15" />
            Site Overview
          </div>
        </div>

        <div className="rightPanelBody">

          {/* Upcoming Deadlines */}
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Upcoming Deadlines</span>
              <span className="rViewAll">View calendar</span>
            </div>
            {deadlines.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>No upcoming deadlines</div>
            )}
            {deadlines.slice(0, 5).map((d, i) => {
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

          {/* Latest Decisions */}
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Latest Decisions</span>
              <span className="rViewAll">View all</span>
            </div>
            {decisions.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>No decisions yet</div>
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

          {/* Stakeholders */}
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Stakeholders</span>
              <span className="rViewAll">View all</span>
            </div>
            {stakeholders.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>No stakeholders yet</div>
            )}
            {stakeholders.slice(0, 6).map((s, i) => (
              <div key={s.id || i} className="stakeholderItem">
                <Avatar initials={getInitials(s.name)} color={avatarColor(s.id)} size="Xs" />
                <span className="stakeholderName">{s.name}</span>
                <span className="stakeholderRole">
                  {DISC_LABEL[s.discipline] || s.discipline || "—"}
                </span>
                <span className="stakeholderCount">{s.open_items || 0}</span>
              </div>
            ))}
            <div className="inviteRow">
              <RiUserAddLine className="iconSize14" /> Invite stakeholder
            </div>
          </div>

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
                      router.push(`/sites?project_id=${p.id}`);
                    }}
                  >
                    <RiBriefcaseLine style={{ fontSize: 13, flexShrink: 0 }} />
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

/* ── Page export (Suspense required for useSearchParams) ── */

export default function SitesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SitesPageInner />
    </Suspense>
  );
}
