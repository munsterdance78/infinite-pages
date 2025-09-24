'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertTriangle,
  Bug,
  Activity,
  Users,
  Clock,
  TrendingUp,
  Filter,
  Search,
  RefreshCw,
  Download,
  Eye,
  X
} from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ErrorReport {
  id: string
  message: string
  stack?: string
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  url: string
  user_id?: string
  component?: string
  operation?: string
  api_endpoint?: string
  status_code?: number
  response_time?: number
  created_at: string
  fingerprint?: string
  custom_data?: any
}

interface ErrorStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
  recentTrend: number
}

export default function ErrorMonitoringPage() {
  const [errors, setErrors] = useState<ErrorReport[]>([])
  const [stats, setStats] = useState<ErrorStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    byCategory: {},
    bySource: {},
    recentTrend: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    category: 'all',
    timeRange: '24h',
    search: ''
  })

  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchErrorData()
  }, [filters])

  const fetchErrorData = async () => {
    setLoading(true)
    try {
      // Build query based on filters
      let query = supabase
        .from('error_reports')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.severity !== 'all') {
        query = query.eq('severity', filters.severity)
      }

      if (filters.category !== 'all') {
        query = query.eq('category', filters.category)
      }

      // Time range filter
      const now = new Date()
      const timeRanges = {
        '1h': new Date(now.getTime() - 1 * 60 * 60 * 1000),
        '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      if (timeRanges[filters.timeRange as keyof typeof timeRanges]) {
        query = query.gte('created_at', timeRanges[filters.timeRange as keyof typeof timeRanges].toISOString())
      }

      // Search filter
      if (filters.search) {
        query = query.or(`message.ilike.%${filters.search}%,component.ilike.%${filters.search}%,operation.ilike.%${filters.search}%`)
      }

      const { data, error } = await query.limit(100)

      if (error) throw error

      setErrors(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching error data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (errorData: ErrorReport[]) => {
    const stats: ErrorStats = {
      total: errorData.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byCategory: {},
      bySource: {},
      recentTrend: 0
    }

    errorData.forEach(error => {
      // Count by severity
      stats[error.severity as keyof Pick<ErrorStats, 'critical' | 'high' | 'medium' | 'low'>]++

      // Count by category
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1

      // Count by source
      stats.bySource[error.source] = (stats.bySource[error.source] || 0) + 1
    })

    // Calculate recent trend (last hour vs previous hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const recentCount = errorData.filter(e => new Date(e.created_at) > oneHourAgo).length
    const previousCount = errorData.filter(e => {
      const date = new Date(e.created_at)
      return date <= oneHourAgo && date > twoHoursAgo
    }).length

    stats.recentTrend = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 0

    setStats(stats)
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500'
    }
    return colors[severity as keyof typeof colors] || 'bg-gray-500'
  }

  const getSeverityBadgeVariant = (severity: string) => {
    const variants = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'secondary',
      low: 'outline'
    }
    return variants[severity as keyof typeof variants] || 'outline'
  }

  const exportErrors = () => {
    const csv = [
      'Timestamp,Severity,Category,Message,Component,Operation,User ID,URL',
      ...errors.map(error =>
        `"${error.created_at}","${error.severity}","${error.category}","${error.message}","${error.component || ''}","${error.operation || ''}","${error.user_id || ''}","${error.url}"`
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading error data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">🔍 Error Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-2">Built-in error tracking using Supabase</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchErrorData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportErrors} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Errors</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Bug className="h-8 w-8 text-gray-400" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              {stats.recentTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
              ) : (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1 rotate-180" />
              )}
              <span className={stats.recentTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs(stats.recentTrend).toFixed(1)}% vs last hour
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical</p>
                <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-orange-500">{stats.high}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users Affected</p>
                <p className="text-2xl font-bold">{new Set(errors.filter(e => e.user_id).map(e => e.user_id)).size}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select value={filters.severity} onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value }))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.keys(stats.byCategory).map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.timeRange} onValueChange={(value) => setFilters(prev => ({ ...prev, timeRange: value }))}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search errors..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-48"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors ({errors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bug className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No errors found for the selected filters.</p>
                <p className="text-sm">Your application is running smoothly! 🎉</p>
              </div>
            ) : (
              errors.map((error) => (
                <div
                  key={error.id}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedError(error)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getSeverityBadgeVariant(error.severity)}>
                          {error.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{error.category.replace('_', ' ')}</Badge>
                        {error.component && (
                          <Badge variant="secondary">{error.component}</Badge>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(error.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 mb-1">{error.message}</p>
                      <div className="text-sm text-gray-600 space-x-4">
                        {error.operation && <span>Operation: {error.operation}</span>}
                        {error.user_id && <span>User: {error.user_id.slice(0, 8)}...</span>}
                        {error.response_time && <span>Response: {error.response_time}ms</span>}
                      </div>
                    </div>
                    <Eye className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold">Error Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-gray-700">Severity</label>
                  <Badge variant={getSeverityBadgeVariant(selectedError.severity)} className="ml-2">
                    {selectedError.severity.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Category</label>
                  <p className="text-gray-900">{selectedError.category.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Source</label>
                  <p className="text-gray-900">{selectedError.source}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Timestamp</label>
                  <p className="text-gray-900">{new Date(selectedError.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="font-medium text-gray-700">Message</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded mt-1">{selectedError.message}</p>
              </div>

              {selectedError.stack && (
                <div>
                  <label className="font-medium text-gray-700">Stack Trace</label>
                  <pre className="text-sm bg-gray-900 text-green-400 p-4 rounded mt-1 overflow-x-auto">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-gray-700">Component</label>
                  <p className="text-gray-900">{selectedError.component || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Operation</label>
                  <p className="text-gray-900">{selectedError.operation || 'N/A'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">User ID</label>
                  <p className="text-gray-900">{selectedError.user_id || 'Anonymous'}</p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Response Time</label>
                  <p className="text-gray-900">{selectedError.response_time ? `${selectedError.response_time}ms` : 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="font-medium text-gray-700">URL</label>
                <p className="text-gray-900 break-all">{selectedError.url}</p>
              </div>

              {selectedError.custom_data && (
                <div>
                  <label className="font-medium text-gray-700">Custom Data</label>
                  <pre className="text-sm bg-gray-50 p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedError.custom_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}