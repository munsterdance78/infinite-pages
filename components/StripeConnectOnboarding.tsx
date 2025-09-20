'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ConnectStatus {
  status: string
  message: string
  payout_enabled: boolean
  account_id?: string
  charges_enabled?: boolean
  payouts_enabled?: boolean
  requirements?: {
    currently_due: string[]
    eventually_due: string[]
    pending_verification: string[]
  }
  requires_action?: boolean
  pending_earnings?: number
  total_earnings?: number
  action_required?: string
  onboarding_complete?: boolean
}

interface OnboardingResponse {
  success: boolean
  status: string
  message: string
  onboarding_url?: string
  account_id?: string
  expires_at?: number
  instructions?: string[]
}

export default function StripeConnectOnboarding() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    checkConnectStatus()
  }, [])

  const checkConnectStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/creators/stripe/onboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok) {
        setConnectStatus(data)
      } else {
        setError(data.error || 'Failed to check status')
      }
    } catch (err) {
      console.error('Error checking Connect status:', err)
      setError('Failed to check Stripe Connect status')
    } finally {
      setLoading(false)
    }
  }

  const startOnboarding = async () => {
    try {
      setOnboarding(true)
      setError(null)

      const response = await fetch('/api/creators/stripe/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          country: 'US',
          business_type: 'individual'
        })
      })

      const data: OnboardingResponse = await response.json()

      if (response.ok && data.onboarding_url) {
        // Redirect to Stripe onboarding
        window.location.href = data.onboarding_url
      } else {
        setError(data.message || 'Failed to start onboarding')
      }
    } catch (err) {
      console.error('Error starting onboarding:', err)
      setError('Failed to start Stripe Connect onboarding')
    } finally {
      setOnboarding(false)
    }
  }

  const refreshOnboarding = async () => {
    try {
      setOnboarding(true)
      setError(null)

      const response = await fetch('/api/creators/stripe/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.onboarding_url) {
        window.location.href = data.onboarding_url
      } else {
        setError(data.message || 'Failed to refresh onboarding')
      }
    } catch (err) {
      console.error('Error refreshing onboarding:', err)
      setError('Failed to refresh Stripe Connect onboarding')
    } finally {
      setOnboarding(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <h3 className="font-semibold text-red-800">Setup Error</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={checkConnectStatus}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!connectStatus) {
    return null
  }

  // Handle different status types
  switch (connectStatus.status) {
    case 'not_creator':
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-blue-500 text-xl">ℹ️</span>
            <h3 className="font-semibold text-blue-800">Creator Status Required</h3>
          </div>
          <p className="text-blue-700">
            You need to be a creator to set up payouts. Please enable creator features in your profile.
          </p>
        </div>
      )

    case 'subscription_required':
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-yellow-500 text-xl">👑</span>
            <h3 className="font-semibold text-yellow-800">Premium Required</h3>
          </div>
          <p className="text-yellow-700 mb-4">
            Premium subscription is required to receive creator payouts.
          </p>
          <button className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
            Upgrade to Premium
          </button>
        </div>
      )

    case 'not_started':
    case 'not_onboarded':
      return (
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Set Up Creator Payouts</h3>
              <p className="text-gray-600 mt-1">
                Connect your bank account to receive 70% of reader payments
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Pending Earnings</div>
              <div className="text-2xl font-bold text-green-600">
                ${(connectStatus.pending_earnings || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-2">What you'll need:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Bank account details for payouts</li>
              <li>• Government ID for verification</li>
              <li>• Tax information (SSN or EIN)</li>
              <li>• Business details (if applicable)</li>
            </ul>
          </div>

          <button
            onClick={startOnboarding}
            disabled={onboarding}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {onboarding ? 'Starting Setup...' : 'Start Payout Setup'}
          </button>
        </div>
      )

    case 'incomplete':
      return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-orange-500 text-xl">⏳</span>
            <h3 className="font-semibold text-orange-800">Setup Incomplete</h3>
          </div>
          <p className="text-orange-700 mb-4">
            Your Stripe Connect setup needs additional information.
          </p>

          {connectStatus.requirements && (
            <div className="mb-4">
              <h4 className="font-medium text-orange-800 mb-2">Required Information:</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                {connectStatus.requirements.currently_due.map((req, index) => (
                  <li key={index}>• {req.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={refreshOnboarding}
              disabled={onboarding}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {onboarding ? 'Loading...' : 'Continue Setup'}
            </button>
            <button
              onClick={checkConnectStatus}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )

    case 'complete':
    case 'already_onboarded':
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-green-500 text-xl">✅</span>
              <h3 className="font-semibold text-green-800">Payouts Enabled</h3>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Ready for Payout</div>
              <div className="text-2xl font-bold text-green-600">
                ${(connectStatus.pending_earnings || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">Status</div>
              <div className="font-medium text-green-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Revenue Share</div>
              <div className="font-medium text-gray-900">70%</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Total Earned</div>
              <div className="font-medium text-gray-900">
                ${(connectStatus.total_earnings || 0).toFixed(2)}
              </div>
            </div>
          </div>

          <p className="text-green-700 text-sm">
            Your Stripe Connect account is fully set up. You'll receive monthly payouts on the 1st of each month.
          </p>

          <button
            onClick={checkConnectStatus}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Refresh Status
          </button>
        </div>
      )

    default:
      return (
        <div className="bg-gray-50 border rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Unknown Status</h3>
          <p className="text-gray-600 mb-4">{connectStatus.message}</p>
          <button
            onClick={checkConnectStatus}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Check Status
          </button>
        </div>
      )
  }
}