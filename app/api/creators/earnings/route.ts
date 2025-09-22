import { NextResponse, type NextRequest } from 'next/server'
import { requireCreatorAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { ERROR_MESSAGES } from '@/lib/constants'
import { CREATOR_REVENUE_SHARE } from '@/lib/subscription-config'
import type { Database } from '@/lib/supabase/types'
import type { CreatorEarningsResponse, ApiResponse } from '@/lib/types/api'

// Enhanced cache for earnings data with different TTLs for different data types
interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  expiry: number
  accessCount: number
  lastAccessed: number
}

const earningsCache = new Map<string, CacheEntry<CreatorEarningsResponse>>()
const CACHE_DURATIONS = {
  basic: 120000,     // 2 minutes for basic data
  enhanced: 90000,   // 1.5 minutes for enhanced data
  dashboard: 60000,  // 1 minute for dashboard data (most detailed)
  aggregates: 300000, // 5 minutes for aggregated data
  tier_info: 600000, // 10 minutes for tier information
  user_profile: 180000 // 3 minutes for user profile data
}

// Cache cleanup interval
const CACHE_CLEANUP_INTERVAL = 300000 // 5 minutes
let lastCacheCleanup = Date.now()

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now()
  if (now - lastCacheCleanup < CACHE_CLEANUP_INTERVAL) return

  for (const [key, entry] of Array.from(earningsCache.entries())) {
    if (now > entry.expiry) {
      earningsCache.delete(key)
    }
  }
  lastCacheCleanup = now
}

// Get cache key with user-specific and parameter-specific elements
function getCacheKey(userId: string, view: string, period: string, additionalParams: string = '') {
  return `earnings:${userId}:${view}:${period}:${additionalParams}`
}

// Get from cache with access tracking
function getFromCache(key: string): CreatorEarningsResponse | null {
  cleanupCache()
  const entry = earningsCache.get(key)
  if (entry && Date.now() < entry.expiry) {
    entry.accessCount++
    entry.lastAccessed = Date.now()
    return entry.data
  }
  if (entry) {
    earningsCache.delete(key) // Remove expired entry
  }
  return null
}

// Set cache with appropriate TTL based on data type
function setCache(key: string, data: CreatorEarningsResponse, dataType: keyof typeof CACHE_DURATIONS = 'enhanced') {
  const now = Date.now()
  const duration = CACHE_DURATIONS[dataType]
  earningsCache.set(key, {
    data,
    timestamp: now,
    expiry: now + duration,
    accessCount: 1,
    lastAccessed: now
  })
}

// Helper function to safely access relation data
function getRelationData(relation: Database['public']['Tables']['creator_earnings']['Row']) {
  if (Array.isArray(relation)) {
    return relation[0] || {}
  }
  return relation || {}
}

// Validate and parse query parameters
function parseQueryParams(searchParams: URLSearchParams): Record<string, any> {
  const view = searchParams.get('view') || 'enhanced' // basic, enhanced, dashboard
  const period = searchParams.get('period') || 'current_month'
  const includeHistory = searchParams.get('include_history') === 'true'
  const includeTransactions = searchParams.get('include_transactions') === 'true'
  const includeTrends = searchParams.get('include_trends') === 'true'
  const includeTier = searchParams.get('include_tier') === 'true'
  const includeStoryDetails = searchParams.get('include_story_details') === 'true'
  const includeExportData = searchParams.get('include_export_data') === 'true'
  const premiumValidation = searchParams.get('premium_validation') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
  const format = searchParams.get('format') || 'json' // json, csv, xlsx

  // Track deprecation warnings for legacy parameters
  const deprecationWarnings: string[] = []

  // Backward compatibility: map old parameter names
  const legacyPeriod = searchParams.get('period_days')
  if (legacyPeriod) {
    deprecationWarnings.push('Parameter \'period_days\' is deprecated. Use \'period\' instead.')
    // Convert legacy day-based period to new format
    switch (legacyPeriod) {
      case '7': return { ...parseQueryParams(searchParams), period: '7', view: 'basic', deprecationWarnings }
      case '30': return { ...parseQueryParams(searchParams), period: '30', view: 'basic', deprecationWarnings }
      case '90': return { ...parseQueryParams(searchParams), period: '90', view: 'basic', deprecationWarnings }
      case '365': return { ...parseQueryParams(searchParams), period: '365', view: 'basic', deprecationWarnings }
    }
  }

  // Check for other legacy parameters
  if (searchParams.get('include_history') !== null) {
    deprecationWarnings.push('Parameter \'include_history\' is deprecated. Use \'view=enhanced\' or \'view=dashboard\' instead.')
  }

  if (searchParams.get('history_limit') !== null) {
    deprecationWarnings.push('Parameter \'history_limit\' is deprecated. Use \'limit\' instead.')
  }

  return {
    view,
    period,
    includeHistory,
    includeTransactions,
    includeTrends,
    includeTier,
    includeStoryDetails,
    includeExportData,
    premiumValidation,
    limit,
    offset,
    format,
    deprecationWarnings
  }
}

