'use client'

import React, { useState } from 'react'
import { claudeService } from '@/lib/claude'
import { useClaudeStreaming, useClaude } from '@/lib/claude/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Square } from 'lucide-react'

export default function ClaudeExamples() {
  const [prompt, setPrompt] = useState('Write a short story about a robot learning to paint.')
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  // Streaming hook for real-time content generation
  const {
    isStreaming,
    content,
    error,
    usage,
    cost,
    stopStream,
    reset: resetStream
  } = useClaudeStreaming({
    onComplete: (response) => {
      console.log('Streaming completed:', response)
    },
    onError: (error) => {
      console.error('Streaming error:', error)
    }
  })

  // Regular hook for non-streaming operations
  const {
    isLoading,
    error: claudeError,
    executeClaudeOperation,
    clearError
  } = useClaude()

  // Example 1: Basic streaming content generation
  const handleStreamingGeneration = async () => {
    resetStream()
    
    // Use the streaming service directly
    const generator = claudeService.generateContent({
      prompt,
      maxTokens: 1000
    })

    // Note: This is a simplified example. In practice, you'd use the hook
    // or implement the streaming logic in your component
  }

  // Example 2: Content analysis using regular service
  const handleAnalyzeContent = async () => {
    const result = await executeClaudeOperation(async () => {
      return await claudeService.analyzeContent(content || prompt)
    })

    if (result) {
      setAnalysisResult(result)
    }
  }

  // Example 3: Story foundation generation
  const handleGenerateStoryFoundation = async () => {
    resetStream()
    
    // This would typically be called from a form with user input
    const generator = claudeService.generateStoryFoundation({
      title: 'The Last Library',
      genre: 'Fantasy',
      premise: 'In a world where books are illegal, a librarian discovers the last hidden library and must protect its secrets.'
    })

    // In a real implementation, you'd use the streaming hook:
    // await streamStoryFoundation({ title, genre, premise })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Claude Integration Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Example 1: Basic Content Generation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">1. Basic Content Generation</h3>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              rows={3}
              disabled={isStreaming}
            />
            
            <div className="flex gap-2">
              <Button
                onClick={handleStreamingGeneration}
                disabled={isStreaming || !prompt.trim()}
                className="flex items-center gap-2"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Generate Content
              </Button>
              
              {isStreaming && (
                <Button onClick={stopStream} variant="outline">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>

            {/* Status Display */}
            <div className="flex gap-4 items-center">
              {isStreaming && (
                <Badge variant="secondary">Generating...</Badge>
              )}
              {usage && (
                <>
                  <Badge variant="outline">
                    Tokens: {usage.totalTokens}
                  </Badge>
                  <Badge variant="outline">
                    Cost: ${cost?.toFixed(4) || '0.0000'}
                  </Badge>
                </>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Generated Content */}
            {content && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Generated Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Example 2: Content Analysis */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">2. Content Analysis</h3>
            <Button
              onClick={handleAnalyzeContent}
              disabled={isLoading || !content}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Analyze Content
            </Button>

            {claudeError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{claudeError}</p>
                <Button 
                  onClick={clearError} 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                >
                  Clear Error
                </Button>
              </div>
            )}

            {analysisResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Analysis Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <strong>Overall Quality:</strong> 
                    <Badge variant="secondary" className="ml-2">
                      {analysisResult.overallQuality}
                    </Badge>
                  </div>
                  
                  {analysisResult.strengths && (
                    <div>
                      <strong>Strengths:</strong>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {analysisResult.strengths.map((strength: string, index: number) => (
                          <li key={index}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysisResult.areasForImprovement && (
                    <div>
                      <strong>Areas for Improvement:</strong>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {analysisResult.areasForImprovement.map((area: string, index: number) => (
                          <li key={index}>{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysisResult.suggestions && (
                    <div>
                      <strong>Suggestions:</strong>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {analysisResult.suggestions.map((suggestion: string, index: number) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Example 3: Story Foundation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">3. Story Foundation Generation</h3>
            <Button
              onClick={handleGenerateStoryFoundation}
              disabled={isStreaming}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Generate Story Foundation
            </Button>
            <p className="text-sm text-gray-600">
              This would generate a complete story foundation with characters, plot structure, themes, and chapter outline.
            </p>
          </div>

          {/* Usage Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Use in Your Components</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>For Streaming Content:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
{`import { useClaudeStreaming } from '@/lib/claude'

const { streamStoryFoundation, isStreaming, content } = useClaudeStreaming()

await streamStoryFoundation({ title, genre, premise })`}
                  </pre>
                </div>
                
                <div>
                  <strong>For Regular Operations:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
{`import { useClaude } from '@/lib/claude'

const { executeClaudeOperation, isLoading } = useClaude()

const result = await executeClaudeOperation(async () => {
  return await claudeService.analyzeContent(content)
})`}
                  </pre>
                </div>
                
                <div>
                  <strong>Direct Service Usage:</strong>
                  <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
{`import { claudeService } from '@/lib/claude'

const response = await claudeService.generateContent({
  prompt: 'Your prompt here',
  maxTokens: 1000
})`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  )
}




