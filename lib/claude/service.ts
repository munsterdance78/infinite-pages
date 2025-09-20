import Anthropic from '@anthropic-ai/sdk'
import { 
  CLAUDE_PRICING, 
  calculateCost, 
  ERROR_MESSAGES,
  CONTENT_LIMITS,
  MODERATION_PATTERNS,
  INJECTION_PATTERNS
} from '@/lib/constants'
import { claudeCache } from './cache'
import { analyticsService } from './analytics'
import { promptTemplateManager } from './prompts'

// Enhanced Claude service with better error handling and features
export class ClaudeService {
  private anthropic: Anthropic
  private defaultModel: string

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
    this.defaultModel = CLAUDE_PRICING.MODEL
  }

  /**
   * Generate content with Claude using enhanced error handling and retry logic
   */
  async generateContent({
    prompt,
    model = this.defaultModel,
    maxTokens = 4000,
    temperature = 0.7,
    systemPrompt,
    retries = 3,
    useCache = true,
    userId,
    operation = 'general',
    trackAnalytics = true
  }: {
    prompt: string
    model?: string
    maxTokens?: number
    temperature?: number
    systemPrompt?: string
    retries?: number
    useCache?: boolean
    userId?: string
    operation?: string
    trackAnalytics?: boolean
  }) {
    // Validate input
    this.validateInput(prompt)
    
    // Check for prompt injection
    if (this.detectPromptInjection(prompt)) {
      throw new Error('Potential prompt injection detected')
    }

    // Check cache first if enabled
    if (useCache) {
      const cacheKey = claudeCache.getCachedResponse(prompt, {
        operation,
        cacheOptions: { model, maxTokens, temperature, systemPrompt }
      })
      
      if (cacheKey) {
        if (trackAnalytics) {
          await analyticsService.trackOperation({
            userId: userId || 'anonymous',
            operation,
            model,
            inputTokens: cacheKey.usage.inputTokens,
            outputTokens: cacheKey.usage.outputTokens,
            cost: cacheKey.cost,
            responseTime: 0,
            success: true,
            cached: true
          })
        }
        return cacheKey
      }
    }

    const messages = [
      ...(systemPrompt ? [{ role: 'user' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ]

    let lastError: any
    const startTime = Date.now()
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.anthropic.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          messages
        })

        const content = response.content[0]?.type === 'text' 
          ? response.content[0].text 
          : ''

        const usage = response.usage
        const cost = calculateCost(usage.input_tokens, usage.output_tokens)
        const responseTime = Date.now() - startTime

        // Moderate content for safety
        const moderationResult = await this.moderateContent(content)
        if (!moderationResult.isValid) {
          throw new Error(`Content moderation failed: ${moderationResult.reason}`)
        }

        const result = {
          content,
          usage: {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens
          },
          cost,
          model: response.model,
          attempt,
          responseTime
        }

        // Cache the result if enabled
        if (useCache) {
          claudeCache.cacheResponse(prompt, {
            content,
            usage: result.usage,
            model
          }, {
            operation,
            userId,
            cacheOptions: { model, maxTokens, temperature, systemPrompt }
          })
        }

        // Track analytics
        if (trackAnalytics) {
          await analyticsService.trackOperation({
            userId: userId || 'anonymous',
            operation,
            model,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cost,
            responseTime,
            success: true,
            cached: false
          })
        }

        return result
      } catch (error: any) {
        lastError = error
        
        // Track failed analytics
        if (trackAnalytics) {
          await analyticsService.trackOperation({
            userId: userId || 'anonymous',
            operation,
            model,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            responseTime: Date.now() - startTime,
            success: false,
            error: error.message,
            cached: false
          })
        }
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw this.handleClaudeError(error)
        }

        // Exponential backoff for retries
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw this.handleClaudeError(lastError)
  }

  /**
   * Generate story foundation with structured prompt
   */
  async generateStoryFoundation({
    title,
    genre,
    premise
  }: {
    title?: string
    genre: string
    premise: string
  }) {
    const systemPrompt = 'You are a professional story architect and creative writing expert. Your task is to create comprehensive, engaging story foundations that serve as blueprints for complete novels. Focus on creating compelling characters, well-structured plots, and rich thematic elements.'

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
      "description": "Detailed character description including appearance, personality, background",
      "motivation": "What drives this character",
      "arc": "How this character will change throughout the story"
    }
  ],
  "setting": {
    "time": "When the story takes place (specific era, season, etc.)",
    "place": "Where the story takes place (specific locations)",
    "atmosphere": "Mood and tone of the setting",
    "worldbuilding": "Unique aspects of this world"
  },
  "plotStructure": {
    "incitingIncident": "What kicks off the story",
    "risingAction": "Key conflicts and complications that build tension",
    "climax": "The story's turning point and highest tension",
    "fallingAction": "How tensions begin to resolve",
    "resolution": "How conflicts are ultimately resolved"
  },
  "themes": ["Primary themes and messages of the story"],
  "tone": "Overall tone and style (e.g., dark and gritty, light and humorous, etc.)",
  "targetAudience": "Who this story is intended for",
  "chapterOutline": [
    {
      "number": 1,
      "title": "Chapter title",
      "summary": "What happens in this chapter",
      "purpose": "How this chapter serves the overall story",
      "keyEvents": ["Important events that occur"],
      "characterDevelopment": "How characters grow or change"
    }
  ]
}

