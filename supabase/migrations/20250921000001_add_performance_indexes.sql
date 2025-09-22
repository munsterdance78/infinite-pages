-- Database Performance Optimization Migration
-- Created: 2025-09-21
-- Purpose: Add critical indexes for query optimization

-- Stories table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_user_id_status ON stories(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_genre_status ON stories(genre, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_status_published_at ON stories(status, published_at) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_created_at_desc ON stories(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_updated_at_desc ON stories(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_title_gin ON stories USING gin(to_tsvector('english', title));

-- Chapters table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_story_id_number ON chapters(story_id, chapter_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_story_id_created ON chapters(story_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_user_id_created ON chapters(user_id, created_at);

-- Profiles table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_is_creator ON profiles(is_creator) WHERE is_creator = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email_lower ON profiles(lower(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_created_at_desc ON profiles(created_at DESC);

-- Creator earnings table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_user_story ON creator_earnings(user_id, story_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_user_date ON creator_earnings(user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_story_date ON creator_earnings(story_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_amount_desc ON creator_earnings(amount_usd DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status) WHERE status IN ('pending', 'processing');

-- AI usage logs table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_user_operation ON ai_usage_logs(user_id, operation_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_story_id ON ai_usage_logs(story_id) WHERE story_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_model_date ON ai_usage_logs(ai_model_used, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_usage_operation_date ON ai_usage_logs(operation_type, created_at);

-- Credit transactions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, transaction_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_date ON credit_transactions(user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_type_date ON credit_transactions(transaction_type, created_at);

-- Story purchases table indexes (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_story_purchases_user_story ON story_purchases(user_id, story_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_story_purchases_story_date ON story_purchases(story_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_story_purchases_user_date ON story_purchases(user_id, created_at);

-- Payout related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_payout_batches_status ON monthly_payout_batches(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_payout_batches_date ON monthly_payout_batches(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_individual_payouts_user_status ON individual_payouts(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_individual_payouts_batch_id ON individual_payouts(batch_id);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_published_genre_date ON stories(genre, created_at DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_user_published_date ON stories(user_id, created_at DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_earnings_user_month ON creator_earnings(user_id, date_trunc('month', created_at));

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_content_gin ON stories USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(premise, '')));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_content_gin ON chapters USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Partial indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_active ON stories(id, updated_at) WHERE status IN ('draft', 'in_progress', 'published');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_active_creators ON profiles(id, updated_at) WHERE is_creator = true AND subscription_tier IN ('premium', 'pro');

-- Database performance views for monitoring
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE calls > 100 AND mean_time > 100
ORDER BY total_time DESC;

-- Index usage statistics view
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE
        WHEN idx_scan = 0 THEN 'Unused'
        WHEN idx_scan < 100 THEN 'Low usage'
        ELSE 'Active'
    END as usage_level
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Table size monitoring view
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query performance monitoring function
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS TABLE (
    table_name text,
    index_name text,
    index_size text,
    index_scans bigint,
    tuples_read bigint,
    tuples_fetched bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.tablename::text,
        i.indexname::text,
        pg_size_pretty(pg_relation_size(i.indexrelid))::text,
        i.idx_scan,
        i.idx_tup_read,
        i.idx_tup_fetch
    FROM pg_stat_user_indexes i
    JOIN pg_index ix ON i.indexrelid = ix.indexrelid
    WHERE i.schemaname = 'public'
    ORDER BY i.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON INDEX idx_stories_user_id_status IS 'Optimize user story queries with status filtering';
COMMENT ON INDEX idx_stories_genre_status IS 'Optimize genre-based story browsing';
COMMENT ON INDEX idx_stories_status_published_at IS 'Optimize published story listings by date';
COMMENT ON INDEX idx_creator_earnings_user_story IS 'Optimize earnings queries by user and story';
COMMENT ON INDEX idx_ai_usage_user_operation IS 'Optimize AI usage analytics by user and operation type';

-- Update table statistics
ANALYZE stories;
ANALYZE chapters;
ANALYZE profiles;
ANALYZE creator_earnings;
ANALYZE ai_usage_logs;
ANALYZE credit_transactions;