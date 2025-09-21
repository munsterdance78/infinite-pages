import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Initialize Supabase client with environment variable validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[Webhook] Missing Supabase environment variables');
  console.error('[Webhook] Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient<Database>(supabaseUrl, serviceRoleKey)
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is properly configured
    if (!supabase) {
      console.error('[Webhook] Supabase not initialized - cannot process payment webhooks');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

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

      // Handle transfers to creator Connect accounts
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        await handleTransferCreated(transfer)
        break
      }

      case 'transfer.updated': {
        const transfer = event.data.object as Stripe.Transfer
        // For now, we'll assume transfers are successful when created
        // In a production environment, you'd track transfer status via balance transactions
        console.log(`[Transfer Updated] Transfer ${transfer.id} updated for $${transfer.amount/100}`)
        break
      }

      // Handle Connect account updates
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        await handleAccountUpdated(account)
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
    if (!supabase) {
      console.error('[Webhook] Cannot process payment success - Supabase not initialized');
      return;
    }

    const {
      userId,
      packageId,
      creditsAmount,
      bonusCredits,
      storyId,
      creatorId,
      purchaseType,
      chaptersUnlocked
    } = paymentIntent.metadata

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

    // Handle different payment types
    if (storyId && creatorId) {
      // This is a story purchase - handle creator revenue splitting
      await handleStoryPurchase({
        paymentIntent,
        userId,
        storyId,
        creatorId,
        purchaseType: purchaseType as 'chapter' | 'bundle' | 'premium_unlock',
        chaptersUnlocked: chaptersUnlocked ? JSON.parse(chaptersUnlocked) : []
      })
    } else if (creditsAmount) {
      // This is a credit package purchase
      await handleCreditPurchase({
        paymentIntent,
        userId,
        creditsAmount: parseInt(creditsAmount),
        bonusCredits: parseInt(bonusCredits || '0')
      })
    }

    console.log(`Payment processed successfully for user ${userId}`)

  } catch (error) {
    console.error('Payment success handling error:', error)
  }
}

// Handle story purchases with automatic creator revenue splitting
async function handleStoryPurchase({
  paymentIntent,
  userId,
  storyId,
  creatorId,
  purchaseType,
  chaptersUnlocked
}: {
  paymentIntent: Stripe.PaymentIntent
  userId: string
  storyId: string
  creatorId: string
  purchaseType: 'chapter' | 'bundle' | 'premium_unlock'
  chaptersUnlocked: number[]
}) {
  if (!supabase) return

  const amountInCents = paymentIntent.amount
  const amountInUSD = amountInCents / 100

  // Calculate 70/30 split (70% to creator, 30% to platform)
  const creatorShare = Math.floor(amountInCents * 0.7) // 70% to creator
  const platformFee = amountInCents - creatorShare // 30% to platform

  console.log(`[Revenue Split] Total: $${amountInUSD}, Creator: $${creatorShare/100}, Platform: $${platformFee/100}`)

  try {
    // Get creator's Stripe Connect account
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, is_creator')
      .eq('id', creatorId)
      .single()

    if (!creatorProfile || !(creatorProfile as any).stripe_connect_account_id) {
      console.error(`[Revenue Split] Creator ${creatorId} has no Connect account - manual payout required`)
      await recordManualPayoutRequired(creatorId, storyId, creatorShare, paymentIntent.id)
      return
    }

    // Create story purchase record
    const { error: purchaseError } = await (supabase as any)
      .from('story_purchases')
      .insert({
        user_id: userId,
        story_id: storyId,
        creator_id: creatorId,
        purchase_type: purchaseType,
        chapters_unlocked: chaptersUnlocked,
        credits_spent: 0, // If using direct payments
        creator_earnings: creatorShare / 100 // Store in USD
      })

    if (purchaseError) {
      console.error('Story purchase record error:', purchaseError)
    }

    // Attempt automatic transfer to creator
    await transferToCreator({
      creatorConnectAccountId: (creatorProfile as any).stripe_connect_account_id,
      amountInCents: creatorShare,
      creatorId,
      storyId,
      paymentIntentId: paymentIntent.id,
      description: `Story earnings: ${purchaseType} purchase`
    })

  } catch (error) {
    console.error('[Revenue Split] Error processing story purchase:', error)
    // Record manual payout requirement if automated transfer fails
    await recordManualPayoutRequired(creatorId, storyId, creatorShare, paymentIntent.id)
  }
}

