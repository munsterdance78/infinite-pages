-- Migration: Add cache tracking to profiles table

-- Add cache tracking columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tokens_saved_cache INTEGER DEFAULT 0;

-- Add index for cache analytics
CREATE INDEX IF NOT EXISTS idx_profiles_tokens_saved_cache
ON profiles(tokens_saved_cache) WHERE tokens_saved_cache > 0;

-- Add cache efficiency view
CREATE OR REPLACE VIEW cache_efficiency_by_user AS
SELECT
  id,
  tokens_used_total,
  tokens_saved_cache,
  CASE
    WHEN tokens_used_total > 0
    THEN ROUND((tokens_saved_cache::DECIMAL / (tokens_used_total + tokens_saved_cache)) * 100, 2)
    ELSE 0
  END as cache_efficiency_percentage,
  CASE
    WHEN tokens_saved_cache > 0
    THEN tokens_saved_cache * 0.000015
    ELSE 0
  END as cost_savings_usd
FROM profiles;

-- Comment on the new column
COMMENT ON COLUMN profiles.tokens_saved_cache IS 'Total tokens saved through intelligent caching system';

-- Add helpful view for tracking cache performance over time
CREATE OR REPLACE VIEW daily_cache_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE hit_count > 0) as cache_hits,
  ROUND(
    (COUNT(*) FILTER (WHERE hit_count > 0)::DECIMAL / COUNT(*)) * 100,
    2
  ) as hit_rate_percentage,
  SUM(token_cost_saved) as total_tokens_saved,
  SUM(token_cost_saved) * 0.000015 as cost_savings_usd
FROM infinite_pages_cache
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;