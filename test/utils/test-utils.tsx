import type { ReactElement } from 'react'
import React from 'react'
import type { RenderOptions } from '@testing-library/react'
import { render } from '@testing-library/react'
import { jest } from '@jest/globals'

// Mock Next.js components
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  }
}))

// Test data generators
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  subscription_tier: 'premium',
  is_creator: true,
  creator_tier: 'gold',
  ...overrides
})

export const createMockEarningsData = (overrides = {}) => ({
  summary: {
    totalEarningsUsd: 1250.75,
    pendingPayoutUsd: 125.50,
    totalCreditsEarned: 12507,
    uniqueReaders: 45,
    storiesWithEarnings: 8,
    averageEarningsPerStory: 156.34,
    lifetimeEarnings: 5000.00,
    creatorSharePercentage: 70,
    ...overrides.summary
  },
  storyPerformance: [
    {
      story_id: 'story-1',
      story_title: 'Test Story 1',
      total_credits: 500,
      total_usd: 17.50,
      unique_readers: 15,
      purchase_count: 20,
      latest_purchase: '2024-01-15T10:00:00Z'
    },
    {
      story_id: 'story-2',
      story_title: 'Test Story 2',
      total_credits: 300,
      total_usd: 10.50,
      unique_readers: 10,
      purchase_count: 12,
      latest_purchase: '2024-01-14T15:30:00Z'
    },
    ...(overrides.storyPerformance || [])
  ],
  recentTransactions: [
    {
      id: 'txn-1',
      storyTitle: 'Test Story 1',
      readerEmail: 'reader1@test.com',
      creditsEarned: 35,
      usdEquivalent: 1.23,
      purchaseType: 'story_access',
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'txn-2',
      storyTitle: 'Test Story 2',
      readerEmail: 'reader2@test.com',
      creditsEarned: 25,
      usdEquivalent: 0.88,
      purchaseType: 'story_access',
      createdAt: '2024-01-14T15:30:00Z'
    },
    ...(overrides.recentTransactions || [])
  ],
  monthlyTrend: [
    { month: 'Dec 2023', credits_earned: 800, usd_earned: 28.00, stories_sold: 15 },
    { month: 'Jan 2024', credits_earned: 1200, usd_earned: 42.00, stories_sold: 22 },
    ...(overrides.monthlyTrend || [])
  ],
  profile: {
    creatorTier: 'gold',
    subscriptionTier: 'premium',
    isCreator: true,
    ...overrides.profile
  },
  meta: {
    view: 'enhanced',
    period: 'current_month',
    responseTime: 45,
    cached: false,
    cacheAge: 0,
    ...overrides.meta
  }
})

// Mock Supabase response
export const createMockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK'
})

// Mock API response
export const createMockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: async () => data,
  headers: new Headers({
    'Content-Type': 'application/json'
  })
})

// Wrapper for testing components with common providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Utility functions for testing
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 100))

export const mockFetch = (response: any, status = 200) => {
  const mockResponse = createMockApiResponse(response, status)
  global.fetch = jest.fn().mockResolvedValue(mockResponse)
  return fetch as jest.MockedFunction<typeof fetch>
}

export const expectElementToBeInDocument = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument()
}

export const expectElementNotToBeInDocument = (element: HTMLElement | null) => {
  expect(element).not.toBeInTheDocument()
}