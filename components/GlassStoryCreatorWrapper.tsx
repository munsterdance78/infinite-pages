'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface GlassStoryCreatorWrapperProps {
  children: React.ReactNode
  className?: string
  showWizardMode?: boolean
  showProgressIndicator?: boolean
  showContextualHelp?: boolean
}

const GlassStoryCreatorWrapper: React.FC<GlassStoryCreatorWrapperProps> = ({
  children,
  className,
  showWizardMode = true,
  showProgressIndicator = true,
  showContextualHelp = true
}) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [showHelp, setShowHelp] = useState(false)

  // Monitor generation state without interfering with original component
  useEffect(() => {
    const handleGenerationStart = () => setIsGenerating(true)
    const handleGenerationEnd = () => setIsGenerating(false)

    // Listen for generation events from the wrapped component
    window.addEventListener('story-generation-start', handleGenerationStart)
    window.addEventListener('story-generation-end', handleGenerationEnd)

    return () => {
      window.removeEventListener('story-generation-start', handleGenerationStart)
      window.removeEventListener('story-generation-end', handleGenerationEnd)
    }
  }, [])

  return (
    <div className={cn('glass-story-creator-wrapper', className)}>
      {/* Header with glassmorphism */}
      <div className="glass-story-creator-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white glass-text-shadow mb-2">
              Shape Your Story Universe
            </h2>
            <p className="text-white/80 glass-text-shadow-subtle">
              Guide your AI creative partner in bringing your vision to life
            </p>
          </div>

          {/* Wizard mode indicator */}
          {showWizardMode && (
            <div className="glass-subtle px-4 py-2 rounded-lg">
              <span className="text-sm text-white/90 font-medium glass-text-shadow">
                Step {wizardStep} of 4
              </span>
            </div>
          )}
        </div>

        {/* Progress indicator overlay (non-interfering) */}
        {showProgressIndicator && isGenerating && (
          <div className="absolute top-0 left-0 right-0 h-1 glass-progress-bar overflow-hidden rounded-t-2xl">
            <div className="h-full glass-progress-fill animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
      </div>

      {/* Original component container (completely unmodified) */}
      <div className="relative">
        {children}

        {/* Contextual help overlay (positioned absolutely, non-interfering) */}
        {showContextualHelp && (
          <div className="absolute bottom-4 right-4 z-10">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="glass-btn-secondary text-white hover:scale-105 min-h-[44px] min-w-[44px] p-3 rounded-full"
              aria-label="Get help with story creation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Help tooltip */}
            {showHelp && (
              <div className="glass-tooltip absolute bottom-full right-0 mb-2 w-64 p-4 glass-slide-up">
                <h4 className="font-semibold text-white glass-text-shadow mb-2">
                  Creating Your First Story
                </h4>
                <p className="text-sm text-white/80 glass-text-shadow-subtle mb-3">
                  Start with a simple idea - "What if..." questions work great. Your AI partner will help expand it into a complete narrative universe.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="text-xs text-blue-300 hover:text-blue-200 glass-text-shadow-subtle"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generation feedback overlay */}
        {isGenerating && (
          <div className="absolute inset-0 glass-base bg-black/20 flex items-center justify-center rounded-2xl">
            <div className="glass-strong p-8 text-center">
              <div className="glass-spinner mx-auto mb-4 w-8 h-8">
                <div className="w-full h-full border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-white glass-text-shadow font-medium">
                Weaving your story universe...
              </p>
              <p className="text-sm text-white/70 glass-text-shadow-subtle mt-2">
                Your AI creative partner is exploring infinite possibilities
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Enhancement panels (external to original component) */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Story depth indicator */}
        <div className="glass-analytics-metric">
          <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
            Story Depth
          </h3>
          <p className="text-lg font-semibold text-white glass-text-shadow">
            Room for rich, detailed narratives
          </p>
        </div>

        {/* Creative inspiration */}
        <div className="glass-analytics-metric">
          <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
            Creative Tip
          </h3>
          <p className="text-sm text-white/70 glass-text-shadow-subtle">
            Great stories start with conflict - what challenge will your characters face?
          </p>
        </div>

        {/* Progress tracking */}
        <div className="glass-analytics-metric">
          <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
            Your Journey
          </h3>
          <p className="text-white/70 glass-text-shadow-subtle">
            3 stories created this week
          </p>
        </div>
      </div>

      {/* Quick actions panel */}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="glass-btn-secondary text-sm px-4 py-2">
          📚 Story Templates
        </button>
        <button className="glass-btn-secondary text-sm px-4 py-2">
          🎭 Character Builder
        </button>
        <button className="glass-btn-secondary text-sm px-4 py-2">
          🌍 World Generator
        </button>
        <button className="glass-btn-secondary text-sm px-4 py-2">
          ⚡ Quick Start
        </button>
      </div>
    </div>
  )
}

export default GlassStoryCreatorWrapper