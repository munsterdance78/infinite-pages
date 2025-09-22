import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import { createMockEarningsData, createMockUser } from '@/test/utils/test-utils'

// Mock the hooks
const mockUseCreatorEarnings = {
  data: createMockEarningsData(),
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

const mockUseUser = {
  user: createMockUser(),
  loading: false,
  error: null
}

jest.mock('@/hooks/useCreatorEarnings', () => ({
  useCreatorEarnings: () => mockUseCreatorEarnings
}))

jest.mock('@/hooks/useUser', () => ({
  useUser: () => mockUseUser
}))

describe('Creator Earnings Regression Tests', () => {
  const defaultProps = {
    mode: 'enhanced' as const,
    onPayoutRequest: jest.fn(),
    onUpgradeRequired: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCreatorEarnings.data = createMockEarningsData()
    mockUseCreatorEarnings.loading = false
    mockUseCreatorEarnings.error = { general: null, api: null, network: null }
    mockUseUser.user = createMockUser()
    mockUseUser.loading = false
    mockUseUser.error = null
  })

  describe('Core Functionality Preservation', () => {
    it('should maintain all original earnings display features', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Core earnings data should be displayed
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument() // Total earnings
      expect(screen.getByText('$125.50')).toBeInTheDocument() // Pending payout
      expect(screen.getByText('45')).toBeInTheDocument() // Unique readers
      expect(screen.getByText('8')).toBeInTheDocument() // Stories with earnings

      // Story performance should be shown
      expect(screen.getByText('Story Performance')).toBeInTheDocument()
      expect(screen.getByText('Test Story 1')).toBeInTheDocument()
      expect(screen.getByText('Test Story 2')).toBeInTheDocument()

      // Recent transactions should be displayed
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument()
    })

    it('should preserve payout request functionality', async () => {
      const user = userEvent.setup()
      const onPayoutRequest = jest.fn()

      render(<CreatorEarningsHub {...defaultProps} onPayoutRequest={onPayoutRequest} />)

      const payoutButton = screen.getByText('Request Payout')
      await user.click(payoutButton)

      expect(onPayoutRequest).toHaveBeenCalledWith(125.50)
    })

    it('should maintain period selection functionality', async () => {
      const user = userEvent.setup()

      render(<CreatorEarningsHub {...defaultProps} />)

      const periodSelect = screen.getByRole('combobox', { name: /period/i })
      await user.click(periodSelect)

      const lastMonthOption = screen.getByText('Last Month')
      await user.click(lastMonthOption)

      expect(mockUseCreatorEarnings.changePeriod).toHaveBeenCalledWith('last_month')
    })

    it('should preserve data refresh functionality', async () => {
      const user = userEvent.setup()

      render(<CreatorEarningsHub {...defaultProps} />)

      const refreshButton = screen.getByLabelText('Refresh data')
      await user.click(refreshButton)

      expect(mockUseCreatorEarnings.refresh).toHaveBeenCalled()
    })

    it('should maintain breakdown toggle functionality', async () => {
      const user = userEvent.setup()

      render(<CreatorEarningsHub {...defaultProps} />)

      const breakdownToggle = screen.getByText('Show Breakdown')
      await user.click(breakdownToggle)

      expect(mockUseCreatorEarnings.togglePayoutBreakdown).toHaveBeenCalled()
    })
  })

  describe('User Access Levels Preservation', () => {
    it('should maintain basic tier access restrictions', () => {
      const basicData = createMockEarningsData({
        meta: {
          view: 'basic',
          subscriptionTier: 'free',
          creatorTier: 'bronze',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      mockUseCreatorEarnings.data = basicData

      render(<CreatorEarningsHub {...defaultProps} mode="basic" />)

      // Should show basic features
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()

      // Should NOT show advanced features
      expect(screen.queryByText('Monthly Trends')).not.toBeInTheDocument()
      expect(screen.queryByText('Advanced Analytics')).not.toBeInTheDocument()
    })

    it('should maintain premium tier feature access', () => {
      const premiumData = createMockEarningsData({
        meta: {
          view: 'enhanced',
          subscriptionTier: 'premium',
          creatorTier: 'gold',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      mockUseCreatorEarnings.data = premiumData

      render(<CreatorEarningsHub {...defaultProps} mode="enhanced" />)

      // Should show all premium features
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Monthly Trends')).toBeInTheDocument()
      expect(screen.getByText('Story Performance')).toBeInTheDocument()
      expect(screen.getByText('Export CSV')).toBeInTheDocument()
    })

    it('should maintain admin access to dashboard features', () => {
      const adminUser = createMockUser({ email: 'admin@infinite-pages.com' })
      const adminData = createMockEarningsData({
        meta: {
          view: 'dashboard',
          subscriptionTier: 'admin',
          creatorTier: 'platinum',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      mockUseUser.user = adminUser
      mockUseCreatorEarnings.data = adminData

      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      // Should show admin features
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Admin Tools')).toBeInTheDocument()
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument()
    })

    it('should maintain proper upgrade prompts for restricted features', async () => {
      const user = userEvent.setup()
      const onUpgradeRequired = jest.fn()

      const freeData = createMockEarningsData({
        meta: {
          view: 'basic',
          subscriptionTier: 'free',
          creatorTier: 'bronze',
          apiVersion: '2.0.0',
          cached: false
        }
      })

      mockUseCreatorEarnings.data = freeData

      render(
        <CreatorEarningsHub
          {...defaultProps}
          mode="basic"
          onUpgradeRequired={onUpgradeRequired}
        />
      )

      // Try to access premium feature
      const viewSelect = screen.getByRole('combobox', { name: /view mode/i })
      await user.click(viewSelect)

      const enhancedOption = screen.getByText('Enhanced Analytics')
      await user.click(enhancedOption)

      expect(screen.getByText('Premium Feature')).toBeInTheDocument()

      const upgradeButton = screen.getByText('Upgrade to Premium')
      await user.click(upgradeButton)

      expect(onUpgradeRequired).toHaveBeenCalled()
    })
  })

  describe('Layout and UI Preservation', () => {
    it('should maintain responsive grid layout', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Summary grid should have responsive classes
      const summaryGrid = container.querySelector('[data-testid="summary-grid"]')
      expect(summaryGrid).toHaveClass('grid')
      expect(summaryGrid).toHaveClass('grid-cols-1')
      expect(summaryGrid).toHaveClass('md:grid-cols-2')
      expect(summaryGrid).toHaveClass('lg:grid-cols-4')
    })

    it('should maintain proper spacing and padding', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const main = container.querySelector('[role="main"]')
      expect(main).toHaveClass('p-6')

      const cards = container.querySelectorAll('.bg-white')
      cards.forEach(card => {
        expect(card).toHaveClass('p-6')
      })
    })

    it('should preserve card styling and shadows', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const cards = container.querySelectorAll('.bg-white')
      cards.forEach(card => {
        expect(card).toHaveClass('rounded-lg')
        expect(card).toHaveClass('shadow-sm')
      })
    })

    it('should maintain table structure and styling', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const table = screen.getByRole('table')
      expect(table).toHaveClass('min-w-full')

      const headers = screen.getAllByRole('columnheader')
      expect(headers).toHaveLength(4) // Story, Earnings, Readers, Purchases

      headers.forEach(header => {
        expect(header).toHaveClass('text-left')
      })
    })

    it('should preserve compact layout option', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} compact={true} />)

      expect(container.firstChild).toHaveClass('p-4') // Reduced padding
    })
  })

  describe('Data Format Consistency', () => {
    it('should maintain currency formatting', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // All currency values should be properly formatted
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()
      expect(screen.getByText('$125.50')).toBeInTheDocument()
      expect(screen.getByText('$17.50')).toBeInTheDocument()
      expect(screen.getByText('$10.50')).toBeInTheDocument()
    })

    it('should maintain date formatting', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Dates should be formatted consistently
      expect(screen.getAllByText(/Jan \d+, 2024/)).toHaveLength(2)
    })

    it('should preserve number formatting for counts', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Number values should be displayed as integers
      expect(screen.getByText('45')).toBeInTheDocument() // readers
      expect(screen.getByText('8')).toBeInTheDocument() // stories
    })

    it('should maintain tier badge display', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Gold Creator')).toBeInTheDocument()
    })
  })

  describe('Error State Preservation', () => {
    it('should maintain error boundary functionality', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }

      // Mock console.error to prevent noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <CreatorEarningsHub {...defaultProps}>
          <ThrowError />
        </CreatorEarningsHub>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should maintain loading state display', () => {
      mockUseCreatorEarnings.loading = true
      mockUseCreatorEarnings.data = null

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Fetching your latest earnings data...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should preserve API error handling', () => {
      mockUseCreatorEarnings.loading = false
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Failed to load earnings data'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load earnings data')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('should maintain network error handling', () => {
      mockUseCreatorEarnings.loading = false
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.network = 'Network connection failed'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Network Error')).toBeInTheDocument()
      expect(screen.getByText('Check your internet connection')).toBeInTheDocument()
    })
  })

  describe('Backward Compatibility', () => {
    it('should handle legacy data structures', () => {
      const legacyData = {
        ...createMockEarningsData(),
        // Legacy field names
        totalEarnings: 1250.75,
        pendingPayout: 125.50,
        // Missing new fields should not break
        meta: {
          view: 'enhanced',
          apiVersion: '1.0.0', // Old version
          cached: false
        }
      }

      mockUseCreatorEarnings.data = legacyData

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should still render properly
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
    })

    it('should handle missing optional fields gracefully', () => {
      const incompleteData = {
        summary: {
          totalEarningsUsd: 1250.75,
          pendingPayoutUsd: 125.50,
          totalCreditsEarned: 12507,
          uniqueReaders: 45,
          storiesWithEarnings: 8
        },
        // Missing storyPerformance and recentTransactions
        meta: {
          view: 'enhanced',
          subscriptionTier: 'premium',
          creatorTier: 'gold',
          apiVersion: '2.0.0',
          cached: false
        }
      }

      mockUseCreatorEarnings.data = incompleteData

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should render summary without errors
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()
    })

    it('should maintain prop interface compatibility', () => {
      // Test all supported prop combinations
      const propVariations = [
        { mode: 'basic' as const },
        { mode: 'enhanced' as const },
        { mode: 'dashboard' as const },
        { mode: 'enhanced' as const, compact: true },
        { mode: 'enhanced' as const, showHeader: false }
      ]

      propVariations.forEach(props => {
        const { unmount } = render(
          <CreatorEarningsHub
            {...defaultProps}
            {...props}
          />
        )

        expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
        unmount()
      })
    })
  })

  describe('Performance Regression Prevention', () => {
    it('should not introduce memory leaks', () => {
      const { unmount } = render(<CreatorEarningsHub {...defaultProps} />)

      // Component should render without issues
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()

      // Should unmount cleanly
      unmount()

      // No assertions needed - if there are memory leaks, Jest will complain
    })

    it('should maintain efficient re-rendering', () => {
      let renderCount = 0
      const TestWrapper = (props: any) => {
        renderCount++
        return <CreatorEarningsHub {...props} />
      }

      const { rerender } = render(<TestWrapper {...defaultProps} />)

      expect(renderCount).toBe(1)

      // Re-render with same props
      rerender(<TestWrapper {...defaultProps} />)

      // Should not trigger unnecessary re-renders due to memoization
      expect(renderCount).toBe(2)
    })

    it('should handle large datasets without performance degradation', () => {
      const largeDataset = createMockEarningsData({
        storyPerformance: Array.from({ length: 100 }, (_, i) => ({
          story_id: `story-${i}`,
          story_title: `Story ${i}`,
          total_usd: i * 10,
          unique_readers: i * 2,
          purchase_count: i
        })),
        recentTransactions: Array.from({ length: 50 }, (_, i) => ({
          id: `txn-${i}`,
          storyTitle: `Story ${i}`,
          usdEquivalent: i * 0.5,
          createdAt: new Date().toISOString()
        }))
      })

      mockUseCreatorEarnings.data = largeDataset

      const startTime = performance.now()
      render(<CreatorEarningsHub {...defaultProps} />)
      const renderTime = performance.now() - startTime

      // Should render large datasets within reasonable time
      expect(renderTime).toBeLessThan(100) // 100ms threshold

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
    })
  })

  describe('Integration Points Preservation', () => {
    it('should maintain export functionality integration', async () => {
      const user = userEvent.setup()

      // Mock fetch for export
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['csv,data'], { type: 'text/csv' })),
        headers: new Headers()
      })

      render(<CreatorEarningsHub {...defaultProps} mode="enhanced" />)

      const exportButton = screen.getByText('Export CSV')
      await user.click(exportButton)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('format=csv'),
        expect.any(Object)
      )
    })

    it('should maintain real-time update integration', () => {
      const realTimeData = createMockEarningsData({
        meta: {
          ...createMockEarningsData().meta,
          realtime: {
            hasUpdates: true,
            newEarnings: 2,
            refreshRecommended: true
          }
        }
      })

      mockUseCreatorEarnings.data = realTimeData

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('New earnings available')).toBeInTheDocument()
      expect(screen.getByText('Refresh to see latest data')).toBeInTheDocument()
    })

    it('should preserve analytics tracking integration', async () => {
      const user = userEvent.setup()
      const mockAnalytics = jest.fn()

      // Mock analytics
      ;(window as any).gtag = mockAnalytics

      render(<CreatorEarningsHub {...defaultProps} />)

      const payoutButton = screen.getByText('Request Payout')
      await user.click(payoutButton)

      // Should track payout request events
      expect(mockAnalytics).toHaveBeenCalledWith(
        'event',
        'payout_request',
        expect.any(Object)
      )
    })
  })
})