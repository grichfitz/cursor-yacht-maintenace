# Diagnostic Report: Template "Check prop" (id 9210cabb-d76f-4ee3-966f-56e2d87f6dab)

**Date:** 2026-02-13  
**Scope:** Read-only inspection of UI and data model. No edits performed.

**Note:** Browser MCP tools could not connect to `http://localhost:5173/`. This report is based on codebase analysis and migration logic. For live UI verification, manually navigate the app while logged in as admin.

---

## Where to Inspect in the UI

| Page | Route | What to Check |
|------|-------|---------------|
| **Templates** | `/templates` | Template list; find "Check prop" in the list |
| **Template Editor** | `/templates/9210cabb-d76f-4ee3-966f-56e2d87f6dab` | `default_group_id`, `category_id`, template ID displayed |
| **Assignments** | `/assignments` | Template ↔ Group Links table; Template ↔ Yacht Links table |

**Auth:** `/templates` and `/assignments` are behind `EditorRoute` (admin-only). You must be logged in with an admin role. If no session exists, the app will show loading or redirect; you need Supabase auth credentials (email/password or OAuth).

---

## Answers to Diagnostic Questions

### (1) Does template "Check prop" still have a valid group via parent hierarchy?

**Logic (from `migration_phase1b_instance_generation_functions.sql`):**
- Group scope comes from `template_group_links` (direct links only; no parent hierarchy for templates).
- The `group_tree` CTE expands **downward**: a link to group G also applies to all **descendant** groups (children, grandchildren, etc.).
- It does **not** use `task_templates.default_group_id` for instance generation—only `template_group_links` and `template_yacht_links`.

**Answer:** The template has a valid group scope if it has at least one row in `template_group_links`. The "parent hierarchy" here is **group** hierarchy (parent_group_id on groups), not template hierarchy. A link to a parent group automatically covers yachts in that group and all descendant groups.

**Where to verify:** Assignments page → "Template ↔ Group Links" table. Look for rows where Template = "Check prop". If any exist, the template has group scope.

---

### (2) Are there overlapping group scopes that keep it linked?

**Logic:** The `group_tree` CTE recursively expands:
- Base: `template_group_links` (template_id, group_id)
- Recursive: for each (template_id, group_id), add (template_id, child.id) for every child where `child.parent_group_id = group_id`

So if "Check prop" is linked to:
- Group A (parent) → covers A + all descendants
- Group B (child of A) → also covers B + B’s descendants

The `candidate_pairs` CTE uses `select distinct` on (template_id, yacht_id), so overlapping group scopes do **not** create duplicate instances—they just mean the template stays linked to more yachts.

**Answer:** Overlapping scopes (e.g. parent + child group links) can keep a template linked to the same yachts through multiple paths. The system dedupes by (template_id, yacht_id), so you won’t see duplicate instances, but the template remains linked as long as at least one path exists.

**Where to verify:** Assignments page → "Template ↔ Group Links". If "Check prop" appears in multiple rows with different groups (especially parent/child), that indicates overlapping scopes.

---

### (3) Are there manual yacht links for that template?

**Logic:** `template_yacht_links` stores explicit template-to-yacht links. These are used in addition to group links. A template can have:
- Group links only
- Yacht links only
- Both

**Answer:** Check the "Template ↔ Yacht Links" table on the Assignments page. Any row with Template = "Check prop" is a manual yacht link.

---

### (4) Was the correct template unlinked?

**Logic:** "Unlinking" means removing rows from:
- `template_group_links` (for that template_id)
- `template_yacht_links` (for that template_id)

If the intent was to unlink "Check prop" (id `9210cabb-d76f-4ee3-966f-56e2d87f6dab`), then:
- There should be **no** rows in `template_group_links` with `template_id = '9210cabb-d76f-4ee3-966f-56e2d87f6dab'`
- There should be **no** rows in `template_yacht_links` with that `template_id`

**Answer:** On the Assignments page, "Check prop" should not appear in either the Group Links or Yacht Links tables if it was correctly unlinked.

---

### (5) Are instances assigned vs pending, and would cancellation apply?

**Logic (from `cancel_instances_for_unlinked_templates()`):**
- Cancellation **only** affects instances with `status = 'pending'`.
- Instances with `status = 'assigned'`, `'completed'`, or `'verified'` are **not** cancelled.

**Schema note:** The migration requires the enum `task_instance_status` to include `'cancelled'`. The CSV schema snapshot shows: `pending`, `assigned`, `completed`, `verified`—but not `cancelled`. If `cancelled` was never added, the cancel function will raise an error when run.

**Answer:**
- **Assigned vs pending:** Instances can be `pending` (not yet assigned) or `assigned` (has a `task_assignments` row). The Tasks page and Yacht detail show status.
- **Would cancellation apply?** Only to `pending` instances. Assigned/completed/verified instances are left unchanged. If the enum lacks `cancelled`, the cancel function cannot run until that enum value is added.

---

## SQL Diagnostic Queries (Run in Supabase SQL Editor)

If you have DB access, these queries answer the questions directly:

```sql
-- (1) Group links for "Check prop"
SELECT tgl.*, g.name as group_name, g.parent_group_id
FROM template_group_links tgl
JOIN groups g ON g.id = tgl.group_id
WHERE tgl.template_id = '9210cabb-d76f-4ee3-966f-56e2d87f6dab';

-- (2) Manual yacht links for "Check prop"
SELECT tyl.*, y.name as yacht_name
FROM template_yacht_links tyl
JOIN yachts y ON y.id = tyl.yacht_id
WHERE tyl.template_id = '9210cabb-d76f-4ee3-966f-56e2d87f6dab';

-- (3) Task instances for this template (status breakdown)
SELECT status, count(*) 
FROM task_instances 
WHERE template_id = '9210cabb-d76f-4ee3-966f-56e2d87f6dab'
GROUP BY status;

-- (4) Check if task_instance_status enum has 'cancelled'
SELECT e.enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' AND t.typname = 'task_instance_status';
```

---

## Summary

| Question | Answer |
|----------|--------|
| (1) Valid group via parent hierarchy? | Yes if `template_group_links` has rows for this template; group hierarchy expands downward to descendants. |
| (2) Overlapping group scopes? | Possible; multiple group links (e.g. parent + child) keep it linked; instances are deduped. |
| (3) Manual yacht links? | Check Assignments → "Template ↔ Yacht Links" for "Check prop". |
| (4) Correct template unlinked? | If unlinked, "Check prop" should not appear in either Assignments table. |
| (5) Assigned vs pending; cancellation? | Only `pending` instances are cancelled; `assigned`/`completed`/`verified` are not. Enum must include `cancelled`. |
