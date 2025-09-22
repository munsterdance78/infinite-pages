'use client'

import React, { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, BookOpen, TreePine, Wand2 } from 'lucide-react'
import type { CreationMode } from './types'

interface StoryModeSelectorProps {
  mode: CreationMode
  onModeChange: (mode: CreationMode) => void
}

const StoryModeSelector = memo(function StoryModeSelector({
  mode,
  onModeChange
}: StoryModeSelectorProps) {
  const getModeIcon = (mode: CreationMode) => {
    switch (mode) {
      case 'story': return <FileText className="w-4 h-4" />
      case 'novel': return <BookOpen className="w-4 h-4" />
      case 'choice-book': return <TreePine className="w-4 h-4" />
      case 'ai-builder': return <Wand2 className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getModeDescription = (mode: CreationMode) => {
    switch (mode) {
      case 'story': return 'Create traditional narrative stories with chapters'
      case 'novel': return 'Write full-length novels with detailed planning'
      case 'choice-book': return 'Build interactive stories with reader choices'
      case 'ai-builder': return 'AI-assisted story generation with prompts'
      default: return ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creation Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as CreationMode)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="story" className="gap-2">
              {getModeIcon('story')}
              Story
            </TabsTrigger>
            <TabsTrigger value="novel" className="gap-2">
              {getModeIcon('novel')}
              Novel
            </TabsTrigger>
            <TabsTrigger value="choice-book" className="gap-2">
              {getModeIcon('choice-book')}
              Choice Book
            </TabsTrigger>
            <TabsTrigger value="ai-builder" className="gap-2">
              {getModeIcon('ai-builder')}
              AI Builder
            </TabsTrigger>
          </TabsList>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{getModeDescription(mode)}</p>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
})

export default StoryModeSelector