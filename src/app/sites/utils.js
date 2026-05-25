import {
  RiBuildingLine,
  RiFlashlightLine,
  RiHammerLine,
  RiShieldLine,
  RiAlertLine,
} from "react-icons/ri";

export const PHASES = [
  "Concept",
  "Test Fit",
  "Due Diligence",
  "Schematic Design",
  "Design Development",
  "Gate Review",
  "Handoff",
  "Exec. Response",
];

// export const TASK_KANBAN_COLS = [
//   { id: "open",        title: "To Do" },
//   { id: "in_progress", title: "In Progress" },
//   { id: "blocked",     title: "Blocked" },
//   { id: "done",        title: "Done" },
// ];

export const TASK_KANBAN_COLS = [
  { id: "new",        title: "New" },
  { id: "in_review", title: "In Review" },
  { id: "waiting_on_external",     title: "Waiting on External" },
  { id: "needs_decision",        title: "Needs Decision" },
  { id: "closed",        title: "Approved/Closed" },
];

export const DISC_LABEL = {
  architect:  "Architecture",
  engineer:   "MEP",
  contractor: "Contractor",
  consultant: "Legal",
  other:      "Other",
};

export const DISC_KEY = {
  architect:  "Arch",
  engineer:   "Mep",
  contractor: "Dev",
  consultant: "Legal",
  other:      "Dev",
};

export const DISC_TAG_CLASS = {
  Arch:      "tagArch",
  Mep:       "tagMep",
  Legal:     "tagLegal",
  Sales:     "tagSales",
  Landscape: "tagLandscape",
  Dev:       "tagDev",
};

export const DISC_ICON = {
  architect:  RiBuildingLine,
  engineer:   RiFlashlightLine,
  contractor: RiHammerLine,
  consultant: RiShieldLine,
  other:      RiAlertLine,
};

export const AVATAR_COLORS = [
  "#4f6bed", "#059669", "#6b7280", "#0891b2",
  "#d97706", "#dc2626", "#7c3aed", "#ea580c",
];

export const RI_ACCENT_COLORS = [
  { border: "#2563eb", bg: "#eff6ff" },
  { border: "#16a34a", bg: "#f0fdf4" },
  { border: "#9333ea", bg: "#faf5ff" },
  { border: "#ea580c", bg: "#fff7ed" },
  { border: "#0891b2", bg: "#ecfeff" },
  { border: "#db2777", bg: "#fdf2f8" },
  { border: "#65a30d", bg: "#f7fee7" },
  { border: "#d97706", bg: "#fffbeb" },
];

export const RI_KANBAN_COLS = [
  { id: "new",              title: "New" },
  { id: "open",             title: "Open" },
  { id: "in_review",        title: "In Review" },
  { id: "pending_approval", title: "Pending Approval" },
  { id: "approved_closed",  title: "Closed" },
];

export const RI_PRIORITY_COLORS = {
  high:   { border: "#ef4444", bg: "#fef2f2" },
  medium: { border: "#f59e0b", bg: "#fffbeb" },
  low:    { border: "#22c55e", bg: "#f0fdf4" },
};

export const STAGE_OPTIONS = [
  { label: "Concept",            value: "concept" },
  { label: "Test Fit",           value: "test_fit" },
  { label: "Due Diligence",      value: "due_diligence" },
  { label: "Schematic Design",   value: "schematic_design" },
  { label: "Design Development", value: "design_development" },
  { label: "Gate Review",        value: "gate_review" },
  { label: "Handoff",            value: "handoff" },
  { label: "Exec. Response",     value: "exec_response" },
];

export const STAGE_COLORS = {
  concept:            { bg: "#eff6ff", text: "#2563eb", dot: "#3b82f6" },
  test_fit:           { bg: "#f5f3ff", text: "#7c3aed", dot: "#8b5cf6" },
  due_diligence:      { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  schematic_design:   { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  design_development: { bg: "#ecfdf5", text: "#065f46", dot: "#10b981" },
  gate_review:        { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  handoff:            { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  exec_response:      { bg: "#fefce8", text: "#a16207", dot: "#eab308" },
};

export function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}

export function avatarColor(id) {
  return AVATAR_COLORS[(Math.abs(id || 0)) % AVATAR_COLORS.length];
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatLongDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getTimelineSteps(stage) {
  const normalized = (stage || "").toLowerCase().replace(/_/g, " ");
  const idx = PHASES.findIndex((p) => p.toLowerCase() === normalized);
  return PHASES.map((label, i) => ({
    label,
    state: i < idx ? "done" : i === idx ? "current" : "future",
  }));
}

export function Avatar({ initials, color, size = "Md" }) {
  return (
    <div className={`avatar avatar${size}`} style={{ background: color }}>
      {initials}
    </div>
  );
}
