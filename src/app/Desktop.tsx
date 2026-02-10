import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Ship,
  Users,
  BarChart2,
  User,
  Folder,
  Tags,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type DesktopApp = {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
};

export default function Desktop() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_role_links")
        .select("roles(name)")
        .eq("user_id", user.id);

      if (!cancelled) {
        if (error) {
          setIsAdmin(false);
          return;
        }
        const admin =
          (data as any[])?.some(
            (r: any) => r?.roles?.name?.toLowerCase() === "admin"
          ) ?? false;
        setIsAdmin(admin);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const apps: DesktopApp[] = useMemo(() => {
    const base: DesktopApp[] = [
      {
        id: "tasks",
        name: "Tasks",
        icon: <CheckSquare size={28} />,
        route: "/apps/tasks",
      },
      {
        id: "yachts",
        name: "Yachts",
        icon: <Ship size={28} />,
        route: "/apps/yachts",
      },
      {
        id: "profile",
        name: "Profile",
        icon: <User size={28} />,
        route: "/profile",
      },
    ];

    if (isAdmin) {
      base.push({
        id: "users",
        name: "Users",
        icon: <Users size={28} />,
        route: "/apps/users",
      });
    }

    if (isAdmin) {
      base.push({
        id: "groups",
        name: "Groups",
        icon: <Folder size={28} />,
        route: "/apps/groups",
      })
      base.push({
        id: "categories",
        name: "Categories",
        icon: <Tags size={28} />,
        route: "/apps/categories",
      })
    }

    // Keep Reports placeholder (admin-only for now).
    if (isAdmin) {
      base.push({
        id: "reports",
        name: "Reports",
        icon: <BarChart2 size={28} />,
        route: "/apps/reports",
      });
    }

    return base;
  }, [isAdmin]);

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
