import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  TOKEN_COSTS,
  SUBSCRIPTION_LIMITS,
  CLAUDE_PRICING,
  CONTENT_LIMITS,
  ALLOWED_GENRES,
  GENERATION_TYPES,
  SUBSCRIPTION_TIERS,
  MODERATION_PATTERNS,
  INJECTION_PATTERNS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  getSubscriptionLimits,
  calculateCost,
  type SubscriptionTier
} from '@/lib/constants'
import { subscriptionAwareRateLimit, logRateLimitViolation } from '@/lib/rateLimit'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Input validation schemas using constants
const createStorySchema = {
  title: {
    required: false,
    type: 'string' as const,
    minLength: 0,
    maxLength: CONTENT_LIMITS.STORY_TITLE_MAX_LENGTH,
    sanitize: true
  },
  genre: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: CONTENT_LIMITS.GENRE_MAX_LENGTH,
    allowedValues: [...ALLOWED_GENRES]
  },
  premise: {
    required: true,
    type: 'string' as const,
    minLength: CONTENT_LIMITS.PREMISE_MIN_LENGTH,
    maxLength: CONTENT_LIMITS.PREMISE_MAX_LENGTH,
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
    .substring(0, CONTENT_LIMITS.MAX_CONTENT_LENGTH) // Hard limit on length
}

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
  }

  // Apply rate limiting for general API requests
  const rateLimitResult = await subscriptionAwareRateLimit(
    request,
    'API_GENERAL',
    user.id,
    'free' // We'll get the actual tier below, but this is a fallback
  );

  if (!rateLimitResult.success) {
    logRateLimitViolation(`user:${user.id}`, 'API_GENERAL', request);
    return rateLimitResult.response!;
  }

  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select(`
        *,
        chapters (
          id, chapter_number, title, word_count, 
          generation_cost_usd, created_at
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Database error fetching stories:', error)
      return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
    }

    // Add rate limit headers to successful response
    const response = NextResponse.json({ stories })
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
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
    return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
  }

  try {
    // Get user profile first to determine subscription tier for rate limiting
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

    const subscriptionTier = profile.subscription_tier as SubscriptionTier

    // Apply rate limiting for story creation with subscription awareness
    const rateLimitResult = await subscriptionAwareRateLimit(
      request,
      'STORY_CREATION',
      user.id,
      subscriptionTier
    );

    if (!rateLimitResult.success) {
      logRateLimitViolation(`user:${user.id}`, 'STORY_CREATION', request);
      return rateLimitResult.response!;
    }

    // Parse and validate request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json({ error: ERROR_MESSAGES.INVALID_INPUT }, { status: 400 })
    }

    // Validate input
    const validation = validateInput(requestBody, createStorySchema)
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: ERROR_MESSAGES.INVALID_INPUT, 
        details: validation.errors 
      }, { status: 400 })
    }

    const { title, genre, premise } = validation.sanitizedData
    const limits = getSubscriptionLimits(subscriptionTier)

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

    if (monthlyCount >= limits.MONTHLY_STORIES) {
      return NextResponse.json({ 
        error: ERROR_MESSAGES.MONTHLY_LIMIT_REACHED,
        details: [
          `You have created ${monthlyCount} stories this month. ` +
          (subscriptionTier === SUBSCRIPTION_TIERS.FREE 
            ? 'Upgrade to Pro for more stories.' 
            : 'Contact support if you need a higher limit.')
        ]
      }, { status: 400 })
    }

    // Check token balance using constants
    const requiredTokens = TOKEN_COSTS.STORY_FOUNDATION
    if (profile.tokens_remaining < requiredTokens) {
      return NextResponse.json({ 
        error: ERROR_MESSAGES.INSUFFICIENT_TOKENS,
        details: [
          `${requiredTokens} tokens required for story foundation. ` +
          `You have ${profile.tokens_remaining} tokens remaining.`
        ]
      }, { status: 400 })
    }

    // Generate story foundation with Claude using constants
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
        model: CLAUDE_PRICING.MODEL,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    } catch (error) {
      console.error('Anthropic API error:', error)
      return NextResponse.json({ 
        error: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
        details: ['Please try again in a few moments.']
      }, { status: 503 })
    }

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
    const costUSD = calculateCost(inputTokens, outputTokens)

    // Parse AI response
    let foundation
    try {
      foundation = JSON.parse(content)
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, storing as text:', parseError)
      foundation = { content, rawResponse: true }
    }

    // Enhanced content moderation using constants
    const moderationResult = await moderateContent(content)
    if (!moderationResult.isValid) {
      console.warn('Content moderation failed:', moderationResult.reasons)
      return NextResponse.json({ 
        error: ERROR_MESSAGES.CONTENT_VIOLATION,
        details: ['Please try rephrasing your premise to avoid prohibited content.']
      }, { status: 400 })
    }

    const wordCount = content.split(/\s+/).length

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
        word_count: wordCount,
        chapter_count: 0
      })
      .select()
      .single()

    if (createError) {
      console.error('Database error creating story:', createError)
      return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
    }

    // Update user tokens and stats using constants
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        tokens_remaining: profile.tokens_remaining - requiredTokens,
        tokens_used_total: (profile.tokens_used_total || 0) + (inputTokens + outputTokens),
        stories_created: profile.stories_created + 1,
        words_generated: (profile.words_generated || 0) + wordCount
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Database error updating profile:', updateError)
      // Note: Story was created but profile update failed - this should be logged for manual review
    }

    // Log generation for analytics using constants
    const { error: logError } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        story_id: story.id,
        operation_type: GENERATION_TYPES.FOUNDATION,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_usd: costUSD
      })

    if (logError) {
      console.error('Failed to log generation:', logError)
      // Non-critical error, continue
    }

    // Create successful response with rate limit headers
    const response = NextResponse.json({ 
      story,
      tokensUsed: requiredTokens,
      remainingTokens: profile.tokens_remaining - requiredTokens,
      message: SUCCESS_MESSAGES.STORY_CREATED
    })

    // Add rate limit headers
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response

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
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

async function moderateContent(content: string): Promise<ModerationResult> {
  const result: ModerationResult = {
    isValid: true,
    reasons: [],
    severity: 'low',
    confidence: 0
  }

  const lowerContent = content.toLowerCase()
  let severityScore = 0
  let totalChecks = 0
  
  // Use constants for moderation patterns with severity scoring
  for (const { pattern, reason } of MODERATION_PATTERNS) {
    totalChecks++
    if (pattern.test(lowerContent)) {
      result.isValid = false
      result.reasons.push(reason)
      
      // Assign severity scores based on violation type
      switch (reason) {
        case 'explicit sexual content':
        case 'graphic violence':
        case 'hate speech':
          severityScore += 3
          break
        case 'illegal activities':
        case 'self-harm content':
          severityScore += 2
          break
        default:
          severityScore += 1
      }
    }
  }

  // Check for excessive length using constants
  if (content.length > CONTENT_LIMITS.MAX_CONTENT_LENGTH) {
    result.isValid = false
    result.reasons.push('content too long')
    severityScore += 1
    totalChecks++
  }

  // Check for potential prompt injection attempts using constants
  for (const pattern of INJECTION_PATTERNS) {
    totalChecks++
    if (pattern.test(content)) {
      result.isValid = false
      result.reasons.push('potential prompt injection')
      severityScore += 2
      break
    }
  }

  // Enhanced checks for AI-specific issues
  const aiPatterns = [
    { pattern: /ignore.{0,20}instructions/gi, reason: 'instruction bypass attempt', severity: 2 },
    { pattern: /assistant.{0,20}refuse/gi, reason: 'refusal bypass attempt', severity: 2 },
    { pattern: /roleplaying.{0,20}(evil|harmful)/gi, reason: 'harmful roleplay', severity: 2 },
    { pattern: /\b(jailbreak|DAN|do anything now)\b/gi, reason: 'jailbreak attempt', severity: 3 }
  ]

  for (const { pattern, reason, severity } of aiPatterns) {
    totalChecks++
    if (pattern.test(content)) {
      result.isValid = false
      result.reasons.push(reason)
      severityScore += severity
    }
  }

  // Calculate confidence and severity
  result.confidence = Math.min(1, severityScore / Math.max(totalChecks, 1))
  
  if (severityScore >= 5) {
    result.severity = 'high'
  } else if (severityScore >= 2) {
    result.severity = 'medium'
  } else if (severityScore >= 1) {
    result.severity = 'low'
  }

  // Additional context-aware checks
  const suspiciousPatterns = [
    /\b(bomb|weapon|kill|murder|death)\b.*\b(how|make|create|build)\b/gi,
    /\b(drug|narcotic)\b.*\b(synthesize|manufacture|cook)\b/gi,
    /\b(hack|exploit|breach)\b.*\b(system|database|account)\b/gi
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      result.isValid = false
      result.reasons.push('suspicious instructional content')
      result.severity = 'high'
      break
    }
  }

  // Log moderation results for improvement
  if (!result.isValid) {
    console.warn('Content moderation violation:', {
      reasons: result.reasons,
      severity: result.severity,
      confidence: result.confidence,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    })
  }

  return result
}