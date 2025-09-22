import { claudeService } from './service'
import { claudeCache } from './cache'
import { optimizedPromptTemplateManager } from './prompt-templates'
import { calculateCost, CLAUDE_PRICING } from '@/lib/constants'

export interface EnhancedBatchOperation {
  id: string
  type: 'foundation' | 'chapter' | 'improvement' | 'analysis' | 'general'
  params: any
  priority: number // 1-10 scale (10 = highest priority)
  userId?: string
  urgency: 'immediate' | 'normal' | 'low' // Processing urgency
  costThreshold?: number // Max cost willing to pay
  deadline?: Date // When operation must complete
  dependencies?: string[] // Other operation IDs this depends on
  templateId?: string // Use optimized prompt template
  model?: 'haiku' | 'sonnet' | 'opus' // Specific model preference
  estimatedTokens?: { input: number; output: number }
}

export interface BatchProcessingStats {
  totalOperations: number
  queuedOperations: number
  processingOperations: number
  completedOperations: number
  failedOperations: number
  totalCostSaved: number
  averageWaitTime: number
  priorityDistribution: Record<string, number>
  modelUsageStats: Record<string, number>
  cacheHitRate: number
}

export class AdvancedBatchProcessor {
  private highPriorityQueue: EnhancedBatchOperation[] = []
  private normalQueue: EnhancedBatchOperation[] = []
  private lowPriorityQueue: EnhancedBatchOperation[] = []
  private processing = new Map<string, { operation: EnhancedBatchOperation; startTime: Date }>()
  private results = new Map<string, any>()
  private dependencies = new Map<string, Set<string>>()

  private maxConcurrency: number
  private costBudget: number = 10.0 // Default $10 budget
  private currentCostSpent: number = 0
  private processTimer: NodeJS.Timeout | null = null

  constructor(options: {
    maxConcurrency?: number
    costBudget?: number
    autoProcess?: boolean
  } = {}) {
    this.maxConcurrency = options.maxConcurrency || 5
    this.costBudget = options.costBudget || 10.0

    if (options.autoProcess !== false) {
      this.startAutoProcessing()
    }
  }

  /**
   * Add operation with intelligent queue routing
   */
  addOperation(operation: EnhancedBatchOperation): void {
    // Check if already cached
    if (this.checkCache(operation)) {
      return
    }

    // Apply cost-aware model selection
    operation = this.optimizeModelSelection(operation)

    // Route to appropriate queue based on urgency and priority
    if (operation.urgency === 'immediate' || operation.priority >= 8) {
      this.highPriorityQueue.push(operation)
      this.highPriorityQueue.sort((a, b) => b.priority - a.priority)
    } else if (operation.urgency === 'low' || operation.priority <= 3) {
      this.lowPriorityQueue.push(operation)
    } else {
      this.normalQueue.push(operation)
      this.normalQueue.sort((a, b) => b.priority - a.priority)
    }

    // Track dependencies
    if (operation.dependencies?.length) {
      this.dependencies.set(operation.id, new Set(operation.dependencies))
    }

    // Trigger processing if slots available
    this.processNextBatch()
  }

  /**
   * Intelligent model selection based on operation complexity and cost constraints
   */
  private optimizeModelSelection(operation: EnhancedBatchOperation): EnhancedBatchOperation {
    if (operation.model) return operation // User specified model

    const estimatedTokens = operation.estimatedTokens || this.estimateTokens(operation)
    const remainingBudget = this.costBudget - this.currentCostSpent

    // Calculate costs for different models
    const haikuCost = this.calculateModelCost(estimatedTokens, 'haiku')
    const sonnetCost = this.calculateModelCost(estimatedTokens, 'sonnet')
    const opusCost = this.calculateModelCost(estimatedTokens, 'opus')

    // Cost-aware model selection
    if (operation.costThreshold && operation.costThreshold < sonnetCost) {
      operation.model = 'haiku'
    } else if (remainingBudget < sonnetCost) {
      operation.model = 'haiku'
    } else if (operation.type === 'analysis' || operation.priority <= 4) {
      operation.model = 'haiku' // Use cheaper model for simple tasks
    } else if (operation.type === 'foundation' || operation.priority >= 8) {
      operation.model = remainingBudget >= opusCost ? 'opus' : 'sonnet'
    } else {
      operation.model = 'sonnet' // Default balanced choice
    }

    return operation
  }

