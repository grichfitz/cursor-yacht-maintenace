// src/app/AppShell.tsx

import React from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Ship, CheckSquare, User, Search, Zap } from "lucide-react";
import "../App.css";

type AppShellProps = {
  children: ReactNode;
  contentClassName?: string;
  showTabs?: boolean;
  showTopbar?: boolean;
};

export default function AppShell({
  children,
  contentClassName,
  showTabs = true,
  showTopbar = true,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  // Only highlight tabs for the primary app areas.
  // For "editor" / assignment screens (e.g. /groups/*, /categories/*, /yachts/*),
  // we leave all tabs un-highlighted (neutral grey).
  const activeTab:
    | "dashboard"
    | "yachts"
    | "tasks"
    | "profile"
    | null =
    pathname === "/" || pathname.startsWith("/desktop") ? "dashboard"
    : pathname.startsWith("/apps/yachts") ? "yachts"
    : pathname.startsWith("/apps/tasks") ? "tasks"
    : pathname.startsWith("/profile") || pathname.startsWith("/more") ? "profile"
    : null;

  return (
    <div className="app">
      {showTopbar && (
        <header className="topbar">
          <div className="topbar-left">
            <Zap size={18} />
            <span className="topbar-brand">Yacht Maintenance</span>
          </div>

          <button
            className="topbar-icon"
            type="button"
            aria-label="Search"
            onClick={() => {
              // Placeholder: future global search
            }}
          >
            <Search size={18} />
          </button>
        </header>
      )}

      {/* Main Content */}
      <main className={`app-content ${contentClassName ?? ""}`.trim()}>
        {children}
      </main>

      {showTabs && (
        <nav className="tabbar" aria-label="Primary">
          <button
            type="button"
            className={`tabbar-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => navigate("/desktop")}
          >
            <Home size={20} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`tabbar-item ${activeTab === "yachts" ? "active" : ""}`}
            onClick={() => navigate("/apps/yachts")}
          >
            <Ship size={20} />
            <span>Yachts</span>
          </button>

          <button
            type="button"
            className={`tabbar-item ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => navigate("/apps/tasks")}
          >
            <CheckSquare size={20} />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            className={`tabbar-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => navigate("/profile")}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}
