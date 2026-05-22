import axios from "axios";
import Cookies from "js-cookie";
import { sha256 } from "js-sha256";
import toast from "react-hot-toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/axiosInstance/v1";

// ── Cookie helpers ────────────────────────────────────────────────────────────

export function setTokens(accessToken, refreshToken) {
  Cookies.set("access_token", accessToken, { sameSite: "Lax" });
  if (refreshToken) Cookies.set("refresh_token", refreshToken, { sameSite: "Lax" });
}

export function getToken() {
  return Cookies.get("access_token") || null;
}

export function clearTokens() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
}

// ── Axios instance ────────────────────────────────────────────────────────────

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// Attach access_token before every request
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// On 401 — refresh using current access_token, retry once
let _isRefreshing = false;
let _queue = [];

function processQueue(error, token) {
  _queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _queue = [];
}

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then((token) => {
          original.headers["Authorization"] = `Bearer ${token}`;
          return axiosInstance(original);
        });
      }
      original._retry = true;
      _isRefreshing = true;
      const expiredToken = getToken();
      try {
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              "Authorization": `Bearer ${expiredToken}`,
              "ngrok-skip-browser-warning": "true",
            },
          }
        );
        const newToken = data.data?.access_token || data.access_token;
        setTokens(newToken);
        processQueue(null, newToken);
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return axiosInstance(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        if (typeof window !== "undefined") {
          toast.error("Session expired. Please log in again.");
          setTimeout(() => { window.location.href = "/login"; }, 1500);
        }
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }
    const msg =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const register = (email, password) =>
  axiosInstance.post("/auth/register", { email, password: sha256(password) }).then((r) => r.data);

export const login = async (email, password) => {
  const { data } = await axiosInstance.post("/auth/login", { email, password: sha256(password) });
  setTokens(data.data.access_token, data.data.refresh_token);
  return data;
};

export const logout = async () => {
  clearTokens();
};

export const refreshToken = () => axiosInstance.post("/auth/refresh").then((r) => r.data);

export const getMe = () => axiosInstance.get("/auth/me").then((r) => r.data);

export const getGoogleAuthUrl = () =>
  axios.get(`${BASE_URL}/auth/google`, {
    headers: { "ngrok-skip-browser-warning": "true" },
  }).then((r) => r.data);

// ── Accounts ──────────────────────────────────────────────────────────────────

export const listAccounts = () => axiosInstance.get("/accounts/").then((r) => r.data);

export const syncAccount = (accountId) =>
  axiosInstance.post(`/accounts/${accountId}/sync`).then((r) => r.data);

export const deleteAccount = (accountId) =>
  axiosInstance.delete(`/accounts/${accountId}`).then((r) => r.data);

// ── Threads ───────────────────────────────────────────────────────────────────

export const listThreads = (accountId, label = "INBOX", page = 1, perPage = 50) =>
  axiosInstance.get(`/threads/?account_id=${accountId}&label=${encodeURIComponent(label)}&page=${page}&per_page=${perPage}`).then((r) => r.data);

export const searchThreads = (accountId, q, page = 1, perPage = 50) =>
  axiosInstance.get(`/threads/search?account_id=${accountId}&q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`).then((r) => r.data);

export const getThread = (threadId, accountId) =>
  axiosInstance.get(`/threads/${threadId}?account_id=${accountId}`).then((r) => r.data);

// ── Messages ──────────────────────────────────────────────────────────────────

export const replyToThread = (threadId, accountId, body) =>
  axiosInstance.post(`/messages/${threadId}/reply?account_id=${accountId}`, body).then((r) => r.data);

export const sendMessage = (accountId, body) =>
  axiosInstance.post(`/messages/send?account_id=${accountId}`, body).then((r) => r.data);

export const markRead = (accountId, messageIds, isRead = true) =>
  axiosInstance.patch(`/messages/mark-read?account_id=${accountId}`, { message_ids: messageIds, is_read: isRead }).then((r) => r.data);

// ── Labels ────────────────────────────────────────────────────────────────────

export const listLabels = (accountId) =>
  axiosInstance.get(`/labels/?account_id=${accountId}`).then((r) => r.data);

// ── Attachments ───────────────────────────────────────────────────────────────

