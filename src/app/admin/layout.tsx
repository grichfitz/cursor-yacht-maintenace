import React from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { Users, FolderTree, ArrowLeft } from "lucide-react"
import "../../styles/adminConsole.css"
import { AdminToastProvider } from "../../components/admin/Toast"

type AdminLayoutProps = {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const title =
    pathname.startsWith("/admin/groups") ? "Groups"
    : pathname.startsWith("/admin/users") ? "Users"
    : "Admin"

  return (
    <AdminToastProvider>
      <div className="admin-root">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">Enterprise Admin Console</div>
          <nav className="admin-nav" aria-label="Admin">
            <NavLink to="/admin/groups">
              {({ isActive }) => (
                <div className={`admin-nav-item ${isActive ? "active" : ""}`.trim()}>
                  <FolderTree size={16} />
                  <span>Groups</span>
                </div>
              )}
            </NavLink>

            <NavLink to="/admin/users">
              {({ isActive }) => (
                <div className={`admin-nav-item ${isActive ? "active" : ""}`.trim()}>
                  <Users size={16} />
                  <span>Users</span>
                </div>
              )}
            </NavLink>
          </nav>
        </aside>

        <section className="admin-content">
          <header className="admin-content-header">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="admin-content-title">{title}</div>
              <div className="admin-content-subtitle">
                RLS-authoritative. No client-side access logic.
              </div>
            </div>

            <button
              type="button"
              className="admin-button"
              onClick={() => navigate(-1)}
              title="Back"
              aria-label="Back"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </span>
            </button>
          </header>

          {children}
        </section>
      </div>
    </AdminToastProvider>
  )
}

