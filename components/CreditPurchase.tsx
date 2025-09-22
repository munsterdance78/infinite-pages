'use client'

import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CreditPackage {
  id: string
  name: string
  description: string
  credits_amount: number
  price_usd: number
  bonus_credits: number
  total_credits: number
  price_per_credit: number
  bonus_percentage: number
  is_best_value: boolean
  display_savings: string | null
}

interface CreditPurchaseProps {
  onSuccess?: (credits: number) => void
  onClose?: () => void
}

export default function CreditPurchase({ onSuccess, onClose }: CreditPurchaseProps) {
  return (
    <Elements stripe={stripePromise}>
      <CreditPurchaseForm onSuccess={onSuccess} onClose={onClose} />
    </Elements>
  )
}

function CreditPurchaseForm({ onSuccess, onClose }: CreditPurchaseProps) {
  const stripe = useStripe()
  const elements = useElements()
  const supabase = createClient()

  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'payment'>('select')

  useEffect(() => {
    fetchCreditPackages()
  }, [])

  const fetchCreditPackages = async () => {
    try {
      const response = await fetch('/api/credits/packages')
      const data = await response.json()

      if (response.ok) {
        setPackages(data.packages)
      } else {
        setError(data.error || 'Failed to load credit packages')
      }
    } catch (err) {
      setError('Failed to load credit packages')
    }
  }

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg)
    setStep('payment')
  }

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !selectedPackage) return

    setLoading(true)
    setError(null)

    try {
      // Create payment intent
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackage.id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed')
      }

      // Confirm payment
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not found')

      const { error: stripeError } = await stripe.confirmCardPayment(
        data.clientSecret,
        {
          payment_method: {
            card: cardElement
          }
        }
      )

      if (stripeError) {
        throw new Error(stripeError.message)
      }

      // Payment successful
      onSuccess?.(selectedPackage.total_credits)
      onClose?.()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {step === 'select' ? 'Buy Credits' : 'Payment Details'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {step === 'select' ? (
            <div className="space-y-3">
              <p className="text-gray-600 mb-4">
                Choose a credit package to continue reading and creating stories.
              </p>

              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors relative ${
                    pkg.is_best_value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handlePackageSelect(pkg)}
                >
                  {pkg.is_best_value && (
                    <div className="absolute -top-2 left-4 bg-blue-500 text-white px-2 py-1 text-xs rounded">
                      Best Value
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{pkg.name}</h3>
                      <p className="text-sm text-gray-600">{pkg.description}</p>
                      <div className="text-sm text-gray-500 mt-1">
                        {pkg.credits_amount} credits
                        {pkg.bonus_credits > 0 && (
                          <span className="text-green-600 font-medium">
                            {' '}+ {pkg.bonus_credits} bonus
                          </span>
                        )}
                      </div>
                      {pkg.display_savings && (
                        <div className="text-xs text-green-600 font-medium">
                          {pkg.display_savings}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">${pkg.price_usd}</div>
                      <div className="text-xs text-gray-500">
                        ${pkg.price_per_credit.toFixed(3)}/credit
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handlePayment}>
              {selectedPackage && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold">{selectedPackage.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedPackage.total_credits} credits for ${selectedPackage.price_usd}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Details
                </label>
                <div className="border border-gray-300 rounded-md p-3">
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#424770',
                          '::placeholder': {
                            color: '#aab7c4'
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!stripe || loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : `Pay $${selectedPackage?.price_usd}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}