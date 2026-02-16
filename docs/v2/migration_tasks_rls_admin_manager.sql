-- YM v2: Allow admin + manager to manage tasks.
-- This fixes: "new row violates row-level security policy for table 'tasks'"
--
-- Scope rules:
-- - admin: all tasks
-- - manager: tasks whose yacht belongs to a group in user_group_ids()
--
-- Apply in Supabase SQL Editor (or migrations pipeline).

begin;

-- Ensure RLS is enabled (safe if already enabled).
alter table public.tasks enable row level security;

-- Drop existing policies if you are iterating locally (only these names).
drop policy if exists tasks_select_admin_all on public.tasks;
drop policy if exists tasks_insert_admin on public.tasks;
drop policy if exists tasks_update_admin on public.tasks;
drop policy if exists tasks_delete_admin on public.tasks;

drop policy if exists tasks_select_manager_in_scope on public.tasks;
drop policy if exists tasks_insert_manager_in_scope on public.tasks;
drop policy if exists tasks_update_manager_in_scope on public.tasks;
drop policy if exists tasks_delete_manager_in_scope on public.tasks;

-- Admin: full access
create policy tasks_select_admin_all
on public.tasks
for select
to authenticated
using (public.is_admin());

create policy tasks_insert_admin
on public.tasks
for insert
to authenticated
with check (public.is_admin());

create policy tasks_update_admin
on public.tasks
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy tasks_delete_admin
on public.tasks
for delete
to authenticated
using (public.is_admin());

-- Manager: scoped by yachts in group subtree
create policy tasks_select_manager_in_scope
on public.tasks
for select
to authenticated
using (
  public.current_user_role() = 'manager'
  and yacht_id in (
    select y.id
    from public.yachts y
    where y.group_id in (select public.user_group_ids())
  )
);

create policy tasks_insert_manager_in_scope
on public.tasks
for insert
to authenticated
with check (
  public.current_user_role() = 'manager'
  and yacht_id in (
    select y.id
    from public.yachts y
    where y.group_id in (select public.user_group_ids())
  )
);

create policy tasks_update_manager_in_scope
on public.tasks
for update
to authenticated
using (
  public.current_user_role() = 'manager'
  and yacht_id in (
    select y.id
    from public.yachts y
    where y.group_id in (select public.user_group_ids())
  )
)
with check (
  public.current_user_role() = 'manager'
  and yacht_id in (
    select y.id
    from public.yachts y
    where y.group_id in (select public.user_group_ids())
  )
);

create policy tasks_delete_manager_in_scope
on public.tasks
for delete
to authenticated
using (
  public.current_user_role() = 'manager'
  and yacht_id in (
    select y.id
    from public.yachts y
    where y.group_id in (select public.user_group_ids())
  )
);

commit;

