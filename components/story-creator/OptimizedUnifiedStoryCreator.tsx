'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import type { SubscriptionTier } from '@/lib/subscription-config'
import type { UnifiedStory, CreationMode, CreationProgress, FormData } from './types'
import { TOKEN_COSTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants'

// Lazy load heavy components
const StoryCreationForm = lazy(() => import('./StoryCreationForm'))
const StoryModeSelector = lazy(() => import('./StoryModeSelector'))
const StoryList = lazy(() => import('./StoryList'))
const PremiumUpgradePrompt = lazy(() => import('@/components/PremiumUpgradePrompt'))

interface OptimizedUnifiedStoryCreatorProps {
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
  storyId?: string
}

const OptimizedUnifiedStoryCreator = React.memo(function OptimizedUnifiedStoryCreator({
  userProfile,
  defaultMode = 'story',
  storyId
}: OptimizedUnifiedStoryCreatorProps) {
  // State management
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

  // Form state
  const [formData, setFormData] = useState<FormData>({
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
    estimated_length: 10000,
    main_themes: [],
    target_audience: 'adult'
  })

  const supabase = useMemo(() => createClient(), [])

  // Memoized callbacks
  const loadStories = useCallback(async () => {
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
  }, [supabase])

  const loadStoryForEditing = useCallback(async (id: string) => {
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
  }, [supabase])

  const handleModeChange = useCallback((newMode: CreationMode) => {
    setMode(newMode)
  }, [])

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term)
  }, [])

  const handleFilterGenreChange = useCallback((genre: string) => {
    setFilterGenre(genre)
  }, [])

  const handleSortByChange = useCallback((sort: string) => {
    setSortBy(sort)
  }, [])

  const handleCreateNew = useCallback(() => {
    setIsCreating(true)
  }, [])

  const handleStoryEdit = useCallback((storyId: string) => {
    loadStoryForEditing(storyId)
  }, [loadStoryForEditing])

  const handleStoryDelete = useCallback(() => {
    loadStories()
  }, [loadStories])

  const validateForm = useCallback(() => {
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
  }, [formData, mode])

  const handleCreateStory = useCallback(async () => {
    const validation = validateForm()
    if (!validation.isValid) {
      alert('Please fix the following errors:\n' + validation.errors.join('\n'))
      return
    }

    try {
      setProgress({
        currentStep: 1,
        totalSteps: 3,
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
        status: 'creating',
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
      setIsCreating(false)

    } catch (error) {
      console.error('Error creating story:', error)
      setProgress(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Unknown error' }))
    }
  }, [formData, mode, userProfile.tokens_remaining, supabase, validateForm, loadStories])

  const getRequiredTokens = useCallback((mode: CreationMode): number => {
    switch (mode) {
      case 'story': return TOKEN_COSTS.STORY_FOUNDATION + TOKEN_COSTS.CHAPTER_GENERATION
      case 'novel': return TOKEN_COSTS.STORY_FOUNDATION + (TOKEN_COSTS.CHAPTER_GENERATION * 3)
      case 'choice-book': return TOKEN_COSTS.STORY_FOUNDATION + (TOKEN_COSTS.CHAPTER_GENERATION * 2)
      case 'ai-builder': return TOKEN_COSTS.CHAPTER_GENERATION
      default: return TOKEN_COSTS.STORY_FOUNDATION + TOKEN_COSTS.CHAPTER_GENERATION
    }
  }, [])

  const getModeSpecificData = useCallback(() => {
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
  }, [formData, mode])

  const generateStoryContent = useCallback(async (storyId: string) => {
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
  }, [formData, mode, supabase])

  const getGenerationEndpoint = useCallback((mode: CreationMode): string => {
    switch (mode) {
      case 'story': return '/api/stories'
      case 'novel': return '/api/stories/novel'
      case 'choice-book': return '/api/stories/choice-books'
      case 'ai-builder': return '/api/stories/ai-assisted'
      default: return '/api/stories'
    }
  }, [])

  // Effects
  useEffect(() => {
    loadStories()
    if (storyId) {
      loadStoryForEditing(storyId)
    }
  }, [loadStories, loadStoryForEditing, storyId])

  if (showUpgradePrompt) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <PremiumUpgradePrompt feature="story_creation" currentTier={userProfile.subscription_tier} />
      </Suspense>
    )
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
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="w-4 h-4" />
            New {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        </div>
      </div>

      {/* Mode Selection */}
      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded-lg" />}>
        <StoryModeSelector mode={mode} onModeChange={handleModeChange} />
      </Suspense>

      {/* Creation Form Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Create New {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </DialogTitle>
          </DialogHeader>

          <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded-lg" />}>
            <StoryCreationForm
              mode={mode}
              formData={formData}
              setFormData={setFormData}
              isCreating={progress.isGenerating}
              progress={progress}
              onSubmit={handleCreateStory}
              onCancel={() => setIsCreating(false)}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Stories List */}
      <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
        <StoryList
          stories={stories}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          filterGenre={filterGenre}
          onFilterGenreChange={handleFilterGenreChange}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          mode={mode}
          onCreateNew={handleCreateNew}
          onStoryEdit={handleStoryEdit}
          onStoryDelete={handleStoryDelete}
        />
      </Suspense>
    </div>
  )
})

export default OptimizedUnifiedStoryCreator