module.exports = async () => {
  // Global test setup
  console.log('🧪 Setting up test environment...')

  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_APP_ENV = 'test'

  // Mock external services
  global.mockSupabaseData = {
    users: {
      testCreator: {
        id: 'test-creator-id',
        email: 'creator@test.com',
        subscription_tier: 'premium',
        is_creator: true,
        creator_tier: 'gold'
      },
      testBasicUser: {
        id: 'test-basic-id',
        email: 'basic@test.com',
        subscription_tier: 'basic',
        is_creator: false
      },
      testFreeUser: {
        id: 'test-free-id',
        email: 'free@test.com',
        subscription_tier: 'free',
        is_creator: false
      }
    },
    earnings: {
      creator: {
        total_earnings_usd: 1250.75,
        pending_payout_usd: 125.50,
        total_credits_earned: 12507,
        unique_readers: 45,
        stories_with_earnings: 8
      }
    }
  }

  console.log('✅ Test environment ready')
}