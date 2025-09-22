import { ClaudeService } from './service'
import type { EnhancedBatchOperation } from './advanced-batch-processor'
import { advancedBatchProcessor } from './advanced-batch-processor'
import type { TaskProfile } from './intelligent-model-selector'
import { intelligentModelSelector } from './intelligent-model-selector'
import { enhancedCostAnalytics, trackAIOperation } from './enhanced-cost-analytics'
import { optimizedPromptTemplateManager } from './prompt-templates'

export interface OptimizedAIRequest {
  id?: string
  userId: string
  type: 'foundation' | 'chapter' | 'improvement' | 'analysis' | 'general'
  params: any
  options?: {
    priority?: number // 1-10
    urgency?: 'immediate' | 'normal' | 'low'
    maxBudget?: number
    qualityThreshold?: number // 1-10
    deadline?: Date
    useOptimizedPrompts?: boolean
    enableAutoOptimization?: boolean
    trackPerformance?: boolean
  }
}

export interface OptimizationResult {
  success: boolean
  operationId: string
  content?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  cost: number
  optimizations: {
    modelSelected: string
    templateUsed?: string
    tokensSaved: number
    costSaved: number
    cacheHit: boolean
    batchProcessed: boolean
  }
  performance: {
    responseTime: number
    qualityScore?: number
  }
  recommendations: string[]
  error?: string
}

export interface SystemWideOptimizationReport {
  timeRange: { start: Date; end: Date }
  totalOperations: number
  totalCostSaved: number
  optimizationBreakdown: {
    promptTemplates: { operations: number; saved: number }
    modelOptimization: { operations: number; saved: number }
    caching: { operations: number; saved: number }
    batching: { operations: number; saved: number }
  }
  topPerformingOptimizations: Array<{
    type: string
    description: string
    totalSaved: number
    operationsImpacted: number
  }>
  userBenefits: Array<{
    userId: string
    totalSaved: number
    optimizationsApplied: number
    costReduction: number // percentage
  }>
}

/**
 * Central hub for AI cost optimization
 */
export class AICostOptimizationHub {
  private claudeService: ClaudeService
  private operationHistory: Map<string, OptimizationResult[]> = new Map()

  constructor(claudeService: ClaudeService) {
    this.claudeService = claudeService
  }

  /**
   * Process AI request with comprehensive optimization
   */
  async processOptimizedRequest(request: OptimizedAIRequest): Promise<OptimizationResult> {
    const startTime = Date.now()
    const operationId = request.id || this.generateOperationId()

    try {
      // 1. Analyze request and determine optimization strategy
      const optimizationStrategy = await this.analyzeOptimizationStrategy(request)

      // 2. Apply optimizations
      const optimizedRequest = await this.applyOptimizations(request, optimizationStrategy)

      // 3. Execute the request
      const result = await this.executeOptimizedRequest(optimizedRequest)

      // 4. Track performance and costs
      const performance = {
        responseTime: Date.now() - startTime,
        qualityScore: await this.assessQuality(result.content, request.type)
      }

      // 5. Record analytics
      trackAIOperation(
        request.userId,
        request.type,
        optimizationStrategy.selectedModel,
        result.usage?.inputTokens || 0,
        result.usage?.outputTokens || 0,
        result.cost,
        {
          qualityScore: performance.qualityScore,
          responseTime: performance.responseTime,
          cacheHit: result.cached || false,
          ...((optimizedRequest as any).batchId && { batchId: (optimizedRequest as any).batchId }),
          ...(optimizationStrategy.templateUsed && { promptTemplate: optimizationStrategy.templateUsed })
        }
      )

      // 6. Generate optimization report
      const optimizationResult: OptimizationResult = {
        success: true,
        operationId,
        content: result.content,
        usage: result.usage,
        cost: result.cost,
        optimizations: {
          modelSelected: optimizationStrategy.selectedModel,
          tokensSaved: optimizationStrategy.tokensSaved,
          costSaved: optimizationStrategy.costSaved,
          cacheHit: result.cached || false,
          batchProcessed: !!(optimizedRequest as any).batchId,
          ...(optimizationStrategy.templateUsed && { templateUsed: optimizationStrategy.templateUsed })
        },
        performance,
        recommendations: this.generateRecommendations(request, optimizationStrategy, result)
      }

      // Store in history
      this.recordOperation(request.userId, optimizationResult)

      return optimizationResult

    } catch (error: any) {
      const errorResult: OptimizationResult = {
        success: false,
        operationId,
        cost: 0,
        optimizations: {
          modelSelected: 'none',
          tokensSaved: 0,
          costSaved: 0,
          cacheHit: false,
          batchProcessed: false
        },
        performance: {
          responseTime: Date.now() - startTime
        },
        recommendations: ['Operation failed - consider retrying with simpler parameters'],
        error: error.message
      }

      this.recordOperation(request.userId, errorResult)
      return errorResult
    }
  }

