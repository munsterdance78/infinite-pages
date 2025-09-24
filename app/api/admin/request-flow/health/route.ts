import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get integration health data
    const { data: integrationHealth, error } = await supabase.rpc('get_integration_health')

    if (error) {
      console.error('Error fetching integration health:', error)

      // Fallback query if the RPC doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('request_logs')
        .select(`
          integration_point,
          success_flag,
          response_time_ms,
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (fallbackError) {
        return NextResponse.json({ error: 'Failed to fetch integration health' }, { status: 500 })
      }

      // Process the data manually
      const healthMap = new Map()

      fallbackData?.forEach(request => {
        const integration = request.integration_point
        if (!healthMap.has(integration)) {
          healthMap.set(integration, {
            integration_point: integration,
            total_requests: 0,
            successful_requests: 0,
            response_times: [],
            recent_errors: 0
          })
        }

        const health = healthMap.get(integration)
        health.total_requests++
        if (request.success_flag) {
          health.successful_requests++
        } else {
          health.recent_errors++
        }
        health.response_times.push(request.response_time_ms)
      })

      const processedHealth = Array.from(healthMap.values()).map(health => ({
        integration_point: health.integration_point,
        total_requests: health.total_requests,
        success_rate: Math.round((health.successful_requests / health.total_requests) * 100),
        avg_response_time: Math.round(health.response_times.reduce((a, b) => a + b, 0) / health.response_times.length),
        recent_errors: health.recent_errors
      }))

      return NextResponse.json(processedHealth)
    }

    return NextResponse.json(integrationHealth)
  } catch (error) {
    console.error('Integration health error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}