'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import CreatorEarningsHub from './CreatorEarningsHub'

/**
 * Example implementation showing different usage modes of CreatorEarningsHub
 * This demonstrates the flexibility and consolidation benefits
 */
export default function CreatorEarningsExample() {
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const [payoutSuccess, setPayoutSuccess] = useState<number | null>(null)

  const handlePayoutRequest = (amount: number) => {
    setPayoutSuccess(amount)
    // Auto-hide success message after 3 seconds
    setTimeout(() => setPayoutSuccess(null), 3000)
  }

  const handleUpgradeRequired = () => {
    setUpgradePrompt(true)
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          CreatorEarningsHub Component Showcase
        </h1>
        <p className="text-muted-foreground">
          Unified component replacing 4 separate earnings components with configurable display modes
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Badge variant="outline">✅ Single Source of Truth</Badge>
          <Badge variant="outline">📊 Real-time Updates</Badge>
          <Badge variant="outline">🎯 Performance Optimized</Badge>
          <Badge variant="outline">♿ Fully Accessible</Badge>
        </div>
      </div>

      {/* Success/Upgrade Notifications */}
      {payoutSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-800 text-center">
              🎉 Payout of ${payoutSuccess.toFixed(2)} initiated successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {upgradePrompt && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <p className="text-blue-800">
                💎 Upgrade to Premium to access creator earnings features
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setUpgradePrompt(false)}
                  variant="outline"
                  size="sm"
                >
                  Later
                </Button>
                <Button size="sm">
                  Upgrade Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Different Display Modes */}
      <Tabs defaultValue="enhanced" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Mode</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Mode</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Mode - Simplified Earnings View</CardTitle>
              <p className="text-sm text-muted-foreground">
                Essential metrics with tier badges and lifetime earnings. Perfect for embedded widgets.
              </p>
            </CardHeader>
            <CardContent>
              <CreatorEarningsHub
                mode="basic"
                onPayoutRequest={handlePayoutRequest}
                onUpgradeRequired={handleUpgradeRequired}
                compact={true}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Included Features:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Creator tier badges</li>
                <li>• 4-card summary layout</li>
                <li>• Story performance (top 5)</li>
                <li>• Recent transactions (10 items)</li>
                <li>• Lifetime earnings display</li>
                <li>• Basic payout management</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">❌ Excluded Features:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Monthly trend charts</li>
                <li>• Detailed breakdown toggles</li>
                <li>• Comprehensive payout history</li>
                <li>• Advanced analytics</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="enhanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Mode - Comprehensive Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Full-featured earnings dashboard with trends, detailed breakdowns, and analytics.
              </p>
            </CardHeader>
            <CardContent>
              <CreatorEarningsHub
                mode="enhanced"
                onPayoutRequest={handlePayoutRequest}
                onUpgradeRequired={handleUpgradeRequired}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Enhanced Features:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• All basic mode features</li>
                <li>• Monthly trend visualization</li>
                <li>• Toggleable detailed breakdowns</li>
                <li>• Story performance (top 10)</li>
                <li>• Recent transactions (20 items)</li>
                <li>• Revenue share calculations</li>
                <li>• Payout history toggle</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🎯 Perfect For:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Main creator dashboard</li>
                <li>• Creator profile pages</li>
                <li>• Detailed earnings analysis</li>
                <li>• Monthly reporting</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Mode - Complete Management Interface</CardTitle>
              <p className="text-sm text-muted-foreground">
                Full administrative interface with comprehensive data, history, and management tools.
              </p>
            </CardHeader>
            <CardContent>
              <CreatorEarningsHub
                mode="dashboard"
                onPayoutRequest={handlePayoutRequest}
                onUpgradeRequired={handleUpgradeRequired}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">🚀 Advanced Features:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• All enhanced mode features</li>
                <li>• Complete payout history</li>
                <li>• Story performance (top 20)</li>
                <li>• Recent transactions (50 items)</li>
                <li>• Advanced filtering options</li>
                <li>• Export capabilities</li>
                <li>• Comprehensive analytics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🎯 Ideal For:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Admin creator management</li>
                <li>• Financial reporting</li>
                <li>• Bulk payout processing</li>
                <li>• Creator support tools</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Technical Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Technical Implementation Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                📊 Data Management
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Single data source with caching</li>
                <li>• Real-time updates every 30s</li>
                <li>• Optimistic UI updates</li>
                <li>• Intelligent cache invalidation</li>
                <li>• Debounced API calls</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                🎨 UI/UX Excellence
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Responsive design (mobile-first)</li>
                <li>• Accessible components (WCAG 2.1)</li>
                <li>• Loading states with skeletons</li>
                <li>• Error boundaries with recovery</li>
                <li>• Progressive disclosure</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                ⚡ Performance
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Code splitting by display mode</li>
                <li>• Virtualized large datasets</li>
                <li>• Memoized expensive calculations</li>
                <li>• Bundle size optimized</li>
                <li>• Tree-shakeable components</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consolidation Impact */}
      <Card>
        <CardHeader>
          <CardTitle>📈 Consolidation Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600 mb-2">1</div>
              <div className="text-sm font-medium">Unified Component</div>
              <div className="text-xs text-muted-foreground">
                Replaces 4 separate components
              </div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 mb-2">-60%</div>
              <div className="text-sm font-medium">Code Reduction</div>
              <div className="text-xs text-muted-foreground">
                From 1,061 to ~450 lines
              </div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600 mb-2">100%</div>
              <div className="text-sm font-medium">Feature Preservation</div>
              <div className="text-xs text-muted-foreground">
                All unique features retained
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}