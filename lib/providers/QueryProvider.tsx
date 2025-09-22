'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time: how long data stays in cache when unused
      cacheTime: 10 * 60 * 1000, // 10 minutes

      // Retry failed requests
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      },

      // Retry delay (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus for critical data
      refetchOnWindowFocus: (query) => {
        // Only refetch critical queries
        const criticalQueries = ['creator-earnings', 'ai-usage', 'analytics']
        return criticalQueries.some(key =>
          query.queryKey.some(k => typeof k === 'string' && k.includes(key))
        )
      },

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Background refetch interval for analytics data
      refetchInterval: (data, query) => {
        // Refresh analytics data every 5 minutes
        if (query.queryKey.some(k => typeof k === 'string' && k.includes('analytics'))) {
          return 5 * 60 * 1000
        }
        return false
      }
    },
    mutations: {
      // Retry mutations on network error
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 2
      },

      // Mutation retry delay
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000)
    }
  }
})

// Query client event listeners for monitoring
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'observerAdded') {
    console.log('[Query Cache] Observer added:', event.query.queryKey)
  }

  if (event.type === 'observerRemoved' && event.query.getObserversCount() === 0) {
    console.log('[Query Cache] Query removed from cache:', event.query.queryKey)
  }
})

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'mutationAdded') {
    console.log('[Mutation Cache] Mutation started:', event.mutation.options.mutationKey)
  }

  if (event.type === 'mutationUpdated') {
    const mutation = event.mutation
    if (mutation.state.status === 'success') {
      console.log('[Mutation Cache] Mutation succeeded:', mutation.options.mutationKey)
    } else if (mutation.state.status === 'error') {
      console.error('[Mutation Cache] Mutation failed:', mutation.options.mutationKey, mutation.state.error)
    }
  }
})

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = React.useState(() => queryClient)

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
        toggleButtonProps={{
          style: {
            marginLeft: '5px',
            transform: 'scale(0.7)',
            transformOrigin: 'bottom right'
          }
        }}
      />
    </QueryClientProvider>
  )
}

// Export query client for use in API routes and utilities
export { queryClient }

// Performance monitoring utilities
export function getQueryCacheStats() {
  const cache = queryClient.getQueryCache()
  const queries = cache.getAll()

  const stats = {
    totalQueries: queries.length,
    activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
    staleQueries: queries.filter(q => q.isStale()).length,
    errorQueries: queries.filter(q => q.state.status === 'error').length,
    loadingQueries: queries.filter(q => q.state.status === 'loading').length,
    cacheSize: JSON.stringify(queries.map(q => q.state.data)).length,
    oldestQuery: Math.min(...queries.map(q => q.state.dataUpdatedAt)),
    newestQuery: Math.max(...queries.map(q => q.state.dataUpdatedAt))
  }

  return stats
}

export function getMutationCacheStats() {
  const cache = queryClient.getMutationCache()
  const mutations = cache.getAll()

  const stats = {
    totalMutations: mutations.length,
    pendingMutations: mutations.filter(m => m.state.status === 'loading').length,
    errorMutations: mutations.filter(m => m.state.status === 'error').length,
    successMutations: mutations.filter(m => m.state.status === 'success').length
  }

  return stats
}

// Cache management utilities
export function clearQueryCache(pattern?: string) {
  if (pattern) {
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey.some(key =>
          typeof key === 'string' && key.includes(pattern)
        )
    })
  } else {
    queryClient.clear()
  }
}

export function prefetchCriticalData(userId: string) {
  // Prefetch user stories
  queryClient.prefetchQuery({
    queryKey: ['stories', 'user-counts', userId],
    queryFn: async () => {
      const response = await fetch(`/api/stories?user_id=${userId}`)
      return response.json()
    },
    staleTime: 2 * 60 * 1000
  })

  // Prefetch creator earnings if applicable
  queryClient.prefetchQuery({
    queryKey: ['creator-earnings', userId, 'current_month', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/creator/earnings?period=current_month')
      return response.json()
    },
    staleTime: 5 * 60 * 1000
  })

  // Prefetch AI usage analytics
  queryClient.prefetchQuery({
    queryKey: ['ai-usage', userId, 'current_month', 'analytics'],
    queryFn: async () => {
      const response = await fetch('/api/ai-usage/track?period=current_month')
      return response.json()
    },
    staleTime: 10 * 60 * 1000
  })
}

// Error boundary for query errors
export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {children}
    </div>
  )
}

// Performance monitoring component
export function QueryPerformanceMonitor() {
  const [stats, setStats] = React.useState<any>(null)

  React.useEffect(() => {
    const interval = setInterval(() => {
      const queryStats = getQueryCacheStats()
      const mutationStats = getMutationCacheStats()
      setStats({ query: queryStats, mutation: mutationStats })
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  if (!stats || process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 bg-black text-white text-xs p-2 font-mono opacity-75 z-50">
      <div>Queries: {stats.query.activeQueries}/{stats.query.totalQueries}</div>
      <div>Cache: {Math.round(stats.query.cacheSize / 1024)}KB</div>
      <div>Mutations: {stats.mutation.pendingMutations} pending</div>
    </div>
  )
}