// Handle credit package purchases
async function handleCreditPurchase({
  paymentIntent,
  userId,
  creditsAmount,
  bonusCredits
}: {
  paymentIntent: Stripe.PaymentIntent
  userId: string
  creditsAmount: number
  bonusCredits: number
}) {
  if (!supabase) return

  // Get current user balance
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('credits_balance, credits_earned_total')
    .eq('id', userId)
    .single()

  if (!profile) {
    console.error('User profile not found:', userId)
    return
  }

  const totalCredits = creditsAmount + bonusCredits
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
  const { error: transactionError } = await (supabase as any)
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
}

// Automatically transfer earnings to creator's Connect account
async function transferToCreator({
  creatorConnectAccountId,
  amountInCents,
  creatorId,
  storyId,
  paymentIntentId,
  description
}: {
  creatorConnectAccountId: string
  amountInCents: number
  creatorId: string
  storyId: string
  paymentIntentId: string
  description: string
}) {
  try {
    // Verify the Connect account is active
    const account = await stripe.accounts.retrieve(creatorConnectAccountId)

    if (!account.charges_enabled || !account.payouts_enabled) {
      console.error(`[Transfer] Creator account ${creatorConnectAccountId} not ready for transfers`)
      await recordManualPayoutRequired(creatorId, storyId, amountInCents, paymentIntentId)
      return
    }

    // Create transfer to creator's Connect account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'usd',
      destination: creatorConnectAccountId,
      description: description,
      metadata: {
        creator_id: creatorId,
        story_id: storyId,
        payment_intent_id: paymentIntentId,
        transfer_type: 'automated_creator_earnings'
      }
    })

    console.log(`[Transfer] Successfully created transfer ${transfer.id} for $${amountInCents/100} to creator ${creatorId}`)

    // Record the transfer in our database
    await recordAutomatedTransfer({
      transferId: transfer.id,
      creatorId,
      storyId,
      amountInCents,
      paymentIntentId,
      status: 'created'
    })

  } catch (error) {
    console.error('[Transfer] Failed to create transfer to creator:', error)

    // Record manual payout requirement if transfer fails
    await recordManualPayoutRequired(creatorId, storyId, amountInCents, paymentIntentId)

    // If it's a Stripe error, log specific details
    if (error instanceof Stripe.errors.StripeError) {
      console.error(`[Transfer] Stripe error: ${error.type} - ${error.message}`)
    }
  }
}

// Record successful automated transfer
async function recordAutomatedTransfer({
  transferId,
  creatorId,
  storyId,
  amountInCents,
  paymentIntentId,
  status
}: {
  transferId: string
  creatorId: string
  storyId: string
  amountInCents: number
  paymentIntentId: string
  status: 'created' | 'paid' | 'failed'
}) {
  if (!supabase) return

  try {
    // Record in creator_earnings table
    const { error: earningsError } = await (supabase as any)
      .from('creator_earnings')
      .insert({
        creator_id: creatorId,
        story_id: storyId,
        reader_id: paymentIntentId, // Using payment intent as reader reference
        credits_earned: 0, // Direct USD payment, not credits
        usd_equivalent: amountInCents / 100,
        transaction_id: transferId
      })

    if (earningsError) {
      console.error('Error recording creator earnings:', earningsError)
    }

    // Update creator's total earnings
    const { data: currentProfile } = await (supabase as any)
      .from('profiles')
      .select('total_earnings_usd, pending_payout_usd')
      .eq('id', creatorId)
      .single()

    if (currentProfile) {
      const newTotalEarnings = ((currentProfile as any).total_earnings_usd || 0) + (amountInCents / 100)
      const newPendingPayout = status === 'paid'
        ? Math.max(0, ((currentProfile as any).pending_payout_usd || 0) - (amountInCents / 100))
        : ((currentProfile as any).pending_payout_usd || 0) + (amountInCents / 100)

      await (supabase as any)
        .from('profiles')
        .update({
          total_earnings_usd: newTotalEarnings,
          pending_payout_usd: newPendingPayout
        })
        .eq('id', creatorId)
    }

    console.log(`[Transfer] Recorded ${status} transfer for creator ${creatorId}: $${amountInCents/100}`)

  } catch (error) {
    console.error('Error recording automated transfer:', error)
  }
}

