import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { infinitePagesCache } from '@/lib/claude/infinitePagesCache'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    // Get cache analytics from server-side cache system
    const analytics = await infinitePagesCache.getInfinitePagesAnalytics(user.id)

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Cache analytics error:', error)
    // Return default analytics if error
    return NextResponse.json({
      totalTokensSaved: 0,
      cacheHitRateByType: {},
      topGenres: [],
      foundationReuseRate: 0,
      costSavingsThisMonth: 0
    })
  }
}