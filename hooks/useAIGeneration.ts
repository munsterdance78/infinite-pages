'use client'

import { useState, useCallback } from 'react'
import { estimateOperationCost, getOperationComplexity, type AIOperation } from '@/lib/ai-cost-calculator'

interface GenerationState {
  stage: 'idle' | 'estimating' | 'processing' | 'completed' | 'error'
  tokensUsed: number
  estimate: ReturnType<typeof estimateOperationCost> | null
  actualResults: {
    inputTokens: number
    outputTokens: number
    actualCost: number
    chargedAmount: number
    generationTime: number
  } | null
  error: string | null
}

interface UseAIGenerationOptions {
  operation: Omit<AIOperation, 'complexity'>
  contentLength?: number
  customPrompt?: string
}

interface GenerationResult {
  success: boolean
  data?: any
  tokensUsed?: number
  cost?: number
}

export function useAIGeneration({ operation, contentLength, customPrompt }: UseAIGenerationOptions) {
  const [state, setState] = useState<GenerationState>({
    stage: 'idle',
    tokensUsed: 0,
    estimate: null,
    actualResults: null,
    error: null
  })

  const generateEstimate = useCallback(() => {
    setState(prev => ({ ...prev, stage: 'estimating' }))

    const complexity = getOperationComplexity(operation.type, contentLength, customPrompt)
    const fullOperation: AIOperation = { ...operation, complexity }
    const estimate = estimateOperationCost(fullOperation)

    setState(prev => ({
      ...prev,
      stage: 'idle',
      estimate
    }))

    return estimate
  }, [operation, contentLength, customPrompt])

  const trackUsage = useCallback(async (
    inputTokens: number,
    outputTokens: number,
    modelUsed: string,
    generationTimeSeconds: number,
    storyId?: string,
    chapterId?: string
  ) => {
    try {
      const response = await fetch('/api/ai-usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_type: operation.type,
          tokens_input: inputTokens,
          tokens_output: outputTokens,
          ai_model_used: modelUsed,
          story_id: storyId,
          chapter_id: chapterId,
          generation_time_seconds: generationTimeSeconds
        })
      })

      const result = await response.json()

      if (response.ok) {
        return {
          actualCost: result.actual_cost,
          chargedAmount: result.charged_amount
        }
      } else {
        console.error('Usage tracking failed:', result.error)
        return null
      }
    } catch (error) {
      console.error('Usage tracking error:', error)
      return null
    }
  }, [operation.type])

  const executeGeneration = useCallback(async (
    generationFunction: () => Promise<GenerationResult>,
    storyId?: string,
    chapterId?: string
  ) => {
    const startTime = Date.now()

    setState(prev => ({
      ...prev,
      stage: 'processing',
      tokensUsed: 0,
      actualResults: null,
      error: null
    }))

    try {
      // Simulate progressive token usage (in a real implementation, this would come from the API)
      const updateInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          tokensUsed: prev.tokensUsed + Math.floor(Math.random() * 50) + 10
        }))
      }, 500)

      const result = await generationFunction()
      clearInterval(updateInterval)

      const endTime = Date.now()
      const generationTimeSeconds = Math.floor((endTime - startTime) / 1000)

      if (result.success && result.tokensUsed) {
        // Extract token usage from result (this depends on your API structure)
        const inputTokens = Math.floor(result.tokensUsed * 0.3) // Estimate 30% input
        const outputTokens = Math.floor(result.tokensUsed * 0.7) // Estimate 70% output

        // Track the usage
        const costData = await trackUsage(
          inputTokens,
          outputTokens,
          'claude-3-sonnet', // Default model
          generationTimeSeconds,
          storyId,
          chapterId
        )

        setState(prev => ({
          ...prev,
          stage: 'completed',
          tokensUsed: result.tokensUsed || 0,
          actualResults: costData ? {
            inputTokens,
            outputTokens,
            actualCost: costData.actualCost,
            chargedAmount: costData.chargedAmount,
            generationTime: generationTimeSeconds
          } : null
        }))

        return result

      } else {
        setState(prev => ({
          ...prev,
          stage: 'error',
          error: 'Generation failed - no charges applied'
        }))

        return result
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }))

      throw error
    }
  }, [trackUsage])

  const reset = useCallback(() => {
    setState({
      stage: 'idle',
      tokensUsed: 0,
      estimate: null,
      actualResults: null,
      error: null
    })
  }, [])

  return {
    state,
    generateEstimate,
    executeGeneration,
    trackUsage,
    reset
  }
}