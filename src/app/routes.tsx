import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import RequireRole from "../components/RequireRole"

import DashboardPage from "../pages/DashboardPage"
import TasksPage from "../pages/TasksPage"
import TaskInstancePage from "../pages/TaskInstancePage"
import YachtsPage from "../pages/YachtsPage"
import YachtPage from "../pages/YachtPage"
import ReportsPage from "../pages/ReportsPage"
import ProfilePage from "../pages/ProfilePage"

import EditorYachtsPage from "../pages/editor/EditorYachtsPage"
import EditorGroupsPage from "../pages/editor/EditorGroupsPage"
import EditorCategoriesPage from "../pages/editor/EditorCategoriesPage"
import EditorTaskTemplatesPage from "../pages/editor/EditorTaskTemplatesPage"

function EditorRoute({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={["admin"]}>{children}</RequireRole>
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
      <Route path="/apps/yachts" element={<Navigate to="/yachts" replace />} />
      <Route path="/apps/reports" element={<Navigate to="/reports" replace />} />
      <Route path="/apps/groups" element={<Navigate to="/editor/groups" replace />} />
      <Route path="/apps/categories" element={<Navigate to="/editor/categories" replace />} />

      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/:taskInstanceId" element={<TaskInstancePage />} />

      <Route path="/yachts" element={<YachtsPage />} />
      <Route path="/yachts/:yachtId" element={<YachtPage />} />

      <Route path="/reports" element={<ReportsRoute />} />

      <Route path="/profile" element={<ProfilePage />} />

      {/* Admin-only Editor */}
      <Route path="/editor" element={<Navigate to="/editor/yachts" replace />} />
      <Route
        path="/editor/yachts"
        element={
          <EditorRoute>
            <EditorYachtsPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/groups"
        element={
          <EditorRoute>
            <EditorGroupsPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/categories"
        element={
          <EditorRoute>
            <EditorCategoriesPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/task-templates"
        element={
          <EditorRoute>
            <EditorTaskTemplatesPage />
          </EditorRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}
