import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

interface SFSLTimelineData {
  events: TimelineEvent[]
  chronology: string[]
  plotThreads: Record<string, string[]>
  characterArcs: Record<string, string[]>
}

interface TimelineApiResult {
  timeline: TimelineEvent[]
  chapters: Array<{ id: string; title: string; chapter_number: number }>
  metadata: {
    totalEvents: number
    eventTypes: Record<string, number>
    plotThreads: Record<string, string[]>
    characterArcs: Record<string, string[]>
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify story ownership
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (storyError || !story || story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Story not found or access denied' },
        { status: 404 }
      )
    }

    // Get story facts for timeline extraction
    const { data: storyFacts, error: factsError } = await supabase
      .from('story_facts')
      .select('sfsl_data, fact_type, chapter_number, created_at')
      .eq('story_id', params.id)
      .in('fact_type', ['chapter', 'plot', 'character', 'world'])
      .order('chapter_number', { ascending: true })

    if (factsError) {
      throw new Error(`Failed to fetch story facts: ${factsError.message}`)
    }

    // Extract timeline events from SFSL data
    const timelineEvents = extractTimelineFromSFSL(storyFacts || [])

    // Get additional metadata
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, title, chapter_number, created_at')
      .eq('story_id', params.id)
      .order('chapter_number', { ascending: true })

    if (chaptersError) {
      console.warn('Failed to fetch chapters:', chaptersError.message)
    }

