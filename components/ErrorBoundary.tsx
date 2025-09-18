'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  ExternalLink,
  Copy,
  CheckCircle
} from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'section';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    eventId: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      eventId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      eventId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to monitoring service (would integrate with Sentry, LogRocket, etc.)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      eventId: this.state.eventId
    };

    // Example: Send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData)
      // }).catch(console.error);
    }

    console.error('Error logged:', errorData);
  };

  private handleRetry = () => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      copied: false
    });
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private copyErrorDetails = async () => {
    if (!this.state.error) return;

    const errorText = `
Error ID: ${this.state.eventId}
Timestamp: ${new Date().toISOString()}
Message: ${this.state.error.message}
Stack: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo?.componentStack || 'N/A'}
URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}
User Agent: ${typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  private getErrorSeverity = (): 'low' | 'medium' | 'high' => {
    if (!this.state.error) return 'low';
    
    const errorMessage = this.state.error.message.toLowerCase();
    
    // High severity errors
    if (errorMessage.includes('chunk') || 
        errorMessage.includes('network') ||
        errorMessage.includes('auth') ||
        errorMessage.includes('payment')) {
      return 'high';
    }
    
    // Medium severity errors
    if (errorMessage.includes('render') ||
        errorMessage.includes('hook') ||
        errorMessage.includes('state')) {
      return 'medium';
    }
    
    return 'low';
  };

  private getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  private renderFallbackUI = () => {
    const { level = 'component', showDetails = false } = this.props;
    const severity = this.getErrorSeverity();
    const isPageLevel = level === 'page';

    // For component-level errors, render a minimal fallback
    if (level === 'component' || level === 'section') {
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-1">
                Something went wrong
              </h4>
              <p className="text-sm text-red-700 mb-3">
                This {level} encountered an error and couldn't be displayed.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={this.handleRetry}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                {showDetails && this.state.eventId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {this.state.eventId}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For page-level errors, render a full-page fallback
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-gray-900 mb-2">
              Oops! Something went wrong
            </CardTitle>
            <div className="flex items-center justify-center gap-2">
              <Badge className={`${this.getSeverityColor(severity)} border`}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)} Priority
              </Badge>
              {this.state.eventId && (
                <Badge variant="outline" className="text-xs">
                  Error ID: {this.state.eventId}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                We're sorry for the inconvenience. Our team has been notified and is working to fix this issue.
              </p>
              
              {severity === 'high' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-sm text-red-800 font-medium">
                    This appears to be a critical error. Please try refreshing the page or contact support if the problem persists.
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleGoHome}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleReload}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
            </div>

            {/* Error details for development/debugging */}
            {(showDetails || process.env.NODE_ENV === 'development') && this.state.error && (
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Error Details
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={this.copyErrorDetails}
                    className="flex items-center gap-1"
                  >
                    {this.state.copied ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {this.state.copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                
                <div className="bg-gray-100 p-4 rounded-lg text-sm font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Need help?</strong> Share this error ID with our support team: 
                    <span className="font-mono ml-1">{this.state.eventId}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Contact support */}
            <div className="text-center text-sm text-gray-500">
              <p>
                If this problem continues, please{' '}
                <button 
                  className="text-blue-600 hover:text-blue-800 underline"
                  onClick={() => window.open('mailto:support@infinite-pages.com', '_blank')}
                >
                  contact our support team
                </button>
                {' '}or{' '}
                <button 
                  className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                  onClick={() => window.open('https://status.infinite-pages.com', '_blank')}
                >
                  check our status page
                  <ExternalLink className="w-3 h-3" />
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  public render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise, render our built-in fallback UI
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manually triggering error boundary (for testing)
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}

// Utility component for testing error boundaries
export function ErrorTrigger({ error }: { error?: string }) {
  if (error) {
    throw new Error(error);
  }
  return null;
}