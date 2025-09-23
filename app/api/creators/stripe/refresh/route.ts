import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import Stripe from 'stripe'
import { requireCreatorAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import type { Database } from '@/lib/supabase/types'
import { ERROR_MESSAGES } from '@/lib/constants'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// Environment variable validation
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://extracted-project-7kf26y4tj-munsterdance78s-projects.vercel.app'

// Handle Stripe Connect onboarding refresh (when user needs to restart onboarding)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account')

    const authResult = await requireCreatorAuth(request)
    if (!isAuthSuccess(authResult)) {
      return NextResponse.redirect(
        `${SITE_URL}/auth/signin?redirect_to=/creator/stripe/refresh`
      )
    }
    const { user, supabase } = authResult

    // Get creator profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, is_creator, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile?.is_creator) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=not_creator`
      )
    }

    if (profile.subscription_tier !== 'premium') {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=subscription_required`
      )
    }

    // Use account from URL parameter or profile
    const targetAccountId = accountId || profile.stripe_connect_account_id

    if (!targetAccountId) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=no_account`
      )
    }

    // Verify account ownership if account ID was provided in URL
    if (accountId && profile.stripe_connect_account_id !== accountId) {
      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=account_mismatch`
      )
    }

    try {
      // Create a new account link for refreshed onboarding
      const accountLink = await stripe.accountLinks.create({
        account: targetAccountId,
        refresh_url: `${SITE_URL}/creator/stripe/refresh`,
        return_url: `${SITE_URL}/creator/stripe/success`,
        type: 'account_onboarding'
      })

      // Redirect to new onboarding link
      return NextResponse.redirect(accountLink.url)

    } catch (stripeError) {
      console.error('Error creating refresh account link:', stripeError)

      if (stripeError instanceof Stripe.errors.StripeInvalidRequestError) {
        // Account might be fully onboarded or have issues
        return NextResponse.redirect(
          `${SITE_URL}/creator/dashboard?error=refresh_failed&reason=invalid_account`
        )
      }

      return NextResponse.redirect(
        `${SITE_URL}/creator/dashboard?error=refresh_failed`
      )
    }

  } catch (error) {
    console.error('Stripe Connect refresh error:', error)
    return NextResponse.redirect(
      `${SITE_URL}/creator/dashboard?error=refresh_error`
    )
  }
}

// POST endpoint to generate new onboarding link via API
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
      .select('stripe_connect_account_id, is_creator, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!profile.is_creator) {
      return NextResponse.json({
        error: 'Creator status required'
      }, { status: 403 })
    }

    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required',
        upgrade_required: true,
        current_tier: profile.subscription_tier
      }, { status: 403 })
    }

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        error: 'No Stripe Connect account found',
        message: 'Please start the onboarding process first'
      }, { status: 400 })
    }

    // Verify account still exists and get current status
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)

      // If already fully onboarded, return status instead of new link
      if (account.charges_enabled && account.payouts_enabled) {
        return NextResponse.json({
          success: true,
          status: 'already_complete',
          message: 'Stripe Connect onboarding is already complete',
          account_id: profile.stripe_connect_account_id,
          payouts_enabled: true
        })
      }

      // Create new account link for refresh
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_connect_account_id,
        refresh_url: `${SITE_URL}/creator/stripe/refresh`,
        return_url: `${SITE_URL}/creator/stripe/success`,
        type: 'account_onboarding'
      })

      return NextResponse.json({
        success: true,
        status: 'refresh_created',
        message: 'New onboarding link created',
        onboarding_url: accountLink.url,
        expires_at: accountLink.expires_at,
        account_id: profile.stripe_connect_account_id
      })

    } catch (stripeError) {
      console.error('Error handling account refresh:', stripeError)

      if (stripeError instanceof Stripe.errors.StripeInvalidRequestError) {
        return NextResponse.json({
          error: 'Account not found',
          message: 'Your Stripe Connect account may have been deleted. Please start onboarding again.',
          action: 'restart_onboarding'
        }, { status: 400 })
      }

      return NextResponse.json({
        error: 'Unable to refresh onboarding',
        message: 'Please try again or contact support'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Stripe Connect refresh API error:', error)
    return NextResponse.json({
      error: 'Failed to refresh onboarding'
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