  /**
   * Calculate cost for specific model
   */
  private calculateModelCost(
    tokens: { input: number; output: number },
    model: 'haiku' | 'sonnet' | 'opus'
  ): number {
    const pricing = {
      haiku: { input: 0.00000025, output: 0.00000125 },
      sonnet: { input: 0.000003, output: 0.000015 },
      opus: { input: 0.000015, output: 0.000075 }
    }

    const modelPricing = pricing[model]
    return (tokens.input * modelPricing.input) + (tokens.output * modelPricing.output)
  }

  /**
   * Estimate tokens for operation
   */
  private estimateTokens(operation: EnhancedBatchOperation): { input: number; output: number } {
    const baseEstimates = {
      foundation: { input: 400, output: 2000 },
      chapter: { input: 800, output: 3000 },
      improvement: { input: 600, output: 800 },
      analysis: { input: 500, output: 300 },
      general: { input: 200, output: 500 }
    }

    return baseEstimates[operation.type] || baseEstimates.general
  }

  /**
   * Check cache for operation result
   */
  private checkCache(operation: EnhancedBatchOperation): boolean {
    const cacheKey = this.generateCacheKey(operation)
    const cached = claudeCache.get(cacheKey)

    if (cached) {
      this.results.set(operation.id, {
        id: operation.id,
        success: true,
        content: cached.content,
        usage: cached.usage,
        cost: 0, // No cost for cached results
        cached: true,
        processingTime: 0
      })
      return true
    }

    return false
  }

  /**
   * Generate cache key for operation
   */
  private generateCacheKey(operation: EnhancedBatchOperation): string {
    const keyParts = [
      operation.type,
      operation.templateId || 'default',
      operation.model || 'sonnet'
    ]

    // Add relevant params to cache key
    if (operation.params.prompt) {
      keyParts.push(operation.params.prompt.slice(0, 100))
    }
    if (operation.params.genre) {
      keyParts.push(operation.params.genre)
    }
    if (operation.params.premise) {
      keyParts.push(operation.params.premise.slice(0, 100))
    }

    return keyParts.join('_').replace(/[^a-zA-Z0-9_]/g, '')
  }

  /**
   * Process next batch of operations
   */
  private async processNextBatch(): Promise<void> {
    const availableSlots = this.maxConcurrency - this.processing.size
    if (availableSlots <= 0) return

    const readyOperations = this.getReadyOperations(availableSlots)

    for (const operation of readyOperations) {
      this.processOperation(operation)
    }
  }

  /**
   * Get operations ready for processing (dependencies met, budget available)
   */
  private getReadyOperations(maxCount: number): EnhancedBatchOperation[] {
    const ready: EnhancedBatchOperation[] = []
    const allQueues = [this.highPriorityQueue, this.normalQueue, this.lowPriorityQueue]

    for (const queue of allQueues) {
      for (let i = queue.length - 1; i >= 0 && ready.length < maxCount; i--) {
        const operation = queue[i]
        if (!operation) continue

        // Check dependencies
        if (this.areDependenciesMet(operation)) {
          // Check budget
          const estimatedCost = this.calculateModelCost(
            this.estimateTokens(operation),
            operation.model || 'sonnet'
          )

          if (this.currentCostSpent + estimatedCost <= this.costBudget) {
            ready.push(operation)
            queue.splice(i, 1)
          }
        }
      }
    }

    return ready
  }

