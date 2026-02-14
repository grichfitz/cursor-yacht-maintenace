-- PHASE 1 (Spec: docs/PHASE1_ROLES_EDITOR_OPERATIONS.md)
--
-- Goal:
-- - Roles: admin / manager / crew (users.role)
-- - Multi-group membership (group_members)
-- - Operational task flow tables:
--   task_templates -> task_instances -> task_assignments -> task_completions -> task_verifications
-- - Supabase RLS aligned to spec (capability by role, visibility by group)
--
-- Notes / compatibility:
-- - This migration is additive and tries to be safe to run in a schema that already has
--   legacy tables (e.g. tasks, task_categories, *_links). It does NOT delete legacy tables.
-- - Spec states: task_templates are admin-only (incl SELECT). To allow non-admins to render
--   task instances without selecting templates, we snapshot template fields onto task_instances.
--
-- Apply manually in Supabase SQL editor.
-- NOTE: Do not wrap this whole script in a single BEGIN/COMMIT because it may
-- include role/hook setup in some projects (which can be sensitive to transactions).

/* -------------------------------------------------------------------------- */
/* 0) Enums                                                                    */
/* -------------------------------------------------------------------------- */

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'user_role') then
    create type public.user_role as enum ('admin', 'manager', 'crew');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'task_instance_status') then
    create type public.task_instance_status as enum ('pending', 'assigned', 'completed', 'verified');
  end if;
end $$;

/* -------------------------------------------------------------------------- */
/* 0.1) Postgres roles + JWT role claim hook                                   */
/* -------------------------------------------------------------------------- */

-- Phase 1 spec requires using: auth.jwt() ->> 'role' with values admin/manager/crew.
-- In Supabase, the JWT 'role' claim is also used as the database role. Therefore we:
-- - create DB roles: admin / manager / crew (NOLOGIN)
-- - make them inherit privileges from 'authenticated'
-- - install a Custom Access Token Hook to set JWT 'role' = public.users.role
--
-- IMPORTANT: After running this migration, enable the hook in Supabase Dashboard:
-- Auth -> Hooks -> Custom Access Token Hook -> select `public.custom_access_token_hook`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crew') then
    create role crew nologin inherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'manager') then
    create role manager nologin inherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'admin') then
    create role admin nologin inherit;
  end if;
end $$;

-- Inherit base privileges from authenticated.
grant authenticated to crew;
grant authenticated to manager;
grant authenticated to admin;

-- Allow Supabase API (PostgREST) to SET ROLE to these custom roles.
-- Without this, you'll see: "permission denied to set role 'crew'".
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant crew to authenticator;
    grant manager to authenticator;
    grant admin to authenticator;
  end if;
end $$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := event->'claims';
  uid uuid := nullif(event->>'user_id', '')::uuid;
  app_role text;
begin
  if uid is null then
    return jsonb_build_object('claims', claims);
  end if;

  select u.role::text
  into app_role
  from public.users u
  where u.id = uid;

  if app_role is null then
    app_role := 'crew';
  end if;

  claims := jsonb_set(claims, '{role}', to_jsonb(app_role), true);
  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

/* -------------------------------------------------------------------------- */
/* 1) users.role                                                               */
/* -------------------------------------------------------------------------- */

do $$
begin
  if to_regclass('public.users') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'users' and column_name = 'role'
    ) then
      alter table public.users
        add column role public.user_role not null default 'crew';
    end if;
  end if;
end $$;

-- Best-effort backfill: if legacy role tables exist, map them onto public.users.role
-- so existing "admin" users keep admin access.
do $$
begin
  if to_regclass('public.user_role_links') is not null and to_regclass('public.roles') is not null then
    -- Admin wins.
    update public.users u
    set role = 'admin'
    where exists (
      select 1
      from public.user_role_links url
      join public.roles r on r.id = url.role_id
      where url.user_id = u.id
        and lower(trim(r.name)) = 'admin'
    );

    -- Manager next (only if not already admin).
    update public.users u
    set role = 'manager'
    where u.role <> 'admin'
      and exists (
        select 1
        from public.user_role_links url
        join public.roles r on r.id = url.role_id
        where url.user_id = u.id
          and lower(trim(r.name)) = 'manager'
      );
  end if;