  /**
   * Analyze and determine optimization strategy
   */
  private async analyzeOptimizationStrategy(request: OptimizedAIRequest): Promise<{
    selectedModel: string
    templateUsed?: string
    tokensSaved: number
    costSaved: number
    confidence: number
    reasoning: string[]
  }> {
    // Create task profile for model selection
    const taskProfile: TaskProfile = {
      type: request.type,
      complexity: this.determineComplexity(request),
      creativityRequired: this.determineCreativityRequirement(request),
      reasoningRequired: this.determineReasoningRequirement(request),
      speedRequired: request.options?.urgency === 'immediate' ? 9 : 5,
      qualityThreshold: request.options?.qualityThreshold || 7,
      estimatedTokens: this.estimateTokens(request),
      ...(request.options?.maxBudget && { maxBudget: request.options.maxBudget })
    }

    // Get model recommendation
    const modelRecommendation = intelligentModelSelector.selectOptimalModel(taskProfile)

    // Check for optimized prompt template
    let templateUsed: string | undefined
    let tokensSaved = 0
    let costSaved = 0

    if (request.options?.useOptimizedPrompts !== false) {
      const template = this.findOptimalTemplate(request)
      if (template) {
        templateUsed = template.id
        tokensSaved = this.estimateTemplateSavings(request, template)
        costSaved = tokensSaved * 0.000003 // Estimate using Sonnet input pricing
      }
    }

    // Add model selection cost savings
    const originalModelCost = this.calculateCostForModel('claude-3-sonnet-20240229', taskProfile.estimatedTokens)
    const selectedModelCost = modelRecommendation.expectedCost
    costSaved += Math.max(0, originalModelCost - selectedModelCost)

    return {
      selectedModel: modelRecommendation.selectedModel,
      tokensSaved,
      costSaved,
      confidence: modelRecommendation.confidence,
      reasoning: modelRecommendation.reasoning,
      ...(templateUsed && { templateUsed })
    }
  }

  /**
   * Apply optimizations to the request
   */
  private async applyOptimizations(
    request: OptimizedAIRequest,
    strategy: any
  ): Promise<EnhancedBatchOperation> {
    const optimizedRequest: EnhancedBatchOperation = {
      id: request.id || this.generateOperationId(),
      type: request.type,
      params: { ...request.params },
      priority: request.options?.priority || 5,
      urgency: request.options?.urgency || 'normal',
      userId: request.userId,
      model: this.getModelShortName(strategy.selectedModel),
      templateId: strategy.templateUsed,
      ...(request.options?.deadline && { deadline: request.options.deadline }),
      ...(request.options?.maxBudget && { costThreshold: request.options.maxBudget })
    } as EnhancedBatchOperation

    // Apply template optimization if available
    if (strategy.templateUsed) {
      optimizedRequest.params.useTemplate = true
      optimizedRequest.params.templateId = strategy.templateUsed
    }

    return optimizedRequest
  }

  /**
   * Execute the optimized request
   */
  private async executeOptimizedRequest(request: EnhancedBatchOperation): Promise<any> {
    // Check if this should be processed immediately or batched
    if (request.urgency === 'immediate' || request.priority >= 8) {
      // Process immediately
      return await this.processImmediateRequest(request)
    } else {
      // Add to batch processor
      advancedBatchProcessor.addOperation(request)
      return await advancedBatchProcessor.waitForResults([request.id])
        .then(results => results[0])
    }
  }

