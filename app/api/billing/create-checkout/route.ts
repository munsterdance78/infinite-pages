import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// Environment variable validation
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://infinite-pages.vercel.app'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (!isAuthSuccess(authResult)) return authResult
  const { user, supabase } = authResult

  if (!user?.email) {
    return NextResponse.json(
      { error: 'User email required' },
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1
        }
      ],
      success_url: `${SITE_URL}/dashboard?upgraded=true`,
      cancel_url: `${SITE_URL}/dashboard`,
      metadata: { userId: user.id }
    })

    return NextResponse.json(
      { url: session.url },
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    }
  })
}