end $$;

/* -------------------------------------------------------------------------- */
/* 2) groups + group_members                                                   */
/* -------------------------------------------------------------------------- */

-- groups table is expected to already exist in this project; create it only if missing.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Compatibility: some parts of the app expect hierarchical groups.
-- Add `parent_group_id` if missing (Phase 1 spec does not forbid hierarchy).
do $$
begin
  if to_regclass('public.groups') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'groups' and column_name = 'parent_group_id'
    ) then
      alter table public.groups
        add column parent_group_id uuid null references public.groups(id) on delete set null;
    end if;
  end if;
end $$;

create index if not exists groups_parent_group_id_idx on public.groups (parent_group_id);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, group_id)
);

create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists group_members_group_id_idx on public.group_members (group_id);

/* -------------------------------------------------------------------------- */
/* 3) yachts (belongs to ONE group)                                            */
/* -------------------------------------------------------------------------- */

create table if not exists public.yachts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_id uuid not null references public.groups(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- If yachts already exists but lacks group_id, add it as nullable first, then backfill.
do $$
begin
  if to_regclass('public.yachts') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'yachts' and column_name = 'group_id'
    ) then
      alter table public.yachts add column group_id uuid null references public.groups(id) on delete restrict;
    end if;
  end if;
end $$;

-- Best-effort backfill from legacy yacht_group_links if present.
do $$
begin
  if to_regclass('public.yacht_group_links') is not null then
    execute $sql$
      update public.yachts y
      set group_id = l.group_id
      from (
        -- Postgres does not support min(uuid). Pick a deterministic first UUID instead.
        select
          yacht_id,
          (array_agg(group_id order by group_id))[1] as group_id
        from public.yacht_group_links
        group by yacht_id
      ) l
      where y.id = l.yacht_id
        and y.group_id is null
    $sql$;
  end if;
end $$;

-- Enforce NOT NULL only if no rows remain unassigned.
do $$
declare
  null_count bigint;
begin
  if to_regclass('public.yachts') is not null then
    select count(*) into null_count from public.yachts where group_id is null;
    if null_count = 0 then
      alter table public.yachts alter column group_id set not null;
    end if;
  end if;
end $$;

create index if not exists yachts_group_id_idx on public.yachts (group_id);

/* -------------------------------------------------------------------------- */
/* 4) categories                                                               */
/* -------------------------------------------------------------------------- */

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

/* -------------------------------------------------------------------------- */
/* 5) task_templates (Editor only)                                             */
/* -------------------------------------------------------------------------- */

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  category_id uuid null references public.categories(id) on delete set null,
  interval_days integer null,
  default_group_id uuid null references public.groups(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_templates_category_id_idx on public.task_templates (category_id);
create index if not exists task_templates_default_group_id_idx on public.task_templates (default_group_id);

/* -------------------------------------------------------------------------- */
/* 6) task_instances (Operational)                                             */
/* -------------------------------------------------------------------------- */

create table if not exists public.task_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete restrict,
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  status public.task_instance_status not null default 'pending',
  due_at timestamptz null,
  created_at timestamptz not null default now(),

  -- Snapshot to render instances without selecting task_templates (templates are admin-only per spec).
  template_name text not null,
  template_description text null
);

create index if not exists task_instances_yacht_id_idx on public.task_instances (yacht_id);
create index if not exists task_instances_template_id_idx on public.task_instances (template_id);
create index if not exists task_instances_status_idx on public.task_instances (status);
create index if not exists task_instances_due_at_idx on public.task_instances (due_at);

/* -------------------------------------------------------------------------- */
/* 7) task_assignments / completions / verifications                            */
/* -------------------------------------------------------------------------- */

-- IMPORTANT: This project previously used a different `public.task_assignments` table
-- (hierarchical assignments). If it exists and does NOT have `assigned_to`, rename it
-- out of the way so Phase 1 can create the operational `task_assignments`.
do $$
begin
  if to_regclass('public.task_assignments') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'task_assignments'
        and column_name = 'assigned_to'
    ) then
      alter table public.task_assignments rename to task_assignments_hierarchical;
    end if;
  end if;
