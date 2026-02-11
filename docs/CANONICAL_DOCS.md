# ULTRA — Canonical Docs Index (2026-02-11)

This file exists to prevent architectural drift inside `/docs`.

## Canonical (authoritative)
- `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md` — task inheritance/assignment/instance model
- `docs/RLS_DESIGN.md` — RLS intent and principles (terminology aligned)
- `docs/Supabase Snippet Marine Task App — Full Schema Snapshot (post-RLS).csv` — schema snapshot reference
- Smoke tests / stabilisation artefacts:
  - `docs/SMOKE_TEST_STATUS_2026-02-10.md`
  - `docs/UI_SMOKE_TESTS_2026-02-09.md`
  - `docs/SMOKE_TEST_C_SUMMARY.md`

## Historical / legacy (non-canonical)
These are retained for context but must not be treated as the current architecture contract:
- `docs/ULTRA_MASTER_PLAN.md` (+ `.pdf`)
- `docs/SESSION_SUMMARY_2026-02-09.md` (+ `.pdf`)
- `docs/SCHEMA_DECISIONS.md`

## Notes
- Some smoke test/session documents reference legacy table names (`tasks`, `task_contexts`, `yacht_tasks`). This is expected for historical records; the canonical architecture uses `task_templates`, `task_assignments`, `task_instances`.

