// src/app/AppShell.tsx

import React from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import "../App.css";

type AppShellProps = {
  children: ReactNode;
  showLogout?: boolean;
  contentClassName?: string;
};

export default function AppShell({
  children,
  showLogout = false,
  contentClassName,
}: AppShellProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header app-header-centered">
        <span className="app-title">Yacht Maintenance</span>
      </header>

      {/* Main Content */}
      <main className={`app-content ${contentClassName ?? ""}`.trim()}>
        {children}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span className="footer-brand">© Worthy Marine</span>

        {showLogout && (
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </footer>
    </div>
  );
}
