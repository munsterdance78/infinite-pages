'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BookOpen,
  Plus,
  Wand2,
  Edit,
  Download,
  Sparkles,
  FileText,
  RefreshCw,
  ArrowLeft,
  Brain,
  Save,
  Eye,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// MOCK DATA - No external dependencies
type CreationMode = 'story' | 'novel' | 'choice-book' | 'ai-builder'

const MOCK_USER_PROFILE = {
  id: 'test-user-123',
  email: 'test@example.com',
  subscription_tier: 'premium' as const,
  tokens_remaining: 1250,
  tokens_used_total: 82,
  stories_created: 7,
  credits_balance: undefined,
  is_creator: true
}

const MOCK_GENRES = [
  'Fantasy', 'Science Fiction', 'Mystery', 'Romance', 'Thriller',
  'Horror', 'Adventure', 'Drama', 'Comedy', 'Historical Fiction'
]

const MOCK_STORIES = [
  {
    id: '1',
    title: 'The Crystal Kingdom',
    genre: 'Fantasy',
    premise: 'A young mage discovers a hidden kingdom made of crystal...',
    type: 'story' as CreationMode,
    status: 'completed',
    created_at: '2025-09-20T00:00:00Z',
    updated_at: '2025-09-22T00:00:00Z',
    total_words: 5200,
    published: true
  },
  {
    id: '2',
    title: 'Space Echoes',
    genre: 'Science Fiction',
    premise: 'In the year 2145, humanity receives mysterious signals...',
    type: 'novel' as CreationMode,
    status: 'in_progress',
    created_at: '2025-09-15T00:00:00Z',
    updated_at: '2025-09-21T00:00:00Z',
    total_words: 12800,
    published: false
  },
  {
    id: '3',
    title: 'The Detective\'s Choice',
    genre: 'Mystery',
    premise: 'An interactive mystery where readers solve the case...',
    type: 'choice-book' as CreationMode,
    status: 'draft',
    created_at: '2025-09-18T00:00:00Z',
    updated_at: '2025-09-19T00:00:00Z',
    total_words: 3400,
    published: false
  }
]

