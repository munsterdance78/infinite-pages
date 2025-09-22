'use client'

import React, { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, AlertCircle } from 'lucide-react'
import { ALLOWED_GENRES } from '@/lib/constants'
import type { CreationMode } from './types'

interface StoryCreationFormProps {
  mode: CreationMode
  formData: any
  setFormData: (data: any) => void
  isCreating: boolean
  progress: any
  onSubmit: () => void
  onCancel: () => void
}

const StoryCreationForm = memo(function StoryCreationForm({
  mode,
  formData,
  setFormData,
  isCreating,
  progress,
  onSubmit,
  onCancel
}: StoryCreationFormProps) {
  const getModeIcon = (mode: CreationMode) => {
    switch (mode) {
      case 'story': return <FileText className="w-4 h-4" />
      case 'novel': return <BookOpen className="w-4 h-4" />
      case 'choice-book': return <TreePine className="w-4 h-4" />
      case 'ai-builder': return <Wand2 className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const renderModeSpecificFields = () => {
    switch (mode) {
      case 'novel':
        return <NovelFields formData={formData} setFormData={setFormData} />
      case 'choice-book':
        return <ChoiceBookFields formData={formData} setFormData={setFormData} />
      case 'ai-builder':
        return <AIBuilderFields formData={formData} setFormData={setFormData} />
      default:
        return null
    }
  }

  if (progress.isGenerating) {
    return (
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
    )
  }

  return (
    <div className="space-y-6">
      {/* Common fields */}
      <CommonFormFields formData={formData} setFormData={setFormData} />

      {/* Mode-specific fields */}
      {renderModeSpecificFields()}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isCreating}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="gap-2" disabled={isCreating}>
          <Sparkles className="w-4 h-4" />
          Create {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </Button>
      </div>
    </div>
  )
})

// Common form fields component
const CommonFormFields = memo(function CommonFormFields({
  formData,
  setFormData
}: {
  formData: any
  setFormData: (data: any) => void
}) {
  return (
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
  )
})

// Novel-specific fields
const NovelFields = memo(function NovelFields({
  formData,
  setFormData
}: {
  formData: any
  setFormData: (data: any) => void
}) {
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
})

// Choice book fields
const ChoiceBookFields = memo(function ChoiceBookFields({
  formData,
  setFormData
}: {
  formData: any
  setFormData: (data: any) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="choice_complexity" className="text-sm font-medium">Choice Complexity</label>
        <Select value={formData.choice_complexity} onValueChange={(value: 'simple' | 'moderate' | 'complex') =>
          setFormData(prev => ({ ...prev, choice_complexity: value }))
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
})

// AI builder fields
const AIBuilderFields = memo(function AIBuilderFields({
  formData,
  setFormData
}: {
  formData: any
  setFormData: (data: any) => void
}) {
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
})

export default StoryCreationForm