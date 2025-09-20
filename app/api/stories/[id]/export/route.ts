import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Input validation schemas
const createStorySchema = {
  title: {
    required: false,
    type: 'string' as const,
    minLength: 0,
    maxLength: 200,
    sanitize: true
  },
  genre: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 50,
    allowedValues: [
      'Fantasy', 'Science Fiction', 'Mystery', 'Romance', 'Thriller', 'Horror',
      'Literary Fiction', 'Historical Fiction', 'Young Adult', 'Adventure',
      'Contemporary', 'Dystopian', 'Comedy', 'Drama'
    ]
  },
  premise: {
    required: true,
    type: 'string' as const,
    minLength: 10,
    maxLength: 2000,
    sanitize: true
  }
}

type ValidationRule = {
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  sanitize?: boolean;
}

type ValidationSchema = Record<string, ValidationRule>

// Validation helper functions
function validateInput(data: any, schema: ValidationSchema): { isValid: boolean; errors: string[]; sanitizedData: any } {
  const errors: string[] = []
  const sanitizedData: any = {}

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field]

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }

    // Skip validation for optional empty fields
    if (!rule.required && (value === undefined || value === null || value === '')) {
      sanitizedData[field] = rule.type === 'string' ? '' : null
      continue
    }

    // Type validation
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`)
      continue
    }

    if (rule.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`)
      continue
    }

    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`)
      continue
    }

    // String-specific validations
    if (rule.type === 'string') {
      const stringValue = value as string

      // Length validation
      if (rule.minLength !== undefined && stringValue.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters long`)
        continue
      }

      if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) {
        errors.push(`${field} must not exceed ${rule.maxLength} characters`)
        continue
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(stringValue)) {
        errors.push(`${field} must be one of: ${rule.allowedValues.join(', ')}`)
        continue
      }

      // Sanitization
      if (rule.sanitize) {
        sanitizedData[field] = sanitizeString(stringValue)
      } else {
        sanitizedData[field] = stringValue
      }
    } else {
      sanitizedData[field] = value
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  }
}

function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000) // Hard limit on length
}

