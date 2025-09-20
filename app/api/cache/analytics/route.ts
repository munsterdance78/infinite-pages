import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { infinitePagesCache } from '@/lib/claude/infinitePagesCache'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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