'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Clock,
  Calendar,
  Plus,
  Eye,
  Download,
  RefreshCw,
  Filter,
  ArrowRight
} from 'lucide-react'

interface TimelineEvent {
  id: string
  title: string
  eventType: string
  timestamp: string
  description: string
  chapter?: string
}

interface TimelineButtonsProps {
  storyId?: string
  onTimelineUpdated?: (events: TimelineEvent[]) => void
}

export default function TimelineButtons({
  storyId,
  onTimelineUpdated
}: TimelineButtonsProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  const loadTimeline = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/stories/${storyId || 'demo'}/timeline`)
      if (!response.ok) throw new Error(`Failed to load timeline: ${response.status}`)

      const result = await response.json()
      const timelineEvents = result.events || []

      setEvents(timelineEvents)
      onTimelineUpdated?.(timelineEvents)
      console.log('✅ Timeline loaded:', timelineEvents)
    } catch (error) {
      console.error('❌ Timeline load error:', error)
      alert('Failed to load timeline. Check console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const addEvent = () => {
    const newEvent: TimelineEvent = {
      id: Date.now().toString(),
      title: `Event ${events.length + 1}`,
      eventType: 'plot',
      timestamp: new Date().toISOString(),
      description: 'New timeline event'
    }
    setEvents(prev => [...prev, newEvent])
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadTimeline} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isLoading ? 'Loading...' : 'Load Timeline'}
          </Button>
          <Button onClick={addEvent} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="plot">Plot</SelectItem>
              <SelectItem value="character">Character</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {events.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Timeline Events ({events.length})</h3>
            {events.map((event) => (
              <Card key={event.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{event.title}</h4>
                    <p className="text-sm text-gray-600">{event.description}</p>
                  </div>
                  <Badge>{event.eventType}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} | V2.0 Timeline System | Events: {events.length}
        </div>
      </CardContent>
    </Card>
  )
}