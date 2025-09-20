'use client'

import React, { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
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
  Award
} from 'lucide-react'
import { infinitePagesCache } from '@/lib/claude/infinitePagesCache'
import LoadingFallback from '@/components/LoadingFallback'

interface CacheAnalytics {
  totalTokensSaved: number;
  cacheHitRateByType: Record<string, number>;
  topGenres: Array<{ genre: string; efficiency: number }>;
  foundationReuseRate: number;
  costSavingsThisMonth: number;
  avgChaptersPerFoundation: number;
  mostReusedFoundations: Array<{ title: string; reuse_count: number }>;
}

interface CacheAnalyticsDashboardProps {
  userProfile: {
    id: string;
    tokens_remaining: number;
    tokens_saved_cache: number;
    subscription_tier: string;
  };
}

interface CachePerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatePercentage: number;
  avgTokensSavedPerHit: number;
  totalCostSavings: number;
  monthlyTrend: number;
}

export default function CacheAnalyticsDashboard({ userProfile }: CacheAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null)
  const [fingerprintAnalytics, setFingerprintAnalytics] = useState<any>(null)
  const [performance, setPerformance] = useState<CachePerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [activeTimeRange, setActiveTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadAnalytics()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAnalytics, 30000)
    return () => clearInterval(interval)
  }, [userProfile.id, activeTimeRange, retryCount])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load comprehensive analytics with timeout
      const analyticsPromise = infinitePagesCache.getInfinitePagesAnalytics(userProfile.id)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Analytics request timeout')), 10000)
      )

      const analyticsData = await Promise.race([analyticsPromise, timeoutPromise]) as CacheAnalytics
      setAnalytics(analyticsData)

      // Load foundation fingerprint efficiency analytics with fallback
      try {
        const { data: fingerprintData, error: fingerprintError } = await supabase
          .rpc('analyze_foundation_fingerprint_efficiency', { user_id: userProfile.id })

        if (fingerprintError) {
          console.warn('Fingerprint analytics failed:', fingerprintError)
          // Continue without fingerprint data
        } else {
          setFingerprintAnalytics(fingerprintData)
        }
      } catch (fingerprintError) {
        console.warn('Fingerprint analytics error:', fingerprintError)
        // Continue without fingerprint data
      }

      // Calculate performance metrics with fallback
      try {
        const performanceMetrics = await calculatePerformanceMetrics()
        setPerformance(performanceMetrics)
      } catch (perfError) {
        console.warn('Performance metrics failed:', perfError)
        // Continue with basic data
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load cache analytics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  const calculatePerformanceMetrics = async (): Promise<CachePerformanceMetrics> => {
    // Get cache entries for time range
    const daysAgo = activeTimeRange === '7d' ? 7 : activeTimeRange === '30d' ? 30 : 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

    const { data: cacheEntries } = await supabase
      .from('infinite_pages_cache')
      .select('hit_count, token_cost_saved, created_at')
      .eq('user_id', userProfile.id)
      .gte('created_at', cutoffDate.toISOString())

    const totalRequests = cacheEntries?.length || 0
    const cacheHits = cacheEntries?.reduce((sum, entry) => sum + (entry.hit_count || 0), 0) || 0
    const cacheMisses = Math.max(0, totalRequests - cacheHits)
    const hitRatePercentage = totalRequests > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0
    const totalTokensSaved = cacheEntries?.reduce((sum, entry) => sum + (entry.token_cost_saved || 0), 0) || 0
    const avgTokensSavedPerHit = cacheHits > 0 ? totalTokensSaved / cacheHits : 0
    const totalCostSavings = totalTokensSaved * 0.000015

    // Calculate monthly trend (simplified)
    const monthlyTrend = hitRatePercentage > 50 ? 12 : hitRatePercentage > 30 ? 5 : -2

    return {
      totalRequests: totalRequests + cacheHits, // Approximate total including hits
      cacheHits,
      cacheMisses,
      hitRatePercentage,
      avgTokensSavedPerHit,
      totalCostSavings,
      monthlyTrend
    }
  }

  const getEfficiencyColor = (percentage: number) => {
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getEfficiencyBadgeColor = (percentage: number) => {
    if (percentage >= 70) return 'bg-green-100 text-green-800'
    if (percentage >= 50) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Cache Analytics</h2>
          <Button onClick={handleRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Analytics Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-red-500 mb-4">
              Cache analytics are temporarily unavailable. This doesn't affect your story generation.
            </p>
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Cache Analytics</h2>
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        </div>
        <LoadingFallback type="analytics" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Cache Analytics
          </h2>
          <p className="text-gray-600 mt-1">
            Real-time insights into your AI generation efficiency
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Time Range:</span>
        {['7d', '30d', '90d'].map((range) => (
          <Button
            key={range}
            variant={activeTimeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTimeRange(range as '7d' | '30d' | '90d')}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
          </Button>
        ))}
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tokens Saved */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens Saved</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analytics?.totalTokensSaved?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-gray-600">
              Profile total: {userProfile.tokens_saved_cache?.toLocaleString() || 0}
            </p>
          </CardContent>
        </Card>

        {/* Cost Savings */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${performance?.totalCostSavings?.toFixed(3) || '0.000'}
            </div>
            <p className="text-xs text-gray-600 flex items-center">
              {performance?.monthlyTrend && performance.monthlyTrend > 0 ? (
                <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
              )}
              {Math.abs(performance?.monthlyTrend || 0)}% this month
            </p>
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getEfficiencyColor(performance?.hitRatePercentage || 0)}`}>
              {performance?.hitRatePercentage?.toFixed(1) || '0.0'}%
            </div>
            <Progress value={performance?.hitRatePercentage || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        {/* Foundation Reuse */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Foundation Reuse</CardTitle>
            <Database className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics?.foundationReuseRate?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-gray-600">
              Avg chapters: {analytics?.avgChaptersPerFoundation?.toFixed(1) || '0.0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="content-types">Content Types</TabsTrigger>
          <TabsTrigger value="genres">Top Genres</TabsTrigger>
          <TabsTrigger value="foundations">Foundations</TabsTrigger>
          <TabsTrigger value="fingerprints">Fingerprint Efficiency</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cache Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Requests</span>
                  <Badge variant="outline">{performance?.totalRequests?.toLocaleString() || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Cache Hits</span>
                  <Badge className="bg-green-100 text-green-800">
                    {performance?.cacheHits?.toLocaleString() || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Cache Misses</span>
                  <Badge className="bg-red-100 text-red-800">
                    {performance?.cacheMisses?.toLocaleString() || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Avg Tokens/Hit</span>
                  <Badge variant="outline">
                    {performance?.avgTokensSavedPerHit?.toFixed(1) || '0.0'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Efficiency Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Efficiency Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Efficiency</span>
                    <Badge className={getEfficiencyBadgeColor(performance?.hitRatePercentage || 0)}>
                      {performance?.hitRatePercentage && performance.hitRatePercentage >= 70
                        ? 'Excellent'
                        : performance?.hitRatePercentage && performance.hitRatePercentage >= 50
                        ? 'Good'
                        : 'Needs Improvement'
                      }
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">
                    {performance?.hitRatePercentage && performance.hitRatePercentage >= 70
                      ? 'Your cache is performing excellently! You\'re saving significant costs.'
                      : performance?.hitRatePercentage && performance.hitRatePercentage >= 50
                      ? 'Good cache performance. Try creating more stories in similar genres for better efficiency.'
                      : 'Cache is still learning your patterns. Continue creating content for better savings.'
                    }
                  </p>
                </div>

                {performance?.totalCostSavings && performance.totalCostSavings > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-medium text-green-800 mb-1">Monthly Projection</div>
                    <div className="text-lg font-bold text-green-600">
                      ${(performance.totalCostSavings * (30 / (activeTimeRange === '7d' ? 7 : activeTimeRange === '30d' ? 30 : 90))).toFixed(2)}
                    </div>
                    <p className="text-xs text-green-700">Estimated monthly savings</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Types Tab */}
        <TabsContent value="content-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Hit Rates by Content Type</CardTitle>
              <p className="text-sm text-gray-600">
                Performance breakdown by generation type
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.cacheHitRateByType && Object.entries(analytics.cacheHitRateByType).map(([type, rate]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">
                        {type.replace('_', ' ')}
                      </span>
                      <Badge
                        className={getEfficiencyBadgeColor(rate)}
                        variant="outline"
                      >
                        {rate.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={rate} className="h-2" />
                  </div>
                ))}

                {(!analytics?.cacheHitRateByType || Object.keys(analytics.cacheHitRateByType).length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No cache data available yet.</p>
                    <p className="text-sm">Generate some content to see analytics!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Genres Tab */}
        <TabsContent value="genres" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Efficient Genres</CardTitle>
              <p className="text-sm text-gray-600">
                Genres with highest cache reuse rates
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topGenres?.map((genreData, index) => (
                  <div key={genreData.genre} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{genreData.genre}</div>
                      <div className="text-sm text-gray-600">
                        Efficiency Score: {genreData.efficiency.toFixed(1)}/10
                      </div>
                    </div>
                    <Progress value={(genreData.efficiency / 10) * 100} className="w-24 h-2" />
                  </div>
                ))}

                {(!analytics?.topGenres || analytics.topGenres.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No genre data available yet.</p>
                    <p className="text-sm">Create stories in different genres to see rankings!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Foundations Tab */}
        <TabsContent value="foundations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Reused Foundations</CardTitle>
              <p className="text-sm text-gray-600">
                Story foundations generating the most derivative content
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.mostReusedFoundations?.map((foundation, index) => (
                  <div key={foundation.title} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{foundation.title}</div>
                        <div className="text-sm text-gray-600">
                          {foundation.reuse_count} reuses
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      High Value
                    </Badge>
                  </div>
                ))}

                {(!analytics?.mostReusedFoundations || analytics.mostReusedFoundations.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No reuse data available yet.</p>
                    <p className="text-sm">Create multiple stories to see foundation reuse patterns!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Foundation Fingerprint Efficiency Tab */}
        <TabsContent value="fingerprints" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fingerprint Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Fingerprint Efficiency Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fingerprintAnalytics ? (
                  <>
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Efficiency Score</span>
                        <Badge className={`${
                          fingerprintAnalytics.efficiencyScore >= 70 ? 'bg-green-100 text-green-800' :
                          fingerprintAnalytics.efficiencyScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {fingerprintAnalytics.efficiencyScore?.toFixed(1) || '0.0'}/100
                        </Badge>
                      </div>
                      <Progress value={fingerprintAnalytics.efficiencyScore || 0} className="h-3 mb-2" />
                      <p className="text-xs text-gray-600">
                        Based on collision rate, reuse patterns, and fingerprint uniqueness
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {fingerprintAnalytics.fingerprintStats?.totalFoundations || 0}
                        </div>
                        <div className="text-sm text-gray-600">Total Foundations</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {fingerprintAnalytics.fingerprintStats?.uniqueFingerprints || 0}
                        </div>
                        <div className="text-sm text-gray-600">Unique Fingerprints</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Collision Rate</span>
                        <Badge variant="outline" className={
                          (fingerprintAnalytics.collisionRate || 0) < 5 ? 'text-green-600' :
                          (fingerprintAnalytics.collisionRate || 0) < 15 ? 'text-yellow-600' :
                          'text-red-600'
                        }>
                          {fingerprintAnalytics.collisionRate?.toFixed(1) || '0.0'}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Avg Reuse per Fingerprint</span>
                        <Badge variant="outline">
                          {fingerprintAnalytics.fingerprintStats?.avgReusePerFingerprint || '0.0'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Max Reuse per Fingerprint</span>
                        <Badge variant="outline">
                          {fingerprintAnalytics.fingerprintStats?.maxReusePerFingerprint || '0'}
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Loading fingerprint analytics...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reuse Patterns by Genre */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Reuse Patterns by Genre
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fingerprintAnalytics?.reusePatterns && fingerprintAnalytics.reusePatterns.length > 0 ? (
                  <div className="space-y-3">
                    {fingerprintAnalytics.reusePatterns.map((pattern: any, index: number) => (
                      <div key={pattern.genre} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{pattern.genre}</div>
                          <Badge className="bg-blue-100 text-blue-800">
                            ${pattern.totalSavings?.toFixed(3) || '0.000'} saved
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Avg Chapters:</span>
                            <span className="ml-2 font-medium">{pattern.avgChaptersPerFoundation}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Reuse Efficiency:</span>
                            <span className="ml-2 font-medium">{pattern.reuseEfficiency}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No reuse patterns available yet.</p>
                    <p className="text-sm">Create foundations in different genres to see patterns!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {fingerprintAnalytics?.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Optimization Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fingerprintAnalytics.recommendations.map((recommendation: string, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}