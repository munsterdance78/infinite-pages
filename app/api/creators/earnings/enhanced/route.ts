import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { CREATOR_REVENUE_SHARE } from '@/lib/subscription-config'
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
    const period = searchParams.get('period') || 'current_month'

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate = lastMonth
        endDate = new Date(now.getFullYear(), now.getMonth(), 0) // Last day of previous month
        break
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'all_time':
        startDate = new Date(2020, 0, 1) // Platform start date
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get creator profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, creator_tier, total_earnings_usd, pending_payout_usd')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
    }

    // Get detailed earnings with story and reader information
    const { data: earnings } = await supabase
      .from('creator_earnings')
      .select(`
        *,
        stories (id, title),
        profiles!creator_earnings_reader_id_fkey (email)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    // Get story purchase data for aggregations
    const { data: storyPurchases } = await supabase
      .from('story_purchases')
      .select(`
        story_id,
        credits_spent,
        created_at,
        purchase_type,
        stories (id, title)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Calculate summary statistics
    const totalCreditsEarned = earnings?.reduce((sum, e) => sum + e.credits_earned, 0) || 0
    const totalUsdEarnings = earnings?.reduce((sum, e) => sum + e.usd_equivalent, 0) || 0
    const uniqueReaders = new Set(earnings?.map(e => e.reader_id)).size

    // Calculate earnings by story
    const storyEarningsMap = new Map()
    earnings?.forEach(earning => {
      const storyId = earning.story_id
      const story = getRelationData(earning.stories)
      if (!storyEarningsMap.has(storyId)) {
        storyEarningsMap.set(storyId, {
          story_id: storyId,
          story_title: story.title || 'Unknown',
          total_credits_earned: 0,
          total_usd_earned: 0,
          unique_readers: new Set(),
          total_purchases: 0,
          last_purchase: null
        })
      }

      const storyData = storyEarningsMap.get(storyId)
      storyData.total_credits_earned += earning.credits_earned
      storyData.total_usd_earned += earning.usd_equivalent
      storyData.unique_readers.add(earning.reader_id)
      storyData.total_purchases += 1

      if (!storyData.last_purchase || new Date(earning.created_at) > new Date(storyData.last_purchase)) {
        storyData.last_purchase = earning.created_at
      }
    })

    // Convert unique readers sets to counts
    const earningsByStory = Array.from(storyEarningsMap.values()).map(story => ({
      ...story,
      unique_readers: story.unique_readers.size
    })).sort((a, b) => b.total_usd_earned - a.total_usd_earned)

    // Format recent transactions
    const recentTransactions = earnings?.slice(0, 20).map(earning => {
      const story = getRelationData(earning.stories)
      const profile = getRelationData(earning.profiles)
      return {
        id: earning.id,
        story_title: story.title || 'Unknown',
        reader_email: profile.email || 'Unknown',
        credits_earned: earning.credits_earned,
        usd_equivalent: earning.usd_equivalent,
        purchase_type: 'story_access', // This could be expanded based on your business model
        created_at: earning.created_at
      }
    }) || []

    // Calculate monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

      const monthEarnings = earnings?.filter(e => {
        const earningDate = new Date(e.created_at)
        return earningDate >= monthDate && earningDate < nextMonthDate
      }) || []

      const monthPurchases = storyPurchases?.filter(p => {
        const purchaseDate = new Date(p.created_at)
        return purchaseDate >= monthDate && purchaseDate < nextMonthDate
      }) || []

      monthlyTrend.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        credits_earned: monthEarnings.reduce((sum, e) => sum + e.credits_earned, 0),
        usd_earned: monthEarnings.reduce((sum, e) => sum + e.usd_equivalent, 0),
        stories_sold: monthPurchases.length
      })
    }

    // Calculate stories with earnings
    const storiesWithEarnings = earningsByStory.length
    const averageEarningsPerStory = storiesWithEarnings > 0 ? totalUsdEarnings / storiesWithEarnings : 0

    return NextResponse.json({
      summary: {
        totalCreditsEarned,
        totalUsdEarnings,
        uniqueReaders,
        storiesWithEarnings,
        averageEarningsPerStory,
        pendingPayout: profile.pending_payout_usd || 0,
        lifetimeEarnings: profile.total_earnings_usd || 0,
        creatorSharePercentage: CREATOR_REVENUE_SHARE * 100 // 70%
      },
      earningsByStory,
      recentTransactions,
      monthlyTrend
    })

  } catch (error) {
    console.error('Enhanced creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch enhanced earnings data' }, { status: 500 })
  }
}