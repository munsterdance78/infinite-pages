'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
  RefreshCw
} from 'lucide-react'

// MOCK DATA - No external dependencies
const MOCK_USER_PROFILE = {
  id: 'test-user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  subscription_tier: 'premium' as const,
  subscription_status: 'active',
  tokens_remaining: 1250,
  tokens_used_total: 82,
  tokens_saved_cache: 15,
  credits_balance: undefined,
  stories_created: 7,
  words_generated: 15420,
  is_creator: true,
  current_period_end: '2025-10-23T00:00:00Z',
  onboarding_complete: true
}

const MOCK_SIDEBAR_ITEMS = [
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
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart,
    description: 'Usage and performance metrics'
  },
  {
    id: 'creator-hub',
    label: 'Creator Hub',
    icon: DollarSign,
    description: 'Creator earnings and tools'
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

// Isolated Dashboard Overview Component
function DashboardOverview({ userProfile }: { userProfile: typeof MOCK_USER_PROFILE }) {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="glass-welcome-card p-6">
        <h1 className="text-2xl font-bold mb-2 text-white glass-text-shadow">
          Welcome back{userProfile.full_name ? `, ${userProfile.full_name}` : ''}!
        </h1>
        <p className="text-white/90 glass-text-shadow-subtle">
          Ready to create amazing stories with AI assistance?
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Remaining</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userProfile.tokens_remaining}</div>
            <p className="text-xs text-muted-foreground">
              {userProfile.tokens_used_total} used total
            </p>
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
            <Badge variant="default">Active</Badge>
          </CardContent>
        </Card>

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
      </div>

      {/* Quick Actions */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            className="glass-action-card h-auto p-4 flex flex-col gap-2"
            variant="outline"
            onClick={() => console.log('Create New Story clicked')}
          >
            <Wand2 className="h-6 w-6 glass-icon-glow" />
            <span className="text-white glass-text-shadow">Create New Story</span>
            <span className="text-xs text-white/70 glass-text-shadow-subtle">
              Start with AI assistance
            </span>
          </Button>
          <Button
            className="glass-action-card h-auto p-4 flex flex-col gap-2"
            variant="outline"
            onClick={() => console.log('Browse Library clicked')}
          >
            <BookOpen className="h-6 w-6 glass-icon-glow" />
            <span className="text-white glass-text-shadow">Browse Library</span>
            <span className="text-xs text-white/70 glass-text-shadow-subtle">
              View your stories
            </span>
          </Button>
          <Button
            className="glass-action-card h-auto p-4 flex flex-col gap-2"
            variant="outline"
            onClick={() => console.log('View Analytics clicked')}
          >
            <BarChart className="h-6 w-6 glass-icon-glow" />
            <span className="text-white glass-text-shadow">View Analytics</span>
            <span className="text-xs text-white/70 glass-text-shadow-subtle">
              Track your progress
            </span>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ISOLATED DASHBOARD COMPONENT - NO EXTERNAL DEPENDENCIES
export default function IsolatedDashboard() {
  const [activeTab, setActiveTab] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const getActiveTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <DashboardOverview userProfile={MOCK_USER_PROFILE} />
      case 'library':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Story Library</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Story library component would be loaded here...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Mock data: {MOCK_USER_PROFILE.stories_created} stories found
              </p>
            </CardContent>
          </Card>
        )
      case 'create':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Create Stories</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Story creation interface would be loaded here...</p>
              <Button onClick={() => console.log('Create story mock action')}>
                Start Creating
              </Button>
            </CardContent>
          </Card>
        )
      case 'ai-builder':
        return (
          <Card>
            <CardHeader>
              <CardTitle>AI Story Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <p>AI-powered story generation interface would be loaded here...</p>
              <Button onClick={() => console.log('AI builder mock action')}>
                Generate with AI
              </Button>
            </CardContent>
          </Card>
        )
      case 'analytics':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Analytics and metrics would be displayed here...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Mock data: {MOCK_USER_PROFILE.words_generated} words generated
              </p>
            </CardContent>
          </Card>
        )
      case 'creator-hub':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Creator Hub</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Creator earnings and tools would be displayed here...</p>
              <Badge variant="default" className="mt-2">Creator Mode Active</Badge>
            </CardContent>
          </Card>
        )
      case 'subscription':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Subscription details and billing would be shown here...</p>
              <Badge variant="default" className="mt-2">{MOCK_USER_PROFILE.subscription_tier}</Badge>
            </CardContent>
          </Card>
        )
      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p>User settings and preferences would be configured here...</p>
              <p className="text-sm text-muted-foreground mt-2">
                User: {MOCK_USER_PROFILE.email}
              </p>
            </CardContent>
          </Card>
        )
      default:
        return <DashboardOverview userProfile={MOCK_USER_PROFILE} />
    }
  }

  return (
    <div className="min-h-screen">
      {/* Test Status Banner */}
      <div className="bg-blue-600 text-white text-center py-2 text-sm font-medium">
        🧪 ISOLATION TEST - Dashboard Component (No External Dependencies)
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden glass-header p-4 glass-slide-down">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white glass-text-shadow">Dashboard</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSidebarOpen(!sidebarOpen)
              console.log('Mobile menu toggled:', !sidebarOpen)
            }}
            className="glass-nav-link"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 glass-sidebar transform transition-transform duration-200 ease-in-out glass-slide-right
          lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-white glass-text-shadow">Infinite Pages</h2>
            <div className="mt-4 glass-subtle p-3 rounded-lg">
              <p className="text-sm font-medium text-white glass-text-shadow-subtle">
                {MOCK_USER_PROFILE.email}
              </p>
              <Badge variant="outline" className="mt-1 glass-badge">
                {MOCK_USER_PROFILE.subscription_tier}
              </Badge>
            </div>
          </div>

          <nav className="px-3 space-y-1">
            {MOCK_SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                  console.log('Sidebar item clicked:', item.label)
                }}
                className={`
                  w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeTab === item.id
                    ? 'glass-nav-active text-white glass-text-shadow'
                    : 'glass-nav-link hover:glass-hover'
                  }
                `}
              >
                <div className="flex items-center">
                  <item.icon className="h-5 w-5 mr-3" />
                  <div>
                    <div>{item.label}</div>
                    <div className="text-xs text-white/60 glass-text-shadow-subtle mt-0.5">
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
          <main className="p-6 glass-main-content">
            {getActiveTabContent()}
          </main>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 glass-overlay lg:hidden"
          onClick={() => {
            setSidebarOpen(false)
            console.log('Overlay clicked - closing sidebar')
          }}
        />
      )}
    </div>
  )
}