  /**
   * Process immediate request without batching
   */
  private async processImmediateRequest(request: EnhancedBatchOperation): Promise<any> {
    const modelName = this.getFullModelName(request.model || 'sonnet')

    if (request.templateId) {
      // Use optimized template
      const variables = request.params.templateVariables || []
      return await this.claudeService.generateWithTemplate(
        request.templateId,
        variables,
        {
          model: modelName,
          ...(request.userId && { userId: request.userId }),
          ...(request.params.maxTokens && { maxTokens: request.params.maxTokens }),
          ...(request.params.temperature && { temperature: request.params.temperature })
        }
      )
    } else {
      // Standard processing
      switch (request.type) {
        case 'foundation':
          return await this.claudeService.generateStoryFoundation({
            ...request.params,
            model: modelName
          })
        case 'chapter':
          return await this.claudeService.generateChapter({
            ...request.params,
            model: modelName
          })
        case 'improvement':
          return await this.claudeService.improveContent({
            ...request.params,
            model: modelName
          })
        case 'analysis':
          return await this.claudeService.analyzeContent(request.params.content)
        default:
          return await this.claudeService.generateContent({
            ...request.params,
            model: modelName
          })
      }
    }
  }

  /**
   * Assess content quality
   */
  private async assessQuality(content: string | undefined, type: string): Promise<number> {
    if (!content) return 0

    // Simple heuristic quality assessment
    let score = 5 // Base score

    // Length appropriateness
    if (type === 'chapter' && content.length > 1000) score += 1
    if (type === 'foundation' && content.length > 500) score += 1

    // Structure (JSON validation for structured responses)
    try {
      if (content.includes('{') && content.includes('}')) {
        JSON.parse(content)
        score += 1 // Valid JSON structure
      }
    } catch {
      // Not JSON or invalid - no penalty for non-JSON content
    }

    // Content richness (basic indicators)
    if (content.includes('dialogue') || content.includes('"')) score += 0.5
    if (content.includes('character') || content.includes('plot')) score += 0.5

    return Math.min(10, Math.max(1, score))
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    request: OptimizedAIRequest,
    strategy: any,
    result: any
  ): string[] {
    const recommendations: string[] = []

    // Cost optimization recommendations
    if (strategy.costSaved > 0.01) {
      recommendations.push(`💰 Saved $${strategy.costSaved.toFixed(4)} through optimization`)
    }

    if (strategy.templateUsed) {
      recommendations.push('📝 Used optimized template to reduce token usage')
    }

    // Future optimization suggestions
    if (!request.options?.useOptimizedPrompts) {
      recommendations.push('🚀 Enable optimized prompts to save ~20-30% on costs')
    }

    if (request.options?.urgency === 'immediate' && (request.options?.priority || 0) < 8) {
      recommendations.push('⚡ Consider batch processing for non-urgent requests to save costs')
    }

    // Quality suggestions
    if (strategy.confidence < 0.7) {
      recommendations.push('🎯 Consider providing more specific requirements for better results')
    }

    return recommendations
  }

  /**
   * Batch process multiple requests with optimization
   */
  async processBatch(requests: OptimizedAIRequest[]): Promise<Map<string, OptimizationResult>> {
    const results = new Map<string, OptimizationResult>()

    // Group requests by similarity for batch optimization
    const groupedRequests = this.groupSimilarRequests(requests)

    for (const group of groupedRequests) {
      // Apply batch-level optimizations
      const batchOptimization = await this.optimizeBatch(group)

      // Process the optimized batch
      const batchResults = await this.processBatchGroup(group, batchOptimization)

      // Merge results
      batchResults.forEach((result, id) => {
        results.set(id, result)
      })
    }

    return results
  }