end $$;

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null references public.task_instances(id) on delete cascade,
  assigned_to uuid not null references public.users(id) on delete restrict,
  assigned_by uuid not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unique (task_instance_id)
);

create index if not exists task_assignments_assigned_to_idx on public.task_assignments (assigned_to);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null references public.task_instances(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  notes text null,
  completed_at timestamptz not null default now(),
  unique (task_instance_id)
);

create index if not exists task_completions_user_id_idx on public.task_completions (user_id);

create table if not exists public.task_verifications (
  id uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null references public.task_instances(id) on delete cascade,
  verified_by uuid not null references public.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  unique (task_instance_id)
);

create index if not exists task_verifications_verified_by_idx on public.task_verifications (verified_by);

/* -------------------------------------------------------------------------- */
/* 7.1) Guardrails: prevent role-based instance mutation leaks                 */
/* -------------------------------------------------------------------------- */

-- RLS cannot restrict which columns are updated. This trigger enforces that:
-- - Crew can only update status -> 'completed' (and must not change any other fields).
-- - Manager/Admin can only update status -> 'assigned' or 'verified' (and must not change any other fields).
create or replace function public.enforce_task_instance_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_claim text := auth.jwt() ->> 'role';
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

  if role_claim = 'crew' then
    if new.status <> 'completed' then
      raise exception 'Crew can only set status to completed';
    end if;
    return new;
  end if;

  if role_claim in ('admin','manager') then
    if new.status not in ('assigned','verified') then
      raise exception 'Managers/Admins can only set status to assigned or verified';
    end if;
    return new;
  end if;

  raise exception 'Not permitted';
end;
$$;

drop trigger if exists trg_enforce_task_instance_updates on public.task_instances;
create trigger trg_enforce_task_instance_updates
before update on public.task_instances
for each row execute function public.enforce_task_instance_updates();

/* -------------------------------------------------------------------------- */
/* 7.2) Grants (ensure authenticated-derived roles can access tables)          */
/* -------------------------------------------------------------------------- */

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.groups to authenticated;
grant select, insert, update, delete on table public.group_members to authenticated;
grant select, insert, update, delete on table public.yachts to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.task_templates to authenticated;
grant select, insert, update, delete on table public.task_instances to authenticated;
grant select, insert, update, delete on table public.task_assignments to authenticated;
grant select, insert, update, delete on table public.task_completions to authenticated;
grant select, insert, update, delete on table public.task_verifications to authenticated;

/* -------------------------------------------------------------------------- */
/* 8) Row Level Security (RLS)                                                 */
/* -------------------------------------------------------------------------- */

-- Helper inline role checks always use auth.jwt() ->> 'role' per spec.
-- If the claim is absent, comparisons will be false (non-admin/non-manager).

-- Helper: current user's group ids (security definer to avoid RLS recursion).
create or replace function public.my_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = auth.uid();
$$;

-- Helper: resolve yacht -> group_id (security definer to avoid RLS recursion).
create or replace function public.yacht_group_id(p_yacht_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select y.group_id
  from public.yachts y
  where y.id = p_yacht_id;
$$;

-- Helper: resolve task_instance -> yacht.group_id (security definer).
create or replace function public.task_instance_group_id(p_task_instance_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select y.group_id
  from public.task_instances ti
  join public.yachts y on y.id = ti.yacht_id
  where ti.id = p_task_instance_id;
$$;

-- Helper: check if current user is assigned to instance (security definer).
create or replace function public.is_assigned_to_me(p_task_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.task_assignments ta
    where ta.task_instance_id = p_task_instance_id
      and ta.assigned_to = auth.uid()
  );
$$;

/* ---- group_members ---- */
alter table public.group_members enable row level security;

drop policy if exists group_members_select_self_or_admin on public.group_members;
create policy group_members_select_self_or_admin
  on public.group_members
  for select
  to crew, manager, admin
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or (
      (auth.jwt() ->> 'role') = 'manager'
      and group_id in (select public.my_group_ids())
    )
    or user_id = auth.uid()
  );

drop policy if exists group_members_write_admin on public.group_members;
create policy group_members_write_admin
  on public.group_members
  for insert
  to crew, manager, admin
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists group_members_update_admin on public.group_members;
create policy group_members_update_admin
  on public.group_members
  for update
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists group_members_delete_admin on public.group_members;
create policy group_members_delete_admin
  on public.group_members
  for delete
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* ---- groups ---- */
alter table public.groups enable row level security;

drop policy if exists groups_select_visible on public.groups;
create policy groups_select_visible
  on public.groups
  for select
  to crew, manager, admin
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = public.groups.id
        and gm.user_id = auth.uid()
    )
  );

