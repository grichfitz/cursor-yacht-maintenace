create extension if not exists "uuid-ossp";
create table roles (
id uuid primary key default uuid_generate_v4(),
name text not null unique
);
create table user_roles (
user_id uuid primary key references auth.users(id) on delete restrict,
role_id uuid not null references roles(id) on delete restrict
);
create table groups (
id uuid primary key default uuid_generate_v4(),
name text not null,
created_at timestamptz not null default now(),
archived_at timestamptz null
);
create table group_memberships (
user_id uuid not null references auth.users(id) on delete restrict,
group_id uuid not null references groups(id) on delete restrict,
created_at timestamptz not null default now(),
primary key (user_id, group_id)
);
create table yachts (
id uuid primary key default uuid_generate_v4(),
group_id uuid not null references groups(id) on delete restrict,
name text not null,
archived_at timestamptz null
);
create table yacht_owners (
yacht_id uuid not null references yachts(id) on delete restrict,
user_id uuid not null references auth.users(id) on delete restrict,
primary key (yacht_id, user_id)
);
create table template_categories (
id uuid primary key default uuid_generate_v4(),
name text not null,
description text null,
archived_at timestamptz null
);
create table global_templates (
id uuid primary key default uuid_generate_v4(),
title text not null,
description text null,
interval_days integer null,
checklist_json jsonb null,
archived_at timestamptz null
);
create table category_templates (
category_id uuid not null references template_categories(id) on delete restrict,
global_template_id uuid not null references global_templates(id) on delete restrict,
primary key (category_id, global_template_id)
);
create table group_templates (
id uuid primary key default uuid_generate_v4(),
group_id uuid not null references groups(id) on delete restrict,
origin_global_template_id uuid null references global_templates(id) on delete restrict,
title text not null,
description text null,
interval_days integer null,
checklist_json jsonb null,
active boolean not null default true,
archived_at timestamptz null
);
create table yacht_tasks (
id uuid primary key default uuid_generate_v4(),
yacht_id uuid not null references yachts(id) on delete restrict,
group_template_id uuid null references group_templates(id) on delete restrict,
origin_global_template_id uuid null references global_templates(id) on delete restrict,
title text not null,
description text null,
interval_days integer null,
checklist_json jsonb null,
due_date timestamptz null,
status text not null check (status in ('open','pending_review','approved')),
owner_user_id uuid null references auth.users(id) on delete restrict,
completed_at timestamptz null,
completed_by uuid null references auth.users(id) on delete restrict,
approved_at timestamptz null,
approved_by uuid null references auth.users(id) on delete restrict,
deleted_at timestamptz null,
created_at timestamptz not null default now()
);
create unique index yacht_tasks_unique_open_per_yacht_group_template
on yacht_tasks (yacht_id, group_template_id)
where group_template_id is not null
and deleted_at is null
and status <> 'approved';
create unique index yacht_tasks_unique_open_per_yacht_global_template
on yacht_tasks (yacht_id, origin_global_template_id)
where origin_global_template_id is not null
and deleted_at is null
and status <> 'approved';





create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
select exists (
select 1
from public.user_roles ur
join public.roles r on r.id = ur.role_id
where ur.user_id = auth.uid()
and r.name = 'admin'
);
$$;
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
select r.name
from public.user_roles ur
join public.roles r on r.id = ur.role_id
where ur.user_id = auth.uid()
limit 1;
$$;
create or replace function public.user_group_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
if public.is_admin() then
return query
select g.id
from public.groups g;
else
return query
select gm.group_id
from public.group_memberships gm
where gm.user_id = auth.uid();
end if;
end;
$$;
create or replace function public.user_yacht_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
role_name text;
begin
if public.is_admin() then
return query
select y.id
from public.yachts y;
return;
end if;
role_name := public.current_user_role();
if role_name in ('manager', 'crew') then
return query
select y.id
from public.yachts y
where y.group_id in (select public.user_group_ids());
elsif role_name = 'owner' then
return query
select yo.yacht_id
from public.yacht_owners yo
where yo.user_id = auth.uid();
else
return;
end if;
end;
$$;
revoke all on function public.is_admin() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.user_group_ids() from public;
revoke all on function public.user_yacht_ids() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.user_group_ids() to authenticated;
grant execute on function public.user_yacht_ids() to authenticated;




alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.yachts enable row level security;
alter table public.yacht_owners enable row level security;
alter table public.template_categories enable row level security;
alter table public.global_templates enable row level security;
alter table public.category_templates enable row level security;
alter table public.group_templates enable row level security;
alter table public.yacht_tasks enable row level security;
alter table public.user_roles enable row level security;
create policy groups_select_admin_all
on public.groups
for select
to authenticated
using (public.is_admin());
create policy groups_select_manager_crew_in_groups
on public.groups
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and id in (select public.user_group_ids())
);
create policy group_memberships_select_admin_all
on public.group_memberships
for select
to authenticated
using (public.is_admin());
create policy group_memberships_select_manager_crew_in_groups
on public.group_memberships
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and group_id in (select public.user_group_ids())
);
create policy yachts_select_admin_all
on public.yachts
for select
to authenticated
using (public.is_admin());
create policy yachts_select_manager_crew_in_scope
on public.yachts
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and id in (select public.user_yacht_ids())
);
create policy yachts_select_owner_in_scope
on public.yachts
for select
to authenticated
using (
public.current_user_role() = 'owner'
and id in (select public.user_yacht_ids())
);
create policy yacht_owners_select_admin_all
on public.yacht_owners
for select
to authenticated
using (public.is_admin());
create policy yacht_owners_select_manager_crew_in_scope
on public.yacht_owners
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and yacht_id in (select public.user_yacht_ids())
);
create policy template_categories_select_admin_all
on public.template_categories
for select
to authenticated
using (public.is_admin());
create policy template_categories_select_manager_crew_visible
on public.template_categories
for select
to authenticated
using (public.current_user_role() in ('manager','crew'));
create policy global_templates_select_admin_all
on public.global_templates
for select
to authenticated
using (public.is_admin());
create policy global_templates_select_manager_crew_visible
on public.global_templates
for select
to authenticated
using (public.current_user_role() in ('manager','crew'));
create policy category_templates_select_admin_all
on public.category_templates
for select
to authenticated
using (public.is_admin());
create policy category_templates_select_manager_crew_visible
on public.category_templates
for select
to authenticated
using (public.current_user_role() in ('manager','crew'));
create policy group_templates_select_admin_all
on public.group_templates
for select
to authenticated
using (public.is_admin());
create policy group_templates_select_manager_crew_in_groups
on public.group_templates
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and group_id in (select public.user_group_ids())
);
create policy yacht_tasks_select_admin_all
on public.yacht_tasks
for select
to authenticated
using (public.is_admin());
create policy yacht_tasks_select_manager_crew_in_scope
on public.yacht_tasks
for select
to authenticated
using (
public.current_user_role() in ('manager','crew')
and yacht_id in (select public.user_yacht_ids())
);
create policy yacht_tasks_select_owner_approved_in_scope
on public.yacht_tasks
for select
to authenticated
using (
public.current_user_role() = 'owner'
and status = 'approved'
and yacht_id in (select public.user_yacht_ids())
);
create policy user_roles_select_admin_all
on public.user_roles
for select
to authenticated
using (public.is_admin());
create policy user_roles_select_self
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());
create policy yacht_owners_select_owner_self
on public.yacht_owners
for select
to authenticated
using (
public.current_user_role() = 'owner'
and user_id = auth.uid()
);




begin;
insert into public.roles (name)
values ('admin'), ('manager'), ('crew'), ('owner')
on conflict (name) do nothing;
do $$
declare
v_admin_role_id uuid;
v_manager_role_id uuid;
v_crew_role_id uuid;
v_owner_role_id uuid;
v_group_a_id uuid;
v_yacht_one_id uuid;
begin
select id into v_admin_role_id from public.roles where name = 'admin';
select id into v_manager_role_id from public.roles where name = 'manager';
select id into v_crew_role_id from public.roles where name = 'crew';
select id into v_owner_role_id from public.roles where name = 'owner';
insert into public.user_roles (user_id, role_id)
values
('b75b8df6-4806-48f3-886c-b199ceacd78f', v_admin_role_id),
('29dddc5c-9123-443d-a9fa-2102288a2528', v_manager_role_id),
('bb351b40-e139-45bc-ac78-4da8a805b2a2', v_crew_role_id),
('26d36496-a807-4a55-9e83-177af991ea05', v_owner_role_id)
on conflict (user_id) do update
set role_id = excluded.role_id;
select g.id
into v_group_a_id
from public.groups g
where g.name = 'Group A'
and g.archived_at is null
order by g.created_at asc
limit 1;
if v_group_a_id is null then
insert into public.groups (name)
values ('Group A')
returning id into v_group_a_id;
end if;
select y.id
into v_yacht_one_id
from public.yachts y
where y.group_id = v_group_a_id
and y.name = 'Yacht One'
and y.archived_at is null
limit 1;
if v_yacht_one_id is null then
insert into public.yachts (group_id, name)
values (v_group_a_id, 'Yacht One')
returning id into v_yacht_one_id;
end if;
insert into public.group_memberships (user_id, group_id)
values
('29dddc5c-9123-443d-a9fa-2102288a2528', v_group_a_id),
('bb351b40-e139-45bc-ac78-4da8a805b2a2', v_group_a_id)
on conflict (user_id, group_id) do nothing;
insert into public.yacht_owners (yacht_id, user_id)
values (v_yacht_one_id, '26d36496-a807-4a55-9e83-177af991ea05')
on conflict (yacht_id, user_id) do nothing;
end;
$$;
commit;



