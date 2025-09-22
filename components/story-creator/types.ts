/**
 * Shared types for story creator components
 */

export type CreationMode = 'story' | 'novel' | 'choice-book' | 'ai-builder'

export interface UnifiedStory {
  id: string
  user_id: string
  title: string
  genre: string | null
  premise: string | null
  type: CreationMode
  status: string

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

export interface CreationProgress {
  currentStep: number
  totalSteps: number
  stepName: string
  isGenerating: boolean
  error?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface FormData {
  title: string
  genre: string
  premise: string
  description: string
  tone: string
  length: string
  characters: string
  setting: string
  target_length: number
  choice_complexity: 'simple' | 'moderate' | 'complex'
  target_ending_count: number
  estimated_length: number
  main_themes: string[]
  target_audience: string
}