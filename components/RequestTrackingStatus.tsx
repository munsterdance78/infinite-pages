'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRequestMonitoring } from '@/hooks/useRequestMonitoring'
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  X,
  Clock
} from 'lucide-react'

export default function RequestTrackingStatus() {
  const {
    status,
    recentAlerts,
    isLoading,
    forceHealthCheck,
    forceAlertCheck,
    clearAlerts,
    isHealthy,
    hasHighSeverityAlerts,
    hasMediumSeverityAlerts
  } = useRequestMonitoring()

  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="fixed bottom-4 right-4 w-80">
        <Card className="shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-600">Loading monitoring status...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getStatusColor = () => {
    if (!status.initialized) return 'text-red-500'
    if (hasHighSeverityAlerts) return 'text-red-500'
    if (hasMediumSeverityAlerts) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getStatusIcon = () => {
    if (!status.initialized) return <X className="h-4 w-4" />
    if (hasHighSeverityAlerts) return <AlertTriangle className="h-4 w-4" />
    if (hasMediumSeverityAlerts) return <AlertTriangle className="h-4 w-4" />
    return <CheckCircle className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (!status.initialized) return 'Not Initialized'
    if (hasHighSeverityAlerts) return 'Critical Issues'
    if (hasMediumSeverityAlerts) return 'Warnings'
    return 'Healthy'
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <Card className="shadow-lg border-2" style={{ borderColor: getStatusColor().replace('text-', '') }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={getStatusColor()}>{getStatusIcon()}</div>
              <span>Request Tracking</span>
              <Badge variant={isHealthy ? 'default' : 'destructive'} className="text-xs">
                {getStatusText()}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <X className="h-3 w-3" /> : <Settings className="h-3 w-3" />}
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Always visible summary */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Active:</span>
              <span className="ml-1 font-medium">{status.activeRequests}</span>
            </div>
            <div>
              <span className="text-gray-500">Alerts:</span>
              <span className="ml-1 font-medium">{recentAlerts.length}</span>
            </div>
          </div>

          {/* Expanded view */}
          {isExpanded && (
            <div className="mt-4 space-y-3">
              {/* Status Details */}
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Session:</span>
                  <code className="text-xs bg-gray-100 px-1 rounded">{status.sessionId.slice(-8)}</code>
                </div>
                {status.userId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">User:</span>
                    <span>{status.userId.slice(0, 8)}... ({status.userTier})</span>
                  </div>
                )}
              </div>

              {/* Recent Alerts */}
              {recentAlerts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium">Recent Alerts</h4>
                    <Button variant="ghost" size="sm" onClick={clearAlerts} className="h-5 text-xs">
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {recentAlerts.slice(0, 5).map((alert, index) => (
                      <Alert key={index} className="py-2">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          <div className="flex items-center justify-between">
                            <span>{alert.type.replace(/_/g, ' ')}</span>
                            <Badge
                              variant={alert.severity === 'high' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                          {alert.message && (
                            <div className="text-gray-600 mt-1">{alert.message}</div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={forceHealthCheck}
                  className="flex-1 text-xs"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  Health Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={forceAlertCheck}
                  className="flex-1 text-xs"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Alert Check
                </Button>
              </div>

              {/* Quick Links */}
              <div className="text-xs">
                <a
                  href="/admin/request-flow"
                  className="text-blue-600 hover:underline block"
                  target="_blank"
                >
                  📊 View Dashboard
                </a>
                <a
                  href="/request-tracking-test"
                  className="text-blue-600 hover:underline block mt-1"
                  target="_blank"
                >
                  🧪 Run Tests
                </a>
              </div>

              {/* System Info */}
              <div className="text-xs text-gray-500 pt-2 border-t">
                <div>Monitoring: {status.alertsEnabled ? 'Enabled' : 'Disabled'}</div>
                <div>Updated: {new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}