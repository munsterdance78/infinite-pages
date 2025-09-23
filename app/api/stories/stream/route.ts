import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { claudeStreamingService } from '@/lib/claude'
import { ESTIMATED_CREDIT_COSTS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { title, genre, premise } = await request.json()

    // Validate input
    if (!genre || !premise) {
      return new Response('Genre and premise are required', { status: 400 })
    }

    // Check user tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, tokens_used_total')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tokens_remaining < ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION) {
      return new Response('Insufficient tokens', { status: 400 })
    }

    // Create streaming response
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`))

          const generator = claudeStreamingService.streamStoryFoundation({
            title,
            genre,
            premise
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
              // Update user tokens in database
              const tokensUsed = response.usage?.totalTokens || 0
              await supabase
                .from('profiles')
                .update({
                  tokens_remaining: profile.tokens_remaining - ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION,
                  tokens_used_total: (profile.tokens_used_total || 0) + tokensUsed
                })
                .eq('id', user.id)

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'complete',
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




