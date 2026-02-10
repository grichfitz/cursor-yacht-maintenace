-- ULTRA — Stabilisation Fix
-- Admins must be able to SEE archived groups to restore them.
--
-- Problem:
-- - `visible_group_ids()` currently returns only non-archived groups for admins.
-- - But the UI hides archived groups by default and shows them under a virtual "Archive" bucket.
-- - If admins can't SELECT archived groups, they cannot un-archive them via the UI.
--
-- Fix:
-- - For admins, return ALL groups (archived + non-archived).
-- - Non-admin behavior stays the same (membership + descendants).
--
-- Note:
-- - This is a visibility fix for admins only (stabilisation-safe).

CREATE OR REPLACE FUNCTION public.visible_group_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val uuid;
  is_admin_val boolean := false;
BEGIN
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_role_links url
      JOIN public.roles r ON url.role_id = r.id
      WHERE url.user_id = user_id_val
        AND r.name = 'admin'
    ) INTO is_admin_val;
  EXCEPTION WHEN OTHERS THEN
    is_admin_val := false;
  END;

  IF is_admin_val THEN
    -- Admin: all groups (including archived), so restore is possible.
    RETURN QUERY
    SELECT g.id
    FROM public.groups g;
    RETURN;
  END IF;

  -- Non-admin: direct memberships + descendants
  RETURN QUERY
  WITH RECURSIVE user_groups AS (
    SELECT DISTINCT group_id as id
    FROM public.user_group_links
    WHERE user_id = user_id_val
  ),
  group_tree AS (
    SELECT g.id, g.parent_group_id
    FROM public.groups g
    WHERE g.id IN (SELECT id FROM user_groups)

    UNION

    SELECT g.id, g.parent_group_id
    FROM public.groups g
    INNER JOIN group_tree gt ON g.parent_group_id = gt.id
  )
  SELECT DISTINCT id
  FROM group_tree;
END;
$$;

