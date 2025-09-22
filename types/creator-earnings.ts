// Unified Creator Earnings Types
export interface CreatorEarningsHubProps {
  mode?: 'basic' | 'enhanced' | 'dashboard'
  userId?: string
  onPayoutRequest?: (amount: number) => void
  onUpgradeRequired?: () => void
  compact?: boolean
  showHeader?: boolean
}

export interface CreatorTier {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  name: string
  color: string
  bgColor: string
  requirements: {
    minEarnings?: number
    minStories?: number
    minReaders?: number
  }
}

export interface CreatorProfile {
  id: string
  isCreator: boolean
  creatorTier: CreatorTier['tier'] | null
  subscriptionTier: 'free' | 'pro' | 'premium'
  totalEarningsAllTime: number
  pendingPayoutUsd: number
  joinedDate: string
}

export interface EarningsSummary {
  totalCreditsEarned: number
  totalUsdEarnings: number
  uniqueReaders: number
  storiesWithEarnings: number
  averageEarningsPerStory: number
  pendingPayout: number
  lifetimeEarnings: number
  creatorSharePercentage: number
  periodDescription: string
}

export interface StoryPerformance {
  storyId: string
  storyTitle: string
  totalCreditsEarned: number
  totalUsdEarned: number
  uniqueReaders: number
  totalPurchases: number
  lastPurchase: string
  coverImageUrl?: string
}

export interface EarningsTransaction {
  id: string
  storyTitle: string
  readerEmail: string
  creditsEarned: number
  usdEquivalent: number
  purchaseType: 'chapter' | 'full_story' | 'premium_access' | 'subscription'
  createdAt: string
  storyId: string
}

export interface MonthlyTrend {
  month: string
  creditsEarned: number
  usdEarned: number
  storiesSold: number
  uniqueReaders: number
}

export interface PayoutInfo {
  canRequestPayout: boolean
  minimumPayout: number
  nextPayoutDate: string
  eligibilityMessage: string
  lastPayoutDate?: string
  lastPayoutAmount?: number
  processingFee: number
}

export interface PayoutHistoryItem {
  id: string
  amountUsd: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  batchDate: string
  createdAt: string
  processingFee: number
  netAmount: number
}

export interface PayoutHistory {
  items: PayoutHistoryItem[]
  summary: {
    totalPayouts: number
    totalAmountPaidUsd: number
    totalFeesPaid: number
    netAmountReceived: number
    lastSuccessfulPayout: {
      amount: number
      date: string
    } | null
  }
}

export interface CreatorEarningsData {
  profile: CreatorProfile
  summary: EarningsSummary
  storyPerformance: StoryPerformance[]
  recentTransactions: EarningsTransaction[]
  monthlyTrend: MonthlyTrend[]
  payoutInfo: PayoutInfo
  payoutHistory?: PayoutHistory
  meta: {
    creditsToUsdRate: number
    lastUpdated: string
    nextRefresh: string
    cacheStatus: 'fresh' | 'stale' | 'expired'
  }
}

export interface DisplayMode {
  name: 'basic' | 'enhanced' | 'dashboard'
  showTierBadge: boolean
  showLifetimeEarnings: boolean
  showPayoutHistory: boolean
  showMonthlyTrends: boolean
  showDetailedBreakdown: boolean
  showRecentTransactions: boolean
  maxStoryPerformanceItems: number
  maxTransactionItems: number
}

export interface PeriodOption {
  value: string
  label: string
  type: 'days' | 'months' | 'custom'
  description: string
}

export interface LoadingState {
  summary: boolean
  storyPerformance: boolean
  transactions: boolean
  trends: boolean
  payoutHistory: boolean
  requestingPayout: boolean
}

export interface ErrorState {
  summary?: string
  storyPerformance?: string
  transactions?: string
  trends?: string
  payoutHistory?: string
  payout?: string
  general?: string
}

// API Response Types
export interface ApiResponse<T> {
  data: T
  error?: string
  cached?: boolean
  lastUpdated?: string
}

export interface EarningsApiParams {
  period?: string
  includeHistory?: boolean
  includeTransactions?: boolean
  includeTrends?: boolean
  limit?: number
  offset?: number
}

// Component State Types
export interface CreatorEarningsState {
  data: CreatorEarningsData | null
  loading: LoadingState
  error: ErrorState
  selectedPeriod: string
  displayMode: DisplayMode['name']
  showPayoutBreakdown: boolean
  showPayoutHistory: boolean
  refreshInterval: NodeJS.Timeout | null
}

// Utility Types
export type SortableField = 'earnings' | 'readers' | 'purchases' | 'date'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: SortableField
  direction: SortDirection
}

export interface FilterConfig {
  storySearch: string
  minEarnings: number
  dateRange: {
    start: string
    end: string
  }
}

// Constants
export const CREATOR_TIERS: Record<CreatorTier['tier'], CreatorTier> = {
  bronze: {
    tier: 'bronze',
    name: 'Bronze Creator',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
    requirements: { minEarnings: 0, minStories: 1, minReaders: 1 }
  },
  silver: {
    tier: 'silver',
    name: 'Silver Creator',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
    requirements: { minEarnings: 100, minStories: 5, minReaders: 50 }
  },
  gold: {
    tier: 'gold',
    name: 'Gold Creator',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
    requirements: { minEarnings: 500, minStories: 15, minReaders: 200 }
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum Creator',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100',
    requirements: { minEarnings: 2000, minStories: 50, minReaders: 1000 }
  }
}

export const DISPLAY_MODES: Record<DisplayMode['name'], DisplayMode> = {
  basic: {
    name: 'basic',
    showTierBadge: true,
    showLifetimeEarnings: true,
    showPayoutHistory: false,
    showMonthlyTrends: false,
    showDetailedBreakdown: false,
    showRecentTransactions: true,
    maxStoryPerformanceItems: 5,
    maxTransactionItems: 10
  },
  enhanced: {
    name: 'enhanced',
    showTierBadge: true,
    showLifetimeEarnings: true,
    showPayoutHistory: true,
    showMonthlyTrends: true,
    showDetailedBreakdown: true,
    showRecentTransactions: true,
    maxStoryPerformanceItems: 10,
    maxTransactionItems: 20
  },
  dashboard: {
    name: 'dashboard',
    showTierBadge: true,
    showLifetimeEarnings: true,
    showPayoutHistory: true,
    showMonthlyTrends: true,
    showDetailedBreakdown: true,
    showRecentTransactions: true,
    maxStoryPerformanceItems: 20,
    maxTransactionItems: 50
  }
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '7', label: 'Last 7 days', type: 'days', description: '7 days' },
  { value: '30', label: 'Last 30 days', type: 'days', description: '30 days' },
  { value: '90', label: 'Last 90 days', type: 'days', description: '90 days' },
  { value: 'current_month', label: 'This Month', type: 'months', description: 'current month' },
  { value: 'last_month', label: 'Last Month', type: 'months', description: 'last month' },
  { value: 'last_3_months', label: 'Last 3 Months', type: 'months', description: '3 months' },
  { value: 'all_time', label: 'All Time', type: 'custom', description: 'all time' }
]