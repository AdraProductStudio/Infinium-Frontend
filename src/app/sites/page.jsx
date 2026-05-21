"use client";

import { useRouter } from "next/navigation";
import {
  RiBriefcaseLine,
  RiArrowDownSLine,
  RiMailLine,
  RiBellLine,
  RiStarLine,
  RiShareLine,
  RiAddLine,
  RiCalendarLine,
  RiChat3Line,
  RiAttachment2,
  RiCheckLine,
  RiMoreLine,
  RiArrowUpLine,
  RiMapPin2Line,
  RiUserAddLine,
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import "./sites.css";

/* ── Static data ─────────────────────────────────── */

const TIMELINE = [
  { label: "Concept",            state: "done" },
  { label: "Test Fit",           state: "done" },
  { label: "Due Diligence",      state: "done" },
  { label: "Schematic Design",   state: "done" },
  { label: "Design Development", state: "current" },
  { label: "Gate Review",        state: "future" },
  { label: "Handoff",            state: "future" },
  { label: "Exec. Response",     state: "future" },
];

const COLUMNS = [
  {
    id: "new", title: "New",
    cards: [
      { disc: "Architecture", discKey: "Arch", title: "Clarify setback at south property line",
        desc: "Confirm required building setback per zoning ordinance.",
        av: "AR", avColor: "#4f6bed", date: "May 19", priority: "High", comments: 2, attachments: 1 },
      { disc: "Landscape", discKey: "Landscape", title: "Landscape buffer requirement",
        desc: "Provide buffer width and screening details for north edge.",
        av: "JW", avColor: "#059669", date: "May 24", priority: "Medium", comments: 1, attachments: 2 },
      { disc: "MEP", discKey: "Mep", title: "Fire riser location coordination",
        desc: "Coordinate fire riser location with stair and egress paths.",
        av: "MF", avColor: "#6b7280", date: "May 22", priority: "High", comments: 2, attachments: 1 },
    ],
  },
  {
    id: "inreview", title: "In Review",
    cards: [
      { disc: "MEP", discKey: "Mep", title: "MEP routing conflict at Level 3",
        desc: "Clash between duct and sprinkler lines above corridor.",
        av: "MF", avColor: "#6b7280", date: "May 21", priority: "High", comments: 3, attachments: 1 },
      { disc: "Legal", discKey: "Legal", title: "Structural column interference",
        desc: "Column conflicts with tenant layout on Level 2.",
        av: "KC", avColor: "#0891b2", date: "May 23", priority: "High", comments: 4, attachments: 2 },
      { disc: "Architecture", discKey: "Arch", title: "Drawing A2.31 revision pending",
        desc: "Update reflected glazing dimensions per facade change.",
        av: "AB", avColor: "#1d4ed8", date: "May 23", priority: "Medium", comments: 2, attachments: 1 },
    ],
  },
  {
    id: "waiting", title: "Waiting on External",
    cards: [
      { disc: "Legal", discKey: "Legal", title: "Legal title & easement check",
        desc: "Confirm recorded easements and any title exceptions.",
        av: "KC", avColor: "#0891b2", date: "May 24", priority: "High", comments: 1, attachments: 2 },
      { disc: "Architecture", discKey: "Arch", title: "City of Austin zoning confirmation",
        desc: "Confirm allowed heights and setbacks for revised design.",
        av: "AR", avColor: "#4f6bed", date: "May 23", priority: "Medium", comments: 1, attachments: 1 },
      { disc: "MEP", discKey: "Mep", title: "Facade material selection",
        desc: "Provide final material specs and performance data.",
        av: "MF", avColor: "#6b7280", date: "May 28", priority: "Medium", comments: 2, attachments: 3 },
    ],
  },
  {
    id: "decision", title: "Needs Decision",
    cards: [
      { disc: "Sales", discKey: "Sales", title: "Sales: Unit mix change request",
        desc: "Request to adjust unit mix based on market feedback.",
        av: "TM", avColor: "#d97706", date: "May 22", priority: "High", comments: 2, attachments: 0 },
      { disc: "MEP", discKey: "Mep", title: "Life safety egress layout",
        desc: "Confirm preferred egress strategy for parking level.",
        av: "MF", avColor: "#6b7280", date: "May 25", priority: "High", comments: 0, attachments: 1 },
    ],
  },
  {
    id: "approved", title: "Approved / Closed",
    cards: [
      { disc: "Developer", discKey: "Dev", title: "Parking count compliance",
        desc: "Parking count meets city ordinance requirements.",
        av: "AB", avColor: "#1d4ed8", date: "May 16", priority: "Approved", comments: 1, attachments: 1 },
      { disc: "Architecture", discKey: "Arch", title: "Bike storage location",
        desc: "Bike storage location and access approved.",
        av: "AR", avColor: "#4f6bed", date: "May 14", priority: "Approved", comments: 0, attachments: 1 },
      { disc: "Legal", discKey: "Legal", title: "MEP door swings at 3rd",
        desc: "Door swing directions confirmed and approved.",
        av: "KC", avColor: "#0891b2", date: "May 13", priority: "Approved", comments: 1, attachments: 1 },
    ],
  },
];

const DEADLINES = [
  { date: "May 22", title: "Clarify setback at south...",    priority: "High" },
  { date: "May 21", title: "MEP routing conflict at L3",     priority: "High" },
  { date: "May 22", title: "Sales: Unit mix change req",     priority: "High" },
  { date: "May 23", title: "City of Austin zoning conf...",  priority: "Medium" },
  { date: "May 24", title: "Legal title & easement check",   priority: "High" },
];

const DECISIONS = [
  { title: "Facade material selection",  by: "Ana Reyes",    date: "May 15, 2024" },
  { title: "Parking compliance update",  by: "Taylor Morgan", date: "May 14, 2024" },
  { title: "Landscape buffer approach",  by: "Taylor Smith",  date: "May 13, 2024" },
];

const STAKEHOLDERS = [
  { av: "AR", avColor: "#4f6bed",  name: "Ana Reyes",    role: "Architect", count: 6 },
  { av: "MF", avColor: "#6b7280",  name: "Morgan Ellis", role: "MEP",       count: 5 },
  { av: "KC", avColor: "#0891b2",  name: "Karen Lee",    role: "Legal",     count: 3 },
  { av: "TM", avColor: "#d97706",  name: "Taylor Morgan",role: "Sales",     count: 2 },
  { av: "AB", avColor: "#1d4ed8",  name: "Alex Benson",  role: "Developer", count: 2 },
];

const DISC_TAG_CLASS = {
  Arch:      "tagArch",
  Mep:       "tagMep",
  Legal:     "tagLegal",
  Sales:     "tagSales",
  Landscape: "tagLandscape",
  Dev:       "tagDev",
};

/* ── Sub-components ───────────────────────────────── */

function Avatar({ initials, color, size = "Md" }) {
  return (
    <div className={`avatar avatar${size}`} style={{ background: color }}>
      {initials}
    </div>
  );
}

function ReviewCard({ card }) {
  const tagClass = DISC_TAG_CLASS[card.discKey] || "tagArch";
  const priorityEl =
    card.priority === "High"     ? <span className="badgeHigh">High</span> :
    card.priority === "Medium"   ? <span className="badgeMedium">Medium</span> :
                                   <span className="badgeApproved">Approved</span>;

  return (
    <div className="reviewCard">
      <div className="cardDiscipline">
        <span className={`tag ${tagClass}`}>{card.disc}</span>
      </div>
      <div className="cardTitle">{card.title}</div>
      <div className="cardDesc">{card.desc}</div>
      <div className="cardFooter">
        <Avatar initials={card.av} color={card.avColor} size="Xs" />
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
        {col.cards.map((card, i) => <ReviewCard key={i} card={card} />)}
      </div>
      <div className="kanbanAddRow">
        <RiAddLine className="iconSize14" /> Add review item
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */

export default function SitesPage() {
  const router = useRouter();

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
          <span className="breadcrumbCurrent">Willow Creek</span>
          <div className="breadcrumbActions">
            <button className="iconBtn"><RiStarLine className="iconSize15" /></button>
            <button className="outlineBtn"><RiShareLine className="iconSize13" /> Share</button>
            <button className="primaryBtn"><RiAddLine className="iconSize14" /> Add Review Item</button>
          </div>
        </div>

        {/* Project header */}
        <div className="projectHeader">
          <div className="projectMeta">
            <div className="projectThumb">
              <RiMapPin2Line style={{ fontSize: 26 }} />
            </div>
            <div className="projectInfo">
              <h1 className="projectName">Willow Creek</h1>
              <div className="projectLocation">Austin, TX</div>
              <span className="phaseBadge">Design Development</span>
            </div>

            <div className="statsRow">
              <div className="statItem">
                <div className="statLabel">Next Gate Review</div>
                <div className="statDate"><RiCalendarLine className="iconSize13" /> May 22, 2024</div>
                <div className="statSub">Gate 3 – DD</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Open Review Items</div>
                <div className="statValue">24</div>
                <div className="statSub"><span className="statUp"><RiArrowUpLine className="iconSize12" />4</span> vs last 7 days</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Waiting on External</div>
                <div className="statValue">9</div>
                <div className="statSub">38% of open items</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Needs Decision</div>
                <div className="statValue">5</div>
                <div className="statSub">21% of open items</div>
              </div>
              <div className="statItem">
                <div className="statLabel">Due This Week</div>
                <div className="statValue">3</div>
                <div className="statSub">Across 2 disciplines</div>
              </div>
            </div>

            <button className="iconBtn" style={{ alignSelf: "flex-start", marginTop: 6 }}>
              <RiMoreLine className="iconSize16" />
            </button>
          </div>

          {/* Timeline */}
          <div className="timeline">
            {TIMELINE.map((step, i) => (
              <div key={i} className={`timelineStep ${step.state}`}>
                <div className="timelineCircle">
                  {step.state === "done"    && <RiCheckLine className="iconSize12" />}
                  {step.state === "current" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", display: "block" }} />}
                </div>
                <div className="timelineLabel">{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kanban */}
        <div className="kanbanOuter">
          {COLUMNS.map(col => <KanbanColumn key={col.id} col={col} />)}
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
            {DEADLINES.map((d, i) => (
              <div key={i} className="deadlineItem">
                <span className="deadlineDate">{d.date}</span>
                <span className="deadlineTitle">{d.title}</span>
                <span className={d.priority === "High" ? "badgeHigh" : "badgeMedium"}>
                  {d.priority}
                </span>
              </div>
            ))}
            <span className="moreLink">+ 2 more</span>
          </div>

          {/* Latest Decisions */}
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Latest Decisions</span>
              <span className="rViewAll">View all</span>
            </div>
            {DECISIONS.map((d, i) => (
              <div key={i} className="decisionItem">
                <div className="decisionCheck">
                  <RiCheckLine className="iconSize12" />
                </div>
                <div>
                  <div className="decisionTitle">{d.title}</div>
                  <div className="decisionSub">Approved by {d.by}<br />{d.date}</div>
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
            {STAKEHOLDERS.map((s, i) => (
              <div key={i} className="stakeholderItem">
                <Avatar initials={s.av} color={s.avColor} size="Xs" />
                <span className="stakeholderName">{s.name}</span>
                <span className="stakeholderRole">{s.role}</span>
                <span className="stakeholderCount">{s.count}</span>
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
            Northstar Developers
            <RiArrowDownSLine className="iconSize14" />
          </button>
        </div>

        <div className="topNavRight">
          <div className="statusChip">
            <RiMailLine className="iconSize14" />
            <span>Gmail Connected</span>
            <span className="statusSub">12 unread</span>
            <span className="statusDot" />
          </div>
          <div className="statusChip">
            <span>Drive Synced</span>
            <span className="statusSub">2 min ago</span>
            <span className="statusDot" />
          </div>
          <button className="iconBtn">
            <RiBellLine className="iconSize18" />
          </button>
          <div className="avatarChip">
            <div className="userAvatar">AB</div>
            <div>
              <div className="userName">Alex Benson</div>
              <div className="userRole">Administrator</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
