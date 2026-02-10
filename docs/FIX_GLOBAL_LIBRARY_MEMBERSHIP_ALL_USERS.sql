-- ULTRA — Data Fix
-- Ensure all users are members of "Global Library" (Model 1).
--
-- Why:
-- - Global templates/categories are pinned to the "Global Library" group.
-- - If a user is not a member of Global Library, RLS will correctly return 0 task categories/tasks.
--
-- Safe:
-- - No schema changes.
-- - Idempotent INSERT (does not duplicate existing memberships).

DO $$
DECLARE
  global_group_id uuid;
BEGIN
  SELECT id
  INTO global_group_id
  FROM public.groups
  WHERE name = 'Global Library'
  LIMIT 1;

  IF global_group_id IS NULL THEN
    RAISE EXCEPTION 'Global Library group not found. Create the group first.';
  END IF;

  INSERT INTO public.user_group_links (user_id, group_id)
  SELECT u.id, global_group_id
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_group_links ugl
    WHERE ugl.user_id = u.id
      AND ugl.group_id = global_group_id
  );

  RAISE NOTICE 'Ensured all users are members of Global Library (%).', global_group_id;
END $$;

-- Quick verification (should return 0 rows):
SELECT u.email
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_group_links ugl
  JOIN public.groups g ON g.id = ugl.group_id
  WHERE ugl.user_id = u.id
    AND g.name = 'Global Library'
)
ORDER BY u.email;

