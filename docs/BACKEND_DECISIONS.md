# Backend Decisions — ULTRA Refactor

Date: 2026-02-09

These decisions are authoritative for backend/server work.

**Canonical model note (2026-02-11):**
- Task inheritance/assignment architecture is defined in `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`.
- Canonical override storage is `task_assignments.override_data` (sparse JSON merged at runtime).
- Mentions of `task_context_overrides` below should be treated as **legacy/transitional**.

---

## DELETE

None.
No existing backend logic is removed without replacement.

---

## REWRITE

### api/invite-user.ts
- Must enforce authentication and authorization.
- Must require explicit group_id.
- Must only allow inviting into groups the caller is permitted to manage.
- Must create group membership on successful invite.

### users sync / visibility
- Harden security definer functions (explicit search_path).
- Remove permissive global users directory access.
- Replace with group-scoped visibility consistent with ULTRA.

### Permissions enforcement
- Enable RLS on domain tables.
- Implement group-scoped read/write policies.
- Client-side filtering is insufficient and not authoritative.

---

## KEEP

### Template versioning
- migration_task_versioning.sql is correct and aligned.

### Yacht/task override concept
- task_context_overrides is kept as TRANSITIONAL.
- Revisit only if schema decisions change.

### Group soft archive
- groups.is_archived is correct and remains.

---

## NOT YET IMPLEMENTED (INTENTIONAL)

- Task creation RPCs
- Task assignment RPCs
- Template application logic
- Execution lifecycle enforcement
- Offline sync endpoints

These will be implemented deliberately in later steps.
