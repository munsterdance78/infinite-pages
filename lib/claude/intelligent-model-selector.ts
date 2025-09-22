import { calculateCost } from '@/lib/constants'

export interface ModelProfile {
  name: string
  apiName: string
  costPerInputToken: number
  costPerOutputToken: number
  capabilities: {
    maxTokens: number
    reasoning: number // 1-10 scale
    creativity: number // 1-10 scale
    speed: number // 1-10 scale
    costEfficiency: number // 1-10 scale
  }
  bestFor: string[]
  limitations: string[]
}

export interface TaskProfile {
  type: 'foundation' | 'chapter' | 'improvement' | 'analysis' | 'general'
  complexity: 'simple' | 'medium' | 'complex'
  creativityRequired: number // 1-10 scale
  reasoningRequired: number // 1-10 scale
  speedRequired: number // 1-10 scale
  maxBudget?: number
  qualityThreshold: number // 1-10 scale
  estimatedTokens: {
    input: number
    output: number
  }
}

export interface ModelRecommendation {
  selectedModel: string
  confidence: number // 0-1 scale
  expectedCost: number
  expectedQuality: number // 1-10 scale
  reasoning: string[]
  alternatives: Array<{
    model: string
    score: number
    cost: number
    tradeoffs: string[]
  }>
  optimizations: string[]
}

export class IntelligentModelSelector {
  private models: Map<string, ModelProfile> = new Map()
  private performanceHistory: Map<string, {
    model: string
    task: string
    actualCost: number
    qualityScore: number
    responseTime: number
    timestamp: Date
  }[]> = new Map()

  constructor() {
    this.initializeModels()
  }

  private initializeModels(): void {
    const models: ModelProfile[] = [
      {
        name: 'Claude 3 Haiku',
        apiName: 'claude-3-haiku-20240307',
        costPerInputToken: 0.00000025,
        costPerOutputToken: 0.00000125,
        capabilities: {
          maxTokens: 200000,
          reasoning: 6,
          creativity: 5,
          speed: 10,
          costEfficiency: 10
        },
        bestFor: [
          'simple_analysis',
          'basic_content_generation',
          'data_processing',
          'quick_responses',
          'high_volume_tasks'
        ],
        limitations: [
          'limited_creative_depth',
          'basic_reasoning_only',
          'shorter_context_handling'
        ]
      },
      {
        name: 'Claude 3 Sonnet',
        apiName: 'claude-3-sonnet-20240229',
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        capabilities: {
          maxTokens: 200000,
          reasoning: 8,
          creativity: 8,
          speed: 7,
          costEfficiency: 7
        },
        bestFor: [
          'story_generation',
          'content_improvement',
          'balanced_tasks',
          'general_writing',
          'moderate_complexity'
        ],
        limitations: [
          'higher_cost_than_haiku',
          'slower_than_haiku'
        ]
      },
      {
        name: 'Claude 3 Opus',
        apiName: 'claude-3-opus-20240229',
        costPerInputToken: 0.000015,
        costPerOutputToken: 0.000075,
        capabilities: {
          maxTokens: 200000,
          reasoning: 10,
          creativity: 10,
          speed: 5,
          costEfficiency: 4
        },
        bestFor: [
          'complex_story_foundations',
          'high_quality_content',
          'creative_writing',
          'complex_reasoning',
          'premium_quality_tasks'
        ],
        limitations: [
          'highest_cost',
          'slower_response_time',
          'overkill_for_simple_tasks'
        ]
      }
    ]

    models.forEach(model => {
      this.models.set(model.apiName, model)
    })
  }

  /**
   * Select optimal model for a given task
   */
  selectOptimalModel(task: TaskProfile): ModelRecommendation {
    const candidates = Array.from(this.models.values())
    const scores = candidates.map(model => this.scoreModel(model, task))

    // Sort by score (highest first)
    const sortedCandidates = candidates
      .map((model, index) => ({ model, score: scores[index] }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))

    const bestCandidate = sortedCandidates[0]
    if (!bestCandidate) {
      // Fallback to first available model if no candidates
      const fallbackModel = candidates[0]
      if (!fallbackModel) {
        throw new Error('No models available for selection')
      }
      return {
        selectedModel: fallbackModel.apiName,
        confidence: 0.1,
        expectedCost: this.calculateExpectedCost(fallbackModel, task.estimatedTokens),
        expectedQuality: this.estimateQuality(fallbackModel, task),
        reasoning: ['No suitable models found, using fallback'],
        alternatives: [],
        optimizations: []
      }
    }

    const selectedModel = bestCandidate.model

    const expectedCost = this.calculateExpectedCost(selectedModel, task.estimatedTokens)
    const expectedQuality = this.estimateQuality(selectedModel, task)

    // Generate reasoning for selection
    const reasoning = this.generateSelectionReasoning(selectedModel, task, bestCandidate.score || 0)

    // Get alternatives
    const alternatives = sortedCandidates.slice(1, 3).map(candidate => ({
      model: candidate.model.name,
      score: candidate.score || 0,
      cost: this.calculateExpectedCost(candidate.model, task.estimatedTokens),
      tradeoffs: this.generateTradeoffs(candidate.model, selectedModel, task)
    }))

    // Generate optimization suggestions
    const optimizations = this.generateOptimizations(task, selectedModel)

    return {
      selectedModel: selectedModel.apiName,
      confidence: this.calculateConfidence(bestCandidate.score || 0, scores),
      expectedCost,
      expectedQuality,
      reasoning,
      alternatives,
      optimizations
    }
  }

