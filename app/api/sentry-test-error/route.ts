import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET() {
  try {
    // Simulate a server-side error
    throw new Error('Test server-side error for Sentry monitoring')
  } catch (error) {
    // Capture the error in Sentry
    Sentry.captureException(error)

    return NextResponse.json(
      { error: 'Test server error triggered successfully' },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    // Simulate a more complex error with context
    Sentry.withScope((scope) => {
      scope.setTag('test_type', 'api_endpoint')
      scope.setContext('request_info', {
        endpoint: '/api/sentry-test-error',
        method: 'POST',
        timestamp: new Date().toISOString()
      })

      throw new Error('Complex test error with context for Sentry')
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Test POST error triggered successfully' },
      { status: 500 }
    )
  }

  // This will never be reached, but TypeScript needs it
  return NextResponse.json({ success: true })
}