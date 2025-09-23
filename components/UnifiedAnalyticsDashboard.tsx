'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  BarChart3,
  RefreshCw,
  Target,
  Clock,
  Database,
  Award,
  BookOpen,
  FileText,
  Calendar,
  Eye,
  Coins,
  Activity
} from 'lucide-react'
import { formatCost, formatTokens, calculateMonthlySavings, type UsageStats } from '@/lib/ai-cost-calculator'
import LoadingFallback from '@/components/LoadingFallback'

// Unified interface combining all analytics types
interface UnifiedAnalyticsData {
  // Cache Analytics
  cacheMetrics: {
    totalTokensSaved: number
    cacheHitRateByType: Record<string, number>
    topGenres: Array<{ genre: string; efficiency: number }>
    foundationReuseRate: number
    costSavingsThisMonth: number
    avgChaptersPerFoundation: number
    mostReusedFoundations: Array<{ title: string; reuse_count: number }>
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    hitRatePercentage: number
    avgTokensSavedPerHit: number
    totalCostSavings: number
  }

  // General Analytics
  userStats: {
    totalStories: number
    totalChapters: number
    totalWords: number
    totalTokensUsed: number
    totalCostUSD: number
    averageWordsPerStory: number
    efficiency: number
    daysActive: number
  }

  // AI Usage Analytics
  aiUsage: UsageStats

  // Comprehensive metrics
  performance: {
    weeklyGrowth: number
    monthlyGrowth: number
    costEfficiency: number
    userEngagement: number
  }
}

interface UnifiedAnalyticsDashboardProps {
  userProfile: {
    id: string
    email: string
    subscription_tier: string
    tokens_remaining: number
    tokens_used_total: number
    stories_created: number
    tokens_saved_cache?: number
  }
  defaultTab?: 'cache' | 'general' | 'ai-usage' | 'comprehensive'
  compact?: boolean
}