  /**
   * Score a model for a specific task
   */
  private scoreModel(model: ModelProfile, task: TaskProfile): number {
    let score = 0
    let weightSum = 0

    // Cost efficiency scoring (30% weight)
    const costWeight = 0.3
    const expectedCost = this.calculateExpectedCost(model, task.estimatedTokens)
    const costScore = task.maxBudget
      ? Math.max(0, 10 - (expectedCost / task.maxBudget) * 10)
      : model.capabilities.costEfficiency

    score += costScore * costWeight
    weightSum += costWeight

    // Quality requirements (40% weight)
    const qualityWeight = 0.4
    const creativityScore = Math.min(10, model.capabilities.creativity +
      (task.creativityRequired <= model.capabilities.creativity ? 2 : -2))
    const reasoningScore = Math.min(10, model.capabilities.reasoning +
      (task.reasoningRequired <= model.capabilities.reasoning ? 2 : -2))

    const qualityScore = (creativityScore + reasoningScore) / 2
    score += qualityScore * qualityWeight
    weightSum += qualityWeight

    // Speed requirements (15% weight)
    const speedWeight = 0.15
    const speedScore = task.speedRequired <= model.capabilities.speed
      ? model.capabilities.speed
      : Math.max(1, model.capabilities.speed - (task.speedRequired - model.capabilities.speed))

    score += speedScore * speedWeight
    weightSum += speedWeight

    // Task type compatibility (15% weight)
    const compatibilityWeight = 0.15
    const compatibilityScore = this.calculateTaskCompatibility(model, task)
    score += compatibilityScore * compatibilityWeight
    weightSum += compatibilityWeight

    // Normalize score
    return score / weightSum
  }

  /**
   * Calculate task compatibility score
   */
  private calculateTaskCompatibility(model: ModelProfile, task: TaskProfile): number {
    const taskTypeMapping = {
      foundation: ['complex_story_foundations', 'story_generation', 'creative_writing'],
      chapter: ['story_generation', 'creative_writing', 'content_improvement'],
      improvement: ['content_improvement', 'balanced_tasks', 'general_writing'],
      analysis: ['simple_analysis', 'data_processing', 'quick_responses'],
      general: ['balanced_tasks', 'general_writing', 'quick_responses']
    }

    const relevantCapabilities = taskTypeMapping[task.type] || []
    const matches = relevantCapabilities.filter(cap => model.bestFor.includes(cap))

    return (matches.length / relevantCapabilities.length) * 10
  }

  /**
   * Calculate expected cost for model and token usage
   */
  private calculateExpectedCost(model: ModelProfile, tokens: { input: number; output: number }): number {
    return (tokens.input * model.costPerInputToken) + (tokens.output * model.costPerOutputToken)
  }

  /**
   * Estimate quality score for model and task
   */
  private estimateQuality(model: ModelProfile, task: TaskProfile): number {
    const baseQuality = (model.capabilities.creativity + model.capabilities.reasoning) / 2

    // Adjust based on task requirements
    const creativityMatch = Math.min(1, model.capabilities.creativity / Math.max(1, task.creativityRequired))
    const reasoningMatch = Math.min(1, model.capabilities.reasoning / Math.max(1, task.reasoningRequired))

    const matchScore = (creativityMatch + reasoningMatch) / 2

    return Math.min(10, baseQuality * matchScore)
  }