Make this foundation comprehensive, engaging, and detailed. This will serve as the blueprint for writing a complete novel.`

    return this.generateContent({
      prompt,
      systemPrompt,
      maxTokens: 4000
    })
  }

  /**
   * Generate a chapter with context from previous chapters
   */
  async generateChapter({
    storyContext,
    chapterNumber,
    previousChapters,
    targetWordCount = 2000
  }: {
    storyContext: string
    chapterNumber: number
    previousChapters: Array<{ number: number; content: string; summary: string }>
    targetWordCount?: number
  }) {
    const systemPrompt = 'You are a professional novelist and creative writing expert. Your task is to write compelling, well-crafted chapters that advance the story while maintaining consistency with established characters, plot, and themes. Focus on engaging dialogue, vivid descriptions, and meaningful character development.'

    const previousContext = previousChapters.length > 0
      ? `Previous Chapters Context:\n${previousChapters.map(ch => 
          `Chapter ${ch.number}: ${ch.summary}\n${ch.content.slice(-500)}...`
        ).join('\n\n')}`
      : 'This is the first chapter.'

    const prompt = `Write Chapter ${chapterNumber} for this story:

${storyContext}

${previousContext}

Please write a complete chapter that:
- Is approximately ${targetWordCount} words
- Maintains consistency with the story foundation and previous chapters
- Flows naturally from previous chapters (if any)
- Advances the plot meaningfully
- Includes engaging dialogue and vivid descriptions
- Develops characters in meaningful ways
- Ends with appropriate tension or resolution for this point in the story
- Uses proper pacing for this stage of the story

Return the response as JSON:
{
  "title": "Chapter ${chapterNumber} title",
  "content": "The full chapter content",
  "summary": "Brief summary of what happens in this chapter",
  "wordCount": number_of_words,
  "keyEvents": ["Important events that occur in this chapter"],
  "characterDevelopment": "How characters grow or change in this chapter",
  "foreshadowing": "Any hints or foreshadowing for future events"
}

Make this chapter compelling, well-written, and integral to the overall story.`

    return this.generateContent({
      prompt,
      systemPrompt,
      maxTokens: 6000
    })
  }

  /**
   * Improve existing content with specific feedback
   */
  async improveContent({
    content,
    feedback,
    improvementType = 'general'
  }: {
    content: string
    feedback: string
    improvementType?: 'general' | 'dialogue' | 'description' | 'pacing' | 'character'
  }) {
    const systemPrompt = 'You are a professional editor and writing coach. Your task is to improve existing content based on specific feedback while maintaining the author\'s voice and style. Focus on enhancing clarity, engagement, and overall quality.'

    const prompt = `Please improve the following content based on the feedback provided:

CONTENT TO IMPROVE:
${content}

FEEDBACK:
${feedback}

IMPROVEMENT TYPE: ${improvementType}

Return the improved content as JSON:
{
  "improvedContent": "The enhanced version of the content",
  "changes": ["List of specific changes made"],
  "reasoning": "Explanation of why these improvements were made",
  "wordCount": number_of_words,
  "improvementAreas": ["Areas that were specifically addressed"]
}

Focus on making meaningful improvements that enhance the overall quality while preserving the original intent and voice.`

    return this.generateContent({
      prompt,
      systemPrompt,
      maxTokens: 4000
    })
  }

  /**
   * Analyze content for various metrics and suggestions
   */
  async analyzeContent(content: string) {
    const systemPrompt = 'You are a professional literary analyst and writing coach. Your task is to analyze content and provide detailed insights about writing quality, structure, and potential improvements.'

    const prompt = `Analyze the following content and provide a comprehensive assessment:

CONTENT:
${content}

Return your analysis as JSON:
{
  "overallQuality": "excellent|good|fair|needs_work",
  "wordCount": number_of_words,
  "readabilityScore": "score out of 100",
  "strengths": ["What the content does well"],
  "areasForImprovement": ["Areas that could be enhanced"],
  "writingStyle": {
    "tone": "Overall tone detected",
    "pacing": "Assessment of pacing",
    "dialogue": "Quality of dialogue (if present)",
    "description": "Quality of descriptions"
  },
  "suggestions": ["Specific actionable suggestions for improvement"],
  "targetAudience": "Who this content would appeal to",
  "genreAlignment": "How well it fits typical genre conventions"
}

