import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Environment variable validation
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://infinite-pages.vercel.app'

// Handle Stripe Connect onboarding completion callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account')
    const state = searchParams.get('state') // Optional state parameter

    if (!accountId) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=missing_account_id`
      )
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(
        `${SITE_URL}/auth/signin?redirect_to=/creator/stripe/callback`
      )
    }

    // Verify this account belongs to the current user
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, is_creator')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=not_creator`
      )
    }

    if (profile.stripe_connect_account_id !== accountId) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=account_mismatch`
      )
    }

    // Retrieve account details from Stripe to check onboarding status
    try {
      const account = await stripe.accounts.retrieve(accountId)

      const onboardingComplete = account.charges_enabled && account.payouts_enabled
      // Ensure safe access to possibly undefined arrays
      const requiresAction = (account.requirements?.currently_due?.length || 0) > 0

      // Update profile with onboarding completion status
      await supabase
        .from('profiles')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (onboardingComplete) {
        // Initialize creator earnings if not already done
        await supabase
          .from('creator_earnings_accumulation')
          .upsert({
            creator_id: user.id,
            total_accumulated_usd: 0.00,
            last_payout_date: null,
            last_payout_amount: null
          }, {
            onConflict: 'creator_id'
          })

        return NextResponse.redirect(
          `${SITE_URL}/creator/dashboard?onboarding=success&payouts_enabled=true`
        )
      } else if (requiresAction) {
        return NextResponse.redirect(
          `${SITE_URL}/creator/dashboard?onboarding=incomplete&action_required=true`
        )
      } else {
        return NextResponse.redirect(
          `${SITE_URL}/creator/dashboard?onboarding=pending`
        )
      }

    } catch (stripeError) {
      console.error('Error retrieving Stripe account in callback:', stripeError)
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=stripe_error`
      )
    }

  } catch (error) {
    console.error('Stripe Connect callback error:', error)
    return NextResponse.redirect(
      `${SITE_URL}/creator/dashboard?error=callback_failed`
    )
  }
}

// Handle POST requests for API-based callback handling
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id } = body

    if (!account_id) {
      return NextResponse.json({
        error: 'Account ID required'
      }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Verify account ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, is_creator')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator || profile.stripe_connect_account_id !== account_id) {
      return NextResponse.json({
        error: 'Account verification failed'
      }, { status: 403 })
    }

    // Get current account status
    const account = await stripe.accounts.retrieve(account_id)

    return NextResponse.json({
      success: true,
      account_id,
      onboarding_complete: account.charges_enabled && account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        pending_verification: account.requirements?.pending_verification || []
      }
    })

  } catch (error) {
    console.error('Stripe Connect callback API error:', error)
    return NextResponse.json({
      error: 'Failed to process callback'
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    }
  })
}