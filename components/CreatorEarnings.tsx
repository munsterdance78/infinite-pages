'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EarningsData {
  summary: {
    totalEarnings: number
    totalUsdEarnings: number
    uniqueReaders: number
    creatorTier: string | null
    totalEarningsAllTime: number
    pendingPayout: number
  }
  recentEarnings: any[]
  storyPerformance: any[]
  period: string
}

interface CreatorEarningsProps {
  onPayoutRequest?: () => void
}

export default function CreatorEarnings({ onPayoutRequest }: CreatorEarningsProps) {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30')
  const [payoutLoading, setPayoutLoading] = useState(false)

  useEffect(() => {
    fetchEarnings()
  }, [period])

  const fetchEarnings = async () => {
    try {
      const response = await fetch(`/api/creators/earnings?period=${period}`)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        setError(result.error || 'Failed to load earnings')
      }
    } catch (err) {
      setError('Failed to load earnings')
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
        // Refresh earnings data
        await fetchEarnings()
        onPayoutRequest?.()
      } else {
        setError(result.error || 'Payout request failed')
      }
    } catch (err) {
      setError('Payout request failed')
    } finally {
      setPayoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600">
        {error || 'Failed to load earnings data'}
      </div>
    )
  }

  const canRequestPayout = data.summary.pendingPayout >= 25.00

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Creator Earnings</h3>
        <div className="flex items-center space-x-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          {canRequestPayout && (
            <button
              onClick={handlePayoutRequest}
              disabled={payoutLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {payoutLoading ? 'Processing...' : 'Request Payout'}
            </button>
          )}
        </div>
      </div>

      {/* Creator Tier Badge */}
      {data.summary.creatorTier && (
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            data.summary.creatorTier === 'platinum' ? 'bg-purple-100 text-purple-800' :
            data.summary.creatorTier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
            data.summary.creatorTier === 'silver' ? 'bg-gray-100 text-gray-800' :
            'bg-orange-100 text-orange-800'
          }`}>
            {data.summary.creatorTier.charAt(0).toUpperCase() + data.summary.creatorTier.slice(1)} Creator
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {data.summary.totalEarnings}
          </div>
          <div className="text-sm text-gray-600">Credits Earned</div>
          <div className="text-xs text-gray-500">{data.period}</div>
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            ${data.summary.totalUsdEarnings.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">USD Earnings</div>
          <div className="text-xs text-gray-500">{data.period}</div>
        </div>

        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {data.summary.uniqueReaders}
          </div>
          <div className="text-sm text-gray-600">Unique Readers</div>
          <div className="text-xs text-gray-500">{data.period}</div>
        </div>

        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            ${data.summary.pendingPayout.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Pending Payout</div>
          <div className="text-xs text-gray-500">
            {canRequestPayout ? 'Ready to withdraw' : 'Min $25.00'}
          </div>
        </div>
      </div>

      {/* Story Performance */}
      {data.storyPerformance.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-3">Story Performance</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.storyPerformance.map((story, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{story.title}</div>
                  <div className="text-sm text-gray-600">
                    {story.purchaseCount} purchases
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{story.totalRevenue} credits</div>
                  <div className="text-sm text-gray-600">
                    ~${(story.totalRevenue * 0.035).toFixed(2)} earned
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Earnings */}
      {data.recentEarnings.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold mb-3">Recent Earnings</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.recentEarnings.slice(0, 10).map((earning, index) => (
              <div key={index} className="flex justify-between items-center p-2 text-sm border-b border-gray-100">
                <div>
                  <span className="font-medium">{earning.stories?.title || 'Unknown Story'}</span>
                  <span className="text-gray-600 ml-2">
                    by {earning.profiles?.email || 'Anonymous'}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-green-600 font-medium">
                    +{earning.credits_earned} credits
                  </div>
                  <div className="text-xs text-gray-500">
                    ${earning.usd_equivalent.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No earnings message */}
      {data.recentEarnings.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg font-medium mb-2">No earnings yet</div>
          <p className="text-sm">
            Start creating content to earn from reader purchases!
          </p>
        </div>
      )}

      {/* Lifetime earnings summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <span>Total lifetime earnings: </span>
          <span className="font-semibold">${data.summary.totalEarningsAllTime.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}