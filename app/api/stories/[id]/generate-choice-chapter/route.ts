import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { choiceBookGenerator } from '@/lib/choice-books/choice-generator'
import type { Database } from '@/lib/supabase/types'

/**
 * POST /api/stories/[id]/generate-choice-chapter
 * Generate a new chapter with choices based on previous selections
 * Extends existing chapter generation system for choice books
 */
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

    const storyId = params.id
    const {
      chapterNumber,
      previousChoiceId,
      targetChoiceCount = 3,
      branchingStrategy = 'moderate'
    } = await request.json()

    // Verify user has access and credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check credit cost (choice chapters cost slightly more due to complexity)
    const baseCost = 8 // Regular chapter cost
    const choiceCost = Math.max(2, targetChoiceCount) // Additional cost for choices
    const totalCost = baseCost + choiceCost

    if (profile.credits_balance < totalCost) {
      return NextResponse.json({
        error: 'Insufficient credits',
        required: totalCost,
        available: profile.credits_balance
      }, { status: 402 })
    }

    // Get story context
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

    // Verify user owns this story or has generation permissions
    if (story.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get user's choice history for this story
    const { data: readerPath } = await supabase
      .from('reader_paths')
      .select('choices_made')
      .eq('user_id', user.id)
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const previousChoices = readerPath?.choices_made || []

    // Build story context for choice generation
    const storyContext = {
      story,
      characters: story.characters || [],
      foundation: story.foundation || {},
      previousChapters: story.chapters || [],
      chapterNumber,
      summary: story.premise || '',
      purpose: 'advance choice narrative',
      keyEvents: ['character decision point', 'consequence development']
    }

    // Generate chapter with choices using existing optimization
    const generationResult = await choiceBookGenerator.generateChapterWithChoices({
      storyContext,
      chapterNumber,
      previousChoices,
      targetChoiceCount,
      branchingStrategy,
      useOptimizedContext: true
    })

    // Parse the generated content
    let chapterData
    try {
      chapterData = JSON.parse(generationResult.chapter.content)
    } catch (error) {
      // Fallback if content isn't JSON
      chapterData = {
        title: `Chapter ${chapterNumber}`,
        content: generationResult.chapter.content,
        summary: 'Choice chapter generated',
        wordCount: generationResult.chapter.content?.length / 5 || 500
      }
    }

    // Save the generated chapter
    const { data: savedChapter, error: chapterError } = await supabase
      .from('choice_chapters')
      .insert({
        story_id: storyId,
        chapter_number: chapterNumber,
        title: chapterData.title,
        content: chapterData.content,
        summary: chapterData.summary,
        word_count: chapterData.wordCount || 500,
        choice_points: generationResult.chapter.choice_points || [],
        is_ending: false,
        parent_chapters: previousChoiceId ? [previousChoiceId] : [],
        generation_context: {
          previous_choices: previousChoices,
          branching_strategy: branchingStrategy,
          optimization_used: true
        }
      })
      .select()
      .single()

    if (chapterError) {
      console.error('Failed to save chapter:', chapterError)
      return NextResponse.json({ error: 'Failed to save chapter' }, { status: 500 })
    }

    // Save the generated choices
    const savedChoices = []
    for (const [index, choice] of generationResult.choices.entries()) {
      const { data: savedChoice, error: choiceError } = await supabase
        .from('choices')
        .insert({
          choice_point_id: generationResult.chapter.choice_points[0]?.id || `cp_${savedChapter.id}`,
          story_id: storyId,
          chapter_id: savedChapter.id,
          choice_order: index + 1,
          choice_text: choice.text,
          choice_description: choice.description,
          leads_to_chapter: `pending_${choice.id}`, // Will be updated when next chapters are generated
          consequences: choice.consequences,
          character_impacts: choice.character_impacts,
          emotional_tone: choice.emotional_tone,
          difficulty_level: choice.difficulty_level,
          selection_count: 0
        })
        .select()
        .single()

      if (!choiceError) {
        savedChoices.push(savedChoice)
      }
    }

    // Deduct credits in transaction
    const { error: creditError } = await supabase.rpc('process_credit_transaction', {
      p_user_id: user.id,
      p_amount: -totalCost,
      p_transaction_type: 'spend',
      p_description: `Generated choice chapter ${chapterNumber}`,
      p_reference_id: savedChapter.id,
      p_reference_type: 'choice_chapter_generation'
    })

    if (creditError) {
      console.error('Credit transaction failed:', creditError)
      // Note: Chapter was already saved, but user wasn't charged
      // In production, would want to handle this more carefully
    }

    // Update story stats
    await supabase
      .from('stories')
      .update({
        chapter_count: (story.chapter_count || 0) + 1,
        word_count: (story.word_count || 0) + (chapterData.wordCount || 500),
        updated_at: new Date().toISOString()
      })
      .eq('id', storyId)

    return NextResponse.json({
      success: true,
      chapter: savedChapter,
      choices: savedChoices,
      cost: totalCost,
      optimization_metrics: generationResult.optimization_metrics,
      generation_info: {
        tokens_saved: generationResult.optimization_metrics.tokens_saved,
        context_compression: generationResult.optimization_metrics.context_compression,
        generation_time: generationResult.optimization_metrics.generation_time
      }
    })

  } catch (error) {
    console.error('Choice chapter generation error:', error)
    return NextResponse.json({
      error: 'Failed to generate choice chapter',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}