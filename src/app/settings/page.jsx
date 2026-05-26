"use client";

import Sidebar from "../../components/Sidebar";
import "../sites/sites.css";

export default function SettingsPage() {
  return (
    <div className="sitesShell">
      <Sidebar />
      <main style={{
        gridArea: "main",
        padding: "2rem 2.5rem",
        background: "#f9fafb",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111827", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0 }}>Coming soon.</p>
      </main>
    </div>
  );
}
