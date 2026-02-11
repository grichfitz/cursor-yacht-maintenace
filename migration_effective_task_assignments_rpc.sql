-- ULTRA (Canonical): SQL-authoritative effective task assignments
--
-- Canonical merge rules:
--   task_template (public.tasks for now)
--     → parent_assignment.override_data
--     → child_override.override_data
--
-- This migration adds an RPC function for the frontend to use, so inheritance logic
-- is NOT computed in React.
--
-- Apply manually in Supabase SQL editor.

begin;

create or replace function public.effective_task_assignments(target_group_id uuid)
returns table (
  task_id uuid,
  task_name text,
  task_description text,
  default_unit_of_measure_id uuid,
  default_period_id uuid,
  effective_override_data jsonb,
  effective_assignment_id uuid,
  source_group_id uuid,
  is_local boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive group_chain as (
    select g.id as group_id, g.parent_group_id, 0 as depth
    from public.groups g
    where g.id = target_group_id
      and exists (
        select 1
        from public.visible_group_ids() as id
        where id = target_group_id
      )

    union all

    select parent.id as group_id, parent.parent_group_id, gc.depth + 1 as depth
    from public.groups parent
    join group_chain gc on gc.parent_group_id = parent.id
    where gc.parent_group_id is not null
  ),
  candidates as (
    select
      ta.id,
      ta.group_id,
      ta.task_id,
      ta.inherits_from_assignment_id,
      ta.override_data,
      ta.created_at,
      gc.depth
    from public.task_assignments ta
    join group_chain gc on gc.group_id = ta.group_id
    where ta.is_archived = false
  ),
  picked as (
    -- Shadowing: choose the closest assignment in the ancestor chain (depth=0 is most local).
    select distinct on (task_id)
      id,
      group_id,
      task_id,
      inherits_from_assignment_id,
      override_data
    from candidates
    order by task_id, depth asc, created_at desc
  ),
  merge_chain as (
    -- Start at the picked assignment (leaf override, if any) and walk up inherits_from,
    -- accumulating a jsonb merge where leaf keys win.
    select
      p.id as leaf_assignment_id,
      p.group_id as leaf_group_id,
      p.task_id,
      p.inherits_from_assignment_id,
      coalesce(p.override_data, '{}'::jsonb) as merged_override
    from picked p

    union all

    select
      mc.leaf_assignment_id,
      mc.leaf_group_id,
      mc.task_id,
      parent.inherits_from_assignment_id,
      coalesce(parent.override_data, '{}'::jsonb) || mc.merged_override as merged_override
    from merge_chain mc
    join public.task_assignments parent on parent.id = mc.inherits_from_assignment_id
    where mc.inherits_from_assignment_id is not null
  ),
  merged as (
    -- Final merged override is the row where inherits_from is null (top of chain).
    select
      leaf_assignment_id,
      leaf_group_id,
      task_id,
      merged_override
    from merge_chain
    where inherits_from_assignment_id is null
  )
  select
    t.id as task_id,
    coalesce(m.merged_override ->> 'name', t.name) as task_name,
    coalesce(m.merged_override ->> 'description', t.description) as task_description,
    coalesce(nullif(m.merged_override ->> 'default_unit_of_measure_id', '')::uuid, t.default_unit_of_measure_id) as default_unit_of_measure_id,
    coalesce(nullif(m.merged_override ->> 'default_period_id', '')::uuid, t.default_period_id) as default_period_id,
    m.merged_override as effective_override_data,
    m.leaf_assignment_id as effective_assignment_id,
    m.leaf_group_id as source_group_id,
    (m.leaf_group_id = target_group_id) as is_local
  from merged m
  join public.tasks t on t.id = m.task_id;
$$;

commit;

