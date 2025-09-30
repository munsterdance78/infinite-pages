/**
 * React Query mutation hooks for data modifications
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from './query-keys'

export function useCreateStoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (storyData: {
      title: string
      genre: string
      premise: string
      user_id: string
    }) => {
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
    mutationFn: async ({ storyId, updates }: {
      storyId: string
      updates: {
        title?: string
        genre?: string
        premise?: string
        status?: string
        [key: string]: unknown
      }
    }) => {
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