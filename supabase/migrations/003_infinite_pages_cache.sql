-- Migration: Infinite Pages Cache System
-- Priority 1: Foundation caching for 80% cost reduction on 8-token operations

-- Create the main cache table
CREATE TABLE IF NOT EXISTS infinite_pages_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  content JSONB NOT NULL,
  content_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,

  -- Metadata for intelligent matching
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Caching strategy fields
  foundation_dependency TEXT, -- Links to foundation this content depends on
  prompt_template TEXT NOT NULL,
  prompt_variables JSONB NOT NULL DEFAULT '{}',
  semantic_similarity_hash TEXT NOT NULL,
  reuse_score DECIMAL(3,1) NOT NULL DEFAULT 5.0,

  -- Cache management
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  adaptation_count INTEGER NOT NULL DEFAULT 0,
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_cost_saved INTEGER NOT NULL DEFAULT 0,

  -- Ensure unique cache keys per user
  UNIQUE(cache_key, user_id, content_type)
);

-- Create indexes for optimal cache performance
CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_user_content_type
  ON infinite_pages_cache(user_id, content_type);

CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_expires_at
  ON infinite_pages_cache(expires_at) WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_semantic_hash
  ON infinite_pages_cache(semantic_similarity_hash);

CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_foundation_dep
  ON infinite_pages_cache(foundation_dependency) WHERE foundation_dependency IS NOT NULL;

-- GIN index for metadata queries (genre, premise_hash, etc.)
CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_metadata
  ON infinite_pages_cache USING GIN (metadata);

-- Index for reuse scoring and hit count optimization
CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_reuse_score
  ON infinite_pages_cache(content_type, reuse_score DESC, hit_count DESC);

