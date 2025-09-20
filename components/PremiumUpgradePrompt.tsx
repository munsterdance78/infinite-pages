'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-config'
import { Crown, Star, Sparkles, DollarSign, Book, Palette } from 'lucide-react'

interface PremiumUpgradePromptProps {
  feature: 'story_creation' | 'creator_earnings' | 'advanced_features'
  currentTier: 'basic' | 'premium'
  onUpgrade?: () => void
}

export default function PremiumUpgradePrompt({
  feature,
  currentTier,
  onUpgrade
}: PremiumUpgradePromptProps) {
  const premiumTier = SUBSCRIPTION_TIERS.premium

  const getFeatureMessage = () => {
    switch (feature) {
      case 'story_creation':
        return {
          title: 'Story Creation Requires Premium',
          description: 'Create unlimited stories and earn money from your creative work',
          icon: <Book className="w-8 h-8 text-blue-600" />,
          benefits: [
            'Create unlimited stories',
            'Earn 70% of reader payments',
            'Advanced AI story generation',
            'Premium cover styles',
            'Story analytics dashboard',
            'Download and export features'
          ]
        }
      case 'creator_earnings':
        return {
          title: 'Creator Earnings Dashboard',
          description: 'Track your earnings and manage payouts with Premium access',
          icon: <DollarSign className="w-8 h-8 text-green-600" />,
          benefits: [
            'Real-time earnings tracking',
            'Monthly payout system',
            'Story performance analytics',
            'Reader engagement metrics',
            'Payout history and reports',
            'Tax documentation support'
          ]
        }
      case 'advanced_features':
        return {
          title: 'Premium Features Available',
          description: 'Unlock the full potential of the platform',
          icon: <Sparkles className="w-8 h-8 text-purple-600" />,
          benefits: [
            'Unlimited story creation',
            'Creator earnings system',
            'Advanced AI operations',
            'Premium cover generation',
            'Priority support',
            'Early access to new features'
          ]
        }
    }
  }

  const featureInfo = getFeatureMessage()

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {featureInfo.icon}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            {featureInfo.title}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {featureInfo.description}
          </p>
          <div className="flex justify-center mt-4">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Current: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Premium Tier Highlight */}
          <div className="bg-white rounded-lg p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Crown className="w-6 h-6 text-purple-600" />
                <h3 className="text-xl font-bold text-purple-800">Premium Plan</h3>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">
                  ${premiumTier.price_monthly}/month
                </div>
                <div className="text-sm text-gray-500">
                  or ${premiumTier.price_yearly}/year (save 17%)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">What you get:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {featureInfo.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center">
                      <Star className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-2">Premium includes:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li className="flex items-center">
                    <Palette className="w-4 h-4 text-purple-500 mr-2" />
                    {premiumTier.credits_per_month} credits/month
                  </li>
                  <li className="flex items-center">
                    <Book className="w-4 h-4 text-purple-500 mr-2" />
                    {premiumTier.features.stories_limit} stories
                  </li>
                  <li className="flex items-center">
                    <Sparkles className="w-4 h-4 text-purple-500 mr-2" />
                    {premiumTier.features.cover_generations} covers/month
                  </li>
                  <li className="flex items-center">
                    <DollarSign className="w-4 h-4 text-purple-500 mr-2" />
                    70% creator earnings
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              Join thousands of creators earning money from their stories
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={onUpgrade}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium px-8 py-3"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>

              <Button
                variant="outline"
                onClick={() => window.open('/pricing', '_blank')}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                View All Plans
              </Button>
            </div>

            <div className="text-xs text-gray-500">
              ✨ 7-day free trial • Cancel anytime • No hidden fees
            </div>
          </div>

          {/* Value Proposition */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">Creator Success Story</span>
            </div>
            <p className="text-green-700 text-sm">
              Premium creators earn an average of $150/month from their stories.
              Our 70/30 revenue split means you keep more of what you earn than most other platforms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}