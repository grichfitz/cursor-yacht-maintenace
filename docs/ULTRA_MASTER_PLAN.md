# ULTRA – Master Plan of Action (ARCHIVED)

**Archived:** 2026-02-11  
**Status:** Historical reference only (non-canonical)

This document contains legacy phrasing/models (e.g. “immutable copies created from templates”) that conflict with the canonical hierarchical assignment + per-yacht execution model.

Canonical reference:
- `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`

## Purpose
ULTRA is a group-scoped, yacht-centric, offline-first CMMS/workflow system.

Groups define scope.
Categories define capability.
Templates define standards.
Yacht tasks define reality.

Nothing mutates upward. Everything flows downward.

## Groups
Users and yachts live in groups.
Users only see their group and descendants.

## Categories
Categories define types of work.
Categories bind to groups with cascade.
Assigning categories does NOT create tasks.

## Task Templates
Templates live under categories.
Each template has a version.
Applying templates creates independent yacht tasks.
Editing templates never mutates existing tasks.

## Yacht Tasks
Immutable copies created from templates.

## Operational Tasks
Created by users.
Always linked to yachts.
Assigned to users or groups.

## Unified Lifecycle
Open → Acknowledged → In Progress → Completed → Closed
Optional: On Hold, Cancelled

## Escalation
Tasks may escalate after timeout.
Visibility only.

## Offline
Local-first.
local → queue → sync.

## UX
No Assign buttons.
No Save buttons.
Contextual Apply.
Floating Create.
Auto-save.

## Database Core
groups
group_users
group_yachts
group_categories
yachts
categories
task_templates
yacht_tasks
operational_tasks
task_comments
task_photos
operations_queue

Assignments ONLY via:
assigned_user_id
assigned_group_id

## Implementation Order
1 Groups
2 Category binding
3 Templates
4 Yacht tasks
5 Operational tasks
6 Lifecycle
7 Escalation
8 Notifications
9 Offline
10 UI
11 Final tidy

ULTRA is:
Tree scoped
Template driven
Instance based
Offline first
Yacht centric
Human collaborative

No shared mutable tasks.
No upward visibility.
No blocking saves.
