import { NextResponse, type NextRequest } from 'next/server'
// import { claudeService } from '@/lib/claude'
import { ERROR_MESSAGES } from '@/lib/constants'
import { requireAdminAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request)
  if (!isAuthSuccess(authResult)) return authResult

  const { user, supabase } = authResult

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
  const authResult = await requireAdminAuth(request)
  if (!isAuthSuccess(authResult)) return authResult

  const { user, supabase } = authResult

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