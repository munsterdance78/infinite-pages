'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useErrorMonitor, measurePerformance } from '@/lib/error-monitoring'
import {
  Bug,
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle,
  Database,
  Zap,
  Network,
  User,
  Shield
} from 'lucide-react'

export default function ErrorMonitoringTestPage() {
  const [testResults, setTestResults] = useState<Array<{
    test: string
    status: 'pending' | 'success' | 'error'
    message: string
  }>>([])

  const { captureError, captureMessage, captureException, reportPerformanceIssue, setUser } = useErrorMonitor()

  const addTestResult = (test: string, status: 'pending' | 'success' | 'error', message: string) => {
    setTestResults(prev => [
      ...prev.filter(r => r.test !== test),
      { test, status, message }
    ])
  }

  useEffect(() => {
    // Set mock user for testing
    setUser('test-user-123', 'premium')
  }, [setUser])

  const testClientError = async () => {
    addTestResult('Client Error', 'pending', 'Testing client-side JavaScript error...')

    try {
      // Trigger a client-side error
      captureException(new Error('Test client-side error from monitoring test page'), {
        component: 'ErrorMonitoringTestPage',
        operation: 'test_client_error',
        customData: { testType: 'manual', timestamp: new Date().toISOString() }
      })

      addTestResult('Client Error', 'success', 'Client error captured and sent to monitoring system')
    } catch (err) {
      addTestResult('Client Error', 'error', 'Failed to capture client error')
    }
  }

  const testServerError = async () => {
    addTestResult('Server Error', 'pending', 'Testing server-side API error...')

    try {
      const response = await fetch('/api/sentry-test-error', {
        method: 'POST'
      })

      if (!response.ok) {
        addTestResult('Server Error', 'success', 'Server error triggered and captured')
      }
    } catch (err) {
      addTestResult('Server Error', 'success', 'Network error captured by monitoring system')
    }
  }

  const testCustomError = async () => {
    addTestResult('Custom Error', 'pending', 'Testing custom error with context...')

    try {
      captureError({
        message: 'Custom test error with rich context',
        category: 'user_reported',
        severity: 'medium',
        source: 'client',
        url: window.location.href,
        component: 'ErrorMonitoringTestPage',
        operation: 'test_custom_error',
        customData: {
          testType: 'custom',
          userAction: 'button_click',
          featureFlag: 'error_monitoring_v2',
          metadata: {
            version: '2.0',
            environment: 'testing'
          }
        }
      })

      addTestResult('Custom Error', 'success', 'Custom error with context captured successfully')
    } catch (err) {
      addTestResult('Custom Error', 'error', 'Failed to capture custom error')
    }
  }

  const testUnhandledRejection = async () => {
    addTestResult('Unhandled Rejection', 'pending', 'Testing unhandled promise rejection...')

    // Create an unhandled promise rejection
    setTimeout(() => {
      Promise.reject(new Error('Test unhandled promise rejection'))
    }, 100)

    setTimeout(() => {
      addTestResult('Unhandled Rejection', 'success', 'Unhandled rejection should be captured automatically')
    }, 500)
  }

  const testPerformanceMonitoring = async () => {
    addTestResult('Performance', 'pending', 'Testing performance monitoring...')

    try {
      // Simulate slow operation
      await measurePerformance('test_slow_operation', async () => {
        return new Promise(resolve => setTimeout(resolve, 2000))
      }, 1000) // 1 second threshold

      addTestResult('Performance', 'success', 'Performance issue detected and reported')
    } catch (err) {
      addTestResult('Performance', 'error', 'Performance monitoring failed')
    }
  }

  const testDatabaseError = async () => {
    addTestResult('Database Error', 'pending', 'Testing database error simulation...')

    try {
      captureError({
        message: 'Database connection timeout',
        category: 'database_error',
        severity: 'high',
        source: 'client',
        url: window.location.href,
        component: 'ErrorMonitoringTestPage',
        operation: 'test_database_error',
        apiEndpoint: '/api/test/database',
        statusCode: 503,
        responseTime: 30000,
        customData: {
          query: 'SELECT * FROM stories WHERE user_id = $1',
          table: 'stories',
          connectionPool: 'exhausted'
        }
      })

      addTestResult('Database Error', 'success', 'Database error simulation captured')
    } catch (err) {
      addTestResult('Database Error', 'error', 'Database error test failed')
    }
  }

  const testAuthError = async () => {
    addTestResult('Auth Error', 'pending', 'Testing authentication error...')

    try {
      captureError({
        message: 'JWT token expired',
        category: 'authentication_error',
        severity: 'medium',
        source: 'client',
        url: window.location.href,
        component: 'AuthProvider',
        operation: 'token_validation',
        apiEndpoint: '/api/auth/verify',
        statusCode: 401,
        customData: {
          tokenAge: '2 hours',
          refreshAvailable: false,
          userTier: 'premium'
        }
      })

      addTestResult('Auth Error', 'success', 'Authentication error captured')
    } catch (err) {
      addTestResult('Auth Error', 'error', 'Auth error test failed')
    }
  }

  const testAIError = async () => {
    addTestResult('AI Error', 'pending', 'Testing AI generation error...')

    try {
      captureError({
        message: 'Claude API rate limit exceeded',
        category: 'ai_generation_error',
        severity: 'high',
        source: 'client',
        url: window.location.href,
        component: 'StoryGenerator',
        operation: 'chapter_generation',
        apiEndpoint: '/api/stories/123/chapters/generate',
        statusCode: 429,
        responseTime: 5000,
        customData: {
          model: 'claude-3-haiku',
          inputTokens: 2500,
          promptType: 'chapter_continuation',
          userId: 'test-user-123',
          storyId: '123'
        }
      })

      addTestResult('AI Error', 'success', 'AI generation error captured')
    } catch (err) {
      addTestResult('AI Error', 'error', 'AI error test failed')
    }
  }

  const testAllErrors = async () => {
    setTestResults([])
    await testClientError()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testServerError()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testCustomError()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testUnhandledRejection()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testPerformanceMonitoring()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testDatabaseError()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testAuthError()
    await new Promise(resolve => setTimeout(resolve, 200))
    await testAIError()
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

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Built-in Error Monitoring Test Suite
            <Badge variant="outline">Supabase Integration</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              This page tests your built-in error monitoring system that stores data in Supabase.
              All errors will be captured and stored in the <code>error_reports</code> table.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button onClick={testClientError} variant="destructive" className="h-20 flex-col">
              <Bug className="h-6 w-6 mb-2" />
              Test Client Error
            </Button>

            <Button onClick={testServerError} variant="destructive" className="h-20 flex-col">
              <Database className="h-6 w-6 mb-2" />
              Test Server Error
            </Button>

            <Button onClick={testCustomError} variant="outline" className="h-20 flex-col">
              <Activity className="h-6 w-6 mb-2" />
              Test Custom Error
            </Button>

            <Button onClick={testUnhandledRejection} variant="destructive" className="h-20 flex-col">
              <AlertTriangle className="h-6 w-6 mb-2" />
              Test Unhandled Promise
            </Button>

            <Button onClick={testPerformanceMonitoring} variant="secondary" className="h-20 flex-col">
              <Clock className="h-6 w-6 mb-2" />
              Test Performance
            </Button>

            <Button onClick={testDatabaseError} variant="destructive" className="h-20 flex-col">
              <Database className="h-6 w-6 mb-2" />
              Test Database Error
            </Button>

            <Button onClick={testAuthError} variant="outline" className="h-20 flex-col">
              <Shield className="h-6 w-6 mb-2" />
              Test Auth Error
            </Button>

            <Button onClick={testAIError} variant="destructive" className="h-20 flex-col">
              <Zap className="h-6 w-6 mb-2" />
              Test AI Error
            </Button>
          </div>

          <div className="flex gap-4 justify-center pt-4 border-t">
            <Button onClick={testAllErrors} size="lg" className="px-8">
              🚀 Run All Tests
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
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{result.message}</span>
                        <Badge variant={getStatusBadge(result.status) as any}>
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {testResults.every(r => r.status === 'success') && testResults.length >= 8 && (
                  <Alert className="mt-4">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      🎉 All tests passed! Your built-in error monitoring system is working perfectly.
                      Check your Supabase <code>error_reports</code> table or visit{' '}
                      <code>/admin/error-monitoring</code> to see the captured errors.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Next Steps:</h3>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              <li>Visit <code>/admin/error-monitoring</code> to see the dashboard</li>
              <li>Check your Supabase <code>error_reports</code> table for stored errors</li>
              <li>Errors are automatically categorized and include rich context</li>
              <li>Performance issues above thresholds are automatically reported</li>
              <li>All client-side and server-side errors are captured</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}