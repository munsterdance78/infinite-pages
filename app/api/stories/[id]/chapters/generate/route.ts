import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { claudeService } from '@/lib/claude/service'
import { claudeCache } from '@/lib/claude/cache'
import { analyticsService } from '@/lib/claude/analytics'
import { rateLimiter } from '@/lib/rateLimit'
import { CREDIT_SYSTEM, ESTIMATED_CREDIT_COSTS } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

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

  // Authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const requestBody = await request.json()
    const {
      workflowPhase = 'generate',
      chapterGoals,
      previousContent,
      chapterNumber,
      targetWordCount = 2000,
      feedback
    } = requestBody

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

    // Get user profile for subscription tier and credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Rate limiting based on workflow phase
    const operationMap = {
      generate: 'CHAPTER_GENERATION',
      analyze: 'FACT_EXTRACTION',
      enhance: 'CONTENT_IMPROVEMENT'
    }

    const rateLimit = await rateLimiter.checkRateLimit(
      user.id,
      operationMap[workflowPhase as keyof typeof operationMap] || 'CHAPTER_GENERATION',
      profile.subscription_tier
    )

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 1000)} seconds.`
      }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
        }
      })
    }

    // Check credits based on workflow phase
    const creditCosts = {
      generate: ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION || 15,
      analyze: ESTIMATED_CREDIT_COSTS.FACT_EXTRACTION || 12,
      enhance: ESTIMATED_CREDIT_COSTS.CHAPTER_IMPROVEMENT || 8
    }

    const estimatedCost = creditCosts[workflowPhase as keyof typeof creditCosts] || 15
    if (profile.tokens_remaining < estimatedCost) {
      return NextResponse.json({
        error: `Insufficient credits (${estimatedCost} credits required for ${workflowPhase})`
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Enhanced workflow with SFSL integration
    switch (workflowPhase) {
      case 'generate':
        // Get hierarchical facts from cache for optimized context
        const factHierarchy = await claudeCache.getOptimizedFactContext(params.id)

        // Prepare chapter goals with enhanced context
        const enhancedChapterGoals = {
          number: chapterNumber || (story.chapters?.length || 0) + 1,
          targetWordCount,
          primaryGoal: chapterGoals?.primaryGoal || 'Advance story',
          secondaryGoal: chapterGoals?.secondaryGoal || 'Develop characters',
          plotAdvancement: chapterGoals?.plotAdvancement || 'Continue main arc',
          ...chapterGoals
        }

        // Use enhanced generation with fact context
        const generationResult = await claudeService.generateWithFactContext({
          storyId: params.id,
          chapterGoals: enhancedChapterGoals,
          factHierarchy
        })

        // Update user credits
        const generationCreditsUsed = Math.ceil(generationResult.cost * 1000)
        await supabase
          .from('profiles')
          .update({
            tokens_remaining: Math.max(0, profile.tokens_remaining - generationCreditsUsed),
            tokens_used_total: supabase.sql`tokens_used_total + ${generationCreditsUsed}`
          })
          .eq('id', user.id)

        // Cache the generated content for potential future use
        if (generationResult.content) {
          await claudeCache.cacheHierarchicalFacts(
            params.id,
            {
              chapterNumber: enhancedChapterGoals.number,
              content: generationResult.content,
              generatedAt: new Date().toISOString(),
              cost: generationResult.cost,
              factContext: factHierarchy
            },
            'chapter'
          )
        }

        return NextResponse.json({
          success: true,
          phase: 'generate',
          result: generationResult,
          nextPhase: 'analyze',
          metadata: {
            creditsUsed: generationCreditsUsed,
            processingTime: Date.now() - startTime,
            factContextUsed: Object.keys(factHierarchy).filter(k => factHierarchy[k] !== null),
            optimizations: generationResult.optimization || {}
          }
        })

      case 'analyze':
        if (!previousContent) {
          return NextResponse.json(
            { error: 'Previous content is required for analysis phase' },
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Extract facts and analyze consistency
        const extractionResult = await claudeService.extractAndCompressFacts({
          content: previousContent,
          storyContext: {
            storyId: params.id,
            userId: user.id,
            title: story.title,
            foundation: story.foundation
          },
          factType: 'chapter'
        })

        const consistencyResult = await claudeService.analyzeStoryConsistency(
          params.id,
          previousContent
        )

        // Update user credits for analysis
        const analysisCreditsUsed = Math.ceil((extractionResult.cost + consistencyResult.cost) * 1000)
        await supabase
          .from('profiles')
          .update({
            tokens_remaining: Math.max(0, profile.tokens_remaining - analysisCreditsUsed),
            tokens_used_total: supabase.sql`tokens_used_total + ${analysisCreditsUsed}`
          })
          .eq('id', user.id)

        // Store extracted facts in cache
        await claudeCache.cacheHierarchicalFacts(
          params.id,
          extractionResult.facts,
          'chapter'
        )

        // Track analytics for fact extraction
        await analyticsService.trackFactExtraction({
          userId: user.id,
          storyId: params.id,
          factType: 'chapter',
          compressionRatio: extractionResult.compressionRatio,
          extractionTime: Date.now() - startTime,
          cost: extractionResult.cost,
          creditsUsed: Math.ceil(extractionResult.cost * 1000),
          originalLength: previousContent.length,
          compressedLength: extractionResult.compressed.length
        })

        return NextResponse.json({
          success: true,
          phase: 'analyze',
          result: {
            extractedFacts: extractionResult,
            consistencyAnalysis: consistencyResult
          },
          nextPhase: 'enhance',
          metadata: {
            creditsUsed: analysisCreditsUsed,
            processingTime: Date.now() - startTime,
            compressionAchieved: extractionResult.compressionRatio,
            issuesFound: consistencyResult.content ? JSON.parse(consistencyResult.content).issues?.length || 0 : 0
          }
        })

      case 'enhance':
        if (!previousContent) {
          return NextResponse.json(
            { error: 'Previous content is required for enhancement phase' },
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Get story facts for context-aware enhancement
        const storyFacts = await claudeCache.getOptimizedFactContext(params.id)

        const enhancementResult = await claudeService.enhanceWithFactContext(
          previousContent,
          storyFacts,
          feedback || 'Improve based on story bible compliance and consistency'
        )

        // Update user credits for enhancement
        const enhancementCreditsUsed = Math.ceil(enhancementResult.cost * 1000)
        await supabase
          .from('profiles')
          .update({
            tokens_remaining: Math.max(0, profile.tokens_remaining - enhancementCreditsUsed),
            tokens_used_total: supabase.sql`tokens_used_total + ${enhancementCreditsUsed}`
          })
          .eq('id', user.id)

        return NextResponse.json({
          success: true,
          phase: 'enhance',
          result: enhancementResult,
          nextPhase: 'complete',
          metadata: {
            creditsUsed: enhancementCreditsUsed,
            processingTime: Date.now() - startTime,
            improvementType: 'fact_aware_enhancement',
            factContextUsed: Object.keys(storyFacts).filter(k => storyFacts[k] !== null)
          }
        })

      default:
        return NextResponse.json({
          error: 'Invalid workflow phase. Must be one of: generate, analyze, enhance'
        }, {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }

  } catch (error: any) {
    console.error('Enhanced chapter generation error:', error)

    // Track failed operation
    await analyticsService.trackOperation({
      userId: user.id,
      operation: `chapter_${requestBody.workflowPhase || 'generate'}`,
      model: 'sfsl_enhanced',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      responseTime: Date.now() - startTime,
      success: false,
      cached: false,
      error: error.message
    })

    return NextResponse.json(
      {
        error: 'Enhanced chapter generation failed',
        phase: requestBody.workflowPhase || 'generate',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// GET method to retrieve workflow status and cached results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    // Verify story ownership
    const { data: story } = await supabase
      .from('stories')
      .select('id, user_id, title')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get fact hierarchy context
    const factHierarchy = await claudeCache.getOptimizedFactContext(params.id)

    // Get cache statistics
    const cacheStats = claudeCache.getFactCacheStats()

    return NextResponse.json({
      storyId: params.id,
      factHierarchy,
      availableLevels: Object.keys(factHierarchy).filter(k => factHierarchy[k] !== null),
      cacheStats: {
        totalFactEntries: cacheStats.totalFactEntries,
        factEntriesByLevel: cacheStats.factEntriesByLevel
      },
      workflowCapabilities: {
        canGenerate: true,
        canAnalyze: factHierarchy.chapter !== null || factHierarchy.book !== null,
        canEnhance: factHierarchy.chapter !== null
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error retrieving chapter generation status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve chapter generation status' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}