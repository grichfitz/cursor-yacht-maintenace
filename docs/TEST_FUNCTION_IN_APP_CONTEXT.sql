-- ULTRA: Test visible_group_ids() function behavior
-- This helps diagnose why function returns empty

-- Step 1: Check what auth.uid() returns (will be NULL in SQL Editor, but should work in app)
SELECT 
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'Running as service role (SQL Editor)'
    ELSE 'Authenticated user: ' || auth.uid()::text
  END as context;

-- Step 2: Manually test the function logic for grichfitz
-- Replace USER_ID with grichfitz's actual user ID
DO $$
DECLARE
  test_user_id uuid;
  is_admin_val boolean;
  group_count integer;
BEGIN
  -- Get grichfitz user ID
  SELECT id INTO test_user_id
  FROM public.users
  WHERE email = 'grichfitz@hotmail.com'
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'User grichfitz@hotmail.com not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testing for user: %', test_user_id;
  
  -- Check admin status
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    INNER JOIN public.roles r ON url.role_id = r.id
    WHERE url.user_id = test_user_id
      AND LOWER(TRIM(r.name)) = 'admin'
  ) INTO is_admin_val;
  
  RAISE NOTICE 'Is admin: %', is_admin_val;
  
  -- Check group memberships
  SELECT COUNT(*) INTO group_count
  FROM public.user_group_links
  WHERE user_id = test_user_id;
  
  RAISE NOTICE 'Group memberships: %', group_count;
  
  -- If admin, count all groups
  IF is_admin_val THEN
    SELECT COUNT(*) INTO group_count
    FROM public.groups
    WHERE (is_archived IS NULL OR is_archived = false);
    RAISE NOTICE 'Admin should see % groups', group_count;
  ELSE
    -- Count groups user should see
    WITH user_groups AS (
      SELECT DISTINCT group_id
      FROM public.user_group_links
      WHERE user_id = test_user_id
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
    SELECT COUNT(*) INTO group_count
    FROM group_tree;
    RAISE NOTICE 'Non-admin should see % groups', group_count;
  END IF;
END $$;

-- Step 3: Check if there's an issue with the function itself
-- Try calling it with explicit error handling
DO $$
DECLARE
  result_count integer;
BEGIN
  SELECT COUNT(*) INTO result_count
  FROM visible_group_ids();
  
  RAISE NOTICE 'visible_group_ids() returned % rows', result_count;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error calling visible_group_ids(): %', SQLERRM;
END $$;
