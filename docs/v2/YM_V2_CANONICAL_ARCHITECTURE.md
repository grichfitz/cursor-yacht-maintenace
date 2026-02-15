# YM v2 — Canonical Architecture (Stabilized Baseline)

This document is the authoritative YM v2 system model for production governance.

**Sources of truth used to generate this document**

- `docs/v2/01_schema.sql` (tables, constraints, indexes, RLS policies, and DB helper functions defined there)
- The **RPCs invoked by the current `src/` codebase** (as the public DB API surface the frontend depends on)

No other documentation is referenced.

## 1. System Overview

### Purpose of YM v2

YM v2 is a yacht maintenance task system that:

- Organizes **yachts** under operational **groups**
- Provides a **template-driven** model to define maintenance work
- Tracks **yacht tasks** through a strict lifecycle from work-in-progress to approval
- Enforces data access exclusively via **Row Level Security (RLS)**

### Architectural principles

- **RLS-only scoping**: the frontend must not restrict result sets by role, group membership, or yacht ownership. All data scope is enforced by Postgres RLS policies.
- **Fork model**: templates are authored globally and can be copied into group scope as group-specific templates. The schema provides origin tracking for forked records.
- **Status lifecycle**: tasks move strictly through:
  - `open` → `pending_review` → `approved`

## 2. Canonical Tables

All tables below are defined in `docs/v2/01_schema.sql`.

### `roles`

- Canonical role names.
- Columns: `id`, `name` (unique).

### `user_roles`

- Assigns exactly one role to a user (enforced by `user_id` primary key).
- Columns: `user_id` (PK, FK to `auth.users`), `role_id` (FK to `roles`).

### `groups` (hierarchical structure, flat scope)

- Operational grouping for yachts and memberships.
Groups include `parent_group_id` and are structurally hierarchical.

Scope resolution is currently flat.
`user_group_ids()` returns only directly assigned groups.
Descendant groups are NOT automatically included in scope.
Recursive hierarchical scope is deferred to a future phase.
- Columns: `id`, `name`, `parent_group_id`, `created_at`, `archived_at`.

### `group_memberships`

- Membership edges between users and groups.
- Columns: `user_id`, `group_id`, `created_at` with composite primary key `(user_id, group_id)`.

### `yachts`

- A yacht belongs to exactly one group.
- Columns: `id`, `group_id`, `name`, `archived_at`.

### `yacht_owners`

- Owner visibility/access linkage between a user and a yacht.
- Columns: `yacht_id`, `user_id` with composite primary key `(yacht_id, user_id)`.

### `template_categories`

- Human-friendly grouping for global templates.
- Columns: `id`, `name`, `description`, `archived_at`.

### `global_templates`

- Global definitions of repeatable maintenance work.
- Columns: `id`, `title`, `description`, `interval_days`, `checklist_json`, `archived_at`.

### `category_templates`

- Many-to-many join mapping templates to categories.
- Columns: `category_id`, `global_template_id` with composite primary key `(category_id, global_template_id)`.

### `group_templates`

- Group-scoped templates. May reference a global origin template.
- Columns: `id`, `group_id`, `origin_global_template_id`, `title`, `description`, `interval_days`, `checklist_json`, `active`, `archived_at`.
- **Origin tracking**: `origin_global_template_id` provides linkage back to the global template when a group template is derived from a global template.

### `yacht_tasks`

- Canonical task table.
- Columns:
  - Identity/scope: `id`, `yacht_id`
  - Template lineage: `group_template_id` (nullable), `origin_global_template_id` (nullable)
  - Content: `title`, `description`, `interval_days`, `checklist_json`
  - Scheduling: `due_date`
  - Lifecycle: `status` (CHECK: `open|pending_review|approved`)
  - Ownership: `owner_user_id` (nullable)
  - Audit timestamps: `completed_at`, `completed_by`, `approved_at`, `approved_by`, `created_at`
  - Soft delete: `deleted_at`
- Uniqueness constraints (partial unique indexes):
  - Only one non-approved, non-deleted task per `(yacht_id, group_template_id)` when `group_template_id` is not null.
  - Only one non-approved, non-deleted task per `(yacht_id, origin_global_template_id)` when `origin_global_template_id` is not null.

## 3. Role Model

Role names are stored in `roles.name` and assigned via `user_roles`.

### Admin

- Full access across all groups and yachts (as granted by RLS policies using `public.is_admin()`).
- Can insert/update/delete on the administrative tables as permitted by insert/update/delete policies.

### Manager

- Scoped to yachts in `public.user_yacht_ids()`.
- Scoped to groups in `public.user_group_ids()`.
- Has additional write privileges on `group_templates` and `yacht_tasks` in-scope (see insert/update/delete policies).

### Crew

- Scoped to yachts in `public.user_yacht_ids()`.
- Can insert/update `yacht_tasks` in-scope (per `yacht_tasks_insert_crew_in_scope` and `yacht_tasks_update_crew_in_scope`).

### Owner

- Scoped via `yacht_owners` and `public.user_yacht_ids()`.
- RLS explicitly limits owner task visibility to **approved** tasks:
  - `yacht_tasks_select_owner_approved_in_scope` requires `status = 'approved'`.

