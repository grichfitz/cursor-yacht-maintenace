# YM v2.1 Frontend Rebuild Report
Task System + Categories + Admin + Management Editors  
Strict LAW compliance mode (frontend reflects authority; backend enforces authority via RLS/RPC)

Generated: 2026-02-19

---

## 1) Authoritative contracts used

### 1.1 Database schema contract (v2.1)
Implemented against the **v2.1 table names and columns only**:
- `global_categories`
- `task_templates`
- `task_assignments` (enforces scope check: group XOR yacht)
- `task_incidents` with enum `task_incident_status` = `pending|completed|cancelled`

No legacy table names are used for the rebuilt subsystem (`tasks`, `categories`, `templates`, etc. are no longer part of the v2.1 task/category UX surface).

### 1.2 RPC contract (v2.1, authoritative)
All propagation and override creation are RPC-driven as required:
1) **Assign Single Template → Group**
- `assign_global_template_to_group(p_template_id uuid, p_group_id uuid, p_override_existing boolean)`

2) **Assign Category Subtree → Group (single call; backend resolves recursion)**
- `assign_global_category_subtree_to_group(p_category_id uuid, p_group_id uuid, p_override_existing boolean)`

3) **Assign Template → Yacht**
- `assign_global_template_to_yacht(p_template_id uuid, p_yacht_id uuid, p_override_existing boolean)`

4) **Create Yacht Override (Fork)**
- `create_yacht_assignment_override(p_parent_assignment_id uuid, p_yacht_id uuid)`

5) **Create Incident**
- `create_task_incident(p_assignment_id uuid, p_yacht_id uuid, p_due_date date)`

6) **Incident completion**
- Direct table update is allowed:
  - `.from("task_incidents").update({ status: "completed", completed_at: nowIso })`
  - RLS enforces who can do it (crew/manager/admin), and owner cannot.

---

## 2) New routes (authoritative)

Legacy editor routes are discarded and redirected:
- `/editor/tasks` → `/editor/blueprint`
- `/editor/categories` → `/editor/blueprint`
- `/editor/tasks/new` → `/editor/blueprint`
- `/editor/tasks/:taskId` → `/editor/blueprint`
- `/editor/categories/new` → `/editor/blueprint`
- `/editor/categories/:categoryId` → `/editor/blueprint`

New v2.1 routes:
- **Admin Blueprint**: `/editor/blueprint`
- **Management Assignments**: `/editor/assignments`
- **Yacht incidents**: `/yachts/:yachtId/tasks`

Also updated legacy “task detail” route:
- `/tasks/:taskId` now redirects → `/tasks`

Primary routes file updated:
- `src/app/routes.tsx`

---

## 3) Role handling updates (frontend reflection only)

### 3.1 Added Owner to role union
Updated role type to include `owner` so the UI can correctly present read-only behavior where needed:
- `src/hooks/useMyRole.ts`
  - `AppRole` now includes `"owner"`
  - Role normalization accepts `owner` returned from `current_user_role()`

### 3.2 Route guards
Existing `RequireRole` is still the only client-side “guard”; it does **not** implement security, it only reflects it.
- Admin-only: `/editor/blueprint`
- Admin+manager: `/editor/assignments`
- Crew/owner never receive write controls in editor pages

---

## 4) Admin Blueprint UI (Global Blueprint Layer)

### 4.1 Goal
Build a clean “GLOBAL BLUEPRINT MODE” admin-only editor that manipulates:
- `global_categories` (hierarchical via `parent_category_id`)
- `task_templates` (belongs to `global_categories` via `global_category_id`)

No group context. No yacht context. No assignment logic.

### 4.2 Files added
Blueprint module (new):
- `src/v21/blueprint/BlueprintPage.tsx`
- `src/v21/blueprint/CategoryTree.tsx`
- `src/v21/blueprint/TemplatePanel.tsx`
- `src/v21/blueprint/TemplateEditorModal.tsx`
- `src/v21/blueprint/types.ts`

Shared utilities/UI:
- `src/v21/ui/Modal.tsx`
- `src/v21/utils/jsonText.ts`

