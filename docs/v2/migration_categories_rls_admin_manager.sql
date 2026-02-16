-- YM v2: Allow admin + manager to manage categories.
-- This fixes: "new row violates row-level security policy for table 'categories'"
--
-- Scope rules:
-- - admin: all categories
-- - manager: only categories where group_id ∈ user_group_ids()
--
-- Apply in Supabase SQL Editor (or migrations pipeline).

begin;

-- Ensure RLS is enabled (safe if already enabled).
alter table public.categories enable row level security;

-- Drop existing policies if you are iterating locally.
drop policy if exists categories_select_admin_all on public.categories;
drop policy if exists categories_insert_admin on public.categories;
drop policy if exists categories_update_admin on public.categories;
drop policy if exists categories_delete_admin on public.categories;

drop policy if exists categories_select_manager_in_scope on public.categories;
drop policy if exists categories_insert_manager_in_scope on public.categories;
drop policy if exists categories_update_manager_in_scope on public.categories;
drop policy if exists categories_delete_manager_in_scope on public.categories;

-- Admin: full access
create policy categories_select_admin_all
on public.categories
for select
to authenticated
using (public.is_admin());

create policy categories_insert_admin
on public.categories
for insert
to authenticated
with check (public.is_admin());

create policy categories_update_admin
on public.categories
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy categories_delete_admin
on public.categories
for delete
to authenticated
using (public.is_admin());

-- Manager: scoped by group subtree
create policy categories_select_manager_in_scope
on public.categories
for select
to authenticated
using (
  public.current_user_role() = 'manager'
  and group_id in (select public.user_group_ids())
);

create policy categories_insert_manager_in_scope
on public.categories
for insert
to authenticated
with check (
  public.current_user_role() = 'manager'
  and group_id in (select public.user_group_ids())
);

create policy categories_update_manager_in_scope
on public.categories
for update
to authenticated
using (
  public.current_user_role() = 'manager'
  and group_id in (select public.user_group_ids())
)
with check (
  public.current_user_role() = 'manager'
  and group_id in (select public.user_group_ids())
);

create policy categories_delete_manager_in_scope
on public.categories
for delete
to authenticated
using (
  public.current_user_role() = 'manager'
  and group_id in (select public.user_group_ids())
);

commit;

