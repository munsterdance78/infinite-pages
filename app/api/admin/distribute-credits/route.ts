import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { calculateProportionalCredits, SUBSCRIPTION_TIERS, type SubscriptionTier } from '@/lib/subscription-config'
import type { Database } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const body = await request.json()
    const { month, year, dryRun = false } = body

    // Calculate the month we're distributing for
    const distributionMonth = month || new Date().getMonth()
    const distributionYear = year || new Date().getFullYear()
    const startOfMonth = new Date(distributionYear, distributionMonth, 1)
    const endOfMonth = new Date(distributionYear, distributionMonth + 1, 0)

    console.log(`Processing credit distribution for ${distributionYear}-${distributionMonth + 1}`)

    // Get all active subscribers for the month
    const { data: activeSubscribers } = await supabase
      .from('profiles')
      .select(`
        id,
        subscription_tier,
        subscription_status,
        subscription_period_start,
        subscription_period_end
      `)
      .in('subscription_status', ['active', 'trialing'])
      .not('subscription_tier', 'is', null)

    if (!activeSubscribers) {
      return NextResponse.json({ error: 'No active subscribers found' }, { status: 404 })
    }

    console.log(`Found ${activeSubscribers.length} active subscribers`)

    // Get story reading activity for the month for all users
    const { data: readingActivity } = await supabase
      .from('story_purchases')
      .select('reader_id, story_id, created_at')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString())

    // Calculate reading activity per user
    const userReadingStats = new Map()
    readingActivity?.forEach(purchase => {
      const userId = purchase.reader_id
      const existing = userReadingStats.get(userId) || { storiesRead: 0, uniqueStories: new Set() }
      existing.uniqueStories.add(purchase.story_id)
      existing.storiesRead = existing.uniqueStories.size
      userReadingStats.set(userId, existing)
    })

    const totalActiveUsers = activeSubscribers.length
    const distributionResults = []

    // Process each subscriber
    for (const subscriber of activeSubscribers) {
      const userActivity = userReadingStats.get(subscriber.id)
      const storiesReadThisMonth = userActivity?.storiesRead || 0

      // Calculate proportional credits
      const creditsToDistribute = calculateProportionalCredits(
        subscriber.subscription_tier as SubscriptionTier,
        storiesReadThisMonth,
        totalActiveUsers
      )

      // Check if user was active during the subscription period
      const subscriptionStart = new Date(subscriber.subscription_period_start)
      const subscriptionEnd = new Date(subscriber.subscription_period_end)
      const wasActiveThisMonth = subscriptionStart <= endOfMonth && subscriptionEnd >= startOfMonth

      if (!wasActiveThisMonth) {
        console.log(`User ${subscriber.id} was not active during ${distributionYear}-${distributionMonth + 1}, skipping`)
        continue
      }

      const result = {
        userId: subscriber.id,
        subscriptionTier: subscriber.subscription_tier,
        storiesReadThisMonth,
        baseCredits: SUBSCRIPTION_TIERS[subscriber.subscription_tier as SubscriptionTier].credits_per_month,
        bonusCredits: creditsToDistribute - SUBSCRIPTION_TIERS[subscriber.subscription_tier as SubscriptionTier].credits_per_month,
        totalCreditsDistributed: creditsToDistribute,
        distributionMonth: `${distributionYear}-${String(distributionMonth + 1).padStart(2, '0')}`
      }

      distributionResults.push(result)

      if (!dryRun) {
        // Get current balance first
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('credits_balance, credits_earned_total')
          .eq('id', subscriber.id)
          .single()

        if (currentProfile) {
          // Add credits to user's balance
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              credits_balance: (currentProfile.credits_balance || 0) + creditsToDistribute,
              credits_earned_total: (currentProfile.credits_earned_total || 0) + creditsToDistribute
            })
            .eq('id', subscriber.id)

          if (updateError) {
            console.error(`Failed to update credits for user ${subscriber.id}:`, updateError)
            continue
          }
        } else {
          console.error(`Profile not found for user ${subscriber.id}`)
          continue
        }

        // Record the credit transaction
        const { error: transactionError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: subscriber.id,
            amount: creditsToDistribute,
            transaction_type: 'monthly_distribution',
            description: `Monthly credit distribution for ${distributionYear}-${String(distributionMonth + 1).padStart(2, '0')}`,
            metadata: {
              distribution_month: result.distributionMonth,
              subscription_tier: subscriber.subscription_tier,
              stories_read: storiesReadThisMonth,
              base_credits: result.baseCredits,
              bonus_credits: result.bonusCredits
            }
          })

        if (transactionError) {
          console.error(`Failed to record transaction for user ${subscriber.id}:`, transactionError)
        }
      }
    }

    // Calculate summary statistics
    const totalCreditsDistributed = distributionResults.reduce((sum, r) => sum + r.totalCreditsDistributed, 0)
    const totalBonusCredits = distributionResults.reduce((sum, r) => sum + r.bonusCredits, 0)
    const averageCreditsPerUser = distributionResults.length > 0 ? totalCreditsDistributed / distributionResults.length : 0

    const summary = {
      distributionMonth: `${distributionYear}-${String(distributionMonth + 1).padStart(2, '0')}`,
      totalUsersProcessed: distributionResults.length,
      totalCreditsDistributed,
      totalBonusCredits,
      averageCreditsPerUser: Math.round(averageCreditsPerUser),
      dryRun,
      breakdown: {
        byTier: distributionResults.reduce((acc, r) => {
          const tier = r.subscriptionTier
          if (!acc[tier]) {
            acc[tier] = { users: 0, credits: 0, bonusCredits: 0 }
          }
          acc[tier].users++
          acc[tier].credits += r.totalCreditsDistributed
          acc[tier].bonusCredits += r.bonusCredits
          return acc
        }, {} as Record<string, { users: number; credits: number; bonusCredits: number }>)
      }
    }

    console.log('Credit distribution complete:', summary)

    return NextResponse.json({
      success: true,
      summary,
      details: distributionResults.slice(0, 100), // Limit response size
      message: dryRun
        ? 'Dry run completed - no credits were actually distributed'
        : 'Credits distributed successfully'
    })

  } catch (error) {
    console.error('Credit distribution endpoint error:', error)
    return NextResponse.json({ error: 'Failed to distribute credits' }, { status: 500 })
  }
}

