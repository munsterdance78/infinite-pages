'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CreditBalanceData {
  balance: {
    current: number
    lifetime_earned: number
    lifetime_spent: number
    net_balance: number
  }
  analytics: {
    monthly_spending: number
    cache_hits: number
    total_cache_savings: number
    cache_efficiency_percentage: number
    estimated_monthly_cost: number
  }
  transactions: any[]
}

interface CreditBalanceProps {
  onPurchaseClick?: () => void
  showDetails?: boolean
  compact?: boolean
}

export default function CreditBalance({
  onPurchaseClick,
  showDetails = false,
  compact = false
}: CreditBalanceProps) {
  const [data, setData] = useState<CreditBalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState(false)

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      const params = new URLSearchParams({
        include_transactions: showDetails ? 'true' : 'false',
        limit: '10'
      })

      const response = await fetch(`/api/credits/balance?${params}`)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        setError(result.error || 'Failed to load balance')
      }
    } catch (err) {
      setError('Failed to load balance')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} text-red-600`}>
        {error || 'Failed to load balance'}
      </div>
    )
  }

  const isLowBalance = data.balance.current < 20

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isLowBalance ? 'bg-red-500' : 'bg-green-500'
          }`} />
          <div>
            <div className="font-semibold">{data.balance.current} credits</div>
            {data.analytics.cache_efficiency_percentage > 0 && (
              <div className="text-xs text-green-600">
                {data.analytics.cache_efficiency_percentage}% cache savings
              </div>
            )}
          </div>
        </div>
        {isLowBalance && (
          <button
            onClick={onPurchaseClick}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Buy Credits
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Credit Balance</h3>
        <button
          onClick={onPurchaseClick}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Buy Credits
        </button>
      </div>

      {isLowBalance && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 rounded-full mr-2" />
            <span className="text-yellow-800">
              Low balance: Consider purchasing more credits to continue reading.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {data.balance.current}
          </div>
          <div className="text-sm text-gray-600">Current Balance</div>
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {data.analytics.cache_hits}
          </div>
          <div className="text-sm text-gray-600">Cache Hits</div>
        </div>
      </div>

      {data.analytics.cache_efficiency_percentage > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex justify-between items-center">
            <span className="text-green-800">
              Cache Efficiency: {data.analytics.cache_efficiency_percentage}%
            </span>
            <span className="text-green-600 font-semibold">
              {data.analytics.total_cache_savings} credits saved
            </span>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Lifetime Earned:</span>
              <span className="font-semibold ml-2">{data.balance.lifetime_earned}</span>
            </div>
            <div>
              <span className="text-gray-600">Lifetime Spent:</span>
              <span className="font-semibold ml-2">{data.balance.lifetime_spent}</span>
            </div>
            <div>
              <span className="text-gray-600">Monthly Spending:</span>
              <span className="font-semibold ml-2">{data.analytics.monthly_spending}</span>
            </div>
            <div>
              <span className="text-gray-600">Estimated Cost:</span>
              <span className="font-semibold ml-2">
                ${data.analytics.estimated_monthly_cost.toFixed(2)}/month
              </span>
            </div>
          </div>

          {data.transactions.length > 0 && (
            <div>
              <button
                onClick={() => setShowTransactions(!showTransactions)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2"
              >
                {showTransactions ? 'Hide' : 'Show'} Recent Transactions
              </button>

              {showTransactions && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.transactions.map((transaction, index) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                      <div>
                        <span className={`font-medium ${
                          transaction.transaction_type === 'spend' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.transaction_type === 'spend' ? '-' : '+'}
                          {Math.abs(transaction.amount)}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {transaction.description}
                        </span>
                      </div>
                      <span className="text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}