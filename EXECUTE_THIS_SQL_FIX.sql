-- =========================================
-- CRITICAL FIX: Add Missing RLS INSERT Policy
-- Execute this in Supabase SQL Editor
-- =========================================

-- Add the missing INSERT policy for profiles table
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Verify the policy was created successfully
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Expected result: You should see 3 policies now:
-- 1. "Users can insert own profile" (INSERT)
-- 2. "Users can update own profile" (UPDATE)
-- 3. "Users can view own profile" (SELECT)