'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LibraryReaderProps {
  storyId: string
  chapterId: string
  children: React.ReactNode
}

interface ReadingProgress {
  progress_percentage: number
  reading_time_minutes: number
  last_read_at: string
}

export default function LibraryReader({ storyId, chapterId, children }: LibraryReaderProps) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [startTime] = useState(Date.now())
  const [showDownloadUpsell, setShowDownloadUpsell] = useState(false)
  const [readingTime, setReadingTime] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    loadProgress()
    const interval = setInterval(updateReadingTime, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [storyId, chapterId])

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('story_id', storyId)
        .eq('chapter_id', chapterId)
        .single()

      if (data) {
        setProgress(data)
      }
    } catch (error) {
      console.error('Failed to load reading progress:', error)
    }
  }

  const updateReadingTime = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const sessionTime = Math.floor((Date.now() - startTime) / 60000) // Minutes
      setReadingTime(sessionTime)

      // Update reading progress
      await supabase
        .from('reading_progress')
        .upsert({
          user_id: user.id,
          story_id: storyId,
          chapter_id: chapterId,
          progress_percentage: calculateProgress(),
          last_read_at: new Date().toISOString(),
          reading_time_minutes: (progress?.reading_time_minutes || 0) + sessionTime
        })

      // Update user library status
      await supabase
        .from('user_library')
        .upsert({
          user_id: user.id,
          story_id: storyId,
          reading_status: 'reading',
          added_at: new Date().toISOString()
        })

    } catch (error) {
      console.error('Failed to update reading progress:', error)
    }
  }

  const calculateProgress = () => {
    // Simple progress calculation based on scroll position or time
    // In a real implementation, you'd track actual reading progress
    return Math.min(readingTime * 5, 100) // 5% per minute, max 100%
  }

  const handleDownloadAttempt = () => {
    setShowDownloadUpsell(true)
  }

  // Disable text selection and right-click for library protection
  const securityProps = {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: {
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
      MozUserSelect: 'none' as const,
      msUserSelect: 'none' as const
    }
  }

  return (
    <div className="library-reader" {...securityProps}>
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Reading Time: {readingTime}m
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {Math.round(calculateProgress())}%
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadAttempt}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              📥 Download
            </button>
            <div className="text-sm text-green-600 font-medium">
              📚 Reading in Library - FREE!
            </div>
          </div>
        </div>
      </div>

      {/* Content Area with Library Styling */}
      <div className="pt-16 max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-8 reading-content">
          {children}
        </div>

        {/* Library Benefits Banner */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800">
                🎉 You're reading in our library!
              </h3>
              <p className="text-blue-600 text-sm">
                Enjoy unlimited reading, automatic progress sync, and zero credit costs for library access
              </p>
            </div>
            <div className="text-2xl">📚</div>
          </div>
        </div>
      </div>

      {/* Download Upsell Modal */}
      {showDownloadUpsell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-4">
                Why Download When You Can Read Here?
              </h3>
              <div className="space-y-3 text-left text-sm text-gray-600 mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Reading in our library is completely FREE</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Your progress syncs across all devices</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Get recommendations and discover new stories</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-500">✓</span>
                  <span>Support creators through our platform</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">✗</span>
                  <span>Downloads cost 250 credits + Premium subscription</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Premium users:</strong> Downloads are available but cost 250 credits each.
                  Limited to 3 per month to encourage library usage.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDownloadUpsell(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Continue Reading Here
                </button>
                <button
                  onClick={() => {
                    setShowDownloadUpsell(false)
                    window.location.href = '/subscription/upgrade'
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  View Premium
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .reading-content {
          font-family: Georgia, serif;
          line-height: 1.8;
          font-size: 18px;
        }

        .reading-content h1, .reading-content h2, .reading-content h3 {
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .reading-content p {
          margin-bottom: 1.5rem;
        }

        @media (prefers-color-scheme: dark) {
          .reading-content {
            background-color: #1a1a1a;
            color: #e5e5e5;
          }
        }
      `}</style>
    </div>
  )
}