import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Ship,
  Users,
  BarChart2,
} from "lucide-react";

type DesktopApp = {
  id: string;
  name: string;
  icon: React.ReactNode;
  route: string;
};

const APPS: DesktopApp[] = [
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
    id: "users",
    name: "Users",
    icon: <Users size={28} />,
    route: "/apps/users",
  },
  {
    id: "reports",
    name: "Reports",
    icon: <BarChart2 size={28} />,
    route: "/apps/reports",
  },
];

export default function Desktop() {
  const navigate = useNavigate();

  return (
    <div className="desktop">
      <div className="desktop-grid">
        {APPS.map((app) => (
          <button
            key={app.id}
            className="desktop-app"
            onClick={() => navigate(app.route)}
          >
            <div className="desktop-app-icon">
              {app.icon}
            </div>
            <span className="desktop-app-label">
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
