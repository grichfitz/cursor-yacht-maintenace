import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import RequireRole from "../components/RequireRole"

import DashboardPage from "../pages/DashboardPage"
import TasksPage from "../pages/TasksPage"
import TaskPage from "../pages/TaskPage"
import YachtsPage from "../pages/YachtsPage"
import YachtPage from "../pages/YachtPage"
import ReportsPage from "../pages/ReportsPage"
import ProfilePage from "../pages/ProfilePage"
import UsersPage from "../pages/UsersPage"
import NewTaskPage from "../pages/NewTaskPage"

import EditorYachtsPage from "../pages/editor/EditorYachtsPage"
import EditorGroupsPage from "../pages/editor/EditorGroupsPage"
import EditorCategoriesPage from "../pages/editor/EditorCategoriesPage"
import EditorUserGroupsPage from "../pages/editor/EditorUserGroupsPage"
import EditorUserPage from "../pages/editor/EditorUserPage"
import EditorNewYachtPage from "../pages/editor/EditorNewYachtPage"
import EditorNewGroupPage from "../pages/editor/EditorNewGroupPage"
import EditorNewCategoryPage from "../pages/editor/EditorNewCategoryPage"
import EditorEditYachtPage from "../pages/editor/EditorEditYachtPage"
import EditorEditGroupPage from "../pages/editor/EditorEditGroupPage"
import EditorEditCategoryPage from "../pages/editor/EditorEditCategoryPage"
import EditorEditTaskPage from "../pages/editor/EditorEditTaskPage"
import TasksApp from "./TasksApp"

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
      <Route path="/apps/tasks/new" element={<Navigate to="/editor/tasks/new" replace />} />
      <Route path="/apps/tasks/:taskId" element={<Navigate to="/editor/tasks/:taskId" replace />} />
      <Route path="/apps/yachts" element={<Navigate to="/yachts" replace />} />
      <Route path="/apps/reports" element={<Navigate to="/reports" replace />} />
      <Route path="/apps/groups" element={<Navigate to="/editor/groups" replace />} />
      <Route path="/apps/categories" element={<Navigate to="/editor/categories" replace />} />
      <Route path="/assigments" element={<Navigate to="/dashboard" replace />} />

      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/:taskId" element={<TaskPage />} />

      <Route path="/yachts" element={<YachtsPage />} />
      <Route path="/yachts/:yachtId" element={<YachtPage />} />

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
      <Route path="/editor" element={<Navigate to="/editor/yachts" replace />} />
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
          <EditorRoute>
            <EditorNewGroupPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/groups/:groupId"
        element={
          <EditorRoute>
            <EditorEditGroupPage />
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
        path="/editor/categories/new"
        element={
          <EditorRoute>
            <EditorNewCategoryPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/categories/:categoryId"
        element={
          <EditorRoute>
            <EditorEditCategoryPage />
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

      {/* Task library editor */}
      <Route
        path="/editor/tasks"
        element={
          <EditorRoute>
            <TasksApp />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/tasks/new"
        element={
          <EditorRoute>
            <NewTaskPage />
          </EditorRoute>
        }
      />
      <Route
        path="/editor/tasks/:taskId"
        element={
          <EditorRoute>
            <EditorEditTaskPage />
          </EditorRoute>
        }
      />
      <Route path="/editor/task-templates" element={<Navigate to="/editor/yachts" replace />} />
      <Route path="/editor/task-templates/new" element={<Navigate to="/editor/yachts" replace />} />
      <Route path="/editor/task-templates/:templateId" element={<Navigate to="/editor/yachts" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}
