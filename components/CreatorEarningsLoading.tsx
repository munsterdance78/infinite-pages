'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { RefreshCw, DollarSign, TrendingUp, Users, BookOpen } from 'lucide-react'

interface CreatorEarningsLoadingProps {
  mode?: 'basic' | 'enhanced' | 'dashboard'
  progress?: number
  status?: string
}

export default function CreatorEarningsLoading({
  mode = 'enhanced',
  progress = 0,
  status = 'Loading earnings data...'
}: CreatorEarningsLoadingProps) {
  const showDashboardFeatures = mode === 'dashboard'
  const showEnhancedFeatures = mode === 'enhanced' || mode === 'dashboard'

  return (
    <div className="space-y-6">
      {/* Loading Header */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-3">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-blue-900">Loading Creator Earnings</h2>
              <p className="text-sm text-blue-700">{status}</p>
              {progress > 0 && (
                <div className="mt-3 w-48">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-blue-600 mt-1">{progress}% complete</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'Total Earnings' },
          { icon: TrendingUp, label: 'This Month' },
          { icon: Users, label: 'Unique Readers' },
          { icon: BookOpen, label: 'Stories with Earnings' }
        ].map((item, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <item.icon className="w-8 h-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Story Performance */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: mode === 'basic' ? 3 : 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: mode === 'basic' ? 3 : 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Features Skeleton */}
      {showEnhancedFeatures && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="flex justify-between">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 w-8" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payout Information */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard-only Features Skeleton */}
      {showDashboardFeatures && (
        <div className="space-y-6">
          {/* Advanced Analytics */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Tips */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="font-medium text-gray-900 mb-2">Did you know?</h3>
            <p className="text-sm text-gray-600">
              {mode === 'basic' && 'Basic mode shows your essential earnings metrics and recent activity.'}
              {mode === 'enhanced' && 'Enhanced mode includes detailed analytics, trends, and payout management.'}
              {mode === 'dashboard' && 'Dashboard mode provides comprehensive creator management tools and advanced analytics.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

