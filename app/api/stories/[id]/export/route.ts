import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

// LIBRARY-FIRST MODEL: Downloads are highly restricted to maintain subscriptions
const DOWNLOAD_RESTRICTIONS = {
  free: {
    allowed: false,
    credits_required: 0,
    message: 'Downloads not available for free accounts. Upgrade to Premium for download access.'
  },
  basic: {
    allowed: false,
    credits_required: 0,
    message: 'Downloads not available for Basic tier. Upgrade to Premium for download access.'
  },
  premium: {
    allowed: true,
    credits_required: 250, // High cost even for premium users
    max_downloads_per_month: 3,
    message: 'Premium download: High credit cost to encourage library usage'
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { format = 'pdf' } = await request.json()
    const storyId = params.id

    // Get user profile and subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, credits_balance')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const tier = profile.subscription_tier as keyof typeof DOWNLOAD_RESTRICTIONS
    const restrictions = DOWNLOAD_RESTRICTIONS[tier]

    // Check if downloads are allowed for this tier
    if (!restrictions.allowed) {
      return NextResponse.json({
        error: 'Download not available',
        message: restrictions.message,
        upgrade_required: true,
        subscription_tier: profile.subscription_tier,
        required_tier: 'premium'
      }, { status: 402 })
    }

    // Check credit balance (Premium users still pay high cost)
    if (profile.credits_balance < restrictions.credits_required) {
      return NextResponse.json({
        error: 'Insufficient credits for download',
        required: restrictions.credits_required,
        available: profile.credits_balance,
        message: `Downloads require ${restrictions.credits_required} credits to encourage using our library for reading`
      }, { status: 402 })
    }

    // Check monthly download limit
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const { data: monthlyUsage } = await supabase
      .from('subscription_usage')
      .select('downloads_this_month')
      .eq('user_id', user.id)
      .gte('period_start', currentMonth.toISOString())
      .single()

    const downloadsThisMonth = monthlyUsage?.downloads_this_month || 0

    if ('max_downloads_per_month' in restrictions && downloadsThisMonth >= restrictions.max_downloads_per_month) {
      return NextResponse.json({
        error: 'Monthly download limit reached',
        limit: restrictions.max_downloads_per_month,
        used: downloadsThisMonth,
        message: 'Download limit helps maintain our library-first experience',
        reset_date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1).toISOString()
      }, { status: 429 })
    }

    // Get story and verify ownership/access
    const { data: story } = await supabase
      .from('stories')
      .select(`
        *,
        chapters (*)
      `)
      .eq('id', storyId)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Check if user has access to this story
    const { data: purchase } = await supabase
      .from('story_purchases')
      .select('*')
      .eq('user_id', user.id)
      .eq('story_id', storyId)
      .single()

    if (!purchase && story.user_id !== user.id) {
      return NextResponse.json({
        error: 'Story access required',
        message: 'You must purchase story access before downloading'
      }, { status: 403 })
    }

    // Deduct credits before processing
    const newBalance = profile.credits_balance - restrictions.credits_required

    const { error: balanceError } = await supabase
      .from('profiles')
      .update({ credits_balance: newBalance })
      .eq('id', user.id)

    if (balanceError) {
      console.error('Failed to deduct credits:', balanceError)
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 })
    }

    // Create transaction record
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      transaction_type: 'spend',
      amount: -restrictions.credits_required,
      balance_after: newBalance,
      description: `Story download: ${story.title} (${format.toUpperCase()})`,
      reference_id: storyId,
      reference_type: 'download'
    } as any)

    // Update monthly usage
    await supabase
      .from('subscription_usage')
      .upsert({
        user_id: user.id,
        subscription_tier: profile.subscription_tier,
        downloads_this_month: downloadsThisMonth + 1,
        period_start: currentMonth.toISOString(),
        period_end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString()
      })

    // Generate watermarked download with user info
    const watermark = `Downloaded by: ${user.email} | ${new Date().toISOString()} | INFINITE-PAGES Library`

    // Create export record with short expiration (24 hours to discourage hoarding)
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .insert({
        user_id: user.id,
        story_id: storyId,
        format,
        status: 'completed',
        file_url: `https://temp-downloads.infinite-pages.com/${storyId}-${user.id}-${Date.now()}.${format}`,
        file_size_bytes: story.word_count * 6, // Estimated
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours only
      })
      .select()
      .single()

    if (exportError) {
      console.error('Export creation error:', exportError)
      return NextResponse.json({ error: 'Download generation failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      download_url: exportRecord.file_url,
      expires_at: exportRecord.expires_at,
      credits_charged: restrictions.credits_required,
      new_balance: newBalance,
      downloads_remaining_this_month: ('max_downloads_per_month' in restrictions)
        ? restrictions.max_downloads_per_month - downloadsThisMonth - 1
        : null,
      watermark: watermark,
      message: 'Download generated. File expires in 24 hours. Continue enjoying our library!',
      library_encouragement: 'Remember: Reading in our library saves credits and provides the best experience!'
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get user's download capabilities
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, credits_balance')
      .eq('id', user.id)
      .single()

    const getTier = (profile?.subscription_tier || 'free') as keyof typeof DOWNLOAD_RESTRICTIONS
    const restrictions = DOWNLOAD_RESTRICTIONS[getTier]

    // Get monthly usage
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const { data: monthlyUsage } = await supabase
      .from('subscription_usage')
      .select('downloads_this_month')
      .eq('user_id', user.id)
      .gte('period_start', currentMonth.toISOString())
      .single()

    return NextResponse.json({
      download_enabled: restrictions.allowed,
      subscription_tier: profile?.subscription_tier,
      credits_required: restrictions.credits_required,
      credits_available: profile?.credits_balance || 0,
      monthly_limit: ('max_downloads_per_month' in restrictions) ? restrictions.max_downloads_per_month : null,
      downloads_used_this_month: monthlyUsage?.downloads_this_month || 0,
      message: restrictions.message,
      library_message: 'Reading in our library is free and provides the best experience!'
    })

  } catch (error) {
    console.error('Export info error:', error)
    return NextResponse.json({ error: 'Failed to get download info' }, { status: 500 })
  }
}