import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-config'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const body = await request.json()
    const { dryRun = false } = body

    console.log('Processing credit reversion for basic tier users...')

    // Get all basic tier users with excess credits
    const maxBasicCredits = SUBSCRIPTION_TIERS.basic.max_credit_balance
    const { data: basicUsers } = await supabase
      .from('profiles')
      .select('id, email, credits_balance, subscription_tier')
      .eq('subscription_tier', 'basic')
      .gt('credits_balance', maxBasicCredits)

    if (!basicUsers || basicUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No basic tier users with excess credits found',
        processed: 0,
        dryRun
      })
    }

    console.log(`Found ${basicUsers.length} basic tier users with excess credits`)

    const reversionResults = []
    let totalCreditsReverted = 0

    for (const user of basicUsers) {
      const excessCredits = user.credits_balance - maxBasicCredits
      const result = {
        userId: user.id,
        email: user.email,
        currentBalance: user.credits_balance,
        maxAllowed: maxBasicCredits,
        excessCredits,
        newBalance: maxBasicCredits
      }

      reversionResults.push(result)
      totalCreditsReverted += excessCredits

      if (!dryRun) {
        // Update user's credit balance to the maximum allowed
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            credits_balance: maxBasicCredits
          })
          .eq('id', user.id)

        if (updateError) {
          console.error(`Failed to revert credits for user ${user.id}:`, updateError)
          continue
        }

        // Record the credit reversion transaction
        const { error: transactionError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: user.id,
            amount: -excessCredits, // Negative amount for deduction
            transaction_type: 'credit_reversion',
            description: 'Basic tier credit limit enforcement - excess credits reverted',
            metadata: {
              previous_balance: user.credits_balance,
              new_balance: maxBasicCredits,
              excess_credits: excessCredits,
              max_allowed: maxBasicCredits,
              reason: 'basic_tier_limit_exceeded'
            }
          })

        if (transactionError) {
          console.error(`Failed to record reversion transaction for user ${user.id}:`, transactionError)
        }
      }
    }

    const summary = {
      totalUsersProcessed: reversionResults.length,
      totalCreditsReverted,
      averageCreditsRevertedPerUser: reversionResults.length > 0 ? Math.round(totalCreditsReverted / reversionResults.length) : 0,
      dryRun
    }

    console.log('Credit reversion complete:', summary)

    return NextResponse.json({
      success: true,
      summary,
      details: reversionResults.slice(0, 50), // Limit response size
      message: dryRun
        ? 'Dry run completed - no credits were actually reverted'
        : 'Credit reversion completed successfully'
    })

  } catch (error) {
    console.error('Credit reversion endpoint error:', error)
    return NextResponse.json({ error: 'Failed to revert excess credits' }, { status: 500 })
  }
}

// Get reversion history
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    // Get recent credit reversion transactions
    const { data: reversions } = await supabase
      .from('credit_transactions')
      .select(`
        created_at,
        amount,
        metadata,
        profiles (email, subscription_tier)
      `)
      .eq('transaction_type', 'credit_reversion')
      .order('created_at', { ascending: false })
      .limit(500)

    // Calculate summary statistics
    const totalReversions = reversions?.length || 0
    const totalCreditsReverted = reversions?.reduce((sum, r) => sum + Math.abs(r.amount), 0) || 0

    return NextResponse.json({
      reversionHistory: reversions || [],
      summary: {
        totalReversions,
        totalCreditsReverted,
        averageCreditsPerReversion: totalReversions > 0 ? Math.round(totalCreditsReverted / totalReversions) : 0
      }
    })

  } catch (error) {
    console.error('Reversion history endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch reversion history' }, { status: 500 })
  }
}