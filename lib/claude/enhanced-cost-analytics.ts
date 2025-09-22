import { intelligentModelSelector } from './intelligent-model-selector'

export interface CostEntry {
  id: string
  timestamp: Date
  userId: string
  operation: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  actualCost: number
  estimatedCost: number
  optimizedModel?: string
  potentialSavings: number
  qualityScore?: number
  responseTime: number
  cacheHit: boolean
  batchId?: string
  promptTemplate?: string
}

export interface BudgetAlert {
  id: string
  type: 'warning' | 'critical' | 'budget_exceeded'
  message: string
  threshold: number
  currentSpend: number
  recommendations: string[]
  timestamp: Date
  userId?: string
}

export interface CostOptimizationSuggestion {
  type: 'model_downgrade' | 'template_optimization' | 'batch_operations' | 'cache_usage' | 'token_reduction'
  impact: 'high' | 'medium' | 'low'
  estimatedSavings: number
  description: string
  implementation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface CostAnalytics {
  timeRange: { start: Date; end: Date }
  totalCost: number
  totalOperations: number
  averageCostPerOperation: number
  topCostDrivers: Array<{
    operation: string
    cost: number
    percentage: number
  }>
  modelUsageBreakdown: Record<string, {
    operations: number
    cost: number
    avgCostPerOp: number
    efficiency: number
  }>
  hourlyTrends: Array<{
    hour: number
    cost: number
    operations: number
    avgCost: number
  }>
  optimizationOpportunities: CostOptimizationSuggestion[]
  projectedMonthlyCost: number
  budgetUtilization: number
}

export interface UserBudget {
  userId: string
  monthlyBudget: number
  currentSpend: number
  warningThreshold: number // 0.8 = 80%
  criticalThreshold: number // 0.95 = 95%
  alertsEnabled: boolean
  autoOptimize: boolean
}

export class EnhancedCostAnalytics {
  private costEntries: Map<string, CostEntry[]> = new Map() // userId -> entries
  private budgets: Map<string, UserBudget> = new Map()
  private alerts: BudgetAlert[] = []

  /**
   * Record a cost entry
   */
  recordCost(entry: Omit<CostEntry, 'id' | 'timestamp' | 'potentialSavings'>): void {
    const fullEntry: CostEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
      potentialSavings: this.calculatePotentialSavings(entry)
    }

    // Store entry
    if (!this.costEntries.has(entry.userId)) {
      this.costEntries.set(entry.userId, [])
    }

    const userEntries = this.costEntries.get(entry.userId)!
    userEntries.push(fullEntry)

    // Keep only last 10,000 entries per user
    if (userEntries.length > 10000) {
      userEntries.shift()
    }

    // Check budget alerts
    this.checkBudgetAlerts(entry.userId)

    // Record performance for model selector
    if (entry.qualityScore) {
      intelligentModelSelector.recordPerformance(
        entry.model,
        entry.operation,
        entry.actualCost,
        entry.qualityScore,
        entry.responseTime
      )
    }
  }

  /**
   * Calculate potential savings if optimal model was used
   */
  private calculatePotentialSavings(entry: Omit<CostEntry, 'id' | 'timestamp' | 'potentialSavings'>): number {
    if (entry.optimizedModel && entry.optimizedModel !== entry.model) {
      // Calculate what cost would have been with optimized model
      const models = {
        'claude-3-haiku-20240307': { input: 0.00000025, output: 0.00000125 },
        'claude-3-sonnet-20240229': { input: 0.000003, output: 0.000015 },
        'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 }
      }

      const optimizedPricing = models[entry.optimizedModel as keyof typeof models]
      if (optimizedPricing) {
        const optimizedCost = (entry.inputTokens * optimizedPricing.input) +
                             (entry.outputTokens * optimizedPricing.output)
        return Math.max(0, entry.actualCost - optimizedCost)
      }
    }
    return 0
  }

