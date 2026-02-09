-- ULTRA: React renders. SQL scopes.
--
-- Yacht-specific task edits must NOT change global task templates.
-- We store yacht-scoped overrides via a dedicated scope row in task_contexts:
--   task_contexts(yacht_id, task_id, category_id = null)
-- and keep overrides in this table keyed by task_context_id.
--
-- This avoids rewriting history: existing task_results stay attached to their original task_context_id.

begin;

create table if not exists public.task_context_overrides (
  task_context_id uuid primary key references public.task_contexts(id) on delete cascade,
  name_override text,
  description_override text,
  default_unit_of_measure_id_override uuid references public.units_of_measure(id),
  default_period_id_override uuid references public.periods(id),
  updated_at timestamp with time zone not null default now()
);

create index if not exists task_context_overrides_updated_at_idx
  on public.task_context_overrides (updated_at);

commit;

