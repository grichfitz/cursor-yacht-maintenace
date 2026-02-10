-- ULTRA: Verify task_categories INSERT RLS policy
-- Check if the INSERT policy properly enforces group visibility

-- Check current INSERT policy
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as USING,
  with_check as WITH_CHECK
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'task_categories'
  AND cmd = 'INSERT';

-- Expected: The policy should have WITH CHECK clause that enforces:
-- group_id IN (SELECT visible_group_ids())
-- This ensures users can only create categories in groups they can see.
