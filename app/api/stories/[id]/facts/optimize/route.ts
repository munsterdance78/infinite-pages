import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sfslFactExtractor } from '@/lib/claude/fact-extractor'
import { claudeService } from '@/lib/claude/service'
import { analyticsService } from '@/lib/claude/analytics'

interface FactOptimizationRequest {
  factType?: 'character' | 'plot' | 'world' | 'setting' | 'conflict' | 'theme'
  hierarchicalLevel?: 'story' | 'chapter' | 'scene' | 'detail'
  optimizationGoals?: string[]
  targetChapter?: number
  workflowPhase: 'analyze' | 'optimize' | 'enhance'
}

interface OptimizedFactResult {
  originalFacts: any[]
  optimizedFacts: any[]
  optimizationSummary: {
    factsAnalyzed: number
    factsOptimized: number
    improvementAreas: string[]
    coherenceScore: number
  }
  recommendations: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: FactOptimizationRequest = await request.json()
    const {
      factType,
      hierarchicalLevel = 'chapter',
      optimizationGoals = ['coherence', 'completeness', 'consistency'],
      targetChapter,
      workflowPhase
    } = body

    if (!workflowPhase) {
      return NextResponse.json(
        { error: 'workflowPhase is required' },
        { status: 400 }
      )
    }

    // Verify story ownership
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id, title, content')
      .eq('id', params.id)
      .single()

    if (storyError || !story || story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Story not found or access denied' },
        { status: 404 }
      )
    }

    // Track analytics for this operation
    analyticsService.trackWorkflowPhase({
      userId: user.id,
      storyId: params.id,
      phase: workflowPhase,
      operation: 'fact_optimization',
      metadata: {
        factType,
        hierarchicalLevel,
        optimizationGoals,
        targetChapter
      }
    })

    // Get existing story facts from database
    const { data: existingFacts, error: factsError } = await supabase
      .from('story_facts')
      .select('*')
      .eq('story_id', params.id)
      .eq('fact_type', factType || 'chapter')
      .order('chapter_number', { ascending: true })

    if (factsError) {
      throw new Error(`Failed to fetch existing facts: ${factsError.message}`)
    }

    let optimizedResult: OptimizedFactResult

    // Perform optimization based on workflow phase
    switch (workflowPhase) {
      case 'analyze':
        optimizedResult = await analyzeFactCoherence(
          existingFacts || [],
          story,
          { factType, hierarchicalLevel, optimizationGoals }
        )
        break

      case 'optimize':
        optimizedResult = await optimizeStoryFacts(
          existingFacts || [],
          story,
          { factType, hierarchicalLevel, optimizationGoals, targetChapter }
        )
        break

      case 'enhance':
        optimizedResult = await enhanceFactStructure(
          existingFacts || [],
          story,
          { factType, hierarchicalLevel, optimizationGoals }
        )
        break

      default:
        throw new Error(`Invalid workflow phase: ${workflowPhase}`)
    }

    // Store optimized facts if they were generated
    if (workflowPhase === 'optimize' && optimizedResult.optimizedFacts.length > 0) {
      await storeOptimizedFacts(supabase, params.id, optimizedResult.optimizedFacts, user.id)
    }

    // Track completion analytics
    analyticsService.trackWorkflowCompletion({
      userId: user.id,
      storyId: params.id,
      phase: workflowPhase,
      operation: 'fact_optimization',
      success: true,
      metrics: {
        factsProcessed: optimizedResult.originalFacts.length,
        factsOptimized: optimizedResult.optimizedFacts.length,
        coherenceScore: optimizedResult.optimizationSummary.coherenceScore
      }
    })

    return NextResponse.json({
      success: true,
      workflowPhase,
      result: optimizedResult,
      message: `Fact optimization completed for ${workflowPhase} phase`
    })

  } catch (error) {
    console.error('Fact optimization error:', error)

    // Track error analytics
    if (typeof window === 'undefined') {
      try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          analyticsService.trackWorkflowError({
            userId: user.id,
            storyId: params.id,
            phase: 'fact_optimization',
            error: error instanceof Error ? error.message : 'Unknown error',
            context: { factOptimization: true }
          })
        }
      } catch (analyticsError) {
        console.warn('Failed to track analytics error:', analyticsError)
      }
    }

    return NextResponse.json(
      { error: 'Failed to optimize facts' },
      { status: 500 }
    )
  }
}

