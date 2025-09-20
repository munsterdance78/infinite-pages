'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CreatorEarnings {
  accumulated_earnings: {
    current_amount_usd: number
    can_request_payout: boolean
    minimum_payout_usd: number
    next_payout_date: string
    eligibility_message: string
    last_payout_date: string | null
    last_payout_amount: number | null
  }
  period_summary: {
    period_days: number
    total_earnings_usd: number
    total_credits_earned: number
    unique_readers: number
    stories_with_earnings: number
    average_per_story_usd: number
  }
  recent_story_performance: Array<{
    story_id: string
    story_title: string
    total_credits: number
    total_usd: number
    purchase_count: number
    latest_purchase: string
  }>
  meta: {
    credits_to_usd_rate: number
    creator_share_percentage: number
    payout_schedule: string
    minimum_payout: number
  }
}

interface PayoutHistory {
  payout_history: Array<{
    id: string
    amount_usd: number
    status: string
    batch_date: string
    created_at: string
    processing_fee: number
    net_amount: number
  }>
  summary: {
    total_payouts: number
    total_amount_paid_usd: number
    total_fees_paid: number
    net_amount_received: number
    last_successful_payout: {
      amount: number
      date: string
      batch_date: string
    } | null
  }
}

export default function CreatorEarningsDashboard() {
  const [earnings, setEarnings] = useState<CreatorEarnings | null>(null)
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayoutHistory, setShowPayoutHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadEarningsData()
  }, [])

  const loadEarningsData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/creator/earnings?include_history=true')
      const data = await response.json()

      if (!response.ok) {
        if (data.upgrade_required) {
          setError('Premium subscription required for creator features')
        } else {
          setError(data.error || 'Failed to load earnings data')
        }
        return
      }

      setEarnings(data)
    } catch (error) {
      console.error('Failed to load earnings:', error)
      setError('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  const loadPayoutHistory = async () => {
    try {
      const response = await fetch('/api/creator/payout-history')
      const data = await response.json()

      if (response.ok) {
        setPayoutHistory(data)
      }
    } catch (error) {
      console.error('Failed to load payout history:', error)
    }
  }

  const togglePayoutHistory = async () => {
    if (!showPayoutHistory && !payoutHistory) {
      await loadPayoutHistory()
    }
    setShowPayoutHistory(!showPayoutHistory)
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-red-600">⚠️</span>
            <span className="font-medium text-red-800">Creator Access Required</span>
          </div>
          <div className="text-red-700 mt-2">{error}</div>
          {error.includes('Premium') && (
            <div className="mt-3">
              <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Upgrade to Premium
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!earnings) {
    return (
      <div className="p-6 text-center text-gray-500">
        No earnings data available
      </div>
    )
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Your Creator Earnings</h1>
            <p className="text-green-100 mt-1">
              🎉 You earn {earnings.meta.creator_share_percentage}% of all reader payments
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {formatCurrency(earnings.accumulated_earnings.current_amount_usd)}
            </div>
            <div className="text-sm text-green-100">Accumulated This Period</div>
          </div>
        </div>
      </div>

      {/* Payout Status */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payout Status</h3>
          <div className="text-right">
            <div className="text-sm text-gray-600">Next Payout Date</div>
            <div className="font-medium">
              {formatDate(earnings.accumulated_earnings.next_payout_date)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-lg font-medium mb-2">
              Accumulated: {formatCurrency(earnings.accumulated_earnings.current_amount_usd)}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  earnings.accumulated_earnings.can_request_payout ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(
                    (earnings.accumulated_earnings.current_amount_usd / earnings.meta.minimum_payout) * 100,
                    100
                  )}%`
                }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {earnings.accumulated_earnings.eligibility_message}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Minimum Payout:</span>
              <span>{formatCurrency(earnings.meta.minimum_payout)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Payout Schedule:</span>
              <span>{earnings.meta.payout_schedule}</span>
            </div>
            {earnings.accumulated_earnings.last_payout_date && (
              <div className="flex justify-between text-sm">
                <span>Last Payout:</span>
                <span>
                  {formatCurrency(earnings.accumulated_earnings.last_payout_amount || 0)} on{' '}
                  {formatDate(earnings.accumulated_earnings.last_payout_date)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(earnings.period_summary.total_earnings_usd)}
            </div>
            <div className="text-sm text-gray-600">Last 30 Days</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {earnings.period_summary.unique_readers}
            </div>
            <div className="text-sm text-gray-600">Unique Readers</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {earnings.period_summary.stories_with_earnings}
            </div>
            <div className="text-sm text-gray-600">Stories with Earnings</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(earnings.period_summary.average_per_story_usd)}
            </div>
            <div className="text-sm text-gray-600">Avg per Story</div>
          </div>
        </div>
      </div>

      {/* Recent Story Performance */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Recent Stories Performance</h3>
        {earnings.recent_story_performance.length > 0 ? (
          <div className="space-y-3">
            {earnings.recent_story_performance.map((story) => (
              <div key={story.story_id} className="border-b pb-3 last:border-b-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium">{story.story_title}</div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatCurrency(story.total_usd)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {story.total_credits} credits
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {story.purchase_count} purchases • Latest: {formatDate(story.latest_purchase)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-lg font-medium mb-2">No Earnings Yet</h3>
            <p className="text-sm">
              Start creating premium stories to earn from reader purchases!
            </p>
          </div>
        )}
      </div>

      {/* Payout History Toggle */}
      <div className="text-center">
        <button
          onClick={togglePayoutHistory}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {showPayoutHistory ? 'Hide' : 'Show'} Payout History
        </button>
      </div>

      {/* Payout History */}
      {showPayoutHistory && payoutHistory && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Payout History</h3>

          {payoutHistory.summary.total_payouts > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(payoutHistory.summary.net_amount_received)}
                </div>
                <div className="text-xs text-gray-600">Total Received</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-blue-600">
                  {payoutHistory.summary.total_payouts}
                </div>
                <div className="text-xs text-gray-600">Total Payouts</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(payoutHistory.summary.total_fees_paid)}
                </div>
                <div className="text-xs text-gray-600">Processing Fees</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-xl font-bold text-purple-600">
                  {payoutHistory.summary.last_successful_payout
                    ? formatDate(payoutHistory.summary.last_successful_payout.date)
                    : 'Never'
                  }
                </div>
                <div className="text-xs text-gray-600">Last Payout</div>
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {payoutHistory.payout_history.map((payout) => (
              <div key={payout.id} className="border-b pb-3 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      {formatCurrency(payout.amount_usd)} payout
                    </div>
                    <div className="text-xs text-gray-600">
                      Batch: {formatDate(payout.batch_date)} •
                      Net: {formatCurrency(payout.net_amount)} (after ${payout.processing_fee} fee)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      payout.status === 'completed' ? 'text-green-600' :
                      payout.status === 'pending' ? 'text-yellow-600' :
                      payout.status === 'processing' ? 'text-blue-600' :
                      'text-red-600'
                    }`}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(payout.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {payoutHistory.payout_history.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-lg font-medium mb-2">No Payouts Yet</h3>
              <p className="text-sm">
                Your first payout will appear here once you reach the minimum threshold.
              </p>
            </div>
          )}
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
            <div className="font-medium mb-1">✨ Create compelling premium content</div>
            <div>Quality stories with engaging plots earn more from readers</div>
          </div>
          <div>
            <div className="font-medium mb-1">🎨 Use AI-generated covers</div>
            <div>Eye-catching covers increase story discovery and purchases</div>
          </div>
          <div>
            <div className="font-medium mb-1">📈 Post consistently</div>
            <div>Regular uploads keep readers engaged and boost earnings</div>
          </div>
          <div>
            <div className="font-medium mb-1">💰 Premium subscription required</div>
            <div>Only Premium subscribers can create stories and earn money</div>
          </div>
        </div>
      </div>
    </div>
  )
}