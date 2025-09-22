import { NextResponse, type NextRequest } from 'next/server'
import { requireCreatorAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { CREATOR_REVENUE_SHARE } from '@/lib/subscription-config'
import type { Database } from '@/lib/supabase/types'

// Helper function to safely access relation data
function getRelationData(relation: any) {
  if (Array.isArray(relation)) {
    return relation[0] || {}
  }
  return relation || {}
}

/**
 * Unified Creator Earnings API Endpoint
 * Combines all functionality from the 3 original endpoints
 * Supports configurable data inclusion based on display mode
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCreatorAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'current_month'
    const includeHistory = searchParams.get('include_history') === 'true'
    const includeTransactions = searchParams.get('include_transactions') === 'true'
    const includeTrends = searchParams.get('include_trends') === 'true'
    const includeTier = searchParams.get('include_tier') === 'true'
    const premiumValidation = searchParams.get('premium_validation') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get creator profile with comprehensive data
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id,
        is_creator,
        creator_tier,
        subscription_tier,
        total_earnings_usd,
        pending_payout_usd,
        created_at
      `)
      .eq('id', user.id)
      .single()

    // Premium validation if requested
    if (premiumValidation && profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required for creator features',
        upgrade_required: true,
        current_tier: profile.subscription_tier
      }, { status: 403 })
    }

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    // Support both day-based and month-based periods
    if (['7', '30', '90', '365'].includes(period)) {
      // Day-based periods (legacy support)
      startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000)
    } else {
      // Month-based periods
      switch (period) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          startDate = lastMonth
          endDate = new Date(now.getFullYear(), now.getMonth(), 0)
          break
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
          break
        case 'all_time':
          startDate = new Date(2020, 0, 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }

    // Get detailed earnings with comprehensive joins
    const { data: earnings } = await supabase
      .from('creator_earnings')
      .select(`
        *,
        stories (id, title, cover_image_url),
        profiles!creator_earnings_reader_id_fkey (email)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    // Get story purchase data for enhanced analytics
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

    // Calculate comprehensive summary statistics
    const totalCreditsEarned = earnings?.reduce((sum, e) => sum + e.credits_earned, 0) || 0
    const totalUsdEarnings = earnings?.reduce((sum, e) => sum + e.usd_equivalent, 0) || 0
    const uniqueReaders = new Set(earnings?.map(e => e.reader_id)).size

    // Calculate earnings by story with enhanced metrics
    const storyEarningsMap = new Map()
    earnings?.forEach(earning => {
      const storyId = earning.story_id
      const story = getRelationData(earning.stories)
      if (!storyEarningsMap.has(storyId)) {
        storyEarningsMap.set(storyId, {
          storyId,
          storyTitle: story.title || 'Unknown',
          coverImageUrl: story.cover_image_url,
          totalCreditsEarned: 0,
          totalUsdEarned: 0,
          uniqueReaders: new Set(),
          totalPurchases: 0,
          lastPurchase: null
        })
      }

      const storyData = storyEarningsMap.get(storyId)
      storyData.totalCreditsEarned += earning.credits_earned
      storyData.totalUsdEarned += earning.usd_equivalent
      storyData.uniqueReaders.add(earning.reader_id)
      storyData.totalPurchases += 1

      if (!storyData.lastPurchase || new Date(earning.created_at) > new Date(storyData.lastPurchase)) {
        storyData.lastPurchase = earning.created_at
      }
    })

    // Convert unique readers sets to counts and sort by earnings
    const storyPerformance = Array.from(storyEarningsMap.values()).map(story => ({
      ...story,
      uniqueReaders: story.uniqueReaders.size
    })).sort((a, b) => b.totalUsdEarned - a.totalUsdEarned)

    // Format recent transactions
    const recentTransactions = includeTransactions ? earnings?.slice(0, limit).map(earning => {
      const story = getRelationData(earning.stories)
      const readerProfile = getRelationData(earning.profiles)
      return {
        id: earning.id,
        storyTitle: story.title || 'Unknown',
        readerEmail: readerProfile.email || 'Unknown',
        creditsEarned: earning.credits_earned,
        usdEquivalent: earning.usd_equivalent,
        purchaseType: 'story_access', // Could be enhanced based on business model
        createdAt: earning.created_at,
        storyId: earning.story_id
      }
    }) || [] : []

    // Calculate monthly trend (last 6 months)
    const monthlyTrend = includeTrends ? (() => {
      const trends = []
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

        const monthlyUniqueReaders = new Set(monthEarnings.map(e => e.reader_id)).size

        trends.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          creditsEarned: monthEarnings.reduce((sum, e) => sum + e.credits_earned, 0),
          usdEarned: monthEarnings.reduce((sum, e) => sum + e.usd_equivalent, 0),
          storiesSold: monthPurchases.length,
          uniqueReaders: monthlyUniqueReaders
        })
      }
      return trends
    })() : []

    // Calculate additional metrics
    const storiesWithEarnings = storyPerformance.length
    const averageEarningsPerStory = storiesWithEarnings > 0 ? totalUsdEarnings / storiesWithEarnings : 0

    // Payout information
    const pendingPayout = profile.pending_payout_usd || 0
    const canRequestPayout = pendingPayout >= 25
    const minimumPayout = 25
    const nextPayoutDate = new Date()
    nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1, 1)

    // Period description
    const periodDescription = (() => {
      if (['7', '30', '90', '365'].includes(period)) {
        return `${period} days`
      }
      switch (period) {
        case 'current_month': return 'this month'
        case 'last_month': return 'last month'
        case 'last_3_months': return 'last 3 months'
        case 'all_time': return 'all time'
        default: return 'selected period'
      }
    })()

    // Build comprehensive response
    const response = {
      profile: {
        id: profile.id,
        isCreator: profile.is_creator,
        creatorTier: includeTier ? profile.creator_tier : null,
        subscriptionTier: profile.subscription_tier,
        totalEarningsAllTime: profile.total_earnings_usd || 0,
        pendingPayoutUsd: pendingPayout,
        joinedDate: profile.created_at
      },
      summary: {
        totalCreditsEarned,
        totalUsdEarnings,
        uniqueReaders,
        storiesWithEarnings,
        averageEarningsPerStory,
        pendingPayout,
        lifetimeEarnings: profile.total_earnings_usd || 0,
        creatorSharePercentage: CREATOR_REVENUE_SHARE * 100,
        periodDescription
      },
      storyPerformance: storyPerformance.slice(0, 20), // Limit to top 20 stories
      recentTransactions,
      monthlyTrend,
      payoutInfo: {
        canRequestPayout,
        minimumPayout,
        nextPayoutDate: nextPayoutDate.toISOString(),
        eligibilityMessage: canRequestPayout
          ? 'Ready for payout!'
          : `$${(minimumPayout - pendingPayout).toFixed(2)} more needed`,
        lastPayoutDate: null, // Would come from payout history
        lastPayoutAmount: null,
        processingFee: 2.5
      },
      meta: {
        creditsToUsdRate: 0.035,
        lastUpdated: new Date().toISOString(),
        nextRefresh: new Date(Date.now() + 30000).toISOString(),
        cacheStatus: 'fresh',
        period,
        includeHistory,
        includeTransactions,
        includeTrends
      }
    }

    // Add payout history if requested
    if (includeHistory) {
      try {
        const { data: payoutHistoryData } = await supabase
          .from('creator_payouts')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (payoutHistoryData?.length) {
          const payoutHistory = {
            items: payoutHistoryData.map(payout => ({
              id: payout.id,
              amountUsd: payout.amount_usd,
              status: payout.status,
              batchDate: payout.batch_date,
              createdAt: payout.created_at,
              processingFee: payout.processing_fee || 2.5,
              netAmount: payout.amount_usd - (payout.processing_fee || 2.5)
            })),
            summary: {
              totalPayouts: payoutHistoryData.length,
              totalAmountPaidUsd: payoutHistoryData.reduce((sum, p) => sum + p.amount_usd, 0),
              totalFeesPaid: payoutHistoryData.reduce((sum, p) => sum + (p.processing_fee || 2.5), 0),
              netAmountReceived: payoutHistoryData.reduce((sum, p) => sum + p.amount_usd - (p.processing_fee || 2.5), 0),
              lastSuccessfulPayout: payoutHistoryData.find(p => p.status === 'completed') ? {
                amount: payoutHistoryData.find(p => p.status === 'completed')?.amount_usd || 0,
                date: payoutHistoryData.find(p => p.status === 'completed')?.created_at || ''
              } : null
            }
          }
          response.payoutHistory = payoutHistory
        }
      } catch (error) {
        console.error('Failed to fetch payout history:', error)
        // Continue without payout history rather than failing
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unified creator earnings endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch creator earnings' }, { status: 500 })
  }
}