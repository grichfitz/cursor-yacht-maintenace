# ULTRA — Canonical Task Assignments: Migration Notes

Canonical reference: `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`

## What these migrations add
- `migration_add_task_assignments.sql`
  - Adds `public.task_assignments` (group binding + `inherits_from_assignment_id` + `override_data jsonb`)
- `migration_task_assignments_rls.sql`
  - Adds RLS + policies for `task_assignments`
  - Adds helper `visible_group_ids_with_ancestors()` (for downward-propagation reads)
- `migration_effective_task_assignments_rpc.sql`
  - Adds RPC `public.effective_task_assignments(target_group_id uuid)` (SQL-authoritative merge)

## Apply order (manual, Supabase SQL editor)
1. `migration_add_task_assignments.sql`
2. `migration_task_assignments_rls.sql`
3. `migration_effective_task_assignments_rpc.sql`

## Notes
- These are **additive** and do not remove legacy tables (`tasks`, `task_contexts`, etc.).
- The canonical model names “task_templates”; in the current live snapshot, templates are stored in `public.tasks`. The canonical rename/alias can be done later as a deliberate step.

