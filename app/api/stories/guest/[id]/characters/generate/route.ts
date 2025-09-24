import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { claudeService } from '@/lib/claude/service'
import { subscriptionAwareRateLimit, logRateLimitViolation } from '@/lib/rateLimit'
import { getClientIdentifier } from '@/lib/rateLimit'

// Guest character generation limitations
const GUEST_CHARACTER_LIMITS = {
  MAX_CHARACTERS_PER_STORY: 3,
  MAX_TRAITS: 5,
  SIMPLE_VOICE_PATTERNS: true
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  try {
    // Get client identifier for rate limiting
    const clientId = getClientIdentifier(request)

    // Apply guest rate limiting
    const rateLimitResult = await subscriptionAwareRateLimit(
      request,
      'GUEST_CHARACTER_GENERATION',
      clientId,
      'guest'
    )

    if (!rateLimitResult.success) {
      logRateLimitViolation(clientId, 'GUEST_CHARACTER_GENERATION', request)
      return rateLimitResult.response!
    }

    // Validate story ID is a guest story
    if (!params.id.startsWith('guest-')) {
      return NextResponse.json({
        error: 'Invalid story ID for guest mode'
      }, { status: 400 })
    }

    const requestBody = await request.json()
    const {
      role = 'supporting',
      traits = [],
      characterType = 'supporting',
      voiceComplexity = 'simple'
    } = requestBody

    // Limit traits for guest mode
    const limitedTraits = traits.slice(0, GUEST_CHARACTER_LIMITS.MAX_TRAITS)

    // Generate simplified character for guest mode
    const characterResult = await claudeService.generateContent({
      prompt: `Generate a simple character for a demo story with these specifications:

Role: ${role}
Character Type: ${characterType}
Traits: ${limitedTraits.join(', ')}

Please create a basic character profile including:
1. Name and brief description
2. 2-3 key personality traits
3. Simple background
4. Basic role in the story

Keep the response concise and suitable for a story demo. Format as JSON:
{
  "name": "Character Name",
  "role": "${role}",
  "description": "Brief character description",
  "traits": ["trait1", "trait2", "trait3"],
  "background": "Simple background",
  "relationships": []
}`,
      systemPrompt: `You are creating demo characters for story previews. Keep responses simple and engaging but brief. Always return valid JSON.`,
      operation: 'guest_character_generation',
      useCache: false
    })

    // Parse the generated character
    let parsedCharacter
    try {
      parsedCharacter = JSON.parse(characterResult.content)
    } catch (parseError) {
      return NextResponse.json({
        error: 'Character generation failed. Please try again.'
      }, { status: 500 })
    }

    // Add guest mode metadata
    const guestCharacter = {
      ...parsedCharacter,
      id: `guest-char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      storyId: params.id,
      isGuest: true,
      limitations: {
        canEdit: false,
        canSave: false,
        requiresSignup: 'To save characters and continue building your story, please create an account'
      },
      generatedAt: new Date().toISOString()
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      character: guestCharacter,
      guestMode: true,
      limitations: guestCharacter.limitations,
      metadata: {
        processingTime: Date.now() - startTime,
        maxCharactersPerStory: GUEST_CHARACTER_LIMITS.MAX_CHARACTERS_PER_STORY,
        remainingGenerations: 'Limited - sign up for unlimited access'
      }
    })

    // Add rate limit headers
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response

  } catch (error: any) {
    console.error('Guest character generation error:', error)

    return NextResponse.json({
      error: 'Character generation failed',
      details: ['Please try again. Sign up for reliable access.']
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600'
    }
  })
}