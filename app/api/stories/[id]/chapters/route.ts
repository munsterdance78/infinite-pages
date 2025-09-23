import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { infinitePagesCache } from '@/lib/claude/infinitePagesCache'
import { CREDIT_SYSTEM, ESTIMATED_CREDIT_COSTS } from '@/lib/constants'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate Accept header to prevent 406 errors
  const acceptHeader = request.headers.get('accept')
  if (acceptHeader && !acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
    return NextResponse.json(
      { error: 'Not Acceptable - This endpoint only supports application/json' },
      {
        status: 406,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const { chapter_number, title } = await request.json()

    // Verify story ownership and get story data
    const { data: story } = await supabase
      .from('stories')
      .select('*, chapters(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check user tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, tokens_used_total, words_generated, tokens_saved_cache')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tokens_remaining < ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION) {
      return NextResponse.json({
        error: `Insufficient credits (${ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION} credits required for chapter generation)`
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // PRIORITY 2: Generate chapter with caching for 60% cost savings
    const targetWordCount = 2000 // Default target

    // Generate foundation fingerprint for dependency tracking
    const foundationFingerprint = infinitePagesCache.generateFoundationFingerprint(story.foundation)

    // Generate previous chapters hash for context matching
    const previousChapters = story.chapters || []
    const previousChaptersHash = infinitePagesCache.generatePreviousChaptersHash(
      previousChapters.map((ch: any) => ({ content: ch.content || '', summary: ch.summary || '' }))
    )

    let chapterResult
    let tokensSaved = 0
    let fromCache = false
    let cacheType = 'none'

    try {
      // Use chapter caching wrapper
      const cachedResult = await infinitePagesCache.wrapChapterGeneration(
        async () => {
          // OPTIMIZED: Use context optimizer for 70% token reduction
          const storyContext = {
            title: story.title,
            genre: story.genre,
            premise: story.premise,
            foundation: story.foundation,
            protagonist: story.foundation?.characters?.[0]?.name || 'protagonist'
          }

          const previousChaptersForOptimization = previousChapters.map((ch: any) => ({
            number: ch.chapter_number,
            content: ch.content,
            summary: ch.summary
          }))

          // Use Claude service with optimized context
          const { claudeService } = await import('@/lib/claude')
          const message = await claudeService.generateChapter({
            storyContext,
            chapterNumber: chapter_number,
            previousChapters: previousChaptersForOptimization,
            targetWordCount,
            useOptimizedContext: true,
            chapterPlan: {
              purpose: `Advance story to Chapter ${chapter_number}`,
              keyEvents: []
            }
          })

          // Claude service returns formatted response
          const chapterData = 'result' in message ? message.result : message as any
          const usage = 'usage' in message ? message.usage : { inputTokens: 0, outputTokens: 0 }

          return {
            title: chapterData.title || title || `Chapter ${chapter_number}`,
            content: chapterData.content || '',
            summary: chapterData.summary || '',
            wordCount: chapterData.wordCount || (chapterData.content || '').split(/\s+/).length,
            usage: usage,
            cost: 'cost' in message ? message.cost : 0
          }
        },
        chapter_number,
        params.id, // storyId
        foundationFingerprint,
        previousChaptersHash,
        story.genre as any,
        targetWordCount,
        user.id,
        story.title
      )

      chapterResult = cachedResult.result
      tokensSaved = cachedResult.tokensSaved
      fromCache = cachedResult.fromCache
      cacheType = cachedResult.cacheType || 'none'

      console.log(`[Chapter Generation] ${fromCache ? 'CACHE HIT' : 'NEW GENERATION'} - Chapter ${chapter_number}, Tokens saved: ${tokensSaved}, Type: ${cacheType}`)

    } catch (error) {
      console.error('Chapter generation error:', error)
      return NextResponse.json({ error: 'Failed to generate chapter' }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const chapterData = chapterResult
    const inputTokens = chapterResult.usage?.inputTokens || 0
    const outputTokens = chapterResult.usage?.outputTokens || 0
    const costUSD = chapterResult.cost || 0

    // Content moderation
    const isContentSafe = await moderateContent(chapterData.content || '')
    if (!isContentSafe) {
      return NextResponse.json({
        error: 'Generated content violates content policy'
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const wordCount = chapterData.wordCount || (chapterData.content || '').split(/\s+/).length

    // Calculate actual credits to deduct based on AI cost (no additional markup)
    const actualCreditsUsed = CREDIT_SYSTEM.convertCostToCredits(costUSD)

    // Create chapter
    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert({
        story_id: params.id,
        chapter_number,
        title: chapterData.title || title || `Chapter ${chapter_number}`,
        content: chapterData.content || '',
        summary: chapterData.summary || '',
        word_count: wordCount,
        tokens_used_input: inputTokens,
        tokens_used_output: outputTokens,
        generation_cost_usd: actualCreditsUsed * 0.001,
        prompt_type: fromCache ? `chapter_generation_cached_${cacheType}` : 'chapter_generation'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Update user tokens and story stats - account for cache savings
    await Promise.all([
      supabase
        .from('profiles')
        .update({
          tokens_remaining: profile.tokens_remaining - actualCreditsUsed,
          tokens_used_total: (profile.tokens_used_total || 0) + (inputTokens + outputTokens),
          words_generated: (profile.words_generated || 0) + wordCount,
          tokens_saved_cache: (profile.tokens_saved_cache || 0) + tokensSaved
        })
        .eq('id', user.id),

      supabase
        .from('stories')
        .update({
          total_tokens_used: (story.total_tokens_used || 0) + (inputTokens + outputTokens),
          total_cost_usd: (story.total_cost_usd || 0) + (actualCreditsUsed * 0.001),
          word_count: (story.word_count || 0) + wordCount,
          chapter_count: (story.chapter_count || 0) + 1
        })
        .eq('id', params.id),

      supabase
        .from('generation_logs')
        .insert({
          user_id: user.id,
          story_id: params.id,
          chapter_id: chapter.id,
          operation_type: 'chapter',
          tokens_input: inputTokens,
          tokens_output: outputTokens,
          cost_usd: actualCreditsUsed * 0.001
        })
    ])

    return NextResponse.json({
      chapter,
      tokensUsed: actualCreditsUsed,
      tokensSaved: tokensSaved,
      fromCache: fromCache,
      cacheType: cacheType,
      remainingTokens: profile.tokens_remaining - actualCreditsUsed,
      message: fromCache
        ? `Chapter ${chapter_number} generated successfully (${tokensSaved} tokens saved from cache)`
        : `Chapter ${chapter_number} generated successfully`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Chapter generation error:', error)
    return NextResponse.json({ error: 'Failed to generate chapter' }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600',
      'Content-Type': 'application/json'
    }
  })
}

async function moderateContent(content: string): Promise<boolean> {
  // Basic content moderation
  const prohibited = ['explicit sexual content', 'graphic violence', 'illegal activities']
  const lowerContent = content.toLowerCase()
  
  for (const term of prohibited) {
    if (lowerContent.includes(term)) {
      return false
    }
  }
  
  return true
}