'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Brain, FileText, Zap, CheckCircle, AlertCircle } from 'lucide-react'

interface FactExtractionButtonsProps {
  storyId?: string
  onFactsExtracted?: (facts: any[]) => void
}

export default function FactExtractionButtons({
  storyId,
  onFactsExtracted
}: FactExtractionButtonsProps) {
  const [content, setContent] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFacts, setExtractedFacts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleExtractFacts = async () => {
    if (!content.trim()) {
      setError('Please enter content to extract facts from')
      return
    }

    setIsExtracting(true)
    setError(null)

    try {
      const response = await fetch(`/api/stories/${storyId || 'demo'}/facts/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          factType: 'chapter',
          workflowPhase: 'analyze'
        })
      })

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.status}`)
      }

      const result = await response.json()
      const facts = result.facts || []

      setExtractedFacts(facts)
      onFactsExtracted?.(facts)

      console.log('✅ Facts extracted:', facts)
    } catch (err) {
      console.error('❌ Fact extraction error:', err)
      setError(err instanceof Error ? err.message : 'Failed to extract facts')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleOptimizeFacts = async () => {
    setIsExtracting(true)
    setError(null)

    try {
      const response = await fetch(`/api/stories/${storyId || 'demo'}/facts/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          factType: 'character',
          hierarchicalLevel: 'chapter',
          workflowPhase: 'optimize'
        })
      })

      if (!response.ok) {
        throw new Error(`Optimization failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Facts optimized:', result)
    } catch (err) {
      console.error('❌ Fact optimization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to optimize facts')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleClearFacts = () => {
    setExtractedFacts([])
    setContent('')
    setError(null)
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          SFSL Fact Extraction System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Area */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Content to Analyze</label>
          <Textarea
            placeholder="Enter story content, chapter text, or character descriptions to extract facts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleExtractFacts}
            disabled={isExtracting || !content.trim()}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {isExtracting ? 'Extracting...' : 'Extract Facts'}
          </Button>

          <Button
            onClick={handleOptimizeFacts}
            disabled={isExtracting}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Optimize Facts
          </Button>

          <Button
            onClick={handleClearFacts}
            disabled={isExtracting}
            variant="ghost"
            className="flex items-center gap-2"
          >
            Clear All
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Results Display */}
        {extractedFacts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                Extracted {extractedFacts.length} facts
              </span>
            </div>

            <div className="grid gap-2">
              {extractedFacts.map((fact, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {fact.type || 'fact'}
                        </Badge>
                        {fact.confidence && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(fact.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{fact.content || fact.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} |
          V2.0 SFSL Fact Extraction System |
          Status: {isExtracting ? 'Processing...' : 'Ready'}
        </div>
      </CardContent>
    </Card>
  )
}