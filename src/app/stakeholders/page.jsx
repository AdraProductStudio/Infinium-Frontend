"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  RiUserAddLine,
  RiMailSendLine,
  RiCheckLine,
  RiTimeLine,
  RiUserLine,
  RiSearchLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiRefreshLine,
  RiGoogleLine,
  RiWifiOffLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import toast from "react-hot-toast";
import {
  listStakeholders,
  createStakeholder,
  removeStakeholder,
  sendStakeholderInvite,
  getMailConnectionStatus,
  getGmailConnectUrl,
} from "../../lib/api";
import { getInitials, avatarColor, Avatar, DISC_LABEL } from "../sites/utils";
import "../sites/sites.css";

const DISCIPLINE_OPTIONS = [
  { value: "architect",  label: "Architecture" },
  { value: "engineer",   label: "MEP / Engineering" },
  { value: "contractor", label: "Contractor" },
  { value: "consultant", label: "Legal / Consultant" },
  { value: "other",      label: "Other" },
];

function InviteStatusBadge({ accountActive, invitePending }) {
  if (accountActive) {
    return (
      <span className="shBadgeActive">
        <RiCheckLine style={{ fontSize: 10 }} /> Active
      </span>
    );
  }
  if (invitePending) {
    return (
      <span className="shBadgeInvited">
        <RiTimeLine style={{ fontSize: 10 }} /> Invited
      </span>
    );
  }
  return (
    <span className="shBadgePending">
      <RiUserLine style={{ fontSize: 10 }} /> No invite
    </span>
  );
}

