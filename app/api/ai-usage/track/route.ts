import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { calculateActualCost } from '@/lib/ai-cost-calculator'
import type { Database } from '@/lib/supabase/types'

interface TrackingRequest {
  operation_type: 'foundation' | 'character' | 'cover' | 'chapter' | 'improvement'
  tokens_input: number
  tokens_output: number
  ai_model_used: string
  story_id?: string
  chapter_id?: string
  generation_time_seconds: number
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const trackingData: TrackingRequest = await request.json()

    // Calculate exact costs with 20% markup
    const modelType = trackingData.ai_model_used.includes('claude') ? 'claude-3-sonnet' :
                     trackingData.ai_model_used.includes('gpt') ? 'gpt-4' :
                     'claude-3-sonnet' // default

    const { actualCost, chargedAmount } = calculateActualCost(
      trackingData.tokens_input,
      trackingData.tokens_output,
      modelType
    )

    // Save to AI usage logs
    const { error: loggingError } = await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: user.id,
        operation_type: trackingData.operation_type,
        tokens_input: trackingData.tokens_input,
        tokens_output: trackingData.tokens_output,
        actual_cost_usd: actualCost,
        charged_amount_usd: chargedAmount,
        markup_percentage: 20,
        ai_model_used: trackingData.ai_model_used,
        story_id: trackingData.story_id || null,
        chapter_id: trackingData.chapter_id || null,
        generation_time_seconds: trackingData.generation_time_seconds
      })

    if (loggingError) {
      console.error('AI usage logging error:', loggingError)
      // Don't fail the request if logging fails
    }

    // Update the existing generation_logs table for compatibility
    const { error: compatError } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        story_id: trackingData.story_id || null,
        chapter_id: trackingData.chapter_id || null,
        operation_type: trackingData.operation_type,
        tokens_input: trackingData.tokens_input,
        tokens_output: trackingData.tokens_output,
        cost_usd: chargedAmount // Use charged amount for backward compatibility
      })

    if (compatError) {
      console.error('Generation logs compatibility error:', compatError)
    }

    return NextResponse.json({
      success: true,
      actual_cost: actualCost,
      charged_amount: chargedAmount,
      markup_percentage: 20,
      tokens_total: trackingData.tokens_input + trackingData.tokens_output
    })

  } catch (error) {
    console.error('AI usage tracking error:', error)
    return NextResponse.json({ error: 'Failed to track AI usage' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'current_month'

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        break
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get usage data
    const { data: usageLogs, error } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Usage fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
    }

    // Aggregate the data
    const summary = {
      total_operations: usageLogs?.length || 0,
      total_tokens: usageLogs?.reduce((sum, log) => sum + log.tokens_input + log.tokens_output, 0) || 0,
      total_cost: usageLogs?.reduce((sum, log) => sum + log.actual_cost_usd, 0) || 0,
      total_charged: usageLogs?.reduce((sum, log) => sum + log.charged_amount_usd, 0) || 0,
      by_operation: usageLogs?.reduce((acc, log) => {
        if (!acc[log.operation_type]) {
          acc[log.operation_type] = {
            count: 0,
            tokens: 0,
            cost: 0,
            charged: 0
          }
        }
        acc[log.operation_type].count++
        acc[log.operation_type].tokens += log.tokens_input + log.tokens_output
        acc[log.operation_type].cost += log.actual_cost_usd
        acc[log.operation_type].charged += log.charged_amount_usd
        return acc
      }, {} as Record<string, any>) || {}
    }

    return NextResponse.json({
      period,
      summary,
      detailed_logs: usageLogs?.slice(0, 50) || [] // Return last 50 for detailed view
    })

  } catch (error) {
    console.error('Usage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}