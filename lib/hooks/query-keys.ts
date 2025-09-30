/**
 * Centralized query keys for React Query caching
 */

// Query keys for consistent caching
export const QUERY_KEYS = {
  // Story queries
  stories: ['stories'] as const,
  storiesWithAuthors: (filters: { genre?: string; status?: string; limit?: number; offset?: number }) => ['stories', 'with-authors', filters] as const,
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