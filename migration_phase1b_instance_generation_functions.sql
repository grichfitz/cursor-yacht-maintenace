-- PHASE 1B — Manual instance generation + cancellation (YM architecture)
--
-- STRICT: schema-only change (functions only).
-- - Do NOT modify existing tables / constraints
-- - Do NOT alter RLS
-- - Do NOT add triggers
-- - Do NOT auto-run anything
--
-- Manual execution examples:
--   select public.generate_task_instances();
--   select public.cancel_instances_for_unlinked_templates();

begin;

/* -------------------------------------------------------------------------- */
/* 1) generate_task_instances()                                                */
/* -------------------------------------------------------------------------- */

create or replace function public.generate_task_instances()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Group-scoped generation (with descendant cascade).
  --
  -- Note: we dedupe (template_id, yacht_id) pairs BEFORE generating UUIDs to
  -- avoid accidental duplicates when a template is linked to overlapping groups
  -- (e.g., both a parent and a child group).
  with recursive group_tree as (
    select
      tgl.template_id,
      tgl.group_id
    from public.template_group_links tgl

    union all

    select
      gt.template_id,
      child.id as group_id
    from group_tree gt
    join public.groups child on child.parent_group_id = gt.group_id
  ),
  candidate_pairs as (
    select distinct
      t.id as template_id,
      y.id as yacht_id,
      t.name as template_name,
      t.description as template_description
    from public.task_templates t
    join group_tree gt on gt.template_id = t.id
    join public.yachts y on y.group_id = gt.group_id
  )
  insert into public.task_instances (
    id,
    template_id,
    yacht_id,
    status,
    due_at,
    created_at,
    template_name,
    template_description
  )
  select
    gen_random_uuid(),
    cp.template_id,
    cp.yacht_id,
    'pending'::public.task_instance_status,
    now(),
    now(),
    cp.template_name,
    cp.template_description
  from candidate_pairs cp
  where not exists (
    select 1
    from public.task_instances ti
    where ti.template_id = cp.template_id
      and ti.yacht_id = cp.yacht_id
  );

  -- Manual yacht-scoped generation.
  with manual_pairs as (
    select distinct
      t.id as template_id,
      tyl.yacht_id as yacht_id,
      t.name as template_name,
      t.description as template_description
    from public.task_templates t
    join public.template_yacht_links tyl on tyl.template_id = t.id
  )
  insert into public.task_instances (
    id,
    template_id,
    yacht_id,
    status,
    due_at,
    created_at,
    template_name,
    template_description
  )
  select
    gen_random_uuid(),
    mp.template_id,
    mp.yacht_id,
    'pending'::public.task_instance_status,
    now(),
    now(),
    mp.template_name,
    mp.template_description
  from manual_pairs mp
  where not exists (
    select 1
    from public.task_instances ti
    where ti.template_id = mp.template_id
      and ti.yacht_id = mp.yacht_id
  );
end;
$$;

/* -------------------------------------------------------------------------- */
/* 2) cancel_instances_for_unlinked_templates()                                */
/* -------------------------------------------------------------------------- */

create or replace function public.cancel_instances_for_unlinked_templates()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Safety guard: Phase 1 migrations in this repo define task_instance_status
  -- without a 'cancelled' label. We do NOT alter types in this phase, so fail
  -- fast with a clear message if 'cancelled' doesn't exist.
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'task_instance_status'
      and e.enumlabel = 'cancelled'
  ) then
    raise exception
      'Cannot cancel instances: enum public.task_instance_status lacks label ''cancelled''. Add it in a separate migration before running this function.';
  end if;

  -- Symmetric with generate_task_instances():
  -- - Build recursive group scope for each template_group_links entry (descendant cascade)
  -- - Compute valid (template_id, yacht_id) pairs from group scope and manual yacht links
  -- - Cancel only pending instances that are not valid via either path
  with recursive group_tree as (
    select
      tgl.template_id,
      tgl.group_id
    from public.template_group_links tgl

    union all

    select
      gt.template_id,
      child.id as group_id
    from group_tree gt
    join public.groups child on child.parent_group_id = gt.group_id
  ),
  candidate_pairs as (
    select distinct
      t.id as template_id,
      y.id as yacht_id
    from public.task_templates t
    join group_tree gt on gt.template_id = t.id
    join public.yachts y on y.group_id = gt.group_id
  ),
  manual_pairs as (
    select distinct
      t.id as template_id,
      tyl.yacht_id as yacht_id
    from public.task_templates t
    join public.template_yacht_links tyl on tyl.template_id = t.id
  ),
  valid_pairs as (
    select template_id, yacht_id from candidate_pairs
    union
    select template_id, yacht_id from manual_pairs
  )
  update public.task_instances ti
  set status = 'cancelled'::public.task_instance_status
  where ti.status = 'pending'::public.task_instance_status
    and not exists (
      select 1
      from valid_pairs vp
      where vp.template_id = ti.template_id
        and vp.yacht_id = ti.yacht_id
    );
end;
$$;

commit;

