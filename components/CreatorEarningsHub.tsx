'use client'

import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import CreatorEarningsErrorBoundary from '@/components/CreatorEarningsErrorBoundary'
import CreatorEarningsLoading from '@/components/CreatorEarningsLoading'
import {
  BookOpen,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  AlertCircle,
  Crown,
  Wallet
} from 'lucide-react'

import { useCreatorEarnings } from '@/hooks/useCreatorEarnings'
import type {
  CreatorEarningsHubProps } from '@/types/creator-earnings'
import {
  DISPLAY_MODES,
  CREATOR_TIERS,
  PERIOD_OPTIONS
} from '@/types/creator-earnings'

export default function CreatorEarningsHub({
  mode = 'enhanced',
  userId,
  onPayoutRequest,
  onUpgradeRequired,
  compact = false,
  showHeader = true
}: CreatorEarningsHubProps) {
  const {
    data,
    loading,
    error,
    selectedPeriod,
    displayMode,
    showPayoutBreakdown,
    showPayoutHistory,
    changePeriod,
    changeDisplayMode,
    togglePayoutBreakdown,
    togglePayoutHistory,
    requestPayout,
    refresh,
    isLoading,
    hasError,
    canRefresh
  } = useCreatorEarnings({
    mode,
    autoRefresh: true,
    refreshInterval: 30000
  })

  const displayConfig = DISPLAY_MODES[mode]

  // Handle upgrade required
  const handleUpgradeRequired = () => {
    onUpgradeRequired?.()
  }

  // Handle payout request
  const handlePayoutRequest = async () => {
    try {
      const result = await requestPayout()
      onPayoutRequest?.(result.payout.amount)
    } catch (error: any) {
      console.error('Payout request failed:', error)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  // Format date
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  // Get tier badge info
  const tierInfo = useMemo(() => {
    if (!data?.profile.creatorTier) return null
    return CREATOR_TIERS[data.profile.creatorTier]
  }, [data?.profile.creatorTier])

  // Loading state
  if (isLoading && !data) {
    return (
      <div className={compact ? 'p-4' : 'p-6'}>
        <CreatorEarningsLoading
          mode={mode}
          progress={0}
          status="Fetching your latest earnings data..."
        />
      </div>
    )
  }

  // Error state
  if (hasError && !data) {
    const errorMessage = error.general
    const isUpgradeRequired = errorMessage?.includes('Premium subscription')

    return (
      <div className={compact ? 'p-4' : 'p-6'}>
        <Alert variant={isUpgradeRequired ? 'default' : 'destructive'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{errorMessage}</span>
              {isUpgradeRequired && (
                <Button
                  onClick={handleUpgradeRequired}
                  size="sm"
                  className="ml-4"
                >
                  Upgrade Now
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={compact ? 'p-4' : 'p-6'}>
        <p className="text-gray-500">No earnings data available</p>
      </div>
    )
  }

  return (
    <CreatorEarningsErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('CreatorEarningsHub Error:', error, errorInfo)
      }}
    >
      <div className={`space-y-6 ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className={`font-bold ${compact ? 'text-xl' : 'text-2xl'}`}>
                Creator Earnings
              </h1>
              {displayConfig.showTierBadge && tierInfo && (
                <Badge
                  variant="secondary"
                  className={`${tierInfo.bgColor} ${tierInfo.color}`}
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {tierInfo.name}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              You earn {data.summary.creatorSharePercentage}% of reader payments
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Selector */}
            <Select value={selectedPeriod} onValueChange={changePeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Display Mode Selector (if not compact) */}
            {!compact && (
              <Select value={displayMode} onValueChange={changeDisplayMode}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="enhanced">Enhanced</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={!canRefresh}
            >
              <RefreshCw className={`h-4 w-4 ${loading.summary ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Credits Earned</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.summary.totalCreditsEarned.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.periodDescription}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">USD Earnings</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(data.summary.totalUsdEarnings)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.creatorSharePercentage}% share
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unique Readers</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.summary.uniqueReaders}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.summary.storiesWithEarnings} stories
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Payout</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(data.summary.pendingPayout)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.payoutInfo.canRequestPayout ? 'Ready!' : `Min $${data.payoutInfo.minimumPayout}`}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payout Status
          </CardTitle>
          <div className="flex gap-2">
            {data.payoutInfo.canRequestPayout && (
              <Button
                onClick={handlePayoutRequest}
                disabled={loading.requestingPayout}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading.requestingPayout ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Request Payout
              </Button>
            )}
            {displayConfig.showDetailedBreakdown && (
              <Button
                variant="outline"
                onClick={togglePayoutBreakdown}
                size="sm"
              >
                {showPayoutBreakdown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Balance:</span>
                  <span className="font-medium">
                    {formatCurrency(data.summary.pendingPayout)}
                  </span>
                </div>
                <Progress
                  value={Math.min((data.summary.pendingPayout / data.payoutInfo.minimumPayout) * 100, 100)}
                  className="h-2"
                />
                <p className="text-sm text-muted-foreground">
                  {data.payoutInfo.eligibilityMessage}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {displayConfig.showLifetimeEarnings && (
                <div className="flex justify-between text-sm">
                  <span>Lifetime Earnings:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(data.summary.lifetimeEarnings)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Next Payout:</span>
                <span>{formatDate(data.payoutInfo.nextPayoutDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing Fee:</span>
                <span>{formatCurrency(data.payoutInfo.processingFee)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          {showPayoutBreakdown && displayConfig.showDetailedBreakdown && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Revenue Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Platform Fee (30%):</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(data.summary.totalUsdEarnings * (30/70))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Your Share (70%):</span>
                    <span className="text-green-600">
                      {formatCurrency(data.summary.totalUsdEarnings)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average per Story:</span>
                    <span>{formatCurrency(data.summary.averageEarningsPerStory)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Stories with Earnings:</span>
                    <span>{data.summary.storiesWithEarnings}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Story Performance */}
      {data.storyPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Story Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.storyPerformance
                .slice(0, displayConfig.maxStoryPerformanceItems)
                .map((story) => (
                <div key={story.storyId} className="flex justify-between items-center p-3 rounded-lg border">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{story.storyTitle}</h4>
                    <p className="text-xs text-muted-foreground">
                      {story.uniqueReaders} readers • {story.totalPurchases} purchases
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(story.totalUsdEarned)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {story.totalCreditsEarned} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {displayConfig.showRecentTransactions && data.recentTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {data.recentTransactions
                .slice(0, displayConfig.maxTransactionItems)
                .map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-sm">{transaction.storyTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.readerEmail} • {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +{formatCurrency(transaction.usdEquivalent)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.creditsEarned} credits
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trends */}
      {displayConfig.showMonthlyTrends && data.monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Earnings Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.monthlyTrend.slice(-6).map((month) => (
                <div key={month.month} className="text-center p-4 bg-muted rounded-lg">
                  <p className="font-medium text-sm mb-1">{month.month}</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(month.usdEarned)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {month.storiesSold} sales • {month.uniqueReaders} readers
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      {displayConfig.showPayoutHistory && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payout History</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={togglePayoutHistory}
            >
              {showPayoutHistory ? 'Hide' : 'Show'} History
            </Button>
          </CardHeader>
          {showPayoutHistory && (
            <CardContent>
              {loading.payoutHistory ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : data.payoutHistory?.items.length ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {data.payoutHistory.items.map((payout) => (
                    <div key={payout.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">
                          {formatCurrency(payout.amountUsd)} payout
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payout.createdAt)} • Net: {formatCurrency(payout.netAmount)}
                        </p>
                      </div>
                      <Badge variant={
                        payout.status === 'completed' ? 'default' :
                        payout.status === 'pending' ? 'secondary' :
                        'destructive'
                      }>
                        {payout.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payouts yet</p>
                  <p className="text-sm">Your first payout will appear here once you reach the minimum threshold.</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Creator Tips */}
      <Alert>
        <Star className="h-4 w-4" />
        <AlertDescription>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>✨ Create quality content:</strong> Engaging stories attract more readers and purchases
            </div>
            <div>
              <strong>📈 Post consistently:</strong> Regular uploads keep readers coming back
            </div>
            <div>
              <strong>🎨 Use AI covers:</strong> Eye-catching covers increase discovery
            </div>
            <div>
              <strong>💰 70% revenue share:</strong> Industry-leading creator earnings
            </div>
          </div>
        </AlertDescription>
      </Alert>
      </div>
    </CreatorEarningsErrorBoundary>
  )
}