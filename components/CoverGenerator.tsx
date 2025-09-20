'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CoverGeneratorProps {
  storyId: string
  storyTitle: string
  storyGenre: string
  onCoverGenerated?: (coverUrl: string) => void
}

interface Cover {
  id: string
  cover_url: string
  cover_style: string
  is_primary: boolean
  created_at: string
}

interface QueueItem {
  id: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  cover_style: string
  estimated_completion: string | null
}

export default function CoverGenerator({
  storyId,
  storyTitle,
  storyGenre,
  onCoverGenerated
}: CoverGeneratorProps) {
  const [covers, setCovers] = useState<Cover[]>([])
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [selectedStyle, setSelectedStyle] = useState('artistic')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [userLimits, setUserLimits] = useState<any>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  const supabase = createClient()

  const coverStyles = {
    realistic: { name: 'Realistic', desc: 'Photorealistic, professional' },
    artistic: { name: 'Artistic', desc: 'Digital art, stylized' },
    fantasy: { name: 'Fantasy', desc: 'Mystical, magical themes' },
    minimalist: { name: 'Minimalist', desc: 'Clean, simple design' },
    vintage: { name: 'Vintage', desc: 'Retro, classic style' }
  }

  useEffect(() => {
    loadCovers()
    const interval = setInterval(loadCovers, 5000) // Check for updates every 5 seconds
    return () => clearInterval(interval)
  }, [storyId])

  const loadCovers = async () => {
    try {
      const response = await fetch(`/api/stories/${storyId}/cover`)
      const data = await response.json()

      if (response.ok) {
        setCovers(data.covers)
        setQueueItems(data.queue_items)
        setUserLimits(data.user_limits)
      }
    } catch (error) {
      console.error('Failed to load covers:', error)
    }
  }

  const generateCover = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stories/${storyId}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: selectedStyle,
          custom_prompt: customPrompt
        })
      })

      const result = await response.json()

      if (response.ok) {
        await loadCovers() // Refresh the list
        setCustomPrompt('')
      } else {
        alert(result.error || 'Cover generation failed')
      }
    } catch (error) {
      console.error('Cover generation error:', error)
      alert('Cover generation failed')
    } finally {
      setLoading(false)
    }
  }

  const setPrimaryCover = async (coverId: string, coverUrl: string) => {
    try {
      // This would update the story's primary cover
      onCoverGenerated?.(coverUrl)
      await loadCovers()
    } catch (error) {
      console.error('Failed to set primary cover:', error)
    }
  }

  const primaryCover = covers.find(c => c.is_primary)
  const canGenerate = userLimits && userLimits.styles.includes(selectedStyle)
  const hasCredits = userLimits && userLimits.cost_credits <= (userLimits.credits_balance || 0)

  return (
    <div className="cover-generator">
      {/* Current Cover Display */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Story Cover</h3>
        <div className="flex items-start space-x-4">
          {primaryCover ? (
            <div className="relative">
              <img
                src={primaryCover.cover_url}
                alt={`Cover for ${storyTitle}`}
                className="w-32 h-48 object-cover rounded-lg shadow-md"
              />
              <div className="absolute top-2 right-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </span>
              </div>
            </div>
          ) : (
            <div className="w-32 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-2xl mb-2">📖</div>
                <div className="text-sm">No Cover</div>
              </div>
            </div>
          )}

          <div className="flex-1">
            <h4 className="font-medium">{storyTitle}</h4>
            <p className="text-sm text-gray-600 mb-3">Genre: {storyGenre}</p>

            <button
              onClick={() => setShowGenerator(!showGenerator)}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              🎨 Generate New Cover
            </button>

            {userLimits && (
              <div className="mt-3 text-sm text-gray-600">
                <div>Monthly limit: {covers.length}/{userLimits.monthly_covers}</div>
                <div>Cost: {userLimits.cost_credits} credits each</div>
                <div>Available styles: {userLimits.styles.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generation Queue Status */}
      {queueItems.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Cover Generation in Progress</h4>
          {queueItems.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-2">
                {item.status === 'pending' && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                {item.status === 'generating' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                {item.status === 'failed' && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                <span className="capitalize">{item.status}</span>
              </div>
              <span className="text-gray-600">
                {coverStyles[item.cover_style as keyof typeof coverStyles]?.name} style
              </span>
              {item.status === 'generating' && (
                <span className="text-blue-600">Estimated: 30-120 seconds</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cover Generator Form */}
      {showGenerator && (
        <div className="border rounded-lg p-6 bg-gray-50">
          <h4 className="font-medium mb-4">Generate New Cover</h4>

          {/* Style Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Style
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(coverStyles).map(([key, style]) => (
                <label
                  key={key}
                  className={`relative cursor-pointer rounded-lg border p-3 ${
                    selectedStyle === key
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${
                    !userLimits?.styles.includes(key)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="style"
                    value={key}
                    checked={selectedStyle === key}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    disabled={!userLimits?.styles.includes(key)}
                    className="sr-only"
                  />
                  <div>
                    <div className="font-medium text-sm">{style.name}</div>
                    <div className="text-xs text-gray-500">{style.desc}</div>
                    {!userLimits?.styles.includes(key) && (
                      <div className="text-xs text-orange-600 mt-1">
                        Premium required
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Prompt (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe specific elements you want in the cover..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to auto-generate from story details
            </p>
          </div>

          {/* Generation Button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Cost: {userLimits?.cost_credits} credits
              {!hasCredits && (
                <span className="text-red-600 ml-2">
                  (Insufficient credits)
                </span>
              )}
            </div>

            <div className="space-x-3">
              <button
                onClick={() => setShowGenerator(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={generateCover}
                disabled={loading || !canGenerate || !hasCredits}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Cover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Covers Gallery */}
      {covers.length > 1 && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">All Generated Covers</h4>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {covers.map((cover) => (
              <div key={cover.id} className="relative group">
                <img
                  src={cover.cover_url}
                  alt={`${cover.cover_style} cover`}
                  className="w-full aspect-[3/4] object-cover rounded cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setPrimaryCover(cover.id, cover.cover_url)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                  {!cover.is_primary && (
                    <button className="opacity-0 group-hover:opacity-100 bg-white text-black px-2 py-1 rounded text-xs">
                      Set Primary
                    </button>
                  )}
                </div>
                <div className="absolute bottom-1 left-1 right-1">
                  <div className="bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded text-center">
                    {coverStyles[cover.cover_style as keyof typeof coverStyles]?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}