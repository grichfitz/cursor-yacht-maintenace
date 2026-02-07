import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import React from "react";
import AppShell from "./app/AppShell";
import LoginPage from "./pages/LoginPage";
import AppRoutes from "./app/routes";



export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ ONLY redirect after login if we're still on "/"
  useEffect(() => {
    if (session && location.pathname === "/") {
      navigate("/desktop", { replace: true });
    }
  }, [session, location.pathname, navigate]);

  if (loading) {
    return (
      <AppShell showLogout={false}>
        <div style={{ padding: 20 }}>Loading…</div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell showLogout={false} contentClassName="app-content--auth">
        <LoginPage />
      </AppShell>
    );
  }

  return (
    <AppShell showLogout={true}>
      <AppRoutes />
    </AppShell>
  );
}
