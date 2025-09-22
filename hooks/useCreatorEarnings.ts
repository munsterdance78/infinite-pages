'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CreatorEarningsData,
  CreatorEarningsState,
  LoadingState,
  ErrorState,
  EarningsApiParams } from '@/types/creator-earnings'
import {
  DISPLAY_MODES
} from '@/types/creator-earnings'

interface UseCreatorEarningsOptions {
  period?: string
  mode?: 'basic' | 'enhanced' | 'dashboard'
  autoRefresh?: boolean
  refreshInterval?: number
  cacheTimeout?: number
}

interface CacheEntry {
  data: CreatorEarningsData
  timestamp: number
  expiry: number
}

// In-memory cache for earnings data
const earningsCache = new Map<string, CacheEntry>()

// Debounce utility
function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => func(...args), delay)
  }, [func, delay]) as T
}

export function useCreatorEarnings(options: UseCreatorEarningsOptions = {}) {
  const {
    period = 'current_month',
    mode = 'enhanced',
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    cacheTimeout = 60000 // 1 minute
  } = options

  const [state, setState] = useState<CreatorEarningsState>({
    data: null,
    loading: {
      summary: true,
      storyPerformance: true,
      transactions: true,
      trends: true,
      payoutHistory: false,
      requestingPayout: false
    },
    error: {},
    selectedPeriod: period,
    displayMode: mode,
    showPayoutBreakdown: false,
    showPayoutHistory: false,
    refreshInterval: null
  })

  const abortControllerRef = useRef<AbortController>()
  const refreshTimeoutRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

  // Generate cache key
  const getCacheKey = useCallback((params: EarningsApiParams) => {
    return `earnings_${params.period}_${params.includeHistory}_${params.includeTrends}_${params.includeTransactions}`
  }, [])

  // Check cache
  const getCachedData = useCallback((cacheKey: string): CreatorEarningsData | null => {
    const entry = earningsCache.get(cacheKey)
    if (entry && Date.now() < entry.expiry) {
      return {
        ...entry.data,
        meta: {
          ...entry.data.meta,
          cacheStatus: Date.now() - entry.timestamp < cacheTimeout / 2 ? 'fresh' : 'stale'
        }
      }
    }
    return null
  }, [cacheTimeout])

  // Cache data
  const setCachedData = useCallback((cacheKey: string, data: CreatorEarningsData) => {
    earningsCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + cacheTimeout
    })
  }, [cacheTimeout])

  // Fetch earnings data
  const fetchEarningsData = useCallback(async (
    params: EarningsApiParams,
    signal?: AbortSignal
  ): Promise<CreatorEarningsData> => {
    const cacheKey = getCacheKey(params)
    const cachedData = getCachedData(cacheKey)

    if (cachedData && cachedData.meta.cacheStatus === 'fresh') {
      return cachedData
    }

    const displayMode = DISPLAY_MODES[mode]
    const searchParams = new URLSearchParams({
      period: params.period || 'current_month',
      include_history: String(params.includeHistory || displayMode.showPayoutHistory),
      include_transactions: String(params.includeTransactions || displayMode.showRecentTransactions),
      include_trends: String(params.includeTrends || displayMode.showMonthlyTrends),
      limit: String(params.limit || displayMode.maxTransactionItems)
    })

    // Use unified endpoint with view parameter
    const viewSearchParams = new URLSearchParams({
      view: mode,
      period: params.period || 'current_month',
      include_transactions: String(params.includeTransactions || displayMode.showRecentTransactions),
      include_trends: String(params.includeTrends || displayMode.showMonthlyTrends),
      include_history: String(params.includeHistory || displayMode.showPayoutHistory),
      limit: String(params.limit || displayMode.maxTransactionItems)
    })

    const response = await fetch(`/api/creators/earnings?${viewSearchParams}`, {
      signal: signal || null,
      headers: { 'Cache-Control': 'no-cache' }
    })

    if (!response.ok) {
      if (response.status === 403) {
        const error = await response.json()
        throw new Error(error.upgrade_required ? 'UPGRADE_REQUIRED' : 'ACCESS_DENIED')
      }
      throw new Error('Failed to fetch earnings data')
    }

    const data = await response.json()

    // Data is already in unified format from the new endpoint
    const transformedData: CreatorEarningsData = {
      profile: data.profile || {
        id: 'current_user',
        isCreator: true,
        creatorTier: null,
        subscriptionTier: 'free',
        totalEarningsAllTime: 0,
        pendingPayoutUsd: 0,
        joinedDate: new Date().toISOString()
      },
      summary: data.summary || {
        totalCreditsEarned: 0,
        totalUsdEarnings: 0,
        uniqueReaders: 0,
        storiesWithEarnings: 0,
        averageEarningsPerStory: 0,
        pendingPayout: 0,
        lifetimeEarnings: 0,
        creatorSharePercentage: 70,
        periodDescription: params.period || 'current month'
      },
      storyPerformance: data.storyPerformance || [],
      recentTransactions: data.recentTransactions || [],
      monthlyTrend: data.trendsData || [],
      payoutInfo: data.payoutInfo || {
        canRequestPayout: false,
        minimumPayout: 25,
        nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        eligibilityMessage: 'Not eligible for payout',
        processingFee: 2.5
      },
      payoutHistory: data.payoutHistory,
      meta: data.meta || {
        creditsToUsdRate: 0.035,
        lastUpdated: new Date().toISOString(),
        nextRefresh: new Date(Date.now() + refreshInterval).toISOString(),
        cacheStatus: 'fresh'
      }
    }

    setCachedData(cacheKey, transformedData)
    return transformedData
  }, [mode, getCacheKey, getCachedData, setCachedData, refreshInterval])

  // Update loading state
  const updateLoading = useCallback((updates: Partial<LoadingState>) => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, ...updates }
    }))
  }, [])

  // Update error state
  const updateError = useCallback((updates: Partial<ErrorState>) => {
    setState(prev => ({
      ...prev,
      error: { ...prev.error, ...updates }
    }))
  }, [])

  // Load earnings data
  const loadEarnings = useCallback(async (params: EarningsApiParams = {}) => {
    // Cancel previous request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    updateLoading({ summary: true, storyPerformance: true, transactions: true, trends: true })
    updateError({})

    try {
      const data = await fetchEarningsData(
        { period: state.selectedPeriod, ...params },
        abortControllerRef.current.signal
      )

      setState(prev => ({
        ...prev,
        data,
        loading: {
          summary: false,
          storyPerformance: false,
          transactions: false,
          trends: false,
          payoutHistory: false,
          requestingPayout: false
        },
        error: {}
      }))
    } catch (error: any) {
      if (error.name === 'AbortError') return // Request was cancelled

      const errorMessage = error.message
      if (errorMessage === 'UPGRADE_REQUIRED') {
        updateError({ general: 'Premium subscription required for creator features' })
      } else if (errorMessage === 'ACCESS_DENIED') {
        updateError({ general: 'Creator access required' })
      } else {
        updateError({ general: 'Failed to load earnings data' })
      }

      updateLoading({
        summary: false,
        storyPerformance: false,
        transactions: false,
        trends: false,
        payoutHistory: false
      })
    }
  }, [state.selectedPeriod, fetchEarningsData, updateLoading, updateError])

  // Debounced load function
  const debouncedLoad = useDebounce(loadEarnings, 300)

  // Load payout history
  const loadPayoutHistory = useCallback(async () => {
    if (!state.data?.profile.isCreator) return

    updateLoading({ payoutHistory: true })
    updateError({ payoutHistory: null as any })

    try {
      const response = await fetch('/api/creators/payout-history')
      if (!response.ok) throw new Error('Failed to load payout history')

      const historyData = await response.json()

      setState(prev => ({
        ...prev,
        data: prev.data ? {
          ...prev.data,
          payoutHistory: historyData
        } : prev.data,
        loading: { ...prev.loading, payoutHistory: false }
      }))
    } catch (error) {
      updateError({ payoutHistory: 'Failed to load payout history' })
      updateLoading({ payoutHistory: false })
    }
  }, [state.data?.profile.isCreator, updateLoading, updateError])

  // Request payout
  const requestPayout = useCallback(async () => {
    if (!state.data?.payoutInfo.canRequestPayout) return

    updateLoading({ requestingPayout: true })
    updateError({ payout: null as any })

    try {
      const response = await fetch('/api/creators/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Payout request failed')
      }

      const result = await response.json()

      // Refresh earnings data after successful payout
      await loadEarnings()

      return result
    } catch (error: any) {
      updateError({ payout: error.message })
      throw error
    } finally {
      updateLoading({ requestingPayout: false })
    }
  }, [state.data?.payoutInfo.canRequestPayout, loadEarnings, updateLoading, updateError])

  // Change period
  const changePeriod = useCallback((newPeriod: string) => {
    setState(prev => ({ ...prev, selectedPeriod: newPeriod }))
    debouncedLoad({ period: newPeriod })
  }, [debouncedLoad])

  // Change display mode
  const changeDisplayMode = useCallback((newMode: 'basic' | 'enhanced' | 'dashboard') => {
    setState(prev => ({ ...prev, displayMode: newMode }))
    loadEarnings()
  }, [loadEarnings])

  // Toggle payout breakdown
  const togglePayoutBreakdown = useCallback(() => {
    setState(prev => ({ ...prev, showPayoutBreakdown: !prev.showPayoutBreakdown }))
  }, [])

  // Toggle payout history
  const togglePayoutHistory = useCallback(() => {
    setState(prev => {
      const newShowHistory = !prev.showPayoutHistory
      if (newShowHistory && !prev.data?.payoutHistory) {
        loadPayoutHistory()
      }
      return { ...prev, showPayoutHistory: newShowHistory }
    })
  }, [loadPayoutHistory])

  // Refresh data
  const refresh = useCallback(() => {
    loadEarnings({ period: state.selectedPeriod })
  }, [loadEarnings, state.selectedPeriod])

  // Setup auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refresh, refreshInterval)
    setState(prev => ({ ...prev, refreshInterval: interval }))

    return () => {
      clearInterval(interval)
      setState(prev => ({ ...prev, refreshInterval: null }))
    }
  }, [autoRefresh, refreshInterval, refresh])

  // Initial load
  useEffect(() => {
    loadEarnings()

    return () => {
      abortControllerRef.current?.abort()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, []) // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (state.refreshInterval) {
        clearInterval(state.refreshInterval)
      }
    }
  }, [state.refreshInterval])

  return {
    // Data
    data: state.data,
    loading: state.loading,
    error: state.error,

    // State
    selectedPeriod: state.selectedPeriod,
    displayMode: state.displayMode,
    showPayoutBreakdown: state.showPayoutBreakdown,
    showPayoutHistory: state.showPayoutHistory,

    // Actions
    changePeriod,
    changeDisplayMode,
    togglePayoutBreakdown,
    togglePayoutHistory,
    requestPayout,
    refresh,

    // Utilities
    isLoading: Object.values(state.loading).some(Boolean),
    hasError: Object.values(state.error).some(Boolean),
    canRefresh: !state.loading.summary && !state.loading.requestingPayout
  }
}