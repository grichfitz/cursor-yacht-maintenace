-- ULTRA: Verify admin setup and fix visible_group_ids()
-- Step 1: Check if admin role exists
SELECT id, name FROM public.roles WHERE LOWER(name) = 'admin';

-- Step 2: Check if grichfitz has admin role
SELECT 
  u.id,
  u.email,
  r.id as role_id,
  r.name as role_name
FROM public.users u
LEFT JOIN public.user_role_links url ON u.id = url.user_id
LEFT JOIN public.roles r ON url.role_id = r.id
WHERE u.email = 'grichfitz@hotmail.com';

-- Step 3: If admin role doesn't exist, create it
INSERT INTO public.roles (name)
VALUES ('admin')
ON CONFLICT (name) DO NOTHING;

-- Step 4: If grichfitz doesn't have admin role, add it
-- (Replace ROLE_ID with actual admin role ID from Step 1)
DO $$
DECLARE
  admin_role_id uuid;
  user_id_val uuid;
BEGIN
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM public.roles
  WHERE LOWER(name) = 'admin'
  LIMIT 1;
  
  -- Get user ID
  SELECT id INTO user_id_val
  FROM public.users
  WHERE email = 'grichfitz@hotmail.com'
  LIMIT 1;
  
  -- Add admin role if both exist
  IF admin_role_id IS NOT NULL AND user_id_val IS NOT NULL THEN
    INSERT INTO public.user_role_links (user_id, role_id)
    VALUES (user_id_val, admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

-- Step 5: Recreate function with robust error handling
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
  -- Get current user ID
  user_id_val := auth.uid();
  
  -- If not authenticated, return empty
  IF user_id_val IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user is admin (with comprehensive error handling)
  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_role_links url
      INNER JOIN public.roles r ON url.role_id = r.id
      WHERE url.user_id = user_id_val
        AND LOWER(TRIM(r.name)) = 'admin'
    ) INTO is_admin_val;
  EXCEPTION WHEN OTHERS THEN
    -- If admin check fails for any reason, assume not admin
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
  RETURN QUERY
  WITH user_groups AS (
    SELECT DISTINCT group_id
    FROM public.user_group_links
    WHERE user_id = user_id_val
  ),
  group_tree AS (
    SELECT id, parent_group_id
    FROM public.groups
    WHERE id IN (SELECT group_id FROM user_groups)
    
    UNION
    
    SELECT g.id, g.parent_group_id
    FROM public.groups g
    INNER JOIN group_tree gt ON g.parent_group_id = gt.id
  )
  SELECT DISTINCT id
  FROM group_tree;
END;
$$;

-- Step 6: Verify function works
SELECT visible_group_ids();

-- Step 7: Check groups visibility
SELECT 
  g.id,
  g.name,
  CASE 
    WHEN g.id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.groups g
ORDER BY g.name;
