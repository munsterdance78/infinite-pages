'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCost, formatTokens } from '@/lib/ai-cost-calculator'

interface CreatorEarningsData {
  summary: {
    totalCreditsEarned: number
    totalUsdEarnings: number
    uniqueReaders: number
    storiesWithEarnings: number
    averageEarningsPerStory: number
    pendingPayout: number
    lifetimeEarnings: number
    creatorSharePercentage: number
  }
  earningsByStory: Array<{
    story_id: string
    story_title: string
    total_credits_earned: number
    total_usd_earned: number
    unique_readers: number
    total_purchases: number
    last_purchase: string
  }>
  recentTransactions: Array<{
    id: string
    story_title: string
    reader_email: string
    credits_earned: number
    usd_equivalent: number
    purchase_type: string
    created_at: string
  }>
  monthlyTrend: Array<{
    month: string
    credits_earned: number
    usd_earned: number
    stories_sold: number
  }>
}

export default function EnhancedCreatorEarnings() {
  const [data, setData] = useState<CreatorEarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('current_month')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [showPayoutBreakdown, setShowPayoutBreakdown] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchEarningsData()
  }, [selectedPeriod])

  const fetchEarningsData = async () => {
    try {
      const response = await fetch(`/api/creators/earnings/enhanced?period=${selectedPeriod}`)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        console.error('Failed to fetch earnings:', result.error)
      }
    } catch (error) {
      console.error('Earnings fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayoutRequest = async () => {
    setPayoutLoading(true)
    try {
      const response = await fetch('/api/creators/payout', {
        method: 'POST'
      })
      const result = await response.json()

      if (response.ok) {
        await fetchEarningsData()
        alert(`Payout of $${result.payout.amount} initiated successfully!`)
      } else {
        alert(`Payout failed: ${result.error}`)
      }
    } catch (error) {
      alert('Payout request failed')
    } finally {
      setPayoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-red-600">
        Failed to load earnings data
      </div>
    )
  }

  const canRequestPayout = data.summary.pendingPayout >= 25.00

  return (
    <div className="space-y-6">
      {/* Header with 70/30 Revenue Share Highlight */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Creator Earnings Dashboard</h1>
            <p className="text-green-100 mt-1">
              🎉 You earn 70% of all reader payments - industry leading!
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{data.summary.creatorSharePercentage}%</div>
            <div className="text-sm text-green-100">Your Share</div>
          </div>
        </div>
      </div>

      {/* Period Selector & Payout Button */}
      <div className="flex justify-between items-center">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border border-gray-300 rounded px-4 py-2"
        >
          <option value="current_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="all_time">All Time</option>
        </select>

        <div className="flex items-center space-x-4">
          {canRequestPayout && (
            <button
              onClick={handlePayoutRequest}
              disabled={payoutLoading}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {payoutLoading ? 'Processing...' : `Request Payout ($${data.summary.pendingPayout.toFixed(2)})`}
            </button>
          )}
          <button
            onClick={() => setShowPayoutBreakdown(!showPayoutBreakdown)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            {showPayoutBreakdown ? 'Hide' : 'Show'} Breakdown
          </button>
        </div>
      </div>

      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {data.summary.totalCreditsEarned.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Credits Earned</div>
            <div className="text-xs text-gray-500 mt-1">
              {selectedPeriod.replace('_', ' ')}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              ${data.summary.totalUsdEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">USD Earnings</div>
            <div className="text-xs text-gray-500 mt-1">
              70% of reader payments
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {data.summary.uniqueReaders}
            </div>
            <div className="text-sm text-gray-600">Unique Readers</div>
            <div className="text-xs text-gray-500 mt-1">
              Across {data.summary.storiesWithEarnings} stories
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              ${data.summary.averageEarningsPerStory.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Avg per Story</div>
            <div className="text-xs text-gray-500 mt-1">
              Revenue potential
            </div>
          </div>
        </div>
      </div>

      {/* Payout Status */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payout Status</h3>
          <div className="text-right">
            <div className="text-sm text-gray-600">Lifetime Earnings</div>
            <div className="text-xl font-bold text-green-600">
              ${data.summary.lifetimeEarnings.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-lg font-medium mb-2">
              Pending Payout: ${data.summary.pendingPayout.toFixed(2)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((data.summary.pendingPayout / 25) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {data.summary.pendingPayout >= 25
                ? 'Ready for payout!'
                : `$${(25 - data.summary.pendingPayout).toFixed(2)} more to reach minimum`
              }
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Platform Fee (30%):</span>
              <span className="text-gray-600">
                ${(data.summary.totalUsdEarnings * (30/70)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Your Earnings (70%):</span>
              <span className="text-green-600">
                ${data.summary.totalUsdEarnings.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Industry leading revenue share
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {showPayoutBreakdown && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings by Story */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Earnings by Story</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.earningsByStory.map((story) => (
                <div key={story.story_id} className="border-b pb-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-sm">{story.story_title}</div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        ${story.total_usd_earned.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {story.total_credits_earned} credits
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {story.unique_readers} readers • {story.total_purchases} purchases
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Recent Earnings</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="border-b pb-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="font-medium text-sm">{transaction.story_title}</div>
                      <div className="text-xs text-gray-600">
                        by {transaction.reader_email}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        +${transaction.usd_equivalent.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transaction.credits_earned} credits
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(transaction.created_at).toLocaleDateString()} • {transaction.purchase_type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Trend (if available) */}
      {data.monthlyTrend.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Earnings Trend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.monthlyTrend.slice(0, 6).map((month) => (
              <div key={month.month} className="text-center p-4 bg-gray-50 rounded">
                <div className="font-medium text-sm mb-1">{month.month}</div>
                <div className="text-lg font-bold text-green-600">
                  ${month.usd_earned.toFixed(2)}
                </div>
                <div className="text-xs text-gray-600">
                  {month.stories_sold} stories sold
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creator Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-blue-600 text-xl">💡</span>
          <h3 className="font-semibold text-blue-800">Maximize Your Earnings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-700 text-sm">
          <div>
            <div className="font-medium mb-1">✨ Create compelling stories</div>
            <div>Quality content attracts more readers and purchases</div>
          </div>
          <div>
            <div className="font-medium mb-1">🎨 Use AI-generated covers</div>
            <div>Eye-catching covers increase click-through rates</div>
          </div>
          <div>
            <div className="font-medium mb-1">📈 Post consistently</div>
            <div>Regular content keeps readers engaged and coming back</div>
          </div>
          <div>
            <div className="font-medium mb-1">💰 You keep 70%</div>
            <div>Industry-leading revenue share - most platforms take 50%+</div>
          </div>
        </div>
      </div>
    </div>
  )
}