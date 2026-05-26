"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { sha256 } from "js-sha256";
import { validateInviteToken, acceptInvite, setTokens } from "../../../lib/api";

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = useParams();

  const [status,   setStatus]   = useState("loading"); // loading | ready | invalid | expired | done
  const [info,     setInfo]     = useState(null);       // { name, email }
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!token) return;
    validateInviteToken(token)
      .then((res) => {
        setInfo(res?.data || res);
        setStatus("ready");
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err.message || "";
        setStatus(msg.toLowerCase().includes("expired") ? "expired" : "invalid");
      });
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const res = await acceptInvite(token, sha256(password));
      const tokens = res?.data || res;
      setTokens(tokens.access_token, tokens.refresh_token);
      setStatus("done");
      const dest = tokens.role === "admin" ? "/sites" : "/stakeholder";
      setTimeout(() => router.push(dest), 1800);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="invitePage">
      <div className="inviteCard">
        <div className="inviteLogo">
          <div className="inviteLogoIcon" />
          <span className="inviteLogoText">Infinium</span>
        </div>

        {status === "loading" && (
          <p className="inviteSubtitle">Verifying your invite link…</p>
        )}

        {status === "invalid" && (
          <>
            <h1 className="inviteTitle">Link not found</h1>
            <p className="inviteSubtitle">
              This invite link is invalid. Please ask your builder to send a new one.
            </p>
          </>
        )}

        {status === "expired" && (
          <>
            <h1 className="inviteTitle">Link expired</h1>
            <p className="inviteSubtitle">
              This invite link has expired (links are valid for 7 days).
              Please ask your builder to resend the invite.
            </p>
          </>
        )}

        {status === "done" && (
          <>
            <div className="inviteSuccessIcon">✓</div>
            <h1 className="inviteTitle">You're all set!</h1>
            <p className="inviteSubtitle">Account activated. Redirecting you now…</p>
          </>
        )}

        {status === "ready" && info && (
          <>
            <h1 className="inviteTitle">Set your password</h1>
            <p className="inviteSubtitle">
              Welcome, <strong>{info.name}</strong>. Create a password to activate your account.
            </p>

            <div className="inviteEmailRow">
              <span className="inviteEmailLabel">Signing in as</span>
              <span className="inviteEmail">{info.email}</span>
            </div>

            {error && <div className="inviteError">{error}</div>}

            <form onSubmit={handleSubmit} className="inviteForm">
              <div className="inviteField">
                <label className="inviteLabel">Password</label>
                <div className="inviteInputWrap">
                  <input
                    type={showPw ? "text" : "password"}
                    className="inviteInput"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" className="inviteEyeBtn" onClick={() => setShowPw((v) => !v)}>
                    {showPw ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="inviteField">
                <label className="inviteLabel">Confirm password</label>
                <input
                  type={showPw ? "text" : "password"}
                  className="inviteInput"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="inviteSubmitBtn" disabled={saving}>
                {saving ? "Activating…" : "Activate account"}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        .invitePage {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
          padding: 1.5rem;
          font-family: var(--font-inter), Inter, sans-serif;
        }
        .inviteCard {
          background: #fff;
          border: 0.062rem solid #e5e7eb;
          border-radius: 0.875rem;
          padding: 2.5rem 2.25rem;
          width: 100%;
          max-width: 26.25rem;
        }
        .inviteLogo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 1.75rem;
        }
        .inviteLogoIcon {
          width: 1.75rem;
          height: 1.75rem;
          background: #111827;
          border-radius: 0.438rem;
          position: relative;
        }
        .inviteLogoIcon::after {
          content: "";
          position: absolute;
          inset: 0.438rem;
          background: #fff;
          border-radius: 0.125rem;
        }
        .inviteLogoText {
          font-size: 0.875rem;
          font-weight: 700;
          color: #111827;
        }
        .inviteTitle {
          font-size: 1.375rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 0.25rem;
        }
        .inviteSubtitle {
          font-size: 0.844rem;
          color: #6b7280;
          margin: 0 0 1.25rem;
          line-height: 1.5;
        }
        .inviteEmailRow {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f9fafb;
          border: 0.062rem solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          margin-bottom: 1.25rem;
        }
        .inviteEmailLabel {
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
        }
        .inviteEmail {
          font-size: 0.812rem;
          font-weight: 500;
          color: #111827;
        }
        .inviteError {
          background: #fee2e2;
          border: 0.062rem solid #fca5a5;
          color: #991b1b;
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.812rem;
          margin-bottom: 1rem;
        }
        .inviteForm {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .inviteField {
          display: flex;
          flex-direction: column;
          gap: 0.312rem;
        }
        .inviteLabel {
          font-size: 0.812rem;
          font-weight: 500;
          color: #374151;
        }
        .inviteInputWrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .inviteInputWrap .inviteInput {
          padding-right: 2.5rem;
        }
        .inviteInput {
          width: 100%;
          border: 0.062rem solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.562rem 0.75rem;
          font-size: 0.844rem;
          color: #111827;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .inviteInput:focus { border-color: #2563eb; box-shadow: 0 0 0 0.188rem rgba(37,99,235,0.1); }
        .inviteInput::placeholder { color: #9ca3af; }
        .inviteEyeBtn {
          position: absolute;
          right: 0.625rem;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #9ca3af;
          display: flex;
          align-items: center;
        }
        .inviteEyeBtn:hover { color: #6b7280; }
        .inviteEyeBtn svg { width: 1.125rem; height: 1.125rem; }
        .inviteSubmitBtn {
          width: 100%;
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          padding: 0.625rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.15s;
          margin-top: 0.25rem;
        }
        .inviteSubmitBtn:hover:not(:disabled) { background: #1f2937; }
        .inviteSubmitBtn:disabled { opacity: 0.6; cursor: not-allowed; }
        .inviteSuccessIcon {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: #d1fae5;
          color: #065f46;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
