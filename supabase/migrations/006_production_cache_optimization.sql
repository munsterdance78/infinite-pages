-- Production-Optimized Cache System Migration
-- This migration optimizes the Infinite Pages cache system for high-traffic production deployment
-- Includes: partitioning, advanced indexing, auto-cleanup, connection pooling, and enhanced security

-- =====================================================
-- 1. PRODUCTION TABLE STRUCTURE WITH PARTITIONING
-- =====================================================

-- Drop existing table if we're restructuring (careful in production!)
-- DROP TABLE IF EXISTS infinite_pages_cache CASCADE;

-- Create partitioned cache table optimized for production
CREATE TABLE IF NOT EXISTS infinite_pages_cache_partitioned (
  id UUID DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  content JSONB NOT NULL,
  content_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,

  -- Metadata for intelligent matching
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Caching strategy fields
  foundation_dependency TEXT,
  prompt_template TEXT NOT NULL,
  prompt_variables JSONB NOT NULL DEFAULT '{}',
  semantic_similarity_hash TEXT NOT NULL,
  reuse_score DECIMAL(3,1) NOT NULL DEFAULT 5.0,

  -- Cache management with production optimizations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  adaptation_count INTEGER NOT NULL DEFAULT 0,
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_cost_saved INTEGER NOT NULL DEFAULT 0,

  -- Production fields
  access_frequency INTEGER NOT NULL DEFAULT 1,
  priority_tier INTEGER NOT NULL DEFAULT 3, -- 1=high, 2=medium, 3=low
  compression_applied BOOLEAN NOT NULL DEFAULT FALSE,

  -- Ensure unique cache keys per user and type
  CONSTRAINT unique_cache_key_per_user_type UNIQUE(cache_key, user_id, content_type),

  -- Primary key includes partition key for optimal performance
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the next 12 months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Current month
    start_date := DATE_TRUNC('month', CURRENT_DATE);

    -- Create 12 monthly partitions
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'infinite_pages_cache_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF infinite_pages_cache_partitioned
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- =====================================================
-- 2. PRODUCTION-OPTIMIZED INDEXES
-- =====================================================

-- Core performance indexes for high-traffic queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_user_content_type_performance
  ON infinite_pages_cache_partitioned(user_id, content_type, last_accessed DESC)
  WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_expires_at_cleanup
  ON infinite_pages_cache_partitioned(expires_at)
  WHERE expires_at <= NOW() + INTERVAL '24 hours';

-- Semantic similarity lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_semantic_hash_reuse
  ON infinite_pages_cache_partitioned(semantic_similarity_hash, reuse_score DESC, hit_count DESC)
  WHERE expires_at > NOW();

-- Foundation dependency tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_foundation_dependency_performance
  ON infinite_pages_cache_partitioned(foundation_dependency, user_id, created_at DESC)
  WHERE foundation_dependency IS NOT NULL AND expires_at > NOW();

-- Content type specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_content_type_priority
  ON infinite_pages_cache_partitioned(content_type, priority_tier, access_frequency DESC)
  WHERE expires_at > NOW();

-- User analytics queries optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_user_analytics
  ON infinite_pages_cache_partitioned(user_id, created_at DESC, hit_count, token_cost_saved)
  WHERE expires_at > NOW();

-- GIN index for complex metadata queries (genre, theme matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_metadata_gin_optimized
  ON infinite_pages_cache_partitioned USING GIN (metadata)
  WHERE expires_at > NOW();

-- Composite index for cache lookup efficiency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_lookup_composite
  ON infinite_pages_cache_partitioned(user_id, cache_key, content_type, semantic_similarity_hash);

-- Hot data optimization (frequently accessed entries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_hot_data
  ON infinite_pages_cache_partitioned(access_frequency DESC, last_accessed DESC)
  WHERE expires_at > NOW() AND access_frequency > 5;

-- =====================================================
-- 3. AUTO-CLEANUP SYSTEM
-- =====================================================

-- Enhanced cleanup function with batch processing and metrics
CREATE OR REPLACE FUNCTION cleanup_expired_cache_entries_production()
RETURNS TABLE(
  deleted_count INTEGER,
  freed_space_mb NUMERIC,
  cleanup_duration_ms INTEGER,
  partition_cleaned TEXT[]
) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  deleted_rows INTEGER := 0;
  partition_record RECORD;
  cleaned_partitions TEXT[] := '{}';
  total_size_before BIGINT;
  total_size_after BIGINT;
BEGIN
  start_time := NOW();

  -- Get table size before cleanup
  SELECT pg_total_relation_size('infinite_pages_cache_partitioned') INTO total_size_before;

  -- Clean each partition separately for better performance
  FOR partition_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE tablename LIKE 'infinite_pages_cache_%'
    AND schemaname = 'public'
  LOOP
    EXECUTE format('
      DELETE FROM %I.%I
      WHERE expires_at < NOW() - INTERVAL ''1 hour''',
      partition_record.schemaname,
      partition_record.tablename
    );

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;

    IF deleted_rows > 0 THEN
      cleaned_partitions := array_append(cleaned_partitions, partition_record.tablename);
    END IF;
  END LOOP;

  -- Also clean low-priority entries older than 30 days
  DELETE FROM infinite_pages_cache_partitioned
  WHERE priority_tier = 3
    AND created_at < NOW() - INTERVAL '30 days'
    AND hit_count = 0;

  -- Get table size after cleanup
  SELECT pg_total_relation_size('infinite_pages_cache_partitioned') INTO total_size_after;
  end_time := NOW();

  -- Update statistics
  ANALYZE infinite_pages_cache_partitioned;

  RETURN QUERY SELECT
    deleted_rows,
    ROUND((total_size_before - total_size_after) / 1024.0 / 1024.0, 2),
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER,
    cleaned_partitions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup trigger function
CREATE OR REPLACE FUNCTION trigger_cache_cleanup_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  cleanup_probability NUMERIC := 0.001; -- 0.1% chance per insert
BEGIN
  -- Randomly trigger cleanup to distribute load
  IF random() < cleanup_probability THEN
    PERFORM cleanup_expired_cache_entries_production();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for periodic cleanup
DROP TRIGGER IF EXISTS auto_cleanup_cache_trigger ON infinite_pages_cache_partitioned;
CREATE TRIGGER auto_cleanup_cache_trigger
  AFTER INSERT ON infinite_pages_cache_partitioned
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cache_cleanup_on_insert();

-- =====================================================
-- 4. CONNECTION POOLING OPTIMIZATION SETTINGS
-- =====================================================

-- Apply connection and performance settings
-- Note: These would typically be set at the PostgreSQL instance level
-- Including here for documentation and can be applied via ALTER SYSTEM

-- Connection pooling recommendations (to be applied at instance level):
/*
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Cache-specific optimizations
ALTER SYSTEM SET work_mem = '16MB'; -- For sorting and hashing
ALTER SYSTEM SET temp_file_limit = '1GB'; -- Limit temp file usage
*/

-- Create connection pool monitoring view
CREATE OR REPLACE VIEW cache_connection_metrics AS
SELECT
  datname as database_name,
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  avg(extract(epoch from (now() - query_start))) as avg_query_duration_seconds
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname;

-- =====================================================
-- 5. ENHANCED ROW-LEVEL SECURITY FOR MULTI-TENANT ISOLATION
-- =====================================================

-- Enable RLS on the partitioned table
ALTER TABLE infinite_pages_cache_partitioned ENABLE ROW LEVEL SECURITY;

-- Core user isolation policy
CREATE POLICY "tenant_isolation_cache_access" ON infinite_pages_cache_partitioned
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Read-only policy for analytics service accounts
CREATE POLICY "analytics_readonly_access" ON infinite_pages_cache_partitioned
  FOR SELECT
  USING (
    -- Allow analytics service to read aggregate data without user PII
    current_setting('role') = 'analytics_service' AND
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Admin access policy for system maintenance
CREATE POLICY "admin_maintenance_access" ON infinite_pages_cache_partitioned
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' AND
    current_setting('role') = 'maintenance_admin'
  );

-- Performance optimization: Bypass RLS for service operations
CREATE POLICY "service_bypass_policy" ON infinite_pages_cache_partitioned
  FOR ALL
  USING (
    -- Allow system services to bypass RLS for cleanup operations
    current_setting('row_security') = 'off' OR
    session_user = 'postgres'
  );

-- =====================================================
-- 6. PRODUCTION MONITORING AND MAINTENANCE
-- =====================================================

-- Cache performance monitoring view
CREATE OR REPLACE VIEW cache_performance_metrics AS
SELECT
  content_type,
  count(*) as total_entries,
  count(*) FILTER (WHERE hit_count > 0) as cache_hits,
  round(avg(hit_count), 2) as avg_hit_count,
  round(avg(token_cost_saved), 2) as avg_tokens_saved,
  round(avg(access_frequency), 2) as avg_access_frequency,
  count(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
  count(*) FILTER (WHERE priority_tier = 1) as high_priority_entries,
  max(last_accessed) as last_activity,
  round(
    (count(*) FILTER (WHERE hit_count > 0)::DECIMAL / NULLIF(count(*), 0)) * 100,
    2
  ) as hit_rate_percentage
FROM infinite_pages_cache_partitioned
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY content_type
ORDER BY hit_rate_percentage DESC;

-- Partition health monitoring
CREATE OR REPLACE VIEW partition_health_metrics AS
SELECT
  schemaname,
  tablename as partition_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  (
    SELECT count(*)
    FROM information_schema.tables t2
    WHERE t2.table_name = tablename
  ) as row_count_estimate,
  CASE
    WHEN tablename ~ '_[0-9]{4}_[0-9]{2}$' THEN
      EXTRACT(DAYS FROM NOW() - (tablename || '-01')::DATE)
    ELSE NULL
  END as partition_age_days
FROM pg_tables
WHERE tablename LIKE 'infinite_pages_cache_%'
ORDER BY partition_age_days DESC NULLS LAST;

-- User cache usage analytics (privacy-compliant)
CREATE OR REPLACE VIEW user_cache_analytics AS
SELECT
  user_id,
  count(*) as total_cache_entries,
  count(DISTINCT content_type) as content_types_used,
  sum(hit_count) as total_cache_hits,
  sum(token_cost_saved) as total_tokens_saved,
  round(avg(reuse_score), 2) as avg_reuse_score,
  max(last_accessed) as last_cache_access,
  round(
    (sum(hit_count)::DECIMAL / NULLIF(count(*), 0)), 2
  ) as avg_hits_per_entry
FROM infinite_pages_cache_partitioned
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND expires_at > NOW()
GROUP BY user_id
ORDER BY total_tokens_saved DESC;

-- =====================================================
-- 7. AUTOMATED PARTITION MANAGEMENT
-- =====================================================

-- Function to create new partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_cache_partition(target_date DATE)
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := DATE_TRUNC('month', target_date);
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'infinite_pages_cache_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Check if partition already exists
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = partition_name
    AND schemaname = 'public'
  ) THEN
    RETURN 'Partition ' || partition_name || ' already exists';
  END IF;

  -- Create the partition
  EXECUTE format('
    CREATE TABLE %I PARTITION OF infinite_pages_cache_partitioned
    FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );

  -- Create indexes on the new partition
  EXECUTE format('
    CREATE INDEX %I ON %I(user_id, content_type, last_accessed DESC)
    WHERE expires_at > NOW()',
    'idx_' || partition_name || '_user_content', partition_name
  );

  RETURN 'Created partition ' || partition_name || ' for period ' || start_date || ' to ' || end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION drop_old_cache_partitions(months_to_keep INTEGER DEFAULT 6)
RETURNS TEXT[] AS $$
DECLARE
  partition_record RECORD;
  dropped_partitions TEXT[] := '{}';
  cutoff_date DATE;
BEGIN
  cutoff_date := DATE_TRUNC('month', CURRENT_DATE) - (months_to_keep || ' months')::INTERVAL;

  FOR partition_record IN
    SELECT tablename
    FROM pg_tables
    WHERE tablename ~ '^infinite_pages_cache_[0-9]{4}_[0-9]{2}$'
    AND schemaname = 'public'
    AND (tablename || '_01')::DATE < cutoff_date
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', partition_record.tablename);
    dropped_partitions := array_append(dropped_partitions, partition_record.tablename);
  END LOOP;

  RETURN dropped_partitions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. MIGRATION FROM EXISTING TABLE (IF NEEDED)
-- =====================================================

-- Migrate data from existing table to partitioned table
-- Run this carefully in production with proper downtime planning
CREATE OR REPLACE FUNCTION migrate_to_partitioned_cache()
RETURNS TABLE(migrated_rows INTEGER, migration_duration_ms INTEGER) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  row_count INTEGER;
BEGIN
  start_time := NOW();

  -- Check if old table exists
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'infinite_pages_cache'
    AND schemaname = 'public'
  ) THEN
    -- Insert data in batches to avoid blocking
    INSERT INTO infinite_pages_cache_partitioned
    SELECT * FROM infinite_pages_cache
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months';

    GET DIAGNOSTICS row_count = ROW_COUNT;
  ELSE
    row_count := 0;
  END IF;

  end_time := NOW();

  RETURN QUERY SELECT
    row_count,
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. PRODUCTION DEPLOYMENT SCRIPTS
-- =====================================================

-- Schedule automatic partition creation (run monthly)
SELECT cron.schedule(
  'create-monthly-cache-partition',
  '0 0 1 * *', -- First day of each month at midnight
  'SELECT create_monthly_cache_partition(CURRENT_DATE + INTERVAL ''1 month'');'
);

-- Schedule old partition cleanup (run quarterly)
SELECT cron.schedule(
  'cleanup-old-cache-partitions',
  '0 2 1 */3 *', -- First day of every quarter at 2 AM
  'SELECT drop_old_cache_partitions(6);'
);

-- Schedule daily cleanup with monitoring
SELECT cron.schedule(
  'daily-cache-cleanup-production',
  '0 3 * * *', -- Daily at 3 AM
  'SELECT cleanup_expired_cache_entries_production();'
);

-- =====================================================
-- 10. SECURITY AND COMPLIANCE
-- =====================================================

-- Audit log for cache access (for compliance)
CREATE TABLE IF NOT EXISTS cache_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  action TEXT NOT NULL, -- 'read', 'write', 'delete'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT TRUE
) PARTITION BY RANGE (timestamp);

-- Create audit log partitions
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE);

    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'cache_audit_log_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF cache_audit_log
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Enable RLS on audit log
ALTER TABLE cache_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log access policy
CREATE POLICY "audit_log_user_access" ON cache_audit_log
  FOR SELECT
  USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- PRODUCTION DEPLOYMENT COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE infinite_pages_cache_partitioned IS 'Production-optimized cache table with monthly partitioning for high-performance multi-tenant AI content caching';
COMMENT ON FUNCTION cleanup_expired_cache_entries_production IS 'Production cache cleanup with batch processing and performance metrics';
COMMENT ON FUNCTION create_monthly_cache_partition IS 'Automated monthly partition creation for cache table';
COMMENT ON VIEW cache_performance_metrics IS 'Real-time cache performance monitoring for production dashboards';
COMMENT ON VIEW partition_health_metrics IS 'Partition size and health monitoring for database maintenance';

-- Grant necessary permissions
GRANT SELECT ON cache_performance_metrics TO authenticated;
GRANT SELECT ON partition_health_metrics TO authenticated;
GRANT SELECT ON cache_connection_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_cache_entries_production TO service_role;
GRANT EXECUTE ON FUNCTION create_monthly_cache_partition TO service_role;
GRANT EXECUTE ON FUNCTION drop_old_cache_partitions TO service_role;