'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StoryCreator from '@/components/StoryCreator'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import CacheAnalyticsDashboard from '@/components/CacheAnalyticsDashboard'
import SubscriptionManager from '@/components/SubscriptionManager'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Home,
  BookOpen,
  BarChart,
  Settings,
  Crown,
  Coins,
  User,
  Bell,
  Menu,
  X,
  Zap,
  TrendingUp,
  Calendar,
  Award,
  ArrowLeft,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  subscription_tier: 'free' | 'pro';
  subscription_status: string;
  tokens_remaining: number;
  tokens_used_total: number;
  tokens_saved_cache: number;
  stories_created: number;
  words_generated: number;
  current_period_end?: string;
  onboarding_complete?: boolean;
}

interface TokenBalance {
  current: number;
  maxBalance: number;
  tier: string;
  usageThisMonth: number;
  projectedUsage: number;
  efficiency: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    loadDashboardData()
  }, [retryCount])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to use the new dashboard API first
      const response = await fetch('/api/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.profile)
        setTokenBalance(data.tokenBalance)
        setRecentActivity(data.recentActivity)
        setLoading(false)
        return
      }

      // Fallback to direct Supabase calls
      console.log('API failed, falling back to direct Supabase calls')
      await fetchUserDataDirect()
    } catch (error) {
      console.error('Dashboard load error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDataDirect = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setError('Please log in to access the dashboard')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        await handleOnboardingComplete()
        return
      }
      throw new Error(`Profile fetch failed: ${profileError.message}`)
    }

    setUser(profile)

    // Fetch additional data
    await Promise.allSettled([
      fetchTokenBalanceDirect(authUser, profile),
      fetchRecentActivityDirect(authUser)
    ])
  }

  const fetchTokenBalanceDirect = async (authUser: any, profile: UserProfile) => {
    try {
      const maxBalance = profile.subscription_tier === 'pro' ? 100 : 10
      const monthStart = new Date()
      monthStart.setDate(1)

      const { data: monthlyUsage } = await supabase
        .from('generation_logs')
        .select('tokens_input, tokens_output')
        .eq('user_id', authUser.id)
        .gte('created_at', monthStart.toISOString())

      const usageThisMonth = monthlyUsage?.reduce((sum, log) =>
        sum + (log.tokens_input || 0) + (log.tokens_output || 0), 0) || 0

      const projectedUsage = usageThisMonth * (30 / new Date().getDate())
      const efficiency = profile.words_generated > 0 ? profile.words_generated / profile.tokens_used_total : 0

      setTokenBalance({
        current: profile.tokens_remaining || 0,
        maxBalance,
        tier: profile.subscription_tier || 'free',
        usageThisMonth,
        projectedUsage: Math.round(projectedUsage),
        efficiency
      })
    } catch (error) {
      console.error('Failed to fetch token balance:', error)
    }
  }

  const fetchRecentActivityDirect = async (authUser: any) => {
    try {
      const { data: stories } = await supabase
        .from('stories')
        .select(`
          id, title, updated_at, word_count,
          chapters (id, chapter_number, created_at)
        `)
        .eq('user_id', authUser.id)
        .order('updated_at', { ascending: false })
        .limit(5)

      setRecentActivity(stories || [])
    } catch (error) {
      console.error('Failed to fetch recent activity:', error)
    }
  }

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }


  const handleOnboardingComplete = async () => {
    try {
      console.log('handleOnboardingComplete called')
      const { data: { user: authUser } } = await supabase.auth.getUser()
      console.log('Auth user:', authUser)

      if (!authUser) {
        console.log('No auth user found')
        return
      }

      // First, check if profile exists
      console.log('Checking if profile exists for user:', authUser.id)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      console.log('Existing profile check:', { existingProfile, fetchError })

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Profile does not exist, creating new profile')
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
            onboarding_complete: true
          })
          .select()
          .single()

        console.log('Profile creation result:', { newProfile, createError })

        if (createError) {
          console.error('Failed to create profile:', createError)
          return
        }

        setUser(newProfile)
        return
      } else if (fetchError) {
        console.error('Unexpected fetch error:', fetchError)
        return
      }

      // Profile exists, update onboarding_complete
      console.log('Profile exists, updating onboarding_complete')
      const { data, error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', authUser.id)
        .select()
        .single()

      console.log('Update result:', { data, error })

      if (error) {
        console.error('Update error:', error)
        return
      }

      setUser(data)
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
    }
  }

  const handleSubscriptionChange = async () => {
    await fetchUserDataDirect()
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <X className="w-5 h-5" />
              Dashboard Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2">
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button
                onClick={() => window.location.href = '/auth/signin'}
                variant="outline"
                size="sm"
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <span className="text-gray-600 text-lg">Loading your dashboard...</span>
          <p className="text-gray-500 text-sm mt-2">This should only take a moment</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Please sign in to access your dashboard.</p>
            <Button onClick={() => window.location.href = '/auth/signin'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Temporarily bypass onboarding for testing
  if (!user?.onboarding_complete && false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Infinite Pages!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Complete your profile setup to get started.</p>
            <Button
              onClick={() => {
                console.log('Button clicked, calling handleOnboardingComplete')
                handleOnboardingComplete()
              }}
              className="w-full"
            >
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sidebarItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'stories', label: 'Stories', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
    { id: 'cache-analytics', label: 'Cache Analytics', icon: Zap },
    { id: 'subscription', label: 'Subscription', icon: Crown },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const getTokenStatus = () => {
    if (!tokenBalance) return { color: 'bg-gray-500', label: 'Loading...' }
    
    const percentage = (tokenBalance.current / tokenBalance.maxBalance) * 100
    if (percentage > 50) return { color: 'bg-green-500', label: 'Healthy' }
    if (percentage > 20) return { color: 'bg-yellow-500', label: 'Moderate' }
    return { color: 'bg-red-500', label: 'Low' }
  }

  const tokenStatus = getTokenStatus()

  return (
    <ErrorBoundary level="page" showDetails={process.env.NODE_ENV === 'development'}>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Infinite-Pages
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Token Balance Card */}
        {tokenBalance && (
          <div className="p-4 border-b bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Creative Tokens</span>
                <Badge variant="outline" className="text-xs">
                  {tokenBalance.tier.toUpperCase()}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-600" />
                  <span className="text-2xl font-bold">{tokenBalance.current}</span>
                  <span className="text-sm text-gray-500">/ {tokenBalance.maxBalance}</span>
                </div>
                
                <Progress 
                  value={(tokenBalance.current / tokenBalance.maxBalance) * 100} 
                  className="h-2"
                />
                
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1 ${tokenStatus.color} text-white px-2 py-1 rounded-full`}>
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                    {tokenStatus.label}
                  </span>
                  <span className="text-gray-600">
                    {tokenBalance.usageThisMonth} used this month
                  </span>
                </div>
              </div>

              {tokenBalance.tier === 'free' && tokenBalance.current <= 2 && (
                <Button 
                  size="sm" 
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  onClick={() => setActiveTab('subscription')}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade for More Tokens
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {sidebarItems.map(item => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id)
                      setSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                    {item.id === 'subscription' && user?.subscription_tier === 'free' && (
                      <Badge variant="secondary" className="ml-auto text-xs bg-yellow-100 text-yellow-800">
                        Free
                      </Badge>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Quick Stats */}
        <div className="p-4 mt-auto border-t">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{user?.stories_created || 0}</div>
              <div className="text-xs text-gray-600">Stories</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {Math.round((user?.words_generated || 0) / 1000)}k
              </div>
              <div className="text-xs text-gray-600">Words</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 capitalize">
                  {activeTab === 'home' ? 'Dashboard' : activeTab}
                </h2>
                <p className="text-sm text-gray-600">
                  {activeTab === 'home' && 'Welcome back to your creative workspace'}
                  {activeTab === 'stories' && 'Manage and create your AI-generated stories'}
                  {activeTab === 'analytics' && 'Track your writing progress and insights'}
                  {activeTab === 'cache-analytics' && 'Monitor cache performance and cost savings'}
                  {activeTab === 'subscription' && 'Manage your subscription and billing'}
                  {activeTab === 'settings' && 'Customize your account preferences'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                {/* Notification dot */}
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </Button>
              
              <div className="flex items-center gap-3 pl-4 border-l">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-600 capitalize">{user.subscription_tier} Plan</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Welcome Section */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      Welcome back, {user.full_name?.split(' ')[0] || 'Writer'}!
                    </h2>
                    <p className="text-blue-100">
                      Ready to continue your creative journey? You have {tokenBalance?.current} tokens remaining.
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <Zap className="w-16 h-16 text-blue-200" />
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200" 
                      onClick={() => setActiveTab('stories')}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <BookOpen className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Create New Story</h3>
                        <p className="text-sm text-gray-600">Start a fresh creative project</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          8 tokens
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-green-200"
                      onClick={() => setActiveTab('analytics')}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">View Analytics</h3>
                        <p className="text-sm text-gray-600">Track your writing progress</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {user.words_generated.toLocaleString()} words total
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-200"
                      onClick={() => setActiveTab('subscription')}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Crown className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {user.subscription_tier === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {user.subscription_tier === 'free' ? 'Unlock more features' : 'View billing details'}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs capitalize">
                          {user.subscription_tier} tier
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity & Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Stories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentActivity.length > 0 ? (
                      <div className="space-y-3">
                        {recentActivity.map(story => (
                          <div key={story.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">{story.title || 'Untitled Story'}</div>
                              <div className="text-sm text-gray-600">
                                {story.word_count.toLocaleString()} words • {story.chapters?.length || 0} chapters
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setActiveTab('stories')}>
                              Continue
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No stories yet. Create your first story to get started!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      Your Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Stories Created</span>
                        <span className="font-semibold">{user.stories_created}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Words Generated</span>
                        <span className="font-semibold">{user.words_generated.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tokens Used</span>
                        <span className="font-semibold">{user.tokens_used_total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Efficiency</span>
                        <span className="font-semibold">
                          {user.tokens_used_total > 0 
                            ? Math.round(user.words_generated / user.tokens_used_total)
                            : 0} words/token
                        </span>
                      </div>
                      
                      {tokenBalance && tokenBalance.efficiency > 400 && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">High Efficiency!</span>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            You're generating content very efficiently.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'stories' && (
            <ErrorBoundary level="section" showDetails={true}>
              <StoryCreator userProfile={user} onStoryChange={loadDashboardData} />
            </ErrorBoundary>
          )}

          {activeTab === 'analytics' && (
            <ErrorBoundary level="section" showDetails={true}>
              <AnalyticsDashboard userProfile={user} />
            </ErrorBoundary>
          )}

          {activeTab === 'cache-analytics' && (
            <ErrorBoundary level="section" showDetails={true}>
              <CacheAnalyticsDashboard userProfile={user} />
            </ErrorBoundary>
          )}

          {activeTab === 'subscription' && (
            <ErrorBoundary level="section" showDetails={true}>
              <SubscriptionManager
                user={user}
                onSubscriptionChange={handleSubscriptionChange}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Account settings and preferences will be available soon.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}