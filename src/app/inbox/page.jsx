"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  RiBriefcaseLine,
  RiSearchLine,
  RiMailLine,
  RiBellLine,
  RiRefreshLine,
  RiTimeLine,
  RiLoopLeftLine,
  RiMoreLine,
  RiStarLine,
  RiReplyLine,
  RiMoreFill,
  RiAttachment2,
  RiDownload2Line,
  RiFilePdfLine,
  RiEmotionLine,
  RiLinkM,
  RiImageLine,
  RiListCheck,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiFireLine,
  RiAddLine,
  RiArrowDownSLine,
  RiExternalLinkLine,
  RiFilter3Line,
  RiLoader4Line,
  RiDeleteBin3Line,
  RiDeleteBin7Line,
  RiEdit2Fill,
  RiEditLine,
} from "react-icons/ri";
import Sidebar from "../../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import {
  listThreads,
  searchThreads,
  getThread,
  replyToThread,
  createReviewItem,
  updateReviewItem,
  deleteReviewItem,
  downloadAttachment,
  getToken,
  getMe,
  getEmails,
  getEmailThread,
  extractConfirmItems,
  getMailConnections,
  oauthExchange,
  setTokens,
  listProjects,
  getStakeholders,
  createProjectReviewItem,
  createTask,
  updateTask,
  uploadTaskAttachment,
} from "../../lib/api";
import "./inbox.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#4F6BED", "#6B7280", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#0891B2", "#BE185D", "#1D4ED8", "#374151",
];

function hashColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function parseFrom(from = "") {
  const m = from.match(/^(.+?)\s*<(.+?)>$/);
  if (m) {
    const name = m[1].trim();
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return { name, email: m[2].trim(), initials };
  }
  const initials = from.replace(/@.*/, "").slice(0, 2).toUpperCase();
  return { name: from, email: from, initials };
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const DISCIPLINE_CLASS = {
  Structural: "reviewTagArch",
  MEP: "reviewTagMep",
  "Fire/Life Safety": "reviewTagFire",
  Architecture: "reviewTagArch",
  Civil: "reviewTagCivil",
  Electrical: "reviewTagMep",
  Plumbing: "reviewTagMep",
};

const DISCIPLINE_NORMALIZE = {
  architectural: "Architecture",
  architecture: "Architecture",
  structural: "Structural",
  mep: "MEP",
  civil: "Civil",
  electrical: "Electrical",
  plumbing: "Plumbing",
  fire: "Fire/Life Safety",
  "fire/life safety": "Fire/Life Safety",
};
const normalizeDiscipline = (d) =>
  d ? (DISCIPLINE_NORMALIZE[d.toLowerCase()] ?? d) : "Architecture";

const STATUS_CLASS = {
  OPEN: "reviewStatusOpen",
  IN_REVIEW: "reviewStatusInReview",
  NEEDS_DECISION: "reviewStatusNeedsDecision",
  RESOLVED: "reviewStatusResolved",
};

const STATUS_LABEL = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  NEEDS_DECISION: "Needs Decision",
  RESOLVED: "Resolved",
};

// ── Main Component ────────────────────────────────────────────────────────────

const DEV_BYPASS = false; // set false to re-enable auth guard
const DEV_USER = { full_name: "Dev User", email: "dev@local" };

