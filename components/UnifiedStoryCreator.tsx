'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import StoryCard from '@/components/StoryCard'
import ErrorBoundary from '@/components/ErrorBoundary'
import PremiumUpgradePrompt from '@/components/PremiumUpgradePrompt'
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
  SortDesc,
  Brain,
  Edit3,
  Save,
  Eye,
  Zap,
  Clock,
  BarChart3,
  Target,
  Layers,
  Users,
  Settings,
  TreePine,
  Star,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import {
  ESTIMATED_CREDIT_COSTS,
  ALLOWED_GENRES,
  EXPORT_FORMATS,
  STORY_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  type StoryStatus,
  type ExportFormat
} from '@/lib/constants'
import type { SubscriptionTier } from '@/lib/subscription-config'

// Unified story creation modes
type CreationMode = 'story' | 'novel' | 'choice-book' | 'ai-builder'

// Unified story interface combining all types
interface UnifiedStory {
  id: string
  user_id: string
  title: string
  genre: string | null
  premise: string | null
  type: CreationMode
  status: StoryStatus

  // Story-specific fields
  foundation?: any
  chapters?: any[]
  content?: string
  total_tokens?: number
  cost_usd?: number

  // Novel-specific fields
  description?: string
  target_length?: number
  total_chapters?: number
  completed_chapters?: number
  total_words?: number

  // Choice book specific fields
  choice_complexity?: 'simple' | 'moderate' | 'complex'
  target_ending_count?: number
  estimated_length?: number
  main_themes?: string[]
  target_audience?: string
  choice_tree?: any

  // AI-assisted fields
  tone?: string
  characters?: string
  setting?: string
  ai_model_used?: string
  generation_time?: number

  // Common metadata
  created_at: string
  updated_at: string
  earnings_usd?: number
  views?: number
  published?: boolean
}

interface UnifiedStoryCreatorProps {
  userProfile: {
    id: string
    email: string
    subscription_tier: SubscriptionTier
    tokens_remaining: number
    tokens_used_total?: number
    stories_created?: number
    credits_balance?: number
    is_creator?: boolean
  }
  defaultMode?: CreationMode
  storyId?: string // For editing existing stories
}

