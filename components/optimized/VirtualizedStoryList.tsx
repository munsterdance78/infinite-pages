'use client'

import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus } from 'lucide-react'
import StoryCard from '@/components/StoryCard'
import type { UnifiedStory } from '../story-creator/types'

interface VirtualizedStoryListProps {
  stories: UnifiedStory[]
  loading: boolean
  itemHeight?: number
  height?: number
  onStoryEdit: (storyId: string) => void
  onStoryDelete: () => void
  onCreateNew: () => void
}

// Memoized story item component
const StoryListItem = memo(function StoryListItem({
  index,
  style,
  data
}: {
  index: number
  style: React.CSSProperties
  data: {
    stories: UnifiedStory[]
    onStoryEdit: (storyId: string) => void
    onStoryDelete: () => void
  }
}) {
  const story = data.stories[index]

  if (!story) {
    return (
      <div style={style} className="p-2">
        <div className="bg-muted animate-pulse rounded-lg h-48" />
      </div>
    )
  }

  return (
    <div style={style} className="p-2">
      <StoryCard
        story={story}
        onEdit={() => data.onStoryEdit(story.id)}
        onDelete={data.onStoryDelete}
      />
    </div>
  )
})

const VirtualizedStoryList = memo(function VirtualizedStoryList({
  stories,
  loading,
  itemHeight = 200,
  height = 600,
  onStoryEdit,
  onStoryDelete,
  onCreateNew
}: VirtualizedStoryListProps) {
  const listRef = useRef<List>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate number of columns based on container width
  const itemsPerRow = useMemo(() => {
    if (containerWidth < 768) return 1 // Mobile
    if (containerWidth < 1024) return 2 // Tablet
    return 3 // Desktop
  }, [containerWidth])

  // Group stories into rows for virtualization
  const virtualizedData = useMemo(() => {
    const rows = []
    for (let i = 0; i < stories.length; i += itemsPerRow) {
      rows.push(stories.slice(i, i + itemsPerRow))
    }
    return rows
  }, [stories, itemsPerRow])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    rows: virtualizedData,
    itemsPerRow,
    onStoryEdit,
    onStoryDelete
  }), [virtualizedData, itemsPerRow, onStoryEdit, onStoryDelete])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted animate-pulse rounded-lg h-48" />
        ))}
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No stories found</h3>
          <p className="text-muted-foreground mb-4">
            Create your first story to get started!
          </p>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Create New Story
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      <List
        ref={listRef}
        height={height}
        itemCount={virtualizedData.length}
        itemSize={itemHeight}
        itemData={itemData}
        width="100%"
        overscanCount={2}
      >
        {VirtualizedStoryRow}
      </List>
    </div>
  )
})

// Virtualized row component
const VirtualizedStoryRow = memo(function VirtualizedStoryRow({
  index,
  style,
  data
}: {
  index: number
  style: React.CSSProperties
  data: {
    rows: UnifiedStory[][]
    itemsPerRow: number
    onStoryEdit: (storyId: string) => void
    onStoryDelete: () => void
  }
}) {
  const row = data.rows[index]

  if (!row) {
    return (
      <div style={style} className="p-2">
        <div className="bg-muted animate-pulse rounded-lg h-48" />
      </div>
    )
  }

  return (
    <div style={style} className="p-2">
      <div className={`grid gap-4 ${
        data.itemsPerRow === 1 ? 'grid-cols-1' :
        data.itemsPerRow === 2 ? 'grid-cols-2' :
        'grid-cols-3'
      }`}>
        {row.map(story => (
          <StoryCard
            key={story.id}
            story={story}
            onEdit={() => data.onStoryEdit(story.id)}
            onDelete={data.onStoryDelete}
          />
        ))}
        {/* Fill empty slots in the last row */}
        {row.length < data.itemsPerRow && Array.from({
          length: data.itemsPerRow - row.length
        }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
      </div>
    </div>
  )
})

export default VirtualizedStoryList