create policy groups_insert_admin
on public.groups
for insert
to authenticated
with check (public.is_admin());
create policy groups_update_admin
on public.groups
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy groups_delete_admin
on public.groups
for delete
to authenticated
using (public.is_admin());
create policy group_memberships_insert_admin
on public.group_memberships
for insert
to authenticated
with check (public.is_admin());
create policy group_memberships_update_admin
on public.group_memberships
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy group_memberships_delete_admin
on public.group_memberships
for delete
to authenticated
using (public.is_admin());
create policy yachts_insert_admin
on public.yachts
for insert
to authenticated
with check (public.is_admin());
create policy yachts_update_admin
on public.yachts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy yachts_delete_admin
on public.yachts
for delete
to authenticated
using (public.is_admin());
create policy yacht_owners_insert_admin
on public.yacht_owners
for insert
to authenticated
with check (public.is_admin());
create policy yacht_owners_update_admin
on public.yacht_owners
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy yacht_owners_delete_admin
on public.yacht_owners
for delete
to authenticated
using (public.is_admin());
create policy template_categories_insert_admin
on public.template_categories
for insert
to authenticated
with check (public.is_admin());
create policy template_categories_update_admin
on public.template_categories
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy template_categories_delete_admin
on public.template_categories
for delete
to authenticated
using (public.is_admin());
create policy global_templates_insert_admin
on public.global_templates
for insert
to authenticated
with check (public.is_admin());
create policy global_templates_update_admin
on public.global_templates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy global_templates_delete_admin
on public.global_templates
for delete
to authenticated
using (public.is_admin());
create policy category_templates_insert_admin
on public.category_templates
for insert
to authenticated
with check (public.is_admin());
create policy category_templates_update_admin
on public.category_templates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy category_templates_delete_admin
on public.category_templates
for delete
to authenticated
using (public.is_admin());
create policy group_templates_insert_admin
on public.group_templates
for insert
to authenticated
with check (public.is_admin());
create policy group_templates_update_admin
on public.group_templates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy group_templates_delete_admin
on public.group_templates
for delete
to authenticated
using (public.is_admin());
create policy group_templates_insert_manager_in_groups
on public.group_templates
for insert
to authenticated
with check (
public.current_user_role() = 'manager'
and group_id in (select public.user_group_ids())
);
create policy group_templates_update_manager_in_groups
on public.group_templates
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
create policy group_templates_delete_manager_in_groups
on public.group_templates
for delete
to authenticated
using (
public.current_user_role() = 'manager'
and group_id in (select public.user_group_ids())
);
create policy yacht_tasks_insert_admin
on public.yacht_tasks
for insert
to authenticated
with check (public.is_admin());
create policy yacht_tasks_update_admin
on public.yacht_tasks
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy yacht_tasks_delete_admin
on public.yacht_tasks
for delete
to authenticated
using (public.is_admin());
create policy yacht_tasks_insert_manager_in_scope
on public.yacht_tasks
for insert
to authenticated
with check (
public.current_user_role() = 'manager'
and yacht_id in (select public.user_yacht_ids())
);
create policy yacht_tasks_update_manager_in_scope
on public.yacht_tasks
for update
to authenticated
using (
public.current_user_role() = 'manager'
and yacht_id in (select public.user_yacht_ids())
)
with check (
public.current_user_role() = 'manager'
and yacht_id in (select public.user_yacht_ids())
);
create policy yacht_tasks_delete_manager_in_scope
on public.yacht_tasks
for delete
to authenticated
using (
public.current_user_role() = 'manager'
and yacht_id in (select public.user_yacht_ids())
);
create policy yacht_tasks_insert_crew_in_scope
on public.yacht_tasks
for insert
to authenticated
with check (
public.current_user_role() = 'crew'
and yacht_id in (select public.user_yacht_ids())
);
create policy yacht_tasks_update_crew_in_scope
on public.yacht_tasks
for update
to authenticated
using (
public.current_user_role() = 'crew'
and yacht_id in (select public.user_yacht_ids())
)
with check (
public.current_user_role() = 'crew'
and yacht_id in (select public.user_yacht_ids())
);
create policy user_roles_insert_admin
on public.user_roles
for insert
to authenticated
with check (public.is_admin());
create policy user_roles_update_admin
on public.user_roles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy user_roles_delete_admin
on public.user_roles
for delete
to authenticated
using (public.is_admin());