### Explicit permission boundaries

Boundaries are enforced exclusively by RLS policies (not by frontend filtering). Key examples:

- Admin-all policies use `public.is_admin()`.
- Manager/crew policies use `public.current_user_role() in ('manager','crew')` plus membership/yacht scope functions.
- Owner policies use `public.current_user_role() = 'owner'` plus `yacht_owners` linkage (via `public.user_yacht_ids()`).

## 4. Template Propagation Model

This model is defined by table relationships and origin columns in `01_schema.sql`, plus the RPCs invoked by the frontend.

### Global → Group

- `global_templates` define canonical work items.
- `group_templates` are group-scoped variants that may carry `origin_global_template_id` to reference the originating `global_templates.id`.
- Categories:
  - `template_categories` + `category_templates` provide a way to group global templates for bulk operations.

### Group → Yacht

- `yacht_tasks` is the only task table.
- `yacht_tasks.group_template_id` (nullable FK) and `yacht_tasks.origin_global_template_id` (nullable FK) provide lineage to templates.

### Forking behavior

The schema supports a fork model by:

- Storing group-level derived templates in `group_templates` with an origin pointer `origin_global_template_id`.
- Allowing tasks to reference either a group template (`group_template_id`) and/or a global origin (`origin_global_template_id`).

**Important**: `01_schema.sql` does not define any automatic propagation triggers. Propagation is therefore performed via database functions/RPCs and/or controlled application workflows.

### Category assignment behavior

- Category-to-template membership is modeled by `category_templates (category_id, global_template_id)`.
- Group-level category assignment behavior is executed via a DB RPC invoked by the frontend (see “RPC surface” below). The implementation is DB-defined and is not included in `01_schema.sql`.

### Supported propagation RPCs

The canonical, supported propagation mechanisms are the following RPCs:

- `assign_global_template_to_group()`
- `assign_category_to_group()`
- `assign_category_to_yacht()`

These RPCs are the canonical propagation mechanisms used by the system.

Direct template-derived inserts from the frontend are prohibited by governance rule.

## 5. Task Lifecycle

### Status lifecycle (canonical)

`yacht_tasks.status` is constrained to:

- `open`
- `pending_review`
- `approved`

### RPC surface used by the current frontend

The current `src/` codebase invokes the following RPCs:

- `complete_yacht_task` with argument object `{ p_task_id: <uuid> }`
- `approve_yacht_task` with argument object `{ p_task_id: <uuid> }`

**Note**: The definitions of `complete_yacht_task` and `approve_yacht_task` are not present in `docs/v2/01_schema.sql`. Their exact behavior must be treated as DB-owned and verified from the database function definitions.

### Recurrence logic

Recurrence is currently implemented inside the `approve_yacht_task()` database function.

If `interval_days` is not null, the function inserts a new `yacht_tasks` row in status `open`.

This behavior is defined in database function code and is not expressed directly in `01_schema.sql`.

## 6. RLS Model

RLS is enabled on all canonical tables listed in `01_schema.sql`, including `groups`, `group_memberships`, `yachts`, `yacht_owners`, `template_categories`, `global_templates`, `category_templates`, `group_templates`, `yacht_tasks`, and `user_roles`.

### Scope helper functions

The following helper functions are defined in `docs/v2/01_schema.sql` and are marked `security definer`:

- `public.is_admin()` → boolean
- `public.current_user_role()` → text
- `public.user_group_ids()` → setof uuid
- `public.user_yacht_ids()` → setof uuid

These functions are used by RLS policies via `using (...)` / `with check (...)` clauses.

### `user_group_ids()`

`public.user_group_ids()` returns:

- For admin: all `groups.id`
- Otherwise: `group_memberships.group_id` for the current `auth.uid()`

### `user_yacht_ids()`

`public.user_yacht_ids()` returns:

- For admin: all `yachts.id`
- For manager/crew: yachts where `yachts.group_id in (select public.user_group_ids())`
- For owner: yachts where `yacht_owners.user_id = auth.uid()`

### Security definer rationale

`01_schema.sql` defines these scope helper functions as `security definer` and grants execute to `authenticated`.

This is the canonical mechanism used by RLS policies to compute scope and role in one place, rather than duplicating logic in every query or in application code.

### Self-read policy requirement

`01_schema.sql` includes policies that allow the current user to read the rows required to determine their own role/scope, for example:

- `user_roles_select_self` allows `user_roles` rows where `user_id = auth.uid()`.

This ensures role/scope evaluation has a canonical “self” read path under RLS.

## Governance Constraints

- **Rule**: The frontend must not directly insert `yacht_tasks` derived from templates.

## 7. Explicit Non-Goals

YM v2 explicitly does **not** include the following:

- No separate assignment engine outside the YM v2 data model (assignment is represented by `yacht_tasks.owner_user_id` and enforced by RLS).
- No frontend scope filtering (no role-based/group-based client filtering of data sets; rely on RLS).
- No template-based direct `yacht_tasks` inserts from the frontend (template propagation must be performed via DB-owned workflows/RPCs).
- No alternate status models (only `open` → `pending_review` → `approved`).

