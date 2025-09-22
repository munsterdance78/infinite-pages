'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface GlassCreatorEarningsWrapperProps {
  children: React.ReactNode
  className?: string
  showAnalyticsPanel?: boolean
  showInsightsWidget?: boolean
  showTipsCarousel?: boolean
}

const GlassCreatorEarningsWrapper: React.FC<GlassCreatorEarningsWrapperProps> = ({
  children,
  className,
  showAnalyticsPanel = true,
  showInsightsWidget = true,
  showTipsCarousel = true
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTip, setCurrentTip] = useState(0)
  const [showInsights, setShowInsights] = useState(false)

  const tips = [
    "🎨 High-quality covers increase discovery by 70%",
    "📚 Stories over 1,000 words earn 40% more on average",
    "⏰ Publishing consistently builds reader loyalty",
    "💎 Premium stories can earn 3x more per reader"
  ]

  // Monitor refresh state without interfering with original component
  useEffect(() => {
    const handleRefreshStart = () => setIsRefreshing(true)
    const handleRefreshEnd = () => setIsRefreshing(false)

    // Listen for earnings refresh events from the wrapped component
    window.addEventListener('earnings-refresh-start', handleRefreshStart)
    window.addEventListener('earnings-refresh-end', handleRefreshEnd)

    return () => {
      window.removeEventListener('earnings-refresh-start', handleRefreshStart)
      window.removeEventListener('earnings-refresh-end', handleRefreshEnd)
    }
  }, [])

  // Auto-rotate tips
  useEffect(() => {
    if (showTipsCarousel) {
      const interval = setInterval(() => {
        setCurrentTip((prev) => (prev + 1) % tips.length)
      }, 4000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [showTipsCarousel, tips.length])

  return (
    <div className={cn('glass-creator-earnings-wrapper', className)}>
      {/* Header with glassmorphism */}
      <div className="glass-creator-earnings-header">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white glass-text-shadow mb-2">
              Creator Dashboard
            </h2>
            <p className="text-white/80 glass-text-shadow-subtle">
              Track your creative impact and earnings journey
            </p>
          </div>

          {/* Live status indicator */}
          <div className="glass-subtle px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`} />
              <span className="text-sm text-white/90 font-medium glass-text-shadow">
                {isRefreshing ? 'Syncing...' : 'Live Data'}
              </span>
            </div>
          </div>
        </div>

        {/* Insights panel (non-interfering) */}
        {showInsightsWidget && (
          <div className="glass-insights-panel mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white glass-text-shadow">
                Earnings Insights
              </h3>
              <button
                onClick={() => setShowInsights(!showInsights)}
                className="glass-btn-secondary text-sm px-3 py-2"
              >
                {showInsights ? 'Hide' : 'Show'} Details
              </button>
            </div>

            {showInsights && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-analytics-metric">
                  <h4 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                    Growth Trend
                  </h4>
                  <p className="text-lg font-semibold text-green-400 glass-text-shadow">
                    +23% this month
                  </p>
                </div>

                <div className="glass-analytics-metric">
                  <h4 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                    Top Performance
                  </h4>
                  <p className="text-sm text-white/70 glass-text-shadow-subtle">
                    Fantasy stories lead earnings
                  </p>
                </div>

                <div className="glass-analytics-metric">
                  <h4 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                    Next Milestone
                  </h4>
                  <p className="text-sm text-white/70 glass-text-shadow-subtle">
                    $50 for next payout tier
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Original component container (completely unmodified) */}
      <div className="relative">
        {children}

        {/* Loading overlay (positioned absolutely, non-interfering) */}
        {isRefreshing && (
          <div className="absolute inset-0 glass-base bg-black/20 flex items-center justify-center rounded-2xl z-10">
            <div className="glass-strong p-6 text-center">
              <div className="glass-spinner mx-auto mb-4 w-6 h-6">
                <div className="w-full h-full border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-white glass-text-shadow font-medium">
                Updating earnings data...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Enhancement panels (external to original component) */}
      {showAnalyticsPanel && (
        <div className="mt-8 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-analytics-metric">
              <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                Active Stories
              </h3>
              <p className="text-2xl font-bold text-white glass-text-shadow">
                12
              </p>
              <p className="text-xs text-white/60 glass-text-shadow-subtle">
                Earning revenue
              </p>
            </div>

            <div className="glass-analytics-metric">
              <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                Reader Retention
              </h3>
              <p className="text-2xl font-bold text-blue-400 glass-text-shadow">
                87%
              </p>
              <p className="text-xs text-white/60 glass-text-shadow-subtle">
                Return rate
              </p>
            </div>

            <div className="glass-analytics-metric">
              <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                Avg. Story Value
              </h3>
              <p className="text-2xl font-bold text-green-400 glass-text-shadow">
                $3.40
              </p>
              <p className="text-xs text-white/60 glass-text-shadow-subtle">
                Per purchase
              </p>
            </div>

            <div className="glass-analytics-metric">
              <h3 className="text-sm font-medium text-white/90 mb-2 glass-text-shadow">
                Genre Rank
              </h3>
              <p className="text-2xl font-bold text-purple-400 glass-text-shadow">
                Top 5%
              </p>
              <p className="text-xs text-white/60 glass-text-shadow-subtle">
                In fantasy
              </p>
            </div>
          </div>

          {/* Creator optimization tips */}
          {showTipsCarousel && (
            <div className="glass-tips-carousel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white glass-text-shadow">
                  💡 Creator Tips
                </h3>
                <div className="flex gap-1">
                  {tips.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentTip ? 'bg-white' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="glass-subtle p-4 rounded-lg">
                <p className="text-white glass-text-shadow-subtle text-center">
                  {tips[currentTip]}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions floating panel */}
      <div className="fixed bottom-6 right-6 z-20">
        <div className="glass-floating-actions flex flex-col gap-3">
          <button className="glass-btn-secondary p-3 rounded-full min-h-[48px] min-w-[48px]" title="Export Report">
            📊
          </button>
          <button className="glass-btn-secondary p-3 rounded-full min-h-[48px] min-w-[48px]" title="Analytics">
            📈
          </button>
          <button className="glass-btn-secondary p-3 rounded-full min-h-[48px] min-w-[48px]" title="Help">
            ❓
          </button>
        </div>
      </div>
    </div>
  )
}

export default GlassCreatorEarningsWrapper