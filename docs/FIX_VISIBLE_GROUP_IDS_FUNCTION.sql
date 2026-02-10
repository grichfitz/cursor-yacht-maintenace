-- ULTRA: Fix visible_group_ids() function
-- Issue: Function may be broken, causing 404 errors and "Not visible" for all groups
-- Fix: Recreate function with proper error handling

-- Step 1: Recreate the function with admin support (CREATE OR REPLACE preserves dependencies)
-- Note: Cannot use DROP because RLS policies depend on this function
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
  
  IF user_id_val IS NULL THEN
    RETURN; -- Not authenticated
  END IF;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    JOIN public.roles r ON url.role_id = r.id
    WHERE url.user_id = user_id_val
      AND LOWER(r.name) = 'admin'
  ) INTO is_admin_val;
  
  -- If admin, return all groups (except archived)
  IF is_admin_val THEN
    RETURN QUERY
    SELECT g.id
    FROM public.groups g
    WHERE (g.is_archived = false OR g.is_archived IS NULL);
    RETURN;
  END IF;
  
  -- Otherwise, return groups user is member of + descendants (original logic)
  RETURN QUERY
  WITH user_groups AS (
    -- Get groups user is directly a member of
    SELECT DISTINCT group_id
    FROM public.user_group_links
    WHERE user_id = user_id_val
  ),
  group_tree AS (
    -- Start with user's groups
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

-- Step 2: Test the function
SELECT visible_group_ids();

-- Step 3: Verify admin check works
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

-- Step 4: Check what groups should be visible now
SELECT 
  g.id,
  g.name,
  g.is_archived,
  CASE 
    WHEN g.id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.groups g
ORDER BY g.name;
