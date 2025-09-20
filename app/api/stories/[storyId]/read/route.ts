import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { chapterIds, purchaseType = 'chapter' } = await request.json()
    const storyId = params.storyId

    // Get story and pricing info
    const { data: story } = await supabase
      .from('stories')
      .select(`
        *,
        story_pricing (*)
      `)
      .eq('id', storyId)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Check if user already has access to requested chapters
    const { data: existingPurchases } = await supabase
      .from('story_purchases')
      .select('chapters_unlocked')
      .eq('user_id', user.id)
      .eq('story_id', storyId)

    const alreadyUnlocked = new Set(
      existingPurchases?.flatMap(p => p.chapters_unlocked) || []
    )

    const newChapters = chapterIds.filter((id: number) => !alreadyUnlocked.has(id))

    if (newChapters.length === 0) {
      return NextResponse.json({
        message: 'All requested chapters already unlocked',
        accessGranted: true
      })
    }

    // Calculate pricing
    const pricing = story.story_pricing?.[0]
    let totalCost = 0
    let chaptersToUnlock = newChapters

    if (purchaseType === 'premium_unlock') {
      totalCost = pricing?.premium_unlock_price || 50
      // Get all chapter IDs for this story
      const { data: allChapters } = await supabase
        .from('chapters')
        .select('id')
        .eq('story_id', storyId)
        .order('chapter_number')

      chaptersToUnlock = allChapters?.map(c => c.id) || []
    } else if (purchaseType === 'bundle') {
      const basePrice = (pricing?.price_per_chapter || 5) * newChapters.length
      const discount = pricing?.bundle_discount || 0
      totalCost = Math.round(basePrice * (1 - discount / 100))
    } else {
      totalCost = (pricing?.price_per_chapter || 5) * newChapters.length
    }

    // Check cache for potential discount
    let cacheDiscount = 0
    let discountedCost = totalCost

    // Simple cache simulation - check if similar content was recently generated
    const { data: recentActivity } = await supabase
      .from('generation_logs')
      .select('*')
      .eq('story_id', storyId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(10)

    if (recentActivity && recentActivity.length > 3) {
      cacheDiscount = Math.floor(totalCost * 0.2) // 20% cache discount
      discountedCost = totalCost - cacheDiscount
    }

    // Check user balance
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('credits_balance, cache_hits')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.credits_balance < discountedCost) {
      return NextResponse.json({
        error: 'Insufficient credits',
        required: discountedCost,
        available: userProfile?.credits_balance || 0
      }, { status: 402 })
    }

    // Process payment in transaction
    const { error: transactionError } = await supabase.rpc('process_story_purchase', {
      p_user_id: user.id,
      p_story_id: storyId,
      p_creator_id: story.user_id,
      p_credits_spent: discountedCost,
      p_chapters_unlocked: chaptersToUnlock,
      p_purchase_type: purchaseType,
      p_cache_discount: cacheDiscount,
      p_original_cost: totalCost
    })

    if (transactionError) {
      console.error('Story purchase transaction error:', transactionError)
      return NextResponse.json({ error: 'Purchase failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      accessGranted: true,
      creditsSpent: discountedCost,
      chaptersUnlocked: chaptersToUnlock,
      cacheDiscount,
      message: cacheDiscount > 0
        ? `Purchase successful! You saved ${cacheDiscount} credits from cache optimization.`
        : 'Purchase successful!'
    })

  } catch (error) {
    console.error('Story read endpoint error:', error)
    return NextResponse.json({ error: 'Failed to process story access' }, { status: 500 })
  }
}