/* =========================================================
   MARINE TASK APP — FULL DATABASE SNAPSHOT (RLS + PRIVILEGES)
   =========================================================

   Purpose:
   - Produce a “single query” export-friendly snapshot to share with an LLM.
   - Captures: schemas, tables/columns, constraints, FKs, indexes, RLS policies, RLS enabled,
     functions, views, triggers, extensions, enums, and grants/role membership.

   Usage (Supabase SQL Editor):
   - Paste and run.
   - Export result as CSV.

   Notes:
   - Some metadata tables may be restricted depending on role/context.
   - This script avoids secrets (no passwords), but it will list role names and grants.
*/

select
  'SCHEMAS' as section,
  s.schema_name::text as a1,
  null::text as a2,
  null::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from information_schema.schemata s

union all

select
  'TABLES' as section,
  t.table_schema::text as a1,
  t.table_name::text as a2,
  t.table_type::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from information_schema.tables t
where t.table_schema not in ('pg_catalog', 'information_schema')

union all

select
  'COLUMNS' as section,
  c.table_schema::text as a1,
  c.table_name::text as a2,
  c.column_name::text as a3,
  c.data_type::text as a4,
  c.is_nullable::text as a5,
  c.column_default::text as a6,
  null::text as a7
from information_schema.columns c
where c.table_schema not in ('pg_catalog', 'information_schema')

union all

select
  'CONSTRAINTS' as section,
  tc.table_schema::text as a1,
  tc.table_name::text as a2,
  tc.constraint_name::text as a3,
  tc.constraint_type::text as a4,
  kcu.column_name::text as a5,
  ccu.table_name::text as a6,
  ccu.column_name::text as a7
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
where tc.table_schema not in ('pg_catalog', 'information_schema')

union all

-- Foreign keys with update/delete rules
select
  'FOREIGN_KEYS' as section,
  tc.table_schema::text as a1,
  tc.table_name::text as a2,
  tc.constraint_name::text as a3,
  rc.update_rule::text as a4,
  rc.delete_rule::text as a5,
  ccu.table_name::text as a6,
  ccu.column_name::text as a7
from information_schema.table_constraints tc
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name
 and tc.table_schema = rc.constraint_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema not in ('pg_catalog', 'information_schema')

union all

select
  'INDEXES' as section,
  i.schemaname::text as a1,
  i.tablename::text as a2,
  i.indexname::text as a3,
  i.indexdef::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_indexes i
where i.schemaname not in ('pg_catalog', 'information_schema')

union all

select
  'RLS_POLICIES' as section,
  p.schemaname::text as a1,
  p.tablename::text as a2,
  p.policyname::text as a3,
  p.cmd::text as a4,
  p.roles::text as a5,
  p.qual::text as a6,
  p.with_check::text as a7
from pg_policies p
where p.schemaname not in ('pg_catalog', 'information_schema')

union all

-- Compact per-table RLS summary
select
  'RLS_SUMMARY' as section,
  p.schemaname::text as a1,
  p.tablename::text as a2,
  string_agg(p.policyname || ' (' || p.cmd || ')', ', ' order by p.policyname)::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_policies p
where p.schemaname not in ('pg_catalog', 'information_schema')
group by p.schemaname, p.tablename

union all

select
  'RLS_ENABLED' as section,
  n.nspname::text as a1,
  c.relname::text as a2,
  c.relrowsecurity::text as a3,
  c.relforcerowsecurity::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema')
  and c.relkind in ('r','p','v','m','f') -- table/partitioned table/view/materialized/foreign

union all

select
  'FUNCTIONS' as section,
  n.nspname::text as a1,
  p.proname::text as a2,
  pg_get_function_identity_arguments(p.oid)::text as a3,
  pg_get_functiondef(p.oid)::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema')

union all

select
  'VIEWS' as section,
  v.table_schema::text as a1,
  v.table_name::text as a2,
  v.view_definition::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from information_schema.views v
where v.table_schema not in ('pg_catalog', 'information_schema')

union all

select
  'TRIGGERS' as section,
  tr.trigger_schema::text as a1,
  tr.event_object_table::text as a2,
  tr.trigger_name::text as a3,
  (tr.action_timing || ' ' || tr.event_manipulation)::text as a4,
  tr.action_statement::text as a5,
  null::text as a6,
  null::text as a7
from information_schema.triggers tr
where tr.trigger_schema not in ('pg_catalog', 'information_schema')

union all

select
  'EXTENSIONS' as section,
  e.extname::text as a1,
  e.extversion::text as a2,
  null::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_extension e

union all

select
  'ENUMS' as section,
  n.nspname::text as a1,
  t.typname::text as a2,
  e.enumlabel::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname not in ('pg_catalog', 'information_schema')

union all

-- Table grants / privileges (who can do what)
select
  'TABLE_GRANTS' as section,
  g.table_schema::text as a1,
  g.table_name::text as a2,
  g.grantee::text as a3,
  g.privilege_type::text as a4,
  g.is_grantable::text as a5,
  g.grantor::text as a6,
  null::text as a7
from information_schema.role_table_grants g
where g.table_schema not in ('pg_catalog', 'information_schema')

union all

-- Role membership graph (no secrets)
select
  'ROLE_MEMBERSHIP' as section,
  r.rolname::text as a1,      -- role
  m.rolname::text as a2,      -- member
  am.admin_option::text as a3,
  null::text as a4,
  null::text as a5,
  null::text as a6,
  null::text as a7
from pg_auth_members am
join pg_roles r on r.oid = am.roleid
join pg_roles m on m.oid = am.member

union all

-- Roles summary (no secrets)
select
  'ROLES' as section,
  r.rolname::text as a1,
  r.rolcanlogin::text as a2,
  r.rolinherit::text as a3,
  r.rolcreaterole::text as a4,
  r.rolcreatedb::text as a5,
  r.rolreplication::text as a6,
  r.rolbypassrls::text as a7
from pg_roles r

order by 1, 2, 3, 4;

