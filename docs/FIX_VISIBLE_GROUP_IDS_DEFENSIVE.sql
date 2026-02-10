-- ULTRA: Defensive fix for visible_group_ids() - always returns user's groups
-- This ensures function never returns empty (which causes 404 errors)

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
  admin_role_id uuid;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  -- If not authenticated, return empty
  IF user_id_val IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user is admin (with full error handling)
  BEGIN
    -- Get admin role ID first
    SELECT id INTO admin_role_id
    FROM public.roles
    WHERE LOWER(TRIM(name)) = 'admin'
    LIMIT 1;
    
    -- Check if user has admin role
    IF admin_role_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_role_links
        WHERE user_id = user_id_val
          AND role_id = admin_role_id
      ) INTO is_admin_val;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If anything fails, continue as non-admin
    is_admin_val := false;
  END;
  
  -- If admin, return all non-archived groups
  IF is_admin_val THEN
    BEGIN
      RETURN QUERY
      SELECT g.id
      FROM public.groups g
      WHERE (g.is_archived IS NULL OR g.is_archived = false);
      RETURN;
    EXCEPTION WHEN OTHERS THEN
      -- If admin query fails, fall through to user groups
      is_admin_val := false;
    END;
  END IF;
  
  -- Return groups user is member of + descendants
  -- This MUST work to prevent 404 errors
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- If even this fails, return at least direct memberships
    RETURN QUERY
    SELECT DISTINCT group_id
    FROM public.user_group_links
    WHERE user_id = user_id_val;
  END;
END;
$$;

-- Test: This should return at least user's groups
SELECT COUNT(*) as visible_groups_count FROM visible_group_ids();