function GmailConnectModal({ onClose }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="gmailModal" onClick={(e) => e.stopPropagation()}>
        <div className="gmailModalIcon">
          <RiWifiOffLine />
        </div>
        <h3 className="gmailModalTitle">Connect Gmail to send invites</h3>
        <p className="gmailModalDesc">
          Invite emails are sent directly from your Gmail account so stakeholders
          recognise who's inviting them. Connect your Gmail once and all future
          invites will work automatically.
        </p>
        <div className="gmailModalFeatures">
          <div className="gmailModalFeature">
            <RiShieldCheckLine />
            Only used to send — never reads your inbox
          </div>
          <div className="gmailModalFeature">
            <RiGoogleLine />
            Works with personal Gmail and Google Workspace
          </div>
        </div>
        <div className="gmailModalActions">
          <button className="gmailModalCancel" onClick={onClose}>Later</button>
          <button
            className="gmailModalConnect"
            onClick={() => { window.location.href = getGmailConnectUrl("/stakeholders"); }}
          >
            <RiGoogleLine /> Connect Gmail
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onSave, onClose, gmailConnected }) {
  const [form,       setForm]       = useState({ name: "", email: "", phone: "", discipline: "architect" });
  const [sendInvite, setSendInvite] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const initials  = getInitials(form.name || "?");
  const previewBg = avatarColor(form.email.length || 1);
  const discLabel = DISCIPLINE_OPTIONS.find((o) => o.value === form.discipline)?.label || "—";

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(
        { ...form, name: form.name.trim(), email: form.email.trim() },
        sendInvite
      );
    } catch (err) {
      setError(err.message || "Failed to add stakeholder.");
      setSaving(false);
    }
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="shAddModal" onClick={(e) => e.stopPropagation()}>

        <div className="shAddModalHeader">
          <div>
            <div className="shAddModalTitle">Add stakeholder</div>
            <div className="shAddModalSub">Fill in the details to add a new collaborator</div>
          </div>
          <button className="modalClose" onClick={onClose} style={{ fontSize: "1.1rem" }}>
            <RiCloseLine />
          </button>
        </div>

        <div className="shAddModalPreview">
          <div className="shAddModalAvatar" style={{ background: previewBg }}>
            {initials}
          </div>
          <div className="shAddModalPreviewInfo">
            <div className="shAddModalPreviewName">
              {form.name.trim() || <span style={{ color: "#9ca3af" }}>Full name</span>}
            </div>
            <div className="shAddModalPreviewMeta">
              {form.email.trim() || <span style={{ color: "#d1d5db" }}>email@example.com</span>}
            </div>
            <div className="shAddModalPreviewMeta" style={{ marginTop: "0.125rem" }}>
              {discLabel}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {error && (
            <div className="shAddModalError">{error}</div>
          )}

          <div className="shAddModalBody">
            <div className="formRow">
              <div className="formGroup" style={{ flex: 1 }}>
                <label className="formLabel">Full name <span className="shRequired">*</span></label>
                <input
                  className="formInput"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Jane Smith"
                  autoFocus
                  required
                />
              </div>
              <div className="formGroup" style={{ flex: 1 }}>
                <label className="formLabel">Discipline</label>
                <select className="formSelect" value={form.discipline} onChange={set("discipline")}>
                  {DISCIPLINE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="formGroup">
              <label className="formLabel">Email address <span className="shRequired">*</span></label>
              <input
                className="formInput"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jane@firm.com"
                required
              />
            </div>

            <div className="formGroup">
              <label className="formLabel">
                Phone <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="formInput"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 555 000 0000"
              />
            </div>

            <label className={sendInvite && gmailConnected === false ? "shInviteCheckRowWarn" : "shInviteCheckRow"}>
              <input
                type="checkbox"
                className="shInviteCheck"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={sendInvite && gmailConnected === false ? "shInviteCheckLabelWarn" : "shInviteCheckLabel"}>
                  Send invite email now
                </div>
                {sendInvite && gmailConnected === false ? (
                  <div className="shInviteNoGmail">
                    Gmail not connected — invites won't send.{" "}
                    <button
                      type="button"
                      className="shInviteConnectLink"
                      onClick={(e) => { e.preventDefault(); window.location.href = getGmailConnectUrl("/stakeholders"); }}
                    >
                      Connect Gmail →
                    </button>
                  </div>
                ) : (
                  <div className="shInviteCheckDesc">
                    They'll receive a link to set their password and activate their account.
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="shAddModalFooter">
            <button type="button" className="modalBtnCancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modalBtnPrimary" disabled={saving}>
              {saving ? "Adding…" : "Add stakeholder →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NO_GMAIL_MSG = "No Gmail account connected";

export default function StakeholdersPage() {
  const searchParams = useSearchParams();
  const [stakeholders,     setStakeholders]     = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [search,           setSearch]           = useState("");
  const [showAdd,          setShowAdd]          = useState(false);
  const [showGmailConnect, setShowGmailConnect] = useState(false);
  const [inviting,         setInviting]         = useState({});
  const [removing,         setRemoving]         = useState({});
  const [gmailConnected,   setGmailConnected]   = useState(null); // null=loading, false=no, string=email

  async function load() {
    setLoading(true);
    try {
      const res = await listStakeholders();
      setStakeholders(res?.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load stakeholders");
    } finally {
      setLoading(false);
    }
  }

  async function loadGmailStatus() {
    try {
      const res = await getMailConnectionStatus();
      const conns = res?.data || [];
      const gmail = conns.find((c) => c.provider === "gmail" && c.is_connected);
      setGmailConnected(gmail ? gmail.email_address : false);
    } catch {
      setGmailConnected(false);
    }
  }

  useEffect(() => {
    load();
    loadGmailStatus();
    if (searchParams.get("connected") === "gmail") {
      toast.success("Gmail connected — you can now send invites!");
    }
  }, []);

  function isNoGmailError(err) {
    return err?.message?.includes(NO_GMAIL_MSG);
  }

  async function handleAdd(data, sendInvite) {
    const res = await createStakeholder(data);
    const created = res?.data || res;
    setStakeholders((prev) => [...prev, created]);
    setShowAdd(false);
    toast.success(`${created.name} added`);
    if (sendInvite && created.id) {
      try {
        await sendStakeholderInvite(created.id);
        toast.success(`Invite sent to ${created.email}`);
        setStakeholders((prev) =>
          prev.map((s) => s.id === created.id ? { ...s, invite_pending: true } : s)
        );
      } catch (err) {
        if (isNoGmailError(err)) {
          setShowGmailConnect(true);
        } else {
          toast.error("Stakeholder added, but invite failed — you can resend from the list.");
        }
      }
    }
  }

  async function handleInvite(sh) {
    setInviting((p) => ({ ...p, [sh.id]: true }));
    try {
      await sendStakeholderInvite(sh.id);
      toast.success(`Invite sent to ${sh.email}`);
      setStakeholders((prev) =>
        prev.map((s) => s.id === sh.id ? { ...s, invite_pending: true } : s)
      );
    } catch (err) {
      if (isNoGmailError(err)) {
        setShowGmailConnect(true);
      } else {
        toast.error(err.message || "Failed to send invite");
      }
    } finally {
      setInviting((p) => ({ ...p, [sh.id]: false }));
    }
  }

  async function handleRemove(sh) {
    if (!window.confirm(`Remove ${sh.name} from your account?`)) return;
    setRemoving((p) => ({ ...p, [sh.id]: true }));
    try {
      await removeStakeholder(sh.id);
      setStakeholders((prev) => prev.filter((s) => s.id !== sh.id));
      toast.success(`${sh.name} removed`);
    } catch (err) {
      toast.error(err.message || "Failed to remove stakeholder");
    } finally {
      setRemoving((p) => ({ ...p, [sh.id]: false }));
    }
  }

  const filtered = stakeholders.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      (DISC_LABEL[s.discipline] || s.discipline || "").toLowerCase().includes(q)
    );
  });

  const activeCount  = stakeholders.filter((s) => s.account_active).length;
  const invitedCount = stakeholders.filter((s) => s.invite_pending && !s.account_active).length;
  const pendingCount = stakeholders.filter((s) => !s.invite_pending && !s.account_active).length;

  return (
    <div className="sitesShell">
      <Sidebar />

      <div className="main">
        <div className="breadcrumbBar">
          <span className="breadcrumbCurrent">Stakeholders</span>
          <div className="breadcrumbActions">
            <button className="primaryBtn" onClick={() => setShowAdd(true)}>
              <RiUserAddLine style={{ fontSize: 13 }} /> Add stakeholder
            </button>
          </div>
        </div>

        <div className="shStatRow">
          <div className="shStat">
            <div className="shStatValue">{stakeholders.length}</div>
            <div className="shStatLabel">Total</div>
          </div>
          <div className="shStat">
            <div className="shStatValue" style={{ color: "#15803d" }}>{activeCount}</div>
            <div className="shStatLabel">Active</div>
          </div>
          <div className="shStat">
            <div className="shStatValue" style={{ color: "#d97706" }}>{invitedCount}</div>
            <div className="shStatLabel">Invited</div>
          </div>
          <div className="shStat">
            <div className="shStatValue" style={{ color: "#9ca3af" }}>{pendingCount}</div>
            <div className="shStatLabel">No invite</div>
          </div>
        </div>

        <div className="shSearchBar">
          <RiSearchLine style={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }} />
          <input
            className="shSearchInput"
            placeholder="Search by name, email or discipline…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="shSearchClear" onClick={() => setSearch("")}>
              <RiCloseLine style={{ fontSize: 14 }} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="shEmpty">
            <RiUserLine style={{ fontSize: 28, color: "#d1d5db", marginBottom: "0.75rem" }} />
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>
              {search ? "No results" : "No stakeholders yet"}
            </div>
            <div style={{ fontSize: "0.812rem", color: "#9ca3af" }}>
              {search ? "Try a different search term." : "Add your first stakeholder to get started."}
            </div>
          </div>
        ) : (
          <div className="shTable">
            <div className="shTableHeader">
              <div className="shColName">Name</div>
              <div className="shColDiscipline">Discipline</div>
              <div className="shColStatus">Status</div>
              <div className="shColActions" />
            </div>
            {filtered.map((sh) => {
              const initials = getInitials(sh.name);
              const color    = avatarColor(sh.id);
              return (
                <div key={sh.id} className="shRow">
                  <div className="shColName">
                    <Avatar initials={initials} color={color} size="Sm" />
                    <div className="shNameBlock">
                      <span className="shName">{sh.name}</span>
                      <span className="shEmail">{sh.email}</span>
                    </div>
                  </div>
                  <div className="shColDiscipline">
                    <span className="shDiscipline">{DISC_LABEL[sh.discipline] || sh.discipline || "—"}</span>
                  </div>
                  <div className="shColStatus">
                    <InviteStatusBadge
                      accountActive={sh.account_active}
                      invitePending={sh.invite_pending}
                    />
                  </div>
                  <div className="shColActions">
                    {!sh.account_active && (
                      <button
                        className="shInviteBtn"
                        onClick={() => handleInvite(sh)}
                        disabled={inviting[sh.id]}
                        title={sh.invite_pending ? "Resend invite" : "Send invite"}
                      >
                        {inviting[sh.id] ? (
                          <RiRefreshLine style={{ fontSize: 13, animation: "spin 1s linear infinite" }} />
                        ) : sh.invite_pending ? (
                          <><RiMailSendLine style={{ fontSize: 13 }} /> Resend</>
                        ) : (
                          <><RiMailSendLine style={{ fontSize: 13 }} /> Send invite</>
                        )}
                      </button>
                    )}
                    <button
                      className="shRemoveBtn"
                      onClick={() => handleRemove(sh)}
                      disabled={removing[sh.id]}
                      title="Remove stakeholder"
                    >
                      <RiDeleteBinLine style={{ fontSize: 13 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiUserAddLine className="iconSize15" />
            Invite guide
          </div>
        </div>
        <div className="rightPanelBody">

          {/* Gmail connection status card */}
          {gmailConnected === false && (
            <div className="shGmailCard">
              <div className="shGmailCardIcon">
                <RiWifiOffLine />
              </div>
              <div className="shGmailCardBody">
                <div className="shGmailCardTitle">Gmail not connected</div>
                <div className="shGmailCardDesc">Connect your Gmail to send invite emails to stakeholders.</div>
                <button
                  className="shGmailConnectBtn"
                  onClick={() => { window.location.href = getGmailConnectUrl("/stakeholders"); }}
                >
                  <RiGoogleLine /> Connect Gmail
                </button>
              </div>
            </div>
          )}

          {gmailConnected && (
            <div className="shGmailCardConnected">
              <RiCheckLine style={{ color: "#16a34a", fontSize: "0.875rem", flexShrink: 0 }} />
              <div>
                <div className="shGmailCardTitle" style={{ color: "#15803d" }}>Gmail connected</div>
                <div className="shGmailCardDesc" style={{ wordBreak: "break-all" }}>{gmailConnected}</div>
              </div>
            </div>
          )}

          <div className="rSection">
            <div className="shGuideStep">
              <div className="shGuideNum">1</div>
              <div>
                <div className="shGuideTitle">Add stakeholder</div>
                <div className="shGuideDesc">Enter their name, email, and discipline.</div>
              </div>
            </div>
            <div className="shGuideStep">
              <div className="shGuideNum">2</div>
              <div>
                <div className="shGuideTitle">Send invite</div>
                <div className="shGuideDesc">Click "Send invite" — they'll receive an email with a link to set their password.</div>
              </div>
            </div>
            <div className="shGuideStep">
              <div className="shGuideNum">3</div>
              <div>
                <div className="shGuideTitle">They activate</div>
                <div className="shGuideDesc">Once they click the link and set a password, their status becomes Active.</div>
              </div>
            </div>
            <div className="shGuideStep" style={{ borderBottom: "none" }}>
              <div className="shGuideNum">4</div>
              <div>
                <div className="shGuideTitle">Collaborate</div>
                <div className="shGuideDesc">Assign them to tasks and they can join discussions directly.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="topNav">
        <div className="topNavLeft" />
        <div className="topNavRight" />
      </div>

      {showAdd && <AddModal onSave={handleAdd} onClose={() => setShowAdd(false)} gmailConnected={gmailConnected} />}
      {showGmailConnect && <GmailConnectModal onClose={() => setShowGmailConnect(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .primaryBtn {
          display: flex; align-items: center; gap: 0.375rem;
          background: #111827; color: #fff; border: none;
          border-radius: 0.438rem; padding: 0.438rem 0.875rem;
          font-size: 0.812rem; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: background 0.15s;
        }
        .primaryBtn:hover { background: #1f2937; }

        .shStatRow {
          display: flex; gap: 1.5rem;
          padding: 1rem 1.5rem;
          background: #fff; border-bottom: 0.062rem solid #e5e7eb;
        }
        .shStat { display: flex; flex-direction: column; gap: 0.125rem; }
        .shStatValue { font-size: 1.5rem; font-weight: 700; color: #111827; line-height: 1; }
        .shStatLabel { font-size: 0.719rem; color: #9ca3af; font-weight: 500; }

        .shSearchBar {
          display: flex; align-items: center; gap: 0.5rem;
          margin: 1rem 1.5rem; background: #fff;
          border: 0.062rem solid #e5e7eb; border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
        }
        .shSearchInput {
          flex: 1; border: none; outline: none;
          font-size: 0.812rem; color: #111827; font-family: inherit;
          background: transparent;
        }
        .shSearchInput::placeholder { color: #9ca3af; }
        .shSearchClear {
          background: none; border: none; cursor: pointer;
          color: #9ca3af; display: flex; align-items: center; padding: 0;
        }
        .shSearchClear:hover { color: #6b7280; }

        .shEmpty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 4rem 1.5rem;
          text-align: center;
        }

        .shTable {
          margin: 0 1.5rem 1.5rem;
          background: #fff; border: 0.062rem solid #e5e7eb;
          border-radius: 0.625rem; overflow: hidden;
        }
        .shTableHeader {
          display: grid;
          grid-template-columns: 1fr 10rem 9rem 12rem;
          padding: 0.625rem 1rem;
          background: #f9fafb;
          border-bottom: 0.062rem solid #e5e7eb;
          font-size: 0.719rem; font-weight: 600;
          color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .shRow {
          display: grid;
          grid-template-columns: 1fr 10rem 9rem 12rem;
          padding: 0.75rem 1rem;
          border-bottom: 0.062rem solid #f3f4f6;
          align-items: center;
          transition: background 0.1s;
        }
        .shRow:last-child { border-bottom: none; }
        .shRow:hover { background: #fafafa; }

        .shColName { display: flex; align-items: center; gap: 0.625rem; min-width: 0; }
        .shNameBlock { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
        .shName { font-size: 0.844rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .shEmail { font-size: 0.719rem; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .shDiscipline { font-size: 0.781rem; color: #6b7280; }

        .shColStatus { display: flex; align-items: center; }
        .shColActions { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }

        .shBadgeActive {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: #f0fdf4; color: #15803d;
          border: 0.062rem solid #bbf7d0;
          border-radius: 99px; padding: 0.2rem 0.6rem;
          font-size: 0.688rem; font-weight: 600;
        }
        .shBadgeInvited {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: #fffbeb; color: #d97706;
          border: 0.062rem solid #fde68a;
          border-radius: 99px; padding: 0.2rem 0.6rem;
          font-size: 0.688rem; font-weight: 600;
        }
        .shBadgePending {
          display: inline-flex; align-items: center; gap: 0.25rem;
          background: #f3f4f6; color: #6b7280;
          border: 0.062rem solid #e5e7eb;
          border-radius: 99px; padding: 0.2rem 0.6rem;
          font-size: 0.688rem; font-weight: 600;
        }

        .shInviteBtn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: #eff6ff; color: #2563eb;
          border: 0.062rem solid #bfdbfe;
          border-radius: 0.375rem; padding: 0.312rem 0.625rem;
          font-size: 0.719rem; font-weight: 600;
          cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background 0.15s;
        }
        .shInviteBtn:hover:not(:disabled) { background: #dbeafe; }
        .shInviteBtn:disabled { opacity: 0.5; cursor: not-allowed; }

        .shRemoveBtn {
          display: inline-flex; align-items: center;
          background: none; border: 0.062rem solid transparent;
          color: #9ca3af; border-radius: 0.375rem;
          padding: 0.312rem 0.375rem; cursor: pointer;
          transition: all 0.15s;
        }
        .shRemoveBtn:hover:not(:disabled) { color: #ef4444; border-color: #fecaca; background: #fef2f2; }
        .shRemoveBtn:disabled { opacity: 0.4; cursor: not-allowed; }

        .shGuideStep {
          display: flex; gap: 0.75rem; align-items: flex-start;
          padding: 0.75rem 0;
          border-bottom: 0.062rem solid #f3f4f6;
        }
        .shGuideNum {
          flex-shrink: 0; width: 1.375rem; height: 1.375rem;
          border-radius: 50%; background: #111827; color: #fff;
          font-size: 0.688rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          margin-top: 0.125rem;
        }
        .shGuideTitle { font-size: 0.781rem; font-weight: 600; color: #111827; margin-bottom: 0.125rem; }
        .shGuideDesc { font-size: 0.719rem; color: #6b7280; line-height: 1.4; }

        /* Gmail status cards in right panel */
        .shGmailCard {
          display: flex; gap: 0.75rem;
          margin: 0 0 1rem;
          padding: 0.875rem;
          background: #fffbeb;
          border: 0.062rem solid #fde68a;
          border-radius: 0.625rem;
        }
        .shGmailCardIcon {
          flex-shrink: 0; width: 1.75rem; height: 1.75rem;
          border-radius: 50%; background: #fef3c7;
          border: 0.062rem solid #fde68a;
          display: flex; align-items: center; justify-content: center;
          color: #d97706; font-size: 0.875rem;
        }
        .shGmailCardBody { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .shGmailCardTitle { font-size: 0.781rem; font-weight: 600; color: #111827; }
        .shGmailCardDesc { font-size: 0.719rem; color: #6b7280; line-height: 1.4; }
        .shGmailConnectBtn {
          margin-top: 0.5rem;
          display: inline-flex; align-items: center; gap: 0.375rem;
          background: #111827; color: #fff; border: none;
          border-radius: 0.375rem; padding: 0.375rem 0.75rem;
          font-size: 0.75rem; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
          width: fit-content;
        }
        .shGmailConnectBtn:hover { background: #1f2937; }

        .shGmailCardConnected {
          display: flex; gap: 0.5rem; align-items: flex-start;
          margin: 0 0 1rem;
          padding: 0.75rem 0.875rem;
          background: #f0fdf4;
          border: 0.062rem solid #bbf7d0;
          border-radius: 0.625rem;
        }

        /* Gmail Connect Modal */
        .gmailModal {
          background: #fff;
          border-radius: 1rem;
          width: 26rem;
          max-width: calc(100vw - 2rem);
          box-shadow: 0 1.5rem 3rem rgba(0,0,0,0.15), 0 0 0 0.062rem rgba(0,0,0,0.06);
          padding: 2rem 1.75rem 1.5rem;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          animation: shModalIn 0.18s ease;
        }
        @keyframes shModalIn {
          from { opacity: 0; transform: translateY(0.75rem) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gmailModalIcon {
          width: 3rem; height: 3rem; border-radius: 50%;
          background: #fef9c3; border: 0.062rem solid #fde68a;
          display: flex; align-items: center; justify-content: center;
          color: #d97706; font-size: 1.25rem; margin-bottom: 1rem;
        }
        .gmailModalTitle {
          font-size: 1rem; font-weight: 700; color: #111827;
          margin: 0 0 0.5rem;
        }
        .gmailModalDesc {
          font-size: 0.8125rem; color: #6b7280; line-height: 1.6;
          margin: 0 0 1.25rem;
        }
        .gmailModalFeatures {
          display: flex; flex-direction: column; gap: 0.375rem;
          width: 100%; margin-bottom: 1.5rem;
          padding: 0.75rem; background: #f9fafb;
          border: 0.062rem solid #e5e7eb; border-radius: 0.5rem;
        }
        .gmailModalFeature {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.75rem; color: #374151;
        }
        .gmailModalFeature svg { color: #9ca3af; font-size: 0.875rem; flex-shrink: 0; }
        .gmailModalActions {
          display: flex; gap: 0.625rem; width: 100%; justify-content: flex-end;
        }
        .gmailModalCancel {
          padding: 0.5rem 1rem; background: #fff;
          border: 0.062rem solid #e5e7eb; border-radius: 0.5rem;
          font-size: 0.875rem; font-weight: 500; color: #374151;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .gmailModalCancel:hover { background: #f9fafb; }
        .gmailModalConnect {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 1.125rem; background: #111827;
          border: none; border-radius: 0.5rem;
          font-size: 0.875rem; font-weight: 600; color: #fff;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .gmailModalConnect:hover { background: #1f2937; }

        /* ── Add Stakeholder Modal ── */
        .shAddModal {
          background: #fff; border-radius: 1rem; width: 34rem;
          max-width: calc(100vw - 2rem);
          box-shadow: 0 1.5rem 3rem rgba(0,0,0,0.15), 0 0 0 0.062rem rgba(0,0,0,0.06);
          overflow: hidden; display: flex; flex-direction: column;
          animation: shModalIn 0.18s ease;
        }
        .shAddModalHeader {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 1.25rem 1.5rem 1rem; border-bottom: 0.062rem solid #f3f4f6;
        }
        .shAddModalTitle { font-size: 1rem; font-weight: 700; color: #111827; margin-bottom: 0.125rem; }
        .shAddModalSub { font-size: 0.781rem; color: #9ca3af; }
        .shAddModalPreview {
          display: flex; align-items: center; gap: 0.875rem;
          margin: 1rem 1.5rem; padding: 0.875rem 1rem;
          background: #f9fafb; border: 0.062rem solid #e5e7eb; border-radius: 0.75rem;
        }
        .shAddModalAvatar {
          flex-shrink: 0; width: 2.75rem; height: 2.75rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.812rem; font-weight: 700; color: #fff;
          letter-spacing: 0.04em; transition: background 0.2s;
        }
        .shAddModalPreviewInfo { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
        .shAddModalPreviewName {
          font-size: 0.875rem; font-weight: 600; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .shAddModalPreviewMeta {
          font-size: 0.75rem; color: #6b7280;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .shAddModalError {
          margin: 0 1.5rem 0; padding: 0.5rem 0.75rem;
          background: #fef2f2; border: 0.062rem solid #fecaca;
          border-radius: 0.5rem; font-size: 0.781rem; color: #b91c1c;
        }
        .shAddModalBody { display: flex; flex-direction: column; gap: 0.875rem; padding: 0.75rem 1.5rem 1rem; }
        .shRequired { color: #ef4444; font-weight: 700; }
        .shInviteCheckRow {
          display: flex; align-items: flex-start; gap: 0.625rem;
          padding: 0.75rem 0.875rem; background: #eff6ff;
          border: 0.062rem solid #bfdbfe; border-radius: 0.625rem;
          cursor: pointer; margin-top: 0.25rem;
        }
        .shInviteCheck {
          margin-top: 0.1rem; flex-shrink: 0; width: 1rem; height: 1rem;
          accent-color: #2563eb; cursor: pointer;
        }
        .shInviteCheckLabel { font-size: 0.812rem; font-weight: 600; color: #1d4ed8; margin-bottom: 0.125rem; }
        .shInviteCheckDesc { font-size: 0.719rem; color: #3b82f6; line-height: 1.4; }

        .shInviteCheckRowWarn {
          display: flex; align-items: flex-start; gap: 0.625rem;
          padding: 0.75rem 0.875rem; background: #fffbeb;
          border: 0.062rem solid #fde68a; border-radius: 0.625rem;
          cursor: pointer; margin-top: 0.25rem;
        }
        .shInviteCheckLabelWarn { font-size: 0.812rem; font-weight: 600; color: #92400e; margin-bottom: 0.125rem; }
        .shInviteNoGmail { font-size: 0.719rem; color: #b45309; line-height: 1.4; }
        .shInviteConnectLink {
          background: none; border: none; padding: 0;
          font-size: 0.719rem; font-weight: 600; color: #d97706;
          cursor: pointer; font-family: inherit; text-decoration: underline;
          text-underline-offset: 2px;
        }
        .shInviteConnectLink:hover { color: #b45309; }
        .shAddModalFooter {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 0.625rem; padding: 0.875rem 1.5rem;
          border-top: 0.062rem solid #f3f4f6; background: #fafafa;
        }
      `}</style>
    </div>
  );
}
