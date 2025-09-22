import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'
import { choiceBookGenerator } from '@/lib/choice-books/choice-generator'
import type { Database } from '@/lib/supabase/types'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ERROR_MESSAGES } from '@/lib/constants'

/**
 * POST /api/stories/choice-books
 * Create a new choice book foundation
 * Extends existing story creation for interactive books
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const {
      title,
      genre,
      premise,
      choiceComplexity = 'moderate',
      targetEndingCount = 3,
      estimatedLength = 10
    } = await request.json()

    if (!title || !genre || !premise) {
      return NextResponse.json({
        error: 'Title, genre, and premise are required'
      }, { status: 400 })
    }

    // Check user credits (choice books cost more to create)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Choice book foundation costs more due to complexity
    const foundationCostMap: Record<string, number> = {
      'simple': 15,
      'moderate': 25,
      'complex': 40
    }
    const foundationCost = foundationCostMap[choiceComplexity] || 25

    if (profile.credits_balance < foundationCost) {
      return NextResponse.json({
        error: 'Insufficient credits for choice book creation',
        required: foundationCost,
        available: profile.credits_balance
      }, { status: 402 })
    }

    // Generate choice book foundation using existing AI service
    const foundationPrompt = `Create a comprehensive choice book foundation for an interactive "${genre}" story:

PREMISE: "${premise}"
CHOICE COMPLEXITY: ${choiceComplexity}
TARGET ENDINGS: ${targetEndingCount}
ESTIMATED LENGTH: ${estimatedLength} chapters

Return structured JSON with:
{
  "title": "${title}",
  "genre": "${genre}",
  "premise": "${premise}",
  "mainCharacters": [
    {
      "name": "Character Name",
      "role": "protagonist/deuteragonist/antagonist/supporting",
      "description": "Character background and personality",
      "motivation": "Primary driving force",
      "arc": "Character development across choices",
      "choiceInfluence": "How this character affects/is affected by reader choices"
    }
  ],
  "setting": {
    "time": "Time period/era",
    "place": "Primary locations",
    "atmosphere": "Mood and tone",
    "worldbuilding": "World rules and unique aspects"
  },
  "choiceStructure": {
    "complexity": "${choiceComplexity}",
    "branchingStyle": "how choices branch and reconverge",
    "consequenceDepth": "how far choices affect the story",
    "endingTypes": ["possible ending categories"]
  },
  "plotStructure": {
    "opening": "Story setup and first choice",
    "majorChoicePoints": ["key decision moments"],
    "pathDivergence": "where stories split significantly",
    "reconvergence": "where paths come back together",
    "endingApproaches": ["how different endings are reached"]
  },
  "themes": ["Primary themes explored through choices"],
  "chapterOutline": [
    {
      "number": 1,
      "title": "Chapter title",
      "summary": "What happens in this chapter",
      "choicePoint": {
        "description": "The decision readers must make",
        "options": ["brief description of each choice"],
        "consequences": "What each choice leads toward"
      },
      "pathWeight": "linear/branching/reconverging"
    }
  ],
  "endingOutline": [
    {
      "id": "ending_1",
      "type": "happy/tragic/bittersweet/mysterious",
      "requirements": ["choices or paths needed"],
      "description": "Brief ending description",
      "rarity": "common/uncommon/rare/secret"
    }
  ]
}

Focus on meaningful choices that affect character development, plot progression, and multiple satisfying endings.`

    // Generate using existing AI service
    const { claudeService } = await import('@/lib/claude/service')
    const foundationResult = await claudeService.generateContent({
      prompt: foundationPrompt,
      operation: 'choice_book_foundation',
      maxTokens: 4000,
      useCache: true
    })

    // Parse the foundation
    let foundation
    try {
      foundation = JSON.parse(foundationResult.content)
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to parse generated foundation'
      }, { status: 500 })
    }

    // Create the choice book story record
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        title: foundation.title,
        genre: foundation.genre,
        premise: foundation.premise,
        foundation,
        outline: foundation.chapterOutline,
        characters: foundation.mainCharacters,
        status: 'draft',
        word_count: 0,
        chapter_count: 0,
        total_tokens_used: foundationResult.usage.totalTokens,
        total_cost_usd: foundationResult.cost
      })
      .select()
      .single()

    if (storyError) {
      console.error('Failed to create story:', storyError)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    // Create choice book pricing structure
    await supabase
      .from('story_pricing')
      .insert({
        story_id: story.id,
        creator_id: user.id,
        price_per_chapter: 6, // Slightly higher for choice chapters
        bundle_discount: 20,
        is_free_sample: true,
        free_chapters: 2, // Prologue + first choice
        premium_unlock_price: Math.max(50, estimatedLength * 4)
      })

    // Initialize choice book structure (would extend database)
    const choiceStructure = {
      start_chapter_id: 'prologue',
      choice_points: [],
      ending_chapters: foundation.endingOutline || [],
      path_map: [],
      decision_tree: {
        chapter_id: 'prologue',
        choices: [],
        children: [],
        ending: null
      }
    }

    // Store choice structure in story metadata for now
    await supabase
      .from('stories')
      .update({
        characters: {
          ...foundation.mainCharacters,
          choice_structure: choiceStructure,
          book_type: 'choice'
        }
      })
      .eq('id', story.id)

    // Deduct credits
    const { error: creditError } = await supabase.rpc('process_credit_transaction', {
      p_user_id: user.id,
      p_amount: -foundationCost,
      p_transaction_type: 'spend',
      p_description: `Created choice book: ${foundation.title}`,
      p_reference_id: story.id,
      p_reference_type: 'choice_book_creation'
    })

    if (creditError) {
      console.error('Credit transaction failed:', creditError)
    }

    // Track analytics
    const { analyticsService } = await import('@/lib/claude/analytics')
    await analyticsService.trackOperation({
      userId: user.id,
      operation: 'choice_book_creation',
      model: foundationResult.model,
      inputTokens: foundationResult.usage.inputTokens,
      outputTokens: foundationResult.usage.outputTokens,
      cost: foundationResult.cost,
      responseTime: (foundationResult as any).responseTime || 0,
      success: true,
      cached: false,
      metadata: {
        storyId: story.id,
        choiceComplexity,
        targetEndingCount,
        estimatedLength
      }
    })

    return NextResponse.json({
      success: true,
      story: {
        ...story,
        choice_structure: choiceStructure,
        book_type: 'choice'
      },
      foundation,
      cost: foundationCost,
      generation_info: {
        tokens_used: foundationResult.usage.totalTokens,
        cost_usd: foundationResult.cost,
        model: foundationResult.model
      }
    })

  } catch (error) {
    console.error('Choice book creation error:', error)
    return NextResponse.json({
      error: 'Failed to create choice book',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/stories/choice-books
 * Get user's choice books
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Get user's choice books (identified by choice_structure in characters field)
    const { data: stories } = await supabase
      .from('stories')
      .select(`
        *,
        story_pricing (*)
      `)
      .eq('user_id', user.id)
      .not('characters->choice_structure', 'is', null)
      .order('created_at', { ascending: false })

    const choiceBooks = (stories || []).map(story => ({
      ...story,
      book_type: 'choice',
      choice_structure: story.characters?.choice_structure,
      ending_count: story.characters?.choice_structure?.ending_chapters?.length || 0,
      complexity: story.foundation?.choiceStructure?.complexity || 'moderate'
    }))

    return NextResponse.json({
      choice_books: choiceBooks,
      total_count: choiceBooks.length
    })

  } catch (error) {
    console.error('Get choice books error:', error)
    return NextResponse.json({ error: 'Failed to get choice books' }, { status: 500 })
  }
}