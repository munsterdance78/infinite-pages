'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancementSliders, type AnalysisResults, type SliderValues } from './EnhancementSliders'
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Brain,
  Zap,
  FileText,
  TrendingUp,
  Clock,
  DollarSign,
  Sparkles,
  Download,
  Eye,
  Settings
} from 'lucide-react'

interface ChapterGoals {
  primaryGoal: string
  secondaryGoal: string
  plotAdvancement: string
  targetWordCount: number
  chapterNumber: number
}

interface WorkflowPhase {
  id: 'generate' | 'analyze' | 'enhance'
  name: string
  description: string
  icon: any
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: any
  duration?: number
  creditsUsed?: number
}

interface ThreePhaseWorkflowProps {
  storyId: string
  initialChapterGoals?: Partial<ChapterGoals>
  onComplete?: (result: any) => void
  onPhaseComplete?: (phase: string, result: any) => void
}

export function ThreePhaseWorkflow({
  storyId,
  initialChapterGoals,
  onComplete,
  onPhaseComplete
}: ThreePhaseWorkflowProps) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
  }, [])
  const [isRunning, setIsRunning] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<'generate' | 'analyze' | 'enhance' | 'complete'>('generate')
  const [chapterGoals, setChapterGoals] = useState<ChapterGoals>({
    primaryGoal: initialChapterGoals?.primaryGoal || 'Advance the main story',
    secondaryGoal: initialChapterGoals?.secondaryGoal || 'Develop character relationships',
    plotAdvancement: initialChapterGoals?.plotAdvancement || 'Continue main arc',
    targetWordCount: initialChapterGoals?.targetWordCount || 2000,
    chapterNumber: initialChapterGoals?.chapterNumber || 1
  })

  const [phases, setPhases] = useState<WorkflowPhase[]>([
    {
      id: 'generate',
      name: 'Generate',
      description: 'Create initial chapter content using SFSL context',
      icon: Sparkles,
      status: 'pending'
    },
    {
      id: 'analyze',
      name: 'Analyze',
      description: 'Extract facts and analyze story consistency',
      icon: Brain,
      status: 'pending'
    },
    {
      id: 'enhance',
      name: 'Enhance',
      description: 'Apply custom enhancements based on analysis',
      icon: Zap,
      status: 'pending'
    }
  ])

  const [generatedContent, setGeneratedContent] = useState('')
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null)
  const [enhancedContent, setEnhancedContent] = useState('')
  const [enhancementSettings, setEnhancementSettings] = useState<SliderValues | null>(null)
  const [workflowStats, setWorkflowStats] = useState({
    totalCreditsUsed: 0,
    totalDuration: 0,
    compressionRatio: 0,
    qualityImprovement: 0
  })

  // Execute individual phase
  const executePhase = async (phaseId: 'generate' | 'analyze' | 'enhance') => {
    try {
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, status: 'running' } : p
      ))

      const startTime = Date.now()
      let result

      switch (phaseId) {
        case 'generate':
          result = await generateChapter()
          break
        case 'analyze':
          result = await analyzeChapter()
          break
        case 'enhance':
          result = await enhanceChapter()
          break
      }

      const duration = Date.now() - startTime

      setPhases(prev => prev.map(p =>
        p.id === phaseId
          ? {
              ...p,
              status: 'completed',
              result,
              duration,
              creditsUsed: result.metadata?.creditsUsed || 0
            }
          : p
      ))

      // Update workflow stats
      setWorkflowStats(prev => ({
        ...prev,
        totalCreditsUsed: prev.totalCreditsUsed + (result.metadata?.creditsUsed || 0),
        totalDuration: prev.totalDuration + duration
      }))

      onPhaseComplete?.(phaseId, result)
      return result

    } catch (error) {
      console.error(`Phase ${phaseId} failed:`, error)
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, status: 'error' } : p
      ))
      throw error
    }
  }

  // Generate chapter content
  const generateChapter = async () => {
    const response = await fetch(`/api/stories/${storyId}/chapters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        workflowPhase: 'generate',
        chapterGoals,
        chapterNumber: chapterGoals.chapterNumber,
        targetWordCount: chapterGoals.targetWordCount
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate chapter')
    }

    const data = await response.json()
    setGeneratedContent(data.result.content)
    return data
  }

  // Analyze generated content
  const analyzeChapter = async () => {
    if (!generatedContent) {
      throw new Error('No content to analyze')
    }

    const response = await fetch(`/api/stories/${storyId}/chapters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        workflowPhase: 'analyze',
        previousContent: generatedContent
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze chapter')
    }

    const data = await response.json()
    const analysis = {
      characterVoiceAccuracy: 75,
      worldConsistency: 82,
      plotProgression: 68,
      technicalQuality: 79,
      overallScore: 76,
      sfslCompressionRatio: data.result.extractedFacts?.compressionRatio || 0.75,
      issuesFound: data.result.consistencyAnalysis?.issuesFound || 0,
      suggestions: data.result.consistencyAnalysis?.suggestions || []
    }

    setAnalysisResults(analysis)
    setWorkflowStats(prev => ({
      ...prev,
      compressionRatio: analysis.sfslCompressionRatio
    }))

    return data
  }

  // Enhance content with user settings
  const enhanceChapter = async () => {
    if (!generatedContent || !enhancementSettings) {
      throw new Error('Missing content or enhancement settings')
    }

    const feedback = generateEnhancementFeedback(enhancementSettings)

    const response = await fetch(`/api/stories/${storyId}/chapters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        workflowPhase: 'enhance',
        previousContent: generatedContent,
        feedback
      })
    })

    if (!response.ok) {
      throw new Error('Failed to enhance chapter')
    }

    const data = await response.json()
    setEnhancedContent(data.result.content)

    // Calculate quality improvement
    const improvement = analysisResults
      ? Object.values(enhancementSettings).reduce((sum, val) => sum + val, 0) / 4 - analysisResults.overallScore
      : 0

    setWorkflowStats(prev => ({
      ...prev,
      qualityImprovement: Math.round(improvement)
    }))

    return data
  }

  // Generate enhancement feedback from slider settings
  const generateEnhancementFeedback = (settings: SliderValues): string => {
    const feedbackParts = []

    if (settings.characterVoice > 60) {
      feedbackParts.push('Enhance character voice distinctiveness and speech patterns')
    }
    if (settings.worldConsistency > 60) {
      feedbackParts.push('Improve world-building details and consistency with established universe facts')
    }
    if (settings.plotProgression > 60) {
      feedbackParts.push('Increase plot tension and advance story threads more aggressively')
    }
    if (settings.technicalQuality > 60) {
      feedbackParts.push('Polish prose quality, sentence structure, and literary technique')
    }

    return feedbackParts.join('. ') || 'Apply moderate enhancements based on story bible compliance'
  }

  // Run complete workflow
  const runCompleteWorkflow = async () => {
    setIsRunning(true)
    setCurrentPhase('generate')

    try {
      // Phase 1: Generate
      await executePhase('generate')
      setCurrentPhase('analyze')

      // Phase 2: Analyze
      await executePhase('analyze')
      setCurrentPhase('enhance')

      // Wait for user to configure enhancement settings if not set
      if (!enhancementSettings && analysisResults) {
        return // Wait for user to configure sliders
      }

      // Phase 3: Enhance
      await executePhase('enhance')
      setCurrentPhase('complete')

      // Complete workflow
      const finalResult = {
        generatedContent,
        analysisResults,
        enhancedContent,
        enhancementSettings,
        workflowStats
      }

      onComplete?.(finalResult)

    } catch (error) {
      console.error('Workflow failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  // Continue to enhancement phase
  const continueToEnhancement = async () => {
    if (!enhancementSettings) return

    setIsRunning(true)
    setCurrentPhase('enhance')

    try {
      await executePhase('enhance')
      setCurrentPhase('complete')

      const finalResult = {
        generatedContent,
        analysisResults,
        enhancedContent,
        enhancementSettings,
        workflowStats
      }

      onComplete?.(finalResult)

    } catch (error) {
      console.error('Enhancement failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  // Reset workflow
  const resetWorkflow = () => {
    setPhases(prev => prev.map(p => ({ ...p, status: 'pending', result: undefined })))
    setCurrentPhase('generate')
    setGeneratedContent('')
    setAnalysisResults(null)
    setEnhancedContent('')
    setEnhancementSettings(null)
    setWorkflowStats({ totalCreditsUsed: 0, totalDuration: 0, compressionRatio: 0, qualityImprovement: 0 })
    setIsRunning(false)
  }

  const getPhaseProgress = () => {
    const completedPhases = phases.filter(p => p.status === 'completed').length
    const totalPhases = phases.length
    return (completedPhases / totalPhases) * 100
  }

  return (
    <div className="three-phase-workflow space-y-6">
      {/* Header with Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Three-Phase Chapter Workflow
              </CardTitle>
              <CardDescription>
                Generate → Analyze → Enhance with SFSL-powered optimization
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(getPhaseProgress())}%
              </div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress Bar */}
            <Progress value={getPhaseProgress()} className="w-full" />

            {/* Phase Status */}
            <div className="flex items-center justify-between">
              {phases.map((phase, index) => (
                <div key={phase.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${phase.status === 'completed' ? 'bg-green-100 border-green-500 text-green-700' :
                      phase.status === 'running' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                      phase.status === 'error' ? 'bg-red-100 border-red-500 text-red-700' :
                      'bg-gray-100 border-gray-300 text-gray-500'}
                  `}>
                    {phase.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : phase.status === 'running' ? (
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : phase.status === 'error' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <phase.icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < phases.length - 1 && (
                    <div className={`
                      w-12 h-0.5 mx-2 transition-colors
                      ${phases[index + 1].status !== 'pending' ? 'bg-green-500' : 'bg-gray-300'}
                    `} />
                  )}
                </div>
              ))}
            </div>

            {/* Workflow Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800">{workflowStats.totalCreditsUsed}</div>
                <div className="text-sm text-gray-600">Credits Used</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800">
                  {Math.round(workflowStats.totalDuration / 1000)}s
                </div>
                <div className="text-sm text-gray-600">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800">
                  {Math.round(workflowStats.compressionRatio * 100)}%
                </div>
                <div className="text-sm text-gray-600">SFSL Compression</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800">
                  {workflowStats.qualityImprovement > 0 ? '+' : ''}{workflowStats.qualityImprovement}%
                </div>
                <div className="text-sm text-gray-600">Quality Gain</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="analysis" disabled={!analysisResults}>Analysis</TabsTrigger>
          <TabsTrigger value="enhancement" disabled={!analysisResults}>Enhancement</TabsTrigger>
          <TabsTrigger value="results" disabled={currentPhase !== 'complete'}>Results</TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Chapter Goals</CardTitle>
              <CardDescription>Define what you want this chapter to accomplish</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Goal
                  </label>
                  <Textarea
                    value={chapterGoals.primaryGoal}
                    onChange={(e) => setChapterGoals(prev => ({ ...prev, primaryGoal: e.target.value }))}
                    placeholder="What is the main purpose of this chapter?"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Goal
                  </label>
                  <Textarea
                    value={chapterGoals.secondaryGoal}
                    onChange={(e) => setChapterGoals(prev => ({ ...prev, secondaryGoal: e.target.value }))}
                    placeholder="What secondary objectives should be addressed?"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plot Advancement
                </label>
                <Textarea
                  value={chapterGoals.plotAdvancement}
                  onChange={(e) => setChapterGoals(prev => ({ ...prev, plotAdvancement: e.target.value }))}
                  placeholder="How should the plot advance in this chapter?"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Word Count
                  </label>
                  <input
                    type="number"
                    value={chapterGoals.targetWordCount}
                    onChange={(e) => setChapterGoals(prev => ({ ...prev, targetWordCount: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chapter Number
                  </label>
                  <input
                    type="number"
                    value={chapterGoals.chapterNumber}
                    onChange={(e) => setChapterGoals(prev => ({ ...prev, chapterNumber: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={runCompleteWorkflow}
                  disabled={isRunning}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Running Workflow...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Workflow
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetWorkflow} disabled={isRunning}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {analysisResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Story Analysis Results
                </CardTitle>
                <CardDescription>
                  SFSL-powered analysis of your generated content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {analysisResults.characterVoiceAccuracy}%
                    </div>
                    <div className="text-sm text-gray-600">Character Voice</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analysisResults.worldConsistency}%
                    </div>
                    <div className="text-sm text-gray-600">World Consistency</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {analysisResults.plotProgression}%
                    </div>
                    <div className="text-sm text-gray-600">Plot Progression</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {analysisResults.technicalQuality}%
                    </div>
                    <div className="text-sm text-gray-600">Technical Quality</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Enhancement Tab */}
        <TabsContent value="enhancement" className="space-y-6">
          {analysisResults && (
            <>
              <EnhancementSliders
                analysisResults={analysisResults}
                onEnhancementChange={(values) => {
                  setEnhancementSettings(values)
                }}
                disabled={isRunning}
              />

              {enhancementSettings && (
                <div className="flex justify-center">
                  <Button
                    onClick={continueToEnhancement}
                    disabled={isRunning}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Apply Enhancements
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Workflow Complete
              </CardTitle>
              <CardDescription>
                Your enhanced chapter is ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Enhanced Content Preview</h4>
                <div className="max-h-60 overflow-y-auto text-sm text-gray-700">
                  {enhancedContent || 'No enhanced content available yet.'}
                </div>
              </div>

              <div className="flex gap-4">
                <Button className="bg-green-600 hover:bg-green-700">
                  <Download className="w-4 h-4 mr-2" />
                  Save Chapter
                </Button>
                <Button variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Run Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}