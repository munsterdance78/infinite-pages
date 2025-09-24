'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Database, Server, TestTube, RefreshCw, Flag, CheckCircle, XCircle } from 'lucide-react'
import { featureFlags, getFeatureFlagStatus, logFeatureFlags } from '@/lib/feature-flags'

// Import all V2.0 basic components
import {
  FactExtractionButtons,
  ThreePhaseWorkflowButtons,
  CharacterManagerButtons,
  WorldBuilderButtons,
  TimelineButtons,
  AnalyticsButtons
} from '@/components/basic'

interface TestingDashboardProps {}

export default function V2TestingDashboard({}: TestingDashboardProps) {
  const [databaseStatus, setDatabaseStatus] = useState<'unknown' | 'ready' | 'missing'>('unknown')
  const [serverStatus, setServerStatus] = useState<'unknown' | 'running' | 'error'>('unknown')
  const [testStoryId] = useState('test-story-v2')
  const [flagStatus, setFlagStatus] = useState<any>(null)

  useEffect(() => {
    // Set page title
    document.title = 'V2.0 Testing Dashboard - Infinite Pages'

    // Load feature flag status
    const status = getFeatureFlagStatus()
    setFlagStatus(status)
    logFeatureFlags()
  }, [])

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        setServerStatus('running')

        // Try to check if V2 tables exist by testing fact extraction
        const factTest = await fetch(`/api/stories/${testStoryId}/facts/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'test', factType: 'chapter', workflowPhase: 'analyze' })
        })

        if (factTest.status === 404 || factTest.status === 500) {
          setDatabaseStatus('missing')
        } else {
          setDatabaseStatus('ready')
        }
      } else {
        setServerStatus('error')
      }
    } catch (error) {
      setServerStatus('error')
      console.error('Status check failed:', error)
    }
  }

  React.useEffect(() => {
    checkDatabaseStatus()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': case 'running': return 'bg-green-100 text-green-800'
      case 'missing': case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            V2.0 Feature Testing Dashboard
          </h1>
          <p className="text-xl text-gray-600">
            Comprehensive testing interface for all infinite-pages V2.0 features
          </p>
        </div>

        {/* Status Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span className="font-medium">Server</span>
                </div>
                <Badge className={getStatusColor(serverStatus)}>
                  {serverStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="font-medium">V2.0 Database</span>
                </div>
                <Badge className={getStatusColor(databaseStatus)}>
                  {databaseStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-center">
                <Button onClick={checkDatabaseStatus} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            </div>

            {databaseStatus === 'missing' && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Database Migration Required</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      V2.0 database tables are not yet created. Please run the migration:
                    </p>
                    <ol className="text-sm text-yellow-700 mt-2 ml-4 list-decimal">
                      <li>Open Supabase Dashboard SQL Editor</li>
                      <li>Copy SQL from <code>docs/MIGRATION-GUIDE.md</code></li>
                      <li>Execute the migration SQL</li>
                      <li>Refresh this page to verify</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Testing Tabs */}
        <Tabs defaultValue="feature-flags" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
            <TabsTrigger value="feature-flags">Flags</TabsTrigger>
            <TabsTrigger value="fact-extraction">Facts</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="world">World</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Feature Flags Status */}
          <TabsContent value="feature-flags" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">V2.0 Feature Flag Status</h2>
              <p className="text-gray-600">Incremental rollout control for V2.0 features</p>
            </div>

            {flagStatus && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Flag className="w-5 h-5" />
                      Overall Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>Features Enabled:</span>
                        <Badge variant="outline">
                          {flagStatus.enabled}/{flagStatus.total} ({flagStatus.percentage}%)
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Core V2.0:</span>
                        {flagStatus.coreV2Enabled ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Partial
                          </Badge>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Advanced Features:</span>
                        {flagStatus.advancedEnabled ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Partial
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Core Features */}
                <Card>
                  <CardHeader>
                    <CardTitle>Core V2.0 Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(flagStatus.flags).slice(0, 6).map(([key, enabled]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          {enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Advanced Features */}
                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(flagStatus.flags).slice(6).map(([key, enabled]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          {enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Feature Flag Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    Features are controlled via environment variables in <code>.env.local</code>
                  </p>
                  <pre className="text-xs bg-gray-100 p-2 rounded">
{`# Core V2.0 Features
ENABLE_FACT_EXTRACTION=true
ENABLE_THREE_PHASE_WORKFLOW=true
ENABLE_SFSL_PROCESSING=true

# Advanced Features
ENABLE_ENHANCEMENT_SLIDERS=true
ENABLE_WORKFLOW_INTERFACE=true
ENABLE_STORY_ANALYSIS=true`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fact Extraction Testing */}
          <TabsContent value="fact-extraction" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">SFSL Fact Extraction System</h2>
              <p className="text-gray-600">Test hierarchical fact storage and extraction</p>
            </div>
            <FactExtractionButtons
              storyId={testStoryId}
              onFactsExtracted={(facts) => console.log('Facts extracted:', facts)}
            />
          </TabsContent>

          {/* Three-Phase Workflow Testing */}
          <TabsContent value="workflow" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Three-Phase Workflow System</h2>
              <p className="text-gray-600">Test Generate → Analyze → Enhance workflow</p>
            </div>
            <ThreePhaseWorkflowButtons
              storyId={testStoryId}
              onPhaseComplete={(phase, result) => console.log(`Phase ${phase} completed:`, result)}
            />
          </TabsContent>

          {/* Character Manager Testing */}
          <TabsContent value="characters" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Character Generation & Management</h2>
              <p className="text-gray-600">Test AI character creation and management</p>
            </div>
            <CharacterManagerButtons
              storyId={testStoryId}
              onCharacterCreated={(character) => console.log('Character created:', character)}
              onCharacterUpdated={(character) => console.log('Character updated:', character)}
            />
          </TabsContent>

          {/* World Builder Testing */}
          <TabsContent value="world" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">World Builder System</h2>
              <p className="text-gray-600">Test universe setup and world element creation</p>
            </div>
            <WorldBuilderButtons
              storyId={testStoryId}
              onWorldElementCreated={(element) => console.log('World element created:', element)}
            />
          </TabsContent>

          {/* Timeline Testing */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Timeline Visualization</h2>
              <p className="text-gray-600">Test timeline management and event tracking</p>
            </div>
            <TimelineButtons
              storyId={testStoryId}
              onTimelineUpdated={(events) => console.log('Timeline updated:', events)}
            />
          </TabsContent>

          {/* Analytics Testing */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
              <p className="text-gray-600">Test performance metrics and data visualization</p>
            </div>
            <AnalyticsButtons
              storyId={testStoryId}
              onDataLoaded={(data) => console.log('Analytics data loaded:', data)}
            />
          </TabsContent>
        </Tabs>

        {/* Testing Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Before Testing:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ensure database migration is complete</li>
                  <li>• Check that server status is "running"</li>
                  <li>• Open browser console to see detailed logs</li>
                  <li>• Test with story ID: <code>{testStoryId}</code></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Testing Tips:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Each tab tests a different V2.0 feature</li>
                  <li>• Watch console for detailed API responses</li>
                  <li>• Test both success and error scenarios</li>
                  <li>• Verify data persistence across refreshes</li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">API Endpoints Being Tested:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-gray-50 rounded">POST /api/stories/[id]/facts/extract</div>
                <div className="p-2 bg-gray-50 rounded">POST /api/stories/[id]/facts/optimize</div>
                <div className="p-2 bg-gray-50 rounded">POST /api/stories/[id]/chapters/generate</div>
                <div className="p-2 bg-gray-50 rounded">POST /api/stories/[id]/characters/generate</div>
                <div className="p-2 bg-gray-50 rounded">POST /api/stories/[id]/universe/setup</div>
                <div className="p-2 bg-gray-50 rounded">GET /api/stories/[id]/timeline</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pb-8">
          <p>V2.0 Testing Dashboard | Story ID: {testStoryId} | All components functional</p>
        </div>
      </div>
    </div>
  )
}