export const downloadAttachment = async (attachmentId) => {
  const token = getToken();
  const res = await axios.get(
    `${BASE_URL}/attachments/${attachmentId}/download`,
    {
      responseType: "blob",
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  const cd = res.headers["content-disposition"] || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "attachment";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Projects ──────────────────────────────────────────────────────────────────

export const listProjects = () => axiosInstance.get("/projects/").then((r) => r.data);

export const createProject = (body) =>
  axiosInstance.post("/projects/", body).then((r) => r.data);

export const updateProject = (projectId, body) =>
  axiosInstance.patch(`/projects/${projectId}`, body).then((r) => r.data);

export const deleteProject = (projectId) =>
  axiosInstance.delete(`/projects/${projectId}`).then((r) => r.data);

export const uploadProjectLogo = (file) => {
  const form = new FormData();
  form.append("file", file);
  return axiosInstance
    .post("/projects/upload-logo", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((r) => r.data);
};

// ── Review Items ──────────────────────────────────────────────────────────────

export const listReviewItems = (threadId, accountId) =>
  axiosInstance.get(`/review-items/?thread_id=${threadId}&account_id=${accountId}`).then((r) => r.data);

export const createReviewItem = (accountId, body) =>
  axiosInstance.post(`/review-items/?account_id=${accountId}`, body).then((r) => r.data);

export const updateReviewItem = (itemId, accountId, body) =>
  axiosInstance.patch(`/review-items/${itemId}?account_id=${accountId}`, body).then((r) => r.data);

export const deleteReviewItem = (itemId, accountId) =>
  axiosInstance.delete(`/review-items/${itemId}?account_id=${accountId}`).then((r) => r.data);

export const extractReviewItems = (threadId, accountId) =>
  axiosInstance.post(`/review-items/${threadId}/extract?account_id=${accountId}`).then((r) => r.data);

// ── AI Config ─────────────────────────────────────────────────────────────────

export const getAiConfig = () => axiosInstance.get("/ai/config").then((r) => r.data);

// ── Mail Connections ──────────────────────────────────────────────────────────

export const getMailConnections = () =>
  axiosInstance.get("/builders/me/mail-connections").then((r) => r.data);

// ── OAuth Exchange ────────────────────────────────────────────────────────────

export const oauthExchange = (authCode) =>
  axios.get(`${BASE_URL}/auth/oauth-exchange/${authCode}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
  }).then((r) => r.data);

// ── Emails ────────────────────────────────────────────────────────────────────

export const getEmails = () => axiosInstance.get("/emails").then((r) => r.data);

export const getEmailThread = (threadId) =>
  axiosInstance.get(`/emails/thread/${threadId}`).then((r) => r.data);

export const extractConfirmItems = (threadId) =>
  axiosInstance.post(`/threads/${threadId}/extract`).then((r) => r.data);

// ── Stakeholders ──────────────────────────────────────────────────────────────

export const getStakeholders = (discipline = null) =>
  axiosInstance
    .get(`/stakeholders${discipline ? `?discipline=${encodeURIComponent(discipline)}` : ""}`)
    .then((r) => r.data);

// ── Project Review Items & Tasks ──────────────────────────────────────────────

export const createProjectReviewItem = (projectId, body) =>
  axiosInstance.post(`/projects/${projectId}/review-items`, body).then((r) => r.data);

export const createTask = (projectId, reviewItemId, body) =>
  axiosInstance
    .post(`/projects/${projectId}/review-items/${reviewItemId}/tasks`, body)
    .then((r) => r.data);

export const updateTask = (projectId, reviewItemId, taskId, body) =>
  axiosInstance
    .put(`/projects/${projectId}/review-items/${reviewItemId}/tasks/${taskId}`, body)
    .then((r) => r.data);

export const uploadTaskAttachment = (projectId, taskId, file) => {
  const form = new FormData();
  form.append("file", file);
  return axiosInstance
    .post(`/projects/${projectId}/tasks/${taskId}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const getTaskAttachments = (projectId, taskId) =>
  axiosInstance.get(`/projects/${projectId}/tasks/${taskId}/attachments`).then((r) => r.data);

// ── Email Actions ─────────────────────────────────────────────────────────────

export const replyToEmail = (emailId, body) =>
  axiosInstance.post(`/emails/${emailId}/reply`, body).then((r) => r.data);

export const forwardEmail = (emailId, body) =>
  axiosInstance.post(`/emails/${emailId}/forward`, body).then((r) => r.data);

export const starEmail = (emailId) =>
  axiosInstance.post(`/emails/${emailId}/star`).then((r) => r.data);

export const archiveEmail = (emailId) =>
  axiosInstance.post(`/emails/${emailId}/archive`).then((r) => r.data);

// ── AI Draft Extractions ──────────────────────────────────────────────────────

export const saveDraftExtraction = (threadId, body) =>
  axiosInstance.post(`/threads/${threadId}/save-draft`, body).then((r) => r.data);

export const getThreadDraft = (threadId) =>
  axiosInstance.get(`/threads/${threadId}/draft`).then((r) => r.data);

export const confirmExtraction = (threadId, body) =>
  axiosInstance.post(`/threads/${threadId}/extract/confirm`, body).then((r) => r.data);

export const getThreadReviewItems = (threadId) =>
  axiosInstance.get(`/threads/${threadId}/review-items`).then((r) => r.data);

// ── Project Detail ────────────────────────────────────────────────────────────

export const getProject = (projectId) =>
  axiosInstance.get(`/projects/${projectId}`).then((r) => r.data);

export const getProjectReviewItems = (projectId, params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  return axiosInstance
    .get(`/projects/${projectId}/review-items${qs ? `?${qs}` : ""}`)
    .then((r) => r.data);
};

export const getProjectKanban = (projectId) =>
  axiosInstance.get(`/projects/${projectId}/kanban`).then((r) => r.data);

export const getProjectUpcomingDeadlines = (projectId, limit = 5) =>
  axiosInstance
    .get(`/projects/${projectId}/upcoming-deadlines?limit=${limit}`)
    .then((r) => r.data);

export const getProjectDecisions = (projectId) =>
  axiosInstance.get(`/projects/${projectId}/decisions`).then((r) => r.data);

export const getProjectStakeholders = (projectId) =>
  axiosInstance.get(`/stakeholders/projects/${projectId}`).then((r) => r.data);

export const updateProjectTaskStatus = (projectId, taskId, status) =>
  axiosInstance
    .patch(`/projects/${projectId}/tasks/${taskId}/status`, { status })
    .then((r) => r.data);
