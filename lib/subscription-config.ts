// Enhanced Subscription Configuration - No Free Tier
// All users must have a paid subscription to access the platform

export const SUBSCRIPTION_TIERS = {
  basic: {
    name: 'Basic',
    price_monthly: 9.99,
    price_yearly: 99.99,
    credits_per_month: 500,
    features: {
      stories_limit: 10,
      cover_generations: 3,
      download_access: false,
      ai_operations: ['foundation', 'character', 'chapter', 'improvement'],
      cover_styles: ['minimalist', 'artistic'],
      priority_support: false,
      early_access: false
    },
    stripe_price_id_monthly: 'price_basic_monthly',
    stripe_price_id_yearly: 'price_basic_yearly'
  },
  premium: {
    name: 'Premium',
    price_monthly: 19.99,
    price_yearly: 199.99,
    credits_per_month: 1200,
    features: {
      stories_limit: 'unlimited',
      cover_generations: 10,
      download_access: true,
      download_limit: 3,
      download_cost_credits: 250,
      ai_operations: ['foundation', 'character', 'chapter', 'improvement', 'advanced'],
      cover_styles: ['realistic', 'artistic', 'fantasy', 'minimalist', 'vintage'],
      priority_support: true,
      early_access: true,
      creator_tools: true,
      analytics_dashboard: true
    },
    stripe_price_id_monthly: 'price_premium_monthly',
    stripe_price_id_yearly: 'price_premium_yearly'
  }
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS

export const AI_OPERATION_COSTS = {
  foundation: {
    basic_complexity: 8,
    medium_complexity: 12,
    high_complexity: 18
  },
  character: {
    basic_complexity: 5,
    medium_complexity: 8,
    high_complexity: 12
  },
  chapter: {
    basic_complexity: 10,
    medium_complexity: 15,
    high_complexity: 25
  },
  improvement: {
    basic_complexity: 3,
    medium_complexity: 6,
    high_complexity: 10
  },
  cover: {
    basic_style: 8,
    premium_style: 12
  }
} as const

export const CREATOR_REVENUE_SHARE = 0.7 // 70% to creator
export const PLATFORM_REVENUE_SHARE = 0.3 // 30% to platform

export const MINIMUM_PAYOUT_USD = 25.00

// Monthly credit distribution logic
export function calculateProportionalCredits(
  userTier: SubscriptionTier,
  storiesReadThisMonth: number,
  totalActiveUsers: number
): number {
  const baseCredits = SUBSCRIPTION_TIERS[userTier].credits_per_month

  // Distribute additional credits based on reading activity
  const activityBonus = Math.min(storiesReadThisMonth * 10, baseCredits * 0.2)

  return Math.floor(baseCredits + activityBonus)
}

export function getUserFeatures(tier: SubscriptionTier) {
  return SUBSCRIPTION_TIERS[tier].features
}

export function canUserAccessFeature(
  tier: SubscriptionTier,
  feature: keyof typeof SUBSCRIPTION_TIERS.basic.features
): boolean {
  return !!SUBSCRIPTION_TIERS[tier].features[feature]
}

export function getSubscriptionUpgradeMessage(currentTier: SubscriptionTier): string {
  if (currentTier === 'basic') {
    return "Upgrade to Premium for unlimited stories, premium covers, and download access!"
  }
  return "You have full Premium access to all features!"
}

// Subscription enforcement - no free access
export function requiresSubscription(): boolean {
  return true // All features require subscription
}

export function getTrialPeriodDays(): number {
  return 7 // 7-day trial for new users
}