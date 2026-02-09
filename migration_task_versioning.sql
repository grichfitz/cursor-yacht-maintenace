-- ULTRA: React renders. SQL scopes.
-- Task templates must be safe to edit without silently changing every yacht.
--
-- This migration adds lightweight task versioning:
-- - lineage_id groups versions of the "same" task template
-- - version is a monotonically increasing integer per lineage
-- - is_latest marks the version used for new assignments and shown in the Tasks app
-- - superseded_at is informational
--
-- The app uses copy-on-write:
-- - default save creates a new version when a task is already in use by task_contexts
-- - optional "Apply globally" updates the current version in-place

begin;

alter table public.tasks
  add column if not exists lineage_id uuid,
  add column if not exists version integer not null default 1,
  add column if not exists is_latest boolean not null default true,
  add column if not exists superseded_at timestamp with time zone;

-- Backfill lineage/version flags for existing rows.
update public.tasks
set
  lineage_id = coalesce(lineage_id, id),
  version = coalesce(version, 1),
  is_latest = coalesce(is_latest, true)
where lineage_id is null or version is null or is_latest is null;

-- Ensure there is only one latest per lineage.
-- If duplicates exist, keep the highest version as latest.
with ranked as (
  select
    id,
    lineage_id,
    version,
    row_number() over (partition by lineage_id order by version desc, created_at desc, id desc) as rn
  from public.tasks
)
update public.tasks t
set is_latest = (r.rn = 1)
from ranked r
where t.id = r.id;

create index if not exists tasks_lineage_id_idx on public.tasks (lineage_id);

-- Partial unique index: only one latest per lineage.
create unique index if not exists tasks_one_latest_per_lineage
  on public.tasks (lineage_id)
  where is_latest = true;

commit;

