import { Routes, Route } from "react-router-dom";
import Desktop from "../app/Desktop";
import YachtsApp from "../app/YachtsApp";
import YachtDetailPage from "../pages/YachtDetailPage";
import TasksApp from "../app/TasksApp"
import TaskDetailPage from "../pages/TaskDetailPage";
import TaskCategoryAssignPage from "../pages/TaskCategoryAssignPage";
import CategoryEditorPage from "../pages/CategoryEditorPage";
import YachtCategoryAssignPage from "../pages/YachtGroupAssignPage"
import YachtGroupAssignPage from "../pages/YachtGroupAssignPage"


export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Desktop />} />
      <Route path="/desktop" element={<Desktop />} />
      <Route path="/apps/yachts" element={<YachtsApp />} />
      <Route path="/apps/yachts/:id" element={<YachtDetailPage />} />
      <Route path="/apps/tasks" element={<TasksApp />} />
      <Route path="/apps/tasks/:taskId" element={<TaskDetailPage />} />
      <Route path="/apps/tasks/:taskId/categories" element={<TaskCategoryAssignPage />} />
      <Route path="/categories/:categoryId" element={<CategoryEditorPage />} />
      <Route
  path="/yachts/:yachtId/categories"
  element={<YachtCategoryAssignPage />}
/>
<Route
  path="/yachts/:yachtId/groups"
  element={<YachtGroupAssignPage />}
/>

    </Routes>
  );
}
