import { Routes, Route } from "react-router-dom";
import Desktop from "../app/Desktop";
import YachtsApp from "../app/YachtsApp";
import YachtDetailPage from "../pages/YachtDetailPage";
import NewYachtPage from "../pages/NewYachtPage"
import UsersApp from "../app/UsersApp"
import NewUserPage from "../pages/NewUserPage"
import TasksApp from "../app/TasksApp"
import TaskDetailPage from "../pages/TaskDetailPage";
import NewTaskPage from "../pages/NewTaskPage"
import TaskCategoryAssignPage from "../pages/TaskCategoryAssignPage";
import CategoryEditorPage from "../pages/CategoryEditorPage";
import YachtGroupAssignPage from "../pages/YachtGroupAssignPage"
import GroupEditorPage from "../pages/GroupEditorPage"
import UserDetailPage from "../pages/UserDetailPage"
import UserGroupAssignPage from "../pages/UserGroupAssignPage"
import React from "react";


export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Desktop />} />
      <Route path="/desktop" element={<Desktop />} />
      <Route path="/apps/yachts" element={<YachtsApp />} />
      <Route path="/apps/yachts/new" element={<NewYachtPage />} />
      <Route path="/apps/yachts/:id" element={<YachtDetailPage />} />
      <Route path="/apps/users" element={<UsersApp />} />
      <Route path="/apps/users/new" element={<NewUserPage />} />
      <Route path="/apps/users/:userId" element={<UserDetailPage />} />
      <Route path="/apps/tasks" element={<TasksApp />} />
      <Route path="/apps/tasks/new" element={<NewTaskPage />} />
      <Route path="/apps/tasks/:taskId" element={<TaskDetailPage />} />
      <Route path="/apps/tasks/:taskId/categories" element={<TaskCategoryAssignPage />} />
      <Route path="/categories/:categoryId" element={<CategoryEditorPage />} />
      <Route path="/yachts/:yachtId/groups" element={<YachtGroupAssignPage />} />
      <Route path="/users/:userId/groups" element={<UserGroupAssignPage />} />
      <Route path="/groups/:groupId" element={<GroupEditorPage />} />

    </Routes>
  );
}
