'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  Zap, 
  Database, 
  RefreshCw,
  Download,
  Settings,
  Activity
} from 'lucide-react'
import { claudeService } from '@/lib/claude'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface DashboardData {
  analytics: any
  cacheStats: any
  healthStatus: any
  realtimeMetrics: any
}

export default function ClaudeAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [analytics, cacheStats, healthStatus] = await Promise.all([
        claudeService.getAnalytics(),
        claudeService.getCacheStats(),
        claudeService.getHealthStatus()
      ])

      setData({
        analytics,
        cacheStats,
        healthStatus,
        realtimeMetrics: {
          requestsPerMinute: Math.floor(Math.random() * 20) + 5, // Mock data
          averageResponseTime: Math.floor(Math.random() * 2000) + 500,
          currentCost: Math.random() * 10,
          activeOperations: Math.floor(Math.random() * 5)
        }
      })
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-red-800 font-medium">Error Loading Dashboard</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <Button onClick={fetchData} variant="outline" className="mt-3">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  if (!data) return null

  const { analytics, cacheStats, healthStatus, realtimeMetrics } = data

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claude AI Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{formatNumber(analytics.totalRequests)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{(analytics.successRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold">{analytics.averageResponseTime.toFixed(0)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Real-time Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {realtimeMetrics.requestsPerMinute}
              </div>
              <div className="text-sm text-gray-600">Requests/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {realtimeMetrics.averageResponseTime}ms
              </div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(realtimeMetrics.currentCost)}
              </div>
              <div className="text-sm text-gray-600">Current Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {realtimeMetrics.activeOperations}
              </div>
              <div className="text-sm text-gray-600">Active Ops</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Usage (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.dailyUsage.slice(-7).map((day: any, index: number) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(day.requests / Math.max(...analytics.dailyUsage.map((d: any) => d.requests))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{day.requests}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Model Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Model Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.modelUsage).map(([model, usage]: [string, any]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{model}</div>
                        <div className="text-sm text-gray-600">
                          {usage.requests} requests • {formatCurrency(usage.cost)}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {((usage.requests / analytics.totalRequests) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.modelUsage).map(([model, usage]: [string, any]) => (
                  <div key={model} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{model}</h3>
                      <Badge variant="outline">
                        {formatCurrency(usage.cost)} total
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Requests</div>
                        <div className="font-medium">{formatNumber(usage.requests)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Tokens</div>
                        <div className="font-medium">{formatNumber(usage.tokens)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Avg Cost</div>
                        <div className="font-medium">{formatCurrency(usage.cost / usage.requests)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operation Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(analytics.operationUsage).map(([operation, usage]: [string, any]) => (
                  <div key={operation} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{operation.replace('_', ' ')}</div>
                      <div className="text-sm text-gray-600">
                        {usage.requests} requests • {usage.averageTokens.toFixed(0)} avg tokens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(usage.cost)}</div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(usage.cost / usage.requests)} per request
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Cache Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Cache Size:</span>
                      <span>{cacheStats.size} / {cacheStats.maxSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hit Rate:</span>
                      <span>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Cost:</span>
                      <span>{formatCurrency(cacheStats.totalCost)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Top Cached Entries</h3>
                  <div className="space-y-2">
                    {cacheStats.entries.slice(0, 5).map((entry: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{entry.operation}</span>
                        <span>{formatCurrency(entry.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.userMetrics.totalUsers}
                  </div>
                  <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.userMetrics.activeUsers}
                  </div>
                  <div className="text-sm text-gray-600">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.userMetrics.averageRequestsPerUser.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600">Avg Requests/User</div>
                </div>
              </div>
              
              <h3 className="font-semibold mb-3">Top Users by Usage</h3>
              <div className="space-y-2">
                {analytics.userMetrics.topUsers.map((user: any, index: number) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{user.userId}</div>
                      <div className="text-sm text-gray-600">
                        {user.requests} requests • {formatNumber(user.tokens)} tokens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(user.cost)}</div>
                      <div className="text-sm text-gray-600">#{index + 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
