-- ULTRA (Canonical): Task assignments with downward inheritance
--
-- This is an additive migration. It does NOT remove legacy tables (`task_contexts`, etc).
-- Canonical model reference: `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`
--
-- Creates:
-- - public.task_assignments (group binding + inherits_from_assignment_id + override_data jsonb)
--
-- Notes:
-- - We intentionally reference existing `public.tasks` as the current template table.
--   (Future refactor can alias/rename to `task_templates` once approved.)
--
-- Apply manually in Supabase SQL editor.

begin;

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),

  -- Scope: the group this assignment is defined on.
  group_id uuid not null references public.groups(id) on delete cascade,

  -- Template: currently `public.tasks` in the live schema snapshot.
  task_id uuid not null references public.tasks(id) on delete restrict,

  -- Optional inheritance link when this row is a child override/shadow.
  inherits_from_assignment_id uuid null references public.task_assignments(id) on delete set null,

  -- Sparse field-level overrides only; merged at runtime.
  override_data jsonb not null default '{}'::jsonb,

  is_archived boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Prevent duplicates per group+template.
create unique index if not exists task_assignments_group_task_uniq
  on public.task_assignments (group_id, task_id)
  where is_archived = false;

create index if not exists task_assignments_group_id_idx
  on public.task_assignments (group_id);

create index if not exists task_assignments_task_id_idx
  on public.task_assignments (task_id);

create index if not exists task_assignments_inherits_from_idx
  on public.task_assignments (inherits_from_assignment_id);

commit;

