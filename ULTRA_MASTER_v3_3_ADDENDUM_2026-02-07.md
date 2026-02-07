## ULTRA MASTER v3.3 — Addendum (2026-02-07)

This addendum documents architecture + implementation updates made after `Marine_Task_App_ULTRA_MASTER_v3_3_Feb2026.pdf`.

**Source of truth remains:**
- `Marine_Task_App_ULTRA_MASTER_v3_3_Feb2026.pdf`
- `Supabase Snippet Meta Schema Overview.csv` (tables/columns/relations)

**ULTRA permanent rules remain unchanged:**
- Never attach tasks directly to yachts
- Never compute ownership in React
- Never overwrite `task_results`
- Never store tree paths
- Never use names as identity
- Never fetch entire datasets post-RPC
- `TreeDisplay` is presentation-only

---

## What was added / changed (implementation reality)

### Tree UI + mobile interaction fixes
- **Checkbox controlled-input warning fixed**: checkboxes now use `onChange` (not click-only) in assignment UIs.
- **Mobile pencil/checkbox layout fixed**:
  - Global text-input CSS no longer forces `input[type=checkbox|radio]` to `width: 100%`.
  - `.tree-actions` now has consistent sizing for checkbox/radio and an icon tap-target class.

Files:
- `src/App.css`
- `src/pages/GenericTreeAssignPage.tsx`

### Generic assignment page behavior
- Virtual nodes (`id` starting with `__`) are **non-assignable**:
  - checkbox disabled
  - pencil hidden

Files:
- `src/pages/GenericTreeAssignPage.tsx`

---

## Groups: editor + archive

### Group editor
- Added `GroupEditorPage`:
  - rename + description
  - move within group tree (circular move prevention)

Files:
- `src/pages/GroupEditorPage.tsx`
- route `GET /groups/:groupId` in `src/app/routes.tsx`

### Group archive (soft archive)
- Added **soft archive** for groups:
  - `groups.is_archived boolean default false`
  - group trees show a virtual “Archive” container
  - yacht/user trees ignore archived groups for day-to-day navigation

Migration:
- `migration_add_groups_archive.sql`

Files:
- `src/hooks/useGroupTree.ts`
- `src/hooks/useYachtGroupTree.ts`
- `src/hooks/useUserGroupTree.ts`
- `src/pages/GroupEditorPage.tsx`

---

## Users app (mirrors Yachts app)

### Users tree
- Added `UsersApp`: shows **groups → users** tree and “Unassigned users” virtual node.
- Uses schema tables:
  - `users`
  - `user_group_links`
  - `groups`

Files:
- `src/app/UsersApp.tsx`
- `src/hooks/useUserGroupTree.ts`

### User editor + group assignment
- Added `UserDetailPage` (edit display name; email read-only; Assigned Groups pill).
- Added `UserGroupAssignPage` (assignment via `user_group_links(user_id, group_id)`).

Files:
- `src/pages/UserDetailPage.tsx`
- `src/pages/UserGroupAssignPage.tsx`

---

## Create flows (New … pages)

### New Task
- `NewTaskPage` inserts into `tasks` then navigates to the new task’s editor using `{ replace: true }` so Back returns to list.

Files:
- `src/pages/NewTaskPage.tsx`
- route: `/apps/tasks/new`

### New Yacht
- `NewYachtPage` inserts into `yachts` then navigates to yacht editor using `{ replace: true }`.

Files:
- `src/pages/NewYachtPage.tsx`
- route: `/apps/yachts/new`

### New User (Supabase Auth invite)
Because `public.users.id` is FK-linked to Supabase Auth users (`users_id_fkey`), user creation must happen via **Supabase Auth admin**.

- Added `POST /api/invite-user` (server-side):
  - invites user via `auth.admin.inviteUserByEmail`
  - upserts `public.users` row using returned auth `user.id`
- `NewUserPage` calls this endpoint.

Files:
- `api/invite-user.ts`
- `src/pages/NewUserPage.tsx`
- route: `/apps/users/new`