Provide honest, constructive feedback that will help improve the writing quality.`

    return this.generateContent({
      prompt,
      systemPrompt,
      maxTokens: 2000
    })
  }

  /**
   * Content moderation for safety
   */
  private async moderateContent(content: string): Promise<{ isValid: boolean; reason?: string }> {
    // Check against moderation patterns
    for (const { pattern, reason } of MODERATION_PATTERNS) {
      if (pattern.test(content)) {
        return { isValid: false, reason }
      }
    }

    // Additional AI-powered moderation could be added here
    return { isValid: true }
  }

  /**
   * Detect potential prompt injection attempts
   */
  private detectPromptInjection(prompt: string): boolean {
    return INJECTION_PATTERNS.some(pattern => pattern.test(prompt))
  }

  /**
   * Validate input parameters
   */
  private validateInput(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty')
    }

    if (prompt.length > CONTENT_LIMITS.MAX_CONTENT_LENGTH) {
      throw new Error(`Prompt exceeds maximum length of ${CONTENT_LIMITS.MAX_CONTENT_LENGTH} characters`)
    }
  }

  /**
   * Handle Claude API errors with appropriate responses
   */
  private handleClaudeError(error: any) {
    console.error('Claude API error:', error)

    if (error?.status === 429) {
      return new Error('Rate limit exceeded. Please wait a moment before trying again.')
    }

    if (error?.status === 401) {
      return new Error('API authentication failed. Please contact support.')
    }

    if (error?.status === 400) {
      return new Error('Invalid request. Please check your input and try again.')
    }

    if (error?.status >= 500) {
      return new Error('Claude service is temporarily unavailable. Please try again later.')
    }

    return new Error(error?.message || 'An unexpected error occurred with Claude.')
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryableStatuses = [400, 401, 403, 422]
    return nonRetryableStatuses.includes(error?.status)
  }

  /**
   * Generate content using a prompt template
   */
  async generateWithTemplate(
    templateId: string,
    variables: Array<{ name: string; value: any }>,
    options: {
      model?: string
      maxTokens?: number
      temperature?: number
      userId?: string
      useCache?: boolean
      trackAnalytics?: boolean
    } = {}
  ) {
    const template = promptTemplateManager.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    const prompt = promptTemplateManager.renderTemplate(templateId, variables)
    
    return this.generateContent({
      prompt,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      userId: options.userId,
      operation: template.category,
      useCache: options.useCache,
      trackAnalytics: options.trackAnalytics
    })
  }

  /**
   * Batch generate content using multiple prompts
   */
  async batchGenerate(
    prompts: Array<{
      id: string
      prompt: string
      model?: string
      maxTokens?: number
      temperature?: number
      userId?: string
      operation?: string
    }>,
    options: {
      maxConcurrency?: number
      useCache?: boolean
      trackAnalytics?: boolean
    } = {}
  ) {
    const { batchProcessor } = await import('./batch')
    
    const operations = prompts.map(prompt => ({
      id: prompt.id,
      type: prompt.operation || 'general' as any,
      params: {
        prompt: prompt.prompt,
        model: prompt.model,
        maxTokens: prompt.maxTokens,
        temperature: prompt.temperature
      },
      userId: prompt.userId
    }))

    batchProcessor.addOperations(operations)
    return await batchProcessor.processBatch()
  }

  /**
   * Get analytics data
   */
  async getAnalytics(timeRange?: { start: Date; end: Date }) {
    return await analyticsService.getAnalytics(timeRange)
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return claudeCache.getStats()
  }

  /**
   * Clear cache
   */
  clearCache() {
    claudeCache.clear()
  }

  /**
   * Get prompt templates
   */
  getPromptTemplates(category?: string) {
    if (category) {
      return promptTemplateManager.getTemplatesByCategory(category)
    }
    return promptTemplateManager.getAllTemplates()
  }

  /**
   * Search prompt templates
   */
  searchPromptTemplates(query: string) {
    return promptTemplateManager.searchTemplates(query)
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return [
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance and cost' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable, highest cost' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, most cost-effective' }
    ]
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    const cacheStats = this.getCacheStats()
    const analytics = await this.getAnalytics({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    })

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache: {
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        hitRate: 0 // Would need to track this separately
      },
      analytics: {
        totalRequests: analytics.totalRequests,
        successRate: analytics.successRate,
        averageResponseTime: analytics.averageResponseTime
      },
      models: this.getAvailableModels()
    }
  }
}

// Export singleton instance
export const claudeService = new ClaudeService()
