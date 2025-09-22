'use client'

import type { ReactNode, ErrorInfo } from 'react'
import React, { Component } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

class CreatorEarningsErrorBoundary extends Component<Props, State> {
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      retryCount: 0
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call optional error handler
    this.props.onError?.(error, errorInfo)

    // Log error for monitoring
    console.error('CreatorEarnings Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <Card className="w-full border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Creator Earnings Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-800">
                {this.state.error?.message || 'An unexpected error occurred while loading earnings data.'}
              </AlertDescription>
            </Alert>

            {this.props.showDetails && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-red-700 hover:text-red-800">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-3 rounded border overflow-auto text-red-800">
                  {this.state.error.stack}
                  {this.state.errorInfo && '\n\nComponent Stack:'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              {this.state.retryCount < this.maxRetries && (
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry ({this.maxRetries - this.state.retryCount} left)
                </Button>
              )}

              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Reset
              </Button>

              <Button
                onClick={() => window.location.href = '/dashboard'}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <div className="text-xs text-red-600 mt-4">
              <p>If this problem persists, please contact support.</p>
              {this.state.retryCount >= this.maxRetries && (
                <p className="mt-1 font-medium">
                  Maximum retry attempts reached. Please refresh the page or contact support.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default CreatorEarningsErrorBoundary