  /**
   * Get system-wide optimization report
   */
  async getSystemOptimizationReport(
    timeRange: { start: Date; end: Date }
  ): Promise<SystemWideOptimizationReport> {
    // Aggregate data from all users
    const allOperations = Array.from(this.operationHistory.values()).flat()
    const operationsInRange = allOperations.filter(op =>
      op.operationId && // Ensure we have timestamp data
      new Date(op.operationId) >= timeRange.start &&
      new Date(op.operationId) <= timeRange.end
    )

    const totalOperations = operationsInRange.length
    const totalCostSaved = operationsInRange.reduce((sum, op) => sum + op.optimizations.costSaved, 0)

    // Calculate optimization breakdown
    const optimizationBreakdown = {
      promptTemplates: {
        operations: operationsInRange.filter(op => op.optimizations.templateUsed).length,
        saved: operationsInRange
          .filter(op => op.optimizations.templateUsed)
          .reduce((sum, op) => sum + op.optimizations.costSaved, 0)
      },
      modelOptimization: {
        operations: operationsInRange.filter(op =>
          !op.optimizations.modelSelected.includes('sonnet')
        ).length,
        saved: operationsInRange
          .filter(op => !op.optimizations.modelSelected.includes('sonnet'))
          .reduce((sum, op) => sum + op.optimizations.costSaved, 0)
      },
      caching: {
        operations: operationsInRange.filter(op => op.optimizations.cacheHit).length,
        saved: operationsInRange.filter(op => op.optimizations.cacheHit).length * 0.01 // Estimate
      },
      batching: {
        operations: operationsInRange.filter(op => op.optimizations.batchProcessed).length,
        saved: operationsInRange.filter(op => op.optimizations.batchProcessed).length * 0.005 // Estimate
      }
    }

    // Top performing optimizations
    const topPerformingOptimizations = [
      {
        type: 'Model Optimization',
        description: 'Automatic selection of cost-efficient models',
        totalSaved: optimizationBreakdown.modelOptimization.saved,
        operationsImpacted: optimizationBreakdown.modelOptimization.operations
      },
      {
        type: 'Prompt Templates',
        description: 'Optimized prompt templates for token efficiency',
        totalSaved: optimizationBreakdown.promptTemplates.saved,
        operationsImpacted: optimizationBreakdown.promptTemplates.operations
      },
      {
        type: 'Intelligent Caching',
        description: 'Cache hit optimization for repeated requests',
        totalSaved: optimizationBreakdown.caching.saved,
        operationsImpacted: optimizationBreakdown.caching.operations
      }
    ].sort((a, b) => b.totalSaved - a.totalSaved)

    // User benefits (mock data - would need user tracking)
    const userBenefits = Array.from(this.operationHistory.entries()).map(([userId, operations]) => {
      const userOpsInRange = operations.filter(op =>
        op.operationId && // Ensure timestamp
        new Date(op.operationId) >= timeRange.start &&
        new Date(op.operationId) <= timeRange.end
      )

      const totalSaved = userOpsInRange.reduce((sum, op) => sum + op.optimizations.costSaved, 0)
      const optimizationsApplied = userOpsInRange.filter(op =>
        op.optimizations.costSaved > 0
      ).length

      return {
        userId,
        totalSaved,
        optimizationsApplied,
        costReduction: userOpsInRange.length > 0 ?
          (totalSaved / (userOpsInRange.reduce((sum, op) => sum + op.cost, 0) + totalSaved)) * 100 : 0
      }
    }).filter(user => user.totalSaved > 0)
      .sort((a, b) => b.totalSaved - a.totalSaved)
      .slice(0, 10) // Top 10 users

    return {
      timeRange,
      totalOperations,
      totalCostSaved,
      optimizationBreakdown,
      topPerformingOptimizations,
      userBenefits
    }
  }

  // Helper methods
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private recordOperation(userId: string, result: OptimizationResult): void {
    if (!this.operationHistory.has(userId)) {
      this.operationHistory.set(userId, [])
    }

    const userHistory = this.operationHistory.get(userId)!
    userHistory.push(result)

    // Keep only last 1000 operations per user
    if (userHistory.length > 1000) {
      userHistory.shift()
    }
  }

  private determineComplexity(request: OptimizedAIRequest): 'simple' | 'medium' | 'complex' {
    if (request.type === 'analysis') return 'simple'
    if (request.type === 'foundation') return 'complex'
    return 'medium'
  }

