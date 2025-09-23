'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

  // Modal states for creation tools
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showCharacterBuilderModal, setShowCharacterBuilderModal] = useState(false)
  const [showWorldGeneratorModal, setShowWorldGeneratorModal] = useState(false)
  const [showQuickStartModal, setShowQuickStartModal] = useState(false)

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
        <button
          onClick={() => setShowTemplatesModal(true)}
          className="glass-btn-secondary text-sm px-4 py-2 hover:scale-105 transition-transform"
        >
          📚 Story Templates
        </button>
        <button
          onClick={() => setShowCharacterBuilderModal(true)}
          className="glass-btn-secondary text-sm px-4 py-2 hover:scale-105 transition-transform"
        >
          🎭 Character Builder
        </button>
        <button
          onClick={() => setShowWorldGeneratorModal(true)}
          className="glass-btn-secondary text-sm px-4 py-2 hover:scale-105 transition-transform"
        >
          🌍 World Generator
        </button>
        <button
          onClick={() => setShowQuickStartModal(true)}
          className="glass-btn-secondary text-sm px-4 py-2 hover:scale-105 transition-transform"
        >
          ⚡ Quick Start
        </button>
      </div>

      {/* Story Templates Modal - Simple HTML Modal */}
      {showTemplatesModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={() => setShowTemplatesModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-4xl max-h-[80vh] overflow-y-auto m-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                📚 Story Templates
              </h2>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Choose from pre-built story structures to jumpstart your creativity.
            </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Adventure Quest</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Hero's journey with challenges, allies, and final confrontation.</p>
                <Button size="sm" onClick={() => {
                  console.log('Adventure Quest template selected');
                  setShowTemplatesModal(false);
                }}>
                  Use Template
                </Button>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Mystery Thriller</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Investigation with clues, red herrings, and revelation.</p>
                <Button size="sm" onClick={() => {
                  console.log('Mystery Thriller template selected');
                  setShowTemplatesModal(false);
                }}>
                  Use Template
                </Button>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Romance Drama</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Love story with obstacles, misunderstandings, and resolution.</p>
                <Button size="sm" onClick={() => {
                  console.log('Romance Drama template selected');
                  setShowTemplatesModal(false);
                }}>
                  Use Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      )}

      {/* Character Builder Modal */}
      <Dialog open={showCharacterBuilderModal} onOpenChange={setShowCharacterBuilderModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[9999] fixed bg-white shadow-2xl border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎭 Character Builder
            </DialogTitle>
            <DialogDescription>
              Create detailed characters with personalities, backgrounds, and motivations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Character Name</label>
                <Input placeholder="Enter character name..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <Input placeholder="Protagonist, Antagonist, Supporting..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Background</label>
              <Textarea placeholder="Character's history, upbringing, key life events..." rows={3} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Personality Traits</label>
              <Textarea placeholder="Personality, quirks, strengths, weaknesses..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCharacterBuilderModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                console.log('Character created');
                setShowCharacterBuilderModal(false);
              }}>
                Create Character
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* World Generator Modal */}
      <Dialog open={showWorldGeneratorModal} onOpenChange={setShowWorldGeneratorModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[9999] fixed bg-white shadow-2xl border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🌍 World Generator
            </DialogTitle>
            <DialogDescription>
              Build immersive worlds with locations, cultures, and histories.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">World Name</label>
              <Input placeholder="Enter world/setting name..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Genre/Style</label>
                <Input placeholder="Fantasy, Sci-fi, Modern, Historical..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time Period</label>
                <Input placeholder="Medieval, Future, Present day..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">World Description</label>
              <Textarea placeholder="Geography, climate, major locations, political systems..." rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cultures & Societies</label>
              <Textarea placeholder="Different groups, their customs, conflicts, relationships..." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWorldGeneratorModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                console.log('World created');
                setShowWorldGeneratorModal(false);
              }}>
                Generate World
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Start Modal */}
      <Dialog open={showQuickStartModal} onOpenChange={setShowQuickStartModal}>
        <DialogContent className="max-w-2xl z-[9999] fixed bg-white shadow-2xl border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚡ Quick Start
            </DialogTitle>
            <DialogDescription>
              Get started quickly with guided prompts and instant story creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                console.log('Random idea generator');
                setShowQuickStartModal(false);
              }}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">🎲 Random Idea Generator</h3>
                  <p className="text-sm text-gray-600">Get a completely random story concept to spark creativity.</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                console.log('One-minute story');
                setShowQuickStartModal(false);
              }}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">⏱️ One-Minute Story</h3>
                  <p className="text-sm text-gray-600">Create a complete short story in under a minute.</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                console.log('Prompt builder');
                setShowQuickStartModal(false);
              }}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">🔨 Prompt Builder</h3>
                  <p className="text-sm text-gray-600">Build custom prompts step-by-step with guided assistance.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GlassStoryCreatorWrapper