-- Create the content type enum for validation
DO $$ BEGIN
  CREATE TYPE infinite_pages_content_type AS ENUM (
    -- Story Foundation Components
    'story_foundation', 'main_characters', 'setting', 'plot_structure',
    'themes', 'tone', 'target_audience', 'chapter_outline',
    -- Chapter Components
    'chapter_content', 'chapter_summary', 'key_events',
    'character_development', 'foreshadowing',
    -- Improvement Types
    'improvement_general', 'improvement_dialogue', 'improvement_description',
    'improvement_pacing', 'improvement_character', 'improvement_plot',
    'improvement_style', 'improvement_grammar',
    -- Analysis Types
    'analysis_comprehensive', 'analysis_style', 'analysis_structure',
    'analysis_quality', 'analysis_readability', 'analysis_genre',
    -- Export Formats
    'export_pdf', 'export_epub', 'export_docx', 'export_txt'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add constraint to validate content_type
ALTER TABLE infinite_pages_cache
  ADD CONSTRAINT chk_infinite_pages_cache_content_type
  CHECK (content_type::infinite_pages_content_type IS NOT NULL);

-- RLS Policies for security
ALTER TABLE infinite_pages_cache ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cache entries
CREATE POLICY "Users can manage their own cache entries" ON infinite_pages_cache
  FOR ALL USING (auth.uid() = user_id);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache_entries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM infinite_pages_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function for comprehensive cache analytics
CREATE OR REPLACE FUNCTION get_infinite_pages_analytics(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  total_tokens_saved INTEGER;
  cache_stats JSONB;
  genre_stats JSONB;
  foundation_reuse_rate DECIMAL;
  monthly_savings DECIMAL;
  avg_chapters_per_foundation DECIMAL;
  most_reused_foundations JSONB;
  daily_performance JSONB;
  cache_efficiency_score DECIMAL;
BEGIN
  -- Calculate total tokens saved
  SELECT COALESCE(SUM(token_cost_saved), 0) INTO total_tokens_saved
  FROM infinite_pages_cache
  WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id;

  -- Enhanced cache hit rates by content type with better metrics
  SELECT jsonb_object_agg(
    content_type,
    CASE WHEN total_entries > 0
         THEN ROUND(((total_hits::DECIMAL / NULLIF(total_entries + total_hits, 0)) * 100), 1)
         ELSE 0
    END
  ) INTO cache_stats
  FROM (
    SELECT
      content_type,
      COUNT(*) as total_entries,
      COALESCE(SUM(hit_count), 0) as total_hits
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
    GROUP BY content_type
  ) stats;

  -- Enhanced genre efficiency analysis with reuse patterns
  SELECT jsonb_agg(jsonb_build_object(
    'genre', genre,
    'efficiency', efficiency,
    'cacheHitRate', hit_rate,
    'totalSavings', total_savings
  )) INTO genre_stats
  FROM (
    SELECT
      metadata->>'genre' as genre,
      ROUND(AVG(reuse_score), 1) as efficiency,
      ROUND(AVG(hit_count), 1) as hit_rate,
      ROUND(SUM(token_cost_saved) * 0.000015, 4) as total_savings
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
      AND metadata ? 'genre'
      AND metadata->>'genre' IS NOT NULL
    GROUP BY metadata->>'genre'
    ORDER BY efficiency DESC, total_savings DESC
    LIMIT 5
  ) gs;

  -- Foundation reuse rate with better calculation
  SELECT ROUND(
    CASE WHEN COUNT(*) > 0
         THEN (COUNT(*) FILTER (WHERE hit_count > 0)::DECIMAL / COUNT(*)) * 100
         ELSE 0
    END, 1
  ) INTO foundation_reuse_rate
  FROM infinite_pages_cache
  WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
    AND content_type = 'story_foundation';

  -- Average chapters per foundation
  SELECT ROUND(
    CASE WHEN foundation_count > 0
         THEN chapter_count::DECIMAL / foundation_count
         ELSE 0
    END, 1
  ) INTO avg_chapters_per_foundation
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE content_type = 'story_foundation') as foundation_count,
      COUNT(*) FILTER (WHERE content_type = 'chapter_content') as chapter_count
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
  ) counts;

  -- Most reused foundations
  SELECT jsonb_agg(jsonb_build_object(
    'title', COALESCE(prompt_variables->>'title', 'Untitled Story'),
    'genre', metadata->>'genre',
    'reuse_count', hit_count,
    'total_savings', ROUND(token_cost_saved * 0.000015, 4)
  )) INTO most_reused_foundations
  FROM (
    SELECT *
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
      AND content_type = 'story_foundation'
      AND hit_count > 0
    ORDER BY hit_count DESC, token_cost_saved DESC
    LIMIT 5
  ) foundations;

  -- Monthly cost savings (last 30 days)
  SELECT COALESCE(SUM(token_cost_saved), 0) * 0.000015 INTO monthly_savings
  FROM infinite_pages_cache
  WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Daily performance over last 7 days
  SELECT jsonb_agg(jsonb_build_object(
    'date', date,
    'requests', requests,
    'hits', hits,
    'hitRate', ROUND(CASE WHEN requests > 0 THEN (hits::DECIMAL / requests) * 100 ELSE 0 END, 1),
    'tokensSaved', tokens_saved
  )) INTO daily_performance
  FROM (
    SELECT
      DATE(created_at) as date,
      COUNT(*) as requests,
      COALESCE(SUM(hit_count), 0) as hits,
      COALESCE(SUM(token_cost_saved), 0) as tokens_saved
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
      AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  ) daily;

  -- Overall cache efficiency score (0-100)
  SELECT ROUND(
    CASE WHEN total_entries > 0
         THEN (
           (total_hits::DECIMAL / NULLIF(total_entries + total_hits, 0)) * 50 + -- Hit rate weight: 50%
           (LEAST(avg_reuse_score / 10, 1) * 30) + -- Reuse quality weight: 30%
           (LEAST(monthly_savings / 1.0, 1) * 20) -- Cost impact weight: 20%
         ) * 100
         ELSE 0
    END, 1
  ) INTO cache_efficiency_score
  FROM (
    SELECT
      COUNT(*) as total_entries,
      COALESCE(SUM(hit_count), 0) as total_hits,
      COALESCE(AVG(reuse_score), 0) as avg_reuse_score
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = get_infinite_pages_analytics.user_id
  ) metrics;

  RETURN jsonb_build_object(
    'totalTokensSaved', total_tokens_saved,
    'cacheHitRateByType', COALESCE(cache_stats, '{}'::jsonb),
    'topGenres', COALESCE(genre_stats, '[]'::jsonb),
    'foundationReuseRate', foundation_reuse_rate,
    'costSavingsThisMonth', monthly_savings,
    'avgChaptersPerFoundation', avg_chapters_per_foundation,
    'mostReusedFoundations', COALESCE(most_reused_foundations, '[]'::jsonb),
    'dailyPerformance', COALESCE(daily_performance, '[]'::jsonb),
    'cacheEfficiencyScore', cache_efficiency_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup job (runs daily at 2 AM UTC)
SELECT cron.schedule(
  'infinite-pages-cache-cleanup',
  '0 2 * * *', -- Daily at 2 AM
  'SELECT clean_expired_cache_entries();'
);

-- Add helpful comments
COMMENT ON TABLE infinite_pages_cache IS 'Hierarchical caching system for Infinite Pages novel generation content';
COMMENT ON COLUMN infinite_pages_cache.semantic_similarity_hash IS 'Hash for finding semantically similar content across different exact prompts';
COMMENT ON COLUMN infinite_pages_cache.reuse_score IS 'Score 0-10 indicating how suitable this content is for reuse (higher = more generic/reusable)';
COMMENT ON COLUMN infinite_pages_cache.foundation_dependency IS 'Links chapter/improvement cache entries to their foundation';
COMMENT ON FUNCTION get_infinite_pages_analytics IS 'Returns comprehensive analytics for cache performance and cost savings';