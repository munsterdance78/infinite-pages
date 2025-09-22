import { NextResponse, type NextRequest } from 'next/server'
import { requireCreatorAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { CREATOR_REVENUE_SHARE } from '@/lib/subscription-config'
import type { Database } from '@/lib/supabase/types'

// DEPRECATED: This endpoint is deprecated as of [DATE].
// Please use /api/creators/earnings?view=enhanced instead.
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
    // Add deprecation warning headers and redirect to new endpoint
    const response = await handleDeprecatedEnhancedRequest(request)
    return response
  } catch (error) {
    console.error('Enhanced creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch enhanced earnings data' }, { status: 500 })
  }
}

async function handleDeprecatedEnhancedRequest(request: NextRequest) {
  // Log deprecation usage for monitoring
  console.warn(`DEPRECATED ENDPOINT USAGE: /api/creators/earnings/enhanced accessed at ${new Date().toISOString()}`)

  // Parse original query parameters
  const { searchParams } = new URL(request.url)

  // Map legacy parameters to new unified endpoint format
  const newParams = new URLSearchParams()
  newParams.set('view', 'enhanced')

  // Map period parameter
  const period = searchParams.get('period') || 'current_month'
  newParams.set('period', period)

  // Add format parameter to maintain response structure
  newParams.set('legacy_format', 'enhanced')

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
    deprecationResponse.headers.set('X-API-Migration-Guide', '/api/creators/earnings?view=enhanced')
    deprecationResponse.headers.set('Warning', '299 - "This API endpoint is deprecated. Please migrate to /api/creators/earnings?view=enhanced"')

    return deprecationResponse

  } catch (error) {
    console.error('Error calling new unified endpoint:', error)
    return await fallbackToOriginalEnhancedLogic(request)
  }
}

async function fallbackToOriginalEnhancedLogic(request: NextRequest) {
  const authResult = await requireCreatorAuth(request)
  if (!isAuthSuccess(authResult)) return authResult
  const { user, supabase } = authResult

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

  // Add deprecation headers to fallback response
  const fallbackResponse = NextResponse.json({
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

  // Add deprecation headers
  fallbackResponse.headers.set('X-API-Deprecated', 'true')
  fallbackResponse.headers.set('X-API-Deprecation-Date', DEPRECATION_DATE)
  fallbackResponse.headers.set('X-API-Removal-Date', REMOVAL_DATE)
  fallbackResponse.headers.set('X-API-Migration-Guide', '/api/creators/earnings?view=enhanced')
  fallbackResponse.headers.set('Warning', '299 - "This API endpoint is deprecated. Please migrate to /api/creators/earnings?view=enhanced"')

  return fallbackResponse
}