import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { claudeService } from '@/lib/claude'
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
    // Return Claude service health status and analytics
    const healthStatus = await claudeService.getHealthStatus()
    const cacheStats = claudeService.getCacheStats()

    return NextResponse.json({
      health: healthStatus,
      cache: cacheStats,
      models: claudeService.getAvailableModels(),
      templates: claudeService.getPromptTemplates()
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
        claudeService.clearCache()
        return NextResponse.json({ message: 'Cache cleared successfully' })

      case 'get_analytics':
        const { timeRange } = body
        const analytics = await claudeService.getAnalytics(timeRange)
        return NextResponse.json({ analytics })

      case 'test_connection':
        // Test Claude API connection
        const testResult = await claudeService.generateContent({
          prompt: 'Test connection',
          maxTokens: 10,
          userId: user.id,
          operation: 'admin_test'
        })
        return NextResponse.json({
          message: 'Connection test successful',
          test: testResult
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin Claude POST error:', error)
    return NextResponse.json({ error: 'Admin operation failed' }, { status: 500 })
  }
}