Vercel environment variables (server-side):
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase Auth URL configuration required:
- Site URL should be the deployed domain (not localhost)
- Redirect URLs should include the deployed domain wildcard (e.g. `https://<domain>/*`)

Known (pending) issue:
- Invite email link flow still needs final verification/hardening (see “Open items”).

---

## Safe deletes (guarded by history)

### Tasks
- Delete task only if not referenced by:
  - `task_contexts`
  - `yacht_tasks` (legacy)
- Cleans up:
  - `task_category_map`
  - best-effort `task_category_links`

File:
- `src/pages/TaskDetailPage.tsx`

### Yachts
- Delete yacht only if not referenced by:
  - `task_contexts`
  - `yacht_tasks` (legacy)
- Cleans up:
  - `yacht_group_links`
  - `yacht_user_links`

File:
- `src/pages/YachtDetailPage.tsx`

### Users
- Delete user only if not referenced by:
  - `task_results.performed_by`
  - `task_context_assignees.assignee_id`
- Cleans up:
  - `user_group_links`, `user_role_links`, `app_user_links`, `yacht_user_links`

File:
- `src/pages/UserDetailPage.tsx`

---

## Category/Group creation from assignment screens

### New Category / New Group buttons
- Assignment pages now include “New Category” / “New Group” pill buttons under a divider.

Files:
- `src/pages/TaskCategoryAssignPage.tsx`
- `src/pages/YachtGroupAssignPage.tsx`
- `src/pages/UserGroupAssignPage.tsx`

### NewCategoryPage / NewGroupPage
- Added:
  - `/categories/new` → `NewCategoryPage` (creates category then routes to editor)
  - `/groups/new` → `NewGroupPage` (creates group then routes to editor)

Files:
- `src/pages/NewCategoryPage.tsx`
- `src/pages/NewGroupPage.tsx`
- routes in `src/app/routes.tsx`

Schema note:
- `task_categories.group_id` is NOT NULL, so new category creation selects a default `group_id` from existing categories or falls back to any `groups.id`.

---

## Task↔Yacht assignment via task_contexts (ULTRA-compliant)

### Task → Assigned Yachts
- Added `Assigned Yachts` on `TaskDetailPage`
- Assignment page writes **only to `task_contexts`** (no direct task↔yacht join table)

Files:
- `src/pages/TaskYachtAssignPage.tsx`
- route: `/apps/tasks/:taskId/yachts`
- `src/pages/TaskDetailPage.tsx`

Option A implemented:
- If a task has no categories when assigning yachts, the app auto-creates/uses a real category bucket and maps the task into it.

### Yacht → Assigned Tasks
- Added `Assigned Tasks` on `YachtDetailPage`
- Assignment page writes to `task_contexts`
- Unassign is blocked if any `task_results` exist for contexts being removed (history protection).

Files:
- `src/pages/YachtTaskAssignPage.tsx`
- route: `/apps/yachts/:yachtId/tasks`
- `src/pages/YachtDetailPage.tsx`

---

## Tasks list: remove duplicate “uncategorised” buckets

Goal:
- Keep a **single** real category bucket (no virtual container) for uncategorised tasks.

Implementation:
- Removes the virtual `__unassigned_tasks__` node
- Ensures there is a real `task_categories` record named **“Uncategorised Tasks”**
- Upserts unassigned tasks into that category via `task_category_map`

File:
- `src/hooks/useTaskTree.ts`

---

## UI consistency: list page top bars

Change:
- `TasksApp`, `YachtsApp`, `UsersApp` list pages now use the same **Back (left) / Home (right)** top bar as other pages.

Files:
- `src/app/TasksApp.tsx`
- `src/app/YachtsApp.tsx`
- `src/app/UsersApp.tsx`

---

## Open items / Known issues (not done yet)

### Supabase invite email flow
- Invite link behavior still needs full validation in production:
  - redirect target
  - completing auth session after password setup
  - better UX on success/failure

Related files:
- `api/invite-user.ts`
- `src/pages/NewUserPage.tsx`

### Offline support
- Remains **deferred** (Phase 3+ only). Do not implement yet.

