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
      role,
      traits = [],
      existingCharacters = [],
      storyContext,
      characterType = 'supporting',
      voiceComplexity = 'medium',
      conflictPotential = 'moderate',
      workflowPhase = 'generate'
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

    // Rate limiting for character generation
    const rateLimit = await rateLimiter.checkRateLimit(
      user.id,
      'CHARACTER_GENERATION',
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

    // Check credits for character generation
    const estimatedCost = ESTIMATED_CREDIT_COSTS.CHARACTER_GENERATION || 10
    if (profile.tokens_remaining < estimatedCost) {
      return NextResponse.json({
        error: `Insufficient credits (${estimatedCost} credits required for character generation)`
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get story facts for enhanced character context
    const storyFacts = await claudeCache.getOptimizedFactContext(params.id)

    // Get existing character voice patterns for consistency
    const { data: existingVoicePatterns } = await supabase
      .from('character_voice_patterns')
      .select('character_name, voice_pattern_sfsl, speech_patterns, personality_markers')
      .eq('story_id', params.id)

    // Generate character with enhanced context
    const characterResult = await claudeService.generateContent({
      prompt: `Generate a detailed character for this story with the following specifications:

Role: ${role}
Character Type: ${characterType}
Traits: ${traits.join(', ')}
Voice Complexity: ${voiceComplexity}
Conflict Potential: ${conflictPotential}

Story Context:
Title: ${story.title}
Foundation: ${story.foundation}
Existing Characters: ${existingCharacters.map(c => `${c.name} (${c.role})`).join(', ')}

Story Facts Context:
${JSON.stringify(storyFacts, null, 2)}

Existing Voice Patterns:
${existingVoicePatterns?.map(p => `${p.character_name}: ${p.speech_patterns}`).join('\n')}

Please generate a comprehensive character profile including:
1. Basic information (name, age, occupation, role in story)
2. Physical description
3. Personality traits and motivations
4. Background and history
5. Voice pattern and speech characteristics (in SFSL format)
6. Relationships with existing characters
7. Character arc potential
8. Conflict sources and resolution paths

Format the response as valid JSON with the structure:
{
  "name": "Character Name",
  "age": number,
  "occupation": "string",
  "role": "string",
  "physicalDescription": "string",
  "personality": {
    "traits": ["trait1", "trait2"],
    "motivations": ["motivation1", "motivation2"],
    "fears": ["fear1", "fear2"]
  },
  "background": "string",
  "voicePattern": {
    "speechStyle": "string",
    "vocabulary": "string",
    "speechPatterns": ["pattern1", "pattern2"],
    "voicePatternSFSL": "compressed SFSL representation"
  },
  "relationships": [
    {
      "characterName": "string",
      "relationshipType": "string",
      "dynamics": "string"
    }
  ],
  "characterArc": {
    "startingPoint": "string",
    "growthAreas": ["area1", "area2"],
    "potentialEnding": "string"
  },
  "conflictSources": ["source1", "source2"]
}`,
      systemPrompt: `You are an expert character designer for creative writing. Create rich, three-dimensional characters that fit seamlessly into existing story worlds.

Focus on:
- Character consistency with established story facts
- Unique voice patterns that don't overlap with existing characters
- Realistic motivations and growth potential
- Meaningful relationships and conflict opportunities
- SFSL compression for voice patterns

Always provide valid JSON responses with all required fields.`,
      operation: 'character_generation',
      useCache: true
    })

    // Parse and validate the generated character
    let parsedCharacter
    try {
      parsedCharacter = JSON.parse(characterResult.content)
    } catch (parseError) {
      return NextResponse.json({
        error: 'Invalid character data generated. Please try again.'
      }, {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Store character voice pattern in database
    if (parsedCharacter.voicePattern?.voicePatternSFSL) {
      await supabase.from('character_voice_patterns').insert({
        story_id: params.id,
        character_name: parsedCharacter.name,
        voice_pattern_sfsl: parsedCharacter.voicePattern.voicePatternSFSL,
        speech_patterns: JSON.stringify(parsedCharacter.voicePattern.speechPatterns),
        personality_markers: JSON.stringify(parsedCharacter.personality),
        created_at: new Date().toISOString()
      })
    }

    // Update user credits
    const creditsUsed = Math.ceil(characterResult.cost * 1000)
    await supabase
      .from('profiles')
      .update({
        tokens_remaining: Math.max(0, profile.tokens_remaining - creditsUsed),
        tokens_used_total: supabase.sql`tokens_used_total + ${creditsUsed}`
      })
      .eq('id', user.id)

    // Cache character data for future reference
    await claudeCache.cacheHierarchicalFacts(
      params.id,
      {
        characterName: parsedCharacter.name,
        characterData: parsedCharacter,
        generatedAt: new Date().toISOString(),
        cost: characterResult.cost,
        factContext: storyFacts
      },
      'character'
    )

    // Track analytics for character generation
    await analyticsService.trackOperation({
      userId: user.id,
      operation: 'character_generation',
      model: 'claude_enhanced',
      inputTokens: characterResult.inputTokens || 0,
      outputTokens: characterResult.outputTokens || 0,
      cost: characterResult.cost,
      responseTime: Date.now() - startTime,
      success: true,
      cached: false,
      metadata: {
        characterType,
        voiceComplexity,
        conflictPotential,
        existingCharacterCount: existingCharacters.length,
        storyFactsUsed: Object.keys(storyFacts).filter(k => storyFacts[k] !== null)
      }
    })

    return NextResponse.json({
      success: true,
      character: parsedCharacter,
      metadata: {
        creditsUsed,
        processingTime: Date.now() - startTime,
        storyFactsUsed: Object.keys(storyFacts).filter(k => storyFacts[k] !== null),
        voicePatternStored: !!parsedCharacter.voicePattern?.voicePatternSFSL,
        optimizations: {
          factContextOptimization: true,
          voicePatternSFSL: true,
          conflictAwareness: true
        }
      }
    })

  } catch (error: any) {
    console.error('Character generation error:', error)

    // Track failed operation
    await analyticsService.trackOperation({
      userId: user.id,
      operation: 'character_generation',
      model: 'claude_enhanced',
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
        error: 'Character generation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// GET method to retrieve character generation status and existing characters
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

    // Get existing character voice patterns
    const { data: characterVoicePatterns } = await supabase
      .from('character_voice_patterns')
      .select('*')
      .eq('story_id', params.id)
      .order('created_at', { ascending: false })

    // Get story facts for context
    const storyFacts = await claudeCache.getOptimizedFactContext(params.id)

    return NextResponse.json({
      storyId: params.id,
      existingCharacters: characterVoicePatterns || [],
      characterCount: characterVoicePatterns?.length || 0,
      storyFactsAvailable: Object.keys(storyFacts).filter(k => storyFacts[k] !== null),
      generationCapabilities: {
        canGenerateCharacters: true,
        hasStoryContext: Object.keys(storyFacts).length > 0,
        hasExistingCharacters: (characterVoicePatterns?.length || 0) > 0,
        voicePatternTracking: true
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error retrieving character generation status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve character generation status' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}