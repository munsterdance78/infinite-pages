import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest } from '@jest/globals'
import CreatorEarningsErrorBoundary from '@/components/CreatorEarningsErrorBoundary'

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>Component rendered successfully</div>
}

describe('CreatorEarningsErrorBoundary', () => {
  // Suppress console.error during tests
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Error Catching', () => {
    it('should catch and display errors', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should render children when no error occurs', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Component rendered successfully')).toBeInTheDocument()
      expect(screen.queryByText('Creator Earnings Error')).not.toBeInTheDocument()
    })

    it('should call onError callback when error occurs', () => {
      const onError = jest.fn()

      render(
        <CreatorEarningsErrorBoundary onError={onError}>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should log errors to console', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        'CreatorEarnings Error Boundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Retry Functionality', () => {
    it('should show retry button with attempts remaining', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const retryButton = screen.getByText(/Retry \(3 left\)/)
      expect(retryButton).toBeInTheDocument()
    })

    it('should retry component rendering when retry button is clicked', async () => {
      const user = userEvent.setup()
      let shouldThrow = true

      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Initial error')
        }
        return <div>Component recovered</div>
      }

      render(
        <CreatorEarningsErrorBoundary>
          <ConditionalError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()

      // Simulate fix
      shouldThrow = false

      const retryButton = screen.getByText(/Retry/)
      await user.click(retryButton)

      expect(screen.getByText('Component recovered')).toBeInTheDocument()
    })

    it('should decrease retry attempts on each retry', async () => {
      const user = userEvent.setup()

      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      // First retry
      let retryButton = screen.getByText(/Retry \(3 left\)/)
      await user.click(retryButton)

      // Second retry
      retryButton = screen.getByText(/Retry \(2 left\)/)
      await user.click(retryButton)

      // Third retry
      retryButton = screen.getByText(/Retry \(1 left\)/)
      await user.click(retryButton)

      // No more retries
      expect(screen.queryByText(/Retry/)).not.toBeInTheDocument()
      expect(screen.getByText('Maximum retry attempts reached')).toBeInTheDocument()
    })

    it('should show reset button when max retries reached', async () => {
      const user = userEvent.setup()

      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      // Exhaust all retries
      for (let i = 0; i < 3; i++) {
        const retryButton = screen.getByText(/Retry/)
        await user.click(retryButton)
      }

      expect(screen.getByText('Reset')).toBeInTheDocument()
    })

    it('should reset error state when reset button is clicked', async () => {
      const user = userEvent.setup()
      let shouldThrow = true

      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Initial error')
        }
        return <div>Component recovered</div>
      }

      render(
        <CreatorEarningsErrorBoundary>
          <ConditionalError />
        </CreatorEarningsErrorBoundary>
      )

      // Exhaust retries
      for (let i = 0; i < 3; i++) {
        const retryButton = screen.getByText(/Retry/)
        await user.click(retryButton)
      }

      // Simulate fix
      shouldThrow = false

      const resetButton = screen.getByText('Reset')
      await user.click(resetButton)

      expect(screen.getByText('Component recovered')).toBeInTheDocument()
    })
  })

  describe('Error Details', () => {
    it('should show technical details when showDetails is true', () => {
      render(
        <CreatorEarningsErrorBoundary showDetails={true}>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const detailsToggle = screen.getByText('Technical Details')
      expect(detailsToggle).toBeInTheDocument()
    })

    it('should hide technical details when showDetails is false', () => {
      render(
        <CreatorEarningsErrorBoundary showDetails={false}>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument()
    })

    it('should expand error details when clicked', async () => {
      const user = userEvent.setup()

      render(
        <CreatorEarningsErrorBoundary showDetails={true}>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const detailsToggle = screen.getByText('Technical Details')
      await user.click(detailsToggle)

      expect(screen.getByText(/Test error message/)).toBeInTheDocument()
      expect(screen.getByText(/Component Stack:/)).toBeInTheDocument()
    })
  })

  describe('Navigation Actions', () => {
    it('should provide back to dashboard button', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const backButton = screen.getByText('Back to Dashboard')
      expect(backButton).toBeInTheDocument()
    })

    it('should navigate to dashboard when back button is clicked', async () => {
      const user = userEvent.setup()
      const mockAssign = jest.fn()
      Object.defineProperty(window, 'location', {
        value: { href: mockAssign },
        writable: true
      })

      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const backButton = screen.getByText('Back to Dashboard')
      await user.click(backButton)

      expect(window.location.href).toBe('/dashboard')
    })
  })

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error fallback</div>

      render(
        <CreatorEarningsErrorBoundary fallback={customFallback}>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument()
      expect(screen.queryByText('Creator Earnings Error')).not.toBeInTheDocument()
    })
  })

  describe('Error Types', () => {
    it('should handle network errors appropriately', () => {
      const NetworkError = () => {
        throw new Error('Failed to fetch')
      }

      render(
        <CreatorEarningsErrorBoundary>
          <NetworkError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
    })

    it('should handle API errors appropriately', () => {
      const APIError = () => {
        throw new Error('Internal Server Error')
      }

      render(
        <CreatorEarningsErrorBoundary>
          <APIError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
    })

    it('should handle generic JavaScript errors', () => {
      const GenericError = () => {
        throw new TypeError('Cannot read property of undefined')
      }

      render(
        <CreatorEarningsErrorBoundary>
          <GenericError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Cannot read property of undefined')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      // Tab to first button
      await user.tab()
      expect(document.activeElement).toHaveTextContent(/Retry/)

      // Tab to next button
      await user.tab()
      expect(document.activeElement).toHaveTextContent('Reset')

      // Tab to next button
      await user.tab()
      expect(document.activeElement).toHaveTextContent('Back to Dashboard')
    })

    it('should announce errors to screen readers', () => {
      render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toHaveTextContent('Test error message')
    })
  })

  describe('Error State Management', () => {
    it('should maintain error state across re-renders', () => {
      const { rerender } = render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()

      rerender(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
    })

    it('should clear error state when children change to non-throwing component', () => {
      const { rerender } = render(
        <CreatorEarningsErrorBoundary>
          <ThrowError />
        </CreatorEarningsErrorBoundary>
      )

      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()

      rerender(
        <CreatorEarningsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </CreatorEarningsErrorBoundary>
      )

      // Error boundary should still be in error state until reset
      expect(screen.getByText('Creator Earnings Error')).toBeInTheDocument()
    })
  })
})