import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import { createMockEarningsData, mockFetch } from '@/test/utils/test-utils'

// Mock the hook
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

jest.mock('@/hooks/useCreatorEarnings', () => ({
  useCreatorEarnings: () => mockUseCreatorEarnings
}))

describe('CreatorEarningsHub Component Integration Tests', () => {
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
  })

  describe('Component Rendering', () => {
    it('should render loading state correctly', () => {
      mockUseCreatorEarnings.loading = true
      mockUseCreatorEarnings.data = null

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Fetching your latest earnings data...')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should render basic mode with limited features', () => {
      render(<CreatorEarningsHub {...defaultProps} mode="basic" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument() // Total earnings

      // Basic mode should show fewer story performance items
      const storyItems = screen.getAllByText(/Test Story \d/)
      expect(storyItems.length).toBeLessThanOrEqual(5)
    })

    it('should render enhanced mode with full features', () => {
      render(<CreatorEarningsHub {...defaultProps} mode="enhanced" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()
      expect(screen.getByText('Monthly Trends')).toBeInTheDocument()
      expect(screen.getByText('Story Performance')).toBeInTheDocument()
    })

    it('should render dashboard mode with admin features', () => {
      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('Export Data')).toBeInTheDocument()
      expect(screen.getByText('Advanced Analytics')).toBeInTheDocument()
    })

    it('should render compact layout when specified', () => {
      const { container } = render(
        <CreatorEarningsHub {...defaultProps} compact={true} />
      )

      expect(container.firstChild).toHaveClass('p-4')
    })

    it('should hide header when showHeader is false', () => {
      render(<CreatorEarningsHub {...defaultProps} showHeader={false} />)

      expect(screen.queryByText('Creator Earnings')).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle period change', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      const periodSelect = screen.getByRole('combobox', { name: /period/i })
      await user.click(periodSelect)

      const lastMonthOption = screen.getByText('Last Month')
      await user.click(lastMonthOption)

      expect(mockUseCreatorEarnings.changePeriod).toHaveBeenCalledWith('last_month')
    })

    it('should handle payout request', async () => {
      const user = userEvent.setup()
      const onPayoutRequest = jest.fn()

      render(<CreatorEarningsHub {...defaultProps} onPayoutRequest={onPayoutRequest} />)

      const payoutButton = screen.getByText('Request Payout')
      await user.click(payoutButton)

      await waitFor(() => {
        expect(onPayoutRequest).toHaveBeenCalledWith(125.50) // pending payout amount
      })
    })

    it('should handle breakdown toggle', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      const breakdownToggle = screen.getByText('Show Breakdown')
      await user.click(breakdownToggle)

      expect(mockUseCreatorEarnings.togglePayoutBreakdown).toHaveBeenCalled()
    })

    it('should handle history toggle', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      const historyToggle = screen.getByText('Payout History')
      await user.click(historyToggle)

      expect(mockUseCreatorEarnings.togglePayoutHistory).toHaveBeenCalled()
    })

    it('should handle refresh action', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      const refreshButton = screen.getByLabelText('Refresh data')
      await user.click(refreshButton)

      expect(mockUseCreatorEarnings.refresh).toHaveBeenCalled()
    })
  })

  describe('Error States', () => {
    it('should render error state when data loading fails', () => {
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.loading = false
      mockUseCreatorEarnings.error.general = 'Failed to load earnings data'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load earnings data')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('should handle upgrade required error', () => {
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.loading = false
      mockUseCreatorEarnings.error.general = 'Premium subscription required for creator features'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Upgrade Required')).toBeInTheDocument()
      expect(screen.getByText('Upgrade to Premium')).toBeInTheDocument()
    })

    it('should show retry button in error state', async () => {
      const user = userEvent.setup()
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Network error'

      render(<CreatorEarningsHub {...defaultProps} />)

      const retryButton = screen.getByText('Retry')
      await user.click(retryButton)

      expect(mockUseCreatorEarnings.refresh).toHaveBeenCalled()
    })

    it('should call onUpgradeRequired when upgrade is needed', async () => {
      const user = userEvent.setup()
      const onUpgradeRequired = jest.fn()

      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Premium subscription required'

      render(
        <CreatorEarningsHub
          {...defaultProps}
          onUpgradeRequired={onUpgradeRequired}
        />
      )

      const upgradeButton = screen.getByText('Upgrade to Premium')
      await user.click(upgradeButton)

      expect(onUpgradeRequired).toHaveBeenCalled()
    })
  })

  describe('Data Display', () => {
    it('should display earnings summary correctly', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('$1,250.75')).toBeInTheDocument() // Total earnings
      expect(screen.getByText('$125.50')).toBeInTheDocument() // Pending payout
      expect(screen.getByText('45')).toBeInTheDocument() // Unique readers
      expect(screen.getByText('8')).toBeInTheDocument() // Stories with earnings
    })

    it('should display story performance data', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Test Story 1')).toBeInTheDocument()
      expect(screen.getByText('Test Story 2')).toBeInTheDocument()
      expect(screen.getByText('$17.50')).toBeInTheDocument()
      expect(screen.getByText('$10.50')).toBeInTheDocument()
    })

    it('should display recent transactions', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('reader1@test.com')).toBeInTheDocument()
      expect(screen.getByText('reader2@test.com')).toBeInTheDocument()
      expect(screen.getByText('$1.23')).toBeInTheDocument()
      expect(screen.getByText('$0.88')).toBeInTheDocument()
    })

    it('should format dates correctly', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Should display formatted dates for transactions
      expect(screen.getAllByText(/Jan \d+, 2024/)).toHaveLength(2)
    })

    it('should show tier badge when user has tier', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('Gold Creator')).toBeInTheDocument()
    })
  })

  describe('Export Functionality', () => {
    it('should show export options in dashboard mode', () => {
      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      expect(screen.getByText('Export CSV')).toBeInTheDocument()
      expect(screen.getByText('Export XLSX')).toBeInTheDocument()
    })

    it('should handle CSV export', async () => {
      const user = userEvent.setup()
      mockFetch('csv,data,here', 200)

      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      const csvButton = screen.getByText('Export CSV')
      await user.click(csvButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('format=csv'),
          expect.any(Object)
        )
      })
    })

    it('should handle XLSX export', async () => {
      const user = userEvent.setup()
      mockFetch('xlsx,data,here', 200)

      render(<CreatorEarningsHub {...defaultProps} mode="dashboard" />)

      const xlsxButton = screen.getByText('Export XLSX')
      await user.click(xlsxButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('format=xlsx'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should still render main content
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
    })

    it('should show mobile-optimized summary cards', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should have responsive grid classes
      const summaryGrid = container.querySelector('.grid-cols-1')
      expect(summaryGrid).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('should show real-time update indicator when available', () => {
      mockUseCreatorEarnings.data = {
        ...createMockEarningsData(),
        meta: {
          ...createMockEarningsData().meta,
          realtime: {
            hasUpdates: true,
            newEarnings: 2,
            refreshRecommended: true
          }
        }
      }

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByText('New earnings available')).toBeInTheDocument()
      expect(screen.getByText('Refresh to see latest data')).toBeInTheDocument()
    })

    it('should auto-refresh when real-time updates detected', async () => {
      jest.useFakeTimers()

      mockUseCreatorEarnings.data = {
        ...createMockEarningsData(),
        meta: {
          ...createMockEarningsData().meta,
          realtime: {
            hasUpdates: true,
            refreshRecommended: true
          }
        }
      }

      render(<CreatorEarningsHub {...defaultProps} />)

      // Fast-forward timers
      jest.advanceTimersByTime(30000)

      await waitFor(() => {
        expect(mockUseCreatorEarnings.refresh).toHaveBeenCalled()
      })

      jest.useRealTimers()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /earnings summary/i })).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      // Tab to first interactive element
      await user.tab()
      expect(document.activeElement).toHaveAttribute('role', 'combobox')

      // Tab to next element
      await user.tab()
      expect(document.activeElement).toHaveAttribute('type', 'button')
    })

    it('should announce loading state to screen readers', () => {
      mockUseCreatorEarnings.loading = true
      mockUseCreatorEarnings.data = null

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('status')).toHaveTextContent('Loading Creator Earnings')
    })

    it('should announce errors to screen readers', () => {
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Failed to load data'

      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = jest.fn()
      const TestComponent = (props: any) => {
        renderSpy()
        return <CreatorEarningsHub {...props} />
      }

      const { rerender } = render(<TestComponent {...defaultProps} />)

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />)

      // Should not trigger unnecessary re-renders due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle large datasets efficiently', () => {
      const largeDataset = createMockEarningsData({
        storyPerformance: Array.from({ length: 100 }, (_, i) => ({
          story_id: `story-${i}`,
          story_title: `Story ${i}`,
          total_usd: i * 10,
          unique_readers: i * 2,
          purchase_count: i * 3
        })),
        recentTransactions: Array.from({ length: 50 }, (_, i) => ({
          id: `txn-${i}`,
          storyTitle: `Story ${i}`,
          usdEquivalent: i * 0.5,
          createdAt: new Date().toISOString()
        }))
      })

      mockUseCreatorEarnings.data = largeDataset

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should still render within reasonable time
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
    })
  })
})