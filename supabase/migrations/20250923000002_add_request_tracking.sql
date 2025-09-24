-- =====================================================
-- REQUEST TRACKING SYSTEM FOR INFINITE PAGES
-- Complete request flow monitoring and analytics
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

-- Create function to generate analytics
CREATE OR REPLACE FUNCTION generate_request_analytics(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  period_type_param VARCHAR(20)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO request_flow_analytics (
    period_start,
    period_end,
    period_type,
    api_endpoint,
    frontend_action,
    integration_point,
    total_requests,
    successful_requests,
    failed_requests,
    success_rate,
    avg_response_time_ms,
    min_response_time_ms,
    max_response_time_ms,
    unique_users,
    unique_sessions,
    integration_success_rate,
    endpoint_mismatch_count
  )
  SELECT
    start_time,
    end_time,
    period_type_param,
    api_endpoint,
    frontend_action,
    integration_point,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success_flag = true) as successful_requests,
    COUNT(*) FILTER (WHERE success_flag = false) as failed_requests,
    ROUND((COUNT(*) FILTER (WHERE success_flag = true)::DECIMAL / COUNT(*)) * 100, 2) as success_rate,
    ROUND(AVG(response_time_ms)) as avg_response_time_ms,
    MIN(response_time_ms) as min_response_time_ms,
    MAX(response_time_ms) as max_response_time_ms,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    ROUND((COUNT(*) FILTER (WHERE integration_success = true)::DECIMAL / COUNT(*)) * 100, 2) as integration_success_rate,
    COUNT(*) FILTER (WHERE api_endpoint != expected_endpoint) as endpoint_mismatch_count
  FROM request_logs
  WHERE created_at >= start_time AND created_at < end_time
  GROUP BY api_endpoint, frontend_action, integration_point
  ON CONFLICT (period_start, period_end, period_type, api_endpoint, frontend_action, integration_point)
  DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_requests = EXCLUDED.successful_requests,
    failed_requests = EXCLUDED.failed_requests,
    success_rate = EXCLUDED.success_rate,
    avg_response_time_ms = EXCLUDED.avg_response_time_ms,
    min_response_time_ms = EXCLUDED.min_response_time_ms,
    max_response_time_ms = EXCLUDED.max_response_time_ms,
    unique_users = EXCLUDED.unique_users,
    unique_sessions = EXCLUDED.unique_sessions,
    integration_success_rate = EXCLUDED.integration_success_rate,
    endpoint_mismatch_count = EXCLUDED.endpoint_mismatch_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean old request logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_request_logs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM request_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  DELETE FROM request_flow_analytics
  WHERE period_end < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

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

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_request_dashboard_stats ON request_dashboard_stats (requests_last_hour);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_request_dashboard_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW request_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON request_logs TO authenticated;
GRANT SELECT ON request_flow_analytics TO authenticated;
GRANT SELECT ON request_dashboard_stats TO authenticated;

-- Comments for documentation
COMMENT ON TABLE request_logs IS 'Comprehensive request tracking for API calls and frontend actions';
COMMENT ON TABLE request_flow_analytics IS 'Aggregated analytics for request flow monitoring';
COMMENT ON MATERIALIZED VIEW request_dashboard_stats IS 'Real-time dashboard statistics for request monitoring';

COMMENT ON COLUMN request_logs.frontend_action IS 'The user action that triggered this request (e.g., story_create_button)';
COMMENT ON COLUMN request_logs.integration_point IS 'The backend service/API this request integrates with (e.g., claude_api)';
COMMENT ON COLUMN request_logs.expected_endpoint IS 'The endpoint the frontend expected to call vs actual endpoint';
COMMENT ON COLUMN request_logs.success_flag IS 'Whether the request was successful from the user perspective';
COMMENT ON COLUMN request_logs.total_time_ms IS 'End-to-end time from frontend click to UI update';

-- Create notification function for critical issues
CREATE OR REPLACE FUNCTION notify_critical_request_issues()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify on high error rates
  IF (
    SELECT COUNT(*)
    FROM request_logs
    WHERE created_at >= NOW() - INTERVAL '5 minutes'
    AND success_flag = false
  ) > 10 THEN
    PERFORM pg_notify('critical_request_errors',
      json_build_object(
        'type', 'high_error_rate',
        'count', (SELECT COUNT(*) FROM request_logs WHERE created_at >= NOW() - INTERVAL '5 minutes' AND success_flag = false),
        'timestamp', NOW()
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for critical issue notifications
CREATE TRIGGER request_logs_critical_issues_trigger
  AFTER INSERT ON request_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_critical_request_issues();

-- Initialize dashboard stats
SELECT refresh_request_dashboard_stats();