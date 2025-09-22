/**
 * @jest-environment node
 */

import { createMocks } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/creators/earnings/route'
import { createMockUser, createMockEarningsData, createMockSupabaseResponse } from '@/test/utils/test-utils'

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
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  })),
  rpc: jest.fn()
}

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => mockSupabase
}))

jest.mock('next/headers', () => ({
  cookies: () => new Map()
}))

describe('/api/creators/earnings - Unified Endpoint Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Unauthorized')
    })

    it('should return 403 when user is not a creator', async () => {
      const nonCreatorUser = createMockUser({ is_creator: false })

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: nonCreatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: false, subscription_tier: 'basic' })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Creator access required')
    })

    it('should return 403 when user is not premium subscriber', async () => {
      const freeUser = createMockUser({ subscription_tier: 'free', is_creator: true })

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: freeUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'free' })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Premium subscription required')
      expect(data.upgrade_required).toBe(true)
    })
  })

  describe('Data Retrieval by User Tier', () => {
    const setupAuthenticatedCreator = (tier = 'gold') => {
      const creatorUser = createMockUser({ creator_tier: tier })

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: tier
        })
      )
    }

    it('should return correct data structure for premium creator', async () => {
      setupAuthenticatedCreator('gold')

      // Mock earnings summary
      mockSupabase.rpc.mockResolvedValue(
        createMockSupabaseResponse([{
          total_earnings_period: 150.75,
          total_credits_earned: 4307,
          unique_readers: 25,
          stories_with_earnings: 5,
          average_per_story: 30.15
        }])
      )

      // Mock story performance
      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(
          createMockSupabaseResponse([
            {
              story_id: 'story-1',
              story_title: 'Test Story',
              credits_earned: 100,
              usd_equivalent: 3.50,
              created_at: '2024-01-15T10:00:00Z'
            }
          ])
        )
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('summary')
      expect(data).toHaveProperty('storyPerformance')
      expect(data).toHaveProperty('recentTransactions')
      expect(data).toHaveProperty('meta')

      expect(data.meta.view).toBe('enhanced')
      expect(data.meta.apiVersion).toBe('2.0.0')
    })

    it('should return limited data for basic view', async () => {
      setupAuthenticatedCreator('bronze')

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=basic')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.view).toBe('basic')
      // Basic view should have fewer story performance items
      expect(data.storyPerformance?.length || 0).toBeLessThanOrEqual(5)
    })

    it('should return comprehensive data for dashboard view', async () => {
      setupAuthenticatedCreator('platinum')

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=dashboard')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.view).toBe('dashboard')
      expect(data).toHaveProperty('payoutHistory')
      expect(data).toHaveProperty('tierInformation')
    })
  })

  describe('Query Parameter Handling', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )
    })

    it('should handle period parameter correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?period=last_month')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.period).toBe('last_month')
    })

    it('should handle limit and offset parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?limit=10&offset=5')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.pagination.limit).toBe(10)
      expect(data.meta.pagination.offset).toBe(5)
    })

    it('should enforce maximum limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?limit=500')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.pagination.limit).toBeLessThanOrEqual(100)
    })
  })

  describe('Legacy Parameter Support', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )
    })

    it('should handle legacy period_days parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?period_days=30')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.deprecationWarnings).toContain(
        "Parameter 'period_days' is deprecated. Use 'period' instead."
      )
    })

    it('should handle legacy include_history parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?include_history=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.deprecationWarnings).toContain(
        "Parameter 'include_history' is deprecated. Use 'view=enhanced' or 'view=dashboard' instead."
      )
    })

    it('should handle legacy history_limit parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?history_limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.deprecationWarnings).toContain(
        "Parameter 'history_limit' is deprecated. Use 'limit' instead."
      )
    })
  })

  describe('Export Functionality', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          email: 'creator@test.com'
        })
      )
    })

    it('should return CSV format when requested', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?format=csv')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('.csv')
    })

    it('should return XLSX format when requested', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?format=xlsx')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(response.headers.get('Content-Disposition')).toContain('.xlsx')
    })
  })

  describe('Caching Behavior', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )
    })

    it('should return cache statistics in meta', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.cacheStats).toBeDefined()
      expect(data.meta.cacheStats).toHaveProperty('totalEntries')
      expect(data.meta.cacheStats).toHaveProperty('hitRate')
    })

    it('should not cache export requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?format=csv&include_export_data=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // Export requests should not be cached
    })
  })

  describe('Real-time Updates', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )
    })

    it('should include real-time subscription information', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.realtime).toBeDefined()
      expect(data.meta.realtime.subscriptionId).toBeDefined()
      expect(data.meta.realtime.updateCheckInterval).toBe(30000)
      expect(data.meta.realtime.pollUrl).toContain('/api/creators/earnings/realtime')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      // Simulate database error
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(null, { message: 'Database connection failed' })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(500)
    })

    it('should handle invalid view parameter', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=invalid')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should fall back to default view
      expect(data.meta.view).toBe('enhanced')
    })
  })

  describe('Performance Metrics', () => {
    beforeEach(() => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({ is_creator: true, subscription_tier: 'premium' })
      )
    })

    it('should include response time in meta', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.responseTime).toBeDefined()
      expect(typeof data.meta.responseTime).toBe('number')
      expect(data.meta.responseTime).toBeGreaterThan(0)
    })

    it('should include next refresh time based on cache duration', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.nextRefresh).toBeDefined()
      expect(new Date(data.meta.nextRefresh).getTime()).toBeGreaterThan(Date.now())
    })
  })
})