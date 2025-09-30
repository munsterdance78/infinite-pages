/**
 * Query utility functions for cache management and prefetching
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryOptimizer } from '@/lib/database/query-optimizer'
import { QUERY_KEYS } from './query-keys'

// Cache invalidation utilities
export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateStories: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stories })
    },
    invalidateUserStories: (userId: string) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userStories(userId) })
    },
    invalidateEarnings: (userId: string) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.creatorEarnings })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userEarnings(userId, 'current_month') })
    },
    invalidateAnalytics: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.analytics })
    },
    invalidateAll: () => {
      queryClient.invalidateQueries()
    }
  }
}

// Prefetch utilities for performance optimization
export function usePrefetchQueries() {
  const queryClient = useQueryClient()

  return {
    prefetchUserStories: (userId: string) => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.userStoriesWithCounts(userId),
        queryFn: () => queryOptimizer.getUserStoriesWithCounts(userId),
        staleTime: 2 * 60 * 1000
      })
    },
    prefetchCreatorEarnings: (userId: string, period: string = 'current_month') => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.earningsStats(userId, period),
        queryFn: () => queryOptimizer.getCreatorEarningsWithStats(userId, period),
        staleTime: 5 * 60 * 1000
      })
    },
    prefetchAIAnalytics: (userId: string, period: string = 'current_month') => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.aiAnalytics(userId, period),
        queryFn: () => queryOptimizer.getAIUsageAnalytics(userId, period),
        staleTime: 10 * 60 * 1000
      })
    }
  }
}