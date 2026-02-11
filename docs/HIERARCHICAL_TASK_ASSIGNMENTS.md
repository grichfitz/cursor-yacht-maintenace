# ULTRA — Hierarchical Task Assignments (Canonical, 2026-02-11)
This document is **canonical** for ULTRA’s task assignment inheritance model.

System mode note: ULTRA is currently in **stabilisation mode** (no new endpoints; no schema changes except targeted fixes). This document defines the target architecture and rules of truth for future implementation and doc cleanup.

---

## Confirmed decisions (authoritative)
- **Template inheritance with separate completion per yacht**
- **Field-level overrides only** (interval, title, description, etc.)
- **Downward-only propagation** (parent → descendants)
- **No sideways** (siblings) and **no upward** (child → parent) propagation
- **Child groups may override locally** without affecting parents or siblings
- **No task duplication per yacht or user**
- **No parent mutation from child edits**
- **No frontend-only inheritance logic** (SQL/back-end must be authoritative)

---

## Required architecture (authoritative)
The model MUST use these conceptual tables:

### 1) `task_templates` (canonical definitions)
Single source of truth for the base task definition.

Examples of fields:
- `title`, `description`
- default recurrence/interval metadata (if applicable)
- any other base properties that should be shared fleet-wide

### 2) `task_assignments` (group binding + inheritance + sparse overrides)
Each row binds a template into a specific **group subtree** and optionally declares an inheritance relationship.

Required fields (conceptual):
- `id`
- `group_id` (the group this assignment is defined on)
- `task_template_id`
- `inherits_from_assignment_id` (nullable; references a parent assignment when this row is a child override/shadow)
- `override_data` (`jsonb`; **sparse** field-level overrides only)

Notes:
- `override_data` is **not** a full copy of the template. It contains only overridden fields.
- A child assignment that overrides an inherited assignment MUST point to it via `inherits_from_assignment_id`.

### 3) `task_instances` (per-yacht execution/completion)
Execution/completion is stored **per yacht** and must NOT be represented by cloning templates.

Required fields (conceptual):
- `id`
- `yacht_id`
- reference back to the resolved “effective assignment” (e.g. `task_assignment_id`)
- execution/completion state (e.g. last_completed_at, next_due_at, status, etc.)

Notes:
- `task_instances` records are **yacht-scoped reality**. They should remain stable even if templates/assignments evolve (subject to future explicit rules).

---

## Global vs local tasks (authoritative)
Tasks may exist in:

- **Global Library**: templates/assignments defined in the Global Library group scope.
  - Propagate to **all members** (via everyone being in the Global Library group tree).
- **Specific groups**: templates/assignments defined in a particular operational group.
  - Propagate only within that **group’s subtree**.

A single template may be assigned in **Global** and also assigned in a **specific group** (local) without implying duplication. These are distinct assignments with distinct scopes.

---

## Inheritance and propagation rules (authoritative)

### Downward-only
If a task is assigned at group \(G\), it is visible/applicable for:
- \(G\) itself
- all descendant groups of \(G\)
- yachts belonging to \(G\) or any descendant group (per yacht ownership rules)

It does **not** propagate:
- to \(G\)’s parent groups
- to sibling subtrees

### Shadowing (“child overrides parent”) — no sideways/upwards effects
If a descendant group \(C\) defines an assignment for the same template that is intended to override an inherited parent assignment:
- the child assignment **shadows** the parent assignment within the \(C\) subtree only
- parents and siblings are unaffected
- the override is recorded by setting `inherits_from_assignment_id` to the parent assignment id

---

## Runtime effective task definition (authoritative)
Effective task fields are computed by **sparse JSON merge** at runtime:

**Merge order (lowest → highest priority):**
1. `task_templates` (base)
2. parent assignment `override_data` (if applicable)
3. child assignment `override_data` (if applicable; can be multiple levels deep)

Put differently:

\[
\text{effective_task} = \text{merge}(\text{template}, \text{ancestor_overrides...}, \text{local_override})
\]

### Sparse override contract
- Only the keys present in `override_data` are overridden.
- Missing keys mean “inherit”.
- Override JSON must be validated (server-side / SQL-side) so only allowed fields can be overridden (title, description, interval, etc.).

---

## Explicit “do not implement” list (authoritative)
- Full task cloning
- Per-yacht template duplication
- Parent mutation from child edits
- Frontend-only inheritance logic

---

## Stabilisation-mode constraint
During stabilisation, any work should be limited to:
- clarifying docs to match this canonical model
- targeted fixes only (no new endpoints; no broad schema changes)