  /**
   * Generate reasoning for model selection
   */
  private generateSelectionReasoning(
    model: ModelProfile,
    task: TaskProfile,
    score: number
  ): string[] {
    const reasoning: string[] = []

    const expectedCost = this.calculateExpectedCost(model, task.estimatedTokens)

    reasoning.push(`Selected ${model.name} with confidence score ${score.toFixed(1)}/10`)
    reasoning.push(`Expected cost: $${expectedCost.toFixed(4)} for ~${task.estimatedTokens.input + task.estimatedTokens.output} tokens`)

    // Task-specific reasoning
    if (task.type === 'foundation' && model.name.includes('Opus')) {
      reasoning.push('Opus chosen for story foundation due to superior creative reasoning capabilities')
    } else if (task.type === 'analysis' && model.name.includes('Haiku')) {
      reasoning.push('Haiku selected for analysis task - optimal cost-efficiency for data processing')
    } else if (model.name.includes('Sonnet')) {
      reasoning.push('Sonnet provides optimal balance of quality and cost for this task')
    }

    // Budget considerations
    if (task.maxBudget && expectedCost > task.maxBudget * 0.8) {
      reasoning.push('⚠️ Near budget limit - consider simplifying task or increasing budget')
    }

    // Performance optimization suggestions
    if (task.complexity === 'simple' && model.capabilities.reasoning > 8) {
      reasoning.push('💡 Consider using a more cost-efficient model for this simple task')
    }

    return reasoning
  }