export default function UnifiedAnalyticsDashboard({
  userProfile,
  defaultTab = 'comprehensive',
  compact = false
}: UnifiedAnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] = useState<UnifiedAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [timeRange, setTimeRange] = useState('current_month')
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Parallel data fetching for all analytics types
      const [cacheResponse, generalResponse, aiUsageResponse] = await Promise.allSettled([
        fetch(`/api/cache/analytics?period=${timeRange}`),
        fetch(`/api/dashboard?period=${timeRange}`),
        fetch(`/api/ai-usage/track?period=${timeRange}`)
      ])

      const unifiedData: UnifiedAnalyticsData = {
        cacheMetrics: {
          totalTokensSaved: userProfile.tokens_saved_cache || 0,
          cacheHitRateByType: {},
          topGenres: [],
          foundationReuseRate: 0,
          costSavingsThisMonth: 0,
          avgChaptersPerFoundation: 0,
          mostReusedFoundations: [],
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRatePercentage: 0,
          avgTokensSavedPerHit: 0,
          totalCostSavings: 0
        },
        userStats: {
          totalStories: userProfile.stories_created || 0,
          totalChapters: 0,
          totalWords: 0,
          totalTokensUsed: userProfile.tokens_used_total || 0,
          totalCostUSD: 0,
          averageWordsPerStory: 0,
          efficiency: 0,
          daysActive: 0
        },
        aiUsage: {
          totalTokensUsed: userProfile.tokens_used_total || 0,
          totalCostUSD: 0,
          operationBreakdown: [],
          modelBreakdown: [],
          dailyUsage: [],
          monthlySavings: 0,
          efficiency: 0
        } as any,
        performance: {
          weeklyGrowth: 0,
          monthlyGrowth: 0,
          costEfficiency: 0,
          userEngagement: 0
        }
      }

      // Process successful responses
      if (cacheResponse.status === 'fulfilled' && cacheResponse.value.ok) {
        const cacheData = await cacheResponse.value.json()
        unifiedData.cacheMetrics = { ...unifiedData.cacheMetrics, ...cacheData }
      }

      if (generalResponse.status === 'fulfilled' && generalResponse.value.ok) {
        const generalData = await generalResponse.value.json()
        unifiedData.userStats = { ...unifiedData.userStats, ...generalData.userStats }
      }

      if (aiUsageResponse.status === 'fulfilled' && aiUsageResponse.value.ok) {
        const aiData = await aiUsageResponse.value.json()
        unifiedData.aiUsage = { ...unifiedData.aiUsage, ...aiData }
      }

      // Calculate comprehensive performance metrics
      unifiedData.performance = {
        weeklyGrowth: calculateWeeklyGrowth(unifiedData),
        monthlyGrowth: calculateMonthlyGrowth(unifiedData),
        costEfficiency: calculateCostEfficiency(unifiedData),
        userEngagement: calculateUserEngagement(unifiedData)
      }

      setAnalyticsData(unifiedData)
    } catch (error) {
      console.error('Error loading unified analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAnalytics()
  }

  // Helper functions for comprehensive metrics
  const calculateWeeklyGrowth = (data: UnifiedAnalyticsData): number => {
    return Math.round((data.userStats.totalStories / 7) * 100) / 100
  }

  const calculateMonthlyGrowth = (data: UnifiedAnalyticsData): number => {
    return Math.round((data.userStats.totalStories / 30) * 100) / 100
  }

  const calculateCostEfficiency = (data: UnifiedAnalyticsData): number => {
    const totalCost = (data.userStats as any).totalCostUSD + (data.aiUsage as any).totalCostUSD
    const savings = data.cacheMetrics.totalCostSavings
    return totalCost > 0 ? Math.round((savings / totalCost) * 100) : 0
  }

  const calculateUserEngagement = (data: UnifiedAnalyticsData): number => {
    const stories = data.userStats.totalStories
    const days = data.userStats.daysActive || 1
    return Math.round((stories / days) * 100) / 100
  }

  if (loading) {
    return <LoadingFallback />
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Unable to load analytics data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive insights into your content creation</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tab-based Analytics Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="comprehensive">Overview</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
        </TabsList>

        {/* Comprehensive Overview Tab */}
        <TabsContent value="comprehensive" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.userStats.totalStories}</div>
                <p className="text-xs text-muted-foreground">
                  +{analyticsData.performance.weeklyGrowth} this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.performance.costEfficiency}%</div>
                <p className="text-xs text-muted-foreground">
                  {formatCost(analyticsData.cacheMetrics.totalCostSavings)} saved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.cacheMetrics.hitRatePercentage}%</div>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(analyticsData.cacheMetrics.totalTokensSaved)} saved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.performance.userEngagement}</div>
                <p className="text-xs text-muted-foreground">
                  stories per day
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Monthly Growth</span>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm">{analyticsData.performance.monthlyGrowth}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Usage</span>
                  <span className="text-sm">{formatTokens(analyticsData.userStats.totalTokensUsed)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Cost</span>
                  <span className="text-sm">{formatCost(analyticsData.userStats.totalCostUSD)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache Analytics Tab */}
        <TabsContent value="cache" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.cacheMetrics.hitRatePercentage}%</div>
                <Progress value={analyticsData.cacheMetrics.hitRatePercentage} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {analyticsData.cacheMetrics.cacheHits} hits / {analyticsData.cacheMetrics.totalRequests} requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tokens Saved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTokens(analyticsData.cacheMetrics.totalTokensSaved)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(analyticsData.cacheMetrics.avgTokensSavedPerHit)} avg per hit
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(analyticsData.cacheMetrics.totalCostSavings)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCost(analyticsData.cacheMetrics.costSavingsThisMonth)} this month
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Foundation Reuse Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analyticsData.cacheMetrics.foundationReuseRate}%</div>
              <Progress value={analyticsData.cacheMetrics.foundationReuseRate} className="mt-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {analyticsData.cacheMetrics.avgChaptersPerFoundation} chapters per foundation on average
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Analytics Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Words</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.userStats.totalWords.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData.userStats.averageWordsPerStory} avg per story
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Chapters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.userStats.totalChapters}</div>
                <p className="text-xs text-muted-foreground">
                  across {analyticsData.userStats.totalStories} stories
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.userStats.efficiency}%</div>
                <Progress value={analyticsData.userStats.efficiency} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Days Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.userStats.daysActive}</div>
                <p className="text-xs text-muted-foreground">
                  {analyticsData.performance.userEngagement} stories/day
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usage Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Tokens Used</span>
                  <span className="font-medium">{formatTokens(analyticsData.userStats.totalTokensUsed)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost</span>
                  <span className="font-medium">{formatCost(analyticsData.userStats.totalCostUSD)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining Tokens</span>
                  <span className="font-medium">{formatTokens(userProfile.tokens_remaining)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Usage Tab */}
        <TabsContent value="ai-usage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatTokens((analyticsData.aiUsage as any).totalTokensUsed)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCost((analyticsData.aiUsage as any).totalCostUSD)} cost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(analyticsData.aiUsage as any).efficiency}%</div>
                <Progress value={(analyticsData.aiUsage as any).efficiency} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Monthly Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost((analyticsData.aiUsage as any).monthlySavings)}</div>
                <p className="text-xs text-muted-foreground">vs standard pricing</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Operation Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.isArray((analyticsData.aiUsage as any).operationBreakdown) ? (analyticsData.aiUsage as any).operationBreakdown.map((op: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{op.operation_type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatTokens(op.total_tokens)}</span>
                      <Badge variant="outline">{formatCost(op.total_cost)}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500 py-4">No operation data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}