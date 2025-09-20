'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Wand2,
  Brain,
  Zap,
  DollarSign,
  Settings,
  Menu,
  X,
  User
} from 'lucide-react'
import StoryLibrary from '@/components/dashboard/StoryLibrary'
import AIStoryBuilder from '@/components/dashboard/AIStoryBuilder'
import NovelCreation from '@/components/dashboard/NovelCreation'
import CreatorHub from '@/components/dashboard/CreatorHub'
import StripeConnectOnboarding from '@/components/StripeConnectOnboarding'
import ErrorBoundary from '@/components/ErrorBoundary'

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'basic' | 'premium'
  credits_balance: number
  is_creator?: boolean
}

interface SidebarItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

export default function NewDashboard() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('library')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const sidebarItems: SidebarItem[] = [
    {
      id: 'library',
      label: 'Story Library',
      icon: BookOpen,
      description: 'Explore 10,000+ AI-generated stories'
    },
    {
      id: 'ai-builder',
      label: 'AI Story Builder',
      icon: Wand2,
      description: 'Create stories with advanced AI assistance'
    },
    {
      id: 'novel-creation',
      label: 'Novel Creation',
      icon: Brain,
      description: 'Professional chapter generation system'
    },
    {
      id: 'creator-hub',
      label: 'Creator Hub',
      icon: DollarSign,
      description: 'Monetize your stories and manage earnings'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Account preferences and configuration'
    }
  ]

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/auth/signin')
        return
      }

      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        return
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        subscription_tier: profile?.subscription_tier || 'free',
        credits_balance: profile?.credits_balance || 0,
        is_creator: profile?.is_creator || false
      })
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading your infinite pages...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const getActiveTabContent = () => {
    switch (activeTab) {
      case 'library':
        return <StoryLibrary userProfile={user} />
      case 'ai-builder':
        return <AIStoryBuilder userProfile={user} />
      case 'novel-creation':
        return <NovelCreation userProfile={user} />
      case 'creator-hub':
        return <CreatorHub userProfile={user} />
      case 'creator-payouts':
        return <StripeConnectOnboarding />
      case 'settings':
        return <UserSettings userProfile={user} onUpdate={loadUser} />
      default:
        return <StoryLibrary userProfile={user} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              📚 INFINITE-PAGES
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">{user.credits_balance} credits</span>
            </div>
            <Badge variant={user.subscription_tier === 'premium' ? 'default' : 'secondary'}>
              {user.subscription_tier}
            </Badge>
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
              <span className="font-semibold">Navigation</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id)
                      setSidebarOpen(false)
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                    </div>
                  </button>
                )
              })}

              {/* Creator Payouts - Special Section */}
              {user.is_creator && (
                <button
                  onClick={() => {
                    setActiveTab('creator-payouts')
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeTab === 'creator-payouts'
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Creator Payouts</div>
                    <div className="text-xs text-gray-500 mt-1">Set up earnings & bank account</div>
                  </div>
                </button>
              )}
            </nav>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <div className="p-6">
            <ErrorBoundary level="section" showDetails={true}>
              {getActiveTabContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

// User Settings Component
function UserSettings({ userProfile, onUpdate }: { userProfile: UserProfile; onUpdate: () => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userProfile.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subscription</label>
                  <div className="flex items-center space-x-2">
                    <Badge variant={userProfile.subscription_tier === 'premium' ? 'default' : 'secondary'}>
                      {userProfile.subscription_tier}
                    </Badge>
                    {userProfile.subscription_tier !== 'premium' && (
                      <Button size="sm" variant="outline">
                        Upgrade
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Creator Settings</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="creator-mode"
                  checked={userProfile.is_creator}
                  disabled
                  className="rounded"
                />
                <label htmlFor="creator-mode" className="text-sm">
                  Creator Mode {userProfile.is_creator ? 'Enabled' : 'Disabled'}
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}