  /**
   * Generate tradeoffs between models
   */
  private generateTradeoffs(
    candidate: ModelProfile,
    selected: ModelProfile,
    task: TaskProfile
  ): string[] {
    const tradeoffs: string[] = []
    const candidateCost = this.calculateExpectedCost(candidate, task.estimatedTokens)
    const selectedCost = this.calculateExpectedCost(selected, task.estimatedTokens)

    if (candidateCost < selectedCost) {
      const savings = ((selectedCost - candidateCost) / selectedCost * 100).toFixed(0)
      tradeoffs.push(`${savings}% cost savings vs selected model`)
    } else {
      const increase = ((candidateCost - selectedCost) / selectedCost * 100).toFixed(0)
      tradeoffs.push(`${increase}% cost increase vs selected model`)
    }

    if (candidate.capabilities.creativity < selected.capabilities.creativity) {
      tradeoffs.push('Lower creative capabilities')
    }
    if (candidate.capabilities.reasoning < selected.capabilities.reasoning) {
      tradeoffs.push('Lower reasoning capabilities')
    }
    if (candidate.capabilities.speed > selected.capabilities.speed) {
      tradeoffs.push('Faster response time')
    }

    return tradeoffs
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizations(task: TaskProfile, model: ModelProfile): string[] {
    const optimizations: string[] = []

    // Token optimization
    if (task.estimatedTokens.input > 1000) {
      optimizations.push('Consider using optimized prompt templates to reduce input tokens')
    }

    // Model optimization
    if (task.complexity === 'simple' && model.capabilities.reasoning > 7) {
      optimizations.push('Task might be suitable for a more cost-efficient model')
    }

    // Batch optimization
    if (task.type === 'analysis' || task.type === 'improvement') {
      optimizations.push('Consider batching similar tasks for better cost efficiency')
    }

    // Cache optimization
    optimizations.push('Enable caching for repeated similar requests')

    // Budget optimization
    const expectedCost = this.calculateExpectedCost(model, task.estimatedTokens)
    if (expectedCost > 0.01) {
      optimizations.push('For high-cost operations, consider progressive generation or chunking')
    }

    return optimizations
  }

  /**
   * Calculate confidence in selection
   */
  private calculateConfidence(bestScore: number, allScores: number[]): number {
    if (allScores.length < 2) return 1.0

    const secondBestScore = allScores.sort((a, b) => b - a)[1]
    if (secondBestScore === undefined) return 1.0

    const margin = bestScore - secondBestScore

    // Higher margin = higher confidence
    return Math.min(1.0, 0.5 + (margin / 10))
  }

  /**
   * Record performance data for learning
   */
  recordPerformance(
    model: string,
    task: string,
    actualCost: number,
    qualityScore: number,
    responseTime: number
  ): void {
    const key = `${model}_${task}`
    if (!this.performanceHistory.has(key)) {
      this.performanceHistory.set(key, [])
    }

    const history = this.performanceHistory.get(key)!
    history.push({
      model,
      task,
      actualCost,
      qualityScore,
      responseTime,
      timestamp: new Date()
    })

    // Keep only last 100 records per model/task combination
    if (history.length > 100) {
      history.shift()
    }
  }

  /**
   * Get cost-optimized model for batch operations
   */
  selectBatchOptimizedModel(
    tasks: TaskProfile[],
    totalBudget: number
  ): {
    model: string
    estimatedCost: number
    feasible: boolean
    recommendations: string[]
  } {
    const recommendations: string[] = []

    // Calculate total estimated tokens
    const totalTokens = tasks.reduce((sum, task) => ({
      input: sum.input + task.estimatedTokens.input,
      output: sum.output + task.estimatedTokens.output
    }), { input: 0, output: 0 })

    // Test each model for batch feasibility
    const models = Array.from(this.models.values())
    const batchOptions = models.map(model => {
      const estimatedCost = this.calculateExpectedCost(model, totalTokens)
      const avgQuality = tasks.reduce((sum, task) =>
        sum + this.estimateQuality(model, task), 0) / tasks.length

      return {
        model: model.apiName,
        estimatedCost,
        avgQuality,
        feasible: estimatedCost <= totalBudget
      }
    }).filter(option => option.feasible)
      .sort((a, b) => b.avgQuality - a.avgQuality)

    if (batchOptions.length === 0) {
      return {
        model: 'claude-3-haiku-20240307',
        estimatedCost: this.calculateExpectedCost(this.models.get('claude-3-haiku-20240307')!, totalTokens),
        feasible: false,
        recommendations: [
          'No model fits within budget',
          'Consider increasing budget or reducing task complexity',
          'Split batch into smaller chunks'
        ]
      }
    }

    const bestOption = batchOptions[0]
    if (!bestOption) {
      return {
        model: 'claude-3-haiku-20240307',
        estimatedCost: 0,
        feasible: false,
        recommendations: ['No feasible options found']
      }
    }

    if (bestOption.estimatedCost > totalBudget * 0.9) {
      recommendations.push('⚠️ Near budget limit - monitor spending closely')
    }

    if (batchOptions.length > 1) {
      const alternative = batchOptions[1]
      if (alternative) {
        const savings = bestOption.estimatedCost - alternative.estimatedCost
        recommendations.push(`Alternative: Save $${savings.toFixed(4)} with slight quality trade-off`)
      }
    }

    return {
      model: bestOption.model,
      estimatedCost: bestOption.estimatedCost,
      feasible: true,
      recommendations
    }
  }

  /**
   * Get model performance analytics
   */
  getModelAnalytics(timeRange?: { start: Date; end: Date }): {
    modelUsage: Record<string, number>
    averageCosts: Record<string, number>
    qualityScores: Record<string, number>
    recommendations: string[]
  } {
    const analytics = {
      modelUsage: {} as Record<string, number>,
      averageCosts: {} as Record<string, number>,
      qualityScores: {} as Record<string, number>,
      recommendations: [] as string[]
    }

    this.performanceHistory.forEach((history, key) => {
      const filteredHistory = timeRange ? history.filter(record =>
        record.timestamp >= timeRange.start && record.timestamp <= timeRange.end
      ) : history

      if (filteredHistory.length === 0) return

      const firstRecord = filteredHistory[0]
      if (!firstRecord) return

      const model = firstRecord.model
      analytics.modelUsage[model] = (analytics.modelUsage[model] || 0) + filteredHistory.length

      const avgCost = filteredHistory.reduce((sum, r) => sum + r.actualCost, 0) / filteredHistory.length
      analytics.averageCosts[model] = avgCost

      const avgQuality = filteredHistory.reduce((sum, r) => sum + r.qualityScore, 0) / filteredHistory.length
      analytics.qualityScores[model] = avgQuality
    })

    // Generate recommendations based on analytics
    const modelEntries = Object.entries(analytics.modelUsage)
    if (modelEntries.length > 0) {
      const mostUsed = modelEntries.reduce((a, b) => a[1] > b[1] ? a : b)
      analytics.recommendations.push(`Most used model: ${mostUsed[0]} (${mostUsed[1]} operations)`)

      const costs = Object.entries(analytics.averageCosts)
      if (costs.length > 1) {
        const cheapest = costs.reduce((a, b) => a[1] < b[1] ? a : b)
        analytics.recommendations.push(`Most cost-efficient: ${cheapest[0]} ($${cheapest[1].toFixed(4)} avg)`)
      }
    }

    return analytics
  }
}

// Export singleton instance
export const intelligentModelSelector = new IntelligentModelSelector()

// Utility function for quick model selection
export function selectModelForTask(
  type: TaskProfile['type'],
  complexity: TaskProfile['complexity'] = 'medium',
  budget?: number
): string {
  const task: TaskProfile = {
    type,
    complexity,
    creativityRequired: type === 'foundation' ? 8 : 5,
    reasoningRequired: complexity === 'complex' ? 8 : 5,
    speedRequired: 5,
    maxBudget: budget,
    qualityThreshold: 7,
    estimatedTokens: {
      input: complexity === 'complex' ? 800 : complexity === 'medium' ? 400 : 200,
      output: complexity === 'complex' ? 3000 : complexity === 'medium' ? 1500 : 800
    }
  }

  const recommendation = intelligentModelSelector.selectOptimalModel(task)
  return recommendation.selectedModel
}