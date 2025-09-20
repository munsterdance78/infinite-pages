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

interface OnboardingRequest {
  country?: string
  business_type?: 'individual' | 'company'
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get creator profile and verify eligibility
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_creator, subscription_tier, stripe_connect_account_id, email, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if user is a creator
    if (!profile.is_creator) {
      return NextResponse.json({
        error: 'Creator status required',
        message: 'You must be a creator to set up payouts'
      }, { status: 403 })
    }

    // Check if Premium subscription is required for payouts
    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        error: 'Premium subscription required',
        message: 'Premium subscription is required to receive creator payouts',
        upgrade_required: true,
        current_tier: profile.subscription_tier
      }, { status: 403 })
    }

    // Check if already has Connect account
    if (profile.stripe_connect_account_id) {
      try {
        // Verify existing account status
        const existingAccount = await stripe.accounts.retrieve(profile.stripe_connect_account_id)

        if (existingAccount.charges_enabled && existingAccount.payouts_enabled) {
          return NextResponse.json({
            success: true,
            status: 'already_onboarded',
            message: 'Stripe Connect account is already set up and active',
            account_id: profile.stripe_connect_account_id,
            onboarding_complete: true
          })
        } else {
          // Account exists but not fully onboarded - create new onboarding link
          const accountLink = await stripe.accountLinks.create({
            account: profile.stripe_connect_account_id,
            refresh_url: `${SITE_URL}/creator/stripe/refresh`,
            return_url: `${SITE_URL}/creator/stripe/success`,
            type: 'account_onboarding'
          })

          return NextResponse.json({
            success: true,
            status: 'onboarding_required',
            message: 'Complete your Stripe Connect setup',
            onboarding_url: accountLink.url,
            account_id: profile.stripe_connect_account_id
          })
        }
      } catch (stripeError) {
        console.error('Error checking existing Stripe account:', stripeError)
        // If account is invalid, we'll create a new one below
      }
    }

    // Parse request body for additional onboarding options
    const body = await request.json().catch(() => ({})) as OnboardingRequest
    const { country = 'US', business_type = 'individual' } = body

    // Create new Stripe Express account for marketplace
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email: user.email || profile.email,
      business_type,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_profile: {
        mcc: '5815', // Digital Goods - Books, Movies, Music
        product_description: 'AI-generated story content and digital publishing'
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'monthly',
            monthly_anchor: 1 // Payout on 1st of each month
          }
        }
      },
      metadata: {
        creator_id: user.id,
        platform: 'infinite-pages',
        revenue_share: '70',
        created_via: 'creator_onboarding'
      }
    })

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${SITE_URL}/creator/stripe/refresh`,
      return_url: `${SITE_URL}/creator/stripe/success`,
      type: 'account_onboarding'
    })

    // Store the Connect account ID in the database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_connect_account_id: account.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile with Connect account:', updateError)
      // Don't fail the request - account was created successfully
    }

    // Initialize creator earnings accumulation if not exists
    const { error: earningsError } = await supabase
      .from('creator_earnings_accumulation')
      .upsert({
        creator_id: user.id,
        total_accumulated_usd: 0.00,
        last_payout_date: null,
        last_payout_amount: null
      }, {
        onConflict: 'creator_id'
      })

    if (earningsError) {
      console.error('Error initializing creator earnings:', earningsError)
      // Don't fail the request - this can be fixed later
    }

    return NextResponse.json({
      success: true,
      status: 'onboarding_created',
      message: 'Stripe Connect account created successfully. Complete onboarding to start receiving payouts.',
      onboarding_url: accountLink.url,
      account_id: account.id,
      expires_at: accountLink.expires_at,
      instructions: [
        'Click the onboarding link to set up your payout details',
        'Provide required business and banking information',
        'Complete identity verification if required',
        'Return to your creator dashboard when finished'
      ]
    })

  } catch (error) {
    console.error('Stripe Connect onboarding error:', error)

    // Provide specific error messages for common Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      switch (error.type) {
        case 'StripeInvalidRequestError':
          return NextResponse.json({
            error: 'Invalid request to Stripe',
            message: 'There was an issue with your account setup. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          }, { status: 400 })

        case 'StripeRateLimitError':
          return NextResponse.json({
            error: 'Too many requests',
            message: 'Please wait a moment before trying again.'
          }, { status: 429 })

        case 'StripeConnectionError':
          return NextResponse.json({
            error: 'Connection error',
            message: 'Unable to connect to payment processor. Please try again.'
          }, { status: 503 })

        default:
          return NextResponse.json({
            error: 'Payment setup failed',
            message: 'Unable to set up payout account. Please contact support if this continues.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          }, { status: 500 })
      }
    }

    return NextResponse.json({
      error: 'Failed to create Stripe Connect account',
      message: 'An unexpected error occurred. Please try again or contact support.'
    }, { status: 500 })
  }
}

// GET endpoint to check onboarding status
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get current Connect account status
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
        onboarding_status: 'not_creator',
        message: 'Creator status required for payouts'
      })
    }

    if (profile.subscription_tier !== 'premium') {
      return NextResponse.json({
        onboarding_status: 'subscription_required',
        message: 'Premium subscription required for payouts',
        current_tier: profile.subscription_tier
      })
    }

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        onboarding_status: 'not_started',
        message: 'Stripe Connect account not set up'
      })
    }

    // Check account status with Stripe
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)

      const onboardingComplete = account.charges_enabled && account.payouts_enabled
      const requiresAction = (account.requirements?.currently_due?.length || 0) > 0 ||
                           (account.requirements?.eventually_due?.length || 0) > 0

      return NextResponse.json({
        onboarding_status: onboardingComplete ? 'complete' : 'incomplete',
        account_id: profile.stripe_connect_account_id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          pending_verification: account.requirements?.pending_verification || []
        },
        requires_action: requiresAction,
        country: account.country,
        default_currency: account.default_currency,
        business_type: account.business_type,
        message: onboardingComplete
          ? 'Stripe Connect setup complete - ready to receive payouts'
          : 'Additional information required to complete setup'
      })

    } catch (stripeError) {
      console.error('Error retrieving Stripe account:', stripeError)
      return NextResponse.json({
        onboarding_status: 'error',
        message: 'Unable to check account status',
        account_id: profile.stripe_connect_account_id
      })
    }

  } catch (error) {
    console.error('Onboarding status check error:', error)
    return NextResponse.json({
      error: 'Failed to check onboarding status'
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