'use client'

import React, { useState } from 'react'
import { useClaudeStreaming } from '@/lib/claude/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Square, RefreshCw } from 'lucide-react'

interface StreamingStoryCreatorProps {
  userProfile: {
    tokens_remaining: number
    subscription_tier: string
  }
  onStoryCreated?: (story: any) => void
}

export default function StreamingStoryCreator({ 
  userProfile, 
  onStoryCreated 
}: StreamingStoryCreatorProps) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [premise, setPremise] = useState('')
  const [generatedStory, setGeneratedStory] = useState<any>(null)

  const {
    isStreaming,
    content,
    error,
    usage,
    cost,
    streamStoryFoundation,
    stopStream,
    reset
  } = useClaudeStreaming({
    onComplete: (response) => {
      try {
        const storyData = JSON.parse(response.content)
        setGeneratedStory(storyData)
        onStoryCreated?.(storyData)
      } catch (e) {
        console.error('Failed to parse story data:', e)
      }
    },
    onError: (error) => {
      console.error('Streaming error:', error)
    }
  })

  const handleGenerate = async () => {
    if (!genre.trim() || !premise.trim()) {
      alert('Please fill in genre and premise')
      return
    }

    reset()
    setGeneratedStory(null)
    
    await streamStoryFoundation({
      title: title.trim() || '',
      genre: genre.trim(),
      premise: premise.trim()
    })
  }

  const handleStop = () => {
    stopStream()
  }

  const handleReset = () => {
    reset()
    setGeneratedStory(null)
    setTitle('')
    setGenre('')
    setPremise('')
  }

  const genres = [
    'Fantasy', 'Science Fiction', 'Mystery', 'Romance', 'Thriller', 
    'Horror', 'Literary Fiction', 'Historical Fiction', 'Young Adult',
    'Adventure', 'Contemporary', 'Dystopian', 'Comedy', 'Drama'
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Streaming Story Creator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Status */}
          <div className="flex gap-4 items-center">
            <Badge variant="outline">
              Tokens: {userProfile.tokens_remaining}
            </Badge>
            <Badge variant="secondary">
              {userProfile.subscription_tier} Plan
            </Badge>
            {cost && (
              <Badge variant="outline">
                Cost: ${cost.toFixed(4)}
              </Badge>
            )}
          </div>

          {/* Input Form */}
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Title (Optional)</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter story title..."
                disabled={isStreaming}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Genre *</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={isStreaming}
              >
                <option value="">Select a genre...</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Premise *</label>
              <Textarea
                value={premise}
                onChange={(e) => setPremise(e.target.value)}
                placeholder="Describe your story premise..."
                rows={4}
                disabled={isStreaming}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isStreaming || !genre || !premise}
              className="flex items-center gap-2"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isStreaming ? 'Generating...' : 'Generate Story'}
            </Button>

            {isStreaming && (
              <Button
                onClick={handleStop}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isStreaming}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Progress Indicator */}
          {isStreaming && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Generating story foundation...</span>
                <span>{content.length} characters</span>
              </div>
              <Progress value={content.length > 0 ? Math.min((content.length / 5000) * 100, 95) : 0} />
            </div>
          )}

          {/* Live Content Preview */}
          {content && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Story Display */}
          {generatedStory && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Story Foundation</CardTitle>
                {usage && (
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>Input: {usage.inputTokens} tokens</span>
                    <span>Output: {usage.outputTokens} tokens</span>
                    <span>Total: {usage.totalTokens} tokens</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{generatedStory.title}</h3>
                  <p className="text-gray-600">{generatedStory.genre}</p>
                </div>

                <div>
                  <h4 className="font-medium">Premise</h4>
                  <p className="text-sm">{generatedStory.premise}</p>
                </div>

                {generatedStory.mainCharacters && (
                  <div>
                    <h4 className="font-medium">Main Characters</h4>
                    <div className="grid gap-2 mt-2">
                      {generatedStory.mainCharacters.map((character: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <div className="font-medium">{character.name}</div>
                          <div className="text-sm text-gray-600">{character.role}</div>
                          <div className="text-sm mt-1">{character.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generatedStory.chapterOutline && (
                  <div>
                    <h4 className="font-medium">Chapter Outline</h4>
                    <div className="grid gap-2 mt-2">
                      {generatedStory.chapterOutline.slice(0, 3).map((chapter: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <div className="font-medium">Chapter {chapter.number}: {chapter.title}</div>
                          <div className="text-sm mt-1">{chapter.summary}</div>
                        </div>
                      ))}
                      {generatedStory.chapterOutline.length > 3 && (
                        <div className="text-sm text-gray-500">
                          ... and {generatedStory.chapterOutline.length - 3} more chapters
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}