### 4.3 Blueprint features implemented
#### Global Category Tree (`global_categories`)
- Recursive tree view (uses existing `TreeDisplay` component for consistent UI)
- Expand/collapse
- Add root category
- Add child category
- Rename (inline edit controls)
- Archive/unarchive (`archived_at`)
- Delete only when **no children** are present
  - (UI disables delete when children exist; DB still enforces true constraints)

#### Task Template Editor (`task_templates`)
Within selected category:
- List templates
- Create template (modal)
- Edit template fields:
  - `name`
  - `description`
  - `period`
  - `metadata` (JSON)
- Archive/unarchive (`archived_at`)
- Delete template

All reads/writes are direct table operations, with RLS enforcing admin-only writes.

---

## 5) Management Assignments UI (Operational Layer)

### 5.1 Goal
Context-driven assignment UI:
- User chooses **group OR yacht** (never both)
- Blueprint browsing is read-only
- Assignment creation and propagation is **RPC-only**
- Assignment reads are direct table reads under RLS
- Override creation is **RPC-only**

### 5.2 Files added
- `src/v21/assignments/AssignmentPage.tsx`
- `src/v21/assignments/ContextSelector.tsx`
- `src/v21/assignments/BlueprintBrowser.tsx`
- `src/v21/assignments/AssignmentList.tsx`
- `src/v21/assignments/AssignmentEditorModal.tsx`
- `src/v21/assignments/PropagationConfirmModal.tsx`
- `src/v21/assignments/types.ts`

### 5.3 Assignment creation (RPC-driven; no client subtree enumeration)
#### Step flow implemented
1) Select scope:
   - Group scope (`group_id` set, `yacht_id` null)
   - Yacht scope (`yacht_id` set, `group_id` null)
2) Browse blueprint (read-only):
   - Select single template OR category subtree
3) Confirmation modal:
   - Target scope
   - “Affected yachts” shown as:
     - `1` for yacht scope
     - `—` for group scope (true subtree count must be backend-owned)
   - Override existing checkbox → maps to `p_override_existing`
4) Execute:
   - Group + single template → `assign_global_template_to_group(...)`
   - Group + subtree → `assign_global_category_subtree_to_group(...)` (single call)
   - Yacht + single template → `assign_global_template_to_yacht(...)`
   - Yacht + subtree is disabled (no RPC contract for it)

**Important**: The frontend does not:
- Enumerate subtree categories/templates for propagation
- Loop templates for propagation
- Manually insert assignments

### 5.4 Assignment list view (direct reads; RLS-scoped)
Within the selected scope, the UI reads:
- `task_assignments` filtered by:
  - `.eq("group_id", selectedGroupId).is("yacht_id", null)` OR
  - `.eq("yacht_id", selectedYachtId).is("group_id", null)`

Displays:
- Assignment `name`
- Source template (resolved by `template_id` → `task_templates.name` in-memory mapping)
- Override badge (`is_override`)
- Archived/active (`archived_at`)
- Lineage badges:
  - Inherited: yacht assignment + `parent_assignment_id` + `is_override=false`
  - Overridden: yacht assignment + `parent_assignment_id` + `is_override=true`
  - Detached: yacht assignment + `parent_assignment_id` null

Edit controls:
- Admin/Manager: can open editor modal
- Crew/Owner: read-only

### 5.5 Override / fork creation (RPC-only)
When editing a yacht assignment that is inherited, the modal presents:
- “Override from Group”
- “Create override fork”

Button calls:
- `create_yacht_assignment_override(p_parent_assignment_id, p_yacht_id)`

**Frontend does not clone assignment rows** or set `parent_assignment_id` itself.

---

## 6) Yacht Tasks (Incidents)

### 6.1 Goal
Inside yacht context, display and manage task incidents from `task_incidents` (not legacy tasks).

### 6.2 Files added
- `src/v21/yachtTasks/YachtTasksPage.tsx`
- `src/v21/yachtTasks/IncidentList.tsx`
- `src/v21/yachtTasks/IncidentEditor.tsx`
- `src/v21/yachtTasks/types.ts`

### 6.3 Route
- `/yachts/:yachtId/tasks` → `YachtTasksPage`

### 6.4 Incident list behavior
Reads:
- `task_incidents` filtered by yacht:
  - `.eq("yacht_id", yachtId)`

Displays:
- Assignment name (resolved by reading `task_assignments` for referenced `assignment_id`s)
- Due date
- Status
- Completed fields (if present)

