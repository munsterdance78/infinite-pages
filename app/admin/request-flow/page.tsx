'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  X
} from 'lucide-react'

interface RequestLog {
  id: string
  request_id: string
  session_id: string
  user_id?: string
  frontend_action: string
  frontend_component: string
  frontend_page: string
  api_endpoint: string
  expected_endpoint?: string
  http_method: string
  response_status: number
  response_time_ms: number
  success_flag: boolean
  error_message?: string
  error_category?: string
  integration_point: string
  expected_integration?: string
  integration_success: boolean
  user_tier?: string
  device_info: any
  total_time_ms: number
  custom_data?: any
  created_at: string
}

interface DashboardStats {
  requests_last_hour: number
  errors_last_hour: number
  overall_success_rate: number
  hourly_success_rate: number
  avg_response_time_hour: number
  max_response_time_hour: number
  active_users_hour: number
  active_sessions_hour: number
  endpoint_mismatches_hour: number
}

interface IntegrationHealth {
  integration_point: string
  total_requests: number
  success_rate: number
  avg_response_time: number
  recent_errors: number
}

export default function RequestFlowDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentRequests, setRecentRequests] = useState<RequestLog[]>([])
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterEndpoint, setFilterEndpoint] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [showSuccessOnly, setShowSuccessOnly] = useState(false)

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats
      const statsResponse = await fetch('/api/admin/request-flow/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Fetch recent requests
      const requestsResponse = await fetch('/api/admin/request-flow/recent')
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setRecentRequests(requestsData)
      }

      // Fetch integration health
      const healthResponse = await fetch('/api/admin/request-flow/health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setIntegrationHealth(healthData)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  const filteredRequests = recentRequests.filter(request => {
    if (showSuccessOnly && !request.success_flag) return false
    if (filterEndpoint && !request.api_endpoint.includes(filterEndpoint)) return false
    if (filterAction && !request.frontend_action.includes(filterAction)) return false
    return true
  })

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-red-500" />
    )
  }

  const getResponseTimeColor = (time: number) => {
    if (time < 500) return 'text-green-600'
    if (time < 2000) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Request Flow Dashboard</h1>
          <p className="text-gray-600">Monitor API requests from frontend actions to responses</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button onClick={fetchDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Requests (Last Hour)</p>
                  <p className="text-3xl font-bold">{stats.requests_last_hour}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.hourly_success_rate || 0}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className="text-3xl font-bold">
                    {stats.avg_response_time_hour || 0}ms
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold">{stats.active_users_hour}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {stats && stats.errors_last_hour > 10 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            High error rate detected: {stats.errors_last_hour} errors in the last hour
          </AlertDescription>
        </Alert>
      )}

      {stats && stats.endpoint_mismatches_hour > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {stats.endpoint_mismatches_hour} endpoint mismatches detected in the last hour
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">Recent Requests</TabsTrigger>
          <TabsTrigger value="integrations">Integration Health</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Flow Mapping</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Filter by endpoint..."
                    value={filterEndpoint}
                    onChange={(e) => setFilterEndpoint(e.target.value)}
                    className="w-48"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Filter by action..."
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="w-48"
                  />
                </div>
                <Button
                  variant={showSuccessOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSuccessOnly(!showSuccessOnly)}
                >
                  Success Only
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredRequests.slice(0, 50).map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.success_flag)}
                        <Badge variant="outline">{request.frontend_action}</Badge>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {request.api_endpoint}
                        </code>
                        <span className={getResponseTimeColor(request.response_time_ms)}>
                          {request.response_time_ms}ms
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTime(request.created_at)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 flex items-center gap-4">
                      <span>Component: {request.frontend_component}</span>
                      <span>Integration: {request.integration_point}</span>
                      <span>Status: {request.response_status}</span>
                      {request.expected_endpoint && request.api_endpoint !== request.expected_endpoint && (
                        <Badge variant="destructive" className="text-xs">
                          Endpoint Mismatch
                        </Badge>
                      )}
                    </div>

                    {request.error_message && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {request.error_message}
                      </div>
                    )}
                  </div>
                ))}

                {filteredRequests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No requests found matching your filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Health Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {integrationHealth.map((integration) => (
                  <div key={integration.integration_point} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{integration.integration_point}</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={integration.success_rate > 90 ? "default" : "destructive"}
                        >
                          {integration.success_rate}% Success
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {integration.total_requests} requests
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Avg Response Time:</span>
                        <span className={`ml-2 ${getResponseTimeColor(integration.avg_response_time)}`}>
                          {integration.avg_response_time}ms
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Recent Errors:</span>
                        <span className={`ml-2 ${integration.recent_errors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {integration.recent_errors}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Health:</span>
                        <span className={`ml-2 ${integration.success_rate > 95 ? 'text-green-600' : integration.success_rate > 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {integration.success_rate > 95 ? 'Healthy' : integration.success_rate > 90 ? 'Warning' : 'Critical'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {integrationHealth.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No integration data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Flow Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Most Active Endpoints</h4>
                  <div className="space-y-2">
                    {/* This would be populated with endpoint analytics */}
                    <div className="flex justify-between items-center p-2 border rounded">
                      <code className="text-sm">/api/stories/generate</code>
                      <Badge>245 requests</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 border rounded">
                      <code className="text-sm">/api/chapters/create</code>
                      <Badge>189 requests</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Common Error Patterns</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">Rate Limit Exceeded</span>
                      <Badge variant="destructive">12 errors</Badge>
                    </div>
                    <div className="flex justify-between items-center p-2 border rounded">
                      <span className="text-sm">Authentication Failed</span>
                      <Badge variant="destructive">8 errors</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}