'use client'

import { useState, useEffect } from 'react'
import { requestTrackingManager } from '@/lib/request-tracking-init'

interface MonitoringStatus {
  initialized: boolean
  activeRequests: number
  sessionId: string
  userId?: string
  userTier?: string
  alertsEnabled: boolean
}

interface AlertData {
  type: string
  message: string
  timestamp: string
  severity: 'low' | 'medium' | 'high'
  data: any
}

export function useRequestMonitoring() {
  const [status, setStatus] = useState<MonitoringStatus>({
    initialized: false,
    activeRequests: 0,
    sessionId: '',
    alertsEnabled: false
  })

  const [recentAlerts, setRecentAlerts] = useState<AlertData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const updateStatus = () => {
      try {
        const managerStatus = requestTrackingManager.getStatus()
        setStatus({
          initialized: managerStatus.initialized,
          activeRequests: managerStatus.sessionInfo.activeRequests,
          sessionId: managerStatus.sessionInfo.sessionId,
          userId: managerStatus.sessionInfo.userId,
          userTier: managerStatus.sessionInfo.userTier,
          alertsEnabled: managerStatus.config.enableErrorAlerting
        })
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to get monitoring status:', error)
        setIsLoading(false)
      }
    }

    // Initial status
    updateStatus()

    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  // Listen for alerts (in a real app, this might come from a websocket or polling)
  useEffect(() => {
    const handleAlert = (event: CustomEvent<AlertData>) => {
      setRecentAlerts(prev => [event.detail, ...prev].slice(0, 10)) // Keep last 10 alerts
    }

    window.addEventListener('request-tracking-alert' as any, handleAlert)
    return () => window.removeEventListener('request-tracking-alert' as any, handleAlert)
  }, [])

  const forceHealthCheck = async () => {
    try {
      await requestTrackingManager.forceHealthCheck()
    } catch (error) {
      console.error('Failed to perform health check:', error)
    }
  }

  const forceAlertCheck = async () => {
    try {
      await requestTrackingManager.forceAlertCheck()
    } catch (error) {
      console.error('Failed to perform alert check:', error)
    }
  }

  const updateConfig = (config: any) => {
    try {
      requestTrackingManager.updateConfig(config)
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  const clearAlerts = () => {
    setRecentAlerts([])
  }

  return {
    status,
    recentAlerts,
    isLoading,
    forceHealthCheck,
    forceAlertCheck,
    updateConfig,
    clearAlerts,
    // Convenience getters
    isHealthy: status.initialized && recentAlerts.filter(a => a.severity === 'high').length === 0,
    hasHighSeverityAlerts: recentAlerts.some(a => a.severity === 'high'),
    hasMediumSeverityAlerts: recentAlerts.some(a => a.severity === 'medium')
  }
}