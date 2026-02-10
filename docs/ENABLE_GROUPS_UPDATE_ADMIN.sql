-- ULTRA — Stabilisation Fix
-- Enable admins to UPDATE groups from the client UI.
--
-- Symptom:
-- - Admin "Save" in Group Editor fails, often showing a PostgREST 406 on PATCH.
--   This typically happens when RLS filters the row (0 rows updated).
--
-- Notes:
-- - This is NOT new development. It's enabling intended admin operations.
-- - Uses the existing helper `public.is_admin()` (see ENABLE_ADMIN_USER_GROUP_WRITES.sql).

-- Allow admins to update any group row
DROP POLICY IF EXISTS groups_update_admin ON public.groups;
CREATE POLICY groups_update_admin
ON public.groups
FOR UPDATE
TO authenticated
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

-- (Optional) Allow admins to archive/unarchive (also UPDATE)
-- Covered by the UPDATE policy above.

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'groups'
ORDER BY cmd, policyname;

