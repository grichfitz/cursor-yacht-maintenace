-- ULTRA: Smoke Test B - Global Task Library (Templates + Categories)
-- Verify that templates and categories load correctly with RLS
--
-- Test 3 from UI_SMOKE_TESTS_2026-02-09.md

-- Step 1: Check what categories exist and their group assignments
SELECT 
  tc.id,
  tc.name,
  tc.parent_id,
  tc.is_archived,
  g.id as group_id,
  g.name as group_name,
  CASE 
    WHEN tc.group_id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.task_categories tc
LEFT JOIN public.groups g ON tc.group_id = g.id
ORDER BY g.name, tc.name;

-- Step 2: Check what tasks exist and their category links
SELECT 
  t.id,
  t.name,
  t.is_latest,
  tcm.category_id,
  tc.name as category_name,
  tc.group_id,
  g.name as group_name,
  CASE 
    WHEN t.id IN (
      SELECT tcm2.task_id
      FROM task_category_map tcm2
      WHERE tcm2.category_id IN (
        SELECT tc2.id
        FROM task_categories tc2
        WHERE tc2.group_id IN (SELECT visible_group_ids())
      )
    ) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.tasks t
LEFT JOIN public.task_category_map tcm ON t.id = tcm.task_id
LEFT JOIN public.task_categories tc ON tcm.category_id = tc.id
LEFT JOIN public.groups g ON tc.group_id = g.id
WHERE t.is_latest = true
ORDER BY t.name, tc.name;

-- Step 3: Check Global Library categories specifically
SELECT 
  tc.id,
  tc.name,
  tc.parent_id,
  g.name as group_name,
  CASE 
    WHEN tc.group_id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.task_categories tc
LEFT JOIN public.groups g ON tc.group_id = g.id
WHERE g.name = 'Global Library'
ORDER BY tc.name;

-- Step 4: Count categories per group
SELECT 
  g.name as group_name,
  COUNT(tc.id) as category_count,
  CASE 
    WHEN g.id IN (SELECT visible_group_ids()) THEN 'Visible to current user'
    ELSE 'Not visible'
  END as group_visibility
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
GROUP BY g.id, g.name
ORDER BY g.name;

-- Step 5: Count tasks per group (via categories)
SELECT 
  g.name as group_name,
  COUNT(DISTINCT t.id) as task_count,
  CASE 
    WHEN g.id IN (SELECT visible_group_ids()) THEN 'Visible to current user'
    ELSE 'Not visible'
  END as group_visibility
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
LEFT JOIN public.task_category_map tcm ON tc.id = tcm.category_id
LEFT JOIN public.tasks t ON tcm.task_id = t.id AND t.is_latest = true
GROUP BY g.id, g.name
ORDER BY g.name;

-- Step 6: Verify RLS policies on task-related tables
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('task_categories', 'tasks', 'task_category_map', 'task_category_links')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
