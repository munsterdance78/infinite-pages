'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, BookOpen, Users, Clock, Star } from 'lucide-react'
import { choiceBookAnalytics } from '@/lib/choice-books/choice-analytics'
import type { ChoiceMade, Choice, ChoicePoint } from '@/lib/choice-books/choice-types'

interface ChoiceBookReaderProps {
  storyId: string
  onBack?: () => void
  onPurchaseRequired?: () => void
}

interface ChoiceState {
  currentChapter: any
  availableChoices: Choice[]
  choiceHistory: ChoiceMade[]
  sessionId: string
  readingProgress: number
  hasAccess: boolean
  showChoices: boolean
  isGenerating: boolean
}

interface ReaderStats {
  pathCompletion: number
  choicesMade: number
  timeSpent: number
  currentPath: string
  discoveredEndings: number
}

export default function ChoiceBookReader({
  storyId,
  onBack,
  onPurchaseRequired
}: ChoiceBookReaderProps) {
  const [choiceState, setChoiceState] = useState<ChoiceState>({
    currentChapter: null,
    availableChoices: [],
    choiceHistory: [],
    sessionId: `session_${Date.now()}`,
    readingProgress: 0,
    hasAccess: false,
    showChoices: false,
    isGenerating: false
  })

  const [readerStats, setReaderStats] = useState<ReaderStats>({
    pathCompletion: 0,
    choicesMade: 0,
    timeSpent: 0,
    currentPath: 'starting',
    discoveredEndings: 0
  })

  const [story, setStory] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [choiceDecisionStart, setChoiceDecisionStart] = useState<number>(0)

  const supabase = createClient()

  useEffect(() => {
    initializeReader()
  }, [storyId])

  const initializeReader = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get story information
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single()

      if (storyError) throw storyError

      setStory(storyData)

      // Check if this is a choice book
      const isChoiceBook = storyData.characters?.choice_structure || storyData.foundation?.choiceStructure
      if (!isChoiceBook) {
        setError('This story is not a choice book')
        return
      }

      // Check user access
      await checkAccess()

      // Load or create reader session
      await initializeSession()

    } catch (err) {
      console.error('Failed to initialize reader:', err)
      setError('Failed to load story')
    } finally {
      setLoading(false)
    }
  }

  const checkAccess = async () => {
    try {
      const response = await fetch(`/api/stories/${storyId}/choices?chapter=start`)
      const data = await response.json()

      setChoiceState(prev => ({
        ...prev,
        hasAccess: data.access_info?.has_access || false
      }))

      if (!data.access_info?.has_access && onPurchaseRequired) {
        onPurchaseRequired()
        return
      }

      // Load initial chapter and choices
      if (data.choices) {
        setChoiceState(prev => ({
          ...prev,
          availableChoices: data.choices,
          currentChapter: { id: 'start', title: 'Begin Your Journey' },
          showChoices: data.choices.length > 0
        }))
      }
    } catch (err) {
      console.error('Access check failed:', err)
      setError('Failed to check story access')
    }
  }

  const initializeSession = async () => {
    try {
      // Get existing reader progress if any
      const { data: existingPath } = await supabase
        .from('reader_paths')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingPath) {
        setChoiceState(prev => ({
          ...prev,
          choiceHistory: existingPath.choices_made || [],
          readingProgress: existingPath.path_completion || 0
        }))

        setReaderStats(prev => ({
          ...prev,
          pathCompletion: existingPath.path_completion || 0,
          choicesMade: existingPath.choices_made?.length || 0,
          discoveredEndings: existingPath.discovered_endings?.length || 0
        }))
      }
    } catch (err) {
      console.log('No existing progress found, starting fresh')
    }
  }

  const makeChoice = async (choice: Choice) => {
    const decisionTime = Date.now() - choiceDecisionStart

    try {
      setChoiceState(prev => ({ ...prev, isGenerating: true, showChoices: false }))

      // Track choice selection
      await choiceBookAnalytics.trackChoiceSelection({
        userId: 'user', // Would get from auth
        storyId,
        choiceId: choice.id,
        choicePointId: `cp_${choiceState.currentChapter?.id}`,
        chapterId: choiceState.currentChapter?.id,
        choiceText: choice.text,
        timeTaken: decisionTime,
        sessionId: choiceState.sessionId,
        metadata: {
          emotional_tone: choice.emotional_tone,
          difficulty_level: choice.difficulty_level
        }
      })

      // Make choice API call
      const response = await fetch(`/api/stories/${storyId}/choices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choiceId: choice.id,
          currentChapter: choiceState.currentChapter?.id,
          sessionId: choiceState.sessionId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process choice')
      }

      // Update choice history
      const newChoice: ChoiceMade = {
        choice_point_id: `cp_${choiceState.currentChapter?.id}`,
        choice_id: choice.id,
        choice_text: choice.text,
        timestamp: new Date(),
        time_taken_seconds: Math.floor(decisionTime / 1000),
        chapter_context: choiceState.currentChapter?.id
      }

      const updatedHistory = [...choiceState.choiceHistory, newChoice]

      setChoiceState(prev => ({
        ...prev,
        choiceHistory: updatedHistory,
        currentChapter: result.next_chapter,
        availableChoices: result.next_choices || [],
        readingProgress: Math.min((updatedHistory.length / 10) * 100, 100),
        showChoices: (result.next_choices?.length || 0) > 0,
        isGenerating: false
      }))

      setReaderStats(prev => ({
        ...prev,
        choicesMade: updatedHistory.length,
        pathCompletion: Math.min((updatedHistory.length / 10) * 100, 100)
      }))

      // Check if we need to generate the next chapter
      if (result.next_chapter?.needs_generation) {
        await generateNextChapter(result.next_chapter.id, choice.id)
      }

    } catch (err) {
      console.error('Failed to make choice:', err)
      setError('Failed to process your choice. Please try again.')
      setChoiceState(prev => ({ ...prev, isGenerating: false, showChoices: true }))
    }
  }

  const generateNextChapter = async (chapterId: string, previousChoiceId: string) => {
    try {
      const response = await fetch(`/api/stories/${storyId}/generate-choice-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterNumber: choiceState.choiceHistory.length + 1,
          previousChoiceId,
          targetChoiceCount: 3,
          branchingStrategy: 'moderate'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate chapter')
      }

      // Update with generated chapter
      setChoiceState(prev => ({
        ...prev,
        currentChapter: result.chapter,
        availableChoices: result.choices || [],
        showChoices: (result.choices?.length || 0) > 0,
        isGenerating: false
      }))

    } catch (err) {
      console.error('Failed to generate chapter:', err)
      setError('Failed to generate next chapter. Please try again.')
      setChoiceState(prev => ({ ...prev, isGenerating: false }))
    }
  }

  const startChoiceTimer = () => {
    setChoiceDecisionStart(Date.now())
  }

  const restartStory = () => {
    setChoiceState(prev => ({
      ...prev,
      choiceHistory: [],
      sessionId: `session_${Date.now()}`,
      readingProgress: 0,
      currentChapter: { id: 'start', title: 'Begin Your Journey' }
    }))

    setReaderStats({
      pathCompletion: 0,
      choicesMade: 0,
      timeSpent: 0,
      currentPath: 'starting',
      discoveredEndings: 0
    })

    initializeReader()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BookOpen className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your interactive story...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!choiceState.hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="mb-4">You need access to read this choice book.</p>
              <Button onClick={onPurchaseRequired}>
                Unlock Story
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with story info and progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
          <div className="flex gap-2">
            <Badge variant="secondary">
              <BookOpen className="h-3 w-3 mr-1" />
              Choice Book
            </Badge>
            <Badge variant="outline">
              {readerStats.choicesMade} choices made
            </Badge>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">{story?.title}</h1>
        <p className="text-muted-foreground mb-4">{story?.premise}</p>

        {/* Progress indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Progress value={readerStats.pathCompletion} className="flex-1" />
                <span className="text-sm font-medium">{Math.round(readerStats.pathCompletion)}%</span>
              </div>
              <p className="text-sm text-muted-foreground">Story Progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{readerStats.choicesMade}</span>
              </div>
              <p className="text-sm text-muted-foreground">Choices Made</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4" />
                <span className="font-medium">{readerStats.discoveredEndings}</span>
              </div>
              <p className="text-sm text-muted-foreground">Endings Found</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current chapter content */}
      {choiceState.currentChapter && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {choiceState.currentChapter.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              {choiceState.currentChapter.content ? (
                <div dangerouslySetInnerHTML={{ __html: choiceState.currentChapter.content }} />
              ) : (
                <p>Your journey begins here. The story unfolds based on the choices you make...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Choice selection */}
      {choiceState.showChoices && !choiceState.isGenerating && (
        <Card>
          <CardHeader>
            <CardTitle>What do you choose?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {choiceState.availableChoices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  className="w-full text-left justify-start h-auto p-4"
                  onClick={() => {
                    startChoiceTimer()
                    makeChoice(choice)
                  }}
                >
                  <div>
                    <div className="font-medium mb-1">{choice.text}</div>
                    {choice.description && (
                      <div className="text-sm text-muted-foreground">{choice.description}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {choice.emotional_tone}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {choice.difficulty_level}
                      </Badge>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating next chapter */}
      {choiceState.isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BookOpen className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="font-medium">Generating your story...</p>
              <p className="text-sm text-muted-foreground">
                Your choice is shaping what happens next
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Story complete */}
      {!choiceState.showChoices && !choiceState.isGenerating && choiceState.currentChapter && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-bold mb-2">Your journey has ended!</h3>
              <p className="text-muted-foreground mb-4">
                You've reached one of the possible endings for this story.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={restartStory}>
                  Try Different Choices
                </Button>
                <Button onClick={onBack} variant="outline">
                  Return to Library
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Choice history (collapsible) */}
      {choiceState.choiceHistory.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium p-2 hover:bg-muted rounded">
            View Your Choice History ({choiceState.choiceHistory.length} choices)
          </summary>
          <Card className="mt-2">
            <CardContent className="p-4">
              <div className="space-y-2">
                {choiceState.choiceHistory.map((choice, index) => (
                  <div key={index} className="text-sm border-l-2 border-muted pl-3">
                    <span className="font-medium">{index + 1}.</span> {choice.choice_text}
                    <div className="text-xs text-muted-foreground">
                      {new Date(choice.timestamp).toLocaleTimeString()} •
                      {choice.time_taken_seconds}s to decide
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  )
}