### 6.5 Incident creation (RPC-only)
Admin/Manager can create an incident:
- Calls `create_task_incident(p_assignment_id, p_yacht_id, p_due_date)`

**Frontend does not insert** into `task_incidents` directly.

Assignment picker includes:
- Yacht assignments (`task_assignments.yacht_id = yachtId`)
- Group assignments for the yacht’s group (`task_assignments.group_id = yacht.group_id`)
  - Combined via `.or("yacht_id.eq.<y>,group_id.eq.<g>")`

### 6.6 Incident completion (direct update allowed)
Crew/Manager/Admin can mark complete:
- Direct update:
  - `.update({ status: "completed", completed_at: nowIso })`
  - RLS is expected to enforce role constraints (owner cannot complete).

### 6.7 Incident status management
Admin/Manager can edit an incident and set status:
- pending/completed/cancelled

---

## 7) Rewired “My Tasks” and Dashboard to v2.1 incidents

### 7.1 `/tasks` (My Tasks)
Updated to list `task_incidents` (RLS-scoped) and route into `/yachts/:yachtId/tasks` rather than legacy task detail.
- Updated file: `src/pages/TasksPage.tsx`

It reads:
- `task_incidents` (limited list)
- `yachts` (name mapping)
- `task_assignments` (assignment name mapping)

### 7.2 Dashboard widgets
Updated “Task counts”, “Upcoming”, and “Overdue” to use `task_incidents`.
- Updated file: `src/pages/DashboardPage.tsx`

Filtering:
- Overdue/upcoming uses `due_date` compared to today’s date string, and only pending incidents are shown.

### 7.3 Yacht summary page
Updated yacht detail to show incidents list derived from `task_incidents` (and link to yacht tasks page).
- Updated file: `src/pages/YachtPage.tsx`

---

## 8) Navigation updates

### 8.1 Editor navigation
Updated editor nav to replace legacy Tasks/Categories entries with:
- Blueprint (`/editor/blueprint`) — admin-only
- Assignments (`/editor/assignments`) — admin+manager

File updated:
- `src/pages/editor/EditorNav.tsx`

### 8.2 Editor home redirect
Updated `/editor` landing behavior:
- Admin → `/editor/blueprint`
- Manager → `/editor/assignments`

File updated:
- `src/app/routes.tsx`

---

## 9) Legacy UI retired (redirected; not used for v2.1)

The following legacy editor routes/pages remain in the repo but are no longer reachable from routes:
- `src/app/TasksApp.tsx`
- `src/hooks/useTaskTree.ts`
- `src/pages/NewTaskPage.tsx`
- `src/pages/TaskPage.tsx` (route removed; now redirected)
- `src/pages/editor/EditorEditTaskPage.tsx`
- `src/pages/editor/EditorCategoriesPage.tsx`
- `src/pages/editor/EditorNewCategoryPage.tsx`
- `src/pages/editor/EditorEditCategoryPage.tsx`

All editor entry points `/editor/tasks*` and `/editor/categories*` now redirect to `/editor/blueprint`.

---

## 10) Security / compliance notes

### 10.1 Frontend does not simulate security
- No “fetch all then filter” for assignments/incidents.
- No client-side branch-tree computation for access control.
- All scoping is done by:
  - direct `eq(...)` filters for selected scope (group/yacht)
  - plus RLS to enforce visibility and branch isolation.

### 10.2 RPC-only for propagation and override creation
- Subtree propagation is a single backend call.
- Override/fork creation is a single backend call.
- Incident creation is a backend call.

### 10.3 UI reflects authority
- Admin-only blueprint write controls are routed to admin-only.
- Admin/Manager assignment controls visible; crew/owner read-only.
- Crew can complete incidents; owner cannot (RLS enforced).

---

## 11) Build verification

Build succeeded:
- `npm run build` (Vite)

No linter errors were reported in the changed files during this session.

---

## 12) Known limitations / follow-ups (if desired)

1) **Affected yachts count** for group + subtree propagation is currently not computed client-side (by design).
   - If you want the confirm modal to show exact affected yacht count for subtree propagation, add a backend read aggregation RPC (server-owned recursion).

2) The legacy files listed in §9 are still present in the codebase (not deleted).
   - If desired, they can be removed in a cleanup pass once you confirm there are no remaining consumers.

