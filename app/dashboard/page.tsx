'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Original dashboard components (comprehensive features)
import UnifiedStoryCreator from '@/components/UnifiedStoryCreator'
import UnifiedAnalyticsDashboard from '@/components/UnifiedAnalyticsDashboard'
import SubscriptionManager from '@/components/SubscriptionManager'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'

// New dashboard components (modern, modular approach)
import StoryLibrary from '@/components/dashboard/StoryLibrary'
import CreatorHub from '@/components/dashboard/CreatorHub'
import StripeConnectOnboarding from '@/components/StripeConnectOnboarding'

// Shared components
import ErrorBoundary from '@/components/ErrorBoundary'
import CreatorEarningsErrorBoundary from '@/components/CreatorEarningsErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

// Icons (optimized imports)
import {
  Home,
  BookOpen,
  BarChart,
  Settings,
  Crown,
  Coins,
  User,
  Menu,
  X,
  Zap,
  TrendingUp,
  DollarSign,
  Wand2,
  Brain,
  FileText,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'

// Unified user profile interface (combining best of both)
interface UnifiedUserProfile {
  id: string;
  email: string;
  full_name?: string;
  subscription_tier: 'free' | 'basic' | 'premium' | 'pro';
  subscription_status?: string;

  // Token system (from original dashboard)
  tokens_remaining: number;
  tokens_used_total: number;
  tokens_saved_cache?: number;

  // Credits system (from new dashboard)
  credits_balance?: number;

  // Analytics data
  stories_created: number;
  words_generated?: number;

  // Creator features
  is_creator?: boolean;

  // Subscription data
  current_period_end?: string;
  onboarding_complete?: boolean;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  showForCreators?: boolean;
  requiresPremium?: boolean;
}

// Dashboard overview component
function DashboardOverview({ userProfile }: { userProfile: UnifiedUserProfile }) {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back{userProfile.full_name ? `, ${userProfile.full_name}` : ''}!
        </h1>
        <p className="opacity-90">
          Ready to create amazing stories with AI assistance?
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userProfile.credits_balance !== undefined ? 'Credits' : 'Tokens'} Remaining
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userProfile.credits_balance !== undefined
                ? userProfile.credits_balance
                : userProfile.tokens_remaining}
            </div>
            {userProfile.tokens_used_total && (
              <p className="text-xs text-muted-foreground">
                {userProfile.tokens_used_total} used total
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stories Created</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userProfile.stories_created}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {userProfile.subscription_tier}
            </div>
            <Badge variant={userProfile.subscription_tier === 'premium' ? 'default' : 'secondary'}>
              {userProfile.subscription_tier === 'premium' ? 'Active' : 'Upgrade Available'}
            </Badge>
          </CardContent>
        </Card>

        {userProfile.is_creator && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Creator Status</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground">
                Earning from your stories
              </p>
            </CardContent>
          </Card>
        )}

        {userProfile.tokens_saved_cache && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache Savings</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userProfile.tokens_saved_cache}</div>
              <p className="text-xs text-muted-foreground">
                Tokens saved via caching
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="h-auto p-4 flex flex-col gap-2" variant="outline">
            <Wand2 className="h-6 w-6" />
            <span>Create New Story</span>
            <span className="text-xs text-muted-foreground">
              Start with AI assistance
            </span>
          </Button>
          <Button className="h-auto p-4 flex flex-col gap-2" variant="outline">
            <BookOpen className="h-6 w-6" />
            <span>Browse Library</span>
            <span className="text-xs text-muted-foreground">
              View your stories
            </span>
          </Button>
          <Button className="h-auto p-4 flex flex-col gap-2" variant="outline">
            <BarChart className="h-6 w-6" />
            <span>View Analytics</span>
            <span className="text-xs text-muted-foreground">
              Track your progress
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UnifiedDashboard() {
  const [user, setUser] = useState<UnifiedUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  // Unified navigation structure (from new dashboard with additions from original)
  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: 'Dashboard',
      icon: Home,
      description: 'Overview and quick actions'
    },
    {
      id: 'library',
      label: 'Story Library',
      icon: BookOpen,
      description: 'Browse and manage your stories'
    },
    {
      id: 'create',
      label: 'Create Stories',
      icon: Wand2,
      description: 'Advanced story creation tools'
    },
    {
      id: 'ai-builder',
      label: 'AI Story Builder',
      icon: Brain,
      description: 'AI-powered story generation'
    },
    {
      id: 'novel-creation',
      label: 'Novel Creation',
      icon: FileText,
      description: 'Long-form novel writing'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart,
      description: 'Usage and performance metrics'
    },
    {
      id: 'cache-analytics',
      label: 'Cache Analytics',
      icon: Zap,
      description: 'AI caching performance'
    },
    {
      id: 'creator-hub',
      label: 'Creator Hub',
      icon: DollarSign,
      description: 'Creator earnings and tools',
      showForCreators: true
    },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: Crown,
      description: 'Manage your subscription'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Account and preferences'
    }
  ]

  // Resilient data loading (from original dashboard)
  const loadDashboardData = async () => {
    try {
      setError(null)

      // Try API first (more reliable)
      const response = await fetch('/api/dashboard')
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setUser(data.profile)
          setLoading(false)
          return
        }
      }

      // Fallback to direct Supabase (from original dashboard pattern)
      await fetchUserDataDirect()
    } catch (error) {
      console.error('Error loading dashboard data:', error)

      if (retryCount < 3) {
        setRetryCount(prev => prev + 1)
        setTimeout(() => loadDashboardData(), 2000 * (retryCount + 1))
      } else {
        setError('Failed to load dashboard data. Please refresh the page.')
        setLoading(false)
      }
    }
  }

  const fetchUserDataDirect = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      router.push('/auth/signin')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id, email, full_name, subscription_tier, subscription_status,
        tokens_remaining, tokens_used_total, tokens_saved_cache,
        credits_balance, stories_created, words_generated,
        is_creator, current_period_end, onboarding_complete
      `)
      .eq('id', authUser.id)
      .single()

    if (profile) {
      setUser({
        ...profile,
        tokens_remaining: profile.tokens_remaining || 0,
        tokens_used_total: profile.tokens_used_total || 0,
        stories_created: profile.stories_created || 0
      })
    }

    setLoading(false)
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const getActiveTabContent = () => {
    if (!user) return null

    switch (activeTab) {
      case 'home':
        return <DashboardOverview userProfile={user} />
      case 'library':
        return (
          <ErrorBoundary>
            <StoryLibrary userProfile={user} />
          </ErrorBoundary>
        )
      case 'create':
        return (
          <ErrorBoundary>
            <UnifiedStoryCreator userProfile={user} defaultMode="story" />
          </ErrorBoundary>
        )
      case 'ai-builder':
        return (
          <ErrorBoundary>
            <UnifiedStoryCreator userProfile={user} defaultMode="ai-builder" />
          </ErrorBoundary>
        )
      case 'novel-creation':
        return (
          <ErrorBoundary>
            <UnifiedStoryCreator userProfile={user} defaultMode="novel" />
          </ErrorBoundary>
        )
      case 'analytics':
      case 'cache-analytics':
        return (
          <ErrorBoundary>
            <UnifiedAnalyticsDashboard userProfile={user} />
          </ErrorBoundary>
        )
      case 'creator-hub':
        return (
          <CreatorEarningsErrorBoundary>
            {user.is_creator ? (
              <CreatorEarningsHub />
            ) : (
              <div className="space-y-6">
                <CreatorHub userProfile={user} />
                <StripeConnectOnboarding />
              </div>
            )}
          </CreatorEarningsErrorBoundary>
        )
      case 'subscription':
        return (
          <ErrorBoundary>
            <SubscriptionManager />
          </ErrorBoundary>
        )
      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Settings panel coming soon...</p>
            </CardContent>
          </Card>
        )
      default:
        return <DashboardOverview userProfile={user} />
    }
  }

  // Filter sidebar items based on user permissions
  const visibleSidebarItems = sidebarItems.filter(item => {
    if (item.showForCreators && !user?.is_creator) return false
    if (item.requiresPremium && user?.subscription_tier === 'free') return false
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-600">Loading your dashboard...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500">Retry attempt {retryCount}/3</p>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{error}</p>
            <Button
              onClick={() => {
                setRetryCount(0)
                setLoading(true)
                loadDashboardData()
              }}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900">Infinite Pages</h2>
            {user && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
                <Badge variant="outline" className="mt-1">
                  {user.subscription_tier}
                </Badge>
              </div>
            )}
          </div>

          <nav className="px-3 space-y-1">
            {visibleSidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`
                  w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${activeTab === item.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center">
                  <item.icon className="h-5 w-5 mr-3" />
                  <div>
                    <div>{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-0">
          <main className="p-6">
            {getActiveTabContent()}
          </main>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}