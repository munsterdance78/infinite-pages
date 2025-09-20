'use client'

import React, { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StoryCard from '@/components/StoryCard'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  BookOpen,
  Plus,
  Wand2,
  Edit,
  Download,
  DollarSign,
  Sparkles,
  FileText,
  RefreshCw,
  ArrowLeft,
  Search,
  Filter,
  SortDesc
} from 'lucide-react'
import {
  TOKEN_COSTS,
  ALLOWED_GENRES,
  EXPORT_FORMATS,
  STORY_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  type SubscriptionTier,
  type StoryStatus,
  type ExportFormat
} from '@/lib/constants'

interface Story {
  id: string;
  user_id: string;
  title: string;
  genre: string | null;
  premise: string | null;
  foundation: any;
  outline: any;
  characters: any;
  status: StoryStatus;
  word_count: number;
  chapter_count: number;
  total_tokens_used: number;
  total_cost_usd: number;
  created_at: string;
  updated_at: string;
  chapters?: Chapter[];
}

type Chapter = Database['public']['Tables']['chapters']['Row'];

interface StoryCreatorProps {
  userProfile: {
    id: string;
    tokens_remaining: number;
    subscription_tier: SubscriptionTier;
  };
  onStoryChange: () => void;
}

type ViewMode = 'list' | 'create' | 'edit';
type SortOption = 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'title_asc' | 'word_count_desc';

