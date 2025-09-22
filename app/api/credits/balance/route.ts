import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import type { Database } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const { searchParams } = new URL(request.url)
    const includeTransactions = searchParams.get('include_transactions') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get user balance and stats
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        credits_balance,
        credits_earned_total,
        credits_spent_total,
        cache_hits,
        cache_discount_earned
      `)
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    let transactions = null
    if (includeTransactions) {
      const { data: transactionData } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      transactions = transactionData
    }

    // Calculate spending analytics
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data: recentSpending } = await supabase
      .from('credit_transactions')
      .select('amount, transaction_type, created_at')
      .eq('user_id', user.id)
      .eq('transaction_type', 'spend')
      .gte('created_at', last30Days.toISOString())

    const monthlySpending = recentSpending?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0

    // Calculate cache efficiency
    const cacheEfficiency = profile.cache_hits > 0
      ? Math.round((profile.cache_discount_earned / profile.credits_spent_total) * 100)
      : 0

    return NextResponse.json({
      balance: {
        current: profile.credits_balance,
        lifetime_earned: profile.credits_earned_total,
        lifetime_spent: profile.credits_spent_total,
        net_balance: profile.credits_earned_total - profile.credits_spent_total
      },
      analytics: {
        monthly_spending: monthlySpending,
        cache_hits: profile.cache_hits,
        total_cache_savings: profile.cache_discount_earned,
        cache_efficiency_percentage: cacheEfficiency,
        estimated_monthly_cost: monthlySpending > 0 ? monthlySpending * 0.05 : 0 // Rough USD estimate
      },
      transactions: transactions || [],
      meta: {
        currency: 'credits',
        cache_discount_active: true,
        spending_period: '30 days'
      }
    })

  } catch (error) {
    console.error('Credit balance endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch credit balance' }, { status: 500 })
  }
}