interface CreationProgress {
  currentStep: number
  totalSteps: number
  stepName: string
  isGenerating: boolean
  error?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export default function UnifiedStoryCreator({
  userProfile,
  defaultMode = 'story',
  storyId
}: UnifiedStoryCreatorProps) {
  const [mode, setMode] = useState<CreationMode>(defaultMode)
  const [stories, setStories] = useState<UnifiedStory[]>([])
  const [currentStory, setCurrentStory] = useState<UnifiedStory | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGenre, setFilterGenre] = useState('all')
  const [sortBy, setSortBy] = useState('updated_at')
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [progress, setProgress] = useState<CreationProgress>({
    currentStep: 0,
    totalSteps: 1,
    stepName: 'Initializing',
    isGenerating: false
  })

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
    estimated_length: 10000,
    main_themes: [] as string[],
    target_audience: 'adult'
  })

  const supabase = createClient()

  useEffect(() => {
    loadStories()
    if (storyId) {
      loadStoryForEditing(storyId)
    }
  }, [storyId])

  const loadStories = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setStories(data || [])
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStoryForEditing = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (data) {
        setCurrentStory(data)
        setFormData({
          title: data.title || '',
          genre: data.genre || '',
          premise: data.premise || '',
          description: data.description || '',
          tone: data.tone || 'neutral',
          length: data.length || 'medium',
          characters: data.characters || '',
          setting: data.setting || '',
          target_length: data.target_length || 50000,
          choice_complexity: data.choice_complexity || 'moderate',
          target_ending_count: data.target_ending_count || 5,
          estimated_length: data.estimated_length || 10000,
          main_themes: data.main_themes || [],
          target_audience: data.target_audience || 'adult'
        })
        setMode(data.type || 'story')
        setIsEditing(true)
      }
    } catch (error) {
      console.error('Error loading story:', error)
    }
  }

  const validateForm = (): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!formData.title.trim()) {
      errors.push('Title is required')
    }

    if (!formData.genre) {
      errors.push('Genre is required')
    }

    if (!formData.premise.trim()) {
      errors.push('Premise is required')
    }

    // Mode-specific validations
    switch (mode) {
      case 'novel':
        if (formData.target_length < 40000) {
          warnings.push('Novels are typically 40,000+ words')
        }
        if (!formData.description.trim()) {
          errors.push('Novel description is required')
        }
        break

      case 'choice-book':
        if (formData.target_ending_count < 2) {
          errors.push('Choice books need at least 2 possible endings')
        }
        if (formData.main_themes.length === 0) {
          warnings.push('Consider adding main themes for better story structure')
        }
        break

      case 'ai-builder':
        if (!formData.characters.trim()) {
          warnings.push('Character descriptions help generate better stories')
        }
        if (!formData.setting.trim()) {
          warnings.push('Setting descriptions improve story quality')
        }
        break
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  const handleCreateStory = async () => {
    const validation = validateForm()
    if (!validation.isValid) {
      alert('Please fix the following errors:\n' + validation.errors.join('\n'))
      return
    }

    try {
      setIsCreating(true)
      setProgress({
        currentStep: 1,
        totalSteps: getModeSteps(mode),
        stepName: 'Creating story foundation',
        isGenerating: true
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Check token limits based on mode
      const requiredTokens = getRequiredTokens(mode)
      if (userProfile.tokens_remaining < requiredTokens) {
        setShowUpgradePrompt(true)
        return
      }

      const storyData: Partial<UnifiedStory> = {
        user_id: user.id,
        title: formData.title,
        genre: formData.genre,
        premise: formData.premise,
        type: mode,
        status: 'creating' as any,
        ...getModeSpecificData()
      }

      const { data: newStory, error } = await supabase
        .from('stories')
        .insert([storyData])
        .select()
        .single()

      if (error) throw error

      setCurrentStory(newStory)
      await generateStoryContent(newStory.id)
      await loadStories()

    } catch (error) {
      console.error('Error creating story:', error)
      setProgress(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Unknown error' }))
    } finally {
      setIsCreating(false)
    }
  }

  const getModeSteps = (mode: CreationMode): number => {
    switch (mode) {
      case 'story': return 3
      case 'novel': return 5
      case 'choice-book': return 4
      case 'ai-builder': return 2
      default: return 3
    }
  }

  const getRequiredTokens = (mode: CreationMode): number => {
    switch (mode) {
      case 'story': return ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION + ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION
      case 'novel': return ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION + (ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION * 3)
      case 'choice-book': return ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION + (ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION * 2)
      case 'ai-builder': return ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION
      default: return ESTIMATED_CREDIT_COSTS.STORY_FOUNDATION + ESTIMATED_CREDIT_COSTS.CHAPTER_GENERATION
    }
  }

  const getModeSpecificData = () => {
    switch (mode) {
      case 'novel':
        return {
          description: formData.description,
          target_length: formData.target_length,
          total_chapters: Math.ceil(formData.target_length / 2500),
          completed_chapters: 0,
          total_words: 0
        }

      case 'choice-book':
        return {
          choice_complexity: formData.choice_complexity,
          target_ending_count: formData.target_ending_count,
          estimated_length: formData.estimated_length,
          main_themes: formData.main_themes,
          target_audience: formData.target_audience
        }

      case 'ai-builder':
        return {
          tone: formData.tone,
          characters: formData.characters,
          setting: formData.setting
        }

      default:
        return {}
    }
  }

  const generateStoryContent = async (storyId: string) => {
    try {
      const endpoint = getGenerationEndpoint(mode)
      const payload = {
        storyId,
        ...formData,
        mode
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`)
      }

      setProgress(prev => ({
        ...prev,
        currentStep: prev.totalSteps,
        stepName: 'Generation complete',
        isGenerating: false
      }))

      // Update story status
      await supabase
        .from('stories')
        .update({ status: 'completed' })
        .eq('id', storyId)

    } catch (error) {
      console.error('Error generating content:', error)
      setProgress(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Generation failed' }))
    }
  }

  const getGenerationEndpoint = (mode: CreationMode): string => {
    switch (mode) {
      case 'story': return '/api/stories'
      case 'novel': return '/api/stories/novel'
      case 'choice-book': return '/api/stories/choice-books'
      case 'ai-builder': return '/api/stories/ai-assisted'
      default: return '/api/stories'
    }
  }

  const handleModeChange = (newMode: CreationMode) => {
    setMode(newMode)
    setFormData(prev => ({ ...prev })) // Reset mode-specific fields if needed
  }

  const filteredStories = stories.filter(story => {
    const matchesSearch = story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         story.premise?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGenre = filterGenre === 'all' || story.genre === filterGenre
    const matchesMode = story.type === mode || mode === 'story' // Show all for story mode

    return matchesSearch && matchesGenre && matchesMode
  })

  const renderModeSpecificForm = () => {
    switch (mode) {
      case 'novel':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="description" className="text-sm font-medium">Novel Description</label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of your novel..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <label htmlFor="target_length" className="text-sm font-medium">Target Word Count</label>
              <Select value={formData.target_length.toString()} onValueChange={(value) =>
                setFormData(prev => ({ ...prev, target_length: parseInt(value) }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="40000">40,000 words (Novella)</SelectItem>
                  <SelectItem value="60000">60,000 words (Short Novel)</SelectItem>
                  <SelectItem value="80000">80,000 words (Standard Novel)</SelectItem>
                  <SelectItem value="100000">100,000 words (Long Novel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'choice-book':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="choice_complexity" className="text-sm font-medium">Choice Complexity</label>
              <Select value={formData.choice_complexity} onValueChange={(value: 'simple' | 'moderate' | 'complex') =>
                setFormData(prev => ({ ...prev, choice_complexity: value as any }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple (2-3 choices per scene)</SelectItem>
                  <SelectItem value="moderate">Moderate (3-5 choices per scene)</SelectItem>
                  <SelectItem value="complex">Complex (5+ choices, branching paths)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="target_ending_count" className="text-sm font-medium">Number of Possible Endings</label>
              <Input
                id="target_ending_count"
                type="number"
                min="2"
                max="20"
                value={formData.target_ending_count}
                onChange={(e) => setFormData(prev => ({ ...prev, target_ending_count: parseInt(e.target.value) || 5 }))}
              />
            </div>
            <div>
              <label htmlFor="target_audience" className="text-sm font-medium">Target Audience</label>
              <Select value={formData.target_audience} onValueChange={(value) =>
                setFormData(prev => ({ ...prev, target_audience: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="children">Children (8-12)</SelectItem>
                  <SelectItem value="teen">Teen (13-17)</SelectItem>
                  <SelectItem value="adult">Adult (18+)</SelectItem>
                  <SelectItem value="all">All Ages</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'ai-builder':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="tone" className="text-sm font-medium">Story Tone</label>
              <Select value={formData.tone} onValueChange={(value) =>
                setFormData(prev => ({ ...prev, tone: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dramatic">Dramatic</SelectItem>
                  <SelectItem value="humorous">Humorous</SelectItem>
                  <SelectItem value="mysterious">Mysterious</SelectItem>
                  <SelectItem value="romantic">Romantic</SelectItem>
                  <SelectItem value="suspenseful">Suspenseful</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="characters" className="text-sm font-medium">Main Characters</label>
              <Textarea
                id="characters"
                placeholder="Describe your main characters..."
                value={formData.characters}
                onChange={(e) => setFormData(prev => ({ ...prev, characters: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label htmlFor="setting" className="text-sm font-medium">Setting</label>
              <Textarea
                id="setting"
                placeholder="Describe the setting and world..."
                value={formData.setting}
                onChange={(e) => setFormData(prev => ({ ...prev, setting: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label htmlFor="length" className="text-sm font-medium">Story Length</label>
              <Select value={formData.length} onValueChange={(value) =>
                setFormData(prev => ({ ...prev, length: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (1,000-2,500 words)</SelectItem>
                  <SelectItem value="medium">Medium (2,500-5,000 words)</SelectItem>
                  <SelectItem value="long">Long (5,000-10,000 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      default:
        return null
    }
  }

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

  if (showUpgradePrompt) {
    return <PremiumUpgradePrompt {...{ userProfile, onClose: () => setShowUpgradePrompt(false) } as any} />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Story Creator</h1>
          <p className="text-muted-foreground">Create stories, novels, choice books, and AI-assisted content</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {userProfile.tokens_remaining.toLocaleString()} tokens
          </Badge>
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        </div>
      </div>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Creation Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(value) => handleModeChange(value as CreationMode)}>
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

      {/* Creation Form Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getModeIcon(mode)}
              Create New {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </DialogTitle>
          </DialogHeader>

          {progress.isGenerating ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-lg font-medium">{progress.stepName}</div>
                <Progress
                  value={(progress.currentStep / progress.totalSteps) * 100}
                  className="mt-2"
                />
                <div className="text-sm text-muted-foreground mt-2">
                  Step {progress.currentStep} of {progress.totalSteps}
                </div>
              </div>
              {progress.error && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{progress.error}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Common fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="text-sm font-medium">Title</label>
                  <Input
                    id="title"
                    placeholder="Enter your story title..."
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="genre" className="text-sm font-medium">Genre</label>
                  <Select value={formData.genre} onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, genre: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALLOWED_GENRES.map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="premise" className="text-sm font-medium">Premise</label>
                  <Textarea
                    id="premise"
                    placeholder="Describe your story premise..."
                    value={formData.premise}
                    onChange={(e) => setFormData(prev => ({ ...prev, premise: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              {/* Mode-specific fields */}
              {renderModeSpecificForm()}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateStory} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stories Grid */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterGenre} onValueChange={setFilterGenre}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {ALLOWED_GENRES.map(genre => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Recently Updated</SelectItem>
              <SelectItem value="created_at">Recently Created</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem value="views">Most Viewed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stories List */}
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading stories...</p>
          </div>
        ) : filteredStories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No stories found</h3>
              <p className="text-muted-foreground mb-4">
                {stories.length === 0
                  ? `Create your first ${mode} to get started!`
                  : 'Try adjusting your search or filters.'
                }
              </p>
              <Button onClick={() => setIsCreating(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create New {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStories.map(story => (
              <ErrorBoundary key={story.id}>
                <StoryCard
                  story={story as any}
                  onEdit={() => loadStoryForEditing(story.id)}
                  onDelete={() => loadStories()}
                />
              </ErrorBoundary>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}