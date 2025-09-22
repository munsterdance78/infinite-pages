/**
 * Database query optimization utilities
 */

import React from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database, TypedSupabaseClient } from '@/lib/types/database'

// Query performance monitoring
interface QueryMetrics {
  query: string
  executionTime: number
  rowsReturned: number
  cacheHit: boolean
  timestamp: string
}

class QueryOptimizer {
  private client: TypedSupabaseClient
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private metrics: QueryMetrics[] = []

  constructor() {
    this.client = createClient() as unknown as TypedSupabaseClient
  }

  // Optimized story queries with proper JOINs
  async getStoriesWithAuthors(filters: {
    genre?: string
    status?: string
    limit?: number
    offset?: number
  } = {}) {
    const cacheKey = `stories_with_authors_${JSON.stringify(filters)}`
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    const startTime = performance.now()

    let query = this.client
      .from('stories')
      .select(`
        id,
        title,
        genre,
        status,
        premise,
        created_at,
        updated_at,
        published_at,
        total_words,
        total_tokens,
        views,
        earnings_usd,
        profiles!stories_user_id_fkey (
          id,
          full_name,
          display_name,
          avatar_url
        )
      `)

    // Apply filters efficiently
    if (filters.genre) {
      query = (query as any).eq('genre', filters.genre)
    }
    if (filters.status) {
      query = (query as any).eq('status', filters.status)
    }

    // Use limit and offset for pagination
    if (filters.limit) {
      query = (query as any).limit(filters.limit)
    }
    if (filters.offset) {
      query = (query as any).range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
    }

    const { data, error } = await (query as any)
      .order('created_at', { ascending: false })

    const executionTime = performance.now() - startTime
    this.recordMetrics('getStoriesWithAuthors', executionTime, data?.length || 0, false)

    if (error) throw error

    // Cache for 5 minutes
    this.setCachedResult(cacheKey, data, 5 * 60 * 1000)
    return data
  }

  // Optimized user stories with chapter counts
  async getUserStoriesWithCounts(userId: string) {
    const cacheKey = `user_stories_counts_${userId}`
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    const startTime = performance.now()

    const { data, error } = await (this.client
      .from('stories')
      .select(`
        id,
        title,
        genre,
        status,
        created_at,
        updated_at,
        total_words,
        chapters!chapters_story_id_fkey (count)
      `) as any)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    const executionTime = performance.now() - startTime
    this.recordMetrics('getUserStoriesWithCounts', executionTime, data?.length || 0, false)

    if (error) throw error

    // Cache for 2 minutes
    this.setCachedResult(cacheKey, data, 2 * 60 * 1000)
    return data
  }

  // Optimized creator earnings with aggregations
  async getCreatorEarningsWithStats(userId: string, period: string = 'current_month') {
    const cacheKey = `creator_earnings_stats_${userId}_${period}`
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    const startTime = performance.now()

    // Calculate date range
    const now = new Date()
    let startDate: string

    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
        break
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
        break
      default:
        startDate = new Date(now.getFullYear(), 0, 1).toISOString()
    }

    // Use a single query with aggregations instead of multiple queries
    const { data, error } = await (this.client
      .from('creator_earnings')
      .select(`
        id,
        story_id,
        amount_usd,
        created_at,
        stories!creator_earnings_story_id_fkey (
          id,
          title,
          genre,
          views
        )
      `) as any)
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    const executionTime = performance.now() - startTime
    this.recordMetrics('getCreatorEarningsWithStats', executionTime, data?.length || 0, false)

    if (error) throw error

    // Process aggregations in JavaScript (more efficient than multiple DB queries)
    const stats = {
      totalEarnings: data.reduce((sum: number, earning: any) => sum + earning.amount_usd, 0),
      earningsCount: data.length,
      uniqueStories: new Set(data.map((e: any) => e.story_id)).size,
      topStory: data.sort((a: any, b: any) => b.amount_usd - a.amount_usd)[0],
      earnings: data
    }

