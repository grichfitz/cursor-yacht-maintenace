# YM v2 – Work Summary (2026-02-15)

This document summarizes the implementation work completed to align the frontend with the production Supabase schema (CSV DDL source of truth), plus UX and role-scope fixes requested during the session.

## Highlights

### Schema alignment + removal of non-canonical fields
- Yacht editor + yacht detail screens were stripped of non-schema fields (e.g. make/model, location, photo URL, “latest engineer hours”).
- All task reads/writes were aligned to schema-safe columns (notably `tasks.title` rather than legacy `name`).
- Removed dependencies on non-existent tables/relations (`user_role_links`, `yacht_group_links`, etc.) and replaced with schema-correct sources.

### Role access: admin / manager / crew
- Managers regained access to editor sections within their “group and down” scope (Groups, Tasks, Categories), while admin-only screens remain protected.
- Implemented manager scoping utility (`user_group_ids()` RPC preferred, client-side descendant fallback) and applied it to:
  - yachts/groups lists (prevent managers from seeing all groups)
  - category editing + creation
  - task create/edit yacht lists
- Task templates for managers can now be sourced from both:
  - group-scoped `templates`
  - `global_templates` (when present), merged into a single select list.

### Task completion flow (crew UX)
- Added a completion form on `TaskPage` with:
  - description / test result / comments
  - optional photo upload to Supabase Storage
  - “Ready for review” submission writing to schema-safe fields
- After completion, shows a “Well done” summary screen with a Continue action back to My Tasks.
- Minor UI refinements: compact yacht row; removed explanatory blurb.

### Task tree + category grouping
- Tasks are shown grouped under categories, including a virtual **Unassigned** node for tasks without a category.

### Users directory + group membership UX
- Fixed user directory errors caused by `user_role_links` (table does not exist).
- Users page now renders a group-tree directory with user names (primary line) emphasized and email shown as secondary.
- Group assignment tree checkboxes now show an **indeterminate** state on parents when only descendants are selected (matches expected hierarchy semantics).

### Editor UX consistency
- Standardized primary action buttons to use the same CTA styling across editor screens.
- Task forms updated so **Description appears immediately after the task name**, and the “Title” label wording was removed (now “Task”).

### Archive support (replaces destructive delete in key editors)
Archive/unarchive controls were added following the same pattern across entities, toggling `archived_at`:
- **Users**: `public.users.archived_at` (editor page)
- **Yachts**: `public.yachts.archived_at` (editor page)
- **Categories**: `public.categories.archived_at` (editor page, placed at bottom; removed delete UI)
- **Groups**: `public.groups.archived_at` (editor page; replaced delete with archive)

## RLS migrations added (apply in Supabase SQL Editor)

These fix 403/“new row violates row-level security policy …” errors for non-admin editor actions:

- `docs/v2/migration_categories_rls_admin_manager.sql`
  - Admin: full access on `public.categories`
  - Manager: scoped by `group_id in user_group_ids()`

- `docs/v2/migration_tasks_rls_admin_manager.sql`
  - Admin: full access on `public.tasks`
  - Manager: scoped by `tasks.yacht_id -> yachts.group_id in user_group_ids()`

## Notable file-level changes

- **Manager scoping**: `src/utils/groupScope.ts`, `src/hooks/useYachtGroupTree.ts`, `src/pages/YachtsPage.tsx`, task create/edit pages.
- **Task completion**: `src/pages/TaskPage.tsx`
- **Editor category**: `src/pages/editor/EditorEditCategoryPage.tsx`, `src/pages/editor/EditorNewCategoryPage.tsx`
- **Users directory/tree**: `src/pages/UsersPage.tsx`, `src/hooks/useUserGroupTree.ts`, `src/components/TreeDisplay.tsx`
- **Group editor**: `src/pages/editor/EditorEditGroupPage.tsx`
- **Archive controls**: `src/pages/editor/EditorUserPage.tsx`, `src/pages/editor/EditorEditYachtPage.tsx`, `src/pages/editor/EditorEditCategoryPage.tsx`, `src/pages/editor/EditorEditGroupPage.tsx`

## Notes / operational reminders
- If managers still see “Forbidden” when creating/editing tasks or categories, it is almost always missing RLS policies; apply the SQL migrations listed above.
- The frontend includes graceful fallbacks when optional columns/tables aren’t present (e.g. `categories.group_id`, `global_templates`, `archived_at` columns).

