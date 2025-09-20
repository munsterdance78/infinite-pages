'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCost, formatTokens, calculateMonthlySavings, type UsageStats } from '@/lib/ai-cost-calculator'

interface AIUsageDashboardProps {
  compact?: boolean
}

interface MonthlyUsage {
  operation_type: string
  total_tokens: number
  total_cost: number
  total_charged: number
  operation_count: number
  ai_model_used: string
}

export default function AIUsageDashboard({ compact = false }: AIUsageDashboardProps) {
  const [usageData, setUsageData] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('current_month')
  const [showDetails, setShowDetails] = useState(!compact)

  const supabase = createClient()

  useEffect(() => {
    loadUsageData()
  }, [selectedPeriod])

  const loadUsageData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Calculate date range
      const now = new Date()
      let startDate: Date

      switch (selectedPeriod) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          break
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      // Get AI usage logs
      const { data: usageLogs, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading usage data:', error)
        return
      }

      // Process data into usage stats
      const operationBreakdown: Record<string, { tokens: number; cost: number; charged: number; count: number }> = {}
      let totalTokens = 0
      let totalCost = 0
      let totalCharged = 0
      let coverGenerations = 0

      usageLogs?.forEach(log => {
        const tokens = log.tokens_input + log.tokens_output
        totalTokens += tokens
        totalCost += log.actual_cost_usd
        totalCharged += log.charged_amount_usd

        if (log.operation_type === 'cover') {
          coverGenerations++
        }

        if (!operationBreakdown[log.operation_type]) {
          operationBreakdown[log.operation_type] = {
            tokens: 0,
            cost: 0,
            charged: 0,
            count: 0
          }
        }

        operationBreakdown[log.operation_type].tokens += tokens
        operationBreakdown[log.operation_type].cost += log.actual_cost_usd
        operationBreakdown[log.operation_type].charged += log.charged_amount_usd
        operationBreakdown[log.operation_type].count++
      })

      const stats: UsageStats = {
        totalTokensThisMonth: totalTokens,
        totalCostThisMonth: totalCost,
        totalChargedThisMonth: totalCharged,
        operationBreakdown,
        coverGenerations,
        savingsVsMarket: 0 // Will be calculated
      }

      stats.savingsVsMarket = calculateMonthlySavings(stats)
      setUsageData(stats)

    } catch (error) {
      console.error('Failed to load usage data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOperationDisplayName = (type: string) => {
    const names = {
      foundation: 'Story Foundations',
      character: 'Character Generation',
      chapter: 'Chapter Writing',
      cover: 'Cover Generation',
      improvement: 'Content Improvements'
    }
    return names[type as keyof typeof names] || type
  }

  const getOperationIcon = (type: string) => {
    const icons = {
      foundation: '📚',
      character: '👤',
      chapter: '📝',
      cover: '🎨',
      improvement: '✨'
    }
    return icons[type as keyof typeof icons] || '🤖'
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (compact && usageData) {
    return (
      <div className="p-4 bg-white border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">AI Usage This Month</h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total Spent</div>
            <div className="font-semibold">{formatCost(usageData.totalChargedThisMonth)}</div>
          </div>
          <div>
            <div className="text-gray-600">Market Savings</div>
            <div className="font-semibold text-green-600">{usageData.savingsVsMarket}%</div>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t">
            <div className="space-y-2 text-xs">
              {Object.entries(usageData.operationBreakdown).map(([type, data]) => (
                <div key={type} className="flex justify-between">
                  <span>{getOperationDisplayName(type)}: {data.count}×</span>
                  <span>{formatCost(data.charged)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">AI Usage & Costs</h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm"
        >
          <option value="current_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_3_months">Last 3 Months</option>
        </select>
      </div>

      {usageData && usageData.totalChargedThisMonth > 0 ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatTokens(usageData.totalTokensThisMonth)}
              </div>
              <div className="text-sm text-gray-600">Total Tokens</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCost(usageData.totalCostThisMonth)}
              </div>
              <div className="text-sm text-gray-600">API Costs</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {formatCost(usageData.totalChargedThisMonth)}
              </div>
              <div className="text-sm text-gray-600">You Paid</div>
            </div>

            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {usageData.savingsVsMarket}%
              </div>
              <div className="text-sm text-gray-600">Savings vs Market</div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Usage Breakdown</h3>

            <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm">
              <div className="text-center font-bold mb-3">
                {selectedPeriod === 'current_month' ? "This Month's" :
                 selectedPeriod === 'last_month' ? "Last Month's" :
                 "3-Month"} AI Spending:
              </div>
              <div className="border-b border-gray-300 mb-3"></div>

              {Object.entries(usageData.operationBreakdown).map(([type, data]) => (
                <div key={type} className="mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <span>{getOperationIcon(type)}</span>
                    <span className="font-medium">{getOperationDisplayName(type)}: {formatTokens(data.tokens)}</span>
                  </div>
                  <div className="ml-6 text-gray-600">
                    Cost: {formatCost(data.cost)} → Charged: {formatCost(data.charged)} ({data.count} operations)
                  </div>
                </div>
              ))}

              {usageData.coverGenerations > 0 && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <span>🎨</span>
                    <span className="font-medium">Cover Generation: {usageData.coverGenerations} images</span>
                  </div>
                  <div className="ml-6 text-gray-600">
                    Cost: {formatCost(usageData.coverGenerations * 0.02)} → Charged: {formatCost(usageData.coverGenerations * 0.024)}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-300 pt-3 mt-3">
                <div className="font-bold">
                  Total {selectedPeriod === 'current_month' ? 'This Month' :
                         selectedPeriod === 'last_month' ? 'Last Month' :
                         '3-Month Period'}: {formatCost(usageData.totalChargedThisMonth)} charged
                </div>
                <div className="text-green-600 font-medium">
                  Your Savings vs Market Rate: {usageData.savingsVsMarket}%
                </div>
              </div>
            </div>

            {/* Transparency Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-blue-600">💡</span>
                <span className="font-medium text-blue-800">Our Transparent Pricing</span>
              </div>
              <div className="text-blue-700 text-sm space-y-1">
                <p>• We show you the exact API costs we pay</p>
                <p>• Our 20% markup covers infrastructure & development</p>
                <p>• You save 60%+ compared to other AI writing platforms</p>
                <p>• No hidden fees or surprise charges</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-lg font-medium mb-2">No AI Usage Yet</h3>
          <p className="text-sm">
            Start creating stories to see your transparent AI cost breakdown here.
          </p>
        </div>
      )}
    </div>
  )
}