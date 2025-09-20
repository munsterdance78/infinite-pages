import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const MINIMUM_PAYOUT = 25.00 // $25 minimum payout

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get creator profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, pending_payout_usd, stripe_connect_account_id, email, total_earnings_usd')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.json({ error: 'Creator access required' }, { status: 403 })
    }

    if (profile.pending_payout_usd < MINIMUM_PAYOUT) {
      return NextResponse.json({
        error: `Minimum payout amount is $${MINIMUM_PAYOUT}`,
        currentAmount: profile.pending_payout_usd,
        minimumRequired: MINIMUM_PAYOUT
      }, { status: 400 })
    }

    // Check if Stripe Connect account exists
    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        error: 'Stripe Connect account required',
        action: 'setup_connect_account'
      }, { status: 400 })
    }

    // Verify Stripe Connect account is active
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
      if (!account.charges_enabled || !account.payouts_enabled) {
        return NextResponse.json({
          error: 'Stripe Connect account not fully activated',
          action: 'complete_connect_setup'
        }, { status: 400 })
      }
    } catch (stripeError) {
      console.error('Stripe account verification error:', stripeError)
      return NextResponse.json({
        error: 'Invalid Stripe Connect account',
        action: 'setup_connect_account'
      }, { status: 400 })
    }

    // Get earnings for this payout period
    const { data: unpaidEarnings } = await supabase
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', user.id)
      .is('payout_id', null) // Only unpaid earnings

    if (!unpaidEarnings || unpaidEarnings.length === 0) {
      return NextResponse.json({ error: 'No unpaid earnings found' }, { status: 400 })
    }

    const totalEarnings = unpaidEarnings.reduce((sum, e) => sum + e.usd_equivalent, 0)

    // Create payout transfer
    const transfer = await stripe.transfers.create({
      amount: Math.round(totalEarnings * 100), // Convert to cents
      currency: 'usd',
      destination: profile.stripe_connect_account_id,
      metadata: {
        creatorId: user.id,
        earningsCount: unpaidEarnings.length.toString(),
        payoutType: 'creator_earnings'
      }
    })

    // Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        creator_id: user.id,
        amount_usd: totalEarnings,
        stripe_transfer_id: transfer.id,
        status: 'processing',
        period_start: unpaidEarnings[unpaidEarnings.length - 1].created_at,
        period_end: unpaidEarnings[0].created_at,
        earnings_count: unpaidEarnings.length
      })
      .select()
      .single()

    if (payoutError) {
      console.error('Payout record creation error:', payoutError)
      return NextResponse.json({ error: 'Failed to create payout record' }, { status: 500 })
    }

    // Update creator profile
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        pending_payout_usd: 0,
        total_earnings_usd: profile.total_earnings_usd + totalEarnings
      })
      .eq('id', user.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: totalEarnings,
        status: 'processing',
        transferId: transfer.id,
        earningsCount: unpaidEarnings.length
      },
      message: `Payout of $${totalEarnings.toFixed(2)} initiated successfully`
    })

  } catch (error) {
    console.error('Payout request error:', error)
    return NextResponse.json({ error: 'Failed to process payout request' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get payout history
    const { data: payouts } = await supabase
      .from('payouts')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ payouts })

  } catch (error) {
    console.error('Payout history error:', error)
    return NextResponse.json({ error: 'Failed to fetch payout history' }, { status: 500 })
  }
}