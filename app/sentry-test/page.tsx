'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import * as Sentry from '@sentry/nextjs'

export default function SentryTestPage() {
  const testClientError = () => {
    // Test client-side error
    Sentry.captureException(new Error('Test client-side error from Sentry test page'))
  }

  const testServerError = async () => {
    // Test server-side error via API
    try {
      await fetch('/api/sentry-test-error')
    } catch (err) {
      console.error('API error:', err)
    }
  }

  const testCustomError = async () => {
    // Test integration with existing error reporting system
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test error from Sentry integration',
          category: 'javascript_error',
          severity: 'high',
          source: 'client',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          component: 'SentryTestPage',
          operation: 'integration_test'
        })
      })
    } catch (err) {
      console.error('Custom error API failed:', err)
    }
  }

  const testPerformance = () => {
    // Test performance monitoring
    const transaction = Sentry.startTransaction({ name: 'test-performance' })
    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction))

    setTimeout(() => {
      transaction.finish()
    }, 1000)
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Sentry Error Monitoring Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Test Sentry integration and error capture. Check your Sentry dashboard after triggering errors.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={testClientError} variant="destructive">
              Test Client Error
            </Button>

            <Button onClick={testServerError} variant="destructive">
              Test Server Error
            </Button>

            <Button onClick={testCustomError} variant="outline">
              Test Custom Error Integration
            </Button>

            <Button onClick={testPerformance} variant="secondary">
              Test Performance Tracking
            </Button>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold text-yellow-800">Setup Instructions:</h3>
            <ol className="list-decimal list-inside text-sm text-yellow-700 mt-2 space-y-1">
              <li>Create a Sentry account at <a href="https://sentry.io" className="underline">sentry.io</a></li>
              <li>Create a new project for "infinite-pages-v2"</li>
              <li>Copy your DSN from the project settings</li>
              <li>Add DSN to your .env file as NEXT_PUBLIC_SENTRY_DSN</li>
              <li>Restart your dev server</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}