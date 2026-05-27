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
  RiUserAddLine,
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
  getAttachmentUrl,
  getProjectStakeholders,
  assignStakeholderToTask,
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

/* ── Diff helpers ── */
const TEXT_EXTS = new Set(["txt", "csv", "md", "json", "xml", "html", "css", "js", "ts"]);
const IMG_EXTS  = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function getExt(name = "") { return (name || "").split(".").pop().toLowerCase(); }

function lcsLineDiff(oldLines, newLines) {
  /* Myers LCS — returns [{type:'equal'|'removed'|'added', line}] */
  const O = oldLines.length, N = newLines.length;
  const dp = Array.from({ length: O + 1 }, () => new Uint32Array(N + 1));
  for (let i = 1; i <= O; i++)
    for (let j = 1; j <= N; j++)
      dp[i][j] = oldLines[i-1] === newLines[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const out = [];
  let i = O, j = N;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) {
      out.unshift({ type: "equal",   line: oldLines[i-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      out.unshift({ type: "added",   line: newLines[j-1] }); j--;
    } else {
      out.unshift({ type: "removed", line: oldLines[i-1] }); i--;
    }
  }
  return out;
}

function MetaDiff({ a, b }) {
  const rows = [];
  const fmt = (v) => v ? `${(v / (1024*1024)).toFixed(2)} MB` : "–";
  if (a.file_size !== b.file_size) {
    const delta = b.file_size - a.file_size;
    rows.push(["File size",
      fmt(a.file_size),
      <span style={{ color: delta > 0 ? "#dc2626" : "#16a34a" }}>
        {fmt(b.file_size)} ({delta > 0 ? "+" : ""}{(delta / 1024).toFixed(0)} KB)
      </span>
    ]);
  }
  if ((a.source || "") !== (b.source || ""))
    rows.push(["Uploaded by", GH_SOURCE[a.source]?.label || a.source, GH_SOURCE[b.source]?.label || b.source]);
  if ((a.review_status || "") !== (b.review_status || ""))
    rows.push(["Review status", GH_REVIEW[a.review_status]?.label || a.review_status, GH_REVIEW[b.review_status]?.label || b.review_status]);
  if ((a.version_note || "") !== (b.version_note || ""))
    rows.push(["Note", a.version_note || "–", b.version_note || "–"]);
  if (!rows.length)
    return <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 8 }}>No metadata changes between these versions.</p>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: "0.75rem" }}>
      <thead>
        <tr>
          {["Field", `v${a.version}`, `v${b.version}`].map((h) => (
            <th key={h} style={{ textAlign: "left", padding: "4px 8px", background: "#f3f4f6", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([field, from, to], i) => (
          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "5px 8px", color: "#374151", fontWeight: 500 }}>{field}</td>
            <td style={{ padding: "5px 8px", color: "#dc2626", textDecoration: "line-through" }}>{from}</td>
            <td style={{ padding: "5px 8px", color: "#16a34a" }}>{to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiffModal({ vA, vB, onClose }) {
  const [state, setState] = useState("loading"); // loading | image | text | meta | error
  const [urlA,  setUrlA]  = useState(null);
  const [urlB,  setUrlB]  = useState(null);
  const [diff,  setDiff]  = useState(null);   // for text diff
  const ext = getExt(vB.file_name || vA.file_name);

  useEffect(() => {
    async function load() {
      try {
        const [ua, ub] = await Promise.all([
          getAttachmentUrl(vA.id),
          getAttachmentUrl(vB.id),
        ]);
        setUrlA(ua); setUrlB(ub);

        if (IMG_EXTS.has(ext)) {
          setState("image");
        } else if (TEXT_EXTS.has(ext)) {
          const [ta, tb] = await Promise.all([
            fetch(ua).then((r) => r.text()),
            fetch(ub).then((r) => r.text()),
          ]);
          const dLines = lcsLineDiff(ta.split("\n"), tb.split("\n"));
          setDiff(dLines);
          setState("text");
        } else {
          setState("meta");
        }
      } catch { setState("error"); }
    }
    load();
  }, [vA.id, vB.id, ext]);

  /* Trap scroll behind modal */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 12,
        width: "min(860px, 95vw)", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}>
        {/* header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "14px 18px", borderBottom: "1px solid #e5e7eb",
          background: "#faf5ff",
        }}>
          <RiArrowLeftLine style={{ fontSize: 14, color: "#9ca3af" }} />
          <code style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6d28d9", background: "#ede9fe", padding: "2px 8px", borderRadius: 4 }}>v{vA.version}</code>
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>→</span>
          <code style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 4 }}>v{vB.version}</code>
          <span style={{ fontSize: "0.812rem", fontWeight: 600, color: "#111827", flex: 1, marginLeft: 6 }}>
            {vB.file_name}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
        </div>

        {/* who + when row */}
        <div style={{
          display: "flex", gap: 0,
          borderBottom: "1px solid #e5e7eb",
          fontSize: "0.719rem",
        }}>
          {[vA, vB].map((v, i) => {
            const srcCfg = GH_SOURCE[v.source] || GH_SOURCE.email;
            const rvCfg  = GH_REVIEW[v.review_status] || GH_REVIEW.pending;
            return (
              <div key={i} style={{
                flex: 1, padding: "10px 16px",
                borderRight: i === 0 ? "1px solid #e5e7eb" : "none",
                background: i === 0 ? "#fef2f2" : "#f0fdf4",
              }}>
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                  v{v.version} {v.is_latest ? <span style={{ fontSize: "0.594rem", background: "#dcfce7", color: "#15803d", padding: "1px 5px", borderRadius: 999, border: "1px solid #bbf7d0" }}>HEAD</span> : ""}
                </div>
                <div style={{ color: "#6b7280" }}>
                  <span style={{ fontWeight: 600, color: srcCfg.color }}>{v.uploaded_by_name || srcCfg.label}</span>
                  {" uploaded · "}
                  {v.created_at ? new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "–"}
                </div>
                {v.reviewed_by_name && (
                  <div style={{ color: "#6b7280", marginTop: 2 }}>
                    <span style={{ fontWeight: 600, color: rvCfg.color }}>{v.reviewed_by_name}</span>
                    {" " + (v.review_status === "approved" ? "approved" : "requested revision")}
                  </div>
                )}
                {v.version_note && <div style={{ color: "#9ca3af", fontStyle: "italic", marginTop: 2 }}>"{v.version_note}"</div>}
              </div>
            );
          })}
        </div>

        {/* diff body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
          {state === "loading" && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af", fontSize: "0.75rem" }}>Loading diff…</div>
          )}
          {state === "error" && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#ef4444", fontSize: "0.75rem" }}>Could not load file content.</div>
          )}
          {state === "image" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[{ url: urlA, v: vA }, { url: urlB, v: vB }].map(({ url, v }, i) => (
                  <div key={i}>
                    <div style={{ fontSize: "0.688rem", fontWeight: 700, color: i === 0 ? "#dc2626" : "#16a34a", marginBottom: 6 }}>
                      v{v.version} — {i === 0 ? "Before" : "After"}
                    </div>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
                      <img src={url} alt={`v${v.version}`} style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 380 }} />
                    </div>
                  </div>
                ))}
              </div>
              <MetaDiff a={vA} b={vB} />
            </div>
          )}
          {state === "text" && diff && (
            <div>
              <div style={{ fontFamily: "monospace", fontSize: "0.719rem", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                {diff.map((d, i) => (
                  <div key={i} style={{
                    padding: "1px 12px",
                    background: d.type === "added" ? "#f0fdf4" : d.type === "removed" ? "#fef2f2" : "#fff",
                    color:      d.type === "added" ? "#16a34a" : d.type === "removed" ? "#dc2626" : "#374151",
                    borderBottom: i < diff.length - 1 ? "1px solid #f3f4f6" : "none",
                    display: "flex", gap: 12,
                  }}>
                    <span style={{ color: "#d1d5db", userSelect: "none", minWidth: 14 }}>
                      {d.type === "added" ? "+" : d.type === "removed" ? "−" : " "}
                    </span>
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{d.line || " "}</span>
                  </div>
                ))}
              </div>
              <MetaDiff a={vA} b={vB} />
            </div>
          )}
          {state === "meta" && <MetaDiff a={vA} b={vB} />}
        </div>
      </div>
    </div>
  );
}

/* ── Option 2: Per-file accordion with GitHub releases-style version spine ── */
const GH_SPINE = "#d8b4fe";
const GH_REVIEW = {
  pending:            { label: "Pending Review",    color: "#d97706", dot: "#f59e0b", bg: "#fffbeb" },
  approved:           { label: "Approved",          color: "#16a34a", dot: "#22c55e", bg: "#f0fdf4" },
  revision_requested: { label: "Needs Revision",    color: "#dc2626", dot: "#ef4444", bg: "#fef2f2" },
};
const GH_SOURCE = {
  email:       { label: "Email",       color: "#6b7280", bg: "#f3f4f6" },
  builder:     { label: "Builder",     color: "#2563eb", bg: "#eff6ff" },
  stakeholder: { label: "Stakeholder", color: "#7c3aed", bg: "#f5f3ff" },
};

function AttachmentGroup({ group, onUploadVersion, onReview, onDownload }) {
  const [open,        setOpen]        = useState(false);
  const [history,     setHistory]     = useState(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const [reviewing,   setReviewing]   = useState(false);
  const [diff,        setDiff]        = useState(null); // {a, b} version objects for DiffModal
  const fileRef = useRef(null);

  const att      = group;
  const rvStatus = att.review_status || "pending";
  const rvCfg    = GH_REVIEW[rvStatus]  || GH_REVIEW.pending;
  const Icon     = fileIcon(att.file_name || "");
  const vCount   = att.version_count || 1;

  async function handleToggle() {
    if (open) { setOpen(false); return; }
    if (!history) {
      setLoadingHist(true);
      try {
        const res = await getAttachmentGroupHistory(att.group_id);
        const sorted = (res?.data || []).slice().sort((a, b) => b.version - a.version);
        setHistory(sorted);
      } catch { toast.error("Failed to load history"); }
      finally { setLoadingHist(false); }
    }
    setOpen(true);
  }

  async function handleReviewClick(status) {
    setReviewing(true);
    try { await onReview(att.attachment_id, att.group_id, status); }
    finally { setReviewing(false); }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    onUploadVersion(att.group_id, f);
    e.target.value = "";
  }

  return (
    <>
      {diff && <DiffModal vA={diff.a} vB={diff.b} onClose={() => setDiff(null)} />}

      <div style={{
        border: `1px solid ${open ? "#ddd6fe" : "#e5e7eb"}`,
        borderRadius: "0.5rem",
        overflow: "hidden",
        marginBottom: "0.75rem",
        transition: "border-color 0.15s",
      }}>

        {/* ════ File header ════ */}
        <div
          onClick={handleToggle}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.625rem 0.75rem",
            background: open ? "#faf5ff" : "#fafafa",
            borderBottom: open ? "1px solid #ddd6fe" : "none",
            cursor: "pointer", userSelect: "none",
          }}
        >
          <Icon style={{ fontSize: 15, color: open ? "#7c3aed" : "#6b7280", flexShrink: 0 }} />
          <span style={{
            fontSize: "0.812rem", fontWeight: 600, color: "#111827",
            flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {att.name || att.file_name}
          </span>
          <span style={{ fontSize: "0.625rem", fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9", flexShrink: 0 }}>
            {vCount} {vCount === 1 ? "version" : "versions"}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: "0.688rem", fontWeight: 500, padding: "2px 8px", borderRadius: 999,
            background: rvCfg.bg, color: rvCfg.color, flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: rvCfg.dot }} />
            {rvCfg.label}
          </span>
          <input type="file" ref={fileRef} style={{ display: "none" }} onChange={handleFileChange} />
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: "0.688rem", fontWeight: 500, padding: "2px 8px", borderRadius: 999,
              border: "1px solid #d1d5db", background: "#fff", color: "#374151",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <RiUpload2Line style={{ fontSize: 11 }} /> New version
          </button>
          {loadingHist
            ? <span style={{ fontSize: "0.625rem", color: "#9ca3af" }}>…</span>
            : open
              ? <RiArrowUpSLine  style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }} />
              : <RiArrowDownSLine style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }} />
          }
        </div>

        {/* ════ Version spine ════ */}
        {open && history && (
          <div style={{ padding: "12px 14px 10px" }}>
            {history.map((v, idx) => {
              const isLatest = v.is_latest;
              const isLast   = idx === history.length - 1;
              const vRv      = GH_REVIEW[v.review_status] || GH_REVIEW.pending;
              const vSrc     = GH_SOURCE[v.source]         || GH_SOURCE.email;
              const VIcon    = fileIcon(v.file_name || "");
              /* Compare button: shown between this version and the next (older) one */
              const nextV    = history[idx + 1];

              return (
                <div key={v.id}>
                  <div style={{ display: "flex" }}>

                    {/* Spine */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 }}>
                      <div style={{ position: "relative", marginTop: 10, flexShrink: 0 }}>
                        {isLatest && (
                          <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${vRv.dot}`, opacity: 0.25 }} />
                        )}
                        <div style={{
                          width: isLatest ? 12 : 9, height: isLatest ? 12 : 9,
                          borderRadius: "50%",
                          background: isLatest ? vRv.dot : "#fff",
                          border: `2px solid ${isLatest ? vRv.dot : GH_SPINE}`,
                          position: "relative", zIndex: 1,
                        }} />
                      </div>
                      {!isLast && (
                        <div style={{ width: 2, flex: 1, minHeight: 16, background: GH_SPINE, borderRadius: 1, marginTop: 3 }} />
                      )}
                    </div>

                    {/* Version card */}
                    <div style={{
                      flex: 1, marginLeft: 8, marginTop: 4,
                      marginBottom: nextV ? 4 : (isLast ? 0 : 12),
                      background: isLatest ? "#faf5ff" : "#fafafa",
                      border: `1px solid ${isLatest ? "#ddd6fe" : "#f0f0f0"}`,
                      borderRadius: 7, padding: "9px 12px",
                    }}>

                      {/* row 1: file + size + HEAD + v{n} */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <VIcon style={{ fontSize: 12, color: "#6b7280", flexShrink: 0 }} />
                        <span style={{
                          fontSize: "0.75rem", fontWeight: isLatest ? 700 : 500,
                          color: "#111827", flex: 1, minWidth: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {v.file_name}
                          {v.file_size
                            ? <span style={{ marginLeft: 5, fontWeight: 400, color: "#9ca3af", fontSize: "0.688rem" }}>({formatBytes(v.file_size)})</span>
                            : null}
                        </span>
                        {isLatest && (
                          <span style={{ fontSize: "0.563rem", fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", flexShrink: 0 }}>
                            HEAD
                          </span>
                        )}
                        <code style={{
                          fontSize: "0.594rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: isLatest ? "#ede9fe" : "#f3f4f6",
                          color: isLatest ? "#6d28d9" : "#9ca3af",
                          fontFamily: "monospace", flexShrink: 0,
                        }}>
                          v{v.version}
                        </code>
                      </div>

                      {/* row 2: who attached */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.625rem", fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: vSrc.bg, color: vSrc.color }}>
                          {vSrc.label}
                        </span>
                        <span style={{ fontSize: "0.688rem", fontWeight: 600, color: "#374151" }}>
                          {v.uploaded_by_name || vSrc.label}
                        </span>
                        <span style={{ fontSize: "0.625rem", color: "#9ca3af" }}>attached · {timeAgo(v.created_at)}</span>
                      </div>

                      {/* row 3: who reviewed */}
                      {v.reviewed_by_name && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: vRv.dot, display: "inline-block" }} />
                          <span style={{ fontSize: "0.688rem", fontWeight: 600, color: "#374151" }}>
                            {v.reviewed_by_name}
                          </span>
                          <span style={{ fontSize: "0.625rem", color: vRv.color, fontWeight: 500 }}>
                            {v.review_status === "approved" ? "approved" : "requested revision"}
                          </span>
                          {v.reviewed_at && (
                            <span style={{ fontSize: "0.625rem", color: "#9ca3af" }}>· {timeAgo(v.reviewed_at)}</span>
                          )}
                        </div>
                      )}

                      {/* version note */}
                      {v.version_note && (
                        <div style={{ fontSize: "0.688rem", color: "#6b7280", fontStyle: "italic", marginBottom: 4 }}>
                          "{v.version_note}"
                        </div>
                      )}

                      {/* row 4: status + download */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {!v.reviewed_by_name && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            fontSize: "0.625rem", color: vRv.color, fontWeight: 500,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: vRv.dot, display: "inline-block" }} />
                            {vRv.label}
                          </span>
                        )}
                        <button
                          onClick={() => onDownload(v.id)}
                          title="Download"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#a78bfa", padding: 0, lineHeight: 1, marginLeft: "auto" }}
                        >
                          <RiDownload2Line style={{ fontSize: 13 }} />
                        </button>
                      </div>

                      {/* review actions — latest + pending only */}
                      {isLatest && rvStatus === "pending" && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid #ede9fe" }}>
                          <button
                            disabled={reviewing}
                            onClick={() => handleReviewClick("approved")}
                            style={{
                              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                              fontSize: "0.75rem", fontWeight: 600, padding: "5px 0", borderRadius: 6,
                              border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", cursor: "pointer",
                            }}
                          >
                            <RiCheckLine style={{ fontSize: 13 }} /> Approve
                          </button>
                          <button
                            disabled={reviewing}
                            onClick={() => handleReviewClick("revision_requested")}
                            style={{
                              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                              fontSize: "0.75rem", fontWeight: 600, padding: "5px 0", borderRadius: 6,
                              border: "1px solid #dc2626", background: "#fef2f2", color: "#dc2626", cursor: "pointer",
                            }}
                          >
                            <RiRefreshLine style={{ fontSize: 13 }} /> Request Revision
                          </button>
                        </div>
                      )}
                      {isLatest && rvStatus === "approved" && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #d1fae5", display: "flex", alignItems: "center", gap: 5, fontSize: "0.688rem", color: "#16a34a", fontWeight: 500 }}>
                          <RiCheckLine style={{ fontSize: 13 }} /> Approved — no further action needed
                        </div>
                      )}
                      {isLatest && rvStatus === "revision_requested" && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 5, fontSize: "0.688rem", color: "#dc2626", fontWeight: 500 }}>
                          <RiRefreshLine style={{ fontSize: 13 }} /> Revision requested — waiting for new upload
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Compare button between this and the next (older) version ── */}
                  {nextV && (
                    <div style={{ display: "flex", alignItems: "center", marginLeft: 34, marginBottom: 4 }}>
                      <button
                        onClick={() => setDiff({ a: nextV, b: v })}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: "0.625rem", fontWeight: 600,
                          padding: "2px 10px", borderRadius: 999,
                          border: "1px solid #ddd6fe", background: "#faf5ff", color: "#7c3aed",
                          cursor: "pointer",
                        }}
                      >
                        <RiArrowLeftLine style={{ fontSize: 10 }} />
                        Compare v{nextV.version} → v{v.version}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
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
  const [uploadingAtt,       setUploadingAtt]       = useState(false);
  const [projectStakeholders, setProjectStakeholders] = useState([]);
  const [showAssignDropdown,  setShowAssignDropdown]  = useState(false);
  const attachFileRef  = useRef(null);
  const assignRef      = useRef(null);

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
        const [projRes, kanbanRes, attRes, histRes, commRes, shRes] = await Promise.all([
          getProject(projectId),
          getProjectKanban(projectId),
          getTaskAttachments(projectId, taskId).catch(() => ({ data: [] })),
          getTaskHistory(projectId, taskId).catch(() => ({ data: [] })),
          getTaskComments(projectId, taskId).catch(() => ({ data: [] })),
          getProjectStakeholders(projectId).catch(() => ({ data: [] })),
        ]);

        setProject(projRes?.data || null);
        setAttachments(attRes?.data || []);
        setHistory(histRes?.data || []);
        setComments(commRes?.data || []);
        setProjectStakeholders(shRes?.data || []);

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

  useEffect(() => {
    if (!showAssignDropdown) return;
    function handler(e) {
      if (assignRef.current && !assignRef.current.contains(e.target)) setShowAssignDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignDropdown]);

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

  async function handleAssignStakeholder(stakeholderId) {
    const sh = stakeholderId ? projectStakeholders.find((s) => s.id === stakeholderId) : null;
    setTask((prev) => ({
      ...prev,
      stakeholder_id:   stakeholderId || null,
      stakeholder_name: sh?.name || null,
      av:               sh ? getInitials(sh.name) : "",
      avColor:          sh ? avatarColor(sh.id)   : "",
    }));
    setShowAssignDropdown(false);
    try {
      await assignStakeholderToTask(taskId, stakeholderId);
    } catch (err) {
      toast.error(err.message || "Failed to assign stakeholder");
    }
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
                <div ref={assignRef} style={{ position: "relative" }}>
                  <div
                    className="tdMetaValue"
                    onClick={() => setShowAssignDropdown((s) => !s)}
                    style={{ cursor: "pointer", userSelect: "none",
                      padding: "4px 8px", borderRadius: 6,
                      border: "1px solid transparent",
                      transition: "border-color 0.1s, background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#e9d5ff";
                      e.currentTarget.style.background  = "#faf5ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.background  = "transparent";
                    }}
                  >
                    {task.av
                      ? <Avatar initials={task.av} color={task.avColor} size="Sm" />
                      : (
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#f3f4f6", border: "1.5px dashed #d1d5db",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <RiUserAddLine style={{ fontSize: 11, color: "#9ca3af" }} />
                        </div>
                      )
                    }
                    <span style={{ color: task.stakeholder_name ? "#111827" : "#9ca3af" }}>
                      {task.stakeholder_name || "Unassigned"}
                    </span>
                  </div>
                  {showAssignDropdown && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
                        background: "#fff", borderRadius: 8,
                        boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
                        border: "1px solid #e5e7eb", minWidth: 210, padding: "4px 0",
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {task.stakeholder_id && (
                        <div
                          onClick={() => handleAssignStakeholder(null)}
                          style={{ padding: "7px 12px", fontSize: "0.75rem", color: "#ef4444",
                            cursor: "pointer", fontWeight: 500, borderBottom: "1px solid #f3f4f6" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#fff5f5"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          Remove assignee
                        </div>
                      )}
                      {projectStakeholders.length === 0 && !task.stakeholder_id && (
                        <div style={{ padding: "10px 12px", fontSize: "0.75rem", color: "#9ca3af" }}>
                          No team members on this project
                        </div>
                      )}
                      {projectStakeholders.map((sh) => (
                        <div
                          key={sh.id}
                          onClick={() => handleAssignStakeholder(sh.id)}
                          style={{
                            padding: "8px 12px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 9,
                            background: sh.id === task.stakeholder_id ? "#f5f3ff" : "transparent",
                          }}
                          onMouseEnter={(e) => { if (sh.id !== task.stakeholder_id) e.currentTarget.style.background = "#f9fafb"; }}
                          onMouseLeave={(e) => { if (sh.id !== task.stakeholder_id) e.currentTarget.style.background = sh.id === task.stakeholder_id ? "#f5f3ff" : "transparent"; }}
                        >
                          <Avatar initials={getInitials(sh.name)} color={avatarColor(sh.id)} size="Sm" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.812rem", fontWeight: 600, color: "#111827",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sh.name}
                            </div>
                            {sh.discipline && <div style={{ fontSize: "0.688rem", color: "#9ca3af" }}>{sh.discipline}</div>}
                          </div>
                          {sh.id === task.stakeholder_id && (
                            <RiCheckLine style={{ fontSize: 13, color: "#7c3aed", flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
