'use client'

import React, { useState, useEffect } from 'react'
import { useAIGeneration } from '@/hooks/useAIGeneration'
import AICostDisplay from '@/components/AICostDisplay'

interface TransparentStoryGeneratorProps {
  storyId?: string
  onGenerated?: (story: any) => void
}

export default function TransparentStoryGenerator({
  storyId,
  onGenerated
}: TransparentStoryGeneratorProps) {
  const [premise, setPremise] = useState('')
  const [genre, setGenre] = useState('Fantasy')
  const [title, setTitle] = useState('')
  const [showCostEstimate, setShowCostEstimate] = useState(false)

  const {
    state: generationState,
    generateEstimate,
    executeGeneration,
    reset
  } = useAIGeneration({
    operation: { type: 'foundation' },
    contentLength: premise.length,
    customPrompt: premise
  })

  useEffect(() => {
    if (premise.length > 10) {
      setShowCostEstimate(true)
      generateEstimate()
    } else {
      setShowCostEstimate(false)
      reset()
    }
  }, [premise, generateEstimate, reset])

  const handleGeneration = async () => {
    try {
      const result = await executeGeneration(async () => {
        // This would be your actual story generation API call
        const response = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, genre, premise })
        })

        const data = await response.json()

        if (response.ok) {
          return {
            success: true,
            data: data.story,
            tokensUsed: data.tokensUsed || 1500 // This should come from your actual API
          }
        } else {
          return { success: false }
        }
      }, storyId)

      if (result.success) {
        onGenerated?.(result.data)
      }
    } catch (error) {
      console.error('Generation failed:', error)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white border rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Create Your Story</h2>

      <div className="space-y-4">
        {/* Story Details Form */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Story Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter your story title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Genre
          </label>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="Fantasy">Fantasy</option>
            <option value="Science Fiction">Science Fiction</option>
            <option value="Mystery">Mystery</option>
            <option value="Romance">Romance</option>
            <option value="Thriller">Thriller</option>
            <option value="Horror">Horror</option>
            <option value="Literary Fiction">Literary Fiction</option>
            <option value="Historical Fiction">Historical Fiction</option>
            <option value="Young Adult">Young Adult</option>
            <option value="Adventure">Adventure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Story Premise
          </label>
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            placeholder="Describe your story idea... (the more detail, the better the result!)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
            rows={4}
          />
          <div className="text-xs text-gray-500 mt-1">
            {premise.length}/2000 characters • More detail = better story
          </div>
        </div>

        {/* AI Cost Display */}
        {showCostEstimate && (
          <AICostDisplay
            operation={{
              type: 'foundation',
              complexity: premise.length > 500 ? 'complex' : premise.length > 200 ? 'medium' : 'simple'
            }}
            stage={generationState.stage}
            tokensUsed={generationState.tokensUsed}
            actualResults={generationState.actualResults}
            onProceed={handleGeneration}
            showMarketComparison={true}
          />
        )}

        {/* Generation Error */}
        {generationState.stage === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800 font-medium">Generation Failed</div>
            <div className="text-red-600 text-sm">
              {generationState.error} - No charges were applied to your account.
            </div>
            <button
              onClick={reset}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Manual Generate Button (if no cost estimate shown) */}
        {!showCostEstimate && premise.length > 0 && (
          <div className="text-center py-4">
            <div className="text-sm text-gray-600 mb-2">
              Add more details to see cost estimate, or generate now with basic pricing
            </div>
            <button
              onClick={handleGeneration}
              disabled={generationState.stage === 'processing'}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {generationState.stage === 'processing' ? 'Generating...' : 'Generate Story (~$0.005)'}
            </button>
          </div>
        )}
      </div>

      {/* Transparency Info */}
      <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-blue-600">💡</span>
          <span className="font-medium text-gray-800">Why We Show Costs</span>
        </div>
        <div className="text-gray-600 text-sm space-y-1">
          <p>• <strong>Full transparency:</strong> See exactly what AI services cost us</p>
          <p>• <strong>Fair pricing:</strong> Only 20% markup for infrastructure & development</p>
          <p>• <strong>Cost control:</strong> Know what you're spending before you spend it</p>
          <p>• <strong>Better value:</strong> 60%+ savings vs competitors who hide their costs</p>
        </div>
      </div>
    </div>
  )
}