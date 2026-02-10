-- ULTRA: Fix task_categories INSERT RLS policy to enforce group visibility
-- Users should only be able to create categories in groups they can see
--
-- Current policy has null WITH CHECK clause, which doesn't enforce visibility
-- This fix adds proper WITH CHECK clause matching UPDATE/DELETE policies

DROP POLICY IF EXISTS task_categories_insert_visible_groups ON public.task_categories;

CREATE POLICY task_categories_insert_visible_groups
ON public.task_categories
FOR INSERT
TO authenticated
WITH CHECK (group_id IN (SELECT visible_group_ids()));

-- This ensures users can only create categories in groups they can see
-- (groups they're members of, or descendant groups)