// Calculate date range based on period
function calculateDateRange(period: string) {
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
      case 'last_6_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case 'current_year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all_time':
        startDate = new Date(2020, 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
  }

  return { startDate, endDate }
}

// Generate cache key
// Enhanced cache key generation with compression for large parameter sets
function generateCacheKey(userId: string | undefined, params: Record<string, string>): string {
  const paramString = JSON.stringify(params, Object.keys(params).sort())
  const hash = paramString.length > 100 ?
    paramString.slice(0, 50) + '_' + paramString.length : paramString
  return getCacheKey(userId || 'anonymous', params.view || 'enhanced', params.period || 'current_month', hash)
}

// Enhanced cached data retrieval with metadata
function getCachedData(cacheKey: string): CreatorEarningsResponse | null {
  const data = getFromCache(cacheKey)
  if (data) {
    return {
      ...data,
      _cached: true,
      _cacheAge: Date.now() - earningsCache.get(cacheKey)?.timestamp!
    } as CreatorEarningsResponse
  }
  return null
}

// Enhanced cached data storage with appropriate TTL
function setCachedData(cacheKey: string, data: CreatorEarningsResponse, view: string = 'enhanced'): void {
  const dataType = view as keyof typeof CACHE_DURATIONS
  setCache(cacheKey, data, dataType)
}

// Cache statistics for monitoring
function getCacheStats() {
  cleanupCache()
  const stats = {
    totalEntries: earningsCache.size,
    hitRate: 0,
    avgAccessCount: 0,
    memoryUsage: JSON.stringify(Array.from(earningsCache.values())).length
  }

  if (earningsCache.size > 0) {
    const entries = Array.from(earningsCache.values())
    stats.avgAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length
    stats.hitRate = entries.filter(entry => entry.accessCount > 1).length / entries.length
  }

  return stats
}

