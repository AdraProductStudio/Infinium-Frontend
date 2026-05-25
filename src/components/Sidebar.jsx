"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  RiLayoutGridLine,
  RiInboxLine,
  RiMapPinLine,
  RiBriefcase2Line,
  RiPriceTag3Line,
  RiSettingsLine,
} from "react-icons/ri";

function SidebarItem({ icon, label, active, badge, onClick }) {
  return (
    <div
      className={`sidebarItem ${active ? "sidebarItemActive" : ""}`}
      onClick={onClick}
    >
      <span className="sidebarIcon">{icon}</span>
      <span className="sidebarLabel">{label}</span>
      {badge !== undefined && <span className="sidebarBadge">{badge}</span>}
    </div>
  );
}

export default function Sidebar({ unreadCount, onSettingsClick }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebarLogo">
        <div className="logoIcon">
          <span className="logoSquare" />
        </div>
        <span className="logoText">Infinium</span>
      </div>

      <nav className="sidebarNav">
        <SidebarItem
          icon={<RiLayoutGridLine />}
          label="Portfolio"
          active={pathname === "/"}
        />
        <SidebarItem
          icon={<RiInboxLine />}
          label="Inbox"
          active={pathname === "/inbox"}
          badge={unreadCount}
          onClick={() => router.push("/inbox")}
        />
        <SidebarItem
          icon={<RiMapPinLine />}
          label="Sites"
          active={pathname.startsWith("/sites")}
          onClick={() => router.push("/sites")}
        />
        <SidebarItem icon={<RiBriefcase2Line />} label="My Work" />
        <SidebarItem icon={<RiPriceTag3Line />} label="Decisions" />
      </nav>

      <div className="sidebarBottom">
        <SidebarItem
          icon={<RiSettingsLine />}
          label="Settings"
          onClick={onSettingsClick}
        />
      </div>
    </aside>
  );
}
