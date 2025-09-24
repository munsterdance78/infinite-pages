-- =====================================================
-- DIAGNOSE THE ACTUAL PROBLEM
-- Run this first to see what's causing the conflict
-- =====================================================

-- Check if request_logs already exists
SELECT 'request_logs table exists' as status WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'request_logs'
);

-- Check what partitioned tables exist
SELECT
  schemaname,
  tablename,
  partitionboundspec
FROM pg_partitions
WHERE tablename LIKE '%cache%'
LIMIT 5;

-- Check for any existing policies that might conflict
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('request_logs', 'request_flow_analytics')
LIMIT 10;

-- This will tell us exactly what's causing the error
SELECT 'Database analysis complete' as result;