'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Search,
  Sparkles,
  CheckCircle,
  Clock,
  ArrowRight,
  Zap,
  Brain,
  Wand2
} from 'lucide-react'

interface WorkflowPhase {
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  description: string
}

interface ThreePhaseWorkflowButtonsProps {
  storyId?: string
  onPhaseComplete?: (phase: string, result: any) => void
}

export default function ThreePhaseWorkflowButtons({
  storyId,
  onPhaseComplete
}: ThreePhaseWorkflowButtonsProps) {
  const [phases, setPhases] = useState<WorkflowPhase[]>([
    {
      name: 'Generate',
      status: 'pending',
      progress: 0,
      description: 'Create initial story content'
    },
    {
      name: 'Analyze',
      status: 'pending',
      progress: 0,
      description: 'Extract facts and analyze structure'
    },
    {
      name: 'Enhance',
      status: 'pending',
      progress: 0,
      description: 'Improve and optimize content'
    }
  ])

  const [currentPhase, setCurrentPhase] = useState<number | null>(null)
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const updatePhaseStatus = (phaseIndex: number, status: WorkflowPhase['status'], progress = 0) => {
    setPhases(prev => prev.map((phase, index) =>
      index === phaseIndex
        ? { ...phase, status, progress }
        : phase
    ))
  }

  const runPhase = async (phaseIndex: number) => {
    const phase = phases[phaseIndex]
    setCurrentPhase(phaseIndex)
    updatePhaseStatus(phaseIndex, 'running', 0)

    try {
      // Set initial progress
      updatePhaseStatus(phaseIndex, 'running', 10)

      let endpoint = ''
      let payload = {}

      switch (phase.name) {
        case 'Generate':
          endpoint = `/api/stories/${storyId || 'demo'}/chapters/generate`
          payload = {
            workflowPhase: 'generate',
            enhancementSettings: { characterVoice: 80, plotComplexity: 70 }
          }
          break
        case 'Analyze':
          endpoint = `/api/stories/${storyId || 'demo'}/facts/extract`
          payload = {
            content: 'Generated story content to analyze',
            factType: 'chapter',
            workflowPhase: 'analyze'
          }
          break
        case 'Enhance':
          endpoint = `/api/stories/${storyId || 'demo'}/facts/optimize`
          payload = {
            factType: 'character',
            hierarchicalLevel: 'chapter',
            workflowPhase: 'enhance'
          }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Phase ${phase.name} failed: ${response.status}`)
      }

      const result = await response.json()

      updatePhaseStatus(phaseIndex, 'completed', 100)

      setResults(prev => [...prev, {
        phase: phase.name,
        timestamp: new Date().toISOString(),
        result
      }])

      onPhaseComplete?.(phase.name, result)

      console.log(`✅ Phase ${phase.name} completed:`, result)

    } catch (error) {
      console.error(`❌ Phase ${phase.name} error:`, error)
      updatePhaseStatus(phaseIndex, 'error', 0)
    }
  }

  const runSinglePhase = async (phaseIndex: number) => {
    if (workflowRunning) return

    setWorkflowRunning(true)
    await runPhase(phaseIndex)
    setCurrentPhase(null)
    setWorkflowRunning(false)
  }

  const runFullWorkflow = async () => {
    if (workflowRunning) return

    setWorkflowRunning(true)
    setResults([])

    // Reset all phases
    setPhases(prev => prev.map(phase => ({
      ...phase,
      status: 'pending',
      progress: 0
    })))

    // Run phases sequentially
    for (let i = 0; i < phases.length; i++) {
      await runPhase(i)

      // Check if phase failed
      if (phases[i].status === 'error') {
        break
      }

      // Short delay between phases
      if (i < phases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setCurrentPhase(null)
    setWorkflowRunning(false)
  }

  const resetWorkflow = () => {
    setPhases(prev => prev.map(phase => ({
      ...phase,
      status: 'pending',
      progress: 0
    })))
    setCurrentPhase(null)
    setWorkflowRunning(false)
    setResults([])
  }

  const getPhaseIcon = (phase: WorkflowPhase) => {
    switch (phase.name) {
      case 'Generate': return <Wand2 className="h-4 w-4" />
      case 'Analyze': return <Brain className="h-4 w-4" />
      case 'Enhance': return <Sparkles className="h-4 w-4" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: WorkflowPhase['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700'
      case 'running': return 'bg-blue-100 text-blue-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'error': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Three-Phase AI Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workflow Control Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runFullWorkflow}
            disabled={workflowRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {workflowRunning ? 'Running Workflow...' : 'Run Full Workflow'}
          </Button>

          <Button
            onClick={resetWorkflow}
            disabled={workflowRunning}
            variant="outline"
          >
            Reset All
          </Button>
        </div>

        {/* Phase Cards */}
        <div className="space-y-4">
          {phases.map((phase, index) => (
            <Card key={phase.name} className={`border-2 ${
              currentPhase === index ? 'border-blue-300' : 'border-gray-200'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getPhaseIcon(phase)}
                    <div>
                      <h3 className="font-medium">{phase.name}</h3>
                      <p className="text-sm text-gray-600">{phase.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(phase.status)}>
                      {phase.status === 'running' && <Clock className="h-3 w-3 mr-1" />}
                      {phase.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {phase.status.charAt(0).toUpperCase() + phase.status.slice(1)}
                    </Badge>

                    <Button
                      size="sm"
                      onClick={() => runSinglePhase(index)}
                      disabled={workflowRunning}
                      variant="outline"
                    >
                      Run Phase
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                {phase.status === 'running' && (
                  <div className="space-y-1">
                    <Progress value={phase.progress} className="h-2" />
                    <p className="text-xs text-gray-500">{phase.progress}% complete</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Results Display */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Workflow Results</h3>
            <div className="space-y-2">
              {results.map((result, index) => (
                <Card key={index} className="p-3 bg-green-50 border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700">
                      {result.phase} Phase Completed
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </Badge>
                  </div>
                  {result.result && (
                    <p className="text-sm text-gray-600 mt-1">
                      {JSON.stringify(result.result).substring(0, 100)}...
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} |
          V2.0 Three-Phase Workflow System |
          Active Phase: {currentPhase !== null ? phases[currentPhase].name : 'None'}
        </div>
      </CardContent>
    </Card>
  )
}