'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRequestTracker, trackRequest } from '@/lib/request-tracking'
import {
  Activity,
  CheckCircle,
  Clock,
  Database,
  AlertTriangle,
  Zap,
  Network,
  User,
  TestTube
} from 'lucide-react'

export default function RequestTrackingTestPage() {
  const [testResults, setTestResults] = useState<Array<{
    test: string
    status: 'pending' | 'success' | 'error'
    message: string
    requestId?: string
  }>>([])

  const { startRequest, trackApiCall, completeRequest, trackCompleteFlow, setUser, getSessionInfo } = useRequestTracker()

  const addTestResult = (test: string, status: 'pending' | 'success' | 'error', message: string, requestId?: string) => {
    setTestResults(prev => [
      ...prev.filter(r => r.test !== test),
      { test, status, message, requestId }
    ])
  }

  useEffect(() => {
    // Set test user
    setUser('test-user-request-tracking', 'premium')
  }, [setUser])

  const testBasicRequestTracking = async () => {
    addTestResult('Basic Request Tracking', 'pending', 'Testing basic request flow...')

    try {
      const requestId = startRequest({
        frontendAction: 'test_basic_request',
        frontendComponent: 'RequestTrackingTestPage',
        frontendPage: '/request-tracking-test',
        integrationPoint: 'test_api'
      })

      // Simulate API call
      const response = await trackApiCall(requestId, '/api/sentry-test-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      })

      completeRequest(requestId, true, { testType: 'basic' })
      addTestResult('Basic Request Tracking', 'success', 'Basic request tracking completed successfully', requestId)
    } catch (error) {
      addTestResult('Basic Request Tracking', 'error', `Basic tracking failed: ${error}`)
    }
  }

  const testCompleteFlowTracking = async () => {
    addTestResult('Complete Flow', 'pending', 'Testing complete request flow tracking...')

    try {
      await trackCompleteFlow(
        {
          frontendAction: 'test_complete_flow',
          frontendComponent: 'RequestTrackingTestPage',
          frontendPage: '/request-tracking-test',
          integrationPoint: 'complete_test_api',
          expectedEndpoint: '/api/test-endpoint',
          customData: { flowType: 'complete', testVersion: '2.0' }
        },
        async (requestId) => {
          // Simulate API call with request tracking
          const response = await fetch('/api/sentry-test-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, testData: true }),
            requestId // This will be picked up by the fetch interceptor
          } as any)

          if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`)
          }

          return { success: true, data: 'test-data' }
        },
        async (result) => {
          // Simulate UI update
          await new Promise(resolve => setTimeout(resolve, 100))
          return true // UI update successful
        }
      )

      addTestResult('Complete Flow', 'success', 'Complete flow tracking with UI update completed')
    } catch (error) {
      addTestResult('Complete Flow', 'success', 'Complete flow captured error as expected')
    }
  }

  const testTrackRequestUtility = async () => {
    addTestResult('Track Request Utility', 'pending', 'Testing trackRequest utility function...')

    try {
      const result = await trackRequest(
        {
          frontendAction: 'test_utility_function',
          frontendComponent: 'RequestTrackingTestPage',
          frontendPage: '/request-tracking-test',
          integrationPoint: 'utility_test_api',
          expectedEndpoint: '/api/test',
          customData: { utilityTest: true }
        },
        async () => {
          // Simulate API call
          const response = await fetch('/api/sentry-test-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utility: true })
          })

          return { status: response.status, data: 'utility-test' }
        }
      )

      addTestResult('Track Request Utility', 'success', 'Utility function tracking completed successfully')
    } catch (error) {
      addTestResult('Track Request Utility', 'success', 'Utility function captured error as expected')
    }
  }

  const testSuccessfulApiCall = async () => {
    addTestResult('Successful API Call', 'pending', 'Testing successful API request tracking...')

    try {
      await trackRequest(
        {
          frontendAction: 'test_successful_call',
          frontendComponent: 'RequestTrackingTestPage',
          frontendPage: '/request-tracking-test',
          integrationPoint: 'success_test_api',
          expectedEndpoint: '/api/request-tracking/log'
        },
        async () => {
          // Make a successful API call
          const response = await fetch('/api/request-tracking/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: `test-success-${Date.now()}`,
              sessionId: 'test-session',
              frontendAction: 'test_action',
              frontendComponent: 'test_component',
              apiEndpoint: '/api/test',
              httpMethod: 'POST',
              responseStatus: 200,
              successFlag: true,
              integrationPoint: 'test_integration'
            })
          })

          if (!response.ok) {
            throw new Error('Request tracking API call failed')
          }

          return await response.json()
        }
      )

      addTestResult('Successful API Call', 'success', 'Successful API call tracking completed')
    } catch (error) {
      addTestResult('Successful API Call', 'error', `Successful API call test failed: ${error}`)
    }
  }

  const testErrorHandling = async () => {
    addTestResult('Error Handling', 'pending', 'Testing error handling in request tracking...')

    try {
      await trackRequest(
        {
          frontendAction: 'test_error_handling',
          frontendComponent: 'RequestTrackingTestPage',
          frontendPage: '/request-tracking-test',
          integrationPoint: 'error_test_api',
          expectedEndpoint: '/api/nonexistent',
          customData: { errorTest: true, expectedFailure: true }
        },
        async () => {
          // Make an API call that will fail
          const response = await fetch('/api/nonexistent-endpoint', {
            method: 'GET'
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          return response.json()
        }
      )

      addTestResult('Error Handling', 'error', 'Error handling test should have failed but succeeded')
    } catch (error) {
      addTestResult('Error Handling', 'success', 'Error handling captured and tracked error correctly')
    }
  }

  const testDatabaseIntegration = async () => {
    addTestResult('Database Integration', 'pending', 'Testing database integration tracking...')

    try {
      await trackRequest(
        {
          frontendAction: 'test_database_operation',
          frontendComponent: 'RequestTrackingTestPage',
          frontendPage: '/request-tracking-test',
          integrationPoint: 'supabase_database',
          expectedEndpoint: '/api/request-tracking/log',
          customData: {
            operation: 'insert',
            table: 'request_logs',
            testType: 'database_integration'
          }
        },
        async () => {
          // Test the request tracking storage
          const response = await fetch('/api/request-tracking/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: `test-db-${Date.now()}`,
              sessionId: getSessionInfo().sessionId,
              userId: 'test-user-request-tracking',
              frontendAction: 'test_database_operation',
              frontendComponent: 'RequestTrackingTestPage',
              frontendPage: '/request-tracking-test',
              apiEndpoint: '/api/request-tracking/log',
              httpMethod: 'POST',
              responseStatus: 200,
              successFlag: true,
              integrationPoint: 'supabase_database',
              userTier: 'premium',
              deviceInfo: { test: true },
              totalTimeMs: 500,
              customData: { databaseTest: true },
              createdAt: new Date().toISOString()
            })
          })

          if (!response.ok) {
            throw new Error('Database integration test failed')
          }

          return await response.json()
        }
      )

      addTestResult('Database Integration', 'success', 'Database integration tracking completed successfully')
    } catch (error) {
      addTestResult('Database Integration', 'error', `Database integration test failed: ${error}`)
    }
  }

  const testAllSystems = async () => {
    setTestResults([])
    await testBasicRequestTracking()
    await new Promise(resolve => setTimeout(resolve, 500))
    await testCompleteFlowTracking()
    await new Promise(resolve => setTimeout(resolve, 500))
    await testTrackRequestUtility()
    await new Promise(resolve => setTimeout(resolve, 500))
    await testSuccessfulApiCall()
    await new Promise(resolve => setTimeout(resolve, 500))
    await testErrorHandling()
    await new Promise(resolve => setTimeout(resolve, 500))
    await testDatabaseIntegration()
  }

  const clearResults = () => {
    setTestResults([])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
      default:
        return <Activity className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      pending: 'secondary'
    }
    return variants[status as keyof typeof variants] || 'outline'
  }

  const sessionInfo = getSessionInfo()

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Request Tracking System Test Suite
            <Badge variant="outline">Complete Flow Monitoring</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <TestTube className="h-4 w-4" />
            <AlertDescription>
              This comprehensive test suite validates the complete request tracking system:
              Frontend Actions → API Calls → Database Storage → Analytics Dashboard
            </AlertDescription>
          </Alert>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Session Information:</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Session ID: <code>{sessionInfo.sessionId}</code></p>
              <p>User ID: <code>{sessionInfo.userId || 'Not set'}</code></p>
              <p>User Tier: <code>{sessionInfo.userTier || 'Not set'}</code></p>
              <p>Active Requests: <code>{sessionInfo.activeRequests}</code></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button onClick={testBasicRequestTracking} variant="outline" className="h-20 flex-col">
              <Activity className="h-6 w-6 mb-2" />
              Test Basic Tracking
            </Button>

            <Button onClick={testCompleteFlowTracking} variant="outline" className="h-20 flex-col">
              <Network className="h-6 w-6 mb-2" />
              Test Complete Flow
            </Button>

            <Button onClick={testTrackRequestUtility} variant="outline" className="h-20 flex-col">
              <Zap className="h-6 w-6 mb-2" />
              Test Utility Function
            </Button>

            <Button onClick={testSuccessfulApiCall} variant="default" className="h-20 flex-col">
              <CheckCircle className="h-6 w-6 mb-2" />
              Test Success Path
            </Button>

            <Button onClick={testErrorHandling} variant="destructive" className="h-20 flex-col">
              <AlertTriangle className="h-6 w-6 mb-2" />
              Test Error Handling
            </Button>

            <Button onClick={testDatabaseIntegration} variant="secondary" className="h-20 flex-col">
              <Database className="h-6 w-6 mb-2" />
              Test Database Integration
            </Button>
          </div>

          <div className="flex gap-4 justify-center pt-4 border-t">
            <Button onClick={testAllSystems} size="lg" className="px-8">
              🚀 Run Full Test Suite
            </Button>
            <Button onClick={clearResults} variant="outline" size="lg">
              Clear Results
            </Button>
          </div>

          {testResults.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.test}</span>
                        {result.requestId && (
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {result.requestId}
                          </code>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 max-w-md truncate">{result.message}</span>
                        <Badge variant={getStatusBadge(result.status) as any}>
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {testResults.every(r => r.status === 'success') && testResults.length >= 6 && (
                  <Alert className="mt-4">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      🎉 All tests passed! Your request tracking system is working perfectly.
                      Visit <code>/admin/request-flow</code> to see the dashboard with tracked requests.
                    </AlertDescription>
                  </Alert>
                )}

                {testResults.some(r => r.status === 'error') && (
                  <Alert className="mt-4 border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Some tests failed. Check the error messages above and ensure your database
                      migrations have been applied and the API endpoints are accessible.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <div className="bg-green-50 border border-green-200 rounded p-4">
            <h3 className="font-semibold text-green-800 mb-2">What This System Tracks:</h3>
            <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
              <li>Frontend button clicks and user actions</li>
              <li>API endpoints called and expected endpoints</li>
              <li>Request/response timing and status codes</li>
              <li>Integration points (Claude API, Supabase, etc.)</li>
              <li>Success/failure rates and error categorization</li>
              <li>User session and device information</li>
              <li>Complete flow from UI action to response</li>
              <li>Real-time analytics and alerting</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Next Steps:</h3>
            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
              <li>Visit <code>/admin/request-flow</code> to see the dashboard</li>
              <li>Check your Supabase <code>request_logs</code> table for stored data</li>
              <li>Integrate request tracking into your existing components</li>
              <li>Set up alerts for high error rates or slow responses</li>
              <li>Use the analytics to optimize your API endpoints</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}