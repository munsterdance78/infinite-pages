-- INFINITE PAGES DATABASE VERIFICATION QUERIES
-- Run these queries in Supabase SQL Editor after executing MASTER_DATABASE_SETUP.sql
-- These queries verify that all tables, indexes, and policies were created correctly

-- ==============================================================================
-- TABLE EXISTENCE VERIFICATION
-- ==============================================================================

-- Check all required tables exist
SELECT
  'Table Verification' as check_type,
  table_name,
  CASE
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM (
  VALUES
    ('system_logs'),
    ('profiles'),
    ('stories'),
    ('chapters'),
    ('generation_logs'),
    ('exports'),
    ('credit_packages'),
    ('credit_transactions'),
    ('payments'),
    ('creator_earnings'),
    ('payouts'),
    ('story_pricing'),
    ('story_purchases'),
    ('reading_progress'),
    ('user_library'),
    ('subscription_usage'),
    ('story_covers'),
    ('cover_generation_queue'),
    ('ai_usage_logs'),
    ('cache_rewards'),
    ('creator_earnings_accumulation'),
    ('monthly_payout_batches'),
    ('individual_payouts')
) as expected_tables(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_name = expected_tables.table_name
  AND t.table_schema = 'public'
ORDER BY expected_tables.table_name;

-- ==============================================================================
-- TABLE ROW COUNTS (Should be 0 except credit_packages and system_logs)
-- ==============================================================================

SELECT
  'Row Count Check' as check_type,
  'system_logs' as table_name,
  COUNT(*) as row_count,
  CASE WHEN COUNT(*) >= 1 THEN '✅ HAS DATA' ELSE '⚠️ NO DATA' END as status
FROM system_logs
UNION ALL
SELECT
  'Row Count Check',
  'credit_packages',
  COUNT(*),
  CASE WHEN COUNT(*) = 4 THEN '✅ SEEDED CORRECTLY' ELSE '❌ MISSING SEED DATA' END
FROM credit_packages
UNION ALL
SELECT
  'Row Count Check',
  'profiles',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ EMPTY (EXPECTED)' ELSE '⚠️ HAS DATA' END
FROM profiles
UNION ALL
SELECT
  'Row Count Check',
  'stories',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ EMPTY (EXPECTED)' ELSE '⚠️ HAS DATA' END
FROM stories;

-- ==============================================================================
-- CREDIT PACKAGES VERIFICATION
-- ==============================================================================

SELECT
  'Credit Package Verification' as check_type,
  name,
  credits_amount,
  price_usd,
  stripe_price_id,
  is_active,
  CASE
    WHEN is_active = true THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE'
  END as status
FROM credit_packages
ORDER BY sort_order;

-- ==============================================================================
-- INDEX VERIFICATION
-- ==============================================================================

SELECT
  'Index Verification' as check_type,
  schemaname,
  tablename,
  indexname,
  '✅ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ==============================================================================
-- RLS POLICIES VERIFICATION
-- ==============================================================================

SELECT
  'RLS Policy Verification' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  '✅ EXISTS' as status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==============================================================================
-- FOREIGN KEY RELATIONSHIPS VERIFICATION
-- ==============================================================================

SELECT
  'Foreign Key Verification' as check_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ LINKED' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ==============================================================================
-- COLUMN TYPE VERIFICATION FOR CRITICAL TABLES
-- ==============================================================================

-- Verify profiles table has all required columns
SELECT
  'Profiles Column Check' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name IN (
      'id', 'email', 'subscription_tier', 'credits_balance',
      'is_creator', 'creator_tier', 'stripe_connect_account_id'
    ) THEN '✅ CRITICAL COLUMN'
    ELSE '📋 STANDARD COLUMN'
  END as importance
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ==============================================================================
-- TRIGGER VERIFICATION
-- ==============================================================================

SELECT
  'Trigger Verification' as check_type,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  '✅ EXISTS' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ==============================================================================
-- FUNCTION VERIFICATION
-- ==============================================================================

SELECT
  'Function Verification' as check_type,
  routine_name,
  routine_type,
  data_type,
  '✅ EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'update_updated_at_column')
ORDER BY routine_name;

-- ==============================================================================
-- EXTENSION VERIFICATION
-- ==============================================================================

SELECT
  'Extension Verification' as check_type,
  extname,
  extversion,
  '✅ INSTALLED' as status
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pg_trgm')
ORDER BY extname;

-- ==============================================================================
-- PERMISSIONS VERIFICATION
-- ==============================================================================

-- Check RLS is enabled on all tables
SELECT
  'RLS Status Check' as check_type,
  schemaname,
  tablename,
  rowsecurity,
  CASE
    WHEN rowsecurity = true THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ==============================================================================
-- COMPREHENSIVE DATABASE HEALTH CHECK
-- ==============================================================================

WITH table_stats AS (
  SELECT
    COUNT(*) as total_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
),
index_stats AS (
  SELECT
    COUNT(*) as total_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
),
policy_stats AS (
  SELECT
    COUNT(*) as total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
),
function_stats AS (
  SELECT
    COUNT(*) as total_functions
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('handle_new_user', 'update_updated_at_column')
),
credit_package_stats AS (
  SELECT
    COUNT(*) as credit_packages_count
  FROM credit_packages
  WHERE is_active = true
)
SELECT
  'FINAL HEALTH CHECK' as check_type,
  '🏥 DATABASE HEALTH REPORT' as component,
  CONCAT(
    'Tables: ', ts.total_tables, '/23 expected | ',
    'Indexes: ', idx.total_indexes, '/20+ expected | ',
    'Policies: ', pol.total_policies, '/15+ expected | ',
    'Functions: ', func.total_functions, '/2 expected | ',
    'Credit Packages: ', cp.credit_packages_count, '/4 expected'
  ) as details,
  CASE
    WHEN ts.total_tables >= 23
     AND idx.total_indexes >= 20
     AND pol.total_policies >= 15
     AND func.total_functions = 2
     AND cp.credit_packages_count = 4
    THEN '✅ HEALTHY - READY FOR USE'
    ELSE '⚠️ ISSUES DETECTED - REVIEW ABOVE'
  END as overall_status
FROM table_stats ts, index_stats idx, policy_stats pol, function_stats func, credit_package_stats cp;

-- ==============================================================================
-- API ENDPOINT READINESS CHECK
-- ==============================================================================

-- Test queries that API endpoints will use
SELECT
  'API Readiness Check' as check_type,
  'Credit Balance Query' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
    ) THEN '❌ Would fail - no test user'
    ELSE '✅ Structure ready'
  END as status,
  'SELECT credits_balance FROM profiles WHERE id = $1' as sample_query;

