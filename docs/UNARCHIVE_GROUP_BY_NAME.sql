-- ULTRA — Stabilisation Data Fix
-- Un-archive a group by name (and show current state).
--
-- Use this if a group "disappears" from the UI because `is_archived = true`.
-- Our trees intentionally hide archived groups and yachts owned by them.
--
-- 1) Change target_group_name below.
-- 2) Run in Supabase SQL editor (service/postgres).

DO $$
DECLARE
  target_group_name text := 'Worthy Marine';
  updated_count int := 0;
BEGIN
  UPDATE public.groups
  SET is_archived = false
  WHERE name = target_group_name
    AND COALESCE(is_archived, false) = true;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE 'Un-archived % group(s) named "%".', updated_count, target_group_name;
END $$;

-- Verify state
SELECT
  id,
  name,
  parent_group_id,
  is_archived
FROM public.groups
WHERE name = 'Worthy Marine';

