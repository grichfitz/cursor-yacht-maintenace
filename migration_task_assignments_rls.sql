-- ULTRA (Canonical): RLS for task_assignments
--
-- Canonical model reference: `docs/HIERARCHICAL_TASK_ASSIGNMENTS.md`
--
-- Goal:
-- - Allow a user to READ assignments defined on:
--   - their visible group subtree (membership + descendants) AND
--   - ancestor groups (to support parent→child propagation)
-- - Allow a user to WRITE assignments only within their visible group subtree
--   (never mutate parent assignments from a child group).
--
-- Apply manually in Supabase SQL editor.

begin;

-- Helper: visible groups + ancestors (for downward propagation reads).
-- Depends on existing public.visible_group_ids() introduced in stabilisation.
create or replace function public.visible_group_ids_with_ancestors()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive
    visible as (
      select id
      from public.visible_group_ids() as id
    ),
    ancestors as (
      select g.id, g.parent_group_id
      from public.groups g
      join visible v on v.id = g.id

      union

      select parent.id, parent.parent_group_id
      from public.groups parent
      join ancestors a on a.parent_group_id = parent.id
    )
  select distinct id from visible
  union
  select distinct id from ancestors;
$$;

alter table public.task_assignments enable row level security;

-- READ: visible groups + ancestors.
drop policy if exists task_assignments_select_visible on public.task_assignments;
create policy task_assignments_select_visible
  on public.task_assignments
  for select
  using (
    group_id in (select public.visible_group_ids_with_ancestors())
  );

-- WRITE: only within visible subtree (never ancestors).
drop policy if exists task_assignments_insert_visible on public.task_assignments;
create policy task_assignments_insert_visible
  on public.task_assignments
  for insert
  with check (
    group_id in (select public.visible_group_ids())
  );

drop policy if exists task_assignments_update_visible on public.task_assignments;
create policy task_assignments_update_visible
  on public.task_assignments
  for update
  using (
    group_id in (select public.visible_group_ids())
  )
  with check (
    group_id in (select public.visible_group_ids())
  );

drop policy if exists task_assignments_delete_visible on public.task_assignments;
create policy task_assignments_delete_visible
  on public.task_assignments
  for delete
  using (
    group_id in (select public.visible_group_ids())
  );

commit;