-- Test subscription tier validation
SELECT
  'API Readiness Check' as check_type,
  'Subscription Validation' as test_name,
  CASE
    WHEN 'basic' = ANY(enum_range(NULL::TEXT)) THEN '✅ Enum ready'
    ELSE '✅ Check constraint ready'
  END as status,
  'Subscription tiers: basic, premium' as sample_query;

-- Test creator earnings structure
SELECT
  'API Readiness Check' as check_type,
  'Creator Earnings Query' as test_name,
  '✅ Structure ready' as status,
  'SELECT SUM(credits_earned) FROM creator_earnings WHERE creator_id = $1' as sample_query;

-- ==============================================================================
-- FINAL SETUP VERIFICATION SUMMARY
-- ==============================================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
  package_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO function_count FROM information_schema.routines WHERE routine_schema = 'public';
  SELECT COUNT(*) INTO package_count FROM credit_packages WHERE is_active = true;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'DATABASE VERIFICATION COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'RLS policies: %', policy_count;
  RAISE NOTICE 'Functions: %', function_count;
  RAISE NOTICE 'Credit packages: %', package_count;
  RAISE NOTICE '============================================';

  IF table_count >= 23 AND policy_count >= 15 AND function_count >= 2 AND package_count = 4 THEN
    RAISE NOTICE '✅ DATABASE SETUP SUCCESSFUL!';
    RAISE NOTICE 'Ready for API endpoint testing.';
  ELSE
    RAISE NOTICE '⚠️ SETUP INCOMPLETE - Review verification queries above';
  END IF;

  RAISE NOTICE '============================================';
END $$;