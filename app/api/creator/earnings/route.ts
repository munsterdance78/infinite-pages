import { NextResponse, type NextRequest } from 'next/server'
import { requireCreatorAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
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

// DEPRECATED: This endpoint is deprecated as of [DATE].
// Please use /api/creators/earnings instead.
// This endpoint will be removed on [REMOVAL_DATE].
const DEPRECATION_DATE = '2024-01-01'
const REMOVAL_DATE = '2024-02-01'

// Helper function to safely access relation data
function getRelationData(relation: any) {
  if (Array.isArray(relation)) {
    return relation[0] || {}
  }
  return relation || {}
}

export async function GET(request: NextRequest) {
  try {
    // Add deprecation warning headers
    const response = await handleDeprecatedRequest(request)
    return response
  } catch (error) {
    console.error('Creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch creator earnings' }, { status: 500 })
  }
}

async function handleDeprecatedRequest(request: NextRequest) {
  // Log deprecation usage for monitoring
  console.warn(`DEPRECATED ENDPOINT USAGE: /api/creator/earnings accessed at ${new Date().toISOString()}`)

  // Parse original query parameters
  const { searchParams } = new URL(request.url)

  // Map legacy parameters to new unified endpoint format
  const newParams = new URLSearchParams()

  // Map legacy parameters
  if (searchParams.get('include_history') === 'true') {
    newParams.set('view', 'enhanced')
  } else {
    newParams.set('view', 'basic')
  }

  if (searchParams.get('history_limit')) {
    newParams.set('limit', searchParams.get('history_limit') || '20')
  }

  // Add format parameter to maintain response structure
  newParams.set('legacy_format', 'true')
  newParams.set('period', '30')

  // Redirect to new unified endpoint
  const newUrl = `/api/creators/earnings?${newParams.toString()}`

  try {
    // Make internal request to new endpoint
    const baseUrl = new URL(request.url).origin
    const response = await fetch(`${baseUrl}${newUrl}`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Authorization': request.headers.get('Authorization') || ''
      }
    })

    const data = await response.json()

    // Add deprecation headers to response
    const deprecationResponse = NextResponse.json(data, { status: response.status })
    deprecationResponse.headers.set('X-API-Deprecated', 'true')
    deprecationResponse.headers.set('X-API-Deprecation-Date', DEPRECATION_DATE)
    deprecationResponse.headers.set('X-API-Removal-Date', REMOVAL_DATE)
    deprecationResponse.headers.set('X-API-Migration-Guide', '/api/creators/earnings')
    deprecationResponse.headers.set('Warning', '299 - "This API endpoint is deprecated. Please migrate to /api/creators/earnings"')

    return deprecationResponse

  } catch (error) {
    console.error('Error calling new unified endpoint:', error)
    return await fallbackToOriginalLogic(request)
  }
}

async function fallbackToOriginalLogic(request: NextRequest) {
  const authResult = await requireCreatorAuth(request)
  if (!isAuthSuccess(authResult)) return authResult
  const { user, supabase } = authResult

  // Check if user is a creator
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_creator, subscription_tier')
    .eq('id', user.id)
    .single()

  // Only Premium subscribers can be creators
  if (profile && profile.subscription_tier !== 'premium') {
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
    const storyData = getRelationData(earning.stories)
    if (!storyEarningsMap.has(storyId)) {
      storyEarningsMap.set(storyId, {
        story_id: storyId,
        story_title: storyData.title || 'Unknown',
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

  // Add deprecation headers to fallback response
  const fallbackResponse = NextResponse.json({
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

  // Add deprecation headers
  fallbackResponse.headers.set('X-API-Deprecated', 'true')
  fallbackResponse.headers.set('X-API-Deprecation-Date', DEPRECATION_DATE)
  fallbackResponse.headers.set('X-API-Removal-Date', REMOVAL_DATE)
  fallbackResponse.headers.set('X-API-Migration-Guide', '/api/creators/earnings')
  fallbackResponse.headers.set('Warning', '299 - "This API endpoint is deprecated. Please migrate to /api/creators/earnings"')

  return fallbackResponse
}