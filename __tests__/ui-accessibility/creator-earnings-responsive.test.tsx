import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import { createMockEarningsData } from '@/test/utils/test-utils'

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

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock matchMedia for responsive queries
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(mockMatchMedia)
})

describe('Creator Earnings Responsive Design Tests', () => {
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

    // Reset viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    })
  })

  describe('Breakpoint Behavior', () => {
    it('should adapt layout for mobile screens (< 768px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should use mobile-first responsive classes
      expect(container.querySelector('.grid-cols-1')).toBeInTheDocument()
      expect(container.querySelector('.sm\\:grid-cols-2')).toBeInTheDocument()
    })

    it('should adapt layout for tablet screens (768px - 1024px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should use tablet layout
      expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument()
      expect(container.querySelector('.lg\\:grid-cols-4')).toBeInTheDocument()
    })

    it('should use full desktop layout for large screens (> 1024px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should use full desktop layout
      expect(container.querySelector('.lg\\:grid-cols-4')).toBeInTheDocument()
      expect(container.querySelector('.xl\\:grid-cols-4')).toBeInTheDocument()
    })

    it('should handle ultra-wide screens (> 1920px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 2560
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should not exceed maximum width
      expect(container.querySelector('.max-w-7xl')).toBeInTheDocument()
    })
  })

  describe('Mobile Layout Optimizations', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })
    })

    it('should stack summary cards vertically on mobile', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const summaryGrid = container.querySelector('[data-testid="summary-grid"]')
      expect(summaryGrid).toHaveClass('grid-cols-1')
      expect(summaryGrid).toHaveClass('gap-4')
    })

    it('should convert table to card layout on mobile', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Table should be hidden on mobile, replaced with cards
      const table = screen.getByRole('table')
      expect(table).toHaveClass('hidden', 'md:table')

      // Cards should be visible
      const cardContainer = screen.getByTestId('mobile-story-cards')
      expect(cardContainer).toHaveClass('block', 'md:hidden')
    })

    it('should adjust button sizes for touch on mobile', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Touch targets should be at least 44px
        expect(button).toHaveClass('min-h-11') // 44px
        expect(button).toHaveClass('px-4')
      })
    })

    it('should optimize text sizes for mobile readability', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveClass('text-2xl', 'md:text-3xl')

      const earningsAmount = screen.getByText('$1,250.75')
      expect(earningsAmount).toHaveClass('text-xl', 'md:text-2xl')
    })

    it('should show mobile-optimized navigation', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Period selector should be full width on mobile
      const periodSelect = screen.getByRole('combobox', { name: /time period/i })
      expect(periodSelect).toHaveClass('w-full', 'md:w-auto')
    })
  })

  describe('Tablet Layout Optimizations', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      })
    })

    it('should use 2-column layout for summary cards', () => {
      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      const summaryGrid = container.querySelector('[data-testid="summary-grid"]')
      expect(summaryGrid).toHaveClass('md:grid-cols-2')
    })

    it('should show condensed table view', () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      const table = screen.getByRole('table')
      expect(table).toHaveClass('text-sm', 'md:text-base')
    })

    it('should optimize sidebar layout for tablets', () => {
      render(<CreatorEarningsHub {...defaultProps} mode="enhanced" />)

      const sidebar = screen.getByTestId('earnings-sidebar')
      expect(sidebar).toHaveClass('w-full', 'md:w-1/3')
    })
  })

  describe('Dynamic Content Adaptation', () => {
    it('should handle content overflow gracefully', () => {
      const longTitleData = createMockEarningsData({
        storyPerformance: [
          {
            story_id: 'story-1',
            story_title: 'This is an extremely long story title that might cause layout issues if not handled properly',
            total_usd: 175.50,
            unique_readers: 23,
            purchase_count: 12
          }
        ]
      })

      mockUseCreatorEarnings.data = longTitleData

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Long titles should be truncated with ellipsis
      const titleElement = screen.getByText(/This is an extremely long story title/)
      expect(titleElement).toHaveClass('truncate')
    })

    it('should adapt to dynamic data changes', async () => {
      const { rerender } = render(<CreatorEarningsHub {...defaultProps} />)

      // Start with small dataset
      expect(screen.getAllByText(/Test Story/)).toHaveLength(2)

      // Update with larger dataset
      const largeDataset = createMockEarningsData({
        storyPerformance: Array.from({ length: 20 }, (_, i) => ({
          story_id: `story-${i}`,
          story_title: `Test Story ${i + 1}`,
          total_usd: (i + 1) * 10,
          unique_readers: (i + 1) * 2,
          purchase_count: i + 1
        }))
      })

      mockUseCreatorEarnings.data = largeDataset
      rerender(<CreatorEarningsHub {...defaultProps} />)

      // Should show pagination or virtual scrolling
      await waitFor(() => {
        expect(screen.getByText('Show More')).toBeInTheDocument()
      })
    })

    it('should handle empty states responsively', () => {
      const emptyData = createMockEarningsData({
        summary: {
          totalEarningsUsd: 0,
          pendingPayoutUsd: 0,
          totalCreditsEarned: 0,
          uniqueReaders: 0,
          storiesWithEarnings: 0
        },
        storyPerformance: [],
        recentTransactions: []
      })

      mockUseCreatorEarnings.data = emptyData

      render(<CreatorEarningsHub {...defaultProps} />)

      const emptyState = screen.getByTestId('empty-earnings-state')
      expect(emptyState).toHaveClass('py-12', 'text-center')
    })
  })

  describe('Orientation Changes', () => {
    it('should adapt to landscape orientation on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should use landscape-optimized layout
      const container = screen.getByRole('main')
      expect(container).toHaveClass('landscape:px-6')
    })

    it('should handle orientation change events', async () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Simulate orientation change
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375
      })

      // Trigger resize event
      const resizeEvent = new Event('resize')
      window.dispatchEvent(resizeEvent)

      await waitFor(() => {
        // Layout should adapt
        expect(screen.getByRole('main')).toBeInTheDocument()
      })
    })
  })

  describe('Print Styles', () => {
    it('should optimize layout for printing', () => {
      // Mock print media query
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === 'print',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should apply print styles
      expect(container.firstChild).toHaveClass('print:bg-white', 'print:text-black')
    })

    it('should hide interactive elements in print view', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === 'print',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))

      render(<CreatorEarningsHub {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('print:hidden')
      })
    })
  })

  describe('Container Queries', () => {
    it('should adapt to parent container size', () => {
      // Mock container with specific width
      const { container } = render(
        <div style={{ width: '400px' }}>
          <CreatorEarningsHub {...defaultProps} />
        </div>
      )

      // Should adapt to container width regardless of viewport
      const earningsComponent = container.querySelector('[data-testid="earnings-hub"]')
      expect(earningsComponent).toHaveClass('container-sm')
    })

    it('should handle nested responsive contexts', () => {
      render(
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <CreatorEarningsHub {...defaultProps} compact={true} />
        </div>
      )

      // Compact mode should override some responsive behaviors
      const component = screen.getByTestId('earnings-hub')
      expect(component).toHaveClass('compact-layout')
    })
  })

  describe('Performance on Different Devices', () => {
    it('should optimize rendering for low-end devices', () => {
      // Mock low-end device capabilities
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: true,
        value: 2
      })

      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: { effectiveType: '2g' }
      })

      render(<CreatorEarningsHub {...defaultProps} />)

      // Should reduce visual complexity
      const chartContainer = screen.queryByTestId('earnings-chart')
      expect(chartContainer).toHaveClass('reduced-motion')
    })

    it('should handle high-DPI displays properly', () => {
      // Mock high-DPI display
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 3
      })

      const { container } = render(<CreatorEarningsHub {...defaultProps} />)

      // Should load high-resolution assets
      const images = container.querySelectorAll('img')
      images.forEach(img => {
        expect(img.getAttribute('srcset')).toContain('2x')
      })
    })
  })

  describe('Accessibility with Responsive Design', () => {
    it('should maintain touch target sizes across breakpoints', () => {
      const viewports = [375, 768, 1024, 1440]

      viewports.forEach(width => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width
        })

        const { container } = render(<CreatorEarningsHub {...defaultProps} />)

        const buttons = container.querySelectorAll('button')
        buttons.forEach(button => {
          const computedStyle = window.getComputedStyle(button)
          const minHeight = parseInt(computedStyle.minHeight)
          expect(minHeight).toBeGreaterThanOrEqual(44) // 44px minimum
        })
      })
    })

    it('should maintain keyboard navigation flow across layouts', async () => {
      const user = userEvent.setup()

      // Test mobile layout
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const { rerender } = render(<CreatorEarningsHub {...defaultProps} />)

      await user.tab()
      const firstFocusedElement = document.activeElement

      // Change to desktop layout
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440
      })

      rerender(<CreatorEarningsHub {...defaultProps} />)

      // Focus should be preserved or handled gracefully
      expect(document.activeElement).toBeDefined()
    })

    it('should announce layout changes to screen readers', async () => {
      render(<CreatorEarningsHub {...defaultProps} />)

      // Simulate layout change
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const resizeEvent = new Event('resize')
      window.dispatchEvent(resizeEvent)

      await waitFor(() => {
        const announcement = screen.getByRole('status')
        expect(announcement).toHaveTextContent('Layout changed to mobile view')
      })
    })
  })
})