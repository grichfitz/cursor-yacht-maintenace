import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Ship,
  BarChart2,
  User,
  Wrench,
} from "lucide-react";
import { useMyRole } from "../hooks/useMyRole";

type DesktopApp = {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
};

export default function Desktop() {
  const navigate = useNavigate();
  const { role, loading } = useMyRole();

  const apps: DesktopApp[] = useMemo(() => {
    const base: DesktopApp[] = [
      {
        id: "tasks",
        name: "Tasks",
        icon: <CheckSquare size={28} />,
        route: "/tasks",
      },
      {
        id: "yachts",
        name: "Yachts",
        icon: <Ship size={28} />,
        route: "/yachts",
      },
      {
        id: "profile",
        name: "Profile",
        icon: <User size={28} />,
        route: "/profile",
      },
    ];

    if (role === "manager" || role === "admin") {
      base.push({
        id: "reports",
        name: "Reports",
        icon: <BarChart2 size={28} />,
        route: "/reports",
      });
    }

    if (role === "admin") {
      base.push({
        id: "editor",
        name: "Editor",
        icon: <Wrench size={28} />,
        route: "/editor/yachts",
      });
    }

    return base;
  }, [role]);

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Dashboard</div>

      <div className="desktop-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            className="desktop-app"
            onClick={() => navigate(app.route)}
          >
            <div className="desktop-app-icon">{app.icon}</div>
            <span className="desktop-app-label">{app.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
