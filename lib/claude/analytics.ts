import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export interface ClaudeAnalytics {
  // Usage metrics
  totalRequests: number
  totalTokens: number
  totalCost: number
  averageTokensPerRequest: number
  averageCostPerRequest: number
  
  // Model usage
  modelUsage: {
    [model: string]: {
      requests: number
      tokens: number
      cost: number
    }
  }
  
  // Operation types
  operationUsage: {
    [operation: string]: {
      requests: number
      tokens: number
      cost: number
      averageTokens: number
    }
  }
  
  // Time-based metrics
  hourlyUsage: Array<{
    hour: string
    requests: number
    tokens: number
    cost: number
  }>
  
  dailyUsage: Array<{
    date: string
    requests: number
    tokens: number
    cost: number
  }>
  
  // Performance metrics
  averageResponseTime: number
  successRate: number
  errorRate: number
  
  // User metrics
  userMetrics: {
    totalUsers: number
    activeUsers: number
    averageRequestsPerUser: number
    topUsers: Array<{
      userId: string
      requests: number
      tokens: number
      cost: number
    }>
  }
  
  // Cache metrics
  cacheMetrics: {
    hitRate: number
    missRate: number
    totalHits: number
    totalMisses: number
    costSavings: number
  }
  
  // Efficiency metrics
  efficiencyMetrics: {
    wordsPerToken: number
    charactersPerToken: number
    qualityScore: number
  }
}

export interface AnalyticsEvent {
  id: string
  userId: string
  operation: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  responseTime: number
  success: boolean
  error?: string
  cached: boolean
  timestamp: Date
  metadata?: {
    genre?: string
    wordCount?: number
    improvementType?: string
    [key: string]: any
  }
}

export class ClaudeAnalyticsService {
  private events: AnalyticsEvent[] = []
  private supabase: any = null

  constructor() {
    // Initialize Supabase client if available
    try {
      const cookieStore = cookies()
      this.supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    } catch (error) {
      console.warn('Analytics: Supabase not available in this context')
    }
  }

  /**
   * Track a Claude operation
   */
  async trackOperation(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }

    // Store in memory
    this.events.push(analyticsEvent)