drop policy if exists groups_write_admin on public.groups;
create policy groups_write_admin
  on public.groups
  for insert
  to crew, manager, admin
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists groups_update_admin on public.groups;
create policy groups_update_admin
  on public.groups
  for update
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists groups_delete_admin on public.groups;
create policy groups_delete_admin
  on public.groups
  for delete
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* ---- yachts ---- */
alter table public.yachts enable row level security;

drop policy if exists yachts_select_visible on public.yachts;
create policy yachts_select_visible
  on public.yachts
  for select
  to crew, manager, admin
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.group_id = public.yachts.group_id
    )
  );

drop policy if exists yachts_write_admin on public.yachts;
create policy yachts_write_admin
  on public.yachts
  for insert
  to crew, manager, admin
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists yachts_update_admin on public.yachts;
create policy yachts_update_admin
  on public.yachts
  for update
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists yachts_delete_admin on public.yachts;
create policy yachts_delete_admin
  on public.yachts
  for delete
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* ---- categories ---- */
alter table public.categories enable row level security;

drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated
  on public.categories
  for select
  to crew, manager, admin
  using (true);

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin
  on public.categories
  for insert
  to crew, manager, admin
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists categories_update_admin on public.categories;
create policy categories_update_admin
  on public.categories
  for update
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists categories_delete_admin on public.categories;
create policy categories_delete_admin
  on public.categories
  for delete
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* ---- task_templates (admin only) ---- */
alter table public.task_templates enable row level security;

drop policy if exists task_templates_admin_only_select on public.task_templates;
create policy task_templates_admin_only_select
  on public.task_templates
  for select
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists task_templates_admin_only_insert on public.task_templates;
create policy task_templates_admin_only_insert
  on public.task_templates
  for insert
  to crew, manager, admin
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists task_templates_admin_only_update on public.task_templates;
create policy task_templates_admin_only_update
  on public.task_templates
  for update
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists task_templates_admin_only_delete on public.task_templates;
create policy task_templates_admin_only_delete
  on public.task_templates
  for delete
  to crew, manager, admin
  using ((auth.jwt() ->> 'role') = 'admin');

/* ---- task_instances ---- */
alter table public.task_instances enable row level security;

-- SELECT:
-- - Admin: all
-- - Manager: instances for yachts in their groups
-- - Crew: only instances assigned to them
drop policy if exists task_instances_select_by_role on public.task_instances;
drop policy if exists task_instances_select_admin on public.task_instances;
create policy task_instances_select_admin
  on public.task_instances
  for select
  to admin
  using (true);

drop policy if exists task_instances_select_manager on public.task_instances;
create policy task_instances_select_manager
  on public.task_instances
  for select
  to manager
  using (
    public.yacht_group_id(public.task_instances.yacht_id) in (select public.my_group_ids())
  );

drop policy if exists task_instances_select_crew on public.task_instances;
create policy task_instances_select_crew
  on public.task_instances
  for select
  to crew
  using (
    exists (
      select 1
      from public.task_assignments ta
      where ta.task_instance_id = public.task_instances.id
        and ta.assigned_to = auth.uid()
    )
  );

-- INSERT: only admin/manager within their group scope.
drop policy if exists task_instances_insert_admin_manager on public.task_instances;
create policy task_instances_insert_admin_manager
  on public.task_instances
  for insert
  to crew, manager, admin
  with check (
    (auth.jwt() ->> 'role') = 'admin'
  );

