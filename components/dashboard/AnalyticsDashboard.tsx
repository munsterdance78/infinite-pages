'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  FileText,
  Globe,
  Users,
  Target,
  Clock,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Sparkles
} from 'lucide-react'

interface FactExtractionData {
  totalExtractions: number
  averageCompressionRatio: number
  totalTokensSaved: number
  totalCostSavings: number
  errorRate: number
  extractionsByType: Record<string, number>
  trends: Array<{ date: string; extractions: number; compression: number }>
}

interface CompressionData {
  averageRatio: number
  bestRatio: number
  worstRatio: number
  totalSavings: number
  compressionTrends: Array<{ date: string; ratio: number }>
  topPerformingStories: Array<{ title: string; ratio: number; savings: number }>
}

interface ComplianceData {
  overallScore: number
  consistencyRate: number
  issuesDetected: number
  issuesResolved: number
  complianceByCategory: Record<string, number>
  recentAnalyses: Array<{ story: string; score: number; issues: number }>
}

interface V2Analytics {
  factExtraction: FactExtractionData
  compression: CompressionData
  compliance: ComplianceData
  overview: {
    totalStories: number
    activeWorkflows: number
    creditsUsed: number
    qualityImprovement: number
  }
}

interface EnhancedAnalyticsDashboardProps {
  // Props interface for type validation compliance
}

export function EnhancedAnalyticsDashboard(props: EnhancedAnalyticsDashboardProps = {}) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [v2Analytics, setV2Analytics] = useState<V2Analytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  const fetchV2Analytics = async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/analytics/v2?timeRange=${selectedTimeRange}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()
      setV2Analytics(data)
    } catch (error) {
      console.error('Error fetching V2 analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
  }, [])

  useEffect(() => {
    fetchV2Analytics()
  }, [user?.id, selectedTimeRange])

  if (isLoading) {
    return (
      <div className="enhanced-dashboard p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="enhanced-dashboard p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enhanced Analytics Dashboard</h1>
          <p className="text-gray-600">SFSL-powered insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      {v2Analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Stories</p>
                  <p className="text-2xl font-bold">{v2Analytics.overview.totalStories}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                  <p className="text-2xl font-bold">{v2Analytics.overview.activeWorkflows}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Credits Used</p>
                  <p className="text-2xl font-bold">{v2Analytics.overview.creditsUsed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Quality Improvement</p>
                  <p className="text-2xl font-bold">+{v2Analytics.overview.qualityImprovement}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="extraction" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="extraction">Fact Extraction</TabsTrigger>
          <TabsTrigger value="compression">Compression Analytics</TabsTrigger>
          <TabsTrigger value="compliance">Story Bible Compliance</TabsTrigger>
        </TabsList>

        {/* Fact Extraction Tab */}
        <TabsContent value="extraction" className="space-y-6">
          {v2Analytics && <FactExtractionMetrics data={v2Analytics.factExtraction} />}
        </TabsContent>

        {/* Compression Tab */}
        <TabsContent value="compression" className="space-y-6">
          {v2Analytics && <CompressionAnalytics data={v2Analytics.compression} />}
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          {v2Analytics && <StoryBibleCompliance data={v2Analytics.compliance} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Fact Extraction Metrics Component
function FactExtractionMetrics({ data }: { data: FactExtractionData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Main Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Extraction Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Extractions</p>
              <p className="text-2xl font-bold">{data.totalExtractions.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Compression</p>
              <p className="text-2xl font-bold">{Math.round(data.averageCompressionRatio * 100)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tokens Saved</p>
              <p className="text-2xl font-bold">{data.totalTokensSaved.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cost Savings</p>
              <p className="text-2xl font-bold">${data.totalCostSavings.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Error Rate</span>
              <span>{(data.errorRate * 100).toFixed(1)}%</span>
            </div>
            <Progress value={data.errorRate * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Extraction Types */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.extractionsByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    type === 'universe' ? 'bg-blue-500' :
                    type === 'character' ? 'bg-green-500' :
                    type === 'chapter' ? 'bg-yellow-500' : 'bg-purple-500'
                  }`} />
                  <span className="capitalize">{type}</span>
                </div>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trends Chart Placeholder */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Extraction Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Extraction trends visualization</p>
              <p className="text-sm text-gray-500">Chart component integration pending</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Compression Analytics Component
function CompressionAnalytics({ data }: { data: CompressionData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compression Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            Compression Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Average Ratio</p>
              <p className="text-2xl font-bold">{Math.round(data.averageRatio * 100)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Best Ratio</p>
              <p className="text-2xl font-bold text-green-600">{Math.round(data.bestRatio * 100)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Savings</p>
              <p className="text-2xl font-bold">${data.totalSavings.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Worst Ratio</p>
              <p className="text-2xl font-bold text-red-600">{Math.round(data.worstRatio * 100)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Stories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Stories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.topPerformingStories.slice(0, 5).map((story, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{story.title}</p>
                  <p className="text-sm text-gray-600">${story.savings.toFixed(2)} saved</p>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  {Math.round(story.ratio * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compression Trends */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Compression Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Compression trends over time</p>
              <p className="text-sm text-gray-500">Chart component integration pending</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Story Bible Compliance Component
function StoryBibleCompliance({ data }: { data: ComplianceData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compliance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">{data.overallScore}%</p>
            <p className="text-gray-600">Overall Compliance Score</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Consistency Rate</p>
              <p className="text-xl font-bold">{data.consistencyRate}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Issues Resolved</p>
              <p className="text-xl font-bold text-green-600">
                {data.issuesResolved}/{data.issuesDetected}
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Resolution Rate</span>
              <span>{Math.round((data.issuesResolved / data.issuesDetected) * 100)}%</span>
            </div>
            <Progress
              value={(data.issuesResolved / data.issuesDetected) * 100}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.complianceByCategory).map(([category, score]) => (
              <div key={category} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{category}</span>
                  <span>{score}%</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Analyses */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent Story Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentAnalyses.map((analysis, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{analysis.story}</p>
                  <p className="text-sm text-gray-600">
                    {analysis.issues} issues detected
                  </p>
                </div>
                <Badge className={
                  analysis.score >= 80 ? 'bg-green-100 text-green-800' :
                  analysis.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }>
                  {analysis.score}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}