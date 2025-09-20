import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { infinitePagesCache } from '@/lib/claude/infinitePagesCache'
import { TOKEN_COSTS } from '@/lib/constants'

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

    if (!profile || profile.tokens_remaining < TOKEN_COSTS.CHAPTER_GENERATION) {
      return NextResponse.json({
        error: `Insufficient tokens (${TOKEN_COSTS.CHAPTER_GENERATION} tokens required for chapter generation)`
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // PRIORITY 2: Generate chapter with caching for 60% cost savings
    const targetWordCount = 2000; // Default target

    // Generate foundation fingerprint for dependency tracking
    const foundationFingerprint = infinitePagesCache.generateFoundationFingerprint(story.foundation);

    // Generate previous chapters hash for context matching
    const previousChapters = story.chapters || [];
    const previousChaptersHash = infinitePagesCache.generatePreviousChaptersHash(
      previousChapters.map((ch: any) => ({ content: ch.content || '', summary: ch.summary || '' }))
    );

    let chapterResult;
    let tokensSaved = 0;
    let fromCache = false;
    let cacheType = 'none';

    try {
      // Use chapter caching wrapper
      const cachedResult = await infinitePagesCache.wrapChapterGeneration(
        async () => {
          // Original chapter generation logic
          const storyContext = `
Story Title: ${story.title}
Genre: ${story.genre}
Premise: ${story.premise}
Foundation: ${JSON.stringify(story.foundation, null, 2)}
`;

          const previousChapter = previousChapters
            ?.find((ch: any) => ch.chapter_number === chapter_number - 1);

          const previousContext = previousChapter
            ? `Previous Chapter Content: ${previousChapter.content}`
            : 'This is the first chapter.';

          const prompt = `Write Chapter ${chapter_number} for this story:

${storyContext}

${previousContext}

Please write a complete chapter that:
- Is approximately ${targetWordCount} words
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

Make this chapter compelling and well-written.`;

          const message = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
          });

          const content = message.content[0].type === 'text' ? message.content[0].text : '';
          const inputTokens = message.usage.input_tokens;
          const outputTokens = message.usage.output_tokens;

          // Parse AI response
          let chapterData;
          try {
            chapterData = JSON.parse(content);
          } catch {
            chapterData = {
              title: title || `Chapter ${chapter_number}`,
              content: content,
              summary: '',
              wordCount: content.split(/\s+/).length
            };
          }

          return {
            ...chapterData,
            usage: { inputTokens, outputTokens },
            cost: (inputTokens * 0.000003) + (outputTokens * 0.000015)
          };
        },
        chapter_number,
        params.id, // storyId
        foundationFingerprint,
        previousChaptersHash,
        story.genre as any,
        targetWordCount,
        user.id,
        story.title
      );

      chapterResult = cachedResult.result;
      tokensSaved = cachedResult.tokensSaved;
      fromCache = cachedResult.fromCache;
      cacheType = cachedResult.cacheType || 'none';

      console.log(`[Chapter Generation] ${fromCache ? 'CACHE HIT' : 'NEW GENERATION'} - Chapter ${chapter_number}, Tokens saved: ${tokensSaved}, Type: ${cacheType}`);

    } catch (error) {
      console.error('Chapter generation error:', error);
      return NextResponse.json({ error: 'Failed to generate chapter' }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const chapterData = chapterResult;
    const inputTokens = chapterResult.usage?.inputTokens || 0;
    const outputTokens = chapterResult.usage?.outputTokens || 0;
    const costUSD = chapterResult.cost || 0;

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

    // Calculate actual token usage accounting for cache savings
    const actualTokensUsed = fromCache
      ? Math.max(0, TOKEN_COSTS.CHAPTER_GENERATION - tokensSaved)
      : TOKEN_COSTS.CHAPTER_GENERATION;
    const actualCost = fromCache
      ? Math.max(0, costUSD - (tokensSaved * 0.000015))
      : costUSD;

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
        generation_cost_usd: actualCost,
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
          tokens_remaining: profile.tokens_remaining - actualTokensUsed,
          tokens_used_total: (profile.tokens_used_total || 0) + (inputTokens + outputTokens),
          words_generated: (profile.words_generated || 0) + wordCount,
          tokens_saved_cache: (profile.tokens_saved_cache || 0) + tokensSaved
        })
        .eq('id', user.id),

      supabase
        .from('stories')
        .update({
          total_tokens_used: (story.total_tokens_used || 0) + (inputTokens + outputTokens),
          total_cost_usd: (story.total_cost_usd || 0) + actualCost,
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
          cost_usd: actualCost
        })
    ])

    return NextResponse.json({
      chapter,
      tokensUsed: actualTokensUsed,
      tokensSaved: tokensSaved,
      fromCache: fromCache,
      cacheType: cacheType,
      remainingTokens: profile.tokens_remaining - actualTokensUsed,
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