-- UPDATE:
-- - Admin/Manager: within group scope (status changes: pending/assigned/verified)
-- - Crew: only their assigned instances, and only to set status='completed'
drop policy if exists task_instances_update_admin_manager on public.task_instances;
create policy task_instances_update_admin_manager
  on public.task_instances
  for update
  to crew, manager, admin
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or (
      (auth.jwt() ->> 'role') = 'manager'
      and public.task_instance_group_id(public.task_instances.id) in (select public.my_group_ids())
    )
  )
  with check (
    (auth.jwt() ->> 'role') in ('admin', 'manager')
  );

drop policy if exists task_instances_update_crew_complete_only on public.task_instances;
create policy task_instances_update_crew_complete_only
  on public.task_instances
  for update
  to crew, manager, admin
  using (
    (auth.jwt() ->> 'role') = 'crew'
    and public.is_assigned_to_me(public.task_instances.id)
  )
  with check (
    (auth.jwt() ->> 'role') = 'crew'
    and public.task_instances.status = 'completed'
  );

/* ---- task_assignments ---- */
alter table public.task_assignments enable row level security;

drop policy if exists task_assignments_select_by_role on public.task_assignments;
drop policy if exists task_assignments_select_admin on public.task_assignments;
create policy task_assignments_select_admin
  on public.task_assignments
  for select
  to admin
  using (true);

drop policy if exists task_assignments_select_manager on public.task_assignments;
create policy task_assignments_select_manager
  on public.task_assignments
  for select
  to manager
  using (
    public.task_instance_group_id(public.task_assignments.task_instance_id) in (select public.my_group_ids())
  );

drop policy if exists task_assignments_select_crew on public.task_assignments;
create policy task_assignments_select_crew
  on public.task_assignments
  for select
  to crew
  using (public.task_assignments.assigned_to = auth.uid());

drop policy if exists task_assignments_insert_admin_manager on public.task_assignments;
create policy task_assignments_insert_admin_manager
  on public.task_assignments
  for insert
  to crew, manager, admin
  with check (
    (auth.jwt() ->> 'role') = 'admin'
    or (
      (auth.jwt() ->> 'role') = 'manager'
      and public.task_instance_group_id(public.task_assignments.task_instance_id) in (select public.my_group_ids())
    )
  );

/* ---- task_completions ---- */
alter table public.task_completions enable row level security;

drop policy if exists task_completions_select_by_role on public.task_completions;
drop policy if exists task_completions_select_admin on public.task_completions;
create policy task_completions_select_admin
  on public.task_completions
  for select
  to admin
  using (true);

drop policy if exists task_completions_select_manager on public.task_completions;
create policy task_completions_select_manager
  on public.task_completions
  for select
  to manager
  using (
    public.task_instance_group_id(public.task_completions.task_instance_id) in (select public.my_group_ids())
  );

drop policy if exists task_completions_select_crew on public.task_completions;
create policy task_completions_select_crew
  on public.task_completions
  for select
  to crew
  using (public.task_completions.user_id = auth.uid());

drop policy if exists task_completions_insert_self on public.task_completions;
create policy task_completions_insert_self
  on public.task_completions
  for insert
  to crew, manager, admin
  with check (
    public.task_completions.user_id = auth.uid()
    and public.is_assigned_to_me(public.task_completions.task_instance_id)
  );

/* ---- task_verifications ---- */
alter table public.task_verifications enable row level security;

drop policy if exists task_verifications_select_by_role on public.task_verifications;
drop policy if exists task_verifications_select_admin on public.task_verifications;
create policy task_verifications_select_admin
  on public.task_verifications
  for select
  to admin
  using (true);

drop policy if exists task_verifications_select_manager on public.task_verifications;
create policy task_verifications_select_manager
  on public.task_verifications
  for select
  to manager
  using (
    public.task_instance_group_id(public.task_verifications.task_instance_id) in (select public.my_group_ids())
  );

drop policy if exists task_verifications_insert_admin_manager on public.task_verifications;
create policy task_verifications_insert_admin_manager
  on public.task_verifications
  for insert
  to crew, manager, admin
  with check (
    (auth.jwt() ->> 'role') = 'admin'
    or (
      (auth.jwt() ->> 'role') = 'manager'
      and public.task_instance_group_id(public.task_verifications.task_instance_id) in (select public.my_group_ids())
    )
  );