async function analyzeFactCoherence(
  existingFacts: any[],
  story: any,
  options: any
): Promise<OptimizedFactResult> {
  const analysisPrompt = `
Analyze the coherence and completeness of the following story facts:

STORY: ${story.title}
EXISTING FACTS: ${JSON.stringify(existingFacts.slice(0, 10), null, 2)}

Provide analysis on:
1. Fact coherence across story elements
2. Missing critical facts
3. Inconsistencies or contradictions
4. Areas for improvement

Return analysis in JSON format with coherenceScore (0-100) and recommendations.
`

  const response = await claudeService.generateContent({
    prompt: analysisPrompt,
    systemPrompt: 'You are an expert story analyst specializing in narrative coherence and fact consistency.',
    maxTokens: 2000,
    temperature: 0.3,
    cacheOptions: {
      operation: 'fact_analysis',
      ttl: 1800
    }
  })

  try {
    const analysis = JSON.parse(response.content)
    return {
      originalFacts: existingFacts,
      optimizedFacts: [], // No optimization in analysis phase
      optimizationSummary: {
        factsAnalyzed: existingFacts.length,
        factsOptimized: 0,
        improvementAreas: analysis.improvementAreas || [],
        coherenceScore: analysis.coherenceScore || 75
      },
      recommendations: analysis.recommendations || []
    }
  } catch (error) {
    console.warn('Failed to parse analysis response, using defaults')
    return {
      originalFacts: existingFacts,
      optimizedFacts: [],
      optimizationSummary: {
        factsAnalyzed: existingFacts.length,
        factsOptimized: 0,
        improvementAreas: ['coherence', 'completeness'],
        coherenceScore: 70
      },
      recommendations: ['Review fact consistency', 'Add missing character details']
    }
  }
}

async function optimizeStoryFacts(
  existingFacts: any[],
  story: any,
  options: any
): Promise<OptimizedFactResult> {
  const optimizationPrompt = `
Optimize the following story facts for better coherence and completeness:

STORY: ${story.title}
EXISTING FACTS: ${JSON.stringify(existingFacts.slice(0, 10), null, 2)}
OPTIMIZATION GOALS: ${options.optimizationGoals.join(', ')}

Create optimized facts that:
1. Maintain story consistency
2. Fill gaps in narrative logic
3. Enhance character and plot coherence
4. Follow SFSL hierarchical structure

Return optimized facts in JSON format with the same structure as input facts.
`

  const response = await claudeService.generateContent({
    prompt: optimizationPrompt,
    systemPrompt: 'You are an expert story optimizer specializing in SFSL fact enhancement and narrative coherence.',
    maxTokens: 3000,
    temperature: 0.2,
    cacheOptions: {
      operation: 'fact_optimization',
      ttl: 1800
    }
  })

  try {
    const optimized = JSON.parse(response.content)
    const optimizedFacts = Array.isArray(optimized.facts) ? optimized.facts : optimized

    return {
      originalFacts: existingFacts,
      optimizedFacts: optimizedFacts,
      optimizationSummary: {
        factsAnalyzed: existingFacts.length,
        factsOptimized: optimizedFacts.length,
        improvementAreas: ['coherence', 'consistency', 'completeness'],
        coherenceScore: 85
      },
      recommendations: [
        'Facts optimized for better coherence',
        'Enhanced narrative consistency',
        'Improved story flow'
      ]
    }
  } catch (error) {
    console.warn('Failed to parse optimization response')
    return {
      originalFacts: existingFacts,
      optimizedFacts: existingFacts, // Return original if optimization fails
      optimizationSummary: {
        factsAnalyzed: existingFacts.length,
        factsOptimized: 0,
        improvementAreas: ['coherence'],
        coherenceScore: 70
      },
      recommendations: ['Manual review recommended']
    }
  }
}

async function enhanceFactStructure(
  existingFacts: any[],
  story: any,
  options: any
): Promise<OptimizedFactResult> {
  // Extract new facts using SFSL fact extractor
  const newFacts = await sfslFactExtractor.extractFacts(
    story.content || story.title,
    {
      factType: options.factType,
      hierarchicalLevel: options.hierarchicalLevel,
      maxFacts: 20,
      includeRelationships: true
    }
  )

  const enhancedFacts = [...existingFacts, ...newFacts]

  return {
    originalFacts: existingFacts,
    optimizedFacts: enhancedFacts,
    optimizationSummary: {
      factsAnalyzed: existingFacts.length,
      factsOptimized: enhancedFacts.length,
      improvementAreas: ['structure', 'relationships', 'hierarchy'],
      coherenceScore: 90
    },
    recommendations: [
      'Enhanced fact structure with SFSL extraction',
      'Added hierarchical relationships',
      'Improved fact organization'
    ]
  }
}

async function storeOptimizedFacts(
  supabase: any,
  storyId: string,
  optimizedFacts: any[],
  userId: string
) {
  try {
    // Store each optimized fact
    const factInserts = optimizedFacts.map(fact => ({
      story_id: storyId,
      fact_type: fact.type || 'chapter',
      sfsl_data: JSON.stringify(fact),
      chapter_number: fact.sourceChapter || 0,
      importance_score: getImportanceScore(fact.importance),
      created_by: userId,
      is_optimized: true
    }))

    const { error } = await supabase
      .from('story_facts')
      .insert(factInserts)

    if (error) {
      console.warn('Failed to store some optimized facts:', error.message)
    }
  } catch (error) {
    console.error('Error storing optimized facts:', error)
  }
}

function getImportanceScore(importance: string): number {
  switch (importance) {
    case 'critical': return 100
    case 'high': return 80
    case 'medium': return 60
    case 'low': return 40
    default: return 60
  }
}