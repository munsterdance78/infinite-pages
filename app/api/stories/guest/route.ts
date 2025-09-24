import { NextResponse, type NextRequest } from 'next/server'
import { claudeService } from '@/lib/claude'
import { subscriptionAwareRateLimit, logRateLimitViolation } from '@/lib/rateLimit'
import {
  ESTIMATED_CREDIT_COSTS,
  CONTENT_LIMITS,
  ALLOWED_GENRES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} from '@/lib/constants'
import { getClientIdentifier } from '@/lib/rateLimit'

// Guest mode limitations
const GUEST_LIMITS = {
  MAX_STORIES_PER_IP: 3,
  MAX_STORY_LENGTH: 2000, // characters
  ALLOWED_GENRES: ['fantasy', 'mystery', 'romance', 'sci-fi', 'adventure']
}

// Input validation for guest stories
const guestStorySchema = {
  title: {
    required: false,
    type: 'string' as const,
    minLength: 0,
    maxLength: 100,
    sanitize: true
  },
  genre: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 50,
    allowedValues: GUEST_LIMITS.ALLOWED_GENRES
  },
  premise: {
    required: true,
    type: 'string' as const,
    minLength: 10,
    maxLength: 500,
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

function validateInput(data: any, schema: ValidationSchema): { isValid: boolean; errors: string[]; sanitizedData: any } {
  const errors: string[] = []
  const sanitizedData: any = {}

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field]

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }

    if (!rule.required && (value === undefined || value === null || value === '')) {
      sanitizedData[field] = rule.type === 'string' ? '' : null
      continue
    }

    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`)
      continue
    }

    if (rule.type === 'string') {
      const stringValue = value as string

      if (rule.minLength !== undefined && stringValue.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters long`)
        continue
      }

      if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) {
        errors.push(`${field} must not exceed ${rule.maxLength} characters`)
        continue
      }

      if (rule.allowedValues && !rule.allowedValues.includes(stringValue)) {
        errors.push(`${field} must be one of: ${rule.allowedValues.join(', ')}`)
        continue
      }

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
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .substring(0, CONTENT_LIMITS.MAX_CONTENT_LENGTH)
}

export async function POST(request: NextRequest) {
  try {
    // Get client identifier for rate limiting
    const clientId = getClientIdentifier(request)

    // Apply guest rate limiting (more restrictive)
    const rateLimitResult = await subscriptionAwareRateLimit(
      request,
      'GUEST_STORY_CREATION',
      clientId,
      'guest'
    )

    if (!rateLimitResult.success) {
      logRateLimitViolation(clientId, 'GUEST_STORY_CREATION', request)
      return rateLimitResult.response!
    }

    // Parse and validate request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json({ error: ERROR_MESSAGES.INVALID_INPUT }, { status: 400 })
    }

    // Validate input
    const validation = validateInput(requestBody, guestStorySchema)
    if (!validation.isValid) {
      return NextResponse.json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        details: validation.errors
      }, { status: 400 })
    }

    const { title, genre, premise } = validation.sanitizedData

    // Generate story foundation using Claude
    let claudeResponse
    try {
      claudeResponse = await claudeService.generateStoryFoundation({
        title: title || 'Demo Story',
        genre,
        premise
      })
    } catch (error: any) {
      console.error('Claude service error:', error)
      return NextResponse.json({
        error: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
        details: ['Please try again in a few moments.']
      }, { status: 503 })
    }

    const content = claudeResponse.content
    const inputTokens = claudeResponse.usage?.inputTokens || 0
    const outputTokens = claudeResponse.usage?.outputTokens || 0
    const costUSD = claudeResponse.cost || 0

    // Parse AI response
    let foundation
    try {
      foundation = typeof content === 'string' ? JSON.parse(content) : content
    } catch (parseError) {
      console.warn('Failed to parse AI response as JSON, storing as text:', parseError)
      foundation = { content, rawResponse: true }
    }

    // Moderate content
    const moderationResult = await moderateContent(content)
    if (!moderationResult.isValid) {
      console.warn('Content moderation failed:', moderationResult.reasons)
      return NextResponse.json({
        error: ERROR_MESSAGES.CONTENT_VIOLATION,
        details: ['Please try rephrasing your premise to avoid prohibited content.']
      }, { status: 400 })
    }

    const wordCount = content.split(/\s+/).length

    // Create guest story object (not stored in database)
    const guestStory = {
      id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'Demo Story',
      genre,
      premise,
      foundation,
      total_tokens_used: inputTokens + outputTokens,
      total_cost_usd: costUSD,
      status: 'demo',
      word_count: wordCount,
      chapter_count: 0,
      created_at: new Date().toISOString(),
      isGuest: true,
      limitations: {
        maxLength: GUEST_LIMITS.MAX_STORY_LENGTH,
        canSave: false,
        canExport: false,
        requiresSignup: 'To save, export, or continue this story, please create an account'
      }
    }

    // Create successful response with rate limit headers
    const response = NextResponse.json({
      story: guestStory,
      message: `${SUCCESS_MESSAGES.STORY_CREATED} (Demo Mode - Sign up to save)`,
      guestMode: true,
      limitations: guestStory.limitations
    }, { headers: { 'Content-Type': 'application/json' } })

    // Add rate limit headers
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response

  } catch (error) {
    console.error('Unexpected error in guest story creation:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: ['An unexpected error occurred. Please try again.']
    }, { status: 500, headers: { 'Content-Type': 'application/json' } })
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

  // Basic content moderation for guest mode
  const prohibitedPatterns = [
    { pattern: /\b(kill|murder|death|violence|blood)\b/gi, reason: 'violent content' },
    { pattern: /\b(sex|sexual|nude|naked)\b/gi, reason: 'sexual content' },
    { pattern: /\b(hate|racist|nazi)\b/gi, reason: 'hate speech' },
    { pattern: /\b(drug|cocaine|heroin)\b/gi, reason: 'drug references' }
  ]

  for (const { pattern, reason } of prohibitedPatterns) {
    if (pattern.test(lowerContent)) {
      result.isValid = false
      result.reasons.push(reason)
      result.severity = 'medium'
    }
  }

  // Check length
  if (content.length > GUEST_LIMITS.MAX_STORY_LENGTH) {
    result.isValid = false
    result.reasons.push('content too long for demo mode')
    result.severity = 'low'
  }

  return result
}