    return NextResponse.json({
      timeline: timelineEvents,
      chapters: chapters || [],
      metadata: {
        totalEvents: timelineEvents.length,
        eventTypes: getEventTypeDistribution(timelineEvents),
        plotThreads: extractPlotThreads(timelineEvents),
        characterArcs: extractCharacterArcs(timelineEvents)
      }
    })

  } catch (error) {
    console.error('Timeline API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate timeline' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { event } = body

    if (!event || !event.title || !event.timestamp) {
      return NextResponse.json(
        { error: 'Invalid event data' },
        { status: 400 }
      )
    }

    // Verify story ownership
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (storyError || !story || story.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Story not found or access denied' },
        { status: 404 }
      )
    }

    // Store custom timeline event
    const { data: timelineEvent, error: insertError } = await supabase
      .from('timeline_events')
      .insert({
        story_id: params.id,
        title: event.title,
        description: event.description || '',
        timestamp: event.timestamp,
        chapter_number: event.chapter,
        event_type: event.eventType || 'plot',
        importance: event.importance || 'medium',
        related_events: event.relatedEvents || [],
        characters: event.characters || [],
        location: event.location || '',
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create timeline event: ${insertError.message}`)
    }

    return NextResponse.json({
      event: timelineEvent,
      message: 'Timeline event created successfully'
    })

  } catch (error) {
    console.error('Timeline creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create timeline event' },
      { status: 500 }
    )
  }
}

function extractTimelineFromSFSL(storyFacts: any[]): TimelineEvent[] {
  const events: TimelineEvent[] = []

  storyFacts.forEach((fact, index) => {
    try {
      const sfslData = typeof fact.sfsl_data === 'string'
        ? JSON.parse(fact.sfsl_data)
        : fact.sfsl_data

      if (!sfslData) return

      // Extract different types of timeline events based on fact type
      switch (fact.fact_type) {
        case 'chapter':
          events.push(...extractChapterEvents(sfslData, fact.chapter_number))
          break
        case 'character':
          events.push(...extractCharacterEvents(sfslData, fact.chapter_number))
          break
        case 'plot':
          events.push(...extractPlotEvents(sfslData, fact.chapter_number))
          break
        case 'world':
          events.push(...extractWorldEvents(sfslData, fact.chapter_number))
          break
      }
    } catch (error) {
      console.warn(`Failed to parse SFSL data for fact ${index}:`, error)
    }
  })

  // Sort events chronologically
  return events.sort((a, b) => {
    const aChapter = parseInt(a.chapter) || 0
    const bChapter = parseInt(b.chapter) || 0
    return aChapter - bChapter
  })
}

function extractChapterEvents(sfslData: any, chapterNumber: number): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Main chapter event
  if (sfslData.title || sfslData.summary) {
    events.push({
      id: `chapter-${chapterNumber}`,
      title: sfslData.title || `Chapter ${chapterNumber}`,
      description: sfslData.summary || sfslData.description || '',
      timestamp: `Chapter ${chapterNumber}`,
      chapter: chapterNumber.toString(),
      eventType: 'plot',
      importance: 'high'
    })
  }

  // Key events within chapter
  if (sfslData.keyEvents) {
    sfslData.keyEvents.forEach((event: any, index: number) => {
      events.push({
        id: `chapter-${chapterNumber}-event-${index}`,
        title: event.title || event.description || 'Chapter Event',
        description: event.description || event.summary || '',
        timestamp: `Chapter ${chapterNumber}`,
        chapter: chapterNumber.toString(),
        eventType: event.type || 'plot',
        importance: event.importance || 'medium',
        characters: event.characters || [],
        location: event.location || ''
      })
    })
  }

  return events
}

function extractCharacterEvents(sfslData: any, chapterNumber: number): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (sfslData.character && sfslData.development) {
    events.push({
      id: `character-${chapterNumber}-${sfslData.character}`,
      title: `${sfslData.character} Development`,
      description: sfslData.development || sfslData.change || '',
      timestamp: `Chapter ${chapterNumber}`,
      chapter: chapterNumber.toString(),
      eventType: 'character',
      importance: 'medium',
      characters: [sfslData.character]
    })
  }

  return events
}

function extractPlotEvents(sfslData: any, chapterNumber: number): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (sfslData.plotPoint) {
    events.push({
      id: `plot-${chapterNumber}`,
      title: sfslData.plotPoint.title || 'Plot Development',
      description: sfslData.plotPoint.description || sfslData.description || '',
      timestamp: `Chapter ${chapterNumber}`,
      chapter: chapterNumber.toString(),
      eventType: 'plot',
      importance: sfslData.plotPoint.importance || 'high',
      relatedEvents: sfslData.relatedEvents || []
    })
  }

  return events
}

function extractWorldEvents(sfslData: any, chapterNumber: number): TimelineEvent[] {
  const events: TimelineEvent[] = []

  if (sfslData.worldChange || sfslData.newLocation) {
    events.push({
      id: `world-${chapterNumber}`,
      title: sfslData.worldChange?.title || `New Location: ${sfslData.newLocation}`,
      description: sfslData.worldChange?.description || sfslData.description || '',
      timestamp: `Chapter ${chapterNumber}`,
      chapter: chapterNumber.toString(),
      eventType: 'world',
      importance: 'medium',
      location: sfslData.newLocation || sfslData.location || ''
    })
  }

  return events
}

function getEventTypeDistribution(events: TimelineEvent[]) {
  const distribution = { character: 0, plot: 0, world: 0, conflict: 0 }
  events.forEach(event => {
    distribution[event.eventType]++
  })
  return distribution
}

function extractPlotThreads(events: TimelineEvent[]): Record<string, string[]> {
  const threads: Record<string, string[]> = {}

  events.forEach(event => {
    if (event.eventType === 'plot') {
      const threadName = `Plot Thread ${event.chapter}`
      if (!threads[threadName]) {
        threads[threadName] = []
      }
      threads[threadName].push(event.id)
    }
  })

  return threads
}

function extractCharacterArcs(events: TimelineEvent[]): Record<string, string[]> {
  const arcs: Record<string, string[]> = {}

  events.forEach(event => {
    if (event.characters) {
      event.characters.forEach(character => {
        if (!arcs[character]) {
          arcs[character] = []
        }
        arcs[character].push(event.id)
      })
    }
  })

  return arcs
}