export default function InboxPage() {
  const auth = useAuth();
  const user = DEV_BYPASS ? (auth.user ?? DEV_USER) : auth.user;
  const authLoading = DEV_BYPASS ? false : auth.loading;
  const authLogout = auth.logout;
  const router = useRouter();
  const searchParams = useSearchParams();

  const authCode = searchParams.get("auth_code");

  // ── State ──
  const activeAccount = null;
  const [threads, setThreads] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeThread, setActiveThread] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState(false);
  const [gmailError, setGmailError] = useState(false);
  const [emails, setEmails] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newAttachmentText, setNewAttachmentText] = useState("");
  const [fetchingEmails, setFetchingEmails] = useState(true);
  const [activeEmailId, setActiveEmailId] = useState(null);

  const [projects, setProjects] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [savingTasks, setSavingTasks] = useState(false);
  const [taskUploadingId, setTaskUploadingId] = useState(null);

  const searchTimeout = useRef(null);
  const initRan = useRef(false);
  const fileInputRefs = useRef({});

  // Check mail connections on mount; fetch emails if Gmail is connected
  useEffect(() => {
    if (authLoading) return;        // wait for auth to resolve first
    if (initRan.current) return;
    initRan.current = true;

    const loadEmails = async () => {
      try {
        const data = await getMailConnections();
        const connections = data.data || [];
        const gmailConnected = connections.some(
          (c) => c.provider === "gmail" && c.is_connected
        );
        if (gmailConnected) {
          try {
            await new Promise((r) => setTimeout(r, 2000));
            const res = await getEmails();
            setEmails(res.data || []);
          } catch (err) {
            console.error("getEmails failed", err);
          }
        }
      } catch (err) {
        console.error("getMailConnections failed", err);
      } finally {
        setFetchingEmails(false);
      }
    };

    const init = async () => {
      if (searchParams.get("connected") === "error") {
        setGmailError(true);
      }

      if (authCode) {
        try {
          const res = await oauthExchange(authCode);
          const { access_token, refresh_token } = res.data;
          setTokens(access_token, refresh_token);
          auth.setUser(await getMe());
          window.history.replaceState({}, "", "/inbox");
          await loadEmails();
        } catch (err) {
          console.error("oauth exchange failed", err);
          setFetchingEmails(false);
        }
        return;
      }

      if (!user) {
        setFetchingEmails(false);
        return;
      }

      await loadEmails();
    };
    init();
  }, [authLoading])

  // ── Auth guard ──
  useEffect(() => {
    if (DEV_BYPASS) return;
    if (authCode) return;
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router, authCode]);

  // ── Load projects & stakeholders ──
  useEffect(() => {
    if (authLoading || !user) return;
    listProjects().then((res) => setProjects(res.data || [])).catch(() => {});
    getStakeholders().then((res) => setStakeholders(res.data || [])).catch(() => {});
  }, [user, authLoading]);

  const loadThreads = async (accountId, label) => {
    setLoadingThreads(true);
    setActiveThread(null);
    try {
      const data = await listThreads(accountId, label);
      setThreads(data.threads || []);
      setTotal(data.total || 0);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  // ── Search (debounced) ──
  const handleSearch = (q) => {
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      loadThreads(null, "INBOX");
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setLoadingThreads(true);
      try {
        const data = await searchThreads(activeAccount.id, q);
        setThreads(data.threads || []);
        setTotal(data.total || 0);
      } catch {
        setThreads([]);
      } finally {
        setLoadingThreads(false);
      }
    }, 400);
  };

  // ── Open thread ──
  const openThread = async (thread) => {
    if (loadingThread) return;
    setLoadingThread(true);
    setActiveThread({ ...thread, messages: [], review_items: [] });
    try {
      const detail = await getThread(thread.id, activeAccount.id);
      setActiveThread(detail);
    } catch {
      /* show partial */
    } finally {
      setLoadingThread(false);
    }
  };

  // ── Reply ──
  const handleReply = async () => {
    if (!replyText.trim() || !activeThread || !activeAccount) return;
    setSendingReply(true);
    try {
      await replyToThread(activeThread.id, activeAccount.id, {
        body_text: replyText,
        body_html: `<p>${replyText}</p>`,
        to: activeThread.messages?.[0]
          ? [activeThread.messages[0].from_address]
          : [],
        cc: [],
        subject: null,
      });
      setReplyText("");
      const detail = await getThread(activeThread.id, activeAccount.id);
      setActiveThread(detail);
    } catch {
      /* ignore */
    } finally {
      setSendingReply(false);
    }
  };

  // ── Extract review items ──
  const handleExtract = async () => {
    if (!activeThread) return;
    const threadId = activeThread.thread_id || activeThread.id;
    setExtracting(true);
    try {
      const res = await extractConfirmItems(threadId);
      const raw = res.data || {};
      const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
      const discipline = normalizeDiscipline(raw.review_item?.discipline);
      const projectName = raw.project_name || raw.suggested_project?.name || null;
      const items = tasks.map((t, i) => ({
        id: i,
        title: t.title,
        discipline: discipline,
        status: "OPEN",
        owner_name: t.assignee_name || null,
        due_date: t.due_date || null,
        notes: t.description || null,
        project_name: projectName,
        referenced_attachments: Array.isArray(t.referenced_attachments) ? t.referenced_attachments : [],
      }));
      setActiveThread((t) => ({
        ...t,
        review_items: items,
        ai_review_item: raw.review_item || null,
        ai_attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      }));
    } catch {
      /* ignore */
    } finally {
      setExtracting(false);
    }
  };

  // ── Update review item status ──
  const handleStatusChange = async (item, newStatus) => {
    if (!activeAccount) return;
    try {
      await updateReviewItem(item.id, activeAccount.id, { status: newStatus });
      setActiveThread((t) => ({
        ...t,
        review_items: t.review_items.map((r) =>
          r.id === item.id ? { ...r, status: newStatus } : r
        ),
      }));
    } catch {/* ignore */ }
  };

  // ── Edit review item ──
  const handleEditReviewItem = (item, idx) => {
    setEditingItemId(item.id ?? idx);
    setEditDraft({ ...item });
    setNewAttachmentText("");
  };

  const handleSaveEditItem = () => {
    setActiveThread((t) => ({
      ...t,
      review_items: t.review_items.map((r, i) =>
        (r.id ?? i) === editingItemId ? { ...editDraft } : r
      ),
    }));
    setEditingItemId(null);
    setEditDraft({});
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditDraft({});
  };

  const handleDraftChange = (field, value) => {
    setEditDraft((d) => ({ ...d, [field]: value }));
  };

  const handleRemoveAttachment = (filename) => {
    setEditDraft((d) => ({
      ...d,
      referenced_attachments: (d.referenced_attachments || []).filter((a) => a !== filename),
    }));
  };

  const handleAddAttachment = () => {
    if (!newAttachmentText.trim()) return;
    setEditDraft((d) => ({
      ...d,
      referenced_attachments: [...(d.referenced_attachments || []), newAttachmentText.trim()],
    }));
    setNewAttachmentText("");
  };

  // ── Delete review item ──
  const handleDeleteReviewItem = async (item) => {
    if (!activeAccount) return;
    try {
      await deleteReviewItem(item.id, activeAccount.id);
      setActiveThread((t) => ({
        ...t,
        review_items: t.review_items.filter((r) => r.id !== item.id),
      }));
    } catch {/* ignore */ }
  };

  // ── Save all tasks to backend ──
  const handleSaveAllTasks = async () => {
    if (!selectedProjectId || reviewItems.length === 0) return;
    setSavingTasks(true);
    try {
      const aiRI = activeThread?.ai_review_item || {};
      const riRes = await createProjectReviewItem(selectedProjectId, {
        title: aiRI.title || activeThread?.subject || "Email Review Item",
        description: aiRI.description || null,
        discipline: normalizeDiscipline(aiRI.discipline) || "Architecture",
        priority: ["high", "medium", "low"].includes(aiRI.priority) ? aiRI.priority : "medium",
        due_date: aiRI.due_date || null,
        source: "email",
      });
      const reviewItemId = riRes.data?.id;
      if (!reviewItemId) throw new Error("No review item id returned");
      const savedItems = await Promise.all(
        reviewItems.map(async (item) => {
          const taskRes = await createTask(selectedProjectId, reviewItemId, {
            title: item.title,
            description: item.notes || null,
            stakeholder_id: item.stakeholder_id || null,
            due_date: item.due_date || null,
          });
          return {
            ...item,
            backend_task_id: taskRes.data?.id,
            backend_review_item_id: reviewItemId,
            task_attachments: [],
          };
        })
      );
      setActiveThread((t) => ({ ...t, review_items: savedItems }));
      toast.success("Tasks saved to project");
    } catch (err) {
      console.error("Save failed", err);
      toast.error("Failed to save tasks");
    } finally {
      setSavingTasks(false);
    }
  };

  // ── Upload file to a saved task ──
  const handleTaskFileUpload = async (item, idx, e) => {
    const file = e.target.files?.[0];
    if (!file || !item.backend_task_id || !selectedProjectId) return;
    const itemKey = item.id ?? idx;
    setTaskUploadingId(itemKey);
    try {
      const res = await uploadTaskAttachment(selectedProjectId, item.backend_task_id, file);
      const attachment = res.data;
      setActiveThread((t) => ({
        ...t,
        review_items: t.review_items.map((r, i) =>
          (r.id ?? i) === itemKey
            ? { ...r, task_attachments: [...(r.task_attachments || []), attachment] }
            : r
        ),
      }));
    } catch (err) {
      console.error("Upload failed", err);
      toast.error("Upload failed");
    } finally {
      setTaskUploadingId(null);
      if (fileInputRefs.current[itemKey]) fileInputRefs.current[itemKey].value = "";
    }
  };

  // ── Sync account ──
  const handleSync = async () => {
    setSyncingAccount(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
    } catch {/* ignore */ }
    finally {
      setSyncingAccount(false);
    }
  };

  // ── Map raw email object → messages[] entry ──
  const toMessage = (e) => ({
    id: e.id,
    from_address: e.from_name ? `${e.from_name} <${e.from_email}>` : (e.from_email || ""),
    to_addresses: e.to_emails
      ? e.to_emails.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    sent_at: e.received_at,
    body_html: e.body_html && e.body_html.trim().startsWith("<") ? e.body_html : null,
    body_text: e.body_text || null,
    attachments: e.attachments || [],
  });

  // ── Open email from list ──
  const openEmail = async (email) => {
    if (loadingThread) return;
    setActiveEmailId(email.id);
    // Show content immediately using list-item data, no blank flash
    setActiveThread({
      id: email.id,
      thread_id: email.thread_id,
      subject: email.subject,
      _isEmail: true,
      messages: [toMessage(email)],
      review_items: [],
      ai_processed: false,
    });
    // Then fetch full thread to get all messages
    setLoadingThread(true);
    try {
      const res = await getEmailThread(email.thread_id);
      const rawMsgs = Array.isArray(res.data) ? res.data : res.data ? [res.data] : null;
      if (rawMsgs && rawMsgs.length > 0) {
        setActiveThread({
          id: email.id,
          thread_id: email.thread_id,
          subject: rawMsgs[0].subject || email.subject,
          _isEmail: true,
          messages: rawMsgs.map(toMessage),
          review_items: [],
          ai_processed: false,
        });
      }
    } catch {
      // keep the content already shown from list data
    } finally {
      setLoadingThread(false);
    }
  };

  // ── Connect Gmail ──
  const handleConnectGmail = () => {
    const token = getToken();
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    window.location.href = `${base}/mail-connections/connect/gmail?token=${token}`;
  };

  // ── Logout ──
  const handleLogout = async () => {
    await authLogout();
    router.push("/login");
  };

  // ── Derived ──
  const userInitials = user
    ? user.full_name
      ?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() ||
    user.email?.slice(0, 2).toUpperCase()
    : "??";

  const unreadCount = emails.filter((e) => !e.is_read).length;

  const filterTabs = [
    { label: "All" },
    { label: "Unread", count: unreadCount || undefined },
    { label: "@ Mentions" },
    { label: "Needs triage" },
  ];

  // Filter displayed threads by activeFilter tab
  const displayedThreads = threads.filter((t) => {
    if (activeFilter === "Unread") return t.is_unread;
    return true;
  });

  if (!authCode && !authLoading && !user) return null;



  // ── Render ────────────────────────────────────────────────────────────────

  const mainMessage = activeThread?.messages?.[0];
  const mainFrom = mainMessage ? parseFrom(mainMessage.from_address) : null;
  const reviewItems = activeThread?.review_items || [];

  return (
    <div className="appShell">
      {gmailError && (
        <div className="gmailErrorBanner">
          <span>Failed to connect Gmail. Please try again.</span>
          <button onClick={() => setGmailError(false)}>✕</button>
        </div>
      )}
      {/* ── Left Sidebar ── */}
      <Sidebar unreadCount={unreadCount || undefined} onSettingsClick={handleLogout} />

      {/* ── Email List Panel ── */}
      <div className="emailPanel">
        <div className="emailPanelHeader">
          <h2 className="panelTitle">Gmail Intake</h2>
          <span className="aiOnBadge">
            <RiCheckboxCircleLine className="iconSize13" />
            AI ON
          </span>
        </div>

        {/* Filter tabs */}
        <div className="filterTabs">
          {filterTabs.map((f) => (
            <button
              key={f.label}
              className={`filterTab ${activeFilter === f.label ? "filterTabActive" : ""}`}
              onClick={() => setActiveFilter(f.label)}
            >
              {f.label}
              {f.count !== undefined && (
                <span className="filterCount">{f.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Label filter row */}
        <div className="filterRow">
          <select className="filterDropdown" value="INBOX" disabled>
            <option value="INBOX">INBOX</option>
          </select>
          <button
            className="filterIconBtn"
            onClick={handleSync}
            disabled={syncingAccount}
            title="Sync account"
          >
            <RiRefreshLine className={`iconSize14 ${syncingAccount ? "spinning" : ""}`} />
          </button>
        </div>

        {/* Email list */}
        <div className="emailList">
          {fetchingEmails ? (
            <div className="listLoader">
              <RiLoader4Line className="spinnerIcon iconSize18" />
              <span style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>Fetching emails…</span>
            </div>
          ) : loadingThreads ? (
            <div className="listLoader">
              <RiLoader4Line className="spinnerIcon iconSize18" />
            </div>
          ) : emails.length > 0 ? (
            emails.map((email) => {
              const initials = (email.from_name || email.from_email || "?")
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const color = hashColor(email.from_email || "");
              return (
                <div
                  key={email.id}
                  className={`emailItem ${activeEmailId === email.id ? "emailItemActive" : ""}`}
                  onClick={() => openEmail(email)}
                >
                  <Avatar initials={initials} color={color} />
                  <div className="emailItemContent">
                    <div className="emailItemRow">
                      <span className="emailSender">{email.from_name || email.from_email}</span>
                      <span className="emailTime">{formatTime(email.received_at)}</span>
                    </div>
                    <div className="emailSubject">{email.subject}</div>
                    <div className="emailMeta">
                      {email.project_id && (
                        <span className="emailTag">Project {email.project_id}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : displayedThreads.length === 0 ? (
            <div className="emptyState">
              <RiMailLine className="iconSize20" />
              <p>No threads found</p>
              <button className="connectGmailBtn" onClick={handleConnectGmail}>
                Connect Gmail
              </button>
            </div>
          ) : (
            displayedThreads.map((thread) => {
              const color = hashColor(thread.gmail_thread_id);
              const initials = (thread.subject || "?").slice(0, 2).toUpperCase();
              return (
                <div
                  key={thread.id}
                  className={`emailItem ${activeThread?.id === thread.id ? "emailItemActive" : ""}`}
                  onClick={() => openThread(thread)}
                >
                  <Avatar initials={initials} color={color} />
                  <div className="emailItemContent">
                    <div className="emailItemRow">
                      <span className="emailSender">
                        {thread.subject || "(no subject)"}
                      </span>
                      <span className="emailTime">
                        {formatTime(thread.last_message_at)}
                      </span>
                    </div>
                    <div className="emailPreview">{thread.snippet}</div>
                    <div className="emailMeta">
                      {thread.labels?.slice(0, 1).map((l, i) => (
                        <span key={l.id ?? i} className="emailTag">{l.name}</span>
                      ))}
                      {thread.has_attachments && (
                        <RiAttachment2 className="attachIcon iconSize12" />
                      )}
                      {thread.is_unread && <span className="unreadDot" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="emailPagination">
          <span>
            {displayedThreads.length} of {total}
          </span>
          <button className="refreshBtn" onClick={handleSync} disabled={syncingAccount}>
            <RiRefreshLine className={`iconSize14 ${syncingAccount ? "spinning" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Email Thread Panel ── */}
      <div className="threadPanel">
        {!activeThread ? (
          <div className="emptyThread">
            <RiMailLine className="iconSize20" />
            <p>Select a thread to read</p>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            <div className="threadBreadcrumb">
              <span className="breadcrumbProject">
                {activeThread._isEmail ? "Gmail" : (activeAccount?.gmail_address || "Gmail")}
              </span>
              <span className="breadcrumbSep">/</span>
              <span className="breadcrumbSub">INBOX</span>
              <div className="threadActions">
                {!activeThread._isEmail && (
                  <button className="iconBtn" onClick={() => openThread(activeThread)}>
                    <RiLoopLeftLine className="iconSize16" />
                  </button>
                )}
                <button className="iconBtn"><RiMoreLine className="iconSize16" /></button>
              </div>
            </div>

            {/* Thread subject */}
            <h1 className="threadSubject">
              {activeThread.subject || "(no subject)"}
            </h1>

            {/* Scrollable content */}
            <div className="threadContent">
              {/* Main email */}
              {loadingThread ? (
                <div className="threadLoader">
                  <RiLoader4Line className="spinnerIcon iconSize18" />
                </div>
              ) : mainMessage ? (
                <div className="mainEmail">
                  <div className="mainEmailHeader">
                    <Avatar
                      initials={mainFrom?.initials || "??"}
                      color={hashColor(mainMessage.from_address)}
                      size={38}
                    />
                    <div className="mainEmailMeta">
                      <div className="mainEmailFrom">
                        <span className="mainEmailName">{mainFrom?.name}</span>
                        <span className="mainEmailAddr">
                          &lt;{mainFrom?.email}&gt;
                        </span>
                        <span className="mainEmailTime">
                          {formatTime(mainMessage.sent_at)}
                        </span>
                      </div>
                      <div className="mainEmailTo">
                        to {mainMessage.to_addresses?.join(", ")}
                      </div>
                    </div>
                    <div className="mainEmailActions">
                      <button className="iconBtn"><RiStarLine className="iconSize16" /></button>
                      <button className="iconBtn"><RiReplyLine className="iconSize16" /></button>
                      <button className="iconBtn"><RiMoreFill className="iconSize16" /></button>
                    </div>
                  </div>

                  {/* AI notice */}
                  {activeThread.ai_processed && (
                    <div className="aiNotice">
                      <RiAlertLine className="aiNoticeIcon iconSize14" />
                      <span>
                        AI extracted {activeThread.review_item_count || reviewItems.length} review items from this thread
                      </span>
                      <button className="viewInPanelBtn" onClick={handleExtract} disabled={extracting}>
                        {extracting ? "Extracting…" : "Extract now"}
                        <span className="arrowRight">→</span>
                      </button>
                    </div>
                  )}

                  {/* Email body */}
                  <div className="emailBody">
                    {mainMessage.body_html ? (
                      <iframe
                        srcDoc={mainMessage.body_html}
                        className="emailIframe"
                        title="email-body"
                        sandbox="allow-same-origin allow-popups"
                        onLoad={(e) => {
                          const doc = e.target.contentDocument;
                          if (doc) {
                            e.target.style.height = doc.documentElement.scrollHeight + "px";
                          }
                        }}
                      />
                    ) : mainMessage.body_text ? (
                      <p style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
                        {mainMessage.body_text}
                      </p>
                    ) : (
                      <p className="emailBodyUnavailable">Email body not available in preview.</p>
                    )}
                  </div>

                  {/* Attachments */}
                  {mainMessage.attachments?.length > 0 && (
                    <div className="attachmentsRow">
                      <span className="attachmentsLabel">
                        {mainMessage.attachments.length} attachment
                        {mainMessage.attachments.length > 1 ? "s" : ""}
                      </span>
                      <div className="attachments">
                        {mainMessage.attachments.map((att, i) => (
                          <div key={att.id ?? i} className="attachmentCard">
                            <RiFilePdfLine className="pdfIcon iconSize20" />
                            <div className="attachmentInfo">
                              <span className="attachmentName">{att.file_name}</span>
                              <span className="attachmentSize">
                                {att.file_size >= 1024 * 1024
                                  ? (att.file_size / (1024 * 1024)).toFixed(1) + " MB"
                                  : (att.file_size / 1024).toFixed(1) + " KB"}
                              </span>
                            </div>
                            <button
                              className="downloadBtn"
                              onClick={() =>
                                downloadAttachment(att.id, activeAccount.id)
                              }
                            >
                              <RiDownload2Line className="iconSize14" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Older messages / replies */}
              {activeThread.messages?.length > 1 && (
                <>
                  <div className="olderMessages">
                    <span>
                      {activeThread.messages.length - 1} more message
                      {activeThread.messages.length > 2 ? "s" : ""} in this thread
                    </span>
                  </div>

                  <div className="threadReplies">
                    {activeThread.messages.slice(1).map((msg) => {
                      const from = parseFrom(msg.from_address);
                      return (
                        <div key={msg.id} className="replyItem">
                          <Avatar
                            initials={from.initials}
                            color={hashColor(msg.from_address)}
                            size={32}
                          />
                          <div className="replyContent">
                            <div className="replyHeader">
                              <span className="replyName">{from.name}</span>
                              <span className="replyTo">
                                to {msg.to_addresses?.join(", ")}
                              </span>
                              <span className="replyTime">
                                {formatTime(msg.sent_at)}
                              </span>
                              <button className="iconBtn">
                                <RiStarLine className="iconSize14" />
                              </button>
                            </div>
                            <p className="replyBody">{msg.body_text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Reply box */}
            <div className="replyBox">
              <div className="replyInputRow">
                <Avatar initials={userInitials} color="#374151" size={32} />
                <input
                  type="text"
                  placeholder="Reply to all..."
                  className="replyInput"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
              </div>
              <div className="replyToolbar">
                <button className="toolbarBtn"><RiAttachment2 className="iconSize16" /></button>
                <button className="toolbarBtn"><RiLinkM className="iconSize16" /></button>
                <button className="toolbarBtn"><RiListCheck className="iconSize16" /></button>
                <button className="toolbarBtn"><RiImageLine className="iconSize16" /></button>
                <button className="toolbarBtn"><RiEmotionLine className="iconSize16" /></button>
                <div className="toolbarSpacer" />
                <button
                  className="sendBtn"
                  onClick={handleReply}
                  disabled={sendingReply || !replyText.trim()}
                >
                  {sendingReply ? "Sending…" : "Send"}
                  <RiArrowDownSLine className="iconSize14" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right Panel – Extracted Review Items ── */}
      <div className="rightPanel">
        <div className="rightPanelHeader">
          <div className="rightPanelTitle">
            <RiFilter3Line className="iconSize15" />
            <span>Extracted Review Items</span>
            <span className="reviewCount">{reviewItems.length}</span>
          </div>
          <button
            className="createReviewBtn"
            onClick={handleExtract}
            disabled={extracting || !activeThread}
          >
            {extracting ? "Extracting…" : "Extract Items"}
          </button>
        </div>

        {/* Project selector + Save to Project */}
        {reviewItems.length > 0 && (
          <div className="projectSaveRow">
            <select
              className="projectSelector"
              value={selectedProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              className="saveToProjectBtn"
              onClick={handleSaveAllTasks}
              disabled={!selectedProjectId || savingTasks || (reviewItems.length > 0 && reviewItems.every((r) => r.backend_task_id))}
            >
              {savingTasks ? (
                <><RiLoader4Line className="spinnerIcon iconSize13" style={{ marginRight: 4 }} />Saving…</>
              ) : reviewItems.length > 0 && reviewItems.every((r) => r.backend_task_id) ? (
                <><RiCheckboxCircleLine className="iconSize13" style={{ marginRight: 4 }} />Saved</>
              ) : "Save to Project"}
            </button>
          </div>
        )}

        {/* Thread attachments from AI extraction */}
        {activeThread?.ai_attachments?.length > 0 && (
          <div className="threadAttachmentsStrip">
            <span className="threadAttachLabel">
              <RiAttachment2 className="iconSize12" style={{ marginRight: 4 }} />
              Thread Files
            </span>
            <div className="threadAttachList">
              {activeThread.ai_attachments.map((att, i) => {
                const actual = activeThread.messages
                  ?.flatMap((m) => m.attachments || [])
                  .find((a) => a.file_name === att);
                return (
                  <span
                    key={i}
                    className={`threadAttachChip${actual ? " threadAttachChipLink" : ""}`}
                    onClick={() => actual && downloadAttachment(actual.id, activeAccount?.id)}
                    title={actual ? "Click to download" : att}
                  >
                    <RiAttachment2 className="iconSize11" style={{ marginRight: 3 }} />
                    {att}
                    {actual && <RiDownload2Line className="iconSize11" style={{ marginLeft: 4 }} />}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="aiDraftNotice">
          <RiCheckboxCircleLine className="iconSize13" />
          <span>AI drafted from this thread. Review and approve.</span>
        </div>

        <div className="reviewItems">
          {reviewItems.length === 0 && !extracting ? (
            <div className="emptyReview">
              <p>No review items yet.</p>
              {activeThread && (
                <button className="extractBtn" onClick={handleExtract}>
                  Run AI extraction
                </button>
              )}
            </div>
          ) : extracting ? (
            <div className="listLoader">
              <RiLoader4Line className="spinnerIcon iconSize18" />
              <span>AI is extracting…</span>
            </div>
          ) : (
            reviewItems.map((item, idx) => {
              const isEditing = editingItemId === (item.id ?? idx);
              const tagClass = DISCIPLINE_CLASS[item.discipline] || "reviewTagArch";
              const statusClass = STATUS_CLASS[item.status] || "reviewStatusOpen";
              return (
                <div key={item.id ?? idx} className="reviewCard">
                  <div className="reviewCardHeader">
                    {isEditing ? (
                      <input
                        className="editTitleInput"
                        value={editDraft.title || ""}
                        onChange={(e) => handleDraftChange("title", e.target.value)}
                      />
                    ) : (
                      <span className="reviewCardTitle">{item.title}</span>
                    )}
                    {isEditing ? (
                      <div className="editCardActions">
                        <button className="editCancelBtn" onClick={handleCancelEdit}>Cancel</button>
                        <button className="editSaveBtn" onClick={handleSaveEditItem}>Save</button>
                      </div>
                    ) : (
                      <>
                        <button className="iconBtn" onClick={() => handleEditReviewItem(item, idx)}>
                          <RiEditLine className="iconSize14" />
                        </button>
                        <button className="iconBtn" onClick={() => handleDeleteReviewItem(item)}>
                          <RiDeleteBin7Line className="iconSize14" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="reviewCardMeta">
                    <div className="reviewTagRow">
                      {isEditing ? (
                        <select
                          className="editSelect"
                          value={editDraft.discipline || ""}
                          onChange={(e) => handleDraftChange("discipline", e.target.value)}
                        >
                          {Object.keys(DISCIPLINE_CLASS).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`reviewTag ${tagClass}`}>
                          {item.discipline === "Fire/Life Safety" ? (
                            <RiFireLine className="iconMr3 iconSize11" />
                          ) : (
                            <RiAlertLine className="iconMr3 iconSize11" />
                          )}
                          {item.discipline || "General"}
                        </span>
                      )}
                      <select
                        className={`reviewStatus ${isEditing ? "reviewStatusEditing" : statusClass}`}
                        value={isEditing ? (editDraft.status || "OPEN") : item.status}
                        onChange={(e) =>
                          isEditing
                            ? handleDraftChange("status", e.target.value)
                            : handleStatusChange(item, e.target.value)
                        }
                      >
                        {Object.entries(STATUS_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>

                    <div className="reviewMetaRow mt-2">
                      <span className="reviewMetaLabel me-3">Project</span>
                      {isEditing ? (
                        <select
                          className="editSelectInline"
                          value={editDraft.project_id || ""}
                          onChange={(e) => {
                            const pid = e.target.value ? Number(e.target.value) : null;
                            const proj = projects.find((p) => p.id === pid);
                            handleDraftChange("project_id", pid);
                            handleDraftChange("project_name", proj?.name || "");
                          }}
                        >
                          <option value="">Select project…</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="reviewMetaValue">
                          {item.project_name ? item.project_name : <span className="reviewMetaNone">-</span>}
                        </span>
                      )}
                    </div>

                    <div className="reviewMetaRow mt-2">
                      <span className="reviewMetaLabel me-3">Stakeholder</span>
                      {isEditing ? (
                        <select
                          className="editSelectInline"
                          value={editDraft.stakeholder_id || ""}
                          onChange={(e) => {
                            const sid = e.target.value ? Number(e.target.value) : null;
                            const stk = stakeholders.find((s) => s.id === sid);
                            handleDraftChange("stakeholder_id", sid);
                            handleDraftChange("owner_name", stk?.name || "");
                          }}
                        >
                          <option value="">Select stakeholder…</option>
                          {stakeholders.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}{s.discipline ? ` (${s.discipline})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="reviewMetaValue">
                          {item.owner_name ? (
                            <>
                              <span className="ownerInitialsBadge">
                                {item.owner_name.slice(0, 2).toUpperCase()}
                              </span>
                              {item.owner_name}
                            </>
                          ) : <span className="reviewMetaNone">-</span>}
                        </span>
                      )}
                    </div>

                    <div className="reviewMetaRow">
                      <span className="reviewMetaLabel me-3">Due Date</span>
                      {isEditing ? (
                        <input
                          type="date"
                          className="editInputInline"
                          value={editDraft.due_date || ""}
                          onChange={(e) => handleDraftChange("due_date", e.target.value)}
                        />
                      ) : (
                        <span className="reviewMetaValue">
                          {item.due_date ? (
                            <>
                              <RiTimeLine className="iconMr4 iconSize13" />
                              {formatDate(item.due_date)}
                            </>
                          ) : <span className="reviewMetaNone">-</span>}
                        </span>
                      )}
                    </div>

                    <div className="reviewMetaRow">
                      <span className="reviewMetaLabel me-3">Evidence</span>
                      {isEditing ? (
                        <input
                          className="editInputInline"
                          value={editDraft.evidence_filename || ""}
                          onChange={(e) => handleDraftChange("evidence_filename", e.target.value)}
                          placeholder="filename…"
                        />
                      ) : (
                        <span className="reviewMetaValue">
                          {item.evidence_filename ? (
                            <>
                              <RiAttachment2 className="iconMr4 iconSize13" />
                              <span className="evidenceLink">{item.evidence_filename}</span>
                              <RiExternalLinkLine className="iconMl4 iconSize12" />
                            </>
                          ) : <span className="reviewMetaNone">-</span>}
                        </span>
                      )}
                    </div>

                    <div className="reviewMetaRow" style={{ alignItems: "flex-start" }}>
                      <span className="reviewMetaLabel me-3" style={{ paddingTop: 3 }}>Ref. Files</span>
                      {isEditing ? (
                        <div className="editAttachmentsCol">
                          <div className="editAttachChips">
                            {(editDraft.referenced_attachments || []).map((att, i) => (
                              <span key={i} className="attachChipEdit">
                                <RiAttachment2 className="iconSize11" style={{ marginRight: 3 }} />
                                {att}
                                <button className="attachChipRemove" onClick={() => handleRemoveAttachment(att)}>×</button>
                              </span>
                            ))}
                          </div>
                          <div className="addAttachRow">
                            <input
                              className="editInputSm"
                              value={newAttachmentText}
                              onChange={(e) => setNewAttachmentText(e.target.value)}
                              placeholder="add filename…"
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddAttachment(); }}
                            />
                            <button className="addAttachBtn" onClick={handleAddAttachment}>Add</button>
                          </div>
                        </div>
                      ) : (
                        <div className="attachChipList">
                          {item.referenced_attachments?.length > 0 ? (
                            item.referenced_attachments.map((att, i) => (
                              <span key={i} className="attachChip">
                                <RiAttachment2 className="iconMr3 iconSize11" />
                                {att}
                              </span>
                            ))
                          ) : <span className="reviewMetaNone">-</span>}
                        </div>
                      )}
                    </div>

                    {/* Task uploaded files + per-task upload */}
                    <div className="reviewMetaRow" style={{ alignItems: "flex-start" }}>
                      <span className="reviewMetaLabel me-3" style={{ paddingTop: 3 }}>Uploads</span>
                      <div className="taskUploadCol">
                        {(item.task_attachments || []).map((att, i) => (
                          <span key={i} className="taskAttachChip">
                            <RiAttachment2 className="iconSize11" style={{ marginRight: 3 }} />
                            <span className="taskAttachName">{att.file_name}</span>
                            <button
                              className="taskAttachDownload"
                              onClick={() => downloadAttachment(att.id, activeAccount?.id)}
                              title="Download"
                            >
                              <RiDownload2Line className="iconSize11" />
                            </button>
                          </span>
                        ))}
                        {item.backend_task_id && selectedProjectId ? (
                          <>
                            <input
                              type="file"
                              style={{ display: "none" }}
                              ref={(el) => { fileInputRefs.current[item.id ?? idx] = el; }}
                              onChange={(e) => handleTaskFileUpload(item, idx, e)}
                            />
                            <button
                              className="taskUploadBtn"
                              disabled={taskUploadingId === (item.id ?? idx)}
                              onClick={() => fileInputRefs.current[item.id ?? idx]?.click()}
                            >
                              {taskUploadingId === (item.id ?? idx) ? (
                                <RiLoader4Line className="spinnerIcon iconSize12" style={{ marginRight: 3 }} />
                              ) : (
                                <RiAttachment2 className="iconSize12" style={{ marginRight: 3 }} />
                              )}
                              {taskUploadingId === (item.id ?? idx) ? "Uploading…" : "Upload file"}
                            </button>
                          </>
                        ) : (
                          <span className="taskUploadHint">
                            {item.backend_task_id ? "Select a project to upload" : "Save to project to upload files"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button
          className="addReviewBtn"
          onClick={() =>
            activeThread &&
            activeAccount &&
            createReviewItem(activeAccount.id, {
              thread_id: activeThread.id,
              title: "New review item",
              discipline: "Architecture",
              status: "OPEN",
            }).then((item) =>
              setActiveThread((t) => ({
                ...t,
                review_items: [...(t.review_items || []), item],
              }))
            )
          }
          disabled={!activeThread}
        >
          <RiAddLine className="iconSize15" /> Add review item
        </button>
      </div>

      {/* ── Top Navbar ── */}
      <div className="topNav">
        <div className="topNavLeft">
          <button className="orgSwitcher">
            <RiBriefcaseLine className="iconSize15" />
            {activeAccount?.gmail_address || "No account"}
            <RiArrowDownSLine className="iconSize14" />
          </button>
        </div>

        <div className="topNavCenter">
          <div className="searchBox">
            <RiSearchLine className="searchIcon iconSize15" />
            <input
              type="text"
              placeholder="Search threads…"
              className="searchInput"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <kbd className="searchKbd">⌘K</kbd>
          </div>
        </div>

        <div className="topNavRight">
          {emails.length > 0 ? (
            <div className="statusChip">
              <RiMailLine className="iconSize14" />
              <span className="statusDot statusDotGreen" />
              <span>Gmail Connected</span>
              <span className="statusChipSub">· {emails.length} emails</span>
            </div>
          ) : (
            <button className="statusChip connectChipBtn" onClick={handleConnectGmail}>
              <RiMailLine className="iconSize14" />
              Connect Gmail
            </button>
          )}

          <button className="iconBtn">
            <RiBellLine className="iconSize18" />
          </button>
          <div className="avatarChip">
            <div className="userAvatar">{userInitials}</div>
            <div>
              <div className="userName">{user?.full_name || user?.email}</div>
              <div className="userRole" onClick={handleLogout} style={{ cursor: "pointer" }}>
                Sign out
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const AVATAR_COLOR_MAP = {
  "#4F6BED": "avatarBlue",
  "#6B7280": "avatarGray",
  "#9CA3AF": "avatarLightGray",
  "#1F2937": "avatarDark",
  "#374151": "avatarMediumDark",
};

const AVATAR_SIZE_MAP = { 32: "avatarSm", 34: "avatarMd", 38: "avatarLg" };

function Avatar({ initials, color, size = 34 }) {
  const colorClass = AVATAR_COLOR_MAP[color] || "";
  const sizeClass = AVATAR_SIZE_MAP[size] || "avatarMd";
  const dynamicStyle = colorClass ? {} : { background: color };
  return (
    <div
      className={`avatar ${sizeClass} ${colorClass}`}
      style={dynamicStyle}
    >
      {initials}
    </div>
  );
}

