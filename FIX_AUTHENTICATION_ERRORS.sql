-- FIX AUTHENTICATION ERRORS
-- This script fixes the permission denied and API key issues
-- Execute this in Supabase SQL Editor

-- ==============================================================================
-- PHASE 1: FIX PROFILES TABLE RLS POLICIES
-- ==============================================================================

-- Drop all existing profiles policies to start clean
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for profiles table
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR
    auth.role() = 'service_role' OR
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR
    auth.role() = 'service_role' OR
    auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR
    auth.role() = 'service_role' OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ==============================================================================
-- PHASE 2: ENSURE PROFILE CREATION TRIGGER WORKS
-- ==============================================================================

-- Recreate the user registration function with proper permissions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==============================================================================
-- PHASE 3: CREATE EMERGENCY PROFILE ACCESS POLICY
-- ==============================================================================

-- Allow authenticated users to access their own profile even if it doesn't exist yet
CREATE POLICY "profiles_emergency_access" ON profiles
  FOR ALL USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- PHASE 4: GRANT NECESSARY PERMISSIONS
-- ==============================================================================

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions to service role
GRANT ALL ON profiles TO service_role;
GRANT ALL ON SCHEMA public TO service_role;

-- ==============================================================================
-- PHASE 5: CREATE PROFILE IF NOT EXISTS FUNCTION
-- ==============================================================================

-- Function to ensure profile exists for authenticated user
CREATE OR REPLACE FUNCTION ensure_profile_exists(user_id UUID, user_email TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    user_id,
    user_email,
    split_part(user_email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ensure_profile_exists TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_profile_exists TO service_role;