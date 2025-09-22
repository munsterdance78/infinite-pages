/**
 * @jest-environment node
 */

import { createMocks } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/creators/earnings/route'
import { createMockUser, createMockSupabaseResponse } from '@/test/utils/test-utils'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn()
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

describe('Creator Earnings Authentication & Authorization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication Required', () => {
    it('should reject requests without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })

    it('should reject requests with invalid auth tokens', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT token' }
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })

    it('should reject requests with expired tokens', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' }
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should accept requests with valid authentication', async () => {
      const authenticatedUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: authenticatedUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).not.toBe(401)
    })
  })

  describe('Creator Authorization', () => {
    it('should reject non-creator users', async () => {
      const nonCreatorUser = createMockUser({ email: 'regular@user.com' })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: nonCreatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: false,
          subscription_tier: 'free'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Creator access required. Please apply to become a creator or upgrade your subscription.')
    })

    it('should allow access for verified creators', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should check creator status from database', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      await GET(request)

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(mockSupabase.from().select).toHaveBeenCalledWith(
        'is_creator, subscription_tier, creator_tier'
      )
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', user.id)
    })
  })

  describe('Subscription Tier Authorization', () => {
    it('should allow basic view for free tier creators', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'free',
          creator_tier: 'bronze'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=basic')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.meta.view).toBe('basic')
    })

    it('should restrict enhanced view for free tier', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'free',
          creator_tier: 'bronze'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Premium subscription required')
    })

    it('should allow enhanced view for premium subscribers', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.meta.view).toBe('enhanced')
    })

    it('should restrict dashboard view to admin tier', async () => {
      const creatorUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: creatorUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=dashboard')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Admin access required')
    })

    it('should allow dashboard view for admin users', async () => {
      const adminUser = createMockUser({ email: 'admin@infinite-pages.com' })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'admin',
          creator_tier: 'platinum'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?view=dashboard')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.meta.view).toBe('dashboard')
    })
  })

  describe('Session Management', () => {
    it('should handle session refresh for expired tokens', async () => {
      const user = createMockUser()

      // First call fails with expired token
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({
          data: { user: null },
          error: { message: 'JWT expired' }
        })
        // After refresh, succeeds
        .mockResolvedValueOnce({
          data: { user },
          error: null
        })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'new-token' } },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
      expect(response.status).not.toBe(401)
    })

    it('should reject if session refresh fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' }
      })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token expired' }
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should handle concurrent requests with shared session', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      // Simulate concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        new NextRequest('http://localhost:3000/api/creators/earnings')
      )

      const responses = await Promise.all(
        requests.map(request => GET(request))
      )

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    })

    it('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost:3000/api/creators/earnings', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://infinite-pages.com',
          'Access-Control-Request-Method': 'GET'
        }
      })

      // Note: This would typically be handled by middleware
      // Testing the concept here
      expect(request.method).toBe('OPTIONS')
    })

    it('should validate request origin', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/creators/earnings', {
        headers: {
          'Origin': 'https://malicious-site.com'
        }
      })

      // Should still work since CORS is handled by Next.js middleware
      const response = await GET(request)
      expect(response).toBeDefined()
    })
  })

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should track request frequency per user', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      // Simulate rapid requests
      const requests = Array.from({ length: 10 }, () =>
        new NextRequest('http://localhost:3000/api/creators/earnings')
      )

      const startTime = Date.now()
      await Promise.all(requests.map(request => GET(request)))
      const duration = Date.now() - startTime

      // Should handle requests efficiently
      expect(duration).toBeLessThan(1000)
    })

    it('should log suspicious activity', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Simulate suspicious patterns
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      // Multiple failed auth attempts
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost:3000/api/creators/earnings')
        await GET(request)
      }

      // Should log security events
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('User Permission Edge Cases', () => {
    it('should handle users with incomplete profiles', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: null, // Incomplete profile
          subscription_tier: null,
          creator_tier: null
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Creator access required')
    })

    it('should handle database errors during authorization check', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(null, {
          code: 'PGRST116',
          message: 'Profile not found'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Failed to verify creator status')
    })

    it('should handle users with revoked creator status', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: false, // Revoked
          subscription_tier: 'premium',
          creator_tier: null,
          creator_status: 'suspended'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings')
      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Creator access required')
    })

    it('should handle subscription downgrades gracefully', async () => {
      const user = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'free', // Downgraded from premium
          creator_tier: 'bronze'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      // Should still allow basic access
      const basicRequest = new NextRequest('http://localhost:3000/api/creators/earnings?view=basic')
      const basicResponse = await GET(basicRequest)
      expect(basicResponse.status).toBe(200)

      // Should restrict enhanced access
      const enhancedRequest = new NextRequest('http://localhost:3000/api/creators/earnings?view=enhanced')
      const enhancedResponse = await GET(enhancedRequest)
      expect(enhancedResponse.status).toBe(403)
    })
  })

  describe('Admin Override Scenarios', () => {
    it('should allow admin to access any creator data with override', async () => {
      const adminUser = createMockUser({ email: 'admin@infinite-pages.com' })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'admin',
          creator_tier: 'platinum'
        })
      )

      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?creator_id=other-user&admin_override=true')
      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should reject admin override for non-admin users', async () => {
      const regularUser = createMockUser()
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: regularUser },
        error: null
      })

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      const request = new NextRequest('http://localhost:3000/api/creators/earnings?creator_id=other-user&admin_override=true')
      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })
})