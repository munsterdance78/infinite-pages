import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

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

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSuccess(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailure(paymentIntent)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { userId, packageId, creditsAmount, bonusCredits } = paymentIntent.metadata

    // Update payment record
    const updateData = {
      status: 'succeeded',
      payment_method: paymentIntent.payment_method_types[0],
      processed_at: new Date().toISOString()
    }
    const { error: paymentUpdateError } = await (supabase as any)
      .from('payments')
      .update(updateData)
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (paymentUpdateError) {
      console.error('Payment update error:', paymentUpdateError)
      return
    }

    // Get current user balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance, credits_earned_total')
      .eq('id', userId)
      .single()

    if (!profile) {
      console.error('User profile not found:', userId)
      return
    }

    const totalCredits = parseInt(creditsAmount) + parseInt(bonusCredits)
    const currentBalance = (profile as any)?.credits_balance || 0
    const currentEarnings = (profile as any)?.credits_earned_total || 0
    const newBalance = currentBalance + totalCredits

    // Update user balance and stats
    const { error: profileUpdateError } = await (supabase as any)
      .from('profiles')
      .update({
        credits_balance: newBalance,
        credits_earned_total: currentEarnings + totalCredits
      })
      .eq('id', userId)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
      return
    }

    // Create credit transaction record
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'purchase',
        amount: totalCredits,
        balance_after: newBalance,
        description: `Credit purchase: ${creditsAmount} credits + ${bonusCredits} bonus`,
        reference_id: paymentIntent.id,
        reference_type: 'purchase'
      })

    if (transactionError) {
      console.error('Transaction creation error:', transactionError)
      return
    }

    console.log(`Payment processed successfully for user ${userId}: ${totalCredits} credits`)

  } catch (error) {
    console.error('Payment success handling error:', error)
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        processed_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Payment failure update error:', error)
    }

  } catch (error) {
    console.error('Payment failure handling error:', error)
  }
}