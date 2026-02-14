-- PHASE 1C — CATEGORIES HIERARCHY (template categories)
--
-- Goal:
-- - Allow categories to nest (category within category) without creating new tables.
-- - Uses a self-referencing FK on public.categories.
--
-- Apply manually in Supabase SQL editor.

alter table public.categories
  add column if not exists parent_category_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_parent_category_id_fkey'
  ) then
    alter table public.categories
      add constraint categories_parent_category_id_fkey
      foreign key (parent_category_id)
      references public.categories(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_categories_parent_category_id
  on public.categories(parent_category_id);

