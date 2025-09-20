import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import {
  getCreatorAccumulatedEarnings,
  getCreatorEarningsHistory,
  calculateNextPayoutDate,
  canRequestPayout,
  getPayoutEligibilityMessage,
  CREDITS_TO_USD_RATE
} from '@/lib/creator-earnings'
import { MINIMUM_PAYOUT_USD } from '@/lib/subscription-config'
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

    // Check if user is a creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
    }

    // Only Premium subscribers can be creators
    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required for creator features',
        upgrade_required: true,
        current_tier: profile.subscription_tier
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('include_history') === 'true'
    const historyLimit = parseInt(searchParams.get('history_limit') || '20')

    // Get accumulated earnings
    const { earnings: accumulation, error: accError } = await getCreatorAccumulatedEarnings(user.id, supabase)

    if (accError) {
      return NextResponse.json({ error: accError }, { status: 500 })
    }

    // Get earnings summary for current period (last 30 days)
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_creator_earnings_summary', {
        p_creator_id: user.id,
        p_days_back: 30
      })

    if (summaryError) {
      console.error('Summary error:', summaryError)
    }

    const summary = summaryData?.[0] || {
      total_earnings_period: 0,
      total_credits_earned: 0,
      unique_readers: 0,
      stories_with_earnings: 0,
      average_per_story: 0,
      current_accumulated: accumulation?.total_accumulated_usd || 0
    }

    // Calculate payout eligibility
    const accumulatedAmount = accumulation?.total_accumulated_usd || 0
    const canPayout = canRequestPayout(accumulatedAmount, MINIMUM_PAYOUT_USD)
    const nextPayoutDate = calculateNextPayoutDate()
    const eligibilityMessage = getPayoutEligibilityMessage(accumulatedAmount, MINIMUM_PAYOUT_USD)

    let earningsHistory = []
    if (includeHistory) {
      const { earnings, error: historyError } = await getCreatorEarningsHistory(user.id, historyLimit, supabase)
      if (!historyError) {
        earningsHistory = earnings
      }
    }

    // Get recent story performance (last 30 days)
    const { data: storyPerformance } = await supabase
      .from('creator_earnings')
      .select(`
        story_id,
        stories (id, title),
        credits_earned,
        usd_equivalent,
        created_at
      `)
      .eq('creator_id', user.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    // Aggregate by story
    const storyEarningsMap = new Map()
    storyPerformance?.forEach(earning => {
      const storyId = earning.story_id
      const story = getRelationData(earning.stories)
      if (!storyEarningsMap.has(storyId)) {
        storyEarningsMap.set(storyId, {
          story_id: storyId,
          story_title: story.title || 'Unknown',
          total_credits: 0,
          total_usd: 0,
          purchase_count: 0,
          latest_purchase: earning.created_at
        })
      }

      const story = storyEarningsMap.get(storyId)
      story.total_credits += earning.credits_earned
      story.total_usd += earning.usd_equivalent
      story.purchase_count += 1

      if (new Date(earning.created_at) > new Date(story.latest_purchase)) {
        story.latest_purchase = earning.created_at
      }
    })

    const recentStoryPerformance = Array.from(storyEarningsMap.values())
      .sort((a, b) => b.total_usd - a.total_usd)
      .slice(0, 10)

    return NextResponse.json({
      accumulated_earnings: {
        current_amount_usd: accumulatedAmount,
        can_request_payout: canPayout,
        minimum_payout_usd: MINIMUM_PAYOUT_USD,
        next_payout_date: nextPayoutDate.toISOString().split('T')[0],
        eligibility_message: eligibilityMessage,
        last_payout_date: accumulation?.last_payout_date,
        last_payout_amount: accumulation?.last_payout_amount
      },
      period_summary: {
        period_days: 30,
        total_earnings_usd: summary.total_earnings_period,
        total_credits_earned: summary.total_credits_earned,
        unique_readers: summary.unique_readers,
        stories_with_earnings: summary.stories_with_earnings,
        average_per_story_usd: summary.average_per_story
      },
      recent_story_performance: recentStoryPerformance,
      earnings_history: earningsHistory,
      meta: {
        credits_to_usd_rate: CREDITS_TO_USD_RATE,
        creator_share_percentage: 70,
        payout_schedule: 'Monthly on 1st',
        minimum_payout: MINIMUM_PAYOUT_USD
      }
    })

  } catch (error) {
    console.error('Creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch creator earnings' }, { status: 500 })
  }
}