'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Wand2,
  Sparkles,
  Clock,
  Save,
  Download,
  RefreshCw,
  Brain,
  Zap,
  BookOpen,
  Settings,
  FileText,
  Edit3
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'basic' | 'premium'
  credits_balance: number
  is_creator?: boolean
}

interface AIStoryBuilderProps {
  userProfile: UserProfile
}

interface StoryRequest {
  title: string
  genre: string
  prompt: string
  tone: string
  length: string
  characters: string
  setting: string
}

interface GeneratedStory {
  id: string
  title: string
  content: string
  status: 'generating' | 'completed' | 'error'
  created_at: string
  word_count: number
  cost_credits: number
}

export default function AIStoryBuilder({ userProfile }: AIStoryBuilderProps) {
  const [storyRequest, setStoryRequest] = useState<StoryRequest>({
    title: '',
    genre: 'fantasy',
    prompt: '',
    tone: 'adventurous',
    length: 'short',
    characters: '',
    setting: ''
  })

  const [generatedStories, setGeneratedStories] = useState<GeneratedStory[]>([])
  const [currentStory, setCurrentStory] = useState<GeneratedStory | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [estimatedCost, setEstimatedCost] = useState(0)

  const supabase = createClient()

  const genres = [
    'fantasy', 'sci-fi', 'romance', 'mystery', 'thriller',
    'horror', 'adventure', 'comedy', 'drama', 'historical'
  ]

  const tones = [
    'adventurous', 'mysterious', 'romantic', 'humorous', 'dramatic',
    'dark', 'light-hearted', 'epic', 'intimate', 'suspenseful'
  ]

  const lengths = [
    { value: 'short', label: 'Short (500-1000 words)', credits: 5 },
    { value: 'medium', label: 'Medium (1000-2500 words)', credits: 10 },
    { value: 'long', label: 'Long (2500-5000 words)', credits: 20 }
  ]

  useEffect(() => {
    loadUserStories()
    calculateEstimatedCost()
  }, [storyRequest.length])

  const loadUserStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('creator_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error loading stories:', error)
        return
      }

      const formattedStories = data.map(story => ({
        id: story.id,
        title: story.title,
        content: story.content || '',
        status: 'completed' as const,
        created_at: story.created_at,
        word_count: story.word_count || 0,
        cost_credits: story.generation_cost || 0
      }))

      setGeneratedStories(formattedStories)
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateEstimatedCost = () => {
    const length = lengths.find(l => l.value === storyRequest.length)
    setEstimatedCost(length?.credits || 5)
  }

  const handleGenerateStory = async () => {
    if (!storyRequest.prompt.trim()) {
      alert('Please provide a story prompt')
      return
    }

    if (userProfile.credits_balance < estimatedCost) {
      alert('Insufficient credits. Please purchase more credits to generate this story.')
      return
    }

    setGenerating(true)

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: storyRequest.title || 'Untitled Story',
          genre: storyRequest.genre,
          prompt: storyRequest.prompt,
          tone: storyRequest.tone,
          length: storyRequest.length,
          characters: storyRequest.characters,
          setting: storyRequest.setting,
          user_id: userProfile.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate story')
      }

      const result = await response.json()

      const newStory: GeneratedStory = {
        id: result.id,
        title: result.title,
        content: result.content || '',
        status: 'completed',
        created_at: new Date().toISOString(),
        word_count: result.word_count || 0,
        cost_credits: estimatedCost
      }

      setGeneratedStories(prev => [newStory, ...prev])
      setCurrentStory(newStory)

      // Reset form
      setStoryRequest({
        title: '',
        genre: 'fantasy',
        prompt: '',
        tone: 'adventurous',
        length: 'short',
        characters: '',
        setting: ''
      })

    } catch (error) {
      console.error('Error generating story:', error)
      alert('Failed to generate story. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveStory = async (story: GeneratedStory) => {
    try {
      const { error } = await supabase
        .from('stories')
        .update({
          status: 'published',
          updated_at: new Date().toISOString()
        })
        .eq('id', story.id)

      if (error) {
        console.error('Error saving story:', error)
        alert('Failed to save story')
        return
      }

      alert('Story saved successfully!')
    } catch (error) {
      console.error('Error saving story:', error)
      alert('Failed to save story')
    }
  }

  const handleDownloadStory = (story: GeneratedStory) => {
    const element = document.createElement('a')
    const file = new Blob([story.content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI Story Builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Story Builder</h1>
          <p className="text-gray-600 mt-1">Create stories with advanced AI assistance</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">{userProfile.credits_balance} credits</span>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600">
            Cost: {estimatedCost} credits
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Story Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Story Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Title
                </label>
                <Input
                  placeholder="Enter your story title..."
                  value={storyRequest.title}
                  onChange={(e) => setStoryRequest(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Genre and Tone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre
                  </label>
                  <select
                    value={storyRequest.genre}
                    onChange={(e) => setStoryRequest(prev => ({ ...prev, genre: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {genres.map(genre => (
                      <option key={genre} value={genre}>
                        {genre.charAt(0).toUpperCase() + genre.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tone
                  </label>
                  <select
                    value={storyRequest.tone}
                    onChange={(e) => setStoryRequest(prev => ({ ...prev, tone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {tones.map(tone => (
                      <option key={tone} value={tone}>
                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Length
                </label>
                <select
                  value={storyRequest.length}
                  onChange={(e) => setStoryRequest(prev => ({ ...prev, length: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {lengths.map(length => (
                    <option key={length.value} value={length.value}>
                      {length.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Story Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Prompt *
                </label>
                <Textarea
                  placeholder="Describe your story idea, plot, or specific elements you want included..."
                  value={storyRequest.prompt}
                  onChange={(e) => setStoryRequest(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Characters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Characters (Optional)
                </label>
                <Input
                  placeholder="Describe your main characters..."
                  value={storyRequest.characters}
                  onChange={(e) => setStoryRequest(prev => ({ ...prev, characters: e.target.value }))}
                />
              </div>

              {/* Setting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setting (Optional)
                </label>
                <Input
                  placeholder="Describe the setting or world..."
                  value={storyRequest.setting}
                  onChange={(e) => setStoryRequest(prev => ({ ...prev, setting: e.target.value }))}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateStory}
                disabled={generating || !storyRequest.prompt.trim() || userProfile.credits_balance < estimatedCost}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Story...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Story ({estimatedCost} credits)
                  </>
                )}
              </Button>

              {userProfile.credits_balance < estimatedCost && (
                <p className="text-sm text-red-600 text-center">
                  Insufficient credits. You need {estimatedCost - userProfile.credits_balance} more credits.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="w-5 h-5" />
                <span>AI Tips</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-blue-500 mt-0.5" />
                  <p>Be specific with your prompt - mention key plot points, conflicts, or themes</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                  <p>Include character descriptions for more personalized storytelling</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-green-500 mt-0.5" />
                  <p>Longer stories provide more detailed narratives but cost more credits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Story & History */}
        <div className="space-y-6">
          {/* Current Story */}
          {currentStory && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>{currentStory.title}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveStory(currentStory)}
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadStory(currentStory)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{currentStory.word_count} words</span>
                  <span>•</span>
                  <span>{currentStory.cost_credits} credits used</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    {currentStory.content.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-3 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Story History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Recent Stories</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedStories.length > 0 ? (
                <div className="space-y-3">
                  {generatedStories.slice(0, 5).map((story) => (
                    <div
                      key={story.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => setCurrentStory(story)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {story.title}
                        </h4>
                        <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                          <span>{story.word_count} words</span>
                          <span>•</span>
                          <span>{new Date(story.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {story.cost_credits} credits
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCurrentStory(story)
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No stories generated yet</p>
                  <p className="text-xs">Your generated stories will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}