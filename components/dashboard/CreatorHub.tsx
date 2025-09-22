'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'
import {
  DollarSign,
  TrendingUp,
  Eye,
  Heart,
  Download,
  BookOpen,
  Users,
  Calendar,
  Award,
  BarChart3,
  Settings,
  CreditCard,
  Star,
  Activity
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'basic' | 'premium'
  credits_balance: number
  is_creator?: boolean
}

interface CreatorHubProps {
  userProfile: UserProfile
}

interface CreatorStats {
  total_earnings: number
  monthly_earnings: number
  total_stories: number
  total_views: number
  total_likes: number
  total_downloads: number
  avg_rating: number
  follower_count: number
}

interface Story {
  id: string
  title: string
  genre: string
  views: number
  likes: number
  downloads: number
  earnings: number
  created_at: string
  status: string
}


export default function CreatorHub({ userProfile }: CreatorHubProps) {
  const [creatorStats, setCreatorStats] = useState<CreatorStats>({
    total_earnings: 0,
    monthly_earnings: 0,
    total_stories: 0,
    total_views: 0,
    total_likes: 0,
    total_downloads: 0,
    avg_rating: 0,
    follower_count: 0
  })

  const [topStories, setTopStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const supabase = createClient()

  useEffect(() => {
    if (userProfile.is_creator) {
      loadCreatorData()
    } else {
      setLoading(false)
    }
  }, [userProfile])

  const loadCreatorData = async () => {
    try {
      await Promise.all([
        loadCreatorStats(),
        loadTopStories()
      ])
    } catch (error) {
      console.error('Error loading creator data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCreatorStats = async () => {
    try {
      const { data: stories } = await supabase
        .from('stories')
        .select('views, likes, downloads, earnings, rating')
        .eq('creator_id', userProfile.id)
        .eq('status', 'published')

      const { data: profile } = await supabase
        .from('creator_profiles')
        .select('total_earnings, monthly_earnings, follower_count')
        .eq('user_id', userProfile.id)
        .single()

      if (stories) {
        const stats = stories.reduce((acc, story) => ({
          total_views: acc.total_views + (story.views || 0),
          total_likes: acc.total_likes + (story.likes || 0),
          total_downloads: acc.total_downloads + (story.downloads || 0),
          total_ratings: acc.total_ratings + (story.rating ? 1 : 0),
          rating_sum: acc.rating_sum + (story.rating || 0)
        }), { total_views: 0, total_likes: 0, total_downloads: 0, total_ratings: 0, rating_sum: 0 })

        setCreatorStats({
          total_earnings: profile?.total_earnings || 0,
          monthly_earnings: profile?.monthly_earnings || 0,
          total_stories: stories.length,
          total_views: stats.total_views,
          total_likes: stats.total_likes,
          total_downloads: stats.total_downloads,
          avg_rating: stats.total_ratings > 0 ? stats.rating_sum / stats.total_ratings : 0,
          follower_count: profile?.follower_count || 0
        })
      }
    } catch (error) {
      console.error('Error loading creator stats:', error)
    }
  }

  const loadTopStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id, title, genre, views, likes, downloads, earnings, created_at, status')
        .eq('creator_id', userProfile.id)
        .eq('status', 'published')
        .order('views', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error loading top stories:', error)
        return
      }

      setTopStories(data || [])
    } catch (error) {
      console.error('Error loading top stories:', error)
    }
  }


  const handleBecomeCreator = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_creator: true })
        .eq('id', userProfile.id)

      if (error) {
        console.error('Error becoming creator:', error)
        alert('Failed to enable creator mode')
        return
      }

      // Create creator profile
      const { error: profileError } = await supabase
        .from('creator_profiles')
        .insert({
          user_id: userProfile.id,
          total_earnings: 0,
          monthly_earnings: 0,
          follower_count: 0
        })

      if (profileError) {
        console.error('Error creating creator profile:', profileError)
      }

      window.location.reload()
    } catch (error) {
      console.error('Error becoming creator:', error)
      alert('Failed to enable creator mode')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Creator Hub...</p>
        </div>
      </div>
    )
  }

  if (!userProfile.is_creator) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-16">
            <Award className="w-20 h-20 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Become a Creator</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Join our creator program to monetize your stories and earn from your creative work.
              Share your stories with thousands of readers and build your audience.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-2xl mx-auto">
              <div className="text-center">
                <DollarSign className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Earn Money</h3>
                <p className="text-sm text-gray-600">Get paid for views, downloads, and reader engagement</p>
              </div>
              <div className="text-center">
                <Users className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Build Audience</h3>
                <p className="text-sm text-gray-600">Connect with readers and grow your following</p>
              </div>
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Track Performance</h3>
                <p className="text-sm text-gray-600">Detailed analytics and earnings insights</p>
              </div>
            </div>

            <Button size="lg" onClick={handleBecomeCreator}>
              <Award className="w-5 h-5 mr-2" />
              Enable Creator Mode
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Creator Hub</h1>
          <p className="text-gray-600 mt-1">Monetize your stories and manage earnings</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="default" className="bg-green-600">
            Creator Status: Active
          </Badge>
          <Button variant="outline">
            <CreditCard className="w-4 h-4 mr-2" />
            Payout Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'earnings', label: 'Earnings', icon: DollarSign },
            { id: 'stories', label: 'Stories', icon: BookOpen },
            { id: 'analytics', label: 'Analytics', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${creatorStats.total_earnings.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-3xl font-bold text-blue-600">
                      ${creatorStats.monthly_earnings.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Views</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {creatorStats.total_views.toLocaleString()}
                    </p>
                  </div>
                  <Eye className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Followers</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {creatorStats.follower_count.toLocaleString()}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Published Stories</span>
                    <span className="font-semibold">{creatorStats.total_stories}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Likes</span>
                    <span className="font-semibold">{creatorStats.total_likes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Downloads</span>
                    <span className="font-semibold">{creatorStats.total_downloads.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Rating</span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{creatorStats.avg_rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Earnings Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">View Detailed Earnings</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Access comprehensive earnings data, analytics, and payout management
                  </p>
                  <Button
                    onClick={() => setActiveTab('earnings')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    View Earnings Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'stories' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Stories</CardTitle>
            </CardHeader>
            <CardContent>
              {topStories.length > 0 ? (
                <div className="space-y-4">
                  {topStories.map((story) => (
                    <div key={story.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{story.title}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center space-x-1">
                            <Eye className="w-3 h-3" />
                            <span>{story.views}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Heart className="w-3 h-3" />
                            <span>{story.likes}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Download className="w-3 h-3" />
                            <span>{story.downloads}</span>
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {story.genre}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          ${story.earnings?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(story.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No published stories yet</p>
                  <p className="text-sm">Start creating stories to see them here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'earnings' && (
        <CreatorEarningsHub
          mode="enhanced"
          onPayoutRequest={(amount) => {
            console.log('Payout requested:', amount)
            // Handle payout request logic here
          }}
          onUpgradeRequired={() => {
            console.log('Upgrade required')
            // Handle upgrade logic here
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 mb-4">
                  Detailed analytics and insights coming soon
                </p>
                <Badge variant="secondary">Feature in Development</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}