-- BOOTSTRAP FIXES (Phase 1/2): unblock RLS lockout scenarios
--
-- Symptoms addressed:
-- - Admin can't see task_instances / yachts due to missing override policies
-- - Admin can't manage group membership (no group_members ALL policy)
-- - Visibility empty until group_members populated (expected) but admin needs tooling
--
-- Apply manually in Supabase SQL editor.

/* -------------------------------------------------------------------------- */
/* 1) Ensure your user is admin                                                */
/* -------------------------------------------------------------------------- */
-- Run ONE of these (pick what you know):
--
-- By email:
-- update public.users set role = 'admin' where lower(email) = lower('grichfitz@hotmail.com');
--
-- By user id:
-- update public.users set role = 'admin' where id = '<uuid>';

/* -------------------------------------------------------------------------- */
/* 2) Admin override SELECT policies                                           */
/* -------------------------------------------------------------------------- */

-- task_instances: admin can always SELECT
alter table public.task_instances enable row level security;
drop policy if exists task_instances_select_admin_override on public.task_instances;
create policy task_instances_select_admin_override
  on public.task_instances
  for select
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

-- yachts: admin can always SELECT
alter table public.yachts enable row level security;
drop policy if exists yachts_select_admin_override on public.yachts;
create policy yachts_select_admin_override
  on public.yachts
  for select
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* -------------------------------------------------------------------------- */
/* 3) group_members: admin manages group membership (ALL)                      */
/* -------------------------------------------------------------------------- */

alter table public.group_members enable row level security;
drop policy if exists "admin manages group members" on public.group_members;
create policy "admin manages group members"
  on public.group_members
  for all
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

