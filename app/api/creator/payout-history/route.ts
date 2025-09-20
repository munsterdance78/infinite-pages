import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { getCreatorPayoutHistory } from '@/lib/creator-earnings'
import type { Database } from '@/lib/supabase/types'

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

    // Only Premium subscribers can access creator features
    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required for creator features',
        upgrade_required: true
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get payout history
    const { payouts, error } = await getCreatorPayoutHistory(user.id, limit, supabase)

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    // Calculate summary statistics
    const totalPayouts = payouts.length
    const totalAmountPaid = payouts
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount_usd, 0)

    const lastSuccessfulPayout = payouts
      .filter(p => p.status === 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    // Get pending payouts
    const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'processing')

    // Format payout history for response
    const formattedPayouts = payouts.map(payout => ({
      id: payout.id,
      amount_usd: payout.amount_usd,
      status: payout.status,
      stripe_transfer_id: payout.stripe_transfer_id,
      error_message: payout.error_message,
      batch_date: payout.monthly_payout_batches?.batch_date,
      batch_status: payout.monthly_payout_batches?.processing_status,
      created_at: payout.created_at,
      processing_fee: 0.25, // Stripe transfer fee
      net_amount: payout.amount_usd - 0.25
    }))

    return NextResponse.json({
      payout_history: formattedPayouts.slice(offset, offset + limit),
      summary: {
        total_payouts: totalPayouts,
        total_amount_paid_usd: totalAmountPaid,
        total_fees_paid: totalPayouts * 0.25, // Stripe fees
        net_amount_received: totalAmountPaid - (totalPayouts * 0.25),
        last_successful_payout: lastSuccessfulPayout ? {
          amount: lastSuccessfulPayout.amount_usd,
          date: lastSuccessfulPayout.created_at,
          batch_date: lastSuccessfulPayout.monthly_payout_batches?.batch_date
        } : null,
        pending_payouts: pendingPayouts.length,
        pending_amount: pendingPayouts.reduce((sum, p) => sum + p.amount_usd, 0)
      },
      pagination: {
        limit,
        offset,
        total: totalPayouts,
        has_more: (offset + limit) < totalPayouts
      },
      meta: {
        payout_schedule: 'Monthly on 1st',
        processing_fee_per_transfer: 0.25,
        minimum_payout: 25.00,
        currency: 'USD'
      }
    })

  } catch (error) {
    console.error('Creator payout history endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch payout history' }, { status: 500 })
  }
}