// Record when manual payout is required (fallback for failed automated transfers)
async function recordManualPayoutRequired(
  creatorId: string,
  storyId: string,
  amountInCents: number,
  paymentIntentId: string
) {
  if (!supabase) return

  try {
    // Record in creator_earnings with manual flag
    await (supabase as any)
      .from('creator_earnings')
      .insert({
        creator_id: creatorId,
        story_id: storyId,
        reader_id: paymentIntentId,
        credits_earned: 0,
        usd_equivalent: amountInCents / 100,
        transaction_id: `manual_required_${paymentIntentId}`
      })

    // Update pending payout amount
    const { data: currentProfile } = await (supabase as any)
      .from('profiles')
      .select('pending_payout_usd')
      .eq('id', creatorId)
      .single()

    if (currentProfile) {
      const newPendingPayout = ((currentProfile as any).pending_payout_usd || 0) + (amountInCents / 100)

      await (supabase as any)
        .from('profiles')
        .update({ pending_payout_usd: newPendingPayout })
        .eq('id', creatorId)
    }

    console.log(`[Manual Payout] Recorded manual payout requirement for creator ${creatorId}: $${amountInCents/100}`)

  } catch (error) {
    console.error('Error recording manual payout requirement:', error)
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    if (!supabase) {
      console.error('[Webhook] Cannot process payment failure - Supabase not initialized');
      return;
    }

    const { error } = await (supabase as any)
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

// Handle successful transfer creation
async function handleTransferCreated(transfer: Stripe.Transfer) {
  if (!supabase) return

  try {
    const { creator_id, story_id, payment_intent_id } = transfer.metadata

    if (creator_id && story_id) {
      await recordAutomatedTransfer({
        transferId: transfer.id,
        creatorId: creator_id,
        storyId: story_id,
        amountInCents: transfer.amount,
        paymentIntentId: payment_intent_id,
        status: 'created'
      })

      console.log(`[Transfer Created] Transfer ${transfer.id} created for creator ${creator_id}: $${transfer.amount/100}`)
    }
  } catch (error) {
    console.error('[Transfer Created] Error handling transfer creation:', error)
  }
}

// Handle successful transfer completion (funds delivered to creator)
async function handleTransferPaid(transfer: Stripe.Transfer) {
  if (!supabase) return

  try {
    const { creator_id, story_id, payment_intent_id } = transfer.metadata

    if (creator_id && story_id) {
      // Update transfer status to paid
      await recordAutomatedTransfer({
        transferId: transfer.id,
        creatorId: creator_id,
        storyId: story_id,
        amountInCents: transfer.amount,
        paymentIntentId: payment_intent_id,
        status: 'paid'
      })

      // Update creator's pending payout amount (reduce by paid amount)
      const { data: currentProfile } = await (supabase as any)
        .from('profiles')
        .select('pending_payout_usd')
        .eq('id', creator_id)
        .single()

      if (currentProfile) {
        const newPendingPayout = Math.max(0, ((currentProfile as any).pending_payout_usd || 0) - (transfer.amount / 100))

        await (supabase as any)
          .from('profiles')
          .update({ pending_payout_usd: newPendingPayout })
          .eq('id', creator_id)
      }

      console.log(`[Transfer Paid] Transfer ${transfer.id} completed for creator ${creator_id}: $${transfer.amount/100}`)
    }
  } catch (error) {
    console.error('[Transfer Paid] Error handling transfer completion:', error)
  }
}

// Handle failed transfers (fallback to manual payout)
async function handleTransferFailed(transfer: Stripe.Transfer) {
  if (!supabase) return

  try {
    const { creator_id, story_id, payment_intent_id } = transfer.metadata

    if (creator_id && story_id) {
      // Update transfer status to failed
      await recordAutomatedTransfer({
        transferId: transfer.id,
        creatorId: creator_id,
        storyId: story_id,
        amountInCents: transfer.amount,
        paymentIntentId: payment_intent_id,
        status: 'failed'
      })

      // Record manual payout requirement since automated transfer failed
      await recordManualPayoutRequired(creator_id, story_id, transfer.amount, payment_intent_id)

      console.log(`[Transfer Failed] Transfer ${transfer.id} failed for creator ${creator_id} - manual payout required: $${transfer.amount/100}`)
    }
  } catch (error) {
    console.error('[Transfer Failed] Error handling transfer failure:', error)
  }
}

// Handle Stripe Connect account updates
async function handleAccountUpdated(account: Stripe.Account) {
  if (!supabase) return

  try {
    // Find the creator profile associated with this Connect account
    const { data: creatorProfile } = await (supabase as any)
      .from('profiles')
      .select('id, is_creator')
      .eq('stripe_connect_account_id', account.id)
      .single()

    if (!creatorProfile) {
      console.log(`[Account Updated] No creator found for Connect account ${account.id}`)
      return
    }

    // Update the creator's account status based on Stripe account capabilities
    const accountStatus = account.charges_enabled && account.payouts_enabled
      ? 'active'
      : account.details_submitted
        ? 'pending'
        : 'incomplete'

    // Update creator profile with account status
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        stripe_account_status: accountStatus,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled
      })
      .eq('id', (creatorProfile as any).id)

    if (error) {
      console.error('[Account Updated] Error updating creator profile:', error)
    } else {
      console.log(`[Account Updated] Creator ${(creatorProfile as any).id} account status updated to ${accountStatus}`)
    }

    // If account just became active, process any pending manual payouts
    if (account.charges_enabled && account.payouts_enabled) {
      await processQueuedPayouts((creatorProfile as any).id, account.id)
    }

  } catch (error) {
    console.error('[Account Updated] Error handling account update:', error)
  }
}