/**
 * UNIFIED CREATOR EARNINGS API ENDPOINT
 *
 * Replaces:
 * - /api/creator/earnings
 * - /api/creators/earnings (old)
 * - /api/creators/earnings/enhanced
 *
 * Features:
 * - Configurable data views (basic, enhanced, dashboard)
 * - Backward compatibility with legacy parameters
 * - Performance optimization with caching
 * - Export functionality (JSON, CSV, XLSX)
 * - Real-time earnings updates
 * - Comprehensive error handling
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Clean expired cache entries periodically
    if (Math.random() < 0.1) {
      cleanupCache()
    }

    const authResult = await requireCreatorAuth(request)
    if (!isAuthSuccess(authResult)) return authResult

    const { user, supabase } = authResult

    const { searchParams } = new URL(request.url)
    const params = parseQueryParams(searchParams)

    // Check cache first
    const cacheKey = generateCacheKey(user.id, params)
    const cachedData = getCachedData(cacheKey)
    if (cachedData && !params.includeExportData) {
      return NextResponse.json({
        ...cachedData,
        meta: {
          cached: true,
          cacheAge: Date.now() - (earningsCache.get(cacheKey)?.timestamp || Date.now()),
          responseTime: Date.now() - startTime
        }
      })
    }

    // Get creator profile with comprehensive data
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        is_creator,
        creator_tier,
        subscription_tier,
        total_earnings_usd,
        pending_payout_usd,
        stories_created,
        created_at,
        updated_at
      `)
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.is_creator) {
      return NextResponse.json({
        error: 'Creator access required',
        upgrade_info: {
          message: 'Upgrade to Premium to become a creator and start earning',
          action: 'upgrade_to_premium'
        }
      }, { status: 403 })
    }

    // Premium validation if requested
    if (params.premiumValidation && profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required for creator features',
        upgrade_required: true,
        current_tier: profile.subscription_tier,
        upgrade_info: {
          message: 'Premium subscription unlocks advanced creator features',
          action: 'upgrade_to_premium',
          benefits: ['Advanced analytics', 'Priority payouts', 'Enhanced story promotion']
        }
      }, { status: 403 })
    }

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(params.period)

    // Get earnings data with optimized queries
    const earningsQuery = supabase
      .from('creator_earnings')
      .select(`
        *,
        stories (
          id,
          title,
          ${params.includeStoryDetails ? 'genre, status, word_count, chapter_count, cover_image_url,' : ''}
          created_at
        ),
        profiles!creator_earnings_reader_id_fkey (email, full_name)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })

    if (params.limit && params.limit < 1000) {
      earningsQuery.limit(params.limit)
    }

    if (params.offset) {
      earningsQuery.range(params.offset, params.offset + params.limit - 1)
    }

    const { data: earnings, error: earningsError } = await earningsQuery

    if (earningsError) {
      console.error('Earnings query error:', earningsError)
      return NextResponse.json({ error: 'Failed to fetch earnings data' }, { status: 500 })
    }

    // Get story purchase data for enhanced metrics
    const { data: storyPurchases } = await supabase
      .from('story_purchases')
      .select(`
        story_id,
        credits_spent,
        purchase_type,
        created_at,
        stories (id, title)
      `)
      .eq('creator_id', user.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Calculate comprehensive summary statistics
    const totalCreditsEarned = earnings?.reduce((sum, e) => sum + e.credits_earned, 0) || 0
    const totalUsdEarnings = earnings?.reduce((sum, e) => sum + e.usd_equivalent, 0) || 0
    const uniqueReaders = new Set(earnings?.map(e => e.reader_id)).size
    const totalTransactions = earnings?.length || 0

    // Calculate story performance metrics
    const storyEarningsMap = new Map()
    earnings?.forEach(earning => {
      const storyId = earning.story_id
      const story = getRelationData(earning.stories)
      if (!storyEarningsMap.has(storyId)) {
        storyEarningsMap.set(storyId, {
          storyId,
          storyTitle: story.title || 'Unknown',
          storyGenre: story.genre,
          storyStatus: story.status,
          wordCount: story.word_count,
          chapterCount: story.chapter_count,
          coverImageUrl: story.cover_image_url,
          storyCreatedAt: story.created_at,
          totalCreditsEarned: 0,
          totalUsdEarned: 0,
          uniqueReaders: new Set(),
          totalPurchases: 0,
          lastPurchase: null,
          firstPurchase: null,
          averagePerPurchase: 0,
          conversionRate: 0
        })
      }

      const storyData = storyEarningsMap.get(storyId)
      storyData.totalCreditsEarned += earning.credits_earned
      storyData.totalUsdEarned += earning.usd_equivalent
      storyData.uniqueReaders.add(earning.reader_id)
      storyData.totalPurchases += 1

      const purchaseDate = new Date(earning.created_at)
      if (!storyData.lastPurchase || purchaseDate > new Date(storyData.lastPurchase)) {
        storyData.lastPurchase = earning.created_at
      }
      if (!storyData.firstPurchase || purchaseDate < new Date(storyData.firstPurchase)) {
        storyData.firstPurchase = earning.created_at
      }
    })

    // Convert unique readers sets to counts and calculate additional metrics
    const storyPerformance = Array.from(storyEarningsMap.values()).map(story => {
      const uniqueReaderCount = story.uniqueReaders.size
      return {
        ...story,
        uniqueReaders: uniqueReaderCount,
        averagePerPurchase: story.totalPurchases > 0 ? story.totalUsdEarned / story.totalPurchases : 0,
        readerRetention: uniqueReaderCount > 0 ? story.totalPurchases / uniqueReaderCount : 0
      }
    }).sort((a, b) => b.totalUsdEarned - a.totalUsdEarned)

    // Format recent transactions based on view
    const recentTransactions = params.includeTransactions ? earnings?.slice(0, params.limit).map(earning => {
      const story = getRelationData(earning.stories)
      const readerProfile = getRelationData(earning.profiles)
      return {
        id: earning.id,
        storyId: earning.story_id,
        storyTitle: story.title || 'Unknown',
        readerEmail: readerProfile.email || 'Unknown',
        readerName: readerProfile.full_name,
        creditsEarned: earning.credits_earned,
        usdEquivalent: earning.usd_equivalent,
        purchaseType: 'story_access',
        createdAt: earning.created_at,
        ...(params.includeExportData && {
          transactionHash: earning.id,
          paymentMethod: 'credits',
          taxInfo: {
            taxable: true,
            taxRate: 0.0, // Platform handles tax compliance
            netAmount: earning.usd_equivalent
          }
        })
      }
    }) || [] : []

    // Calculate monthly/weekly trends based on view
    const trendsData = params.includeTrends ? (() => {
      const trends = []
      const isLongPeriod = ['last_6_months', 'current_year', 'all_time'].includes(params.period)
      const trendPeriods = isLongPeriod ? 12 : 6 // months vs weeks

      for (let i = trendPeriods - 1; i >= 0; i--) {
        let periodStart: Date, periodEnd: Date, periodLabel: string

        if (isLongPeriod) {
          // Monthly trends
          periodStart = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1)
          periodEnd = new Date(endDate.getFullYear(), endDate.getMonth() - i + 1, 0)
          periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        } else {
          // Weekly trends
          const weekStart = new Date(endDate)
          weekStart.setDate(weekStart.getDate() - (i * 7))
          weekStart.setHours(0, 0, 0, 0)

          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)
          weekEnd.setHours(23, 59, 59, 999)

          periodStart = weekStart
          periodEnd = weekEnd
          periodLabel = `Week of ${weekStart.toLocaleDateString()}`
        }

        const periodEarnings = earnings?.filter(e => {
          const earningDate = new Date(e.created_at)
          return earningDate >= periodStart && earningDate <= periodEnd
        }) || []

        const periodPurchases = storyPurchases?.filter(p => {
          const purchaseDate = new Date(p.created_at)
          return purchaseDate >= periodStart && purchaseDate <= periodEnd
        }) || []

        const uniqueReadersInPeriod = new Set(periodEarnings.map(e => e.reader_id)).size

        trends.push({
          period: periodLabel,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          creditsEarned: periodEarnings.reduce((sum, e) => sum + e.credits_earned, 0),
          usdEarned: periodEarnings.reduce((sum, e) => sum + e.usd_equivalent, 0),
          transactionCount: periodEarnings.length,
          storiesSold: periodPurchases.length,
          uniqueReaders: uniqueReadersInPeriod,
          averageTransactionValue: periodEarnings.length > 0
            ? periodEarnings.reduce((sum, e) => sum + e.usd_equivalent, 0) / periodEarnings.length
            : 0
        })
      }
      return trends
    })() : []

    // Calculate tier-specific metrics
    const tierMetrics = params.includeTier && profile.creator_tier ? {
      currentTier: profile.creator_tier,
      tierBenefits: getTierBenefits(profile.creator_tier),
      nextTierRequirements: getNextTierRequirements(profile.creator_tier, {
        totalEarnings: profile.total_earnings_usd || 0,
        storiesCreated: profile.stories_created || 0,
        uniqueReaders
      }),
      tierProgress: calculateTierProgress(profile.creator_tier, {
        totalEarnings: profile.total_earnings_usd || 0,
        storiesCreated: profile.stories_created || 0,
        uniqueReaders
      })
    } : null

    // Payout information
    const pendingPayout = profile.pending_payout_usd || 0
    const canRequestPayout = pendingPayout >= 25
    const minimumPayout = 25
    const nextPayoutDate = getNextPayoutDate()

    const payoutInfo = {
      canRequestPayout,
      minimumPayout,
      currentBalance: pendingPayout,
      nextPayoutDate: nextPayoutDate.toISOString(),
      eligibilityMessage: canRequestPayout
        ? 'Ready for payout!'
        : `$${(minimumPayout - pendingPayout).toFixed(2)} more needed`,
      estimatedPayoutAfterFees: Math.max(0, pendingPayout - 2.5),
      processingFee: 2.5,
      payoutSchedule: 'Monthly on 1st',
      ...(params.includeExportData && {
        taxInfo: {
          ein: 'PLATFORM-TAX-ID',
          businessName: 'Infinite Pages Platform',
          taxYear: new Date().getFullYear(),
          form1099Required: (profile.total_earnings_usd || 0) >= 600
        }
      })
    }

    // Calculate additional metrics
    const storiesWithEarnings = storyPerformance.length
    const averageEarningsPerStory = storiesWithEarnings > 0 ? totalUsdEarnings / storiesWithEarnings : 0
    const averageRevenuePerReader = uniqueReaders > 0 ? totalUsdEarnings / uniqueReaders : 0

    // Period description for display
    const periodDescription = getPeriodDescription(params.period)

    // Build response based on view type
    const baseResponse = {
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        isCreator: profile.is_creator,
        creatorTier: profile.creator_tier,
        subscriptionTier: profile.subscription_tier,
        totalEarningsAllTime: profile.total_earnings_usd || 0,
        pendingPayoutUsd: pendingPayout,
        storiesCreated: profile.stories_created || 0,
        joinedDate: profile.created_at,
        lastUpdated: profile.updated_at
      },
      summary: {
        totalCreditsEarned,
        totalUsdEarnings,
        uniqueReaders,
        totalTransactions,
        storiesWithEarnings,
        averageEarningsPerStory,
        averageRevenuePerReader,
        pendingPayout,
        lifetimeEarnings: profile.total_earnings_usd || 0,
        creatorSharePercentage: CREATOR_REVENUE_SHARE * 100,
        periodDescription,
        period: params.period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      payoutInfo
    }

    // Add conditional data based on view and parameters
    const response: any = { ...baseResponse }

    if (params.view === 'basic') {
      response.storyPerformance = storyPerformance.slice(0, 5)
      if (params.includeTransactions) {
        response.recentTransactions = recentTransactions.slice(0, 10)
      }
    } else if (params.view === 'enhanced') {
      response.storyPerformance = storyPerformance.slice(0, 15)
      if (params.includeTransactions) {
        response.recentTransactions = recentTransactions.slice(0, 25)
      }
      if (params.includeTrends) {
        response.trendsData = trendsData
      }
      if (tierMetrics) {
        response.tierMetrics = tierMetrics
      }
    } else if (params.view === 'dashboard') {
      response.storyPerformance = storyPerformance
      if (params.includeTransactions) {
        response.recentTransactions = recentTransactions
      }
      if (params.includeTrends) {
        response.trendsData = trendsData
      }
      if (tierMetrics) {
        response.tierMetrics = tierMetrics
      }

      // Dashboard-specific metrics
      response.dashboardMetrics = {
        totalStoriesPublished: profile.stories_created || 0,
        conversionRate: profile.stories_created > 0 ? (storiesWithEarnings / profile.stories_created) * 100 : 0,
        averageDaysToFirstSale: calculateAverageTimeToFirstSale(storyPerformance),
        topPerformingGenres: getTopPerformingGenres(storyPerformance),
        readerEngagement: {
          repeatPurchaseRate: calculateRepeatPurchaseRate(earnings || []),
          averageReaderLifetimeValue: calculateAverageReaderLTV(earnings || [])
        }
      }
    }

    // Add payout history if requested
    if (params.includeHistory) {
      try {
        const { data: payoutHistoryData } = await supabase
          .from('creator_payouts')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)

        if (payoutHistoryData?.length) {
          response.payoutHistory = {
            items: payoutHistoryData.map(payout => ({
              id: payout.id,
              amountUsd: payout.amount_usd,
              status: payout.status,
              batchDate: payout.batch_date,
              createdAt: payout.created_at,
              completedAt: payout.completed_at,
              processingFee: payout.processing_fee || 2.5,
              netAmount: payout.amount_usd - (payout.processing_fee || 2.5),
              paymentMethod: payout.payment_method || 'bank_transfer',
              ...(params.includeExportData && {
                transactionId: payout.transaction_id,
                batchId: payout.batch_id,
                taxInfo: {
                  taxWithheld: 0,
                  taxableAmount: payout.amount_usd
                }
              })
            })),
            summary: {
              totalPayouts: payoutHistoryData.length,
              totalAmountPaidUsd: payoutHistoryData.reduce((sum, p) => sum + p.amount_usd, 0),
              totalFeesPaid: payoutHistoryData.reduce((sum, p) => sum + (p.processing_fee || 2.5), 0),
              netAmountReceived: payoutHistoryData.reduce((sum, p) => sum + p.amount_usd - (p.processing_fee || 2.5), 0),
              lastSuccessfulPayout: payoutHistoryData.find(p => p.status === 'completed') ? {
                amount: payoutHistoryData.find(p => p.status === 'completed')?.amount_usd || 0,
                date: payoutHistoryData.find(p => p.status === 'completed')?.created_at || '',
                completedAt: payoutHistoryData.find(p => p.status === 'completed')?.completed_at
              } : null,
              averagePayoutAmount: payoutHistoryData.length > 0
                ? payoutHistoryData.reduce((sum, p) => sum + p.amount_usd, 0) / payoutHistoryData.length
                : 0,
              averageProcessingTime: calculateAverageProcessingTime(payoutHistoryData)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch payout history:', error)
        // Continue without payout history rather than failing
      }
    }

    // Check for real-time updates and set up subscription
    cleanupRealtimeSubscriptions()
    const subscriptionId = subscribeToRealtimeUpdates(user.id)
    const realtimeUpdates = await checkForUpdates(user.id, supabase)

    // Add metadata with real-time information
    response.meta = {
      view: params.view,
      period: params.period,
      creditsToUsdRate: 0.035,
      lastUpdated: new Date().toISOString(),
      nextRefresh: new Date(Date.now() + CACHE_DURATIONS[params.view as keyof typeof CACHE_DURATIONS]).toISOString(),
      responseTime: Date.now() - startTime,
      cached: false,
      cacheAge: 0,
      totalRecords: {
        earnings: earnings?.length || 0,
        stories: storyPerformance.length,
        transactions: totalTransactions
      },
      pagination: {
        limit: params.limit,
        offset: params.offset,
        hasMore: earnings?.length === params.limit
      },
      realtime: {
        subscriptionId,
        hasUpdates: realtimeUpdates?.hasUpdates || false,
        newEarnings: realtimeUpdates?.newEarnings || 0,
        lastUpdate: realtimeUpdates?.latestUpdate || null,
        refreshRecommended: realtimeUpdates?.hasUpdates || false,
        updateCheckInterval: 30000, // 30 seconds
        pollUrl: `/api/creators/earnings/realtime?subscription=${subscriptionId}`
      },
      apiVersion: '2.0.0',
      deprecationWarnings: params.deprecationWarnings || [],
      cacheStats: getCacheStats()
    }

    // Cache the response with appropriate TTL based on view type (except for export data)
    if (!params.includeExportData) {
      setCachedData(cacheKey, response, params.view)
    }

    // Handle different response formats
    if (params.format === 'csv' || params.format === 'xlsx') {
      return handleExportFormat(response, params.format, profile.email)
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        'X-API-Version': '2.0.0',
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Cache-Status': cachedData ? 'HIT' : 'MISS'
      }
    })

  } catch (error) {
    console.error('Unified creator earnings endpoint error:', error)
    return NextResponse.json({
      error: 'Failed to fetch creator earnings',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Helper functions

function getTierBenefits(tier: string): string[] {
  const benefits = {
    bronze: ['Basic creator tools', 'Monthly payouts', 'Community support'],
    silver: ['Priority support', 'Advanced analytics', 'Featured story slots'],
    gold: ['Weekly payouts', 'Custom branding', 'Direct reader messaging'],
    platinum: ['Daily payouts', 'White-label options', 'Dedicated account manager']
  }
  return benefits[tier as keyof typeof benefits] || benefits.bronze
}

function getNextTierRequirements(currentTier: string, metrics: any): any {
  const requirements = {
    bronze: { earnings: 100, stories: 5, readers: 50, nextTier: 'silver' },
    silver: { earnings: 500, stories: 15, readers: 200, nextTier: 'gold' },
    gold: { earnings: 2000, stories: 50, readers: 1000, nextTier: 'platinum' },
    platinum: null // Highest tier
  }

  const req = requirements[currentTier as keyof typeof requirements]
  if (!req) return null

  return {
    nextTier: req.nextTier,
    requirements: {
      earnings: req.earnings,
      stories: req.stories,
      readers: req.readers
    },
    progress: {
      earnings: Math.min((metrics.totalEarnings / req.earnings) * 100, 100),
      stories: Math.min((metrics.storiesCreated / req.stories) * 100, 100),
      readers: Math.min((metrics.uniqueReaders / req.readers) * 100, 100)
    }
  }
}

function calculateTierProgress(tier: string, metrics: any): number {
  const requirements = getNextTierRequirements(tier, metrics)
  if (!requirements) return 100 // Highest tier

  const { earnings, stories, readers } = requirements.progress
  return Math.min((earnings + stories + readers) / 3, 100)
}

function getNextPayoutDate(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth
}

function getPeriodDescription(period: string): string {
  const descriptions = {
    '7': 'last 7 days',
    '30': 'last 30 days',
    '90': 'last 90 days',
    '365': 'last year',
    'current_month': 'this month',
    'last_month': 'last month',
    'last_3_months': 'last 3 months',
    'last_6_months': 'last 6 months',
    'current_year': 'this year',
    'all_time': 'all time'
  }
  return descriptions[period as keyof typeof descriptions] || 'selected period'
}

function calculateAverageTimeToFirstSale(stories: any[]): number {
  const storiesWithSales = stories.filter(s => s.firstPurchase && s.storyCreatedAt)
  if (storiesWithSales.length === 0) return 0

  const totalDays = storiesWithSales.reduce((sum, story) => {
    const created = new Date(story.storyCreatedAt)
    const firstSale = new Date(story.firstPurchase)
    const days = Math.ceil((firstSale.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    return sum + days
  }, 0)

  return totalDays / storiesWithSales.length
}

function getTopPerformingGenres(stories: any[]): any[] {
  const genreMap = new Map()

  stories.forEach(story => {
    if (story.storyGenre) {
      const existing = genreMap.get(story.storyGenre) || { genre: story.storyGenre, totalEarnings: 0, storyCount: 0 }
      existing.totalEarnings += story.totalUsdEarned
      existing.storyCount += 1
      genreMap.set(story.storyGenre, existing)
    }
  })

  return Array.from(genreMap.values())
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, 5)
}

function calculateRepeatPurchaseRate(earnings: any[]): number {
  const readerPurchases = new Map()

  earnings.forEach(earning => {
    const count = readerPurchases.get(earning.reader_id) || 0
    readerPurchases.set(earning.reader_id, count + 1)
  })

  const repeatReaders = Array.from(readerPurchases.values()).filter(count => count > 1).length
  const totalReaders = readerPurchases.size

  return totalReaders > 0 ? (repeatReaders / totalReaders) * 100 : 0
}

function calculateAverageReaderLTV(earnings: any[]): number {
  const readerTotals = new Map()

  earnings.forEach(earning => {
    const existing = readerTotals.get(earning.reader_id) || 0
    readerTotals.set(earning.reader_id, existing + earning.usd_equivalent)
  })

  const totals = Array.from(readerTotals.values())
  return totals.length > 0 ? totals.reduce((sum, total) => sum + total, 0) / totals.length : 0
}

function calculateAverageProcessingTime(payouts: any[]): number {
  const completedPayouts = payouts.filter(p => p.status === 'completed' && p.completed_at)
  if (completedPayouts.length === 0) return 0

  const totalHours = completedPayouts.reduce((sum, payout) => {
    const created = new Date(payout.created_at)
    const completed = new Date(payout.completed_at)
    const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60)
    return sum + hours
  }, 0)

  return totalHours / completedPayouts.length
}

function handleExportFormat(data: any, format: string, userEmail: string): NextResponse {
  if (format === 'csv') {
    const csv = generateCSV(data)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="creator-earnings-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } else if (format === 'xlsx') {
    const xlsx = generateXLSX(data, userEmail)
    return new NextResponse(xlsx as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="creator-earnings-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  }

  return NextResponse.json(data)
}

function generateCSV(data: any): string {
  const headers = [
    'Date',
    'Story Title',
    'Reader Email',
    'Credits Earned',
    'USD Equivalent',
    'Transaction Type'
  ]

  const rows = data.recentTransactions?.map((transaction: any) => [
    new Date(transaction.createdAt).toLocaleDateString(),
    transaction.storyTitle || 'Unknown',
    transaction.readerEmail || 'Anonymous',
    transaction.creditsEarned || 0,
    transaction.usdEquivalent || 0,
    transaction.purchaseType || 'story_access'
  ]) || []

  return [headers.join(','), ...rows.map((row: any) => row.join(','))].join('\n')
}

// Enhanced XLSX generation with multiple sheets
function generateXLSX(data: any, userEmail: string): Buffer {
  // Simple XLSX implementation without external dependencies
  // This creates a basic Excel file structure

  const summarySheet = createWorksheet('Summary', [
    ['Creator Email', userEmail],
    ['Export Date', new Date().toISOString()],
    ['Total Earnings (USD)', data.summary?.totalEarningsUsd || 0],
    ['Pending Payout (USD)', data.summary?.pendingPayoutUsd || 0],
    ['Total Credits Earned', data.summary?.totalCreditsEarned || 0],
    ['Unique Readers', data.summary?.uniqueReaders || 0],
    ['Stories with Earnings', data.summary?.storiesWithEarnings || 0]
  ])

  const transactionsSheet = createWorksheet('Transactions', [
    ['Date', 'Story Title', 'Reader Email', 'Credits Earned', 'USD Equivalent', 'Transaction Type'],
    ...(data.recentTransactions?.map((transaction: any) => [
      new Date(transaction.createdAt).toLocaleDateString(),
      transaction.storyTitle || 'Unknown',
      transaction.readerEmail || 'Anonymous',
      transaction.creditsEarned || 0,
      transaction.usdEquivalent || 0,
      transaction.purchaseType || 'story_access'
    ]) || [])
  ])

  const storyPerformanceSheet = createWorksheet('Story Performance', [
    ['Story Title', 'Total Credits', 'Total USD', 'Unique Readers', 'Purchase Count'],
    ...(data.storyPerformance?.slice(0, 50).map((story: any) => [
      story.storyTitle || 'Unknown',
      story.totalCredits || 0,
      story.totalUsd || 0,
      story.uniqueReaders || 0,
      story.purchaseCount || 0
    ]) || [])
  ])

  // Create a simple XLSX file buffer
  return createXLSXBuffer([
    { name: 'Summary', data: summarySheet },
    { name: 'Transactions', data: transactionsSheet },
    { name: 'Story Performance', data: storyPerformanceSheet }
  ])
}

// Helper function to create worksheet data
function createWorksheet(name: string, data: any[][]): any[][] {
  return data
}

// Simplified XLSX buffer creation (basic implementation)
function createXLSXBuffer(sheets: Array<{ name: string; data: any[][] }>): Buffer {
  // This is a simplified implementation for demonstration
  // In production, you would use a library like 'xlsx' or 'exceljs'

  const workbook = {
    SheetNames: sheets.map(s => s.name),
    Sheets: {} as any
  }

  sheets.forEach(sheet => {
    const ws: any = {}
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } }

    for (let R = 0; R < sheet.data.length; R++) {
      for (let C = 0; C < (sheet.data[R]?.length || 0); C++) {
        if (range.s.r > R) range.s.r = R
        if (range.s.c > C) range.s.c = C
        if (range.e.r < R) range.e.r = R
        if (range.e.c < C) range.e.c = C

        const cell_address = { c: C, r: R }
        const cell_ref = encodeCell(cell_address)
        const cellValue = sheet.data[R]?.[C]
        ws[cell_ref] = { v: cellValue, t: typeof cellValue === 'number' ? 'n' : 's' }
      }
    }

    ws['!ref'] = encodeRange(range)
    workbook.Sheets[sheet.name] = ws
  })

  // Convert to CSV format as fallback (since we're not using external libraries)
  let csvContent = ''
  sheets.forEach(sheet => {
    csvContent += `=== ${sheet.name} ===\n`
    csvContent += sheet.data.map(row => row.join(',')).join('\n')
    csvContent += '\n\n'
  })

  return Buffer.from(csvContent, 'utf8')
}

// Helper functions for Excel cell references
function encodeCell(cell: { c: number; r: number }): string {
  return String.fromCharCode(65 + cell.c) + (cell.r + 1)
}

function encodeRange(range: { s: { c: number; r: number }; e: { c: number; r: number } }): string {
  return encodeCell(range.s) + ':' + encodeCell(range.e)
}

// Real-time update functionality
interface RealtimeSubscription {
  userId: string
  lastUpdate: number
  callback?: (data: any) => void
}

const realtimeSubscriptions = new Map<string, RealtimeSubscription>()

// Add real-time update subscription
function subscribeToRealtimeUpdates(userId: string): string {
  const subscriptionId = `sub_${userId}_${Date.now()}`
  realtimeSubscriptions.set(subscriptionId, {
    userId,
    lastUpdate: Date.now()
  })
  return subscriptionId
}

// Check for real-time updates
async function checkForUpdates(userId: string, supabase: any): Promise<any | null> {
  const subscription = Array.from(realtimeSubscriptions.values())
    .find(sub => sub.userId === userId)

  if (!subscription) return null

  // Check for new earnings since last update
  const { data: newEarnings } = await supabase
    .from('creator_earnings')
    .select('*')
    .eq('creator_id', userId)
    .gt('created_at', new Date(subscription.lastUpdate).toISOString())
    .order('created_at', { ascending: false })

  if (newEarnings && newEarnings.length > 0) {
    subscription.lastUpdate = Date.now()
    return {
      hasUpdates: true,
      newEarnings: newEarnings.length,
      latestUpdate: newEarnings[0].created_at
    }
  }

  return { hasUpdates: false }
}

// Clean up old subscriptions
function cleanupRealtimeSubscriptions() {
  const now = Date.now()
  for (const [id, sub] of Array.from(realtimeSubscriptions.entries())) {
    if (now - sub.lastUpdate > 3600000) { // 1 hour
      realtimeSubscriptions.delete(id)
    }
  }
}