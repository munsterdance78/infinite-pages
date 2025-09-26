'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Crown,
  Check,
  X,
  CreditCard,
  Calendar,
  Zap,
  Star,
  AlertCircle,
  Gift,
  DollarSign,
  Users,
  Download,
  BarChart
} from 'lucide-react'

interface SubscriptionManagerProps {
  user: {
    id: string;
    full_name: string;
    subscription_tier: 'free' | 'pro';
    subscription_status: string;
    current_period_end?: string;
    tokens_remaining: number;
    stories_created: number;
    words_generated: number;
  };
  onSubscriptionChange: () => void;
}

const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    price: 7.99,
    tokens: 1332,
    features: [
      '1,332 Credits per month',
      'Foundation, character & chapter generation',
      '5 stories per month',
      '2 cover generations',
      'Community support',
      'Improvements allowed'
    ],
    limits: [
      'No export access',
      'No priority support',
      'Credit accumulation limited to 3 months'
    ],
    color: 'blue',
    popular: false
  },
  premium: {
    name: 'Premium',
    price: 14.99,
    tokens: 2497,
    features: [
      '2,497 Credits per month',
      'Advanced AI operations & improvements',
      'Unlimited stories',
      'All export formats (PDF, EPUB, DOCX)',
      '10 cover generations',
      'Priority support & analytics dashboard',
      'Creator tools & early access'
    ],
    limits: [],
    color: 'purple',
    popular: true
  }
}

