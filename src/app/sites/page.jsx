"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiBriefcaseLine,
  RiArrowDownSLine,
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
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import toast from "react-hot-toast";
import {
  listProjects,
  getProject,
  getProjectReviewItems,
  getProjectUpcomingDeadlines,
  getProjectDecisions,
  getProjectStakeholders,
  createProjectReviewItem,
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

const KANBAN_COLS = [
  { id: "new",                title: "New" },
  { id: "in_review",          title: "In Review" },
  { id: "waiting_on_external",title: "Waiting on External" },
  { id: "needs_decision",     title: "Needs Decision" },
  { id: "approved_closed",    title: "Approved / Closed" },
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

const AVATAR_COLORS = [
  "#4f6bed", "#059669", "#6b7280", "#0891b2",
  "#d97706", "#dc2626", "#7c3aed", "#ea580c",
];

const DISCIPLINE_OPTIONS = [
  { value: "architect",  label: "Architecture" },
  { value: "engineer",   label: "MEP / Engineering" },
  { value: "contractor", label: "Contractor" },
  { value: "consultant", label: "Consultant / Legal" },
  { value: "other",      label: "Other" },
];

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

function reviewItemToCard(ri) {
  const discKey   = DISC_KEY[ri.discipline]   || "Dev";
  const discLabel = DISC_LABEL[ri.discipline] || (ri.discipline || "Other");
  const pri       = (ri.priority || "").toLowerCase();
  const priLabel  = ri.status === "approved_closed"
    ? "Approved"
    : pri === "high" ? "High" : pri === "medium" ? "Medium" : "Low";

  return {
    id:          ri.id,
    disc:        discLabel,
    discKey,
    title:       ri.title,
    desc:        ri.description || "",
    av:          getInitials(ri.owner_name || ""),
    avColor:     avatarColor(ri.owner_id),
    date:        ri.due_date ? formatDate(ri.due_date) : "—",
    priority:    priLabel,
    comments:    ri.comment_count   || 0,
    attachments: ri.attachment_count || 0,
  };
}

/* ── Sub-components ──────────────────────────────────── */

function Avatar({ initials, color, size = "Md" }) {
  return (
    <div className={`avatar avatar${size}`} style={{ background: color }}>
      {initials}
    </div>
  );
}

function ReviewCard({ card }) {
  const tagClass = DISC_TAG_CLASS[card.discKey] || "tagDev";
  const priorityEl =
    card.priority === "High"     ? <span className="badgeHigh">High</span>     :
    card.priority === "Medium"   ? <span className="badgeMedium">Medium</span> :
    card.priority === "Approved" ? <span className="badgeApproved">Approved</span> :
                                   <span className="badgeMedium">Low</span>;

  return (
    <div className="reviewCard">
      <div className="cardDiscipline">
        <span className={`tag ${tagClass}`}>{card.disc}</span>
      </div>
      <div className="cardTitle">{card.title}</div>
      {card.desc && <div className="cardDesc">{card.desc}</div>}
      <div className="cardFooter">
        {card.av ? (
          <Avatar initials={card.av} color={card.avColor} size="Xs" />
        ) : (
          <span style={{ width: 22 }} />
        )}
        <span className="cardDate">
          <RiCalendarLine className="iconSize12" />
          {card.date}
        </span>
        {priorityEl}
      </div>
      <div className="cardMeta">
        <span className="cardMetaItem">
          <RiChat3Line className="iconSize12" /> {card.comments}
        </span>
        <span className="cardMetaItem">
          <RiAttachment2 className="iconSize12" /> {card.attachments}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({ col, onAdd }) {
  return (
    <div className="kanbanCol">
      <div className="kanbanColHeader">
        <span className="kanbanColTitle">{col.title}</span>
        <span className="kanbanColCount">{col.cards.length}</span>
        <button className="iconBtn" style={{ padding: "2px 4px" }}>
          <RiMoreLine className="iconSize14" />
        </button>
      </div>
      <div className="kanbanCards">
        {col.cards.map((card) => <ReviewCard key={card.id} card={card} />)}
      </div>
      <div className="kanbanAddRow" onClick={onAdd}>
        <RiAddLine className="iconSize14" /> Add review item
      </div>
    </div>
  );
}

/* ── Add Review Item Modal ───────────────────────────── */

function AddReviewItemModal({ projectId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title:       "",
    description: "",
    discipline:  "architect",
    priority:    "medium",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await createProjectReviewItem(projectId, {
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        discipline:  form.discipline,
        priority:    form.priority,
        source:      "manual",
      });
      toast.success("Review item created");
      onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to create review item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="addItemModal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <span className="modalTitle">Add Review Item</span>
          <button className="iconBtn" onClick={onClose}>
            <RiCloseLine className="iconSize16" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modalBody">
          <div className="formGroup">
            <label className="formLabel">Title *</label>
            <input
              className="formInput"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Clarify setback at south property line"
              autoFocus
            />
          </div>
          <div className="formGroup">
            <label className="formLabel">Description</label>
            <textarea
              className="formTextarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide additional context..."
              rows={3}
            />
          </div>
          <div className="formRow">
            <div className="formGroup" style={{ flex: 1 }}>
              <label className="formLabel">Discipline</label>
              <select
                className="formSelect"
                value={form.discipline}
                onChange={(e) => setForm({ ...form, discipline: e.target.value })}
              >
                {DISCIPLINE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="formGroup" style={{ flex: 1 }}>
              <label className="formLabel">Priority</label>
              <select
                className="formSelect"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="modalFooter">
            <button type="button" className="outlineBtn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primaryBtn" disabled={saving}>
              {saving ? "Creating…" : "Create Item"}
            </button>
          </div>
        </form>
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
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading project…</div>
      </div>
      <div className="rightPanel" />
      <div className="topNav" />
    </div>
  );
}

/* ── Inner page ──────────────────────────────────────── */

function SitesPageInner() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const projectIdParam = searchParams.get("project_id");

  const [loading,      setLoading]      = useState(true);
  const [project,      setProject]      = useState(null);
  const [reviewItems,  setReviewItems]  = useState([]);
  const [deadlines,    setDeadlines]    = useState([]);
  const [decisions,    setDecisions]    = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [showModal,    setShowModal]    = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;

      if (!projectId) {
        const listRes = await listProjects();
        const projects = listRes?.data || [];
        if (!projects.length) { setLoading(false); return; }
        projectId = projects[0].id;
      }

      const [projRes, riRes, dlRes, decRes, shRes] = await Promise.all([
        getProject(projectId),
        getProjectReviewItems(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
      ]);

      setProject(projRes?.data || null);
      setReviewItems(riRes?.data || []);
      setDeadlines(dlRes?.data   || []);
      setDecisions(decRes?.data  || []);
      setStakeholders(shRes?.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── derived data ── */
  const kanbanCols = KANBAN_COLS.map((col) => ({
    ...col,
    cards: reviewItems
      .filter((ri) => ri.status === col.id)
      .map(reviewItemToCard),
  }));

  const openItems     = reviewItems.filter((ri) => ri.status !== "approved_closed");
  const waitingItems  = reviewItems.filter((ri) => ri.status === "waiting_on_external");
  const decisionItems = reviewItems.filter((ri) => ri.status === "needs_decision");
  const dueThisWeek   = deadlines.filter((d) => {
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

  if (!project) {
    return (
      <div className="sitesShell">
        <Sidebar />
        <div className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No project found</div>
            <div style={{ fontSize: 13 }}>Create a project first from the inbox.</div>
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
            <button className="primaryBtn" onClick={() => setShowModal(true)}>
              <RiAddLine className="iconSize14" /> Add Review Item
            </button>
          </div>
        </div>

        {/* Project header */}
        <div className="projectHeader">
          <div className="projectMeta">
            <div className="projectThumb">
              <RiMapPin2Line style={{ fontSize: 26 }} />
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
                <div className="statLabel">Open Review Items</div>
                <div className="statValue">{openItems.length}</div>
                <div className="statSub">{reviewItems.length} total items</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Waiting on External</div>
                <div className="statValue">{waitingItems.length}</div>
                <div className="statSub">
                  {openItems.length
                    ? `${Math.round((waitingItems.length / openItems.length) * 100)}% of open items`
                    : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Needs Decision</div>
                <div className="statValue">{decisionItems.length}</div>
                <div className="statSub">
                  {openItems.length
                    ? `${Math.round((decisionItems.length / openItems.length) * 100)}% of open items`
                    : "—"}
                </div>
              </div>
              <div className="statItem">
                <div className="statLabel">Due This Week</div>
                <div className="statValue">{dueThisWeek.length}</div>
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

        {/* Kanban */}
        <div className="kanbanOuter">
          {kanbanCols.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              onAdd={() => setShowModal(true)}
            />
          ))}
        </div>
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
          <button className="orgSwitcher">
            <RiBriefcaseLine className="iconSize15" />
            {project.name}
            <RiArrowDownSLine className="iconSize14" />
          </button>
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

      {/* ── Add Review Item Modal ── */}
      {showModal && (
        <AddReviewItemModal
          projectId={project.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadData(); }}
        />
      )}

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
