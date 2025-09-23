import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// Only create supabase client when environment variables are available
const getSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Supabase environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!session.metadata?.userId) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  const supabase = getSupabaseClient()

  // Determine tier from metadata, default to premium for backward compatibility
  const tier = session.metadata.tier || 'premium'
  const creditsToGrant = tier === 'basic' ? 1332 : 2497

  await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: 'active',
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      tokens_remaining: creditsToGrant
    })
    .eq('id', session.metadata.userId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string)

  if ('metadata' in customer && customer.metadata.userId) {
    const supabase = getSupabaseClient()
    await supabase
      .from('profiles')
      .update({
        subscription_status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
      })
      .eq('id', customer.metadata.userId)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string)

  if ('metadata' in customer && customer.metadata.userId) {
    const supabase = getSupabaseClient()
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'basic',
        subscription_status: 'inactive',
        current_period_end: null,
        tokens_remaining: 1332 // Revert to basic tier credits
      })
      .eq('id', customer.metadata.userId)
  }
}