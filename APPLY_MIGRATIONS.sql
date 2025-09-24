-- =====================================================
-- APPLY THIS SQL IN YOUR SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard/project/[your-project]/sql
-- Copy and paste this entire file, then click "Run"
-- =====================================================

-- Create request_logs table for comprehensive request tracking
CREATE TABLE IF NOT EXISTS request_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Request identification
  request_id VARCHAR(50) UNIQUE NOT NULL,
  session_id VARCHAR(50),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Frontend context (what triggered the request)
  frontend_action VARCHAR(100), -- e.g., "story_create_button", "chapter_generate_button"
  frontend_component VARCHAR(100), -- e.g., "StoryCreator", "ChapterGenerator"
  frontend_page VARCHAR(100), -- e.g., "/dashboard", "/stories/123"

  -- API details
  api_endpoint VARCHAR(200) NOT NULL, -- actual endpoint called
  expected_endpoint VARCHAR(200), -- what was expected
  http_method VARCHAR(10) NOT NULL,

  -- Request/Response data
  request_headers JSONB,
  request_body_size INTEGER,
  response_status INTEGER,
  response_headers JSONB,
  response_body_size INTEGER,
  response_time_ms INTEGER,

  -- Success/Failure tracking
  success_flag BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  error_category VARCHAR(50),

  -- Integration tracking
  integration_point VARCHAR(100), -- e.g., "claude_api", "supabase_insert", "stripe_payment"
  expected_integration VARCHAR(100),
  integration_success BOOLEAN,

  -- User context
  user_tier VARCHAR(20), -- basic, premium
  device_info JSONB,

  -- Timing and performance
  queue_time_ms INTEGER, -- time spent in queue/rate limiting
  processing_time_ms INTEGER, -- server processing time
  total_time_ms INTEGER, -- end-to-end time

  -- Metadata
  custom_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (response_status >= 100 AND response_status <= 599),
  CHECK (response_time_ms >= 0),
  CHECK (total_time_ms >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_success ON request_logs(success_flag);
CREATE INDEX IF NOT EXISTS idx_request_logs_integration ON request_logs(integration_point);
CREATE INDEX IF NOT EXISTS idx_request_logs_frontend_action ON request_logs(frontend_action);
CREATE INDEX IF NOT EXISTS idx_request_logs_session ON request_logs(session_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_request_logs_user_success_time ON request_logs(user_id, success_flag, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint_success_time ON request_logs(api_endpoint, success_flag, created_at DESC);

-- Create request_flow_analytics table for aggregated data
CREATE TABLE IF NOT EXISTS request_flow_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Analytics period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- hour, day, week

  -- Aggregation keys
  api_endpoint VARCHAR(200),
  frontend_action VARCHAR(100),
  integration_point VARCHAR(100),

  -- Metrics
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2), -- percentage

  -- Performance metrics
  avg_response_time_ms INTEGER,
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,

  -- User metrics
  unique_users INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,

  -- Integration health
  integration_success_rate DECIMAL(5,2),
  endpoint_mismatch_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(period_start, period_end, period_type, api_endpoint, frontend_action, integration_point)
);

-- Create indexes for analytics table
CREATE INDEX IF NOT EXISTS idx_analytics_period ON request_flow_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_endpoint ON request_flow_analytics(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_analytics_action ON request_flow_analytics(frontend_action);
CREATE INDEX IF NOT EXISTS idx_analytics_integration ON request_flow_analytics(integration_point);

-- Create RLS policies for request_logs
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own request logs
CREATE POLICY "Users can view own request logs" ON request_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert/update request logs
CREATE POLICY "Service role can manage request logs" ON request_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Admins can view all logs
CREATE POLICY "Admins can view all request logs" ON request_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create RLS policies for analytics table
ALTER TABLE request_flow_analytics ENABLE ROW LEVEL SECURITY;

-- Service role can manage analytics
CREATE POLICY "Service role can manage analytics" ON request_flow_analytics
  FOR ALL USING (auth.role() = 'service_role');

-- Admins can view analytics
CREATE POLICY "Admins can view analytics" ON request_flow_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create materialized view for real-time dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS request_dashboard_stats AS
SELECT
  -- Recent activity (last hour)
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as requests_last_hour,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour' AND success_flag = false) as errors_last_hour,

  -- Success rates
  ROUND((COUNT(*) FILTER (WHERE success_flag = true)::DECIMAL / COUNT(*)) * 100, 2) as overall_success_rate,
  ROUND((COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour' AND success_flag = true)::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0)) * 100, 2) as hourly_success_rate,

  -- Performance metrics
  ROUND(AVG(response_time_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')) as avg_response_time_hour,
  MAX(response_time_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as max_response_time_hour,

  -- Active users
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as active_users_hour,
  COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as active_sessions_hour,

  -- Top integration issues
  COUNT(*) FILTER (WHERE api_endpoint != expected_endpoint AND created_at >= NOW() - INTERVAL '1 hour') as endpoint_mismatches_hour

FROM request_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Add RPC function for integration health analytics
CREATE OR REPLACE FUNCTION get_integration_health()
RETURNS TABLE(
  integration_point VARCHAR,
  total_requests BIGINT,
  success_rate NUMERIC,
  avg_response_time NUMERIC,
  recent_errors BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rl.integration_point,
    COUNT(*) as total_requests,
    ROUND((COUNT(*) FILTER (WHERE rl.success_flag = true)::NUMERIC / COUNT(*)) * 100, 2) as success_rate,
    ROUND(AVG(rl.response_time_ms), 0) as avg_response_time,
    COUNT(*) FILTER (WHERE rl.success_flag = false AND rl.created_at >= NOW() - INTERVAL '1 hour') as recent_errors
  FROM request_logs rl
  WHERE rl.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY rl.integration_point
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON request_logs TO authenticated;
GRANT SELECT ON request_flow_analytics TO authenticated;
GRANT SELECT ON request_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_integration_health() TO authenticated;

-- Initialize dashboard stats
SELECT refresh_materialized_view('request_dashboard_stats');

-- Done! Your request tracking system is now ready.