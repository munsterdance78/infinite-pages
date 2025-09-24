'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Clock,
  User,
  MapPin,
  Zap,
  BookOpen,
  TrendingUp,
  Filter,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'

interface TimelineEvent {
  id: string
  title: string
  description: string
  timestamp: string
  chapter: string
  eventType: 'character' | 'plot' | 'world' | 'conflict'
  importance: 'low' | 'medium' | 'high' | 'critical'
  relatedEvents?: string[]
  characters?: string[]
  location?: string
}

interface TimelineData {
  timeline: TimelineEvent[]
  chapters: Array<{ id: string; title: string; chapter_number: number }>
  metadata: {
    totalEvents: number
    eventTypes: Record<string, number>
    plotThreads: Record<string, string[]>
    characterArcs: Record<string, string[]>
  }
}

interface TimelineVisualizationProps {
  storyId: string
}

export function TimelineVisualization({ storyId }: TimelineVisualizationProps) {
  const supabase = createClient()
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'timeline' | 'chapters' | 'arcs'>('timeline')
  const [isAnimating, setIsAnimating] = useState(false)
  const [currentEventIndex, setCurrentEventIndex] = useState(0)

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await fetchTimelineData()
      }
    }
    loadUser()
  }, [storyId])

  const fetchTimelineData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/stories/${storyId}/timeline`)
      if (!response.ok) {
        throw new Error('Failed to fetch timeline data')
      }

      const data = await response.json()
      setTimelineData(data)
    } catch (error) {
      console.error('Error fetching timeline:', error)
      setError('Failed to load timeline data')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEvents = useMemo(() => {
    if (!timelineData?.timeline) return []

    let events = timelineData.timeline

    // Filter by event type
    if (selectedEventType !== 'all') {
      events = events.filter(event => event.eventType === selectedEventType)
    }

    // Filter by character
    if (selectedCharacter !== 'all') {
      events = events.filter(event =>
        event.characters?.includes(selectedCharacter)
      )
    }

    return events
  }, [timelineData, selectedEventType, selectedCharacter])

  const uniqueCharacters = useMemo(() => {
    if (!timelineData?.timeline) return []

    const characters = new Set<string>()
    timelineData.timeline.forEach(event => {
      event.characters?.forEach(char => characters.add(char))
    })
    return Array.from(characters).sort()
  }, [timelineData])

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'character': return <User className="w-4 h-4" />
      case 'plot': return <BookOpen className="w-4 h-4" />
      case 'world': return <MapPin className="w-4 h-4" />
      case 'conflict': return <Zap className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'character': return 'bg-blue-100 border-blue-500 text-blue-700'
      case 'plot': return 'bg-purple-100 border-purple-500 text-purple-700'
      case 'world': return 'bg-green-100 border-green-500 text-green-700'
      case 'conflict': return 'bg-red-100 border-red-500 text-red-700'
      default: return 'bg-gray-100 border-gray-500 text-gray-700'
    }
  }

  const getImportanceBadge = (importance: string) => {
    const variants = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    }
    return variants[importance as keyof typeof variants] || variants.medium
  }

  const startAnimation = () => {
    setIsAnimating(true)
    setCurrentEventIndex(0)

    const interval = setInterval(() => {
      setCurrentEventIndex(prev => {
        if (prev >= filteredEvents.length - 1) {
          setIsAnimating(false)
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 2000) // 2 seconds per event
  }

  const stopAnimation = () => {
    setIsAnimating(false)
  }

  const resetAnimation = () => {
    setIsAnimating(false)
    setCurrentEventIndex(0)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading timeline...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchTimelineData} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!timelineData || timelineData.timeline.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No timeline events found</p>
            <p className="text-sm text-gray-500 mt-2">
              Timeline events will appear as you add chapters to your story
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Story Timeline</h2>
          <p className="text-gray-600">
            {timelineData.metadata.totalEvents} events across {timelineData.chapters.length} chapters
          </p>
        </div>

        {/* Animation Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={startAnimation}
            disabled={isAnimating}
            variant="outline"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            Play Timeline
          </Button>
          <Button
            onClick={stopAnimation}
            disabled={!isAnimating}
            variant="outline"
            size="sm"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </Button>
          <Button
            onClick={resetAnimation}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Timeline Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 responsive-grid">
            <div>
              <label className="text-sm font-medium mb-2 block">View Mode</label>
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timeline">Timeline View</SelectItem>
                  <SelectItem value="chapters">Chapter View</SelectItem>
                  <SelectItem value="arcs">Character Arcs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Event Type</label>
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="character">Character</SelectItem>
                  <SelectItem value="plot">Plot</SelectItem>
                  <SelectItem value="world">World</SelectItem>
                  <SelectItem value="conflict">Conflict</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Character</label>
              <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Characters</SelectItem>
                  {uniqueCharacters.map(character => (
                    <SelectItem key={character} value={character}>
                      {character}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Event Type Distribution */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            {Object.entries(timelineData.metadata.eventTypes).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getEventColor(type)}`}>
                  {getEventIcon(type)}
                  <span className="text-sm font-medium capitalize">{type}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline Content */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="arcs">Character Arcs</TabsTrigger>
        </TabsList>

        {/* Timeline View */}
        <TabsContent value="timeline" className="space-y-4">
          {isAnimating && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Timeline Animation Progress</span>
                  <span className="text-sm text-gray-600">
                    {currentEventIndex + 1} of {filteredEvents.length}
                  </span>
                </div>
                <Progress
                  value={((currentEventIndex + 1) / filteredEvents.length) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          )}

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className={`relative flex items-start gap-4 pb-8 transition-all duration-500 ${
                  isAnimating && index > currentEventIndex ? 'opacity-30' : 'opacity-100'
                } ${
                  isAnimating && index === currentEventIndex ? 'scale-105 bg-blue-50 p-4 rounded-lg -ml-4' : ''
                }`}
              >
                {/* Timeline Dot */}
                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${getEventColor(event.eventType)} bg-white`}>
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event Content */}
                <Card className="flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{event.title}</h3>
                          <Badge className={getImportanceBadge(event.importance)}>
                            {event.importance}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{event.description}</p>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {event.chapter}
                          </Badge>
                          {event.characters && event.characters.map(character => (
                            <Badge key={character} variant="outline">
                              <User className="w-3 h-3 mr-1" />
                              {character}
                            </Badge>
                          ))}
                          {event.location && (
                            <Badge variant="outline">
                              <MapPin className="w-3 h-3 mr-1" />
                              {event.location}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Chapter View */}
        <TabsContent value="chapters" className="space-y-4">
          {timelineData.chapters.map(chapter => {
            const chapterEvents = filteredEvents.filter(event => event.chapter === chapter.chapter_number.toString())

            return (
              <Card key={chapter.id}>
                <CardHeader>
                  <CardTitle>Chapter {chapter.chapter_number}: {chapter.title}</CardTitle>
                  <CardDescription>
                    {chapterEvents.length} timeline events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {chapterEvents.map(event => (
                      <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`p-2 rounded ${getEventColor(event.eventType)}`}>
                          {getEventIcon(event.eventType)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>
                        <Badge className={getImportanceBadge(event.importance)}>
                          {event.importance}
                        </Badge>
                      </div>
                    ))}
                    {chapterEvents.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No events match current filters</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Character Arcs View */}
        <TabsContent value="arcs" className="space-y-4">
          {Object.entries(timelineData.metadata.characterArcs).map(([character, eventIds]) => {
            const characterEvents = filteredEvents.filter(event => eventIds.includes(event.id))

            return (
              <Card key={character}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {character}'s Arc
                  </CardTitle>
                  <CardDescription>
                    {characterEvents.length} key moments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {characterEvents.map((event, index) => (
                      <div key={event.id} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{event.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              Chapter {event.chapter}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>
                        {index < characterEvents.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}