    // Cache for 5 minutes
    this.setCachedResult(cacheKey, stats, 5 * 60 * 1000)
    return stats
  }

  // Optimized AI usage analytics
  async getAIUsageAnalytics(userId: string, period: string = 'current_month') {
    const cacheKey = `ai_usage_analytics_${userId}_${period}`
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    const startTime = performance.now()

    // Calculate date range
    const now = new Date()
    let startDate: string

    switch (period) {
      case 'current_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
    }

    const { data, error } = await (this.client
      .from('ai_usage_logs')
      .select(`
        operation_type,
        tokens_input,
        tokens_output,
        actual_cost_usd,
        ai_model_used,
        created_at
      `) as any)
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })

    const executionTime = performance.now() - startTime
    this.recordMetrics('getAIUsageAnalytics', executionTime, data?.length || 0, false)

    if (error) throw error

    // Process analytics in memory
    const analytics = {
      totalTokens: data.reduce((sum: number, log: any) => sum + log.tokens_input + log.tokens_output, 0),
      totalCost: data.reduce((sum: number, log: any) => sum + log.actual_cost_usd, 0),
      operationBreakdown: this.groupBy(data, 'operation_type'),
      modelBreakdown: this.groupBy(data, 'ai_model_used'),
      dailyUsage: this.groupByDay(data),
      logs: data
    }

    // Cache for 10 minutes
    this.setCachedResult(cacheKey, analytics, 10 * 60 * 1000)
    return analytics
  }

  // Batch query for multiple stories with their chapters
  async getStoriesWithChaptersBatch(storyIds: string[]) {
    if (storyIds.length === 0) return []

    const cacheKey = `stories_chapters_batch_${storyIds.sort().join(',')}`
    const cached = this.getCachedResult(cacheKey)
    if (cached) return cached

    const startTime = performance.now()

    const { data, error } = await (this.client
      .from('stories')
      .select(`
        id,
        title,
        genre,
        status,
        created_at,
        chapters!chapters_story_id_fkey (
          id,
          chapter_number,
          title,
          content,
          word_count,
          created_at
        )
      `) as any)
      .in('id', storyIds)
      .order('created_at', { ascending: false })

    const executionTime = performance.now() - startTime
    this.recordMetrics('getStoriesWithChaptersBatch', executionTime, data?.length || 0, false)

    if (error) throw error

    // Cache for 3 minutes
    this.setCachedResult(cacheKey, data, 3 * 60 * 1000)
    return data
  }

  // Cache management
  private getCachedResult(key: string) {
    const cached = this.queryCache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.recordMetrics(key, 0, 0, true)
      return cached.data
    }
    this.queryCache.delete(key)
    return null
  }

  private setCachedResult(key: string, data: any, ttl: number) {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  // Metrics recording
  private recordMetrics(query: string, executionTime: number, rowsReturned: number, cacheHit: boolean) {
    this.metrics.push({
      query,
      executionTime,
      rowsReturned,
      cacheHit,
      timestamp: new Date().toISOString()
    })

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // Utility functions for data processing
  private groupBy(array: any[], key: string) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown'
      if (!groups[group]) {
        groups[group] = { items: [], count: 0, total: 0 }
      }
      groups[group].items.push(item)
      groups[group].count++
      if (item.actual_cost_usd) {
        groups[group].total += item.actual_cost_usd
      }
      return groups
    }, {})
  }

  private groupByDay(array: any[]) {
    return array.reduce((groups, item) => {
      const day = item.created_at.split('T')[0]
      if (!groups[day]) {
        groups[day] = { date: day, count: 0, tokens: 0, cost: 0 }
      }
      groups[day].count++
      groups[day].tokens += (item.tokens_input || 0) + (item.tokens_output || 0)
      groups[day].cost += item.actual_cost_usd || 0
      return groups
    }, {})
  }

  // Performance monitoring
  getPerformanceMetrics() {
    const totalQueries = this.metrics.length
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    const avgExecutionTime = this.metrics
      .filter(m => !m.cacheHit)
      .reduce((sum, m) => sum + m.executionTime, 0) / Math.max(1, totalQueries - cacheHits)

    return {
      totalQueries,
      cacheHits,
      cacheHitRate: totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0,
      avgExecutionTime,
      slowQueries: this.metrics
        .filter(m => !m.cacheHit && m.executionTime > 1000)
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, 10)
    }
  }

  // Clear cache (useful for testing)
  clearCache() {
    this.queryCache.clear()
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys()),
      totalMemory: JSON.stringify(Array.from(this.queryCache.values())).length
    }
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer()

// Hook for React components
export function useOptimizedQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: any[] = [],
  cacheTime: number = 5 * 60 * 1000
) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const executeQuery = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await queryFn()
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Query failed'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    executeQuery()

    return () => {
      cancelled = true
    }
  }, dependencies)

  return { data, loading, error, refetch: () => queryFn() }
}

// Performance monitoring endpoint data
export async function getQueryPerformanceReport() {
  const metrics = queryOptimizer.getPerformanceMetrics()
  const cacheStats = queryOptimizer.getCacheStats()

  return {
    performance: metrics,
    cache: cacheStats,
    recommendations: generatePerformanceRecommendations(metrics)
  }
}

function generatePerformanceRecommendations(metrics: any) {
  const recommendations = []

  if (metrics.cacheHitRate < 50) {
    recommendations.push({
      type: 'cache',
      priority: 'high',
      message: 'Cache hit rate is low. Consider increasing cache TTL or identifying frequently accessed data.'
    })
  }

  if (metrics.avgExecutionTime > 500) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: 'Average query execution time is high. Review database indexes and query optimization.'
    })
  }

  if (metrics.slowQueries.length > 5) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: 'Multiple slow queries detected. Consider query optimization or database tuning.'
    })
  }

  return recommendations
}