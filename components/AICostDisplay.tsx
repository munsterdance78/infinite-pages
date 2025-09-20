'use client'

import React, { useState, useEffect } from 'react'
import { estimateOperationCost, getCostDisplayString, getProcessingDisplayString, getCompletedDisplayString, formatCost, formatTokens, type AIOperation, type CostBreakdown } from '@/lib/ai-cost-calculator'

interface AICostDisplayProps {
  operation: AIOperation
  stage: 'estimate' | 'processing' | 'completed' | 'error'
  tokensUsed?: number
  actualResults?: {
    inputTokens: number
    outputTokens: number
    actualCost: number
    chargedAmount: number
    generationTime: number
  }
  onProceed?: () => void
  showMarketComparison?: boolean
}

export default function AICostDisplay({
  operation,
  stage,
  tokensUsed = 0,
  actualResults,
  onProceed,
  showMarketComparison = true
}: AICostDisplayProps) {
  const [costEstimate, setCostEstimate] = useState<CostBreakdown | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (stage === 'estimate') {
      const estimate = estimateOperationCost(operation)
      setCostEstimate(estimate)
    }
  }, [operation, stage])

  useEffect(() => {
    if (stage === 'completed' && actualResults) {
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setAutoHideTimer(null)
      }, 5000)
      setAutoHideTimer(timer)
    }

    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer)
      }
    }
  }, [stage, actualResults])

  const getStageDisplay = () => {
    switch (stage) {
      case 'estimate':
        return costEstimate ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm font-medium">Estimated Cost:</span>
            </div>
            <div className="text-sm text-gray-700">
              {getCostDisplayString(costEstimate)}
            </div>
          </div>
        ) : null

      case 'processing':
        return (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Processing:</span>
            </div>
            <div className="text-sm text-gray-700">
              {getProcessingDisplayString(tokensUsed)}
            </div>
          </div>
        )

      case 'completed':
        return actualResults ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm font-medium">Completed:</span>
            </div>
            <div className="text-sm text-gray-700">
              {getCompletedDisplayString(
                actualResults.inputTokens,
                actualResults.outputTokens,
                actualResults.actualCost,
                actualResults.chargedAmount
              )}
            </div>
            <div className="text-xs text-gray-500">
              ({actualResults.generationTime}s)
            </div>
          </div>
        ) : null

      case 'error':
        return (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-sm font-medium text-red-600">Generation failed - No charge</span>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (stage === 'completed' && autoHideTimer === null) {
    return null // Auto-hidden after 5 seconds
  }

  return (
    <div className={`ai-cost-display p-3 rounded-lg border ${
      stage === 'error' ? 'border-red-200 bg-red-50' :
      stage === 'completed' ? 'border-green-200 bg-green-50' :
      stage === 'processing' ? 'border-yellow-200 bg-yellow-50' :
      'border-blue-200 bg-blue-50'
    }`}>
      {getStageDisplay()}

      {/* Detailed Breakdown */}
      {(stage === 'estimate' || stage === 'completed') && (costEstimate || actualResults) && (
        <div className="mt-2">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showBreakdown ? 'Hide details' : 'Show cost breakdown'}
          </button>

          {showBreakdown && (
            <div className="mt-2 text-xs space-y-1 bg-white p-3 rounded border">
              {stage === 'estimate' && costEstimate && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Input tokens:</span>
                    <span>{formatTokens(costEstimate.estimatedInputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output tokens:</span>
                    <span>{formatTokens(costEstimate.estimatedOutputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Model:</span>
                    <span>{costEstimate.modelUsed}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>Actual API cost:</span>
                    <span>{formatCost(costEstimate.actualCostUSD)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Our markup (+{costEstimate.markupPercentage}%):</span>
                    <span>{formatCost(costEstimate.chargedAmountUSD - costEstimate.actualCostUSD)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>You pay:</span>
                    <span>{formatCost(costEstimate.chargedAmountUSD)}</span>
                  </div>

                  {showMarketComparison && costEstimate.savingsVsMarket > 0 && (
                    <div className="mt-2 p-2 bg-green-100 rounded">
                      <div className="text-green-800 font-medium">
                        💰 You save {costEstimate.savingsVsMarket}% vs market rate
                      </div>
                      <div className="text-green-600 text-xs">
                        Other platforms charge much more for this operation
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stage === 'completed' && actualResults && (
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Actual input tokens:</span>
                    <span>{formatTokens(actualResults.inputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual output tokens:</span>
                    <span>{formatTokens(actualResults.outputTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Generation time:</span>
                    <span>{actualResults.generationTime}s</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>API cost:</span>
                    <span>{formatCost(actualResults.actualCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Infrastructure (+20%):</span>
                    <span>{formatCost(actualResults.chargedAmount - actualResults.actualCost)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Total charged:</span>
                    <span>{formatCost(actualResults.chargedAmount)}</span>
                  </div>
                </div>
              )}

              {/* Why do we charge explanation */}
              <div className="mt-3 p-2 bg-gray-100 rounded">
                <div className="text-gray-700 font-medium text-xs mb-1">
                  💡 Why we add 20% markup:
                </div>
                <div className="text-gray-600 text-xs space-y-1">
                  <div>• Server infrastructure costs</div>
                  <div>• API reliability and monitoring</div>
                  <div>• Platform development & maintenance</div>
                  <div>• Much lower than competitors (60%+ savings)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate/Proceed Button */}
      {stage === 'estimate' && onProceed && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            Ready to proceed?
          </div>
          <button
            onClick={onProceed}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Generate ({costEstimate ? formatCost(costEstimate.chargedAmountUSD) : '...'})
          </button>
        </div>
      )}
    </div>
  )
}