-- ULTRA: Task visibility + "take ownership" (crew self-assign)
--
-- Desired behavior:
-- - If a user is a member of a group that owns a yacht, they can READ that yacht's task instances
--   (crew + manager).
-- - Crew can "take ownership" of an unassigned task instance:
--   - inserts a task_assignments row where assigned_to = assigned_by = auth.uid()
--   - updates task_instances.status to 'assigned'
-- - Crew can still only complete tasks assigned to them (status -> completed).
-- - Managers/Admins can assign/verify within their visible groups.
--
-- IMPORTANT:
-- This migration avoids relying on the JWT role claim being up-to-date by reading `public.users.role`
-- directly in RLS checks.
--
-- Apply manually in Supabase SQL editor.

begin;

/* -------------------------------------------------------------------------- */
/* 1) Helpers                                                                  */
/* -------------------------------------------------------------------------- */

-- Current user's app role from public.users (default: crew).
create or replace function public.my_app_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((select u.role::text from public.users u where u.id = auth.uid()), 'crew');
$$;

-- Direct memberships (support both legacy user_group_links and canonical group_members).
create or replace function public.my_direct_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = auth.uid()
  union
  select ugl.group_id
  from public.user_group_links ugl
  where ugl.user_id = auth.uid();
$$;

-- Visible groups = direct memberships + descendants.
create or replace function public.visible_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with recursive
    seed as (
      select id
      from public.groups
      where id in (select public.my_direct_group_ids())
    ),
    tree as (
      select s.id
      from seed s
      union
      select g.id
      from public.groups g
      join tree t on t.id = g.parent_group_id
    )
  select distinct id from tree;
$$;

/* -------------------------------------------------------------------------- */
/* 2) task_instances                                                           */
/* -------------------------------------------------------------------------- */

alter table public.task_instances enable row level security;

-- Replace role-specific SELECT policies with one "visible yacht group" rule.
drop policy if exists task_instances_select_admin_override on public.task_instances;
drop policy if exists task_instances_select_admin on public.task_instances;
drop policy if exists task_instances_select_manager on public.task_instances;
drop policy if exists task_instances_select_crew on public.task_instances;
drop policy if exists task_instances_select_by_role on public.task_instances;

create policy task_instances_select_visible_groups
  on public.task_instances
  for select
  to authenticated
  using (
    public.yacht_group_id(public.task_instances.yacht_id) in (select public.visible_group_ids())
  );

-- UPDATE policies (guarded by trigger; RLS gates which rows are mutable).
drop policy if exists task_instances_update_admin_manager on public.task_instances;
drop policy if exists task_instances_update_crew_complete_only on public.task_instances;

create policy task_instances_update_manager_admin_visible
  on public.task_instances
  for update
  to authenticated
  using (
    public.my_app_role() in ('admin','manager')
    and public.task_instance_group_id(public.task_instances.id) in (select public.visible_group_ids())
  )
  with check (
    public.my_app_role() in ('admin','manager')
  );

create policy task_instances_update_crew_assigned_only
  on public.task_instances
  for update
  to authenticated
  using (
    public.my_app_role() = 'crew'
    and public.is_assigned_to_me(public.task_instances.id)
  )
  with check (
    public.my_app_role() = 'crew'
  );

/* -------------------------------------------------------------------------- */
/* 3) task_assignments                                                         */
/* -------------------------------------------------------------------------- */

alter table public.task_assignments enable row level security;

-- Replace role-specific SELECT policies.
drop policy if exists task_assignments_select_admin on public.task_assignments;
drop policy if exists task_assignments_select_manager on public.task_assignments;
drop policy if exists task_assignments_select_crew on public.task_assignments;
drop policy if exists task_assignments_select_by_role on public.task_assignments;
drop policy if exists task_assignments_select_visible on public.task_assignments;

create policy task_assignments_select_visible
  on public.task_assignments
  for select
  to authenticated
  using (
    -- Managers/Admins can read assignments for visible group tasks.
    (
      public.my_app_role() in ('admin','manager')
      and public.task_instance_group_id(public.task_assignments.task_instance_id) in (select public.visible_group_ids())
    )
    -- Crew can always read their own assignment row.
    or public.task_assignments.assigned_to = auth.uid()
  );

-- INSERT: managers/admins assign within visible groups; crew can self-assign pending tasks.
drop policy if exists task_assignments_insert_admin_manager on public.task_assignments;
drop policy if exists task_assignments_insert_visible on public.task_assignments;

create policy task_assignments_insert_take_or_assign
  on public.task_assignments
  for insert
  to authenticated
  with check (
    (
      public.my_app_role() in ('admin','manager')
      and public.task_instance_group_id(public.task_assignments.task_instance_id) in (select public.visible_group_ids())
      and public.task_assignments.assigned_by = auth.uid()
    )
    or (
      public.my_app_role() = 'crew'
      and public.task_assignments.assigned_to = auth.uid()
      and public.task_assignments.assigned_by = auth.uid()
      and public.task_instance_group_id(public.task_assignments.task_instance_id) in (select public.visible_group_ids())
      and exists (
        select 1
        from public.task_instances ti
        where ti.id = public.task_assignments.task_instance_id
          and ti.status = 'pending'
      )
    )
  );

/* -------------------------------------------------------------------------- */
/* 4) Trigger: allow crew to set status to assigned when self-assigned          */
/* -------------------------------------------------------------------------- */

create or replace function public.enforce_task_instance_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app_role text := public.my_app_role();
begin
  -- Block any non-status field mutations.
  if new.template_id is distinct from old.template_id
     or new.yacht_id is distinct from old.yacht_id
     or new.due_at is distinct from old.due_at
     or new.template_name is distinct from old.template_name
     or new.template_description is distinct from old.template_description
     or new.created_at is distinct from old.created_at then
    raise exception 'Only status updates are permitted on task_instances';
  end if;

  if app_role = 'crew' then
    -- Crew may "take ownership" (pending -> assigned) once they are assigned_to_me.
    if new.status = 'assigned' then
      if old.status <> 'pending' then
        raise exception 'Crew can only take ownership from pending';
      end if;
      if not public.is_assigned_to_me(old.id) then
        raise exception 'Crew can only set status to assigned if assigned to them';
      end if;
      return new;
    end if;

    -- Crew may complete only from assigned.
    if new.status = 'completed' then
      if old.status <> 'assigned' then
        raise exception 'Crew can only complete from assigned';
      end if;
      if not public.is_assigned_to_me(old.id) then
        raise exception 'Crew can only complete tasks assigned to them';
      end if;
      return new;
    end if;

    raise exception 'Crew can only set status to assigned or completed';
  end if;

  if app_role in ('admin','manager') then
    if new.status not in ('assigned','verified') then
      raise exception 'Managers/Admins can only set status to assigned or verified';
    end if;
    return new;
  end if;

  raise exception 'Not permitted';
end;
$$;

commit;

