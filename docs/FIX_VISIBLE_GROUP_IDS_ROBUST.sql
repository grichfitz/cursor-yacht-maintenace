-- ULTRA: Robust fix for visible_group_ids() function
-- Issue: Function returns empty, causing 404 errors for all users
-- Fix: Ensure function always returns at least user's groups, with admin override

CREATE OR REPLACE FUNCTION public.visible_group_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val uuid;
  is_admin_val boolean;
  admin_role_id uuid;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  -- If not authenticated, return empty
  IF user_id_val IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user is admin (with error handling)
  BEGIN
    -- First get admin role ID
    SELECT id INTO admin_role_id
    FROM public.roles
    WHERE LOWER(name) = 'admin'
    LIMIT 1;
    
    -- Then check if user has admin role
    IF admin_role_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_role_links
        WHERE user_id = user_id_val
          AND role_id = admin_role_id
      ) INTO is_admin_val;
    ELSE
      is_admin_val := false;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, assume not admin
    is_admin_val := false;
  END;
  
  -- If admin, return all non-archived groups
  IF is_admin_val THEN
    RETURN QUERY
    SELECT g.id
    FROM public.groups g
    WHERE (g.is_archived IS NULL OR g.is_archived = false);
    RETURN;
  END IF;
  
  -- Otherwise, return groups user is member of + descendants
  -- This MUST return at least the user's direct groups
  RETURN QUERY
  WITH user_groups AS (
    -- Get groups user is directly a member of
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

-- Verify the function was created
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'visible_group_ids';

-- Test: Check if grichfitz is admin
SELECT 
  u.id,
  u.email,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM public.user_role_links url
      JOIN public.roles r ON url.role_id = r.id
      WHERE url.user_id = u.id
        AND LOWER(r.name) = 'admin'
    ) THEN 'Yes'
    ELSE 'No'
  END as is_admin
FROM public.users u
WHERE u.email = 'grichfitz@hotmail.com';
