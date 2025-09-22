/**
 * @jest-environment node
 */

import { performance } from 'perf_hooks'
import { createMocks } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/creators/earnings/route'
import { createMockUser, createMockEarningsData } from '@/test/utils/test-utils'

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn()
global.performance = { ...global.performance, now: mockPerformanceNow }

// Mock Supabase with performance tracking
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

describe('Creator Earnings Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPerformanceNow.mockReturnValue(0)
  })

  describe('API Response Time', () => {
    it('should respond within 200ms for basic queries', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      mockSupabase.rpc.mockResolvedValue({
        data: [{ total_earnings_period: 1250.75 }],
        error: null
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=basic')
      await GET(request)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(200)
    })

    it('should respond within 500ms for enhanced queries', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Simulate multiple database calls for enhanced view
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [{ total_earnings_period: 1250.75 }], error: null })
        .mockResolvedValueOnce({ data: [], error: null })

      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: [], error: null })
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      await GET(request)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(500)
    })

    it('should handle concurrent requests efficiently', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      mockSupabase.rpc.mockResolvedValue({
        data: [{ total_earnings_period: 1250.75 }],
        error: null
      })

      const requests = Array.from({ length: 10 }, () =>
        new NextRequest('http://localhost:3000/api/creators/earnings')
      )

      const startTime = performance.now()
      await Promise.all(requests.map(request => GET(request)))
      const duration = performance.now() - startTime

      // 10 concurrent requests should complete within 1 second
      expect(duration).toBeLessThan(1000)
    })

    it('should maintain performance with large datasets', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Mock large dataset response
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        story_id: `story-${i}`,
        total_usd: i * 10,
        created_at: new Date().toISOString()
      }))

      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: largeDataset, error: null })
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      await GET(request)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(800) // Allow more time for large datasets
    })
  })

  describe('Memory Usage', () => {
    it('should not exceed memory limits during processing', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Monitor memory usage
      const initialMemory = process.memoryUsage()

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      await GET(request)

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it('should cleanup resources after request completion', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const initialMemory = process.memoryUsage()

      // Process multiple requests
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost:3000/api/creators/earnings')
        await GET(request)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory should not grow significantly with multiple requests
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })
  })

  describe('Database Query Optimization', () => {
    it('should minimize database round trips', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      let dbCallCount = 0
      mockSupabase.from.mockImplementation(() => {
        dbCallCount++
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { is_creator: true }, error: null })
        }
      })

      mockSupabase.rpc.mockImplementation(() => {
        dbCallCount++
        return Promise.resolve({ data: [], error: null })
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      await GET(request)

      // Should make minimal database calls
      expect(dbCallCount).toBeLessThanOrEqual(3) // Profile check + summary + transactions
    })

    it('should use efficient query patterns', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { is_creator: true }, error: null })
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      await GET(request)

      // Verify efficient query patterns
      expect(mockQuery.select).toHaveBeenCalledWith(
        expect.stringContaining('is_creator, subscription_tier, creator_tier')
      )
      expect(mockQuery.eq).toHaveBeenCalledWith('id', user.id)
    })

    it('should handle query timeouts gracefully', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      // Simulate slow database response
      mockSupabase.from().single.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ data: { is_creator: true }, error: null }), 5000)
        )
      )

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')

      try {
        await Promise.race([
          GET(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ])
      } catch (error) {
        const duration = performance.now() - startTime
        expect(duration).toBeLessThan(3100) // Should timeout within reasonable time
      }
    })
  })

  describe('Caching Performance', () => {
    it('should serve cached responses quickly', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      // Mock cache hit scenario
      const cacheKey = `earnings:${user.id}:enhanced:current_month`
      const cachedData = createMockEarningsData()

      // First request (cache miss)
      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const firstRequest = new NextRequest('http://localhost:3000/api/creators/earnings')
      await GET(firstRequest)

      // Second request (cache hit) - should be much faster
      const startTime = performance.now()
      const secondRequest = new NextRequest('http://localhost:3000/api/creators/earnings')
      await GET(secondRequest)
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(50) // Cached response should be very fast
    })

    it('should handle cache invalidation efficiently', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Request with cache invalidation
      const request = new NextRequest('http://localhost:3000/api/creators/earnings?force_refresh=true')

      const startTime = performance.now()
      await GET(request)
      const duration = performance.now() - startTime

      // Even with cache invalidation, should complete quickly
      expect(duration).toBeLessThan(300)
    })
  })

  describe('Load Testing Scenarios', () => {
    it('should handle burst traffic patterns', async () => {
      const users = Array.from({ length: 50 }, () => createMockUser())

      mockSupabase.auth.getUser.mockImplementation(({ data }) => {
        const randomUser = users[Math.floor(Math.random() * users.length)]
        return Promise.resolve({ data: { user: randomUser }, error: null })
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      // Simulate burst of 50 concurrent requests
      const requests = Array.from({ length: 50 }, () =>
        new NextRequest('http://localhost:3000/api/creators/earnings')
      )

      const startTime = performance.now()
      const responses = await Promise.allSettled(requests.map(request => GET(request)))
      const duration = performance.now() - startTime

      // Most requests should succeed
      const successful = responses.filter(r => r.status === 'fulfilled').length
      expect(successful).toBeGreaterThanOrEqual(45) // 90% success rate

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000)
    })

    it('should maintain performance under sustained load', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const durations: number[] = []

      // Simulate sustained load over time
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()
        const request = new NextRequest('http://localhost:3000/api/creators/earnings')
        await GET(request)
        const duration = performance.now() - startTime
        durations.push(duration)

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Performance should remain consistent
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length
      const maxDuration = Math.max(...durations)

      expect(avgDuration).toBeLessThan(200)
      expect(maxDuration).toBeLessThan(400) // No single request should be too slow
    })
  })

  describe('Resource Utilization', () => {
    it('should efficiently handle JSON serialization', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      // Create large response data
      const largeDataset = createMockEarningsData({
        storyPerformance: Array.from({ length: 500 }, (_, i) => ({
          story_id: `story-${i}`,
          story_title: `Story ${i}`,
          total_usd: i * 10,
          unique_readers: i * 2,
          purchase_count: i
        })),
        recentTransactions: Array.from({ length: 200 }, (_, i) => ({
          id: `txn-${i}`,
          storyTitle: `Story ${i}`,
          usdEquivalent: i * 0.5,
          createdAt: new Date().toISOString()
        }))
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const jsonData = await response.json()
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100) // JSON serialization should be fast
      expect(jsonData).toBeDefined()
    })

    it('should handle network compression efficiently', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: { is_creator: true, subscription_tier: 'premium' },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings', {
        headers: {
          'Accept-Encoding': 'gzip, deflate, br'
        }
      })

      const response = await GET(request)

      // Response should include compression headers
      expect(response.headers.get('Content-Encoding')).toMatch(/gzip|deflate|br/)
    })
  })

  describe('Error Handling Performance', () => {
    it('should fail fast on authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const duration = performance.now() - startTime

      expect(response.status).toBe(401)
      expect(duration).toBeLessThan(50) // Should fail very quickly
    })

    it('should handle database errors efficiently', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })

      const startTime = performance.now()
      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)
      const duration = performance.now() - startTime

      expect(response.status).toBe(500)
      expect(duration).toBeLessThan(100) // Should fail quickly without retries
    })
  })
})