  /**
   * Set user budget
   */
  setBudget(userId: string, budget: Partial<UserBudget>): void {
    const existingBudget = this.budgets.get(userId)
    const newBudget: UserBudget = {
      userId,
      monthlyBudget: budget.monthlyBudget || 100,
      currentSpend: 0,
      warningThreshold: budget.warningThreshold || 0.8,
      criticalThreshold: budget.criticalThreshold || 0.95,
      alertsEnabled: budget.alertsEnabled !== false,
      autoOptimize: budget.autoOptimize || false,
      ...existingBudget,
      ...budget
    }

    this.budgets.set(userId, newBudget)
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(userId: string): {
    budget: UserBudget | null
    currentMonthSpend: number
    remainingBudget: number
    daysRemaining: number
    projectedSpend: number
    status: 'healthy' | 'warning' | 'critical' | 'exceeded'
    recommendations: string[]
  } {
    const budget = this.budgets.get(userId)
    if (!budget) {
      return {
        budget: null,
        currentMonthSpend: 0,
        remainingBudget: 0,
        daysRemaining: 0,
        projectedSpend: 0,
        status: 'healthy',
        recommendations: ['Set up a monthly budget to track spending']
      }
    }

    const currentMonthSpend = this.getCurrentMonthSpend(userId)
    const remainingBudget = budget.monthlyBudget - currentMonthSpend
    const daysRemaining = this.getDaysRemainingInMonth()
    const projectedSpend = this.projectMonthlySpend(userId)

    let status: 'healthy' | 'warning' | 'critical' | 'exceeded' = 'healthy'
    const utilizationRate = currentMonthSpend / budget.monthlyBudget

    if (currentMonthSpend >= budget.monthlyBudget) {
      status = 'exceeded'
    } else if (utilizationRate >= budget.criticalThreshold) {
      status = 'critical'
    } else if (utilizationRate >= budget.warningThreshold) {
      status = 'warning'
    }

    const recommendations = this.generateBudgetRecommendations(userId, {
      currentMonthSpend,
      projectedSpend,
      budget,
      status
    })

    return {
      budget,
      currentMonthSpend,
      remainingBudget,
      daysRemaining,
      projectedSpend,
      status,
      recommendations
    }
  }

  /**
   * Generate comprehensive analytics
   */
  getAnalytics(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): CostAnalytics {
    const entries = this.getEntriesInRange(userId, timeRange)

    if (entries.length === 0) {
      return this.getEmptyAnalytics(timeRange)
    }

    const totalCost = entries.reduce((sum, entry) => sum + entry.actualCost, 0)
    const totalOperations = entries.length
    const averageCostPerOperation = totalCost / totalOperations

    // Top cost drivers
    const operationCosts = entries.reduce((acc, entry) => {
      acc[entry.operation] = (acc[entry.operation] || 0) + entry.actualCost
      return acc
    }, {} as Record<string, number>)

    const topCostDrivers = Object.entries(operationCosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([operation, cost]) => ({
        operation,
        cost,
        percentage: (cost / totalCost) * 100
      }))

    // Model usage breakdown
    const modelUsageBreakdown = this.calculateModelBreakdown(entries)

    // Hourly trends
    const hourlyTrends = this.calculateHourlyTrends(entries)

    // Optimization opportunities
    const optimizationOpportunities = this.identifyOptimizationOpportunities(entries)

    // Projected monthly cost
    const projectedMonthlyCost = this.projectMonthlySpend(userId)

    // Budget utilization
    const budget = this.budgets.get(userId)
    const budgetUtilization = budget ? (this.getCurrentMonthSpend(userId) / budget.monthlyBudget) : 0

    return {
      timeRange,
      totalCost,
      totalOperations,
      averageCostPerOperation,
      topCostDrivers,
      modelUsageBreakdown,
      hourlyTrends,
      optimizationOpportunities,
      projectedMonthlyCost,
      budgetUtilization
    }
  }

  /**
   * Calculate model usage breakdown
   */
  private calculateModelBreakdown(entries: CostEntry[]): Record<string, {
    operations: number
    cost: number
    avgCostPerOp: number
    efficiency: number
  }> {
    const breakdown: Record<string, any> = {}

    entries.forEach(entry => {
      if (!breakdown[entry.model]) {
        breakdown[entry.model] = {
          operations: 0,
          cost: 0,
          totalSavings: 0
        }
      }

      breakdown[entry.model].operations++
      breakdown[entry.model].cost += entry.actualCost
      breakdown[entry.model].totalSavings += entry.potentialSavings
    })

    // Calculate derived metrics
    Object.keys(breakdown).forEach(model => {
      const data = breakdown[model]
      data.avgCostPerOp = data.cost / data.operations
      data.efficiency = 1 - (data.totalSavings / data.cost) // Higher is better
    })

    return breakdown
  }

  /**
   * Calculate hourly cost trends
   */
  private calculateHourlyTrends(entries: CostEntry[]): Array<{
    hour: number
    cost: number
    operations: number
    avgCost: number
  }> {
    const hourlyData: Record<number, { cost: number; operations: number }> = {}

    entries.forEach(entry => {
      const hour = entry.timestamp.getHours()
      if (!hourlyData[hour]) {
        hourlyData[hour] = { cost: 0, operations: 0 }
      }
      hourlyData[hour].cost += entry.actualCost
      hourlyData[hour].operations++
    })

    return Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyData[hour] || { cost: 0, operations: 0 }
      return {
        hour,
        cost: data.cost,
        operations: data.operations,
        avgCost: data.operations > 0 ? data.cost / data.operations : 0
      }
    })
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(entries: CostEntry[]): CostOptimizationSuggestion[] {
    const opportunities: CostOptimizationSuggestion[] = []

    // Model optimization opportunities
    const totalPotentialSavings = entries.reduce((sum, entry) => sum + entry.potentialSavings, 0)
    if (totalPotentialSavings > 0.01) {
      opportunities.push({
        type: 'model_downgrade',
        impact: totalPotentialSavings > 1 ? 'high' : totalPotentialSavings > 0.1 ? 'medium' : 'low',
        estimatedSavings: totalPotentialSavings,
        description: 'Use more cost-efficient models for suitable tasks',
        implementation: 'Enable auto-optimization or manually select Haiku for simple tasks',
        difficulty: 'easy'
      })
    }

    // Template optimization
    const nonTemplatedEntries = entries.filter(e => !e.promptTemplate)
    if (nonTemplatedEntries.length > entries.length * 0.3) {
      const potentialSavings = nonTemplatedEntries.length * 0.001 // Estimate $0.001 per operation
      opportunities.push({
        type: 'template_optimization',
        impact: 'medium',
        estimatedSavings: potentialSavings,
        description: 'Use optimized prompt templates to reduce token usage',
        implementation: 'Apply pre-built templates for common operations',
        difficulty: 'easy'
      })
    }

    // Batch operations
    const batchableEntries = entries.filter(e =>
      ['analysis', 'improvement'].includes(e.operation) && !e.batchId
    )
    if (batchableEntries.length > 10) {
      const potentialSavings = batchableEntries.length * 0.0005 // Estimate savings
      opportunities.push({
        type: 'batch_operations',
        impact: 'medium',
        estimatedSavings: potentialSavings,
        description: 'Batch similar operations to reduce overhead',
        implementation: 'Queue operations and process in batches',
        difficulty: 'medium'
      })
    }

    // Cache usage
    const cacheHitRate = entries.filter(e => e.cacheHit).length / entries.length
    if (cacheHitRate < 0.3) {
      const potentialSavings = entries.length * (0.3 - cacheHitRate) * 0.002
      opportunities.push({
        type: 'cache_usage',
        impact: 'high',
        estimatedSavings: potentialSavings,
        description: 'Improve cache hit rate to avoid redundant API calls',
        implementation: 'Enable caching for all operations and extend cache TTL',
        difficulty: 'easy'
      })
    }

    return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings)
  }

  /**
   * Check and generate budget alerts
   */
  private checkBudgetAlerts(userId: string): void {
    const budget = this.budgets.get(userId)
    if (!budget || !budget.alertsEnabled) return

    const currentSpend = this.getCurrentMonthSpend(userId)
    const utilizationRate = currentSpend / budget.monthlyBudget

    // Generate alerts based on thresholds
    if (utilizationRate >= 1.0) {
      this.createAlert(userId, {
        type: 'budget_exceeded',
        message: 'Monthly budget exceeded',
        threshold: budget.monthlyBudget,
        currentSpend,
        recommendations: [
          'Consider increasing monthly budget',
          'Enable auto-optimization to reduce costs',
          'Review and optimize high-cost operations'
        ]
      })
    } else if (utilizationRate >= budget.criticalThreshold) {
      this.createAlert(userId, {
        type: 'critical',
        message: 'Approaching budget limit',
        threshold: budget.criticalThreshold,
        currentSpend,
        recommendations: [
          'Monitor spending closely',
          'Consider deferring non-urgent operations',
          'Use more cost-efficient models'
        ]
      })
    } else if (utilizationRate >= budget.warningThreshold) {
      this.createAlert(userId, {
        type: 'warning',
        message: 'Budget warning threshold reached',
        threshold: budget.warningThreshold,
        currentSpend,
        recommendations: [
          'Review upcoming operations',
          'Consider cost optimization strategies',
          'Monitor daily spending rate'
        ]
      })
    }
  }

  /**
   * Create budget alert
   */
  private createAlert(userId: string, alert: Omit<BudgetAlert, 'id' | 'timestamp' | 'userId'>): void {
    const newAlert: BudgetAlert = {
      ...alert,
      id: this.generateId(),
      timestamp: new Date(),
      userId
    }

    this.alerts.push(newAlert)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift()
    }
  }

  /**
   * Get user alerts
   */
  getAlerts(userId: string, limit: number = 10): BudgetAlert[] {
    return this.alerts
      .filter(alert => alert.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Generate budget recommendations
   */
  private generateBudgetRecommendations(
    userId: string,
    context: {
      currentMonthSpend: number
      projectedSpend: number
      budget: UserBudget
      status: string
    }
  ): string[] {
    const recommendations: string[] = []
    const { currentMonthSpend, projectedSpend, budget, status } = context

    if (status === 'exceeded') {
      recommendations.push('🚨 Budget exceeded - consider increasing limit or reducing usage')
      recommendations.push('Enable auto-optimization to reduce future costs')
    } else if (status === 'critical') {
      recommendations.push('⚠️ Near budget limit - monitor spending closely')
      recommendations.push('Defer non-urgent operations until next month')
    } else if (status === 'warning') {
      recommendations.push('📊 Monitor spending rate to stay within budget')
    }

    if (projectedSpend > budget.monthlyBudget) {
      const overage = projectedSpend - budget.monthlyBudget
      recommendations.push(`📈 Projected to exceed budget by $${overage.toFixed(2)}`)
    }

    // Cost optimization recommendations
    const recentEntries = this.getRecentEntries(userId, 7) // Last 7 days
    const opportunities = this.identifyOptimizationOpportunities(recentEntries)

    if (opportunities.length > 0) {
      const topOpportunity = opportunities[0]
      if (topOpportunity) {
        recommendations.push(
          `💡 Top optimization: ${topOpportunity.description} (save ~$${topOpportunity.estimatedSavings.toFixed(3)})`
        )
      }
    }

    return recommendations
  }

  /**
   * Helper methods
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  private getEntriesInRange(userId: string, timeRange: { start: Date; end: Date }): CostEntry[] {
    const userEntries = this.costEntries.get(userId) || []
    return userEntries.filter(entry =>
      entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    )
  }

  private getRecentEntries(userId: string, days: number): CostEntry[] {
    const start = new Date()
    start.setDate(start.getDate() - days)
    return this.getEntriesInRange(userId, { start, end: new Date() })
  }

  private getCurrentMonthSpend(userId: string): number {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const entries = this.getEntriesInRange(userId, { start: monthStart, end: now })
    return entries.reduce((sum, entry) => sum + entry.actualCost, 0)
  }

  private getDaysRemainingInMonth(): number {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return lastDay.getDate() - now.getDate()
  }

  private projectMonthlySpend(userId: string): number {
    const currentSpend = this.getCurrentMonthSpend(userId)
    const daysElapsed = new Date().getDate()
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

    if (daysElapsed === 0) return 0
    return (currentSpend / daysElapsed) * daysInMonth
  }

  private getEmptyAnalytics(timeRange: { start: Date; end: Date }): CostAnalytics {
    return {
      timeRange,
      totalCost: 0,
      totalOperations: 0,
      averageCostPerOperation: 0,
      topCostDrivers: [],
      modelUsageBreakdown: {},
      hourlyTrends: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        cost: 0,
        operations: 0,
        avgCost: 0
      })),
      optimizationOpportunities: [],
      projectedMonthlyCost: 0,
      budgetUtilization: 0
    }
  }
}

// Export singleton instance
export const enhancedCostAnalytics = new EnhancedCostAnalytics()

// Utility functions for easy integration

/**
 * Track AI operation cost with optimization analysis
 */
export function trackAIOperation(
  userId: string,
  operation: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  actualCost: number,
  options: {
    qualityScore?: number
    responseTime?: number
    cacheHit?: boolean
    batchId?: string
    promptTemplate?: string
  } = {}
): void {
  enhancedCostAnalytics.recordCost({
    userId,
    operation,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    actualCost,
    estimatedCost: actualCost, // Could be different if using predictions
    qualityScore: options.qualityScore,
    responseTime: options.responseTime || 0,
    cacheHit: options.cacheHit || false,
    batchId: options.batchId,
    promptTemplate: options.promptTemplate
  })
}

/**
 * Get cost optimization recommendations for user
 */
export function getCostOptimizationRecommendations(userId: string): {
  budgetStatus: any
  recentAnalytics: CostAnalytics
  topRecommendations: CostOptimizationSuggestion[]
  alerts: BudgetAlert[]
} {
  const budgetStatus = enhancedCostAnalytics.getBudgetStatus(userId)

  const last7Days = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  }
  const recentAnalytics = enhancedCostAnalytics.getAnalytics(userId, last7Days)

  const topRecommendations = recentAnalytics.optimizationOpportunities.slice(0, 3)
  const alerts = enhancedCostAnalytics.getAlerts(userId, 5)

  return {
    budgetStatus,
    recentAnalytics,
    topRecommendations,
    alerts
  }
}