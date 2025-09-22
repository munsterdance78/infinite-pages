'use client'

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Plus, RefreshCw, Search } from 'lucide-react'
import StoryCard from '@/components/StoryCard'
import ErrorBoundary from '@/components/ErrorBoundary'
import VirtualizedStoryList from '@/components/optimized/VirtualizedStoryList'
import { useDebounce } from '@/lib/hooks/useDebounce'
import type { UnifiedStory, CreationMode } from './types'
import { ALLOWED_GENRES } from '@/lib/constants'

interface StoryListProps {
  stories: UnifiedStory[]
  loading: boolean
  searchTerm: string
  onSearchChange: (term: string) => void
  filterGenre: string
  onFilterGenreChange: (genre: string) => void
  sortBy: string
  onSortByChange: (sort: string) => void
  mode: CreationMode
  onCreateNew: () => void
  onStoryEdit: (storyId: string) => void
  onStoryDelete: () => void
}

const StoryList = memo(function StoryList({
  stories,
  loading,
  searchTerm,
  onSearchChange,
  filterGenre,
  onFilterGenreChange,
  sortBy,
  onSortByChange,
  mode,
  onCreateNew,
  onStoryEdit,
  onStoryDelete
}: StoryListProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
  const [useVirtualization, setUseVirtualization] = useState(false)

  // Debounce search input for better performance
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300)

  // Update parent search term when debounced value changes
  useEffect(() => {
    onSearchChange(debouncedSearchTerm)
  }, [debouncedSearchTerm, onSearchChange])

  // Auto-enable virtualization for large lists
  useEffect(() => {
    setUseVirtualization(stories.length > 50)
  }, [stories.length])

  const filteredStories = useMemo(() => {
    const filtered = stories.filter(story => {
      const matchesSearch = story.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           story.premise?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      const matchesGenre = filterGenre === 'all' || story.genre === filterGenre
      const matchesMode = story.type === mode || mode === 'story' // Show all for story mode

      return matchesSearch && matchesGenre && matchesMode
    })

    // Sort filtered results
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'views':
          return (b.views || 0) - (a.views || 0)
        case 'updated_at':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })
  }, [stories, debouncedSearchTerm, filterGenre, mode, sortBy])

  const handleStoryEdit = useCallback((story: UnifiedStory) => {
    onStoryEdit(story.id)
  }, [onStoryEdit])

  const handleLocalSearchChange = useCallback((value: string) => {
    setLocalSearchTerm(value)
  }, [])

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p>Loading stories...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <FilterControls
        searchTerm={localSearchTerm}
        onSearchChange={handleLocalSearchChange}
        filterGenre={filterGenre}
        onFilterGenreChange={onFilterGenreChange}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        storiesCount={filteredStories.length}
        useVirtualization={useVirtualization}
      />

      {/* Stories Grid */}
      {filteredStories.length === 0 ? (
        <EmptyState
          hasStories={stories.length > 0}
          mode={mode}
          onCreateNew={onCreateNew}
        />
      ) : useVirtualization ? (
        <VirtualizedStoryList
          stories={filteredStories}
          onStorySelect={(story) => onStoryEdit(story.id)}
          onCreateNew={onCreateNew}
          searchTerm={searchTerm}
          selectedGenre={filterGenre}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map(story => (
            <ErrorBoundary key={story.id}>
              <StoryCard
                story={story as any}
                onEdit={() => handleStoryEdit(story)}
                onDelete={onStoryDelete}
              />
            </ErrorBoundary>
          ))}
        </div>
      )}
    </div>
  )
})

// Filter controls component
const FilterControls = memo(function FilterControls({
  searchTerm,
  onSearchChange,
  filterGenre,
  onFilterGenreChange,
  sortBy,
  onSortByChange,
  storiesCount,
  useVirtualization
}: {
  searchTerm: string
  onSearchChange: (term: string) => void
  filterGenre: string
  onFilterGenreChange: (genre: string) => void
  sortBy: string
  onSortByChange: (sort: string) => void
  storiesCount: number
  useVirtualization: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stories..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterGenre} onValueChange={onFilterGenreChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {ALLOWED_GENRES.map(genre => (
              <SelectItem key={genre} value={genre}>{genre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Recently Updated</SelectItem>
            <SelectItem value="created_at">Recently Created</SelectItem>
            <SelectItem value="title">Title A-Z</SelectItem>
            <SelectItem value="views">Most Viewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Performance indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={useVirtualization ? 'default' : 'outline'}>
          {storiesCount} stories
        </Badge>
        {useVirtualization && (
          <Badge variant="secondary">
            Virtual scrolling enabled
          </Badge>
        )}
      </div>
    </div>
  )
})

// Empty state component
const EmptyState = memo(function EmptyState({
  hasStories,
  mode,
  onCreateNew
}: {
  hasStories: boolean
  mode: CreationMode
  onCreateNew: () => void
}) {
  return (
    <Card>
      <CardContent className="text-center py-8">
        <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No stories found</h3>
        <p className="text-muted-foreground mb-4">
          {hasStories
            ? 'Try adjusting your search or filters.'
            : `Create your first ${mode} to get started!`
          }
        </p>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Create New {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </Button>
      </CardContent>
    </Card>
  )
})

export default StoryList