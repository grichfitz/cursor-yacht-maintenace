-- ULTRA: Soft-archive (never delete) groups.
-- Source of truth: Supabase schema CSV + ULTRA docs.
--
-- Adds a boolean flag to support archive/un-archive UX.
-- Safe to run once; if you need idempotency, run manually with checks.

alter table public.groups
add column is_archived boolean default false;

-- Optional: backfill (redundant if default applies to existing rows in your Postgres version)
update public.groups set is_archived = false where is_archived is null;

-- Optional: index to support filtering active groups
create index if not exists groups_is_archived_idx on public.groups (is_archived);

