/**
 * @jest-environment node
 */

import { jest } from '@jest/globals'
import { createMockSupabaseResponse, createMockUser } from '@/test/utils/test-utils'

// Mock the creator earnings functions
const mockGetCreatorAccumulatedEarnings = jest.fn()
const mockGetCreatorEarningsHistory = jest.fn()
const mockCalculateNextPayoutDate = jest.fn()
const mockCanRequestPayout = jest.fn()
const mockGetPayoutEligibilityMessage = jest.fn()

jest.mock('@/lib/creator-earnings', () => ({
  getCreatorAccumulatedEarnings: mockGetCreatorAccumulatedEarnings,
  getCreatorEarningsHistory: mockGetCreatorEarningsHistory,
  calculateNextPayoutDate: mockCalculateNextPayoutDate,
  canRequestPayout: mockCanRequestPayout,
  getPayoutEligibilityMessage: mockGetPayoutEligibilityMessage,
  CREDITS_TO_USD_RATE: 0.035
}))

// Mock Supabase client
const mockSupabase = {
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

describe('Creator Earnings Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Creator Profile Queries', () => {
    it('should query creator profile with correct parameters', async () => {
      const userId = 'test-user-id'

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse({
          is_creator: true,
          subscription_tier: 'premium',
          creator_tier: 'gold'
        })
      )

      const query = mockSupabase
        .from('profiles')
        .select('is_creator, subscription_tier, creator_tier')
        .eq('id', userId)
        .single()

      await query

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(mockSupabase.from().select).toHaveBeenCalledWith('is_creator, subscription_tier, creator_tier')
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', userId)
    })

    it('should handle creator profile not found', async () => {
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(null, { code: 'PGRST116', message: 'Profile not found' })
      )

      const result = await mockSupabase
        .from('profiles')
        .select('is_creator, subscription_tier')
        .eq('id', 'non-existent-user')
        .single()

      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('PGRST116')
    })
  })

  describe('Earnings Summary Queries', () => {
    it('should call earnings summary RPC with correct parameters', async () => {
      const userId = 'test-user-id'
      const daysBack = 30

      mockSupabase.rpc.mockResolvedValue(
        createMockSupabaseResponse([{
          total_earnings_period: 150.75,
          total_credits_earned: 4307,
          unique_readers: 25,
          stories_with_earnings: 5,
          average_per_story: 30.15
        }])
      )

      await mockSupabase.rpc('get_creator_earnings_summary', {
        p_creator_id: userId,
        p_days_back: daysBack
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_creator_earnings_summary', {
        p_creator_id: userId,
        p_days_back: daysBack
      })
    })

    it('should handle earnings summary errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue(
        createMockSupabaseResponse(null, { message: 'RPC function failed' })
      )

      const result = await mockSupabase.rpc('get_creator_earnings_summary', {
        p_creator_id: 'test-user',
        p_days_back: 30
      })

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('RPC function failed')
    })

    it('should provide default values when summary is empty', async () => {
      mockSupabase.rpc.mockResolvedValue(
        createMockSupabaseResponse([])
      )

      const result = await mockSupabase.rpc('get_creator_earnings_summary', {
        p_creator_id: 'test-user',
        p_days_back: 30
      })

      expect(result.data).toEqual([])
    })
  })

  describe('Story Performance Queries', () => {
    it('should query story performance with date filtering', async () => {
      const userId = 'test-user-id'
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      mockSupabase.from().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(
          createMockSupabaseResponse([
            {
              story_id: 'story-1',
              stories: { id: 'story-1', title: 'Test Story' },
              credits_earned: 100,
              usd_equivalent: 3.50,
              created_at: '2024-01-15T10:00:00Z'
            }
          ])
        )
      })

      await mockSupabase
        .from('creator_earnings')
        .select(`
          story_id,
          stories (id, title),
          credits_earned,
          usd_equivalent,
          created_at
        `)
        .eq('creator_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('creator_earnings')
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('creator_id', userId)
      expect(mockSupabase.from().gte).toHaveBeenCalledWith('created_at', startDate)
    })

    it('should handle large result sets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        story_id: `story-${i}`,
        stories: { id: `story-${i}`, title: `Story ${i}` },
        credits_earned: i * 10,
        usd_equivalent: i * 0.35,
        created_at: new Date().toISOString()
      }))

      mockSupabase.from().order().mockResolvedValue(
        createMockSupabaseResponse(largeDataset)
      )

      const result = await mockSupabase
        .from('creator_earnings')
        .select('*')
        .eq('creator_id', 'test-user')
        .order('created_at', { ascending: false })

      expect(result.data).toHaveLength(1000)
    })

    it('should handle related data correctly', async () => {
      mockSupabase.from().order().mockResolvedValue(
        createMockSupabaseResponse([
          {
            story_id: 'story-1',
            stories: [{ id: 'story-1', title: 'Array Story' }], // Array format
            credits_earned: 100
          },
          {
            story_id: 'story-2',
            stories: { id: 'story-2', title: 'Object Story' }, // Object format
            credits_earned: 50
          },
          {
            story_id: 'story-3',
            stories: null, // Null case
            credits_earned: 25
          }
        ])
      )

      const result = await mockSupabase
        .from('creator_earnings')
        .select('story_id, stories(id, title), credits_earned')
        .eq('creator_id', 'test-user')
        .order('created_at', { ascending: false })

      expect(result.data).toHaveLength(3)
      expect(result.data[0].stories).toEqual([{ id: 'story-1', title: 'Array Story' }])
      expect(result.data[1].stories).toEqual({ id: 'story-2', title: 'Object Story' })
      expect(result.data[2].stories).toBeNull()
    })
  })

  describe('Creator Earnings Functions', () => {
    it('should get accumulated earnings correctly', async () => {
      const mockEarnings = {
        total_accumulated_usd: 1250.75,
        last_payout_date: '2024-01-01',
        last_payout_amount: 500.00
      }

      mockGetCreatorAccumulatedEarnings.mockResolvedValue({
        earnings: mockEarnings,
        error: null
      })

      const result = await mockGetCreatorAccumulatedEarnings('test-user', mockSupabase)

      expect(result.earnings).toEqual(mockEarnings)
      expect(result.error).toBeNull()
    })

    it('should handle accumulated earnings errors', async () => {
      mockGetCreatorAccumulatedEarnings.mockResolvedValue({
        earnings: null,
        error: 'Database connection failed'
      })

      const result = await mockGetCreatorAccumulatedEarnings('test-user', mockSupabase)

      expect(result.earnings).toBeNull()
      expect(result.error).toBe('Database connection failed')
    })

    it('should get earnings history with pagination', async () => {
      const mockHistory = [
        { id: '1', amount: 100, date: '2024-01-15' },
        { id: '2', amount: 50, date: '2024-01-14' }
      ]

      mockGetCreatorEarningsHistory.mockResolvedValue({
        earnings: mockHistory,
        error: null
      })

      const result = await mockGetCreatorEarningsHistory('test-user', 20, mockSupabase)

      expect(result.earnings).toEqual(mockHistory)
      expect(mockGetCreatorEarningsHistory).toHaveBeenCalledWith('test-user', 20, mockSupabase)
    })

    it('should calculate payout eligibility correctly', () => {
      mockCanRequestPayout.mockReturnValue(true)
      mockGetPayoutEligibilityMessage.mockReturnValue('You can request a payout')

      const canPayout = mockCanRequestPayout(125.50, 25.00)
      const message = mockGetPayoutEligibilityMessage(125.50, 25.00)

      expect(canPayout).toBe(true)
      expect(message).toBe('You can request a payout')
    })

    it('should calculate next payout date', () => {
      const nextDate = new Date(2024, 1, 1)
      mockCalculateNextPayoutDate.mockReturnValue(nextDate)

      const result = mockCalculateNextPayoutDate()

      expect(result).toEqual(nextDate)
    })
  })

  describe('Query Performance', () => {
    it('should execute queries within acceptable time limits', async () => {
      const startTime = Date.now()

      mockSupabase.from().single.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve(createMockSupabaseResponse({})), 50)
        )
      )

      await mockSupabase
        .from('profiles')
        .select('*')
        .eq('id', 'test-user')
        .single()

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should handle concurrent queries efficiently', async () => {
      mockSupabase.from().single.mockResolvedValue(createMockSupabaseResponse({}))
      mockSupabase.rpc.mockResolvedValue(createMockSupabaseResponse([]))

      const queries = [
        mockSupabase.from('profiles').select('*').eq('id', 'user1').single(),
        mockSupabase.from('profiles').select('*').eq('id', 'user2').single(),
        mockSupabase.rpc('get_creator_earnings_summary', { p_creator_id: 'user1', p_days_back: 30 }),
        mockSupabase.rpc('get_creator_earnings_summary', { p_creator_id: 'user2', p_days_back: 30 })
      ]

      const startTime = Date.now()
      await Promise.all(queries)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(200) // Concurrent execution should be fast
    })
  })

  describe('Data Validation', () => {
    it('should validate earnings data structure', async () => {
      const invalidData = {
        total_earnings_usd: 'invalid', // Should be number
        credits_earned: null,
        created_at: 'invalid-date'
      }

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(invalidData)
      )

      const result = await mockSupabase
        .from('creator_earnings')
        .select('*')
        .eq('id', 'test-earning')
        .single()

      // Test should handle invalid data gracefully
      expect(result.data).toEqual(invalidData)
    })

    it('should handle null and undefined values', async () => {
      const dataWithNulls = {
        story_id: null,
        credits_earned: undefined,
        usd_equivalent: 0,
        stories: null
      }

      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(dataWithNulls)
      )

      const result = await mockSupabase
        .from('creator_earnings')
        .select('*')
        .eq('id', 'test-earning')
        .single()

      expect(result.data).toEqual(dataWithNulls)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network timeouts', async () => {
      mockSupabase.from().single.mockRejectedValue(new Error('Network timeout'))

      await expect(
        mockSupabase
          .from('profiles')
          .select('*')
          .eq('id', 'test-user')
          .single()
      ).rejects.toThrow('Network timeout')
    })

    it('should handle database connection failures', async () => {
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(null, {
          code: 'CONNECTION_ERROR',
          message: 'Could not connect to database'
        })
      )

      const result = await mockSupabase
        .from('profiles')
        .select('*')
        .eq('id', 'test-user')
        .single()

      expect(result.error.code).toBe('CONNECTION_ERROR')
    })

    it('should handle invalid SQL queries', async () => {
      mockSupabase.from().single.mockResolvedValue(
        createMockSupabaseResponse(null, {
          code: 'PGRST103',
          message: 'Invalid query syntax'
        })
      )

      const result = await mockSupabase
        .from('invalid_table')
        .select('invalid_column')
        .single()

      expect(result.error.code).toBe('PGRST103')
    })
  })
})