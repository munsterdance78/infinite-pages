/**
 * @jest-environment node
 */

import { createMocks } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { GET as LegacyCreatorEarnings } from '@/app/api/creator/earnings/route'
import { GET as LegacyEnhancedEarnings } from '@/app/api/creators/earnings/enhanced/route'
import { createMockUser } from '@/test/utils/test-utils'

// Mock the unified endpoint
const mockUnifiedResponse = {
  summary: {
    totalEarningsUsd: 1250.75,
    pendingPayoutUsd: 125.50,
    totalCreditsEarned: 12507,
    uniqueReaders: 45,
    storiesWithEarnings: 8
  },
  storyPerformance: [],
  recentTransactions: [],
  meta: {
    view: 'basic',
    apiVersion: '2.0.0',
    cached: false
  }
}

// Mock fetch for internal API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockUnifiedResponse),
    headers: new Headers()
  })
) as jest.Mock

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn()
  })),
  rpc: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase
}))

jest.mock('next/headers', () => ({
  cookies: () => new Map()
}))

describe('Deprecated Endpoints Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUnifiedResponse),
      headers: new Headers()
    })
  })

  describe('/api/creator/earnings (Legacy Endpoint)', () => {
    it('should include deprecation headers', async () => {
      // Mock successful auth
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      const response = await LegacyCreatorEarnings(request)

      expect(response.headers.get('X-API-Deprecated')).toBe('true')
      expect(response.headers.get('X-API-Deprecation-Date')).toBeDefined()
      expect(response.headers.get('X-API-Removal-Date')).toBeDefined()
      expect(response.headers.get('X-API-Migration-Guide')).toBe('/api/creators/earnings')
      expect(response.headers.get('Warning')).toContain('deprecated')
    })

    it('should redirect to unified endpoint with correct parameters', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings?include_history=true&history_limit=10')
      const response = await LegacyCreatorEarnings(request)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/creators/earnings'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Cookie': ''
          })
        })
      )

      // Verify parameter mapping
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('view=enhanced')
      expect(fetchCall).toContain('limit=10')
      expect(fetchCall).toContain('legacy_format=true')
    })

    it('should fallback to original logic if unified endpoint fails', async () => {
      // Mock fetch failure
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Fetch failed'))

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Mock other database calls
      mockSupabase.rpc.mockResolvedValue({ data: [{}], error: null })
      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      const response = await LegacyCreatorEarnings(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-API-Deprecated')).toBe('true')
    })

    it('should log deprecation usage', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      await LegacyCreatorEarnings(request)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED ENDPOINT USAGE: /api/creator/earnings')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('/api/creators/earnings/enhanced (Legacy Enhanced Endpoint)', () => {
    it('should include deprecation headers', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced')
      const response = await LegacyEnhancedEarnings(request)

      expect(response.headers.get('X-API-Deprecated')).toBe('true')
      expect(response.headers.get('X-API-Migration-Guide')).toBe('/api/creators/earnings?view=enhanced')
      expect(response.headers.get('Warning')).toContain('deprecated')
    })

    it('should map period parameter correctly', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced?period=last_month')
      const response = await LegacyEnhancedEarnings(request)

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('view=enhanced')
      expect(fetchCall).toContain('period=last_month')
      expect(fetchCall).toContain('legacy_format=enhanced')
    })

    it('should handle all supported period values', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const periods = ['current_month', 'last_month', 'last_3_months', 'all_time']

      for (const period of periods) {
        jest.clearAllMocks()

        const request = new NextRequest(`http://localhost:3000/api/creators/earnings/enhanced?period=${period}`)
        const response = await LegacyEnhancedEarnings(request)

        expect(response.status).toBe(200)
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
        expect(fetchCall).toContain(`period=${period}`)
      }
    })

    it('should fallback to original enhanced logic if unified endpoint fails', async () => {
      // Mock fetch failure
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Fetch failed'))

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      // Mock database responses for fallback
      mockSupabase.from().single.mockResolvedValue({
        data: {
          is_creator: true,
          creator_tier: 'gold',
          total_earnings_usd: 1250.75,
          pending_payout_usd: 125.50,
          follower_count: 45
        },
        error: null
      })

      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: [], error: null })
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced')
      const response = await LegacyEnhancedEarnings(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('X-API-Deprecated')).toBe('true')
    })

    it('should log deprecation usage', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced')
      await LegacyEnhancedEarnings(request)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED ENDPOINT USAGE: /api/creators/earnings/enhanced')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Migration Compatibility', () => {
    it('should maintain response structure compatibility for basic endpoint', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      const response = await LegacyCreatorEarnings(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('summary')
      expect(data.meta.apiVersion).toBe('2.0.0')
    })

    it('should maintain response structure compatibility for enhanced endpoint', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced')
      const response = await LegacyEnhancedEarnings(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('summary')
    })

    it('should handle authentication errors consistently', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const legacyRequest = new NextRequest('http://localhost:3000/api/creator/earnings')
      const enhancedRequest = new NextRequest('http://localhost:3000/api/creators/earnings/enhanced')

      const legacyResponse = await LegacyCreatorEarnings(legacyRequest)
      const enhancedResponse = await LegacyEnhancedEarnings(enhancedRequest)

      expect(legacyResponse.status).toBe(401)
      expect(enhancedResponse.status).toBe(401)
    })
  })

  describe('Error Handling in Deprecated Endpoints', () => {
    it('should handle network errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      // Mock fallback data
      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      const response = await LegacyCreatorEarnings(request)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error calling new unified endpoint:',
        expect.any(Error)
      )
      expect(response.status).toBe(200) // Should fallback successfully

      consoleSpy.mockRestore()
    })

    it('should handle unified endpoint HTTP errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      // Mock fallback data
      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creator/earnings')
      const response = await LegacyCreatorEarnings(request)

      expect(response.status).toBe(200) // Should fallback successfully
      expect(response.headers.get('X-API-Deprecated')).toBe('true')
    })
  })
})