function rateLimitKey(userId: string): string {
  return `story_creation_${userId}_${Math.floor(Date.now() / 60000)}` // Per minute
}

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: stories, error } = await supabase
      .from('stories')
     .select(`
        *,
        chapters (
          id, chapter_number, title, word_count, 
          generation_cost_usd, created_at, updated_at
        )
      `)

      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Database error fetching stories:', error)
      return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
    }

    return NextResponse.json({ stories })
  } catch (error) {
    console.error('Unexpected error in GET /api/stories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse and validate request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    // Validate input
    const validation = validateInput(requestBody, createStorySchema)
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validation.errors 
      }, { status: 400 })
    }

    const { title, genre, premise } = validation.sanitizedData

    // Check user profile and permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens_remaining, subscription_tier, stories_created, tokens_used_total, words_generated')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Database error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check story limits based on subscription
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data: monthlyStories, error: storiesError } = await supabase
      .from('stories')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    if (storiesError) {
      console.error('Database error checking monthly stories:', storiesError)
      return NextResponse.json({ error: 'Failed to check story limits' }, { status: 500 })
    }

    const monthlyCount = monthlyStories?.length || 0
    const maxStories = profile.subscription_tier === 'free' ? 2 : 50

    if (monthlyCount >= maxStories) {
      return NextResponse.json({ 
        error: 'Monthly story limit reached',
        details: [`You have created ${monthlyCount} stories this month. ${profile.subscription_tier === 'free' ? 'Upgrade to Pro for more stories.' : 'Contact support if you need a higher limit.'}`]
      }, { status: 400 })
    }

    // Check token balance
    const requiredTokens = 8
    if (profile.tokens_remaining < requiredTokens) {
      return NextResponse.json({ 
        error: 'Insufficient tokens',
        details: [`${requiredTokens} tokens required for story foundation. You have ${profile.tokens_remaining} tokens remaining.`]
      }, { status: 400 })
    }

    // Generate story foundation with Claude
    const prompt = `Create a comprehensive story foundation for a ${genre} story with this premise: "${premise}".

Please provide a structured JSON response with the following elements:
{
  "title": "${title || 'Untitled Story'}",
  "genre": "${genre}",
  "premise": "${premise}",
  "mainCharacters": [
    {
      "name": "Character Name",
      "role": "protagonist/antagonist/supporting",
      "description": "Brief character description",
      "motivation": "What drives this character"
    }
  ],
  "setting": {
    "time": "When the story takes place",
    "place": "Where the story takes place",
    "atmosphere": "Mood and tone of the setting"
  },
  "plotStructure": {
    "incitingIncident": "What kicks off the story",
    "risingAction": "Key conflicts and complications",
    "climax": "The story's turning point",
    "resolution": "How conflicts are resolved"
  },
  "themes": ["Primary themes of the story"],
  "tone": "Overall tone and style",
  "chapterOutline": [
    {
      "number": 1,
      "title": "Chapter title",
      "summary": "What happens in this chapter",
      "purpose": "How this chapter serves the story"
    }
  ]
}

Make this comprehensive and engaging. This is the foundation for a complete story.`

    let message
    try {
      message = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
   } catch (error: any) {
      console.error('Anthropic API error:', error)
      
      // Handle specific Anthropic API errors
      if (error?.status === 429) {
        return NextResponse.json({ 
          error: 'API rate limit exceeded',
          details: ['Too many requests. Please wait a moment before trying again.']
        }, { status: 429 })
      }
      
      if (error?.status === 401) {
        return NextResponse.json({ 
          error: 'API authentication failed',
          details: ['Service configuration error. Please contact support.']
        }, { status: 500 })
      }
      
      if (error?.status >= 400 && error?.status < 500) {
        return NextResponse.json({ 
          error: 'Invalid request to AI service',
          details: ['Please check your story premise and try again.']
        }, { status: 400 })
      }
      
      return NextResponse.json({ 
        error: 'Service temporarily unavailable',
        details: ['Please try again in a few moments.']
      }, { status: 503 })
    }

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costUSD = (inputTokens * 0.000003) + (outputTokens * 0.000015)

    // Parse AI response
    let foundation
    try {
      foundation = JSON.parse(content)
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, storing as text:', parseError)
      foundation = { content, rawResponse: true }
    }

    // Enhanced content moderation
    const moderationResult = await moderateContent(content)
    if (!moderationResult.isValid) {
      console.warn('Content moderation failed:', moderationResult.reasons)
      return NextResponse.json({ 
        error: 'Generated content violates content policy',
        details: ['Please try rephrasing your premise to avoid prohibited content.']
      }, { status: 400 })
    }

    // Create story in database with transaction-like behavior
    const { data: story, error: createError } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        title: title || 'Untitled Story',
        genre,
        premise,
        foundation,
        total_tokens_used: inputTokens + outputTokens,
        total_cost_usd: costUSD,
        status: 'draft',
        word_count: content.split(/\s+/).length,
        chapter_count: 0
      })
      .select()
      .single()

    if (createError) {
      console.error('Database error creating story:', createError)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    // Update user tokens and stats
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tokens_remaining: profile.tokens_remaining - requiredTokens,
        tokens_used_total: (profile.tokens_used_total || 0) + (inputTokens + outputTokens),
        stories_created: profile.stories_created + 1,
        words_generated: (profile.words_generated || 0) + content.split(/\s+/).length
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Database error updating profile:', updateError)
      // Note: Story was created but profile update failed - this should be logged for manual review
    }

    // Log generation for analytics
    const { error: logError } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        story_id: story.id,
        operation_type: 'foundation',
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: costUSD
      })

    if (logError) {
      console.error('Failed to log generation:', logError)
      // Non-critical error, continue
    }

    return NextResponse.json({ 
      story,
      tokensUsed: requiredTokens,
      remainingTokens: profile.tokens_remaining - requiredTokens
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/stories:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: ['An unexpected error occurred. Please try again.']
    }, { status: 500 })
  }
}

interface ModerationResult {
  isValid: boolean;
  reasons: string[];
}

async function moderateContent(content: string): Promise<ModerationResult> {
  const result: ModerationResult = {
    isValid: true,
    reasons: []
  }

  // Enhanced content moderation
  const prohibitedPatterns = [
    { pattern: /\b(explicit sexual|graphic sex|sexual violence)\b/gi, reason: 'explicit sexual content' },
    { pattern: /\b(graphic violence|gore|torture|dismemberment)\b/gi, reason: 'graphic violence' },
    { pattern: /\b(illegal drugs|drug dealing|terrorism|bomb making)\b/gi, reason: 'illegal activities' },
    { pattern: /\b(suicide methods|self-harm|cutting)\b/gi, reason: 'self-harm content' },
    { pattern: /\b(hate speech|racial slurs|nazi|white supremacy)\b/gi, reason: 'hate speech' },
    { pattern: /<script[^>]*>|javascript:|on\w+=/gi, reason: 'potential script injection' }
  ]

  const lowerContent = content.toLowerCase()
  
  for (const { pattern, reason } of prohibitedPatterns) {
    if (pattern.test(lowerContent)) {
      result.isValid = false
      result.reasons.push(reason)
    }
  }

  // Check for excessive length that might indicate prompt injection
  if (content.length > 50000) {
    result.isValid = false
    result.reasons.push('content too long')
  }

  // Check for potential prompt injection attempts
  const injectionPatterns = [
    /ignore previous instructions/gi,
    /forget everything above/gi,
    /new instructions:/gi,
    /system prompt/gi,
    /jailbreak/gi
  ]

  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      result.isValid = false
      result.reasons.push('potential prompt injection')
      break
    }
  }

  return result
}