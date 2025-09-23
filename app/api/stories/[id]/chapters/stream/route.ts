import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { claudeStreamingService } from '@/lib/claude'
import { ESTIMATED_CREDIT_COSTS } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { chapter_number, target_word_count } = await request.json()

    if (!chapter_number) {
      return new Response('Chapter number is required', { status: 400 })
    }

    // Verify story ownership and get story data
    const { data: story } = await supabase
      .from('stories')
      .select('*, chapters(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return new Response('Story not found', { status: 404 })
    }

    // Check user tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, tokens_used_total, words_generated')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tokens_remaining < ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION) {
      return new Response('Insufficient tokens', { status: 400 })
    }

    // Build context for AI
    const storyContext = `
Story Title: ${story.title}
Genre: ${story.genre}
Premise: ${story.premise}
Foundation: ${JSON.stringify(story.foundation, null, 2)}
`

    // Get previous chapters
    const previousChapters = story.chapters
      ?.filter((ch: any) => ch.chapter_number < chapter_number)
      .sort((a: any, b: any) => a.chapter_number - b.chapter_number)
      .map((ch: any) => ({
        number: ch.chapter_number,
        content: ch.content,
        summary: ch.summary || ''
      })) || []

    // Create streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'start',
            chapterNumber: chapter_number
          })}\n\n`))

          const generator = claudeStreamingService.streamChapter({
            storyContext,
            chapterNumber: chapter_number,
            previousChapters,
            targetWordCount: target_word_count || 2000
          })

          for await (const response of generator) {
            if (response.error) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                error: response.error 
              })}\n\n`))
              break
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'content',
              content: response.content,
              isComplete: response.isComplete,
              usage: response.usage,
              cost: response.cost
            })}\n\n`))

            if (response.isComplete) {
              // Parse the completed chapter data
              let chapterData
              try {
                chapterData = JSON.parse(response.content)
              } catch {
                chapterData = { 
                  title: `Chapter ${chapter_number}`,
                  content: response.content,
                  summary: '',
                  wordCount: response.content.split(/\s+/).length
                }
              }

              // Create chapter in database
              const { data: chapter, error: chapterError } = await supabase
                .from('chapters')
                .insert({
                  story_id: params.id,
                  chapter_number: chapter_number,
                  title: chapterData.title || `Chapter ${chapter_number}`,
                  content: chapterData.content || response.content,
                  summary: chapterData.summary || '',
                  word_count: chapterData.wordCount || response.content.split(/\s+/).length
                })
                .select()
                .single()

              if (chapterError) {
                console.error('Chapter creation error:', chapterError)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'error', 
                  error: 'Failed to save chapter'
                })}\n\n`))
                break
              }

              // Update user tokens
              const tokensUsed = response.usage?.totalTokens || 0
              await supabase
                .from('profiles')
                .update({
                  tokens_remaining: profile.tokens_remaining - ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION,
                  tokens_used_total: (profile.tokens_used_total || 0) + tokensUsed,
                  words_generated: (profile.words_generated || 0) + (chapterData.wordCount || 0)
                })
                .eq('id', user.id)

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete',
                chapter: chapter,
                tokensUsed,
                cost: response.cost
              })}\n\n`))
              break
            }
          }

          controller.close()
        } catch (error: any) {
          console.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message || 'An unexpected error occurred'
          })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error: any) {
    console.error('Stream setup error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}




