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

-- Grant execute permission to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION get_integration_health() TO authenticated;