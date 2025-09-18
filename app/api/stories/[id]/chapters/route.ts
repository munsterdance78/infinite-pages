import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Check user tokens
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, tokens_used_total')
      .eq('id', user.id)
      .single()

    if (!profile || profile.tokens_remaining < 5) {
      return NextResponse.json({ 
        error: 'Insufficient tokens (5 tokens required for chapter generation)' 
      }, { status: 400 })
    }

    // Build context for AI
    const storyContext = `
Story Title: ${story.title}
Genre: ${story.genre}
Premise: ${story.premise}
Foundation: ${JSON.stringify(story.foundation, null, 2)}
`

    const previousChapter = story.chapters
      ?.find((ch: any) => ch.chapter_number === chapter_number - 1)

    const previousContext = previousChapter 
      ? `Previous Chapter Content: ${previousChapter.content}`
      : 'This is the first chapter.'

    const prompt = `Write Chapter ${chapter_number} for this story:

${storyContext}

${previousContext}

Please write a complete chapter that:
- Is approximately 1500-2500 words
- Maintains consistency with the story foundation
- Flows naturally from previous chapters
- Advances the plot meaningfully
- Includes engaging dialogue and description
- Ends with appropriate tension or resolution for this point in the story

Return the response as JSON:
{
  "title": "Chapter ${chapter_number} title",
  "content": "The full chapter content",
  "summary": "Brief summary of what happens in this chapter",
  "wordCount": number_of_words
}

Make this chapter compelling and well-written.`

    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costUSD = (inputTokens * 0.000003) + (outputTokens * 0.000015)

    // Parse AI response
    let chapterData
    try {
      chapterData = JSON.parse(content)
    } catch {
      chapterData = { 
        title: title || `Chapter ${chapter_number}`,
        content: content,
        summary: '',
        wordCount: content.split(/\s+/).length
      }
    }

    // Content moderation
    const isContentSafe = await moderateContent(chapterData.content || content)
    if (!isContentSafe) {
      return NextResponse.json({ 
        error: 'Generated content violates content policy' 
      }, { status: 400 })
    }

    const wordCount = chapterData.wordCount || (chapterData.content || content).split(/\s+/).length

    // Create chapter
    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert({
        story_id: params.id,
        chapter_number,
        title: chapterData.title || title || `Chapter ${chapter_number}`,
        content: chapterData.content || content,
        summary: chapterData.summary || '',
        word_count: wordCount,
        tokens_used_input: inputTokens,
        tokens_used_output: outputTokens,
        generation_cost_usd: costUSD,
        prompt_type: 'chapter_generation'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user tokens and story stats
    await Promise.all([
      supabase
        .from('profiles')
        .update({
          tokens_remaining: profile.tokens_remaining - 5,
          tokens_used_total: profile.tokens_used_total + (inputTokens + outputTokens),
          words_generated: profile.words_generated + wordCount
        })
        .eq('id', user.id),
      
      supabase
        .from('stories')
        .update({
          total_tokens_used: story.total_tokens_used + (inputTokens + outputTokens),
          total_cost_usd: story.total_cost_usd + costUSD,
          word_count: story.word_count + wordCount,
          chapter_count: story.chapter_count + 1
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
          cost_usd: costUSD
        })
    ])

    return NextResponse.json({ chapter })
  } catch (error) {
    console.error('Chapter generation error:', error)
    return NextResponse.json({ error: 'Failed to generate chapter' }, { status: 500 })
  }
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