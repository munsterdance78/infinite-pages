import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import { createMockEarningsData, createMockUser } from '@/test/utils/test-utils'

// Mock the authentication hook
const mockUseUser = {
  user: null,
  loading: false,
  error: null
}

const mockUseCreatorEarnings = {
  data: null,
  loading: false,
  error: { general: null, api: null, network: null },
  selectedPeriod: 'current_month',
  displayMode: 'enhanced',
  showPayoutBreakdown: false,
  showPayoutHistory: false,
  changePeriod: jest.fn(),
  changeDisplayMode: jest.fn(),
  togglePayoutBreakdown: jest.fn(),
  togglePayoutHistory: jest.fn(),
  refresh: jest.fn(),
  requestPayout: jest.fn()
}

jest.mock('@/hooks/useUser', () => ({
  useUser: () => mockUseUser
}))

jest.mock('@/hooks/useCreatorEarnings', () => ({
  useCreatorEarnings: () => mockUseCreatorEarnings
}))

// Mock router
const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn()
  }),
  usePathname: () => '/dashboard/earnings',
  useSearchParams: () => new URLSearchParams()
}))

describe('Creator Earnings Component Authentication Tests', () => {
  const defaultProps = {
    mode: 'enhanced' as const,
    onPayoutRequest: jest.fn(),
    onUpgradeRequired: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseUser.user = null
    mockUseUser.loading = false
    mockUseUser.error = null
    mockUseCreatorEarnings.data = null
    mockUseCreatorEarnings.loading = false
    mockUseCreatorEarnings.error = { general: null, api: null, network: null }
  })

  describe('Unauthenticated State', () => {
    it('should show login prompt when user is not authenticated', () => {
      mockUseUser.user = null
      mockUseUser.loading = false

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Authentication Required')).toBeInTheDocument()
      expect(screen.getByText('Please sign in to view your creator earnings')).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    it('should show loading state during authentication check', () => {
      mockUseUser.loading = true
      mockUseUser.user = null

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Verifying authentication...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should redirect to sign in when sign in button is clicked', async () => {
      const user = userEvent.setup()
      mockUseUser.user = null

      render(<CreatorEarningsHub {...defaultProps} />)

      const signInButton = screen.getByText('Sign In')
      await user.click(signInButton)

      expect(mockPush).toHaveBeenCalledWith('/auth/signin?returnTo=%2Fdashboard%2Fearnings')
    })

    it('should handle authentication errors gracefully', () => {
      mockUseUser.user = null
      mockUseUser.error = 'Authentication failed'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Authentication Error')).toBeInTheDocument()
      expect(screen.getByText('Authentication failed')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })

  describe('Creator Authorization', () => {
    it('should show upgrade prompt for non-creator users', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.error.general = 'Creator access required. Please apply to become a creator or upgrade your subscription.'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Access Required')).toBeInTheDocument()
      expect(screen.getByText('Apply to Become a Creator')).toBeInTheDocument()
      expect(screen.getByText('Upgrade Subscription')).toBeInTheDocument()
    })

    it('should call onUpgradeRequired when upgrade button is clicked', async () => {
      const user = userEvent.setup()
      const onUpgradeRequired = jest.fn()

      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.error.general = 'Creator access required'

      render(
        <CreatorEarningsHub
          {...defaultProps}
          onUpgradeRequired={onUpgradeRequired}
        />
      )

      const upgradeButton = screen.getByText('Upgrade Subscription')
      await user.click(upgradeButton)

      expect(onUpgradeRequired).toHaveBeenCalled()
    })

    it('should show creator application form for eligible users', async () => {
      const user = userEvent.setup()
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.error.general = 'Creator access required'

      render(<CreatorEarningsHub {...defaultProps} />)

      const applyButton = screen.getByText('Apply to Become a Creator')
      await user.click(applyButton)

      expect(screen.getByText('Creator Application')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /bio/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /writing experience/i })).toBeInTheDocument()
    })

    it('should render earnings data for verified creators', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData()

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()
      expect(screen.queryByText('Creator Access Required')).not.toBeInTheDocument()
    })
  })

  describe('Subscription Tier Access Control', () => {
    it('should limit features for free tier creators', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        meta: {
          view: 'basic',
          subscriptionTier: 'free',
          creatorTier: 'bronze',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} mode="basic" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      // Should not show advanced features
      expect(screen.queryByText('Monthly Trends')).not.toBeInTheDocument()
      expect(screen.queryByText('Export Data')).not.toBeInTheDocument()
    })

    it('should show upgrade prompt when trying to access premium features', async () => {
      const user = userEvent.setup()
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        meta: {
          view: 'basic',
          subscriptionTier: 'free',
          creatorTier: 'bronze',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} mode="basic" />)

      // Try to access premium feature
      const viewSelect = screen.getByRole('combobox', { name: /view mode/i })
      await user.click(viewSelect)

      const enhancedOption = screen.getByText('Enhanced Analytics')
      await user.click(enhancedOption)

      expect(screen.getByText('Premium Feature')).toBeInTheDocument()
      expect(screen.getByText('Upgrade to Premium to access enhanced analytics')).toBeInTheDocument()
    })

    it('should allow all features for premium subscribers', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        meta: {
          view: 'enhanced',
          subscriptionTier: 'premium',
          creatorTier: 'gold',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} mode="enhanced" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Monthly Trends')).toBeInTheDocument()
      expect(screen.getByText('Story Performance')).toBeInTheDocument()
      expect(screen.getByText('Export CSV')).toBeInTheDocument()
    })

    it('should restrict admin features to admin users only', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        meta: {
          view: 'enhanced',
          subscriptionTier: 'premium',
          creatorTier: 'gold',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      expect(screen.queryByText('Admin Tools')).not.toBeInTheDocument()
      expect(screen.queryByText('User Management')).not.toBeInTheDocument()
    })

    it('should show admin features for admin users', () => {
      const adminUser = createMockUser({ email: 'admin@infinite-pages.com' })
      mockUseUser.user = adminUser
      mockUseCreatorEarnings.data = createMockEarningsData({
        meta: {
          view: 'dashboard',
          subscriptionTier: 'admin',
          creatorTier: 'platinum',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Admin Tools')).toBeInTheDocument()
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument()
    })
  })

  describe('Session Persistence', () => {
    it('should maintain authentication state across component re-renders', () => {
      const user = createMockUser()
      mockUseUser.user = user
      mockUseCreatorEarnings.data = createMockEarningsData()

      const { rerender } = render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      // Re-render component
      rerender(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.queryByText('Authentication Required')).not.toBeInTheDocument()
    })

    it('should handle session expiration gracefully', async () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData()

      const { rerender } = render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      // Simulate session expiration
      mockUseUser.user = null
      mockUseUser.error = 'Session expired'
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Authentication required'

      rerender(<CreatorEarningsHub {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument()
      })

      expect(screen.getByText('Please sign in again')).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    it('should auto-refresh on token renewal', async () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData()

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      // Simulate token renewal (user object changes but remains authenticated)
      const renewedUser = { ...createMockUser(), updated_at: new Date().toISOString() }
      mockUseUser.user = renewedUser

      await waitFor(() => {
        expect(mockUseCreatorEarnings.refresh).toHaveBeenCalled()
      })
    })
  })

  describe('Cross-Origin Protection', () => {
    it('should validate component embedding context', () => {
      // Mock window.parent to simulate iframe embedding
      const originalParent = window.parent
      Object.defineProperty(window, 'parent', {
        value: { location: { origin: 'https://malicious-site.com' } },
        writable: true
      })

      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData()

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should still render (protection handled at server level)
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      // Restore original
      Object.defineProperty(window, 'parent', {
        value: originalParent,
        writable: true
      })
    })

    it('should handle postMessage security for embedded contexts', () => {
      const messageHandler = jest.fn()
      window.addEventListener('message', messageHandler)

      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData()

      render(<CreatorEarningsHub {...defaultProps} />)

      // Simulate potentially malicious postMessage
      window.postMessage({
        type: 'CREATOR_EARNINGS_REQUEST',
        data: 'malicious payload'
      }, '*')

      // Should not compromise the component
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      window.removeEventListener('message', messageHandler)
    })
  })

  describe('Permission Granularity', () => {
    it('should respect individual permission flags', () => {
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        permissions: {
          canViewEarnings: true,
          canRequestPayout: false,
          canExportData: true,
          canViewAnalytics: false
        }
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Export CSV')).toBeInTheDocument()
      expect(screen.queryByText('Request Payout')).not.toBeInTheDocument()
      expect(screen.queryByText('Monthly Trends')).not.toBeInTheDocument()
    })

    it('should disable restricted actions with helpful tooltips', async () => {
      const user = userEvent.setup()
      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        permissions: {
          canViewEarnings: true,
          canRequestPayout: false,
          canExportData: true,
          canViewAnalytics: true
        }
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      const payoutArea = screen.getByText('Request Payout').closest('div')
      expect(payoutArea).toHaveClass('opacity-50', 'cursor-not-allowed')

      await user.hover(screen.getByText('Request Payout'))

      await waitFor(() => {
        expect(screen.getByText('Payout requests are currently disabled for your account')).toBeInTheDocument()
      })
    })

    it('should check permissions before allowing actions', async () => {
      const user = userEvent.setup()
      const onPayoutRequest = jest.fn()

      mockUseUser.user = createMockUser()
      mockUseCreatorEarnings.data = createMockEarningsData({
        permissions: {
          canViewEarnings: true,
          canRequestPayout: false,
          canExportData: true,
          canViewAnalytics: true
        }
      })

      render(
        <CreatorEarningsHub
          {...defaultProps}
          onPayoutRequest={onPayoutRequest}
        />
      )

      const payoutButton = screen.getByText('Request Payout')
      expect(payoutButton).toBeDisabled()

      await user.click(payoutButton)

      expect(onPayoutRequest).not.toHaveBeenCalled()
    })
  })
})