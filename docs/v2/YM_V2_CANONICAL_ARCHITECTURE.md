# YM v2 – Canonical Architecture

This document defines the authoritative architecture for YM v2.
All backend, frontend, and future features must align with this model.

---

## 1. Core Domain Model

### Entities

- groups
- yachts
- global_templates
- template_categories
- category_templates
- group_templates
- yacht_tasks

A yacht belongs to exactly one group.

Owners are assigned per yacht.
Managers and Crew are scoped by group membership.
Admin is global.

---

## 2. Task Model

The canonical task table is:

yacht_tasks

There is no task_instances table in v2.

Each yacht_task represents a concrete, actionable task assigned to a yacht.

Fields of importance:

- yacht_id
- group_template_id (nullable)
- origin_global_template_id (nullable)
- status
- owner_user_id
- interval_days
- due_date
- completed_at
- approved_at

---

## 3. Status Lifecycle

Valid statuses:

- open
- pending_review
- approved

Lifecycle:

open → pending_review → approved

Rules:

- Tasks are completed by Crew or Manager.
- Completion sets status to pending_review.
- Approval sets status to approved.
- Recurrence is generated only upon approval.

There are no other valid task states.

---

## 4. Recurrence Rules

If interval_days is not null:

- When a task is approved:
  - A new yacht_task is created.
  - due_date = completed_at + interval_days.
  - status = open.

There must never be more than one non-approved task per yacht per template.

---

## 5. Duplicate Prevention Rule

At any time:

There may be only one yacht_task per yacht per template
where status != 'approved' and deleted_at is null.

This rule applies across:

- group_template assignments
- yacht-level category assignments
- recurring tasks

---

## 6. Template Hierarchy

Hierarchy:

global_template  
→ group_template (forked snapshot)  
→ yacht_task

Categories are wrappers over global_templates.

Assignment behaviors:

- Assign global_template to group:
  → Creates group_template
  → Generates yacht_tasks for all yachts in that group

- Assign category to group:
  → Assigns all global_templates in that category

- Assign category to yacht:
  → Creates yacht_tasks directly (no group_template)
  → Must not duplicate existing open/pending tasks

Yacht-level assignment takes precedence.
No duplicate open tasks may be created.

---

## 7. Role Model

Roles:

- admin
- manager
- crew
- owner

Rules:

Admin:
- Full system access.

Manager:
- Scoped to groups they belong to.
- Can assign templates.
- Can approve tasks.

Crew:
- Scoped to groups they belong to.
- Can create custom tasks.
- Can complete tasks.
- Cannot approve.

Owner:
- Scoped to yachts they are assigned to.
- Can view approved tasks only.
- No write permissions.

---

## 8. RLS Philosophy

Row Level Security enforces:

- Scope isolation by group and yacht.
- Owner visibility restricted to approved tasks.
- Write permissions restricted by role and scope.

Business workflow validation is implemented in database functions.

---

## 9. Canonical Functions

Core system functions:

- assign_global_template_to_group
- assign_category_to_group
- assign_category_to_yacht
- complete_yacht_task
- approve_yacht_task

These functions define authoritative propagation and workflow logic.

No direct client-side workflow manipulation is allowed.

---

## 10. Source of Truth

The authoritative schema for YM v2 is defined in:

docs/v2/01_schema.sql

All migrations, features, and UI behavior must align with this model.

Any deviation requires explicit architectural review.
