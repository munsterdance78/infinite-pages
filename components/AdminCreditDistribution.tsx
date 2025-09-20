'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DistributionResult {
  success: boolean
  summary: {
    distributionMonth: string
    totalUsersProcessed: number
    totalCreditsDistributed: number
    totalBonusCredits: number
    averageCreditsPerUser: number
    dryRun: boolean
    breakdown: {
      byTier: Record<string, {
        users: number
        credits: number
        bonusCredits: number
      }>
    }
  }
  message: string
}

interface DistributionHistory {
  distributionHistory: Array<{
    month: string
    totalCredits: number
    totalUsers: number
    byTier: Record<string, { users: number; credits: number }>
  }>
}

export default function AdminCreditDistribution() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DistributionResult | null>(null)
  const [history, setHistory] = useState<DistributionHistory | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadDistributionHistory()
  }, [])

  const loadDistributionHistory = async () => {
    try {
      const response = await fetch('/api/admin/distribute-credits')
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error('Failed to load distribution history:', error)
    }
  }

  const handleDistribution = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/distribute-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          dryRun
        })
      })

      const data = await response.json()
      setResult(data)

      if (!dryRun && data.success) {
        await loadDistributionHistory()
      }
    } catch (error) {
      console.error('Distribution failed:', error)
      setResult({
        success: false,
        summary: null as any,
        message: 'Distribution failed due to network error'
      })
    } finally {
      setLoading(false)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Monthly Credit Distribution</h2>

        {/* Distribution Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {years.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={dryRun}
                  onChange={() => setDryRun(true)}
                  className="mr-2"
                />
                Dry Run
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!dryRun}
                  onChange={() => setDryRun(false)}
                  className="mr-2"
                />
                Live
              </label>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleDistribution}
              disabled={loading}
              className={`w-full px-4 py-2 rounded text-white font-medium ${
                dryRun
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Processing...' : dryRun ? 'Preview Distribution' : 'Execute Distribution'}
            </button>
          </div>
        </div>

        {/* Warning for live distribution */}
        {!dryRun && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-red-600 text-xl">⚠️</span>
              <span className="font-medium text-red-800">Live Distribution Mode</span>
            </div>
            <div className="text-red-700 text-sm mt-1">
              This will actually distribute credits to users and record transactions. Make sure you've tested with dry run first!
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className={`font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.message}
            </div>

            {result.success && result.summary && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.summary.totalUsersProcessed}
                    </div>
                    <div className="text-sm text-gray-600">Users Processed</div>
                  </div>

                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-green-600">
                      {result.summary.totalCreditsDistributed.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Credits</div>
                  </div>

                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.summary.totalBonusCredits.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Bonus Credits</div>
                  </div>

                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-2xl font-bold text-orange-600">
                      {result.summary.averageCreditsPerUser}
                    </div>
                    <div className="text-sm text-gray-600">Avg per User</div>
                  </div>
                </div>

                {/* Breakdown by tier */}
                <div className="bg-white rounded border p-4">
                  <h4 className="font-medium mb-3">Distribution by Tier</h4>
                  <div className="space-y-2">
                    {Object.entries(result.summary.breakdown.byTier).map(([tier, data]) => (
                      <div key={tier} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="font-medium capitalize">{tier}</div>
                        <div className="text-sm text-gray-600">
                          {data.users} users • {data.credits.toLocaleString()} credits
                          {data.bonusCredits > 0 && (
                            <span className="text-green-600"> (+{data.bonusCredits} bonus)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Distribution History Toggle */}
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {showHistory ? 'Hide' : 'Show'} Distribution History
          </button>
        </div>

        {/* Distribution History */}
        {showHistory && history && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Recent Distributions</h4>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {history.distributionHistory.map((distribution, index) => (
                <div key={index} className="bg-white rounded border p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium">{distribution.month}</div>
                    <div className="text-sm text-gray-600">
                      {distribution.totalUsers} users • {distribution.totalCredits.toLocaleString()} credits
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-x-4">
                    {Object.entries(distribution.byTier).map(([tier, data]) => (
                      <span key={tier}>
                        {tier}: {data.users} users ({data.credits.toLocaleString()} credits)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-blue-600 text-xl">💡</span>
          <h3 className="font-semibold text-blue-800">Proportional Credit Distribution</h3>
        </div>
        <div className="text-blue-700 text-sm space-y-2">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Users receive their base monthly credits based on subscription tier</li>
            <li>Bonus credits are awarded based on reading activity (up to 20% more)</li>
            <li>More engaged readers get proportionally more credits</li>
            <li>This encourages platform engagement and discovery</li>
          </ul>
          <p className="mt-3"><strong>Always test with dry run first!</strong></p>
        </div>
      </div>
    </div>
  )
}