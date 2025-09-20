'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StoryReaderProps {
  storyId: string
  chapterIds: number[]
  onPurchaseRequired?: () => void
}

interface AccessStatus {
  hasAccess: boolean
  unlockedChapters: number[]
  pricing: {
    pricePerChapter: number
    bundleDiscount: number
    premiumUnlockPrice: number
    freeChapters: number
  }
}

export default function StoryReader({ storyId, chapterIds, onPurchaseRequired }: StoryReaderProps) {
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPurchaseOptions, setShowPurchaseOptions] = useState(false)
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<'chapter' | 'bundle' | 'premium_unlock'>('chapter')

  useEffect(() => {
    checkAccess()
  }, [storyId, chapterIds])

  const checkAccess = async () => {
    try {
      // This would typically be a separate endpoint
      // For now, we'll simulate the access check
      setAccessStatus({
        hasAccess: false,
        unlockedChapters: [1, 2], // Free chapters
        pricing: {
          pricePerChapter: 5,
          bundleDiscount: 15,
          premiumUnlockPrice: 50,
          freeChapters: 2
        }
      })
    } catch (err) {
      setError('Failed to check access')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async () => {
    if (!accessStatus) return

    setPurchasing(true)
    setError(null)

    try {
      const response = await fetch(`/api/stories/${storyId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterIds,
          purchaseType: selectedPurchaseType
        })
      })

      const result = await response.json()

      if (response.ok) {
        if (result.accessGranted) {
          // Refresh access status
          await checkAccess()
          setShowPurchaseOptions(false)
        }
      } else {
        if (response.status === 402) {
          // Insufficient credits
          onPurchaseRequired?.()
        } else {
          setError(result.error || 'Purchase failed')
        }
      }
    } catch (err) {
      setError('Purchase failed')
    } finally {
      setPurchasing(false)
    }
  }

  const calculatePrice = () => {
    if (!accessStatus) return 0

    const newChapters = chapterIds.filter(id => !accessStatus.unlockedChapters.includes(id))

    switch (selectedPurchaseType) {
      case 'premium_unlock':
        return accessStatus.pricing.premiumUnlockPrice
      case 'bundle':
        const basePrice = accessStatus.pricing.pricePerChapter * newChapters.length
        return Math.round(basePrice * (1 - accessStatus.pricing.bundleDiscount / 100))
      default:
        return accessStatus.pricing.pricePerChapter * newChapters.length
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-600">
        {error}
      </div>
    )
  }

  if (!accessStatus) {
    return (
      <div className="p-4 text-gray-600">
        Unable to determine access status
      </div>
    )
  }

  // Check if user has access to all requested chapters
  const hasFullAccess = chapterIds.every(id => accessStatus.unlockedChapters.includes(id))
  const lockedChapters = chapterIds.filter(id => !accessStatus.unlockedChapters.includes(id))

  if (hasFullAccess) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <div className="flex items-center text-green-800">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          You have access to all chapters. Enjoy reading!
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Chapter Access Required</h3>
        <p className="text-gray-600">
          {lockedChapters.length} chapter(s) require purchase to continue reading.
        </p>
      </div>

      {!showPurchaseOptions ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border rounded-lg text-center">
              <div className="font-semibold">Per Chapter</div>
              <div className="text-lg text-blue-600">{accessStatus.pricing.pricePerChapter} credits</div>
              <div className="text-sm text-gray-600">each</div>
            </div>

            <div className="p-3 border rounded-lg text-center bg-blue-50">
              <div className="font-semibold">Bundle</div>
              <div className="text-lg text-blue-600">
                {Math.round(accessStatus.pricing.pricePerChapter * lockedChapters.length * (1 - accessStatus.pricing.bundleDiscount / 100))} credits
              </div>
              <div className="text-sm text-green-600">{accessStatus.pricing.bundleDiscount}% off</div>
            </div>

            <div className="p-3 border rounded-lg text-center">
              <div className="font-semibold">Premium Unlock</div>
              <div className="text-lg text-blue-600">{accessStatus.pricing.premiumUnlockPrice} credits</div>
              <div className="text-sm text-gray-600">All chapters</div>
            </div>
          </div>

          <button
            onClick={() => setShowPurchaseOptions(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Choose Purchase Option
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purchase Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="purchaseType"
                  value="chapter"
                  checked={selectedPurchaseType === 'chapter'}
                  onChange={(e) => setSelectedPurchaseType(e.target.value as any)}
                  className="mr-2"
                />
                <span>Individual Chapters ({lockedChapters.length} × {accessStatus.pricing.pricePerChapter} = {accessStatus.pricing.pricePerChapter * lockedChapters.length} credits)</span>
              </label>

              {lockedChapters.length > 1 && (
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="purchaseType"
                    value="bundle"
                    checked={selectedPurchaseType === 'bundle'}
                    onChange={(e) => setSelectedPurchaseType(e.target.value as any)}
                    className="mr-2"
                  />
                  <span>Bundle ({lockedChapters.length} chapters for {calculatePrice()} credits - {accessStatus.pricing.bundleDiscount}% off)</span>
                </label>
              )}

              <label className="flex items-center">
                <input
                  type="radio"
                  name="purchaseType"
                  value="premium_unlock"
                  checked={selectedPurchaseType === 'premium_unlock'}
                  onChange={(e) => setSelectedPurchaseType(e.target.value as any)}
                  className="mr-2"
                />
                <span>Premium Unlock (All current and future chapters for {accessStatus.pricing.premiumUnlockPrice} credits)</span>
              </label>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Cost:</span>
              <span className="text-lg font-bold text-blue-600">
                {calculatePrice()} credits
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowPurchaseOptions(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              disabled={purchasing}
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={purchasing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {purchasing ? 'Processing...' : `Purchase for ${calculatePrice()} credits`}
            </button>
          </div>
        </div>
      )}

      {accessStatus.unlockedChapters.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
          <div className="text-sm text-green-800">
            ✓ You already have access to chapters: {accessStatus.unlockedChapters.join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}