import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import React from "react";

import AppShell from "./app/AppShell";
import LoginPage from "./pages/LoginPage";
import AppRoutes from "./app/routes";
import { useSession } from "./auth/SessionProvider";

export default function App() {
  const { session, loading } = useSession();

  const navigate = useNavigate();
  const location = useLocation();
  const isAdminConsole = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  useEffect(() => {
    if (!loading && session && location.pathname === "/") {
      navigate("/dashboard", { replace: true });
    }
  }, [session, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <AppShell showTabs={false}>
        <div style={{ padding: 20 }}>Loading…</div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell showTabs={false} contentClassName="app-content--auth">
        <LoginPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      showTabs={!isAdminConsole}
      showTopbar={!isAdminConsole}
      variant={isAdminConsole ? "admin" : "mobile"}
      contentClassName={isAdminConsole ? "app-content--admin" : undefined}
    >
      <AppRoutes />
    </AppShell>
  );
}
