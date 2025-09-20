-- Migration: Foundation Fingerprint Efficiency Tracking
-- Adds analytics for foundation fingerprint performance and collision detection

-- Create function to analyze foundation fingerprint efficiency
CREATE OR REPLACE FUNCTION analyze_foundation_fingerprint_efficiency(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  fingerprint_stats JSONB;
  collision_rate DECIMAL;
  reuse_patterns JSONB;
  efficiency_score DECIMAL;
BEGIN
  -- Foundation fingerprint statistics
  SELECT jsonb_build_object(
    'totalFoundations', COUNT(*),
    'uniqueFingerprints', COUNT(DISTINCT foundation_dependency),
    'avgReusePerFingerprint', ROUND(AVG(reuse_count), 2),
    'maxReusePerFingerprint', MAX(reuse_count),
    'topFingerprintSavings', MAX(total_savings)
  ) INTO fingerprint_stats
  FROM (
    SELECT
      foundation_dependency,
      COUNT(*) as reuse_count,
      SUM(token_cost_saved) * 0.000015 as total_savings
    FROM infinite_pages_cache
    WHERE infinite_pages_cache.user_id = analyze_foundation_fingerprint_efficiency.user_id
      AND foundation_dependency IS NOT NULL
      AND content_type = 'chapter_content'
    GROUP BY foundation_dependency
  ) fingerprint_groups;

  -- Calculate collision rate (foundations with same fingerprint but different content)
  SELECT ROUND(
    CASE WHEN total_fingerprints > 0
         THEN (collisions::DECIMAL / total_fingerprints) * 100
         ELSE 0
    END, 2
  ) INTO collision_rate
  FROM (
    SELECT
      COUNT(DISTINCT foundation_dependency) as total_fingerprints,
      COUNT(*) FILTER (WHERE group_size > 1) as collisions
    FROM (
      SELECT
        foundation_dependency,
        COUNT(DISTINCT prompt_variables->>'title') as group_size
      FROM infinite_pages_cache
      WHERE infinite_pages_cache.user_id = analyze_foundation_fingerprint_efficiency.user_id
        AND foundation_dependency IS NOT NULL
        AND content_type = 'story_foundation'
      GROUP BY foundation_dependency
    ) fingerprint_analysis
  ) collision_data;

  -- Reuse patterns by genre and foundation characteristics
  SELECT jsonb_agg(jsonb_build_object(
    'genre', genre,
    'avgChaptersPerFoundation', avg_chapters,
    'reuseEfficiency', reuse_efficiency,
    'totalSavings', total_savings
  )) INTO reuse_patterns
  FROM (
    SELECT
      f.metadata->>'genre' as genre,
      ROUND(AVG(chapter_counts.chapter_count), 1) as avg_chapters,
      ROUND(AVG(f.hit_count), 1) as reuse_efficiency,
      ROUND(SUM(f.token_cost_saved) * 0.000015, 4) as total_savings
    FROM infinite_pages_cache f
    LEFT JOIN (
      SELECT
        foundation_dependency,
        COUNT(*) as chapter_count
      FROM infinite_pages_cache
      WHERE infinite_pages_cache.user_id = analyze_foundation_fingerprint_efficiency.user_id
        AND content_type = 'chapter_content'
        AND foundation_dependency IS NOT NULL
      GROUP BY foundation_dependency
    ) chapter_counts ON f.foundation_dependency = chapter_counts.foundation_dependency
    WHERE f.user_id = analyze_foundation_fingerprint_efficiency.user_id
      AND f.content_type = 'story_foundation'
      AND f.metadata ? 'genre'
    GROUP BY f.metadata->>'genre'
    ORDER BY reuse_efficiency DESC, total_savings DESC
    LIMIT 5
  ) genre_patterns;

  -- Overall fingerprint efficiency score (0-100)
  SELECT ROUND(
    CASE WHEN (fingerprint_stats->>'totalFoundations')::INTEGER > 0
         THEN (
           -- Low collision rate is good (invert and scale)
           ((100 - LEAST(collision_rate, 100)) * 0.3) +
           -- High reuse per fingerprint is good
           (LEAST((fingerprint_stats->>'avgReusePerFingerprint')::DECIMAL / 5 * 100, 100) * 0.4) +
           -- High number of unique fingerprints relative to foundations is good
           (LEAST(
             (fingerprint_stats->>'uniqueFingerprints')::DECIMAL /
             NULLIF((fingerprint_stats->>'totalFoundations')::DECIMAL, 0) * 100, 100
           ) * 0.3)
         )
         ELSE 0
    END, 1
  ) INTO efficiency_score;

  RETURN jsonb_build_object(
    'fingerprintStats', COALESCE(fingerprint_stats, '{}'::jsonb),
    'collisionRate', collision_rate,
    'reusePatterns', COALESCE(reuse_patterns, '[]'::jsonb),
    'efficiencyScore', efficiency_score,
    'recommendations',
      CASE
        WHEN collision_rate > 10 THEN '["Consider more specific foundation elements to reduce collisions"]'
        WHEN (fingerprint_stats->>'avgReusePerFingerprint')::DECIMAL < 2 THEN '["Create more stories with similar themes to improve reuse"]'
        ELSE '["Foundation fingerprinting is working well!"]'
      END::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for foundation fingerprint health monitoring
CREATE OR REPLACE VIEW foundation_fingerprint_health AS
SELECT
  u.id as user_id,
  COUNT(DISTINCT f.foundation_dependency) as unique_fingerprints,
  COUNT(*) FILTER (WHERE f.content_type = 'story_foundation') as total_foundations,
  COUNT(*) FILTER (WHERE f.content_type = 'chapter_content') as total_chapters,
  ROUND(AVG(f.hit_count), 2) as avg_reuse_rate,
  ROUND(SUM(f.token_cost_saved) * 0.000015, 4) as total_savings,
  MAX(f.last_accessed) as last_activity
FROM auth.users u
LEFT JOIN infinite_pages_cache f ON u.id = f.user_id
WHERE f.foundation_dependency IS NOT NULL
GROUP BY u.id;

-- Add helpful comments
COMMENT ON FUNCTION analyze_foundation_fingerprint_efficiency IS 'Analyzes foundation fingerprint performance, collision rates, and reuse patterns';
COMMENT ON VIEW foundation_fingerprint_health IS 'Monitoring view for foundation fingerprint system health across all users';

-- Create index for fingerprint analytics performance
CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_fingerprint_analytics
  ON infinite_pages_cache(user_id, foundation_dependency, content_type, hit_count)
  WHERE foundation_dependency IS NOT NULL;

-- Create index for collision detection
CREATE INDEX IF NOT EXISTS idx_infinite_pages_cache_collision_detection
  ON infinite_pages_cache(foundation_dependency, content_type)
  WHERE foundation_dependency IS NOT NULL AND content_type = 'story_foundation';

-- Add fingerprint health check function
CREATE OR REPLACE FUNCTION check_fingerprint_health()
RETURNS TABLE(
  user_id UUID,
  health_score INTEGER,
  issues TEXT[],
  recommendations TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.user_id,
    CASE
      WHEN h.unique_fingerprints = 0 THEN 0
      WHEN h.total_foundations = 0 THEN 0
      ELSE LEAST(100,
        ROUND(
          (h.avg_reuse_rate * 20) +
          (LEAST(h.total_chapters::DECIMAL / h.total_foundations, 10) * 10) +
          (LEAST(h.total_savings * 1000, 100))
        )::INTEGER
      )
    END as health_score,
    CASE
      WHEN h.unique_fingerprints = 0 THEN ARRAY['No foundation fingerprints found']
      WHEN h.avg_reuse_rate < 1 THEN ARRAY['Low foundation reuse rate']
      WHEN h.total_chapters::DECIMAL / NULLIF(h.total_foundations, 0) < 2 THEN ARRAY['Few chapters per foundation']
      ELSE ARRAY[]::TEXT[]
    END as issues,
    CASE
      WHEN h.unique_fingerprints = 0 THEN ARRAY['Create story foundations to enable fingerprinting']
      WHEN h.avg_reuse_rate < 1 THEN ARRAY['Create stories with similar themes for better reuse']
      WHEN h.total_chapters::DECIMAL / NULLIF(h.total_foundations, 0) < 2 THEN ARRAY['Generate more chapters per story foundation']
      ELSE ARRAY['Foundation fingerprinting is healthy!']
    END as recommendations
  FROM foundation_fingerprint_health h;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;