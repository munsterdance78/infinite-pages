import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import { choiceBookGenerator } from '@/lib/choice-books/choice-generator'
import type { Database } from '@/lib/supabase/types'

/**
 * GET /api/stories/[id]/choices
 * Get available choices for current reading position
 */
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

    const storyId = params.id
    const { searchParams } = new URL(request.url)
    const currentChapter = searchParams.get('chapter') || 'start'

    // Verify story exists and is a choice book
    const { data: story } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // For now, check if this is a choice book via metadata or assume choice book
    // In full implementation, would check story.book_type
    const isChoiceBook = story.characters?.choice_structure || story.outline?.hasChoices

    if (!isChoiceBook) {
      return NextResponse.json({ error: 'Story is not a choice book' }, { status: 400 })
    }

    // Get user's current reading progress
    const { data: readerPath } = await supabase
      .from('reader_paths')
      .select('*')
      .eq('user_id', user.id)
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get choices for current chapter position
    const { data: choices } = await supabase
      .from('choices')
      .select(`
        *,
        choice_analytics (
          selection_count,
          completion_rate,
          satisfaction_rating
        )
      `)
      .eq('story_id', storyId)
      .eq('chapter_id', currentChapter)

    // Check user's access to this story
    const { data: userAccess } = await supabase
      .from('story_purchases')
      .select('chapters_unlocked, purchase_type')
      .eq('user_id', user.id)
      .eq('story_id', storyId)

    const hasAccess = userAccess?.some(access =>
      access.purchase_type === 'premium_unlock' ||
      access.chapters_unlocked.includes(parseInt(currentChapter))
    )

    // Get pricing info
    const { data: pricing } = await supabase
      .from('story_pricing')
      .select('*')
      .eq('story_id', storyId)
      .single()

    return NextResponse.json({
      choices: choices || [],
      current_chapter: currentChapter,
      reader_progress: readerPath?.choices_made || [],
      access_info: {
        has_access: hasAccess,
        requires_purchase: !hasAccess,
        pricing: pricing || {
          price_per_chapter: 5,
          free_chapters: 2,
          premium_unlock_price: 50
        }
      },
      story_info: {
        title: story.title,
        is_choice_book: true,
        total_chapters: story.chapter_count || 0
      }
    })

  } catch (error) {
    console.error('Get choices error:', error)
    return NextResponse.json({ error: 'Failed to get choices' }, { status: 500 })
  }
}

/**
 * POST /api/stories/[id]/choices
 * Make a choice and get next chapter/choices
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
    const { choiceId, currentChapter, sessionId } = await request.json()

    if (!choiceId) {
      return NextResponse.json({ error: 'Choice ID required' }, { status: 400 })
    }

    // Verify user has access to this chapter
    const { data: userAccess } = await supabase
      .from('story_purchases')
      .select('chapters_unlocked, purchase_type')
      .eq('user_id', user.id)
      .eq('story_id', storyId)

    const hasAccess = userAccess?.some(access =>
      access.purchase_type === 'premium_unlock' ||
      access.chapters_unlocked.includes(parseInt(currentChapter))
    )

    if (!hasAccess) {
      return NextResponse.json({
        error: 'Access required',
        requires_purchase: true
      }, { status: 402 })
    }

    // Get the choice details
    const { data: choice } = await supabase
      .from('choices')
      .select('*')
      .eq('id', choiceId)
      .single()

    if (!choice) {
      return NextResponse.json({ error: 'Choice not found' }, { status: 404 })
    }

    // Record the choice in user's path
    const choiceMade = {
      choice_point_id: choice.choice_point_id,
      choice_id: choiceId,
      choice_text: choice.choice_text,
      timestamp: new Date().toISOString(),
      time_taken_seconds: 0, // Could track this client-side
      chapter_context: currentChapter
    }

    // Update or create reader path
    const { data: existingPath } = await supabase
      .from('reader_paths')
      .select('*')
      .eq('user_id', user.id)
      .eq('story_id', storyId)
      .eq('session_id', sessionId || 'default')
      .single()

    if (existingPath) {
      const updatedChoices = [...(existingPath.choices_made || []), choiceMade]

      await supabase
        .from('reader_paths')
        .update({
          choices_made: updatedChoices,
          current_chapter: choice.leads_to_chapter,
          path_completion: updatedChoices.length * 10, // Rough completion estimate
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPath.id)
    } else {
      await supabase
        .from('reader_paths')
        .insert({
          user_id: user.id,
          story_id: storyId,
          session_id: sessionId || 'default',
          choices_made: [choiceMade],
          current_chapter: choice.leads_to_chapter,
          path_completion: 10
        })
    }

    // Update choice analytics
    await supabase
      .from('choice_analytics')
      .upsert({
        story_id: storyId,
        choice_point_id: choice.choice_point_id,
        choice_id: choiceId,
        selection_count: (choice.selection_count || 0) + 1
      })

    // Get next chapter content (if it exists)
    let nextChapter = null
    const { data: nextChapterData } = await supabase
      .from('choice_chapters')
      .select('*')
      .eq('id', choice.leads_to_chapter)
      .single()

    if (nextChapterData) {
      nextChapter = nextChapterData
    } else {
      // Chapter doesn't exist yet - might need to generate it
      // For now, return placeholder
      nextChapter = {
        id: choice.leads_to_chapter,
        title: 'Continue the Story...',
        content: 'Chapter content will be generated based on your choice.',
        needs_generation: true
      }
    }

    // Get next choices (if any)
    const { data: nextChoices } = await supabase
      .from('choices')
      .select('*')
      .eq('chapter_id', choice.leads_to_chapter)

    return NextResponse.json({
      success: true,
      choice_made: choiceMade,
      next_chapter: nextChapter,
      next_choices: nextChoices || [],
      consequences: choice.consequences || [],
      character_impacts: choice.character_impacts || []
    })

  } catch (error) {
    console.error('Make choice error:', error)
    return NextResponse.json({ error: 'Failed to process choice' }, { status: 500 })
  }
}