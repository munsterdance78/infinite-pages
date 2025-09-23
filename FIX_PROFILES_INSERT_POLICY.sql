-- PHASE 3: CRITICAL RLS POLICY FIX
-- Add missing INSERT policy for profiles table
-- This fixes the root cause blocking all authentication-dependent functionality

-- Add the missing INSERT policy for profiles table
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Verify the policy was created successfully
\d+ profiles;

-- Test the policy by attempting an INSERT (will fail if no auth context, which is expected)
-- This should show all current policies on the profiles table:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;