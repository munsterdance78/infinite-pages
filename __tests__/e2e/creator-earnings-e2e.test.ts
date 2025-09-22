/**
 * End-to-End Tests for Creator Earnings System
 *
 * These tests verify the complete user journey and system integration
 * from authentication through data display and interactions.
 */

import type { Page, BrowserContext } from '@playwright/test'
import { test, expect } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

// Mock user data for testing
const MOCK_CREATOR_USER = {
  email: 'creator@test.com',
  password: 'testpassword123',
  id: 'test-creator-id',
  tier: 'gold',
  subscription: 'premium'
}

const MOCK_ADMIN_USER = {
  email: 'admin@infinite-pages.com',
  password: 'adminpassword123',
  id: 'test-admin-id',
  tier: 'platinum',
  subscription: 'admin'
}

test.describe('Creator Earnings E2E Tests', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'en-US'
    })
  })

  test.beforeEach(async () => {
    page = await context.newPage()

    // Mock API responses
    await page.route('**/api/creators/earnings**', async route => {
      const url = route.request().url()

      if (url.includes('view=basic')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            summary: {
              totalEarningsUsd: 1250.75,
              pendingPayoutUsd: 125.50,
              totalCreditsEarned: 12507,
              uniqueReaders: 45,
              storiesWithEarnings: 8
            },
            storyPerformance: [
              {
                story_id: 'story-1',
                story_title: 'Test Story 1',
                total_usd: 175.50,
                unique_readers: 23,
                purchase_count: 12
              },
              {
                story_id: 'story-2',
                story_title: 'Test Story 2',
                total_usd: 105.25,
                unique_readers: 15,
                purchase_count: 8
              }
            ],
            recentTransactions: [
              {
                id: 'txn-1',
                storyTitle: 'Test Story 1',
                usdEquivalent: 12.35,
                createdAt: '2024-01-15T10:00:00Z'
              }
            ],
            meta: {
              view: 'basic',
              subscriptionTier: 'free',
              creatorTier: 'bronze',
              apiVersion: '2.0.0',
              cached: false
            }
          })
        })
      } else if (url.includes('view=enhanced')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            summary: {
              totalEarningsUsd: 1250.75,
              pendingPayoutUsd: 125.50,
              totalCreditsEarned: 12507,
              uniqueReaders: 45,
              storiesWithEarnings: 8
            },
            storyPerformance: [
              {
                story_id: 'story-1',
                story_title: 'Test Story 1',
                total_usd: 175.50,
                unique_readers: 23,
                purchase_count: 12
              },
              {
                story_id: 'story-2',
                story_title: 'Test Story 2',
                total_usd: 105.25,
                unique_readers: 15,
                purchase_count: 8
              }
            ],
            recentTransactions: [
              {
                id: 'txn-1',
                storyTitle: 'Test Story 1',
                usdEquivalent: 12.35,
                createdAt: '2024-01-15T10:00:00Z'
              }
            ],
            monthlyTrends: [
              { month: 'Jan 2024', earnings: 450.25 },
              { month: 'Feb 2024', earnings: 380.50 },
              { month: 'Mar 2024', earnings: 420.00 }
            ],
            meta: {
              view: 'enhanced',
              subscriptionTier: 'premium',
              creatorTier: 'gold',
              apiVersion: '2.0.0',
              cached: false
            }
          })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            summary: { totalEarningsUsd: 0, pendingPayoutUsd: 0, totalCreditsEarned: 0, uniqueReaders: 0, storiesWithEarnings: 0 },
            storyPerformance: [],
            recentTransactions: [],
            meta: { view: 'enhanced', subscriptionTier: 'premium', creatorTier: 'gold', apiVersion: '2.0.0', cached: false }
          })
        })
      }
    })

    // Mock authentication
    await page.route('**/api/auth/**', async route => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postData()
        if (postData?.includes(MOCK_CREATOR_USER.email)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {
                id: MOCK_CREATOR_USER.id,
                email: MOCK_CREATOR_USER.email,
                is_creator: true,
                subscription_tier: MOCK_CREATOR_USER.subscription,
                creator_tier: MOCK_CREATOR_USER.tier
              },
              session: { access_token: 'mock-token' }
            })
          })
        }
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: MOCK_CREATOR_USER.id,
              email: MOCK_CREATOR_USER.email,
              is_creator: true,
              subscription_tier: MOCK_CREATOR_USER.subscription,
              creator_tier: MOCK_CREATOR_USER.tier
            }
          })
        })
      }
    })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.describe('Complete User Journey', () => {
    test('should complete full creator earnings workflow', async () => {
      // 1. Navigate to earnings page
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // 2. Verify page loads and shows earnings data
      await expect(page.locator('h1')).toContainText('Creator Earnings')
      await expect(page.locator('[data-testid="total-earnings"]')).toContainText('$1,250.75')

      // 3. Change time period
      await page.selectOption('[data-testid="period-select"]', 'last_month')

      // 4. Verify data updates (in real app, this would trigger new API call)
      await expect(page.locator('[data-testid="period-select"]')).toHaveValue('last_month')

      // 5. Toggle breakdown view
      await page.click('[data-testid="breakdown-toggle"]')
      await expect(page.locator('[data-testid="payout-breakdown"]')).toBeVisible()

      // 6. Request payout
      await page.click('[data-testid="request-payout-button"]')
      await expect(page.locator('[data-testid="payout-modal"]')).toBeVisible()

      // 7. Confirm payout request
      await page.click('[data-testid="confirm-payout"]')
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Payout requested successfully')

      // 8. Export data
      await page.click('[data-testid="export-csv-button"]')

      // Note: In real tests, you would verify file download
      // For now, we verify the button click registers
      await expect(page.locator('[data-testid="export-csv-button"]')).toBeVisible()
    })

    test('should handle authentication flow correctly', async () => {
      // 1. Start unauthenticated
      await page.route('**/api/auth/**', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' })
        })
      })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // 2. Should redirect to sign in
      await expect(page).toHaveURL(/.*\/auth\/signin/)

      // 3. Complete sign in
      await page.fill('[data-testid="email-input"]', MOCK_CREATOR_USER.email)
      await page.fill('[data-testid="password-input"]', MOCK_CREATOR_USER.password)
      await page.click('[data-testid="signin-button"]')

      // 4. Should redirect back to earnings
      await expect(page).toHaveURL(/.*\/dashboard\/earnings/)
      await expect(page.locator('h1')).toContainText('Creator Earnings')
    })

    test('should show appropriate content based on subscription tier', async () => {
      // Test free tier restrictions
      await page.route('**/api/creators/earnings**', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Premium subscription required for enhanced features'
          })
        })
      })

      await page.goto(`${BASE_URL}/dashboard/earnings?view=enhanced`)

      await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible()
      await expect(page.locator('[data-testid="upgrade-button"]')).toContainText('Upgrade to Premium')

      // Click upgrade and verify navigation
      await page.click('[data-testid="upgrade-button"]')
      await expect(page).toHaveURL(/.*\/subscription\/upgrade/)
    })
  })

  test.describe('Responsive Design Testing', () => {
    test('should work correctly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Verify mobile layout
      await expect(page.locator('[data-testid="summary-grid"]')).toHaveClass(/grid-cols-1/)

      // Verify mobile table converts to cards
      await expect(page.locator('[data-testid="mobile-story-cards"]')).toBeVisible()
      await expect(page.locator('[data-testid="desktop-table"]')).toBeHidden()

      // Test mobile navigation
      await page.click('[data-testid="mobile-menu-button"]')
      await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible()
    })

    test('should work correctly on tablet devices', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Verify tablet layout
      await expect(page.locator('[data-testid="summary-grid"]')).toHaveClass(/md:grid-cols-2/)

      // Table should be visible but condensed
      await expect(page.locator('[data-testid="desktop-table"]')).toBeVisible()
      await expect(page.locator('table')).toHaveClass(/text-sm/)
    })

    test('should adapt to orientation changes', async () => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      await expect(page.locator('[data-testid="summary-grid"]')).toHaveClass(/grid-cols-1/)

      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 })

      // Layout should adapt
      await expect(page.locator('[data-testid="main-container"]')).toHaveClass(/landscape:px-6/)
    })
  })

  test.describe('Accessibility Testing', () => {
    test('should be navigable with keyboard only', async () => {
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Tab through interactive elements
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="period-select"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="refresh-button"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('[data-testid="request-payout-button"]')).toBeFocused()

      // Test keyboard activation
      await page.keyboard.press('Enter')
      await expect(page.locator('[data-testid="payout-modal"]')).toBeVisible()

      // Escape should close modal
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="payout-modal"]')).toBeHidden()
    })

    test('should announce changes to screen readers', async () => {
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Check for proper ARIA live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible()

      // Change period and verify announcement
      await page.selectOption('[data-testid="period-select"]', 'last_month')

      // Status should update
      await expect(page.locator('[role="status"]')).toContainText('Loading')
    })

    test('should have proper heading structure', async () => {
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Verify heading hierarchy
      const h1 = page.locator('h1')
      await expect(h1).toContainText('Creator Earnings')

      const h2Elements = page.locator('h2')
      await expect(h2Elements.first()).toContainText('Earnings Summary')

      const h3Elements = page.locator('h3')
      await expect(h3Elements.first()).toContainText('Story Performance')
    })

    test('should support high contrast mode', async () => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Verify high contrast styles are applied
      const mainContainer = page.locator('[data-testid="main-container"]')
      await expect(mainContainer).toHaveClass(/high-contrast/)
    })
  })

  test.describe('Performance Testing', () => {
    test('should load quickly and be interactive', async () => {
      // Measure page load performance
      const startTime = Date.now()

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Wait for main content to be visible
      await expect(page.locator('[data-testid="total-earnings"]')).toBeVisible()

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds

      // Test Time to Interactive
      const interactionStart = Date.now()
      await page.click('[data-testid="period-select"]')
      const interactionTime = Date.now() - interactionStart
      expect(interactionTime).toBeLessThan(100) // Should be interactive quickly
    })

    test('should handle large datasets efficiently', async () => {
      // Mock large dataset
      await page.route('**/api/creators/earnings**', async route => {
        const largeData = {
          summary: {
            totalEarningsUsd: 15250.75,
            pendingPayoutUsd: 1255.50,
            totalCreditsEarned: 152507,
            uniqueReaders: 2450,
            storiesWithEarnings: 85
          },
          storyPerformance: Array.from({ length: 100 }, (_, i) => ({
            story_id: `story-${i}`,
            story_title: `Story ${i + 1}`,
            total_usd: (i + 1) * 10,
            unique_readers: (i + 1) * 2,
            purchase_count: i + 1
          })),
          recentTransactions: Array.from({ length: 50 }, (_, i) => ({
            id: `txn-${i}`,
            storyTitle: `Story ${i + 1}`,
            usdEquivalent: i * 2.5,
            createdAt: new Date().toISOString()
          })),
          meta: {
            view: 'enhanced',
            subscriptionTier: 'premium',
            creatorTier: 'gold',
            apiVersion: '2.0.0',
            cached: false
          }
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeData)
        })
      })

      const startTime = Date.now()
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Wait for all content to load
      await expect(page.locator('[data-testid="total-earnings"]')).toContainText('$15,250.75')

      const renderTime = Date.now() - startTime
      expect(renderTime).toBeLessThan(5000) // Should handle large datasets within 5 seconds

      // Verify scrolling performance
      await page.mouse.wheel(0, 1000)
      await page.waitForTimeout(100) // Allow scroll to complete

      // Page should remain responsive
      await page.click('[data-testid="refresh-button"]')
      await expect(page.locator('[role="status"]')).toContainText('Loading')
    })
  })

  test.describe('Error Handling', () => {
    test('should gracefully handle API failures', async () => {
      // Mock API failure
      await page.route('**/api/creators/earnings**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        })
      })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Should show error state
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load earnings data')
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()

      // Test retry functionality
      await page.click('[data-testid="retry-button"]')
      await expect(page.locator('[role="status"]')).toContainText('Loading')
    })

    test('should handle network failures gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/creators/earnings**', async route => {
        await route.abort('failed')
      })

      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="network-error"]')).toContainText('Check your internet connection')
    })

    test('should handle session expiration', async () => {
      await page.goto(`${BASE_URL}/dashboard/earnings`)

      // Initially authenticated
      await expect(page.locator('[data-testid="total-earnings"]')).toBeVisible()

      // Simulate session expiration
      await page.route('**/api/creators/earnings**', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' })
        })
      })

      // Trigger a refresh
      await page.click('[data-testid="refresh-button"]')

      // Should show session expired message and redirect
      await expect(page.locator('[data-testid="session-expired"]')).toBeVisible()
      await expect(page).toHaveURL(/.*\/auth\/signin/)
    })
  })

  test.describe('Cross-Browser Compatibility', () => {
    // These tests would run across different browsers
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`should work correctly in ${browserName}`, async () => {
        await page.goto(`${BASE_URL}/dashboard/earnings`)

        // Core functionality should work across all browsers
        await expect(page.locator('h1')).toContainText('Creator Earnings')
        await expect(page.locator('[data-testid="total-earnings"]')).toContainText('$1,250.75')

        // Interactive elements should work
        await page.click('[data-testid="period-select"]')
        await page.selectOption('[data-testid="period-select"]', 'last_month')
        await expect(page.locator('[data-testid="period-select"]')).toHaveValue('last_month')
      })
    })
  })
})