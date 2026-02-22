import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import RequireRole from "../components/RequireRole"

import DashboardPage from "../pages/DashboardPage"
import TasksPage from "../pages/TasksPage"
import YachtsPage from "../pages/YachtsPage"
import YachtPage from "../pages/YachtPage"
import ReportsPage from "../pages/ReportsPage"
import ProfilePage from "../pages/ProfilePage"
import UsersPage from "../pages/UsersPage"

import EditorYachtsPage from "../pages/editor/EditorYachtsPage"
import EditorGroupsPage from "../pages/editor/EditorGroupsPage"
import EditorUserGroupsPage from "../pages/editor/EditorUserGroupsPage"
import EditorUserPage from "../pages/editor/EditorUserPage"
import EditorNewYachtPage from "../pages/editor/EditorNewYachtPage"
import EditorNewGroupPage from "../pages/editor/EditorNewGroupPage"
import EditorEditYachtPage from "../pages/editor/EditorEditYachtPage"
import EditorEditGroupPage from "../pages/editor/EditorEditGroupPage"
import { useMyRole } from "../hooks/useMyRole"
import BlueprintPage from "../v21/blueprint/BlueprintPage"
import AssignmentPage from "../v21/assignments/AssignmentPage"
import YachtTasksPage from "../v21/yachtTasks/YachtTasksPage"
import AdminGroupsPage from "./admin/groups/page"
import AdminUsersPage from "./admin/users/page"
import AdminLayout from "./admin/layout"

function EditorRoute({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={["admin"]}>{children}</RequireRole>
}

function EditorRouteAdminOrManager({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={["admin", "manager"]}>{children}</RequireRole>
}

function EditorHomeRedirect() {
  const { role, loading } = useMyRole()
  if (loading) return <div className="screen">Loading…</div>
  if (role === "admin") return <Navigate to="/editor/blueprint" replace />
  if (role === "manager") return <Navigate to="/editor/assignments" replace />
  return <Navigate to="/dashboard" replace />
}

function ReportsRoute() {
  return (
    <RequireRole allow={["admin", "manager"]}>
      <ReportsPage />
    </RequireRole>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/desktop" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      {/* Back-compat redirects (old app URLs) */}
      <Route path="/apps" element={<Navigate to="/dashboard" replace />} />
      <Route path="/apps/tasks" element={<Navigate to="/tasks" replace />} />
      <Route path="/apps/tasks/new" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/apps/tasks/:taskId" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/apps/yachts" element={<Navigate to="/yachts" replace />} />
      <Route path="/apps/reports" element={<Navigate to="/reports" replace />} />
      <Route path="/apps/groups" element={<Navigate to="/editor/groups" replace />} />
      <Route path="/apps/categories" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/assigments" element={<Navigate to="/dashboard" replace />} />

      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/:taskId" element={<Navigate to="/tasks" replace />} />

      <Route path="/yachts" element={<YachtsPage />} />
      <Route path="/yachts/:yachtId" element={<YachtPage />} />
      <Route path="/yachts/:yachtId/tasks" element={<YachtTasksPage />} />

      <Route path="/reports" element={<ReportsRoute />} />

      <Route path="/profile" element={<ProfilePage />} />

      {/* Legacy template subsystem removed (canonical v2) */}
      <Route path="/templates" element={<Navigate to="/dashboard" replace />} />
      <Route path="/templates/:id" element={<Navigate to="/dashboard" replace />} />
      <Route path="/assignments" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/users"
        element={
          <EditorRoute>
            <UsersPage />
          </EditorRoute>
        }
      />
      <Route
        path="/users/:userId"
        element={
          <EditorRoute>
            <EditorUserPage />
          </EditorRoute>
        }
      />
      <Route
        path="/users/:userId/groups"
        element={
          <EditorRoute>
            <EditorUserGroupsPage />
          </EditorRoute>
        }
      />

      {/* Admin-only Editor */}
      <Route path="/editor" element={<EditorHomeRedirect />} />
      <Route
        path="/editor/yachts/new"
        element={
          <EditorRoute>
            <EditorNewYachtPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/yachts/:yachtId"
        element={
          <EditorRoute>
            <EditorEditYachtPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/yachts"
        element={
          <EditorRoute>
            <EditorYachtsPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/groups/new"
        element={
          <EditorRouteAdminOrManager>
            <EditorNewGroupPage />
          </EditorRouteAdminOrManager>
        }
      />
      <Route
        path="/editor/groups/:groupId"
        element={
          <EditorRouteAdminOrManager>
            <EditorEditGroupPage />
          </EditorRouteAdminOrManager>
        }
      />
      <Route
        path="/editor/groups"
        element={
          <EditorRouteAdminOrManager>
            <EditorGroupsPage />
          </EditorRouteAdminOrManager>
        }
      />
      <Route
        path="/editor/blueprint"
        element={
          <EditorRoute>
            <BlueprintPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/assignments"
        element={
          <EditorRouteAdminOrManager>
            <AssignmentPage />
          </EditorRouteAdminOrManager>
        }
      />
      {/* Legacy task/category editor routes discarded (v2.1) */}
      <Route path="/editor/categories" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/editor/categories/new" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/editor/categories/:categoryId" element={<Navigate to="/editor/blueprint" replace />} />

      <Route path="/editor/tasks" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/editor/tasks/new" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/editor/tasks/:taskId" element={<Navigate to="/editor/blueprint" replace />} />
      <Route path="/editor/task-templates" element={<Navigate to="/editor/yachts" replace />} />
      <Route path="/editor/task-templates/new" element={<Navigate to="/editor/yachts" replace />} />
      <Route path="/editor/task-templates/:templateId" element={<Navigate to="/editor/yachts" replace />} />

      {/* Enterprise Admin Console v2.1 (parallel UI; RLS authoritative) */}
      <Route path="/admin" element={<Navigate to="/admin/groups" replace />} />
      <Route
        path="/admin/groups"
        element={
          <AdminLayout>
            <AdminGroupsPage />
          </AdminLayout>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminLayout>
            <AdminUsersPage />
          </AdminLayout>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}
