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
  RiAlertLine,
  RiBuildingLine,
  RiFlashlightLine,
  RiHammerLine,
  RiShieldLine,
  RiTimeLine,
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
  const tagClass = DISC_TAG_CLASS[card.discKey] || "tagDev";
  const DiscIcon = DISC_ICON[card.discipline] || RiAlertLine;
  const badge = STATUS_BADGE[card.status] || STATUS_BADGE.open;
  const isOverdue = card.is_overdue;

  return (
    <div className={`reviewCard${isOverdue ? " reviewCardOverdue" : ""}`}>
      <div className="cardDiscipline">
        <span className={`tag ${tagClass}`}>
          <DiscIcon style={{ fontSize: 10, marginRight: 3, verticalAlign: "middle" }} />
          {card.disc}
        </span>
      </div>
      <div className="cardTitle">{card.title}</div>
      {card.desc && <div className="cardDesc">{card.desc}</div>}
      {card.riTitle && (
        <div className="cardRiLabel" title={card.riTitle}>
          {card.riTitle}
        </div>
      )}
      <div className="cardFooter">
        {card.av ? (
          <Avatar initials={card.av} color={card.avColor} size="Xs" />
        ) : (
          <span style={{ width: 22 }} />
        )}
        <span className={`cardDate${isOverdue ? " cardDateOverdue" : ""}`}>
          <RiCalendarLine className="iconSize12" />
          {formatDate(card.due_date)}
        </span>
        <span className={badge.cls}>{badge.label}</span>
      </div>
    </div>
  );
}

function KanbanColumn({ col }) {
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
        {col.cards.map((card) => <TaskCard key={card.id} card={card} />)}
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
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const projectIdParam = searchParams.get("project_id");

  const [loading,      setLoading]      = useState(true);
  const [project,      setProject]      = useState(null);
  const [kanban,       setKanban]       = useState(null);   // { columns, stats }
  const [deadlines,    setDeadlines]    = useState([]);
  const [decisions,    setDecisions]    = useState([]);
  const [stakeholders, setStakeholders] = useState([]);

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

      const [projRes, kanbanRes, dlRes, decRes, shRes] = await Promise.all([
        getProject(projectId),
        getProjectKanban(projectId),
        getProjectUpcomingDeadlines(projectId, 7),
        getProjectDecisions(projectId),
        getProjectStakeholders(projectId),
      ]);

      setProject(projRes?.data || null);
      setKanban(kanbanRes?.data || null);
      setDeadlines(dlRes?.data  || []);
      setDecisions(decRes?.data || []);
      setStakeholders(shRes?.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── derived ── */
  const stats   = kanban?.stats || {};
  const columns = kanban?.columns || {};

  const kanbanCols = TASK_KANBAN_COLS.map((col) => ({
    ...col,
    cards: (columns[col.id] || []).map((t) => ({
      ...t,
      disc:    DISC_LABEL[t.discipline]  || "Other",
      discKey: DISC_KEY[t.discipline]    || "Dev",
      av:      getInitials(t.stakeholder_name || ""),
      avColor: avatarColor(t.stakeholder_id),
    })),
  }));

  const openCount     = (stats.open_tasks || 0) + (stats.in_progress_tasks || 0);
  const blockedCount  = stats.blocked_tasks  || 0;
  const doneCount     = stats.done_tasks     || 0;
  const dueWeekCount  = stats.due_this_week  || 0;
  const totalTasks    = stats.total_tasks    || 0;

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

        {/* Kanban */}
        <div className="kanbanOuter">
          {kanbanCols.map((col) => (
            <KanbanColumn key={col.id} col={col} />
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
