'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Loader2, 
  Play, 
  Square, 
  Zap, 
  Database, 
  BarChart3, 
  FileText,
  Settings,
  RefreshCw,
  Download
} from 'lucide-react'
import {
  claudeService,
  claudeCache,
  batchProcessor,
  analyticsService,
  promptTemplateManager
} from '@/lib/claude'
import { useClaudeStreaming, useClaude } from '@/lib/claude/hooks'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default function ClaudeAdvancedExamples() {
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({})
  const [batchResults, setBatchResults] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [cacheStats, setCacheStats] = useState<any>(null)

  // Streaming hook
  const {
    isStreaming,
    content,
    error,
    usage,
    cost,
    streamStoryFoundation,
    stopStream,
    reset
  } = useClaudeStreaming()

  // Regular hook
  const {
    isLoading,
    error: claudeError,
    executeClaudeOperation,
    clearError
  } = useClaude()

  // Example 1: Template-based generation
  const handleTemplateGeneration = async () => {
    if (!selectedTemplate) return

    const result = await executeClaudeOperation(async () => {
      return await claudeService.generateWithTemplate(
        selectedTemplate,
        Object.entries(templateVariables).map(([name, value]) => ({ name, value })),
        {
          userId: 'example-user',
          useCache: true,
          trackAnalytics: true
        }
      )
    })

    if (result) {
      console.log('Template generation result:', result)
    }
  }

  // Example 2: Batch processing
  const handleBatchProcessing = async () => {
    const batchPrompts = [
      {
        id: 'batch-1',
        prompt: 'Write a short story about a robot learning to paint.',
        userId: 'example-user',
        operation: 'story_generation'
      },
      {
        id: 'batch-2',
        prompt: 'Analyze the themes in the story about the robot.',
        userId: 'example-user',
        operation: 'analysis'
      },
      {
        id: 'batch-3',
        prompt: 'Improve the dialogue in the robot story.',
        userId: 'example-user',
        operation: 'improvement'
      }
    ]

    const results = await executeClaudeOperation(async () => {
      return await claudeService.batchGenerate(batchPrompts, {
        useCache: true,
        trackAnalytics: true
      })
    })

    if (results) {
      setBatchResults(results)
      console.log('Batch processing results:', results)
    }
  }

  // Example 3: Analytics and cache management
  const loadAnalytics = async () => {
    const analyticsData = await executeClaudeOperation(async () => {
      return await claudeService.getAnalytics({
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      })
    })

    if (analyticsData) {
      setAnalytics(analyticsData)
    }
  }

  const loadCacheStats = async () => {
    const stats = claudeService.getCacheStats()
    setCacheStats(stats)
  }

  // Example 4: Cache management
  const clearCache = () => {
    claudeService.clearCache()
    loadCacheStats()
  }

  // Example 5: Template management
  const templates = promptTemplateManager.getAllTemplates()
  const templateCategories = promptTemplateManager.getTemplateStats()

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Advanced Claude Integration Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="templates" className="space-y-4">
            <TabsList>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="batch">Batch Processing</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="cache">Cache Management</TabsTrigger>
              <TabsTrigger value="streaming">Streaming</TabsTrigger>
            </TabsList>

            {/* Template-based Generation */}
            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template-based Generation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Select Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full p-2 border rounded-md mt-1"
                    >
                      <option value="">Choose a template...</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div>
                      <label className="text-sm font-medium">Template Variables</label>
                      <div className="space-y-2 mt-2">
                        {templates
                          .find(t => t.id === selectedTemplate)
                          ?.variables.map((variable) => (
                            <div key={variable.name}>
                              <label className="text-xs text-gray-600">
                                {variable.name} {variable.required && '*'}
                              </label>
                              <Input
                                value={templateVariables[variable.name] || ''}
                                onChange={(e) => setTemplateVariables(prev => ({
                                  ...prev,
                                  [variable.name]: e.target.value
                                }))}
                                placeholder={variable.description}
                                className="mt-1"
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleTemplateGeneration}
                    disabled={isLoading || !selectedTemplate}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Generate with Template
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {templateCategories.totalTemplates}
                      </div>
                      <div className="text-sm text-gray-600">Total Templates</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Object.keys(templateCategories.templatesByCategory).length}
                      </div>
                      <div className="text-sm text-gray-600">Categories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {templateCategories.averageRating.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">Avg Rating</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Batch Processing */}
            <TabsContent value="batch" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Batch Processing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Process multiple prompts simultaneously with automatic load balancing and caching.
                  </p>
                  
                  <Button
                    onClick={handleBatchProcessing}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Process Batch (3 operations)
                  </Button>

                  {batchResults && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Batch Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(Array.from(batchResults.entries()) as [string, any][]).map(([id, result]) => (
                            <div key={id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <div className="font-medium">{id}</div>
                                <div className="text-sm text-gray-600">
                                  {result.success ? 'Success' : 'Failed'}
                                  {result.cached && ' (Cached)'}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {result.success ? formatCurrency(result.cost || 0) : 'N/A'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {result.success ? `${result.usage?.totalTokens || 0} tokens` : result.error}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics */}
            <TabsContent value="analytics" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analytics Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={loadAnalytics}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Load Analytics
                  </Button>

                  {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{formatNumber(analytics.totalRequests)}</div>
                          <div className="text-sm text-gray-600">Total Requests</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{formatCurrency(analytics.totalCost)}</div>
                          <div className="text-sm text-gray-600">Total Cost</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{(analytics.successRate * 100).toFixed(1)}%</div>
                          <div className="text-sm text-gray-600">Success Rate</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{analytics.averageResponseTime.toFixed(0)}ms</div>
                          <div className="text-sm text-gray-600">Avg Response</div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {analytics && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Model Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(analytics.modelUsage).map(([model, usage]: [string, any]) => (
                              <div key={model} className="flex justify-between">
                                <span className="text-sm">{model}</span>
                                <div className="flex gap-2">
                                  <Badge variant="outline">{usage.requests}</Badge>
                                  <Badge variant="secondary">{formatCurrency(usage.cost)}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Operation Types</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(analytics.operationUsage).map(([operation, usage]: [string, any]) => (
                              <div key={operation} className="flex justify-between">
                                <span className="text-sm capitalize">{operation.replace('_', ' ')}</span>
                                <div className="flex gap-2">
                                  <Badge variant="outline">{usage.requests}</Badge>
                                  <Badge variant="secondary">{formatCurrency(usage.cost)}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cache Management */}
            <TabsContent value="cache" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Cache Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={loadCacheStats}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh Stats
                    </Button>
                    <Button
                      onClick={clearCache}
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      <Database className="h-4 w-4" />
                      Clear Cache
                    </Button>
                  </div>

                  {cacheStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {cacheStats.size} / {cacheStats.maxSize}
                          </div>
                          <div className="text-sm text-gray-600">Cache Size</div>
                          <Progress value={(cacheStats.size / cacheStats.maxSize) * 100} className="mt-2" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">
                            {(cacheStats.hitRate * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">Hit Rate</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold">{formatCurrency(cacheStats.totalCost)}</div>
                          <div className="text-sm text-gray-600">Cached Value</div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {cacheStats && cacheStats.entries.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Top Cached Entries</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {cacheStats.entries.slice(0, 5).map((entry: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-2 border rounded">
                              <div>
                                <div className="font-medium text-sm">{entry.operation}</div>
                                <div className="text-xs text-gray-600">
                                  Age: {entry.age}s • Expires: {entry.expiresIn}s
                                </div>
                              </div>
                              <Badge variant="outline">{formatCurrency(entry.cost)}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Streaming */}
            <TabsContent value="streaming" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Real-time Streaming</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => streamStoryFoundation({
                      title: 'The Future of AI',
                      genre: 'Science Fiction',
                      premise: 'A story about AI achieving consciousness'
                    })}
                    disabled={isStreaming}
                    className="flex items-center gap-2"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isStreaming ? 'Generating...' : 'Generate Story Foundation'}
                  </Button>

                  {isStreaming && (
                    <Button
                      onClick={stopStream}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop Generation
                    </Button>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  )}

                  {content && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Live Preview</CardTitle>
                        {usage && (
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>Tokens: {usage.totalTokens}</span>
                            <span>Cost: {formatCurrency(cost || 0)}</span>
                          </div>
                        )}
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}