// ISOLATED STORY CREATOR COMPONENT
export default function IsolatedStoryCreator() {
  const [mode, setMode] = useState<CreationMode>('story')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit'>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGenre, setFilterGenre] = useState('all')
  const [progress, setProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  // Form state for all modes
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    premise: '',
    description: '',
    tone: 'neutral',
    length: 'medium',
    characters: '',
    setting: '',
    target_length: 50000,
    choice_complexity: 'moderate' as const,
    target_ending_count: 5,
    main_themes: [] as string[],
    target_audience: 'adult'
  })

  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const validateForm = () => {
    const errors: string[] = []

    if (!formData.title.trim()) {
      errors.push('Title is required')
    }
    if (!formData.genre) {
      errors.push('Genre is required')
    }
    if (!formData.premise.trim()) {
      errors.push('Premise is required')
    }
    if (formData.premise.length < 10) {
      errors.push('Premise must be at least 10 characters')
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([])
    }
  }

  const handleCreateStory = async () => {
    console.log('Create story clicked')

    if (!validateForm()) {
      return
    }

    setIsGenerating(true)
    setProgress(0)

    // Simulate story generation process
    const steps = [
      'Analyzing premise...',
      'Generating story structure...',
      'Creating characters...',
      'Writing opening chapter...',
      'Finalizing story...'
    ]

    for (let i = 0; i < steps.length; i++) {
      console.log(`Step ${i + 1}: ${steps[i]}`)
      setProgress((i + 1) / steps.length * 100)

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    setIsGenerating(false)
    setProgress(100)

    console.log('Story creation completed!')
    console.log('Form data:', formData)

    // Reset form and return to list
    setTimeout(() => {
      setCurrentView('list')
      setFormData({
        title: '',
        genre: '',
        premise: '',
        description: '',
        tone: 'neutral',
        length: 'medium',
        characters: '',
        setting: '',
        target_length: 50000,
        choice_complexity: 'moderate',
        target_ending_count: 5,
        main_themes: [],
        target_audience: 'adult'
      })
      setProgress(0)
    }, 2000)
  }

  const filteredStories = MOCK_STORIES.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         story.premise.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGenre = filterGenre === 'all' || story.genre === filterGenre
    return matchesSearch && matchesGenre
  })

  const renderStoryList = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search stories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterGenre} onValueChange={setFilterGenre}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {MOCK_GENRES.map(genre => (
              <SelectItem key={genre} value={genre}>{genre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStories.map(story => (
          <Card key={story.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{story.title}</CardTitle>
                <Badge variant={story.status === 'completed' ? 'default' : 'secondary'}>
                  {story.status}
                </Badge>
              </div>
              <Badge variant="outline">{story.genre}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                {story.premise}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{story.total_words} words</span>
                <span>{story.type}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    console.log('Edit story:', story.title)
                    setCurrentView('edit')
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => console.log('View story:', story.title)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStories.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No stories found
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || filterGenre !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first story to get started'
            }
          </p>
        </div>
      )}
    </div>
  )

  const renderCreationForm = () => (
    <div className="space-y-6">
      {/* Mode Selection */}
      <Tabs value={mode} onValueChange={(value) => setMode(value as CreationMode)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="novel">Novel</TabsTrigger>
          <TabsTrigger value="choice-book">Choice Book</TabsTrigger>
          <TabsTrigger value="ai-builder">AI Builder</TabsTrigger>
        </TabsList>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <TabsContent value="story" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Story</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Enter story title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Genre</label>
                <Select value={formData.genre} onValueChange={(value) => handleInputChange('genre', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_GENRES.map(genre => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Premise</label>
                <Textarea
                  placeholder="Describe your story idea..."
                  value={formData.premise}
                  onChange={(e) => handleInputChange('premise', e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tone</label>
                  <Select value={formData.tone} onValueChange={(value) => handleInputChange('tone', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serious">Serious</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="dramatic">Dramatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Length</label>
                  <Select value={formData.length} onValueChange={(value) => handleInputChange('length', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (1,000 words)</SelectItem>
                      <SelectItem value="medium">Medium (5,000 words)</SelectItem>
                      <SelectItem value="long">Long (10,000 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="novel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Novel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Enter novel title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe your novel..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Target Length (words)</label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={formData.target_length}
                  onChange={(e) => handleInputChange('target_length', parseInt(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="choice-book" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Choice-Driven Story</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Enter choice book title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Complexity</label>
                <Select
                  value={formData.choice_complexity}
                  onValueChange={(value) => handleInputChange('choice_complexity', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (2-3 choices per decision)</SelectItem>
                    <SelectItem value="moderate">Moderate (3-4 choices)</SelectItem>
                    <SelectItem value="complex">Complex (4+ choices)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Target Endings</label>
                <Input
                  type="number"
                  placeholder="5"
                  value={formData.target_ending_count}
                  onChange={(e) => handleInputChange('target_ending_count', parseInt(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-builder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Assisted Story Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Characters</label>
                <Textarea
                  placeholder="Describe your main characters..."
                  value={formData.characters}
                  onChange={(e) => handleInputChange('characters', e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Setting</label>
                <Textarea
                  placeholder="Describe the story setting..."
                  value={formData.setting}
                  onChange={(e) => handleInputChange('setting', e.target.value)}
                  rows={3}
                />
              </div>

              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription>
                  AI will generate plot points, dialogue, and story structure based on your inputs.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generation Progress */}
      {isGenerating && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Generating your story...</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {progress === 100 && !isGenerating && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Story created successfully! Returning to story list...
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleCreateStory}
          disabled={isGenerating}
          className="flex-1"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Create Story
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setCurrentView('list')}
          disabled={isGenerating}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Test Status Banner */}
      <div className="bg-green-600 text-white text-center py-2 text-sm font-medium">
        🧪 ISOLATION TEST - Story Creator Component (No External Dependencies)
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Story Creator</h1>
              <p className="text-muted-foreground">
                Create amazing stories with AI assistance - Isolated Test Mode
              </p>
            </div>

            {currentView === 'list' && (
              <Button onClick={() => setCurrentView('create')}>
                <Plus className="h-4 w-4 mr-2" />
                New Story
              </Button>
            )}
          </div>

          {/* User Info Display */}
          <div className="mt-4 p-4 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{MOCK_USER_PROFILE.email}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Tokens: {MOCK_USER_PROFILE.tokens_remaining}</span>
                  <span>Stories: {MOCK_USER_PROFILE.stories_created}</span>
                  <Badge>{MOCK_USER_PROFILE.subscription_tier}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {currentView === 'list' && renderStoryList()}
        {(currentView === 'create' || currentView === 'edit') && renderCreationForm()}
      </div>
    </div>
  )
}