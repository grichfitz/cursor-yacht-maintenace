-- ULTRA: Smoke Test C - Persona C (Worthy Marine member) - Global Task Library
-- Verify that Worthy Marine members see:
-- 1. Global Library categories/tasks (visible to all)
-- 2. Worthy Marine categories/tasks (visible to Worthy Marine members)
-- 3. Other groups' categories/tasks are NOT visible
--
-- Test 3 from UI_SMOKE_TESTS_2026-02-09.md

-- Step 1: Check current user's visible groups
SELECT 
  g.id,
  g.name as group_name,
  CASE 
    WHEN g.id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.groups g
ORDER BY g.name;

-- Step 2: Check categories per group and visibility
SELECT 
  g.name as group_name,
  tc.id as category_id,
  tc.name as category_name,
  tc.parent_id,
  CASE 
    WHEN tc.group_id IN (SELECT visible_group_ids()) THEN 'Visible'
    ELSE 'Not visible'
  END as visibility_status
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
ORDER BY g.name, tc.name;

-- Step 3: Check tasks per group (via categories) and visibility
SELECT 
  g.name as group_name,
  t.id as task_id,
  t.name as task_name,
  t.is_latest,
  tc.name as category_name,
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
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
LEFT JOIN public.task_category_map tcm ON tc.id = tcm.category_id
LEFT JOIN public.tasks t ON tcm.task_id = t.id AND t.is_latest = true
ORDER BY g.name, t.name;

-- Step 4: Summary - Count visible vs non-visible categories per group
SELECT 
  g.name as group_name,
  COUNT(CASE WHEN tc.group_id IN (SELECT visible_group_ids()) THEN 1 END) as visible_categories,
  COUNT(CASE WHEN tc.group_id NOT IN (SELECT visible_group_ids()) THEN 1 END) as hidden_categories,
  COUNT(tc.id) as total_categories
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
GROUP BY g.id, g.name
ORDER BY g.name;

-- Step 5: Summary - Count visible vs non-visible tasks per group
SELECT 
  g.name as group_name,
  COUNT(DISTINCT CASE 
    WHEN t.id IN (
      SELECT tcm2.task_id
      FROM task_category_map tcm2
      WHERE tcm2.category_id IN (
        SELECT tc2.id
        FROM task_categories tc2
        WHERE tc2.group_id IN (SELECT visible_group_ids())
      )
    ) THEN t.id
  END) as visible_tasks,
  COUNT(DISTINCT CASE 
    WHEN t.id NOT IN (
      SELECT tcm2.task_id
      FROM task_category_map tcm2
      WHERE tcm2.category_id IN (
        SELECT tc2.id
        FROM task_categories tc2
        WHERE tc2.group_id IN (SELECT visible_group_ids())
      )
    ) AND t.id IS NOT NULL THEN t.id
  END) as hidden_tasks,
  COUNT(DISTINCT t.id) as total_tasks
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
LEFT JOIN public.task_category_map tcm ON tc.id = tcm.category_id
LEFT JOIN public.tasks t ON tcm.task_id = t.id AND t.is_latest = true
GROUP BY g.id, g.name
ORDER BY g.name;

-- Step 6: Verify Worthy Marine membership for current user
SELECT 
  u.email,
  g.name as group_name,
  CASE 
    WHEN ugl.user_id IS NOT NULL THEN 'Member'
    ELSE 'Not a member'
  END as membership_status
FROM auth.users u
CROSS JOIN public.groups g
LEFT JOIN public.user_group_links ugl ON ugl.user_id = auth.uid() AND ugl.group_id = g.id
WHERE u.id = auth.uid()
ORDER BY g.name;

-- Step 7: Check if Worthy Marine has any categories/tasks
SELECT 
  'Worthy Marine Categories' as check_type,
  COUNT(tc.id) as count
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
WHERE g.name = 'Worthy Marine'

UNION ALL

SELECT 
  'Worthy Marine Tasks' as check_type,
  COUNT(DISTINCT t.id) as count
FROM public.groups g
LEFT JOIN public.task_categories tc ON g.id = tc.group_id
LEFT JOIN public.task_category_map tcm ON tc.id = tcm.category_id
LEFT JOIN public.tasks t ON tcm.task_id = t.id AND t.is_latest = true
WHERE g.name = 'Worthy Marine';
