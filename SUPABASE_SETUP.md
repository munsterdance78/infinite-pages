# Supabase Database Setup

This document explains how to set up and configure the Supabase database for the Infinite Pages application.

## Database Schema

The application uses the following tables:
- `profiles` - User profiles and subscription information
- `stories` - Story foundations and metadata
- `chapters` - Individual story chapters
- `generation_logs` - Analytics and usage tracking
- `exports` - Export file management

## Row Level Security (RLS) Policies

All tables have RLS enabled with appropriate policies for data isolation.

### Profile Creation Issue Fix

If you're experiencing issues with profile creation (users can't sign up), apply the profile creation policies:

#### Option 1: Using Supabase CLI
```bash
supabase db push
```

#### Option 2: Manual SQL Execution
1. Go to your Supabase Dashboard > SQL Editor
2. Copy and paste the contents of `fix-profile-policy.sql`
3. Execute the SQL

#### Option 3: Use the Helper Script
```bash
node scripts/deploy-profile-policies.js
```

## Profile Creation Policies

The following policies ensure users can create their own profiles:

1. **INSERT Policy**: `"Users can create own profile"`
   - Allows authenticated users to insert their own profile
   - Enforces that `auth.uid() = id`

2. **Automatic Profile Creation Trigger**
   - Creates profiles automatically when users sign up
   - Extracts name from user metadata
   - Fallback to email prefix if no name provided

## Verification

To verify the policies are working:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';
```

You should see:
- "Users can view own profile" (SELECT)
- "Users can update own profile" (UPDATE)
- "Users can create own profile" (INSERT)

## Troubleshooting

### Profile Creation Fails
- Check that RLS is enabled on the profiles table
- Verify the INSERT policy exists
- Ensure the trigger function is present
- Check user authentication in your application

### Migration Issues
- Use `supabase db reset` to reset the database
- Re-run migrations with `supabase db push`
- Check for policy name conflicts

## Environment Variables

Ensure these are set in your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```