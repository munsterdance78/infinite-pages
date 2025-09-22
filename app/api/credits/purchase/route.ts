import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const { packageId } = await request.json()

    // Get credit package details
    const { data: creditPackage, error: packageError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single()

    if (packageError || !creditPackage) {
      return NextResponse.json({ error: 'Credit package not found' }, { status: 404 })
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email,
        metadata: { userId: user.id }
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(creditPackage.price_usd * 100), // Convert to cents
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId: user.id,
        packageId: creditPackage.id,
        creditsAmount: creditPackage.credits_amount.toString(),
        bonusCredits: creditPackage.bonus_credits.toString()
      }
    })

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customerId,
        package_id: creditPackage.id,
        amount_usd: creditPackage.price_usd,
        credits_purchased: creditPackage.credits_amount,
        bonus_credits: creditPackage.bonus_credits,
        status: 'pending'
      })

    if (paymentError) {
      console.error('Payment record creation error:', paymentError)
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })

  } catch (error) {
    console.error('Credit purchase error:', error)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
  }
}