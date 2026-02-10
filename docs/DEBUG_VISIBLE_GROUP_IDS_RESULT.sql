-- Debug why visible_group_ids() returns no rows
-- Run this to understand what's happening

-- Step 1: Check current auth context
SELECT 
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'No authenticated user (running as service role?)'
    ELSE 'Authenticated user: ' || auth.uid()::text
  END as auth_status;

-- Step 2: Check if grichfitz@hotmail.com is admin
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
    ) THEN 'Yes - Admin'
    ELSE 'No - Not Admin'
  END as is_admin
FROM public.users u
WHERE u.email = 'grichfitz@hotmail.com';

-- Step 3: Check group memberships for grichfitz@hotmail.com
SELECT 
  u.email,
  g.name as group_name,
  g.id as group_id
FROM public.users u
LEFT JOIN public.user_group_links ugl ON u.id = ugl.user_id
LEFT JOIN public.groups g ON ugl.group_id = g.id
WHERE u.email = 'grichfitz@hotmail.com'
ORDER BY g.name;

-- Step 4: Test visible_group_ids() directly
-- Note: This will only work if you're authenticated as that user
-- In SQL Editor, you might need to test via the app instead
SELECT visible_group_ids();

-- Step 5: Check what groups exist
SELECT 
  id,
  name,
  is_archived,
  (SELECT COUNT(*) FROM public.user_group_links WHERE group_id = groups.id) as member_count
FROM public.groups
ORDER BY name;

-- IMPORTANT: visible_group_ids() uses auth.uid() which may be NULL in SQL Editor
-- The function will work correctly when called from the app (authenticated context)
-- To test in SQL Editor, you'd need to use SET LOCAL or test via the app UI
