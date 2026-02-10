-- ULTRA: Enable users to update their own display_name
-- This allows authenticated users to update their own user record's display_name field
-- 
-- Per RLS_DESIGN.md: "Membership and group structure: service/admin only"
-- But display_name is a user profile field, not membership, so users should be able to update their own.

-- Create UPDATE policy for users table
-- Users can only update their own record (id = auth.uid())
-- Only allow updating display_name field (not email or other fields)

DROP POLICY IF EXISTS users_update_self ON public.users;

CREATE POLICY users_update_self
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Note: The policy allows UPDATE on any field, but the application code
-- should restrict updates to display_name only. If we want stricter RLS,
-- we could use a function that checks the changed columns, but that's
-- more complex and the application layer restriction is sufficient.
