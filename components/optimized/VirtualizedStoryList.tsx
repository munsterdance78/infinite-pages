'use client'

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus } from 'lucide-react'
import StoryCard from '@/components/StoryCard'
import type { UnifiedStory } from '../story-creator/types'

interface VirtualizedStoryListProps {
  stories: UnifiedStory[]
  onStorySelect: (story: UnifiedStory) => void
  onCreateNew: () => void
  searchTerm?: string
  selectedGenre?: string
  height?: number
  itemHeight?: number
  showCreateButton?: boolean
}

// Fallback component without virtualization (react-window not available)
const VirtualizedStoryList = memo(function VirtualizedStoryList({
  stories,
  onStorySelect,
  onCreateNew,
  searchTerm = '',
  selectedGenre = 'all',
  height = 600,
  showCreateButton = true
}: VirtualizedStoryListProps) {

  // Filter stories based on search and genre
  const filteredStories = stories.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         story.genre?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGenre = selectedGenre === 'all' || story.genre === selectedGenre
    return matchesSearch && matchesGenre
  })

  return (
    <div className="w-full" style={{ height }}>
      <div className="h-full overflow-y-auto">
        {showCreateButton && (
          <Card className="mb-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <Button onClick={onCreateNew} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Story
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredStories.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No stories found</h3>
                <p>Try adjusting your search or create a new story</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredStories.map((story) => (
              <div key={story.id} onClick={() => onStorySelect(story)} className="cursor-pointer">
                <StoryCard
                  story={story as any}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default VirtualizedStoryList