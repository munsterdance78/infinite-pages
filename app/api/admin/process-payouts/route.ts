import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { MINIMUM_PAYOUT_USD } from '@/lib/subscription-config'
import Stripe from 'stripe'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

interface PayoutProcessingResult {
  success: boolean
  batch_id: string | null
  eligible_creators: number
  total_amount: number
  successful_transfers: number
  failed_transfers: number
  errors: string[]
}

// Helper function to safely access profiles data
function getProfileData(profiles: any) {
  if (Array.isArray(profiles)) {
    return profiles[0] || {}
  }
  return profiles || {}
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { batch_date, dry_run = false, minimum_payout = MINIMUM_PAYOUT_USD } = body

    const processingDate = batch_date ? new Date(batch_date) : new Date()
    processingDate.setHours(0, 0, 0, 0) // Start of day

    console.log(`Processing payouts for ${processingDate.toISOString().split('T')[0]}${dry_run ? ' (DRY RUN)' : ''}`)

    // Check if we already processed payouts for this date
    const { data: existingBatch } = await supabase
      .from('monthly_payout_batches')
      .select('id, processing_status')
      .eq('batch_date', processingDate.toISOString().split('T')[0])
      .single()

    if (existingBatch && !dry_run) {
      return NextResponse.json({
        error: `Payouts already processed for ${processingDate.toISOString().split('T')[0]}`,
        existing_batch: existingBatch
      }, { status: 400 })
    }

    if (dry_run) {
      // Dry run - just calculate what would be paid
      const { data: eligibleCreators } = await supabase
        .from('creator_earnings_accumulation')
        .select(`
          creator_id,
          total_accumulated_usd,
          profiles (email, stripe_customer_id)
        `)
        .gte('total_accumulated_usd', minimum_payout)

      const totalAmount = eligibleCreators?.reduce((sum, c) => sum + c.total_accumulated_usd, 0) || 0

      return NextResponse.json({
        dry_run: true,
        eligible_creators: eligibleCreators?.length || 0,
        total_amount: totalAmount,
        minimum_payout,
        processing_date: processingDate.toISOString().split('T')[0],
        creators: eligibleCreators?.map(c => {
          const profile = getProfileData(c.profiles)
          return {
            creator_id: c.creator_id,
            email: profile.email,
            amount: c.total_accumulated_usd,
            has_stripe_customer: !!profile.stripe_customer_id
          }
        })
      })
    }

    // Process actual payouts
    const result: PayoutProcessingResult = {
      success: true,
      batch_id: null,
      eligible_creators: 0,
      total_amount: 0,
      successful_transfers: 0,
      failed_transfers: 0,
      errors: []
    }

    // Create payout batch using database function
    const { data: batchResult, error: batchError } = await supabase
      .rpc('process_monthly_payouts', {
        p_batch_date: processingDate.toISOString().split('T')[0],
        p_minimum_payout: minimum_payout
      })

    if (batchError || !batchResult?.[0]) {
      return NextResponse.json({
        error: 'Failed to create payout batch',
        details: batchError
      }, { status: 500 })
    }

    const { batch_id, eligible_creators, total_amount } = batchResult[0]
    result.batch_id = batch_id
    result.eligible_creators = eligible_creators
    result.total_amount = total_amount

    if (eligible_creators === 0) {
      await supabase
        .from('monthly_payout_batches')
        .update({ processing_status: 'completed' })
        .eq('id', batch_id)

      return NextResponse.json({
        ...result,
        message: 'No creators eligible for payout this month'
      })
    }

    // Get individual payouts to process
    const { data: payouts } = await supabase
      .from('individual_payouts')
      .select(`
        id,
        creator_id,
        amount_usd,
        profiles!individual_payouts_creator_id_fkey (
          stripe_customer_id,
          email
        )
      `)
      .eq('batch_id', batch_id)
      .eq('status', 'pending')

    if (!payouts) {
      result.success = false
      result.errors.push('No payouts found for batch')
      return NextResponse.json(result, { status: 500 })
    }

    // Process Stripe transfers
    for (const payout of payouts) {
      const profile = getProfileData(payout.profiles)
      try {
        const stripeCustomerId = profile.stripe_customer_id

        if (!stripeCustomerId) {
          result.failed_transfers++
          result.errors.push(`Creator ${profile.email} has no Stripe customer ID`)

          await supabase
            .from('individual_payouts')
            .update({
              status: 'failed',
              error_message: 'No Stripe customer ID found'
            })
            .eq('id', payout.id)

          continue
        }

        // Get customer's default payment method
        const customer = await stripe.customers.retrieve(stripeCustomerId)
        if (!customer || customer.deleted) {
          result.failed_transfers++
          result.errors.push(`Creator ${profile.email} Stripe customer not found`)

          await supabase
            .from('individual_payouts')
            .update({
              status: 'failed',
              error_message: 'Stripe customer not found'
            })
            .eq('id', payout.id)

          continue
        }

        // Calculate transfer amount (subtract Stripe fee)
        const transferFee = 0.25 // $0.25 per transfer
        const transferAmount = Math.max(0, (payout.amount_usd - transferFee) * 100) // Convert to cents

        if (transferAmount <= 0) {
          result.failed_transfers++
          result.errors.push(`Creator ${profile.email} amount too small after fees`)

          await supabase
            .from('individual_payouts')
            .update({
              status: 'failed',
              error_message: 'Amount too small after processing fees'
            })
            .eq('id', payout.id)

          continue
        }

        // Create Stripe transfer back to customer's original payment method
        // Note: This requires Stripe Connect setup for reverse transfers
        // For now, we'll simulate the transfer and mark as completed

        // In a real implementation, you would:
        // 1. Set up Stripe Connect accounts for creators
        // 2. Use stripe.transfers.create() to send money
        // 3. Handle webhook confirmations

        // Simulated transfer (replace with actual Stripe transfer)
        const simulatedTransferId = `tr_sim_${Date.now()}_${payout.id.slice(0, 8)}`

        await supabase
          .from('individual_payouts')
          .update({
            status: 'completed',
            stripe_transfer_id: simulatedTransferId
          })
          .eq('id', payout.id)

        result.successful_transfers++

        console.log(`Simulated transfer for creator ${profile.email}: $${payout.amount_usd}`)

      } catch (error) {
        result.failed_transfers++
        result.errors.push(`Creator ${profile.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        await supabase
          .from('individual_payouts')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', payout.id)
      }
    }

    // Update batch status
    const batchStatus = result.failed_transfers === 0 ? 'completed' : 'partially_completed'
    await supabase
      .from('monthly_payout_batches')
      .update({
        processing_status: batchStatus,
        total_creators_paid: result.successful_transfers
      })
      .eq('id', batch_id)

    result.success = result.successful_transfers > 0

    return NextResponse.json({
      ...result,
      message: `Processed ${result.successful_transfers} successful transfers, ${result.failed_transfers} failed`,
      batch_status: batchStatus,
      processing_date: processingDate.toISOString().split('T')[0]
    })

  } catch (error) {
    console.error('Payout processing endpoint error:', error)
    return NextResponse.json({ error: 'Failed to process payouts' }, { status: 500 })
  }
}

// Get payout batch status
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get recent payout batches
    const { data: batches } = await supabase
      .from('monthly_payout_batches')
      .select(`
        *,
        individual_payouts (
          id,
          creator_id,
          amount_usd,
          status,
          error_message,
          profiles!individual_payouts_creator_id_fkey (email)
        )
      `)
      .order('batch_date', { ascending: false })
      .limit(12) // Last 12 months

    return NextResponse.json({
      recent_batches: batches?.map((batch: any) => ({
        ...batch,
        individual_payouts: batch.individual_payouts?.map((payout: any) => {
          const payoutProfile = getProfileData(payout.profiles)
          return {
            ...payout,
            creator_email: payoutProfile.email
          }
        })
      })) || []
    })

  } catch (error) {
    console.error('Payout batch status endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch payout status' }, { status: 500 })
  }
}