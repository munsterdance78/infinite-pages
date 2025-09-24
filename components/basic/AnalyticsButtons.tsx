'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  TrendingUp,
  Users,
  Clock,
  Download,
  RefreshCw,
  Eye
} from 'lucide-react'

interface AnalyticsData {
  totalStories: number
  totalChapters: number
  totalWords: number
  avgWordsPerChapter: number
  recentActivity: any[]
}

interface AnalyticsButtonsProps {
  storyId?: string
  onDataLoaded?: (data: AnalyticsData) => void
}

export default function AnalyticsButtons({
  storyId,
  onDataLoaded
}: AnalyticsButtonsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      // Fetch real analytics data from API
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyId })
      })

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`)
      }

      const analyticsData: AnalyticsData = await response.json()

      setData(analyticsData)
      onDataLoaded?.(analyticsData)
    } catch (error) {
      console.error('Analytics error:', error)
      // Fallback to basic data if API fails
      const fallbackData: AnalyticsData = {
        totalStories: 0,
        totalChapters: 0,
        totalWords: 0,
        avgWordsPerChapter: 0,
        recentActivity: []
      }
      setData(fallbackData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analytics Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadAnalytics} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isLoading ? 'Loading...' : 'Load Analytics'}
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </div>

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{data.totalStories}</div>
              <div className="text-sm text-gray-600">Stories</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{data.totalChapters}</div>
              <div className="text-sm text-gray-600">Chapters</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{data.totalWords.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Words</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{data.avgWordsPerChapter}</div>
              <div className="text-sm text-gray-600">Avg/Chapter</div>
            </Card>
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} | V2.0 Analytics System | Status: {isLoading ? 'Loading...' : 'Ready'}
        </div>
      </CardContent>
    </Card>
  )
}