export default function StoryCreator({ userProfile, onStoryChange }: StoryCreatorProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [filteredStories, setFilteredStories] = useState<Story[]>([])
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeTab, setActiveTab] = useState('overview')

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoryStatus | 'all'>('all')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('updated_desc')

  // Forms
  const [newStoryForm, setNewStoryForm] = useState({
    title: '',
    genre: '',
    premise: ''
  })
  const [improvementForm, setImprovementForm] = useState({
    chapterId: '',
    feedback: ''
  })

  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchStories()
  }, [])

  useEffect(() => {
    filterAndSortStories()
  }, [stories, searchQuery, statusFilter, genreFilter, sortBy])

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          chapters (
            id, chapter_number, title, word_count, 
            generation_cost_usd, created_at, updated_at,
            tokens_used_input, tokens_used_output, summary, content
          )
        `)
        .eq('user_id', userProfile.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setStories(data || [])
    } catch (error) {
      console.error('Failed to fetch stories:', error)
    }
  }

  const filterAndSortStories = () => {
    let filtered = [...stories]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(story => 
        story.title.toLowerCase().includes(query) ||
        story.genre?.toLowerCase().includes(query) ||
        story.premise?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(story => story.status === statusFilter)
    }

    // Apply genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(story => story.genre === genreFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'updated_asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'title_asc':
          return a.title.localeCompare(b.title)
        case 'word_count_desc':
          return b.word_count - a.word_count
        default:
          return 0
      }
    })

    setFilteredStories(filtered)
  }

  const generateStoryFoundation = async () => {
    if (!newStoryForm.premise || userProfile.tokens_remaining < TOKEN_COSTS.STORY_FOUNDATION) return

    setLoading(true)
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newStoryForm.title || 'Untitled Story',
          genre: newStoryForm.genre,
          premise: newStoryForm.premise
        })
      })

      if (response.ok) {
        const data = await response.json()
        setStories(prev => [data.story, ...prev])
        setSelectedStory(data.story)
        setViewMode('edit')
        setActiveTab('foundation')
        setNewStoryForm({ title: '', genre: '', premise: '' })
        onStoryChange()

        // Show cache success message if applicable
        if (data.fromCache && data.tokensSaved > 0) {
          alert(`${data.message}\n\nCache Type: ${data.cacheType?.toUpperCase()}\nEfficiency: ${Math.round((data.tokensSaved / TOKEN_COSTS.STORY_FOUNDATION) * 100)}% savings`)
        }
      } else {
        const error = await response.json()
        alert(error.error || ERROR_MESSAGES.SERVICE_UNAVAILABLE)
      }
    } catch (error) {
      console.error('Story generation failed:', error)
      alert(ERROR_MESSAGES.SERVICE_UNAVAILABLE)
    } finally {
      setLoading(false)
    }
  }

  const generateChapter = async (storyId: string, chapterNumber: number) => {
    if (userProfile.tokens_remaining < TOKEN_COSTS.CHAPTER_GENERATION) {
      alert(`${ERROR_MESSAGES.INSUFFICIENT_TOKENS} (${TOKEN_COSTS.CHAPTER_GENERATION} tokens required)`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/stories/${storyId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_number: chapterNumber })
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedStory(prev => prev ? {
          ...prev,
          chapters: [...(prev.chapters || []), data.chapter].sort((a, b) => a.chapter_number - b.chapter_number),
          chapter_count: prev.chapter_count + 1,
          word_count: prev.word_count + data.chapter.word_count
        } : null)

        // Update stories list
        setStories(prev => prev.map(story =>
          story.id === storyId
            ? { ...story, chapter_count: story.chapter_count + 1, word_count: story.word_count + data.chapter.word_count }
            : story
        ))

        onStoryChange()

        // Show chapter cache success message if applicable
        if (data.fromCache && data.tokensSaved > 0) {
          const efficiencyPercentage = Math.round((data.tokensSaved / TOKEN_COSTS.CHAPTER_GENERATION) * 100);
          alert(`${data.message}\n\nCache Type: ${data.cacheType?.toUpperCase()}\nEfficiency: ${efficiencyPercentage}% savings\nTokens Saved: ${data.tokensSaved}`)
        }
      } else {
        const error = await response.json()
        alert(error.error || ERROR_MESSAGES.SERVICE_UNAVAILABLE)
      }
    } catch (error) {
      console.error('Chapter generation failed:', error)
      alert(ERROR_MESSAGES.SERVICE_UNAVAILABLE)
    } finally {
      setLoading(false)
    }
  }

  const improveChapter = async () => {
    if (!improvementForm.chapterId || !improvementForm.feedback) return
    if (userProfile.tokens_remaining < TOKEN_COSTS.CHAPTER_IMPROVEMENT) {
      alert(`${ERROR_MESSAGES.INSUFFICIENT_TOKENS} (${TOKEN_COSTS.CHAPTER_IMPROVEMENT} tokens required)`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/chapters/${improvementForm.chapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'improve',
          feedback: improvementForm.feedback
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedStory(prev => prev ? {
          ...prev,
          chapters: prev.chapters?.map(ch => 
            ch.id === improvementForm.chapterId ? data.chapter : ch
          )
        } : null)
        setImprovementForm({ chapterId: '', feedback: '' })
        onStoryChange()
      }
    } catch (error) {
      console.error('Chapter improvement failed:', error)
      alert(ERROR_MESSAGES.SERVICE_UNAVAILABLE)
    } finally {
      setLoading(false)
    }
  }

  const exportStory = async (storyId: string, format: string) => {
    try {
      const response = await fetch(`/api/stories/${storyId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedStory?.title || 'story'}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const error = await response.json()
        alert(error.error || 'Export failed')
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed')
    }
  }

  const deleteStory = async (storyId: string) => {
    try {
      const response = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setStories(prev => prev.filter(s => s.id !== storyId))
        if (selectedStory?.id === storyId) {
          setSelectedStory(null)
          setViewMode('list')
        }
        onStoryChange()
      }
    } catch (error) {
      console.error('Failed to delete story:', error)
    }
  }

  const handleStoryEdit = (story: Story) => {
    setSelectedStory(story)
    setViewMode('edit')
    setActiveTab('overview')
  }

  // Stories List View
  if (viewMode === 'list') {
    return (
      <ErrorBoundary level="component">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Your Stories
              </h2>
              <p className="text-gray-600 mt-1">Create and manage your AI-generated stories</p>
            </div>
            
            <Button 
              onClick={() => setViewMode('create')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Story
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search stories by title, genre, or premise..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value={STORY_STATUS.DRAFT}>Draft</SelectItem>
                      <SelectItem value={STORY_STATUS.IN_PROGRESS}>In Progress</SelectItem>
                      <SelectItem value={STORY_STATUS.COMPLETED}>Completed</SelectItem>
                      <SelectItem value={STORY_STATUS.PUBLISHED}>Published</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={genreFilter} onValueChange={setGenreFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {ALLOWED_GENRES.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_desc">Latest First</SelectItem>
                      <SelectItem value="updated_asc">Oldest First</SelectItem>
                      <SelectItem value="title_asc">Title A-Z</SelectItem>
                      <SelectItem value="word_count_desc">Most Words</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(searchQuery || statusFilter !== 'all' || genreFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-gray-600">
                    Showing {filteredStories.length} of {stories.length} stories
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setStatusFilter('all')
                      setGenreFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stories Grid */}
          {filteredStories.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-2">
                  {stories.length === 0 ? 'No stories yet' : 'No stories match your filters'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {stories.length === 0 
                    ? 'Create your first AI-generated story to get started on your creative journey'
                    : 'Try adjusting your search or filter criteria'
                  }
                </p>
                {stories.length === 0 && (
                  <Button 
                    onClick={() => setViewMode('create')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Your First Story
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStories.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onEdit={handleStoryEdit}
                  onDelete={deleteStory}
                  onExport={exportStory}
                  showExportOption={userProfile.subscription_tier === 'pro'}
                  isLoading={loading}
                />
              ))}
            </div>
          )}
        </div>
      </ErrorBoundary>
    )
  }

  // Create New Story View
  if (viewMode === 'create') {
    return (
      <ErrorBoundary level="component">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    Create New Story
                  </CardTitle>
                  <p className="text-gray-600 mt-1">Let's bring your story idea to life with AI</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setViewMode('list')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Stories
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Story Title</label>
                <Input
                  value={newStoryForm.title}
                  onChange={(e) => setNewStoryForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter your story title..."
                  className="text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Genre</label>
                <Select
                  value={newStoryForm.genre}
                  onValueChange={(value) => setNewStoryForm(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_GENRES.map(genre => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Story Premise</label>
                <Textarea
                  value={newStoryForm.premise}
                  onChange={(e) => setNewStoryForm(prev => ({ ...prev, premise: e.target.value }))}
                  placeholder="Describe your story idea in detail. What's the main conflict? Who are the characters? What makes it unique?"
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific - the more detail you provide, the better your story foundation will be.
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-blue-800 mb-1">Generation Cost</h4>
                    <p className="text-sm text-blue-700 mb-2">
                      Story foundation: <strong>{TOKEN_COSTS.STORY_FOUNDATION} tokens</strong>
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-blue-600">Available tokens:</span>
                      <Badge variant="outline" className="bg-white">
                        {userProfile.tokens_remaining} tokens
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={generateStoryFoundation}
                disabled={loading || !newStoryForm.premise || userProfile.tokens_remaining < TOKEN_COSTS.STORY_FOUNDATION}
                className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating Story Foundation...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate Story Foundation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>
    )
  }

  // Story Editor View (simplified - would need full implementation)
  if (viewMode === 'edit' && selectedStory) {
    return (
      <ErrorBoundary level="component">
        <div className="space-y-6">
          {/* Story Header */}
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    {selectedStory.title}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-3">
                    {selectedStory.genre && (
                      <Badge variant="outline">{selectedStory.genre}</Badge>
                    )}
                    <span className="text-sm text-gray-600">
                      {selectedStory.word_count.toLocaleString()} words
                    </span>
                    <span className="text-sm text-gray-600">
                      {selectedStory.chapters?.length || 0} chapters
                    </span>
                  </div>
                </div>
                
                {userProfile.subscription_tier === 'pro' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Export Story</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(EXPORT_FORMATS).map(([key, value]) => (
                          <Button
                            key={value}
                            variant="outline"
                            onClick={() => exportStory(selectedStory.id, value)}
                            className="justify-start h-auto p-4"
                          >
                            <FileText className="w-5 h-5 mr-2" />
                            <div>
                              <div className="font-medium">{key} Document</div>
                              <div className="text-xs text-gray-500 uppercase">{value}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Story Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chapters">Chapters</TabsTrigger>
              <TabsTrigger value="foundation">Foundation</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Story Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {selectedStory.word_count.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700">Total Words</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {selectedStory.chapters?.length || 0}
                      </div>
                      <div className="text-sm text-green-700">Chapters</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">
                        ${selectedStory.total_cost_usd.toFixed(3)}
                      </div>
                      <div className="text-sm text-purple-700">Generation Cost</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chapters" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Chapters</h3>
                <Button
                  onClick={() => generateChapter(selectedStory.id, (selectedStory.chapters?.length || 0) + 1)}
                  disabled={loading || userProfile.tokens_remaining < TOKEN_COSTS.CHAPTER_GENERATION}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chapter ({TOKEN_COSTS.CHAPTER_GENERATION} tokens)
                </Button>
              </div>

              {selectedStory.chapters?.map(chapter => (
                <Card key={chapter.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          Chapter {chapter.chapter_number}: {chapter.title || 'Untitled'}
                        </CardTitle>
                        <div className="text-sm text-gray-600 mt-1">
                          {chapter.word_count.toLocaleString()} words • ${chapter.generation_cost_usd.toFixed(3)} cost
                        </div>
                      </div>
                      
                      {userProfile.subscription_tier === 'pro' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setImprovementForm({ chapterId: chapter.id, feedback: '' })}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Improve
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="foundation">
              <Card>
                <CardHeader>
                  <CardTitle>Story Foundation</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedStory.foundation ? (
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto">
                        {typeof selectedStory.foundation === 'string' 
                          ? selectedStory.foundation
                          : JSON.stringify(selectedStory.foundation, null, 2)
                        }
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-600">No foundation data available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ErrorBoundary>
    )
  }

  return null
}