// Process any queued manual payouts when creator account becomes active
async function processQueuedPayouts(creatorId: string, connectAccountId: string) {
  try {
    // Find any creator earnings that require manual payout
    const { data: queuedEarnings } = await (supabase as any)
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', creatorId)
      .like('transaction_id', 'manual_required_%')

    if (!queuedEarnings || queuedEarnings.length === 0) {
      return
    }

    console.log(`[Queued Payouts] Processing ${queuedEarnings.length} queued payouts for creator ${creatorId}`)

    // Process each queued payout
    for (const earning of queuedEarnings) {
      try {
        const amountInCents = Math.round(earning.usd_equivalent * 100)
        const paymentIntentId = earning.transaction_id.replace('manual_required_', '')

        await transferToCreator({
          creatorConnectAccountId: connectAccountId,
          amountInCents,
          creatorId,
          storyId: earning.story_id,
          paymentIntentId,
          description: `Queued payout: Story earnings`
        })

        // Mark this earning as processed
        await (supabase as any)
          .from('creator_earnings')
          .update({ transaction_id: `queued_processed_${paymentIntentId}` })
          .eq('id', earning.id)

      } catch (error) {
        console.error(`[Queued Payouts] Failed to process earning ${earning.id}:`, error)
      }
    }
  } catch (error) {
    console.error('[Queued Payouts] Error processing queued payouts:', error)
  }
}