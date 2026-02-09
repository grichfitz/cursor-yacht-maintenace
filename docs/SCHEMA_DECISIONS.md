# Schema Decisions — ULTRA Refactor

Date: 2026-02-09

These decisions are final unless explicitly revisited.

---

## Group ↔ Yacht

DECISION:
Yachts belong to exactly ONE group.

Implementation:
- Enforce unique(yacht_id) on group_yachts.
- Sharing is done via users, not yachts.

---

## Operational Tasks

DECISION:
All operational_tasks MUST be pinned to a group.

Implementation:
- Add operational_tasks.group_id (NOT NULL, FK → groups.id).
- Group defines visibility, escalation, and responsibility.
- Yacht alone is insufficient for scope.

---

## Status Fields

PENDING

---

## Task Status

DECISION:
Task status remains TEXT for now.

TRANSITIONAL:
- Will migrate to enum (task_status) after lifecycle is stable.
- Applies to yacht_tasks and operational_tasks.