// Get distribution history
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    // Get recent distribution transactions
    const { data: distributions } = await supabase
      .from('credit_transactions')
      .select(`
        created_at,
        amount,
        metadata,
        profiles (subscription_tier)
      `)
      .eq('transaction_type', 'monthly_distribution')
      .order('created_at', { ascending: false })
      .limit(1000)

    // Group by distribution month
    const distributionHistory = distributions?.reduce((acc: Record<string, {
      totalCredits: number;
      totalUsers: number;
      byTier: Record<string, { users: number; credits: number }>;
    }>, transaction) => {
      const month = transaction.metadata?.distribution_month || 'unknown'
      if (!acc[month]) {
        acc[month] = {
          totalCredits: 0,
          totalUsers: 0,
          byTier: {} as Record<string, { users: number; credits: number }>
        }
      }

      acc[month].totalCredits += transaction.amount
      acc[month].totalUsers++

      const tier = transaction.metadata?.subscription_tier || 'unknown'
      if (!acc[month].byTier[tier]) {
        acc[month].byTier[tier] = { users: 0, credits: 0 }
      }
      acc[month].byTier[tier].users++
      acc[month].byTier[tier].credits += transaction.amount

      return acc
    }, {}) || {}

    return NextResponse.json({
      distributionHistory: Object.values(distributionHistory)
    })

  } catch (error) {
    console.error('Distribution history endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch distribution history' }, { status: 500 })
  }
}