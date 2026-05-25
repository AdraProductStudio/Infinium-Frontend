"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  RiBriefcaseLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiBellLine,
  RiAddLine,
  RiMapPin2Line,
  RiMoreLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiImageLine,
  RiCloseLine,
  RiSearchLine,
  RiFolder3Line,
  RiTaskLine,
  RiTeamLine,
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import toast from "react-hot-toast";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  uploadProjectLogo,
} from "../../lib/api";
import { PHASES, STAGE_OPTIONS, STAGE_COLORS, formatDate } from "./utils";
import "./sites.css";

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

/* ── Project Modal (create / edit) ── */
function ProjectModal({ mode, project, onSave, onClose }) {
  const [name,        setName]        = useState(project?.name     || "");
  const [location,    setLocation]    = useState(project?.location || "");
  const [stage,       setStage]       = useState(project?.stage    || "concept");
  const [logoFile,    setLogoFile]    = useState(null);
  const [logoPreview, setLogoPreview] = useState(project?.image_url || null);
  const [saving,      setSaving]      = useState(false);
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
          <div className="modalField">
            <label className="modalLabel">
              Logo <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </label>
            <div className="logoUploadRow">
              <div className="logoUploadPreview" onClick={() => fileInputRef.current?.click()}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="logoUploadImg" />
                  : <RiImageLine style={{ fontSize: 22, color: "#9ca3af" }} />
                }
              </div>
              <div className="logoUploadActions">
                <button type="button" className="logoUploadBtn" onClick={() => fileInputRef.current?.click()}>
                  {logoPreview ? "Change image" : "Upload image"}
                </button>
                {logoPreview && (
                  <button type="button" className="logoRemoveBtn" onClick={handleRemoveLogo}>Remove</button>
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
          <button className="modalBtnPrimary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : mode === "create" ? "Create Project" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Project Card ── */
function ProjectCard({ project, onClick, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const stageBadge = project.stage
    ? project.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";
  const sc = STAGE_COLORS[project.stage] || { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };

  return (
    <div className="projectCard" onClick={onClick}>
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
              <div
                className="projectCardMenuItem projectCardMenuItemDanger"
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
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

/* ── Page ── */
export default function SitesPage() {
  const router = useRouter();

  const [loading,       setLoading]       = useState(true);
  const [projects,      setProjects]      = useState([]);
  const [gridSearch,    setGridSearch]    = useState("");
  const [projectModal,  setProjectModal]  = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await listProjects();
      setProjects(res?.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (loading) return <LoadingShell />;

  const q              = gridSearch.trim().toLowerCase();
  const filtered       = q
    ? projects.filter((p) =>
        (p.name     || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q)
      )
    : projects;
  const totalOpenItems = projects.reduce((s, p) => s + (p.open_items || 0), 0);
  const totalMembers   = projects.reduce((s, p) => s + (p.stakeholder_count || 0), 0);
  const stageBreakdown = PHASES
    .map((label) => {
      const key   = label.toLowerCase().replace(/ /g, "_");
      const count = projects.filter((p) => p.stage === key).length;
      const sc    = STAGE_COLORS[key] || { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };
      return { label, key, count, sc };
    })
    .filter((s) => s.count > 0);
  const recentProjects = projects.slice(0, 5);

  return (
    <div className="sitesShell">
      <Sidebar />

      {/* ── Main: project grid ── */}
      <div className="main">
        <div className="breadcrumbBar">
          <span className="breadcrumbCurrent">Sites</span>
          <div className="breadcrumbActions">
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {filtered.length} project{filtered.length !== 1 ? "s" : ""}
            </span>
            <button className="primaryBtn" onClick={() => setProjectModal({ mode: "create" })}>
              <RiAddLine style={{ fontSize: "0.875rem" }} /> Add Project
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>No projects yet</div>
              <div style={{ fontSize: "0.812rem" }}>Confirm an email thread from the inbox to create one.</div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "#6b7280" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                No results for "{gridSearch}"
              </div>
              <div
                style={{ fontSize: "0.75rem", cursor: "pointer", color: "#2563eb" }}
                onClick={() => setGridSearch("")}
              >
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
                onClick={() => router.push(`/sites/${p.id}`)}
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
            <RiFolder3Line className="iconSize15" /> Portfolio Overview
          </div>
        </div>
        <div className="rightPanelBody">
          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Summary</span>
            </div>
            <div className="portfolioStats">
              <div className="portfolioStat">
                <div className="portfolioStatVal">{projects.length}</div>
                <div className="portfolioStatLabel"><RiFolder3Line style={{ fontSize: 11 }} /> Projects</div>
              </div>
              <div className="portfolioStat">
                <div className="portfolioStatVal">{totalOpenItems}</div>
                <div className="portfolioStatLabel"><RiTaskLine style={{ fontSize: 11 }} /> Open Items</div>
              </div>
              <div className="portfolioStat">
                <div className="portfolioStatVal">{totalMembers}</div>
                <div className="portfolioStatLabel"><RiTeamLine style={{ fontSize: 11 }} /> Members</div>
              </div>
            </div>
          </div>

          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">By Stage</span>
            </div>
            {stageBreakdown.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>No projects</div>
            ) : stageBreakdown.map((s) => (
              <div key={s.key} className="stageBreakRow">
                <span className="stageBreakDot" style={{ background: s.sc.dot }} />
                <span className="stageBreakLabel">{s.label}</span>
                <span className="stageBreakCount" style={{ background: s.sc.bg, color: s.sc.text }}>
                  {s.count}
                </span>
              </div>
            ))}
          </div>

          <div className="rSection">
            <div className="rSectionHeader">
              <span className="rSectionTitle">Recently Added</span>
            </div>
            {recentProjects.map((p) => {
              const sc = STAGE_COLORS[p.stage] || { dot: "#9ca3af" };
              return (
                <div key={p.id} className="recentProjItem" onClick={() => router.push(`/sites/${p.id}`)}>
                  <span className="recentProjDot" style={{ background: sc.dot }} />
                  <div className="recentProjInfo">
                    <div className="recentProjName">{p.name}</div>
                    <div className="recentProjMeta">
                      {p.location && <span>{p.location} · </span>}
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                  <RiArrowRightSLine style={{ fontSize: "0.875rem", color: "#d1d5db", flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
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
          <div className="modalBox" style={{ width: "23.75rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <span className="modalTitle">Delete Project</span>
              <button className="modalClose" onClick={() => setDeleteConfirm(null)}>
                <RiCloseLine style={{ fontSize: "1.125rem" }} />
              </button>
            </div>
            <div className="modalBody" style={{ padding: "1.25rem 1.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#374151", lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This cannot be undone.
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
            {/* {gridSearch
              ? <button className="gridSearchClear" onClick={() => setGridSearch("")}>
                  <RiCloseLine style={{ fontSize: "0.812rem" }} />
                </button>
              : <span className="searchKbd">⌘K</span>
            } */}
          </div>
        </div>
        <div className="topNavRight">
          <button className="iconBtn"><RiBellLine className="iconSize18" /></button>
        </div>
      </div>
    </div>
  );
}
