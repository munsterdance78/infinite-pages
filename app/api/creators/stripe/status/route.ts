import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Get detailed Stripe Connect account status for creators
export async function GET(request: NextRequest) {
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
      .select('stripe_connect_account_id, is_creator, subscription_tier, pending_payout_usd, total_earnings_usd')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.is_creator) {
      return NextResponse.json({
        status: 'not_creator',
        message: 'Creator status required for payouts',
        payout_enabled: false
      })
    }

    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        status: 'subscription_required',
        message: 'Premium subscription required for payouts',
        payout_enabled: false,
        current_tier: profile.subscription_tier,
        upgrade_required: true
      })
    }

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        status: 'not_onboarded',
        message: 'Stripe Connect account not set up',
        payout_enabled: false,
        pending_earnings: profile.pending_payout_usd || 0,
        total_earnings: profile.total_earnings_usd || 0,
        action_required: 'start_onboarding'
      })
    }

    try {
      // Get detailed account information from Stripe
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)

      const onboardingComplete = account.charges_enabled && account.payouts_enabled
      const requiresAction = (account.requirements?.currently_due?.length || 0) > 0 ||
                           (account.requirements?.eventually_due?.length || 0) > 0

      // Get account capabilities
      const capabilities = account.capabilities || {}

      // Get payout schedule information
      const payoutSchedule = account.settings?.payouts?.schedule

      // Get recent account activity (if available)
      let recentPayouts: any[] = []
      if (onboardingComplete) {
        try {
          const payoutsResponse = await stripe.payouts.list({
            stripeAccount: profile.stripe_connect_account_id,
            limit: 5
          })
          recentPayouts = payoutsResponse.data.map(payout => ({
            id: payout.id,
            amount: payout.amount / 100, // Convert from cents
            currency: payout.currency,
            status: payout.status,
            arrival_date: payout.arrival_date,
            created: payout.created
          }))
        } catch (payoutError) {
          // Ignore payout retrieval errors - not critical for status
          console.warn('Could not retrieve recent payouts:', payoutError)
        }
      }

      return NextResponse.json({
        status: onboardingComplete ? 'complete' : 'incomplete',
        message: onboardingComplete
          ? 'Stripe Connect setup complete - ready to receive payouts'
          : 'Additional information required to complete setup',
        payout_enabled: onboardingComplete,
        account_id: profile.stripe_connect_account_id,

        // Account capabilities and status
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,

        // Requirements and verification
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          pending_verification: account.requirements?.pending_verification || [],
          disabled_reason: account.requirements?.disabled_reason
        },
        requires_action: requiresAction,

        // Account details
        business_type: account.business_type,
        country: account.country,
        default_currency: account.default_currency,
        email: account.email,

        // Capabilities
        capabilities: {
          card_payments: capabilities.card_payments?.status,
          transfers: capabilities.transfers?.status
        },

        // Payout settings
        payout_schedule: payoutSchedule ? {
          interval: payoutSchedule.interval,
          delay_days: payoutSchedule.delay_days,
          monthly_anchor: payoutSchedule.monthly_anchor,
          weekly_anchor: payoutSchedule.weekly_anchor
        } : null,

        // Platform earnings data
        earnings: {
          pending_payout: profile.pending_payout_usd || 0,
          total_earnings: profile.total_earnings_usd || 0,
          currency: 'usd'
        },

        // Recent payout history
        recent_payouts: recentPayouts,

        // Next steps if action required
        next_steps: requiresAction ? [
          'Complete any missing required information',
          'Verify your identity if requested',
          'Add banking details if missing',
          'Review and accept updated terms if needed'
        ] : []
      })

    } catch (stripeError) {
      console.error('Error retrieving Stripe Connect account:', stripeError)

      if (stripeError instanceof Stripe.errors.StripeInvalidRequestError) {
        // Account might be deleted or invalid
        return NextResponse.json({
          status: 'account_error',
          message: 'Stripe Connect account not found or invalid',
          payout_enabled: false,
          account_id: profile.stripe_connect_account_id,
          error_type: 'account_not_found',
          action_required: 'restart_onboarding',
          pending_earnings: profile.pending_payout_usd || 0,
          total_earnings: profile.total_earnings_usd || 0
        })
      }

      return NextResponse.json({
        status: 'error',
        message: 'Unable to check Stripe Connect status',
        payout_enabled: false,
        account_id: profile.stripe_connect_account_id,
        error_type: 'api_error',
        pending_earnings: profile.pending_payout_usd || 0,
        total_earnings: profile.total_earnings_usd || 0
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Stripe Connect status check error:', error)
    return NextResponse.json({
      error: 'Failed to check Stripe Connect status'
    }, { status: 500 })
  }
}

// Update account preferences (like payout schedule)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { payout_schedule } = body

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get creator profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, is_creator, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator || !profile.stripe_connect_account_id) {
      return NextResponse.json({
        error: 'Stripe Connect account required'
      }, { status: 400 })
    }

    // Verify account is fully onboarded
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
    if (!account.payouts_enabled) {
      return NextResponse.json({
        error: 'Complete onboarding first',
        message: 'Account must be fully verified before updating settings'
      }, { status: 400 })
    }

    const updates: any = {}

    // Update payout schedule if provided
    if (payout_schedule) {
      const { interval, monthly_anchor, weekly_anchor } = payout_schedule

      if (interval && ['daily', 'weekly', 'monthly'].includes(interval)) {
        updates['settings[payouts][schedule][interval]'] = interval

        if (interval === 'monthly' && monthly_anchor >= 1 && monthly_anchor <= 31) {
          updates['settings[payouts][schedule][monthly_anchor]'] = monthly_anchor
        }

        if (interval === 'weekly' && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(weekly_anchor)) {
          updates['settings[payouts][schedule][weekly_anchor]'] = weekly_anchor
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        error: 'No valid updates provided'
      }, { status: 400 })
    }

    // Update account settings
    const updatedAccount = await stripe.accounts.update(
      profile.stripe_connect_account_id,
      updates
    )

    return NextResponse.json({
      success: true,
      message: 'Account settings updated successfully',
      payout_schedule: updatedAccount.settings?.payouts?.schedule
    })

  } catch (error) {
    console.error('Stripe Connect settings update error:', error)

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json({
        error: 'Invalid update request',
        message: error.message
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Failed to update account settings'
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    }
  })
}