    // Store in database if available
    if (this.supabase) {
      try {
        await this.supabase
          .from('claude_analytics')
          .insert({
            id: analyticsEvent.id,
            user_id: analyticsEvent.userId,
            operation: analyticsEvent.operation,
            model: analyticsEvent.model,
            input_tokens: analyticsEvent.inputTokens,
            output_tokens: analyticsEvent.outputTokens,
            total_tokens: analyticsEvent.inputTokens + analyticsEvent.outputTokens,
            cost: analyticsEvent.cost,
            response_time: analyticsEvent.responseTime,
            success: analyticsEvent.success,
            error: analyticsEvent.error,
            cached: analyticsEvent.cached,
            metadata: analyticsEvent.metadata,
            created_at: analyticsEvent.timestamp
          })
      } catch (error) {
        console.error('Failed to store analytics event:', error)
      }
    }

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }
  }

  /**
   * Get comprehensive analytics
   */
  async getAnalytics(timeRange: {
    start: Date
    end: Date
  } = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    end: new Date()
  }): Promise<ClaudeAnalytics> {
    let events = this.events.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    )

    // If Supabase is available, fetch from database
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('claude_analytics')
          .select('*')
          .gte('created_at', timeRange.start.toISOString())
          .lte('created_at', timeRange.end.toISOString())

        if (data) {
          events = data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            operation: row.operation,
            model: row.model,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            cost: row.cost,
            responseTime: row.response_time,
            success: row.success,
            error: row.error,
            cached: row.cached,
            timestamp: new Date(row.created_at),
            metadata: row.metadata
          }))
        }
      } catch (error) {
        console.error('Failed to fetch analytics from database:', error)
      }
    }

    return this.calculateAnalytics(events)
  }

  /**
   * Calculate analytics from events
   */
  private calculateAnalytics(events: AnalyticsEvent[]): ClaudeAnalytics {
    if (events.length === 0) {
      return this.getEmptyAnalytics()
    }

    const totalRequests = events.length
    const totalTokens = events.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0)
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0)
    const successfulRequests = events.filter(e => e.success).length
    const cachedRequests = events.filter(e => e.cached).length

    // Model usage
    const modelUsage: { [key: string]: { requests: number; tokens: number; cost: number } } = {}
    events.forEach(event => {
      if (!modelUsage[event.model]) {
        modelUsage[event.model] = { requests: 0, tokens: 0, cost: 0 }
      }
      modelUsage[event.model].requests++
      modelUsage[event.model].tokens += event.inputTokens + event.outputTokens
      modelUsage[event.model].cost += event.cost
    })

    // Operation usage
    const operationUsage: { [key: string]: { requests: number; tokens: number; cost: number; averageTokens: number } } = {}
    events.forEach(event => {
      if (!operationUsage[event.operation]) {
        operationUsage[event.operation] = { requests: 0, tokens: 0, cost: 0, averageTokens: 0 }
      }
      operationUsage[event.operation].requests++
      operationUsage[event.operation].tokens += event.inputTokens + event.outputTokens
      operationUsage[event.operation].cost += event.cost
    })

    // Calculate average tokens per operation
    Object.keys(operationUsage).forEach(operation => {
      const usage = operationUsage[operation]
      usage.averageTokens = usage.tokens / usage.requests
    })

    // Time-based metrics
    const hourlyUsage = this.calculateHourlyUsage(events)
    const dailyUsage = this.calculateDailyUsage(events)

    // Performance metrics
    const totalResponseTime = events.reduce((sum, e) => sum + e.responseTime, 0)
    const averageResponseTime = totalResponseTime / totalRequests
    const successRate = successfulRequests / totalRequests
    const errorRate = 1 - successRate

    // User metrics
    const userMetrics = this.calculateUserMetrics(events)

    // Cache metrics
    const cacheMetrics = {
      hitRate: cachedRequests / totalRequests,
      missRate: (totalRequests - cachedRequests) / totalRequests,
      totalHits: cachedRequests,
      totalMisses: totalRequests - cachedRequests,
      costSavings: cachedRequests * (totalCost / totalRequests) * 0.8 // Assume 80% cost savings from cache
    }

    // Efficiency metrics
    const efficiencyMetrics = this.calculateEfficiencyMetrics(events)

    return {
      totalRequests,
      totalTokens,
      totalCost,
      averageTokensPerRequest: totalTokens / totalRequests,
      averageCostPerRequest: totalCost / totalRequests,
      modelUsage,
      operationUsage,
      hourlyUsage,
      dailyUsage,
      averageResponseTime,
      successRate,
      errorRate,
      userMetrics,
      cacheMetrics,
      efficiencyMetrics
    }
  }

  /**
   * Calculate hourly usage
   */
  private calculateHourlyUsage(events: AnalyticsEvent[]) {
    const hourlyMap = new Map<string, { requests: number; tokens: number; cost: number }>()
    
    events.forEach(event => {
      const hour = event.timestamp.toISOString().slice(0, 13) // YYYY-MM-DDTHH
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, { requests: 0, tokens: 0, cost: 0 })
      }
      const hourData = hourlyMap.get(hour)!
      hourData.requests++
      hourData.tokens += event.inputTokens + event.outputTokens
      hourData.cost += event.cost
    })

    return Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
  }

  /**
   * Calculate daily usage
   */
  private calculateDailyUsage(events: AnalyticsEvent[]) {
    const dailyMap = new Map<string, { requests: number; tokens: number; cost: number }>()
    
    events.forEach(event => {
      const date = event.timestamp.toISOString().slice(0, 10) // YYYY-MM-DD
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { requests: 0, tokens: 0, cost: 0 })
      }
      const dayData = dailyMap.get(date)!
      dayData.requests++
      dayData.tokens += event.inputTokens + event.outputTokens
      dayData.cost += event.cost
    })

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Calculate user metrics
   */
  private calculateUserMetrics(events: AnalyticsEvent[]) {
    const userMap = new Map<string, { requests: number; tokens: number; cost: number }>()
    
    events.forEach(event => {
      if (!userMap.has(event.userId)) {
        userMap.set(event.userId, { requests: 0, tokens: 0, cost: 0 })
      }
      const userData = userMap.get(event.userId)!
      userData.requests++
      userData.tokens += event.inputTokens + event.outputTokens
      userData.cost += event.cost
    })

    const totalUsers = userMap.size
    const activeUsers = Array.from(userMap.values()).filter(u => u.requests > 0).length
    const totalRequests = events.length
    const averageRequestsPerUser = totalRequests / totalUsers

    const topUsers = Array.from(userMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)

    return {
      totalUsers,
      activeUsers,
      averageRequestsPerUser,
      topUsers
    }
  }

  /**
   * Calculate efficiency metrics
   */
  private calculateEfficiencyMetrics(events: AnalyticsEvent[]) {
    let totalWords = 0
    let totalCharacters = 0
    let totalOutputTokens = 0
    let qualityScoreSum = 0

    events.forEach(event => {
      if (event.metadata?.wordCount) {
        totalWords += event.metadata.wordCount
        totalOutputTokens += event.outputTokens
      }
      
      // Estimate characters from output tokens (rough approximation)
      totalCharacters += event.outputTokens * 4 // ~4 chars per token
      
      // Estimate quality score (could be improved with actual quality metrics)
      if (event.metadata?.wordCount && event.outputTokens > 0) {
        const wordsPerToken = event.metadata.wordCount / event.outputTokens
        const qualityScore = Math.min(wordsPerToken / 2, 5) // Scale to 0-5
        qualityScoreSum += qualityScore
      }
    })

    return {
      wordsPerToken: totalOutputTokens > 0 ? totalWords / totalOutputTokens : 0,
      charactersPerToken: totalOutputTokens > 0 ? totalCharacters / totalOutputTokens : 0,
      qualityScore: events.length > 0 ? qualityScoreSum / events.length : 0
    }
  }

  /**
   * Get empty analytics structure
   */
  private getEmptyAnalytics(): ClaudeAnalytics {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      modelUsage: {},
      operationUsage: {},
      hourlyUsage: [],
      dailyUsage: [],
      averageResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      userMetrics: {
        totalUsers: 0,
        activeUsers: 0,
        averageRequestsPerUser: 0,
        topUsers: []
      },
      cacheMetrics: {
        hitRate: 0,
        missRate: 0,
        totalHits: 0,
        totalMisses: 0,
        costSavings: 0
      },
      efficiencyMetrics: {
        wordsPerToken: 0,
        charactersPerToken: 0,
        qualityScore: 0
      }
    }
  }

  /**
   * Get real-time metrics
   */
  getRealtimeMetrics(): {
    requestsPerMinute: number
    averageResponseTime: number
    currentCost: number
    activeOperations: number
  } {
    const lastMinute = new Date(Date.now() - 60 * 1000)
    const recentEvents = this.events.filter(e => e.timestamp >= lastMinute)
    
    const requestsPerMinute = recentEvents.length
    const averageResponseTime = recentEvents.length > 0 
      ? recentEvents.reduce((sum, e) => sum + e.responseTime, 0) / recentEvents.length 
      : 0
    const currentCost = recentEvents.reduce((sum, e) => sum + e.cost, 0)
    
    return {
      requestsPerMinute,
      averageResponseTime,
      currentCost,
      activeOperations: 0 // Would need to track active operations separately
    }
  }

  /**
   * Export analytics data
   */
  exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'id', 'userId', 'operation', 'model', 'inputTokens', 'outputTokens', 
        'cost', 'responseTime', 'success', 'cached', 'timestamp'
      ].join(',')
      
      const rows = this.events.map(event => [
        event.id,
        event.userId,
        event.operation,
        event.model,
        event.inputTokens,
        event.outputTokens,
        event.cost,
        event.responseTime,
        event.success,
        event.cached,
        event.timestamp.toISOString()
      ].join(','))
      
      return [headers, ...rows].join('\n')
    }
    
    return JSON.stringify(this.events, null, 2)
  }
}

// Export singleton instance
export const analyticsService = new ClaudeAnalyticsService()

