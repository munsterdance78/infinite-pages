import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
// import { claudeService } from '@/lib/claude'
import { ERROR_MESSAGES } from '@/lib/constants'

export async function GET(_request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
  }

  // Check if user is admin (you may want to add an admin role check)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  // Basic admin check - you should implement proper role-based access
  const isAdmin = profile?.email?.includes('admin') || false
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Temporarily disabled - Claude service import causing build issues
    return NextResponse.json({
      health: { status: 'disabled', message: 'Admin endpoint temporarily disabled' },
      cache: {},
      models: [],
      templates: []
    })
  } catch (error) {
    console.error('Admin Claude endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch Claude service status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.email?.includes('admin') || false
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'clear_cache':
        // claudeService.clearCache()
        return NextResponse.json({ message: 'Cache cleared successfully (disabled)' })

      case 'get_analytics':
        const { timeRange } = body
        // const analytics = await claudeService.getAnalytics(timeRange)
        return NextResponse.json({ analytics: { disabled: true } })

      case 'test_connection':
        // Test Claude API connection
        return NextResponse.json({
          message: 'Connection test disabled',
          test: { disabled: true }
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin Claude POST error:', error)
    return NextResponse.json({ error: 'Admin operation failed' }, { status: 500 })
  }
}