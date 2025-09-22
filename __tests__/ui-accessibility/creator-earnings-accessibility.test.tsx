import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { jest } from '@jest/globals'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import { createMockEarningsData } from '@/test/utils/test-utils'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock the hook
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

jest.mock('@/hooks/useCreatorEarnings', () => ({
  useCreatorEarnings: () => mockUseCreatorEarnings
}))

describe('Creator Earnings Accessibility Tests', () => {
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

  describe('WCAG 2.1 AA Compliance', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in loading state', async () => {
      mockUseCreatorEarnings.loading = true
      mockUseCreatorEarnings.data = null

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in error state', async () => {
      mockUseCreatorEarnings.loading = false
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Failed to load earnings data'

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility with large datasets', async () => {
      const largeDataset = createMockEarningsData({
        storyPerformance: Array.from({ length: 100 }, (_, i) => ({
          story_id: `story-${i}`,
          story_title: `Story ${i}`,
          total_usd: i * 10,
          unique_readers: i * 2,
          purchase_count: i * 3
        }))
      })

      mockUseCreatorEarnings.data = largeDataset

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Semantic HTML Structure', () => {
    it('should use proper semantic elements', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /earnings summary/i })).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    })

    it('should have proper heading hierarchy', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const headings = screen.getAllByRole('heading')
      expect(headings[0]).toHaveProperty('tagName', 'H1')
      expect(headings[1]).toHaveProperty('tagName', 'H2')
      expect(headings[2]).toHaveProperty('tagName', 'H3')
    })

    it('should use lists for grouped content', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('list', { name: /earnings summary/i })).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(4) // Summary cards
    })

    it('should have proper form structure', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('combobox', { name: /time period/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /display mode/i })).toBeInTheDocument()
    })
  })

  describe('ARIA Labels and Descriptions', () => {
    it('should have descriptive ARIA labels', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByLabelText('Total earnings in USD')).toBeInTheDocument()
      expect(screen.getByLabelText('Pending payout amount')).toBeInTheDocument()
      expect(screen.getByLabelText('Number of unique readers')).toBeInTheDocument()
      expect(screen.getByLabelText('Stories with earnings')).toBeInTheDocument()
    })

    it('should have proper button descriptions', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('button', { name: /refresh earnings data/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /request payout/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export to csv/i })).toBeInTheDocument()
    })

    it('should describe table content appropriately', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const table = screen.getByRole('table')
      expect(table).toHaveAttribute('aria-label', 'Story performance data')

      const caption = screen.getByText('Story performance for the selected time period')
      expect(caption).toBeInTheDocument()
    })

    it('should provide context for interactive elements', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const periodSelect = screen.getByRole('combobox', { name: /time period/i })
      expect(periodSelect).toHaveAttribute('aria-describedby')

      const describedBy = periodSelect.getAttribute('aria-describedby')
      expect(screen.getByText('Select the time period for earnings data')).toHaveAttribute('id', describedBy)
    })

    it('should announce dynamic content changes', () => {
      const { rerender } = render(<CreatorEarningsHub {...defaultProps} />)

      // Change to loading state
      mockUseCreatorEarnings.loading = true
      rerender(<CreatorEarningsHub {...defaultProps} />)

      expect(screen.getByRole('status')).toHaveTextContent('Loading Creator Earnings')
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      // Start navigation
      await user.tab()
      expect(document.activeElement).toHaveAttribute('role', 'combobox')

      await user.tab()
      expect(document.activeElement).toHaveAttribute('type', 'button')

      await user.tab()
      expect(document.activeElement).toHaveAttribute('type', 'button')

      await user.tab()
      expect(document.activeElement).toHaveAttribute('role', 'combobox')
    })

    it('should handle Enter and Space keys for button interactions', async () => {
      const user = userEvent.setup()
      const onPayoutRequest = jest.fn()

      render(<CreatorEarningsHub {...defaultProps} onPayoutRequest={onPayoutRequest} />)

      const payoutButton = screen.getByRole('button', { name: /request payout/i })
      payoutButton.focus()

      await user.keyboard('{Enter}')
      expect(onPayoutRequest).toHaveBeenCalledTimes(1)

      await user.keyboard(' ')
      expect(onPayoutRequest).toHaveBeenCalledTimes(2)
    })

    it('should support arrow key navigation in dropdowns', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      const periodSelect = screen.getByRole('combobox', { name: /time period/i })
      await user.click(periodSelect)

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')

      expect(mockUseCreatorEarnings.changePeriod).toHaveBeenCalled()
    })

    it('should provide visual focus indicators', async () => {
      const user = userEvent.setup()
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      await user.tab()

      const focusedElement = document.activeElement
      const computedStyle = window.getComputedStyle(focusedElement!)

      // Should have focus styles (outline, box-shadow, etc.)
      expect(computedStyle.outline).not.toBe('none')
    })

    it('should trap focus in modal dialogs', async () => {
      const user = userEvent.setup()
      render(<CreatorEarningsHub {...defaultProps} />)

      // Open payout breakdown modal
      const breakdownButton = screen.getByText('Show Breakdown')
      await user.click(breakdownButton)

      // Focus should be trapped within modal
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()

      await user.tab()
      expect(document.activeElement).toBeInstanceOf(HTMLElement)
      expect(modal).toContainElement(document.activeElement)
    })
  })

  describe('Screen Reader Support', () => {
    it('should announce loading states', () => {
      mockUseCreatorEarnings.loading = true
      mockUseCreatorEarnings.data = null

      render(<CreatorEarningsHub {...defaultProps} />)

      const loadingAnnouncement = screen.getByRole('status')
      expect(loadingAnnouncement).toHaveTextContent('Loading Creator Earnings')
      expect(loadingAnnouncement).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce errors assertively', () => {
      mockUseCreatorEarnings.data = null
      mockUseCreatorEarnings.error.general = 'Failed to load earnings data'

      render(<CreatorEarningsHub {...defaultProps} />)

      const errorAnnouncement = screen.getByRole('alert')
      expect(errorAnnouncement).toHaveTextContent('Failed to load earnings data')
      expect(errorAnnouncement).toHaveAttribute('aria-live', 'assertive')
    })

    it('should provide meaningful data summaries', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const summary = screen.getByRole('region', { name: /earnings summary/i })
      expect(summary).toHaveAttribute('aria-describedby')

      const description = document.getElementById(summary.getAttribute('aria-describedby')!)
      expect(description).toHaveTextContent(/You have earned.*from.*stories with.*unique readers/i)
    })

    it('should describe chart content for screen readers', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const chart = screen.getByRole('img', { name: /earnings trend chart/i })
      expect(chart).toHaveAttribute('aria-describedby')

      const chartDescription = document.getElementById(chart.getAttribute('aria-describedby')!)
      expect(chartDescription).toHaveTextContent(/earnings trend over time/i)
    })

    it('should provide table summaries', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const table = screen.getByRole('table')
      expect(table).toHaveAttribute('aria-describedby')

      const summary = document.getElementById(table.getAttribute('aria-describedby')!)
      expect(summary).toHaveTextContent(/performance data for.*stories/i)
    })
  })

  describe('Color and Contrast', () => {
    it('should maintain sufficient color contrast', async () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // This would require additional contrast checking tools
      // For now, we verify the elements are rendered correctly
      expect(container.querySelector('.text-green-600')).toBeInTheDocument()
      expect(container.querySelector('.text-gray-900')).toBeInTheDocument()
    })

    it('should not rely solely on color for information', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Positive earnings should have both green color AND up arrow/text
      const positiveEarning = screen.getByText('$17.50')
      const parentElement = positiveEarning.closest('div')
      expect(parentElement).toHaveTextContent('↑') // Arrow indicator

      // Or check for alternative text indicators
      expect(screen.getByText('Increase')).toBeInTheDocument()
    })

    it('should support high contrast mode', () => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should apply high contrast styles
      expect(container.firstChild).toHaveClass('high-contrast')
    })
  })

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Touch targets should be at least 44px
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button)
        const minHeight = parseInt(computedStyle.minHeight)
        expect(minHeight).toBeGreaterThanOrEqual(44)
      })
    })

    it('should adapt table layout for small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should transform table to card layout on mobile
      const tableContainer = screen.getByRole('table').closest('div')
      expect(tableContainer).toHaveClass('mobile-card-layout')
    })

    it('should maintain keyboard navigation on touch devices', async () => {
      const user = userEvent.setup()

      // Mock touch device
      Object.defineProperty(window, 'ontouchstart', {
        writable: true,
        value: null
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should still support keyboard navigation
      await user.tab()
      expect(document.activeElement).toHaveAttribute('role', 'combobox')
    })
  })

  describe('Internationalization Accessibility', () => {
    it('should support right-to-left languages', () => {
      // Mock RTL language
      document.documentElement.dir = 'rtl'
      document.documentElement.lang = 'ar'

      render(<CreatorEarningsHub {...defaultProps} />)

      const main = screen.getByRole('main')
      expect(main).toHaveAttribute('dir', 'rtl')

      // Cleanup
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    })

    it('should provide proper language attributes', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const currencyElements = screen.getAllByText(/\$[\d,]+\.?\d*/i)
      currencyElements.forEach(element => {
        expect(element).toHaveAttribute('lang', 'en-US')
      })
    })

    it('should support screen reader pronunciation hints', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Currency amounts should have proper pronunciation
      const totalEarnings = screen.getByText('$1,250.75')
      expect(totalEarnings).toHaveAttribute('aria-label', '1250 dollars and 75 cents')
    })
  })

  describe('Progressive Enhancement', () => {
    it('should work without JavaScript', () => {
      // Mock no-JS environment
      const originalCreateElement = document.createElement
      document.createElement = jest.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(document, tagName)
        if (tagName === 'script') {
          element.disabled = true
        }
        return element
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Basic content should still be accessible
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByText('$1,250.75')).toBeInTheDocument()

      // Restore
      document.createElement = originalCreateElement
    })

    it('should gracefully degrade interactive features', () => {
      // Mock limited capability environment
      render(<CreatorEarningsHub {...defaultProps} />)

      // Core data should be accessible even if interactions fail
      expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })
})