  /**
   * Check if operation dependencies are met
   */
  private areDependenciesMet(operation: EnhancedBatchOperation): boolean {
    const deps = this.dependencies.get(operation.id)
    if (!deps) return true

    for (const depId of Array.from(deps)) {
      const result = this.results.get(depId)
      if (!result || !result.success) {
        return false
      }
    }

    return true
  }

  /**
   * Process single operation
   */
  private async processOperation(operation: EnhancedBatchOperation): Promise<void> {
    this.processing.set(operation.id, {
      operation,
      startTime: new Date()
    })

    try {
      const startTime = Date.now()
      let result: any

      // Use optimized prompt template if specified
      if (operation.templateId) {
        result = await this.processWithTemplate(operation)
      } else {
        result = await this.processStandardOperation(operation)
      }

      const processingTime = Date.now() - startTime
      const cost = result.cost || 0

      // Update cost tracking
      this.currentCostSpent += cost

      // Cache result
      const cacheKey = this.generateCacheKey(operation)
      claudeCache.set(cacheKey, result.content, result.usage, result.model)

      this.results.set(operation.id, {
        id: operation.id,
        success: true,
        content: result.content,
        usage: result.usage,
        cost,
        cached: false,
        processingTime,
        model: operation.model
      })

    } catch (error: any) {
      this.results.set(operation.id, {
        id: operation.id,
        success: false,
        error: error.message,
        processingTime: Date.now() - Date.now(),
        cost: 0
      })
    } finally {
      this.processing.delete(operation.id)

      // Process next batch
      setTimeout(() => this.processNextBatch(), 100)
    }
  }

  /**
   * Process operation using optimized template
   */
  private async processWithTemplate(operation: EnhancedBatchOperation): Promise<any> {
    const template = optimizedPromptTemplateManager.getTemplate(operation.templateId!)
    if (!template) {
      throw new Error(`Template ${operation.templateId} not found`)
    }

    const variables = operation.params.variables || []
    const prompt = optimizedPromptTemplateManager.renderTemplate(operation.templateId!, variables)

    const requestParams: any = {
      prompt,
      model: this.getModelName(operation.model || 'sonnet'),
      maxTokens: operation.params.maxTokens || 4000,
      temperature: operation.params.temperature || 0.7,
      operation: operation.type
    }
    if (operation.userId) {
      requestParams.userId = operation.userId
    }

    return await claudeService.generateContent(requestParams)
  }

  /**
   * Process standard operation
   */
  private async processStandardOperation(operation: EnhancedBatchOperation): Promise<any> {
    const modelName = this.getModelName(operation.model || 'sonnet')

    switch (operation.type) {
      case 'foundation':
        return await claudeService.generateStoryFoundation({
          ...operation.params,
          model: modelName
        })

      case 'chapter':
        return await claudeService.generateChapter({
          ...operation.params,
          model: modelName
        })

      case 'improvement':
        return await claudeService.improveContent({
          ...operation.params,
          model: modelName
        })

      case 'analysis':
        return await claudeService.analyzeContent(operation.params.content)

      default:
        return await claudeService.generateContent({
          ...operation.params,
          model: modelName
        })
    }
  }

  /**
   * Get full model name from short name
   */
  private getModelName(model: 'haiku' | 'sonnet' | 'opus'): string {
    const modelNames = {
      haiku: 'claude-3-haiku-20240307',
      sonnet: 'claude-3-sonnet-20240229',
      opus: 'claude-3-opus-20240229'
    }
    return modelNames[model]
  }

  /**
   * Start automatic processing timer
   */
  private startAutoProcessing(): void {
    this.processTimer = setInterval(() => {
      this.processNextBatch()
    }, 1000) // Check every second
  }