export default function SubscriptionManager({ user, onSubscriptionChange }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [usageStats, setUsageStats] = useState<any>(null)

  const supabase = createClient()
  const currentPlan = SUBSCRIPTION_PLANS[user.subscription_tier]

  useEffect(() => {
    fetchUsageStats()
  }, [])

  const fetchUsageStats = async () => {
    try {
      // Calculate monthly usage
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { data: monthlyLogs } = await supabase
        .from('generation_logs')
        .select('tokens_input, tokens_output, cost_usd')
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString())

      const { data: monthlyStories } = await supabase
        .from('stories')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString())

      const monthlyTokensUsed = monthlyLogs?.reduce((sum, log) => 
        sum + log.tokens_input + log.tokens_output, 0) || 0
      const monthlyCost = monthlyLogs?.reduce((sum, log) => sum + log.cost_usd, 0) || 0
      const monthlyStoriesCreated = monthlyStories?.length || 0

      setUsageStats({
        monthlyTokensUsed,
        monthlyCost,
        monthlyStoriesCreated,
        tokensRemaining: user.tokens_remaining,
        maxTokens: currentPlan.tokens
      })
    } catch (error) {
      console.error('Failed to fetch usage stats:', error)
    }
  }

  const createCheckoutSession = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.url
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to process checkout')
    } finally {
      setLoading(false)
    }
  }

  const createPortalSession = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/create-portal', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.url
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to access billing portal')
      }
    } catch (error) {
      console.error('Portal error:', error)
      alert('Failed to access billing portal')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'canceled':
        return <Badge className="bg-orange-100 text-orange-800">Canceled</Badge>
      case 'past_due':
        return <Badge className="bg-red-100 text-red-800">Past Due</Badge>
      default:
        return <Badge variant="secondary">Inactive</Badge>
    }
  }

  const getUsagePercentage = () => {
    if (!usageStats) return 0
    return (usageStats.monthlyTokensUsed / currentPlan.tokens) * 100
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Crown className="w-6 h-6 text-yellow-600" />
                Current Plan
              </CardTitle>
              <p className="text-gray-600 mt-1">
                Manage your subscription and view usage details
              </p>
            </div>
            {getStatusBadge(user.subscription_status)}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {currentPlan.name}
                  </h3>
                  {user.subscription_tier !== 'free' && (
                    <div className="text-xl font-semibold text-gray-700">
                      ${currentPlan.price}/month
                    </div>
                  )}
                </div>
                {currentPlan.popular && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                {currentPlan.tokens} Creative Tokens per month
              </div>

              {user.current_period_end && (
                <div className="text-sm text-gray-600">
                  {user.subscription_status === 'canceled' 
                    ? `Access ends on ${formatDate(user.current_period_end)}`
                    : `Renews on ${formatDate(user.current_period_end)}`
                  }
                </div>
              )}

              {user.subscription_status === 'past_due' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <div className="text-sm">
                    <div className="font-medium text-red-800">Payment Required</div>
                    <div className="text-red-700">Please update your payment method to continue service.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Usage Statistics */}
            {usageStats && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800">This Month's Usage</h4>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Tokens Used</span>
                      <span className="font-medium">
                        {usageStats.monthlyTokensUsed} / {currentPlan.tokens}
                      </span>
                    </div>
                    <Progress value={getUsagePercentage()} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {usageStats.monthlyStoriesCreated}
                      </div>
                      <div className="text-xs text-blue-700">Stories Created</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        ${usageStats.monthlyCost.toFixed(3)}
                      </div>
                      <div className="text-xs text-green-700">API Cost</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t">
            {user.subscription_tier === 'free' ? (
              <Button 
                onClick={() => setShowUpgradeDialog(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={createPortalSession}
                disabled={loading}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <p className="text-gray-600">Compare features across subscription tiers</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planId, plan]) => {
              const isCurrentPlan = planId === user.subscription_tier
              
              return (
                <Card 
                  key={planId}
                  className={`relative ${plan.popular ? 'ring-2 ring-purple-500' : ''} ${
                    isCurrentPlan ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-purple-600 text-white px-3 py-1">
                        <Star className="w-3 h-3 mr-1" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-blue-600 text-white px-3 py-1">
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <div className="text-4xl font-bold">
                      {plan.price === 0 ? 'Free' : `${plan.price}`}
                      {plan.price > 0 && <span className="text-lg font-normal text-gray-600">/month</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {plan.tokens} Creative Tokens
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-800 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Included Features
                      </h4>
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    {plan.limits.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-red-800 flex items-center gap-2">
                          <X className="w-4 h-4" />
                          Limitations
                        </h4>
                        {plan.limits.map((limit, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-500">
                            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span>{limit}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isCurrentPlan && (
                      <Button
                        onClick={() => planId === 'pro' ? setShowUpgradeDialog(true) : null}
                        disabled={loading || planId === 'free'}
                        className={`w-full ${planId === 'pro' 
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                          : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {loading ? 'Processing...' : planId === 'pro' ? 'Upgrade to Pro' : 'Current Plan'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feature Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Feature</th>
                  <th className="text-center py-3 px-2">Free</th>
                  <th className="text-center py-3 px-2">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-2">Monthly Tokens</td>
                  <td className="text-center py-3 px-2">10</td>
                  <td className="text-center py-3 px-2">100</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Stories per month</td>
                  <td className="text-center py-3 px-2">2</td>
                  <td className="text-center py-3 px-2">50</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Export formats</td>
                  <td className="text-center py-3 px-2">None</td>
                  <td className="text-center py-3 px-2">All formats</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Chapter improvements</td>
                  <td className="text-center py-3 px-2"><X className="w-4 h-4 text-red-500 mx-auto" /></td>
                  <td className="text-center py-3 px-2"><Check className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Priority support</td>
                  <td className="text-center py-3 px-2"><X className="w-4 h-4 text-red-500 mx-auto" /></td>
                  <td className="text-center py-3 px-2"><Check className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Advanced analytics</td>
                  <td className="text-center py-3 px-2"><X className="w-4 h-4 text-red-500 mx-auto" /></td>
                  <td className="text-center py-3 px-2"><Check className="w-4 h-4 text-green-600 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">How do Creative Tokens work?</h4>
              <p className="text-sm text-gray-600">
                Creative Tokens are used to generate and improve story content. Each operation has a token cost: 
                Story Foundation (8 tokens), Chapter Generation (5 tokens), Chapter Improvement (3 tokens).
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Can I change my plan anytime?</h4>
              <p className="text-sm text-gray-600">
                Yes, you can upgrade to Pro at any time. If you need to downgrade, you can cancel your subscription 
                and you'll retain Pro features until the end of your billing period.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Do unused tokens roll over?</h4>
              <p className="text-sm text-gray-600">
                Yes, unused tokens roll over to the next month up to your plan's maximum balance. 
                Free: 50 max, Pro: 200 max.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Is there a refund policy?</h4>
              <p className="text-sm text-gray-600">
                Yes, we offer a 30-day money-back guarantee. If you're not satisfied with Pro, 
                contact support for a full refund within 30 days of your first payment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription>
              Unlock unlimited story creation and premium features.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">$14.99</div>
              <div className="text-gray-600">per month</div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">100 Creative Tokens per month</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">50 stories per month</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">All export formats (PDF, EPUB, DOCX)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Chapter improvement features</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm">Priority support & advanced analytics</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Gift className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-800">30-Day Money Back Guarantee</div>
                  <div className="text-sm text-blue-700">
                    Not satisfied? Get a full refund within 30 days, no questions asked.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowUpgradeDialog(false)}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button
                onClick={createCheckoutSession}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {loading ? 'Processing...' : 'Upgrade Now'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}