/**
 * React Query hooks for optimized data fetching
 */

import type { UseQueryOptions } from '@tanstack/react-query'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptimizer } from '@/lib/database/query-optimizer'
import type { Story, Profile, CreatorEarning, AIUsageLog } from '@/lib/types/database'

// Query keys for consistent caching
export const QUERY_KEYS = {
  // Story queries
  stories: ['stories'] as const,
  storiesWithAuthors: (filters: any) => ['stories', 'with-authors', filters] as const,
  userStories: (userId: string) => ['stories', 'user', userId] as const,
  userStoriesWithCounts: (userId: string) => ['stories', 'user-counts', userId] as const,
  storyDetails: (storyId: string) => ['stories', storyId] as const,
  storyWithChapters: (storyId: string) => ['stories', storyId, 'chapters'] as const,

  // User/Profile queries
  profiles: ['profiles'] as const,
  userProfile: (userId: string) => ['profiles', userId] as const,
  userStats: (userId: string) => ['profiles', userId, 'stats'] as const,

  // Creator earnings queries
  creatorEarnings: ['creator-earnings'] as const,
  userEarnings: (userId: string, period: string) => ['creator-earnings', userId, period] as const,
  earningsStats: (userId: string, period: string) => ['creator-earnings', userId, period, 'stats'] as const,

  // AI usage queries
  aiUsage: ['ai-usage'] as const,
  userAIUsage: (userId: string, period: string) => ['ai-usage', userId, period] as const,
  aiAnalytics: (userId: string, period: string) => ['ai-usage', userId, period, 'analytics'] as const,

  // Analytics queries
  analytics: ['analytics'] as const,
  userAnalytics: (userId: string, period: string) => ['analytics', userId, period] as const,
  cacheAnalytics: (period: string) => ['analytics', 'cache', period] as const
} as const

// Stories hooks
export function useStoriesWithAuthors(
  filters: { genre?: string; status?: string; limit?: number; offset?: number } = {},
  options?: UseQueryOptions<any[], Error>
) {
  return useQuery({
    queryKey: QUERY_KEYS.storiesWithAuthors(filters),
    queryFn: () => queryOptimizer.getStoriesWithAuthors(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}

export function useUserStoriesWithCounts(
  userId: string,
  options?: UseQueryOptions<any[], Error>
) {
  return useQuery({
    queryKey: QUERY_KEYS.userStoriesWithCounts(userId),
    queryFn: () => queryOptimizer.getUserStoriesWithCounts(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
    ...options
  })
}

export function useStoriesWithChaptersBatch(
  storyIds: string[],
  options?: UseQueryOptions<any[], Error>
) {
  return useQuery({
    queryKey: ['stories', 'batch', 'chapters', storyIds.sort()],
    queryFn: () => queryOptimizer.getStoriesWithChaptersBatch(storyIds),
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 6 * 60 * 1000, // 6 minutes
    enabled: storyIds.length > 0,
    ...options
  })
}

// Creator earnings hooks
export function useCreatorEarningsWithStats(
  userId: string,
  period: string = 'current_month',
  options?: UseQueryOptions<any, Error>
) {
  return useQuery({
    queryKey: QUERY_KEYS.earningsStats(userId, period),
    queryFn: () => queryOptimizer.getCreatorEarningsWithStats(userId, period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!userId,
    ...options
  })
}

// AI usage hooks
export function useAIUsageAnalytics(
  userId: string,
  period: string = 'current_month',
  options?: UseQueryOptions<any, Error>
) {
  return useQuery({
    queryKey: QUERY_KEYS.aiAnalytics(userId, period),
    queryFn: () => queryOptimizer.getAIUsageAnalytics(userId, period),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!userId,
    ...options
  })
}

// API-based queries for server-side data
export function useApiQuery<T>(
  endpoint: string,
  queryKey: readonly unknown[],
  options?: UseQueryOptions<T, Error>
) {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<T> => {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors
      if (error?.status >= 400 && error?.status < 500) {
        return false
      }
      return failureCount < 3
    },
    ...options
  })
}

// Analytics queries
export function useUserAnalytics(
  userId: string,
  period: string = 'current_month',
  options?: UseQueryOptions<any, Error>
) {
  return useApiQuery(
    `/api/analytics?user_id=${userId}&period=${period}`,
    QUERY_KEYS.userAnalytics(userId, period),
    options
  )
}

export function useCacheAnalytics(
  period: string = 'current_month',
  options?: UseQueryOptions<any, Error>
) {
  return useApiQuery(
    `/api/cache/analytics?period=${period}`,
    QUERY_KEYS.cacheAnalytics(period),
    options
  )
}

// Mutations for data updates
export function useCreateStoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (storyData: any) => {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(storyData)
      })

      if (!response.ok) {
        throw new Error('Failed to create story')
      }

      return response.json()
    },
    onSuccess: (newStory, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userStories(newStory.user_id) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userStoriesWithCounts(newStory.user_id) })

      // Optimistically update the cache
      queryClient.setQueryData(QUERY_KEYS.storyDetails(newStory.id), newStory)
    }
  })
}

export function useUpdateStoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ storyId, updates }: { storyId: string; updates: any }) => {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update story')
      }

      return response.json()
    },
    onSuccess: (updatedStory, variables) => {
      // Update the specific story in cache
      queryClient.setQueryData(QUERY_KEYS.storyDetails(variables.storyId), updatedStory)

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stories })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userStories(updatedStory.user_id) })
    }
  })
}

export function useDeleteStoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (storyId: string) => {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete story')
      }

      return response.json()
    },
    onSuccess: (_, storyId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: QUERY_KEYS.storyDetails(storyId) })

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stories })
      queryClient.invalidateQueries({ queryKey: ['stories', 'user'] })
    }
  })
}

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

// Performance monitoring hook
export function useQueryPerformance() {
  return useQuery({
    queryKey: ['query-performance'],
    queryFn: () => queryOptimizer.getPerformanceMetrics(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000 // Refresh every 30 seconds
  })
}