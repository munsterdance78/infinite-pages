-- =====================================================
-- MINIMAL REQUEST TRACKING SETUP
-- This avoids all existing table conflicts
-- =====================================================

-- Create request_logs table (simple version)
CREATE TABLE IF NOT EXISTS request_logs (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  session_id TEXT,
  user_id TEXT,
  frontend_action TEXT,
  frontend_component TEXT,
  frontend_page TEXT,
  api_endpoint TEXT NOT NULL,
  expected_endpoint TEXT,
  http_method TEXT NOT NULL,
  request_headers JSONB,
  request_body_size INTEGER,
  response_status INTEGER,
  response_headers JSONB,
  response_body_size INTEGER,
  response_time_ms INTEGER,
  success_flag BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  error_category TEXT,
  integration_point TEXT,
  expected_integration TEXT,
  integration_success BOOLEAN,
  user_tier TEXT,
  device_info JSONB,
  queue_time_ms INTEGER,
  processing_time_ms INTEGER,
  total_time_ms INTEGER,
  custom_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_success ON request_logs(success_flag);

-- Simple analytics table
CREATE TABLE IF NOT EXISTS request_flow_analytics (
  id SERIAL PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL,
  api_endpoint TEXT,
  frontend_action TEXT,
  integration_point TEXT,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  avg_response_time_ms INTEGER,
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  unique_users INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  integration_success_rate DECIMAL(5,2),
  endpoint_mismatch_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simple view for dashboard stats
CREATE OR REPLACE VIEW request_dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER as requests_last_hour,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour' AND success_flag = false)::INTEGER as errors_last_hour,
  COALESCE(ROUND((COUNT(*) FILTER (WHERE success_flag = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2), 0) as overall_success_rate,
  COALESCE(ROUND((COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour' AND success_flag = true)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0)) * 100, 2), 0) as hourly_success_rate,
  COALESCE(ROUND(AVG(response_time_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')), 0)::INTEGER as avg_response_time_hour,
  COALESCE(MAX(response_time_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0)::INTEGER as max_response_time_hour,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER as active_users_hour,
  COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::INTEGER as active_sessions_hour,
  COUNT(*) FILTER (WHERE api_endpoint != expected_endpoint AND created_at >= NOW() - INTERVAL '1 hour')::INTEGER as endpoint_mismatches_hour
FROM request_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Simple function for integration health
CREATE OR REPLACE FUNCTION get_integration_health()
RETURNS TABLE(
  integration_point TEXT,
  total_requests BIGINT,
  success_rate NUMERIC,
  avg_response_time NUMERIC,
  recent_errors BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(rl.integration_point, 'unknown')::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE rl.success_flag = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2), 0),
    COALESCE(ROUND(AVG(rl.response_time_ms), 0), 0),
    COUNT(*) FILTER (WHERE rl.success_flag = false AND rl.created_at >= NOW() - INTERVAL '1 hour')::BIGINT
  FROM request_logs rl
  WHERE rl.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY rl.integration_point
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert test record
INSERT INTO request_logs (
  request_id,
  session_id,
  frontend_action,
  frontend_component,
  frontend_page,
  api_endpoint,
  http_method,
  response_status,
  success_flag,
  integration_point,
  response_time_ms,
  total_time_ms
) VALUES (
  'test-' || extract(epoch from now()),
  'test-session',
  'system_test',
  'Migration',
  '/admin',
  '/api/test',
  'GET',
  200,
  true,
  'test_api',
  100,
  150
);

SELECT 'Simple request tracking setup complete!' as result;