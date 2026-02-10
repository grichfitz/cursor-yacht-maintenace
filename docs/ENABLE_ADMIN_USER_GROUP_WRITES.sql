-- ULTRA: Enable admin users to write user_group_links
-- Issue: Admin should be able to adjust user-group assignments per RLS_DESIGN.md
-- Fix: Add INSERT/UPDATE/DELETE policies for admins on user_group_links
--
-- This is a stabilization fix (enabling intended functionality, not new development)

-- Helper function to check if current user is admin
-- Note: Using CREATE OR REPLACE to avoid dependency issues
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_links url
    JOIN public.roles r ON url.role_id = r.id
    WHERE url.user_id = auth.uid()
      AND r.name = 'admin'
  );
$$;

-- INSERT policy: Allow admins to assign users to groups
DROP POLICY IF EXISTS user_group_links_insert_admin ON public.user_group_links;
CREATE POLICY user_group_links_insert_admin
  ON public.user_group_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() = true
  );

-- UPDATE policy: Allow admins to reassign users to groups
DROP POLICY IF EXISTS user_group_links_update_admin ON public.user_group_links;
CREATE POLICY user_group_links_update_admin
  ON public.user_group_links
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() = true
  )
  WITH CHECK (
    public.is_admin() = true
  );

-- DELETE policy: Allow admins to unassign users from groups
DROP POLICY IF EXISTS user_group_links_delete_admin ON public.user_group_links;
CREATE POLICY user_group_links_delete_admin
  ON public.user_group_links
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin() = true
  );

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN 'Allows admins to assign users to groups'
    WHEN cmd = 'UPDATE' THEN 'Allows admins to reassign users to groups'
    WHEN cmd = 'DELETE' THEN 'Allows admins to unassign users from groups'
  END as description
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_group_links'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY cmd;
