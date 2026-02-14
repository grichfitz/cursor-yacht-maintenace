-- PHASE 1A — STRUCTURAL TABLES (YM architecture)
--
-- Controlled schema extension ONLY:
-- - Creates new link tables to support:
--   - templates belonging to multiple groups (with future cascade via group hierarchy)
--   - manual template-to-yacht assignment
--   - category classification (multi-category per template)
-- - NO RLS policies
-- - NO triggers / functions
-- - NO changes to existing tables or constraints
-- - NO instance generation logic
--
-- Apply manually in Supabase SQL editor.

/* -------------------------------------------------------------------------- */
/* 1) template_group_links                                                     */
/* -------------------------------------------------------------------------- */

create table if not exists public.template_group_links (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (template_id, group_id)
);

create index if not exists idx_template_group_links_template
  on public.template_group_links(template_id);

create index if not exists idx_template_group_links_group
  on public.template_group_links(group_id);

/* -------------------------------------------------------------------------- */
/* 2) template_yacht_links                                                     */
/* -------------------------------------------------------------------------- */

create table if not exists public.template_yacht_links (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  created_at timestamptz not null default now(),
  assigned_by uuid,
  unique (template_id, yacht_id)
);

create index if not exists idx_template_yacht_links_template
  on public.template_yacht_links(template_id);

create index if not exists idx_template_yacht_links_yacht
  on public.template_yacht_links(yacht_id);

/* -------------------------------------------------------------------------- */
/* 3) categories                                                               */
/* -------------------------------------------------------------------------- */

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

/* -------------------------------------------------------------------------- */
/* 4) template_category_links                                                  */
/* -------------------------------------------------------------------------- */

create table if not exists public.template_category_links (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  unique (template_id, category_id)
);

