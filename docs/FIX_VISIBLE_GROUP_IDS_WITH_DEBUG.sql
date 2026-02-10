-- ULTRA: Fix visible_group_ids() with better error handling
-- Issue: Function returns empty, causing 404 errors
-- Fix: Add error handling and ensure it works correctly

CREATE OR REPLACE FUNCTION public.visible_group_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val uuid;
  is_admin_val boolean;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  -- If not authenticated, return empty (shouldn't happen in app, but safe)
  IF user_id_val IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user is admin
  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_role_links url
      JOIN public.roles r ON url.role_id = r.id
      WHERE url.user_id = user_id_val
        AND LOWER(r.name) = 'admin'
    ) INTO is_admin_val;
  EXCEPTION WHEN OTHERS THEN
    -- If admin check fails, assume not admin
    is_admin_val := false;
  END;
  
  -- If admin, return all non-archived groups
  IF is_admin_val THEN
    RETURN QUERY
    SELECT g.id
    FROM public.groups g
    WHERE g.is_archived IS NULL OR g.is_archived = false;
    RETURN;
  END IF;
  
  -- Otherwise, return groups user is member of + descendants
  RETURN QUERY
  WITH user_groups AS (
    SELECT DISTINCT group_id
    FROM public.user_group_links
    WHERE user_id = user_id_val
  ),
  group_tree AS (
    -- Start with user's direct groups
    SELECT id, parent_group_id
    FROM public.groups
    WHERE id IN (SELECT group_id FROM user_groups)
    
    UNION
    
    -- Recursively get all descendants
    SELECT g.id, g.parent_group_id
    FROM public.groups g
    INNER JOIN group_tree gt ON g.parent_group_id = gt.id
  )
  SELECT DISTINCT id
  FROM group_tree;
END;
$$;

-- Verify function exists and is correct
SELECT 
  p.proname,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'visible_group_ids';

-- Check RLS policy on groups table
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'groups'
  AND cmd = 'SELECT';
