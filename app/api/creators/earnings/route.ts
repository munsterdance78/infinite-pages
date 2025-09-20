import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

// Helper function to safely access relation data
function getRelationData(relation: any) {
  if (Array.isArray(relation)) {
    return relation[0] || {}
  }
  return relation || {}
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)

    // Get creator profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, creator_tier, total_earnings_usd, pending_payout_usd')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
    }

    // Get earnings breakdown
    const { data: earnings } = await supabase
      .from('creator_earnings')
      .select(`
        *,
        stories (title),
        profiles!creator_earnings_reader_id_fkey (email)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    // Get story performance stats
    const { data: storyStats } = await supabase
      .from('story_purchases')
      .select(`
        story_id,
        credits_spent,
        stories (title)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())

    // Aggregate stats
    const totalEarnings = earnings?.reduce((sum, e) => sum + e.credits_earned, 0) || 0
    const totalUsdEarnings = earnings?.reduce((sum, e) => sum + e.usd_equivalent, 0) || 0
    const uniqueReaders = new Set(earnings?.map(e => e.reader_id)).size

    const storyPerformance = storyStats?.reduce((acc, purchase) => {
      const storyId = purchase.story_id
      const story = getRelationData(purchase.stories)
      if (!acc[storyId]) {
        acc[storyId] = {
          title: story.title || 'Unknown',
          totalRevenue: 0,
          purchaseCount: 0
        }
      }
      acc[storyId].totalRevenue += purchase.credits_spent
      acc[storyId].purchaseCount += 1
      return acc
    }, {} as Record<string, any>) || {}

    return NextResponse.json({
      summary: {
        totalEarnings,
        totalUsdEarnings,
        uniqueReaders,
        creatorTier: profile.creator_tier,
        totalEarningsAllTime: profile.total_earnings_usd,
        pendingPayout: profile.pending_payout_usd
      },
      recentEarnings: earnings,
      storyPerformance: Object.values(storyPerformance),
      period: `${period} days`
    })

  } catch (error) {
    console.error('Creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch earnings data' }, { status: 500 })
  }
}