  /**
   * Stop automatic processing
   */
  stopAutoProcessing(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer)
      this.processTimer = null
    }
  }

  /**
   * Get comprehensive processing statistics
   */
  getStats(): BatchProcessingStats {
    const allOperations = [
      ...this.highPriorityQueue,
      ...this.normalQueue,
      ...this.lowPriorityQueue,
      ...Array.from(this.processing.values()).map(p => p.operation)
    ]

    const results = Array.from(this.results.values())
    const completed = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const cached = results.filter(r => r.cached)

    const priorityDistribution = allOperations.reduce((acc, op) => {
      const range = this.getPriorityRange(op.priority)
      acc[range] = (acc[range] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const modelUsageStats = results.reduce((acc, r) => {
      if (r.model) {
        acc[r.model] = (acc[r.model] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const totalWaitTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0)
    const averageWaitTime = results.length > 0 ? totalWaitTime / results.length : 0

    return {
      totalOperations: allOperations.length + results.length,
      queuedOperations: allOperations.length,
      processingOperations: this.processing.size,
      completedOperations: completed.length,
      failedOperations: failed.length,
      totalCostSaved: cached.length * 0.01, // Estimate $0.01 saved per cache hit
      averageWaitTime,
      priorityDistribution,
      modelUsageStats,
      cacheHitRate: results.length > 0 ? cached.length / results.length : 0
    }
  }

  /**
   * Get priority range for statistics
   */
  private getPriorityRange(priority: number): string {
    if (priority >= 8) return 'high'
    if (priority >= 5) return 'medium'
    return 'low'
  }

  /**
   * Update cost budget
   */
  updateBudget(newBudget: number): void {
    this.costBudget = newBudget
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): {
    total: number
    spent: number
    remaining: number
    utilizationPercent: number
  } {
    const remaining = this.costBudget - this.currentCostSpent
    const utilizationPercent = (this.currentCostSpent / this.costBudget) * 100

    return {
      total: this.costBudget,
      spent: this.currentCostSpent,
      remaining: Math.max(0, remaining),
      utilizationPercent
    }
  }

  /**
   * Wait for specific operations to complete
   */
  async waitForResults(operationIds: string[], timeout: number = 30000): Promise<any[]> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const results = operationIds.map(id => this.results.get(id)).filter(Boolean)

      if (results.length === operationIds.length) {
        return results
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error('Timeout waiting for operations to complete')
  }

  /**
   * Cancel pending operation
   */
  cancelOperation(operationId: string): boolean {
    const queues = [this.highPriorityQueue, this.normalQueue, this.lowPriorityQueue]

    for (const queue of queues) {
      const index = queue.findIndex(op => op.id === operationId)
      if (index !== -1) {
        queue.splice(index, 1)
        return true
      }
    }

    return false
  }

  /**
   * Clear all queues and results
   */
  clear(): void {
    this.highPriorityQueue = []
    this.normalQueue = []
    this.lowPriorityQueue = []
    this.results.clear()
    this.dependencies.clear()
    this.currentCostSpent = 0
  }
}

// Export singleton instance
export const advancedBatchProcessor = new AdvancedBatchProcessor({
  maxConcurrency: 5,
  costBudget: 50.0,
  autoProcess: true
})

// Utility functions for common optimized operations

/**
 * Batch generate with intelligent prioritization
 */
export async function optimizedBatchGenerate(
  operations: Array<{
    id: string
    type: 'foundation' | 'chapter' | 'improvement' | 'analysis'
    params: any
    priority?: number
    urgency?: 'immediate' | 'normal' | 'low'
    userId?: string
  }>
): Promise<Map<string, any>> {
  const enhancedOps: EnhancedBatchOperation[] = operations.map(op => ({
    ...op,
    priority: op.priority || 5,
    urgency: op.urgency || 'normal'
  }))

  enhancedOps.forEach(op => advancedBatchProcessor.addOperation(op))

  const operationIds = enhancedOps.map(op => op.id)
  const results = await advancedBatchProcessor.waitForResults(operationIds)

  return new Map(results.map(r => [r.id, r]))
}