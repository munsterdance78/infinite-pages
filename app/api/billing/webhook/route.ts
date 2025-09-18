import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  
  await supabase
    .from('profiles')
    .update({
      subscription_tier: 'pro',
      subscription_status: 'active',
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      tokens_remaining: 100 // Grant Pro tokens immediately
    })
    .eq('id', session.metadata.userId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string)
  
  if ('metadata' in customer && customer.metadata.userId) {
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
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'free',
        subscription_status: 'inactive',
        current_period_end: null
      })
      .eq('id', customer.metadata.userId)
  }
}