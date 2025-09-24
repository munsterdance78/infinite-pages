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

    // Get recent requests with pagination
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const { data: requests, error } = await supabase
      .from('request_logs')
      .select(`
        id,
        request_id,
        session_id,
        user_id,
        frontend_action,
        frontend_component,
        frontend_page,
        api_endpoint,
        expected_endpoint,
        http_method,
        response_status,
        response_time_ms,
        success_flag,
        error_message,
        error_category,
        integration_point,
        expected_integration,
        integration_success,
        user_tier,
        device_info,
        total_time_ms,
        custom_data,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching recent requests:', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Recent requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}