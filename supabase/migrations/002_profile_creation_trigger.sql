-- Add automatic profile creation trigger and enhanced policies

-- Function to create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    now(),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the profile creation policy exists and is correct
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Add a policy to allow inserting profiles during signup (for manual creation fallback)
DROP POLICY IF EXISTS "Enable profile creation for authenticated users" ON profiles;
CREATE POLICY "Enable profile creation for authenticated users" ON profiles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = id);

-- Ensure the function can be executed
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;