  private determineCreativityRequirement(request: OptimizedAIRequest): number {
    const creativityMap = {
      foundation: 9,
      chapter: 8,
      improvement: 6,
      analysis: 3,
      general: 5
    }
    return creativityMap[request.type] || 5
  }

  private determineReasoningRequirement(request: OptimizedAIRequest): number {
    const reasoningMap = {
      foundation: 8,
      chapter: 7,
      improvement: 8,
      analysis: 9,
      general: 5
    }
    return reasoningMap[request.type] || 5
  }

  private estimateTokens(request: OptimizedAIRequest): { input: number; output: number } {
    const estimates = {
      foundation: { input: 400, output: 2000 },
      chapter: { input: 800, output: 3000 },
      improvement: { input: 600, output: 800 },
      analysis: { input: 500, output: 300 },
      general: { input: 200, output: 500 }
    }
    return estimates[request.type] || estimates.general
  }

  private findOptimalTemplate(request: OptimizedAIRequest): any {
    const templateMap: Record<string, string> = {
      foundation: 'optimized_foundation',
      chapter: 'optimized_chapter',
      improvement: 'optimized_improvement',
      analysis: 'optimized_analysis',
      general: 'optimized_general'
    }

    const templateId = templateMap[request.type]
    return templateId ? { id: templateId } : null
  }

  private estimateTemplateSavings(request: OptimizedAIRequest, template: any): number {
    // Estimate 20-30% token savings with optimized templates
    const baseTokens = this.estimateTokens(request)
    return Math.floor((baseTokens.input + baseTokens.output) * 0.25)
  }

  private calculateCostForModel(model: string, tokens: { input: number; output: number }): number {
    const pricing = {
      'claude-3-haiku-20240307': { input: 0.00000025, output: 0.00000125 },
      'claude-3-sonnet-20240229': { input: 0.000003, output: 0.000015 },
      'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 }
    }

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['claude-3-sonnet-20240229']
    return (tokens.input * modelPricing.input) + (tokens.output * modelPricing.output)
  }

  private getModelShortName(fullModelName: string): 'haiku' | 'sonnet' | 'opus' {
    if (fullModelName.includes('haiku')) return 'haiku'
    if (fullModelName.includes('opus')) return 'opus'
    return 'sonnet'
  }

  private getFullModelName(shortName: string): string {
    const modelNames = {
      haiku: 'claude-3-haiku-20240307',
      sonnet: 'claude-3-sonnet-20240229',
      opus: 'claude-3-opus-20240229'
    }
    return modelNames[shortName as keyof typeof modelNames] || modelNames.sonnet
  }

  private groupSimilarRequests(requests: OptimizedAIRequest[]): OptimizedAIRequest[][] {
    // Simple grouping by type for now - could be more sophisticated
    const groups = new Map<string, OptimizedAIRequest[]>()

    requests.forEach(request => {
      const key = `${request.type}_${request.options?.urgency || 'normal'}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(request)
    })

    return Array.from(groups.values())
  }

  private async optimizeBatch(requests: OptimizedAIRequest[]): Promise<any> {
    // Batch-level optimizations
    return {
      batchId: this.generateOperationId(),
      optimizedForBatch: true
    }
  }

  private async processBatchGroup(
    requests: OptimizedAIRequest[],
    batchOptimization: any
  ): Promise<Map<string, OptimizationResult>> {
    const results = new Map<string, OptimizationResult>()

    for (const request of requests) {
      const result = await this.processOptimizedRequest(request)
      result.optimizations.batchProcessed = true
      results.set(request.id || this.generateOperationId(), result)
    }

    return results
  }
}

// Export singleton instance
export const aiCostOptimizationHub = new AICostOptimizationHub(new ClaudeService())

// Easy-to-use wrapper functions
export async function generateOptimized(request: OptimizedAIRequest): Promise<OptimizationResult> {
  return await aiCostOptimizationHub.processOptimizedRequest(request)
}

export async function batchGenerateOptimized(requests: OptimizedAIRequest[]): Promise<Map<string, OptimizationResult>> {
  return await aiCostOptimizationHub.processBatch(requests)
}