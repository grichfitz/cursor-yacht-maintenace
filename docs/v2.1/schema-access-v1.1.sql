-- =====================================================
-- YM ACCESS MODEL v1.1
-- Enterprise Hierarchical Governance
-- Supabase Safe / Cursor Review Ready
-- =====================================================

-- =====================================================
-- ENSURE RLS IS ENABLED
-- =====================================================

alter table groups enable row level security;
alter table group_memberships enable row level security;
alter table yachts enable row level security;
alter table task_assignments enable row level security;
alter table user_roles enable row level security;


-- =====================================================
-- FUNCTION: user_is_admin
-- =====================================================

create or replace function public.user_is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from user_roles ur
        join roles r on r.id = ur.role_id
        where ur.user_id = uid
          and r.name = 'admin'
    );
$$;

alter function public.user_is_admin(uuid) owner to postgres;


-- =====================================================
-- FUNCTION: user_is_manager
-- =====================================================

create or replace function public.user_is_manager(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from user_roles ur
        join roles r on r.id = ur.role_id
        where ur.user_id = uid
          and r.name = 'manager'
    );
$$;

alter function public.user_is_manager(uuid) owner to postgres;


-- =====================================================
-- FUNCTION: user_accessible_groups
-- Centralised Hierarchy Resolution
-- =====================================================

create or replace function public.user_accessible_groups(uid uuid)
returns table(group_id uuid)
language sql
stable
security definer
set search_path = public
as $$
    with recursive direct_groups as (
        select g.id, g.parent_group_id
        from groups g
        join group_memberships gm on gm.group_id = g.id
        where gm.user_id = uid
    ),
    descendants as (
        select id, parent_group_id from direct_groups
        union all
        select g.id, g.parent_group_id
        from groups g
        join descendants d on g.parent_group_id = d.id
    ),
    ancestors as (
        select id, parent_group_id from direct_groups
        union all
        select g.id, g.parent_group_id
        from groups g
        join ancestors a on a.parent_group_id = g.id
    )
    select distinct id
    from (
        select id from descendants
        union
        select id from ancestors
    ) all_groups;
$$;

alter function public.user_accessible_groups(uuid) owner to postgres;


-- =====================================================
-- GROUPS: SELECT POLICY (Unified)
-- =====================================================

drop policy if exists groups_select_admin_all on groups;
drop policy if exists groups_select_manager_crew_in_groups on groups;
drop policy if exists "Users can view their groups" on groups;
drop policy if exists groups_select on groups;

create policy groups_select
on groups
for select
to authenticated
using (
    user_is_admin(auth.uid())
    or
    id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- YACHTS: SELECT POLICY (Unified)
-- =====================================================

drop policy if exists yachts_select_admin_all on yachts;
drop policy if exists yachts_select_manager_crew_in_scope on yachts;
drop policy if exists yachts_select_owner_in_scope on yachts;
drop policy if exists "Users access yachts by membership" on yachts;
drop policy if exists yachts_select on yachts;

create policy yachts_select
on yachts
for select
to authenticated
using (
    user_is_admin(auth.uid())
    or
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- GROUP MEMBERSHIPS: SELECT POLICY (Unified)
-- =====================================================

drop policy if exists group_memberships_select_admin_all on group_memberships;
drop policy if exists group_memberships_select_manager_crew_in_groups on group_memberships;
drop policy if exists group_memberships_select_self on group_memberships;
drop policy if exists group_memberships_select on group_memberships;

create policy group_memberships_select
on group_memberships
for select
to authenticated
using (
    user_is_admin(auth.uid())
    or
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
    or
    user_id = auth.uid()
);


-- =====================================================
-- TASK ASSIGNMENTS: SELECT POLICY (Unified)
-- =====================================================

drop policy if exists task_assignments_select on task_assignments;

create policy task_assignments_select
on task_assignments
for select
to authenticated
using (
    user_is_admin(auth.uid())
    or
    coalesce(
        task_assignments.group_id,
        (
            select y.group_id
            from yachts y
            where y.id = task_assignments.yacht_id
        )
    )
    in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- MANAGER: GROUP MEMBERSHIP MANAGEMENT
-- =====================================================

drop policy if exists group_memberships_insert_manager on group_memberships;
drop policy if exists group_memberships_delete_manager on group_memberships;

create policy group_memberships_insert_manager
on group_memberships
for insert
to authenticated
with check (
    user_is_manager(auth.uid())
    and
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);

create policy group_memberships_delete_manager
on group_memberships
for delete
to authenticated
using (
    user_is_manager(auth.uid())
    and
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- MANAGER: YACHT MANAGEMENT
-- =====================================================

drop policy if exists yachts_insert_manager on yachts;
drop policy if exists yachts_update_manager on yachts;
drop policy if exists yachts_delete_manager on yachts;

create policy yachts_insert_manager
on yachts
for insert
to authenticated
with check (
    user_is_manager(auth.uid())
    and
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);

create policy yachts_update_manager
on yachts
for update
to authenticated
using (
    user_is_manager(auth.uid())
    and
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
)
with check (
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);

create policy yachts_delete_manager
on yachts
for delete
to authenticated
using (
    user_is_manager(auth.uid())
    and
    group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- MANAGER: CREATE SUBGROUPS
-- =====================================================

drop policy if exists groups_insert_manager on groups;
drop policy if exists groups_update_manager on groups;

create policy groups_insert_manager
on groups
for insert
to authenticated
with check (
    user_is_manager(auth.uid())
    and
    parent_group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);

create policy groups_update_manager
on groups
for update
to authenticated
using (
    user_is_manager(auth.uid())
    and
    id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
)
with check (
    parent_group_id in (
        select group_id
        from user_accessible_groups(auth.uid())
    )
);


-- =====================================================
-- MANAGER: PROMOTE MANAGER ROLE (NOT ADMIN)
-- =====================================================

drop policy if exists user_roles_insert_manager on user_roles;
drop policy if exists user_roles_delete_manager on user_roles;

create policy user_roles_insert_manager
on user_roles
for insert
to authenticated
with check (
    user_is_manager(auth.uid())
    and
    exists (
        select 1
        from roles r
        where r.id = user_roles.role_id
          and r.name = 'manager'
    )
    and
    exists (
        select 1
        from group_memberships gm
        where gm.user_id = user_roles.user_id
          and gm.group_id in (
              select group_id
              from user_accessible_groups(auth.uid())
          )
    )
);

create policy user_roles_delete_manager
on user_roles
for delete
to authenticated
using (
    user_is_manager(auth.uid())
    and
    exists (
        select 1
        from roles r
        where r.id = user_roles.role_id
          and r.name = 'manager'
    )
);


-- =====================================================
-- ADMIN: FULL ROLE CONTROL
-- =====================================================

drop policy if exists user_roles_insert_admin on user_roles;
drop policy if exists user_roles_update_admin on user_roles;
drop policy if exists user_roles_delete_admin on user_roles;

create policy user_roles_insert_admin
on user_roles
for insert
to authenticated
with check (
    user_is_admin(auth.uid())
);

create policy user_roles_update_admin
on user_roles
for update
to authenticated
using ( user_is_admin(auth.uid()) )
with check ( user_is_admin(auth.uid()) );

create policy user_roles_delete_admin
on user_roles
for delete
to authenticated
using (
    user_is_admin(auth.uid())
);

-- =====================================================
-- END OF ACCESS MODEL v1.1
-- =====================================================