# RLS Design — ULTRA

Date: 2026-02-09

This document defines the authoritative Row Level Security (RLS)
design for ULTRA. SQL implementation must follow this intent.

---

## Core Principle

- SQL enforces visibility and permissions.
- Groups define scope.
- Users see only their group(s) and descendant groups.
- React never computes ownership or access.

---

## Scope Anchors

- Users → group membership (group_users)
- Yachts → exactly one owning group (group_yachts)
- Tasks → visible only via yacht/group scope

---

## Tables Requiring RLS

- groups
- group_users
- users
- yachts
- group_yachts
- categories
- group_categories
- task_templates
- yacht_tasks
- operational_tasks
- task_comments
- task_photos
- operations_queue

Transitional / legacy tables must still be protected until removed.

---

## Visibility Rules (English)

- A user may read data only if it belongs to a group in their
  visible group tree (their group + descendants).
- Yachts are visible only if their owning group is visible.
- Task instances are visible only if their yacht’s group is visible.
- Templates are visible only via categories bound to visible groups.

---

## Write Rules (High-Level)

- Membership and group structure: service/admin only.
- Task execution results: append-only for users; no overwrite.
- Reference tables (periods, units): read-only for users.
- All writes must be group-scoped.

---

## Helper Logic (Conceptual)

- Function to resolve visible group IDs for current user.
- Helper to resolve yacht → owning group.

No RPCs or Edge Functions are required at this stage.
