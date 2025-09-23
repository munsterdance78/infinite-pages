'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Database,
  Shield,
  XCircle,
  Play,
  FileText,
  Settings
} from 'lucide-react'

// FULL INTEGRATION TEST - POST RLS FIX
// This tests the complete authentication flow with real data

export default function FullIntegrationTest() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  const [isTestingAuth, setIsTestingAuth] = useState(false)
  const [isTestingProfile, setIsTestingProfile] = useState(false)
  const [isTestingDashboard, setIsTestingDashboard] = useState(false)
  const [integrationStatus, setIntegrationStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')

  const supabase = createClient()

  useEffect(() => {
    runFullIntegrationTest()
  }, [])

  const runFullIntegrationTest = async () => {
    setIntegrationStatus('testing')
    setTestResults([])

    // Step 1: Authentication Check
    await testAuthentication()

    // Step 2: Profile Access (with RLS fix)
    await testProfileAccess()

    // Step 3: Dashboard API Integration
    await testDashboardAPI()

    // Step 4: Story Creation API Test
    await testStoryCreationAPI()
  }

  const testAuthentication = async () => {
    setIsTestingAuth(true)

    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      const testResult = {
        test: 'Authentication System',
        step: 1,
        timestamp: new Date().toISOString(),
        success: !error && user !== null,
        error: error?.message || null,
        data: user ? { id: user.id, email: user.email } : null
      }

      setTestResults(prev => [...prev, testResult])

      if (user) {
        setAuthUser(user)
      }

      return !!user
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Authentication System',
        step: 1,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
      return false
    } finally {
      setIsTestingAuth(false)
    }
  }

  const testProfileAccess = async () => {
    if (!authUser) return false

    setIsTestingProfile(true)

    try {
      // First try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (existingProfile) {
        // Profile exists
        setUserProfile(existingProfile)
        setTestResults(prev => [...prev, {
          test: 'Profile Database Access',
          step: 2,
          timestamp: new Date().toISOString(),
          success: true,
          error: null,
          data: { message: 'Profile retrieved successfully', profile: existingProfile }
        }])
        return true
      }

      // Profile doesn't exist, test creation (this validates RLS fix)
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
          onboarding_complete: false
        })
        .select()
        .single()

      const testResult = {
        test: 'Profile Database Access',
        step: 2,
        timestamp: new Date().toISOString(),
        success: !createError && newProfile !== null,
        error: createError?.message || null,
        errorCode: createError?.code || null,
        data: newProfile || null
      }

      setTestResults(prev => [...prev, testResult])

      if (newProfile) {
        setUserProfile(newProfile)
        return true
      }

      return false
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Profile Database Access',
        step: 2,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
      return false
    } finally {
      setIsTestingProfile(false)
    }
  }

  const testDashboardAPI = async () => {
    if (!authUser || !userProfile) return false

    setIsTestingDashboard(true)

    try {
      const response = await fetch('/api/dashboard')
      const data = await response.json()

      const testResult = {
        test: 'Dashboard API Integration',
        step: 3,
        timestamp: new Date().toISOString(),
        success: response.ok && data.profile,
        error: response.ok ? null : data.error,
        data: response.ok ? { hasProfile: !!data.profile, tokensRemaining: data.profile?.tokens_remaining } : null
      }

      setTestResults(prev => [...prev, testResult])

      if (response.ok) {
        setDashboardData(data)
        return true
      }

      return false
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Dashboard API Integration',
        step: 3,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
      return false
    } finally {
      setIsTestingDashboard(false)
    }
  }

  const testStoryCreationAPI = async () => {
    if (!authUser || !userProfile) return false

    try {
      // Test story creation endpoint accessibility
      const response = await fetch('/api/stories', {
        method: 'GET'
      })

      const testResult = {
        test: 'Story Creation API Access',
        step: 4,
        timestamp: new Date().toISOString(),
        success: response.status !== 401, // Should not be unauthorized
        error: response.status === 401 ? 'Unauthorized - authentication not working' : null,
        data: { statusCode: response.status, accessible: response.status !== 401 }
      }

      setTestResults(prev => [...prev, testResult])

      // Determine overall integration status
      const allTestsPassed = testResults.every(result => result.success) && testResult.success
      setIntegrationStatus(allTestsPassed ? 'success' : 'failed')

      return response.status !== 401
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Story Creation API Access',
        step: 4,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
      setIntegrationStatus('failed')
      return false
    }
  }

  const retryIntegration = () => {
    setTestResults([])
    setAuthUser(null)
    setUserProfile(null)
    setDashboardData(null)
    setIntegrationStatus('idle')
    runFullIntegrationTest()
  }

  const renderTestResults = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Full Integration Test Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.test}</span>
                  <Badge variant="outline" className="text-xs">Step {result.step}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {result.timestamp}
                </div>
                {result.success ? (
                  <div className="text-sm text-green-600">
                    ✓ Success: {result.data ? JSON.stringify(result.data, null, 2) : 'Passed'}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">
                    ✗ Error: {result.error}
                    {result.errorCode && <div>Code: {result.errorCode}</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Integration Status Banner */}
      <div className={`text-white text-center py-2 text-sm font-medium ${
        integrationStatus === 'testing' ? 'bg-blue-600' :
        integrationStatus === 'success' ? 'bg-green-600' :
        integrationStatus === 'failed' ? 'bg-red-600' : 'bg-gray-600'
      }`}>
        🔄 FULL INTEGRATION TEST - RLS Fix Validation - {
          integrationStatus === 'testing' ? 'Testing in Progress...' :
          integrationStatus === 'success' ? 'ALL SYSTEMS OPERATIONAL ✅' :
          integrationStatus === 'failed' ? 'Integration Issues Found ❌' :
          'Ready to Test'
        }
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Full Integration Test</h1>
          <p className="text-muted-foreground">
            Testing complete authentication flow after RLS policy fix implementation
          </p>
        </div>

        {/* Integration Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Test Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                {isTestingAuth ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                ) : authUser ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">1. Authentication</span>
              </div>

              <div className="flex items-center gap-2">
                {isTestingProfile ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                ) : userProfile ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                )}
                <span className="text-sm">2. Profile Access</span>
              </div>

              <div className="flex items-center gap-2">
                {isTestingDashboard ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                ) : dashboardData ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                )}
                <span className="text-sm">3. Dashboard API</span>
              </div>

              <div className="flex items-center gap-2">
                {integrationStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : integrationStatus === 'failed' ? (
                  <XCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                )}
                <span className="text-sm">4. API Access</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Authentication Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {authUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">User Authenticated</span>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-sm text-green-700">
                    <div>ID: {authUser.id}</div>
                    <div>Email: {authUser.email}</div>
                    <div>Auth Provider: {authUser.app_metadata?.provider}</div>
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No authenticated user found. Please sign in to test the integration.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Profile Status */}
        {authUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Profile Database Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userProfile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Profile Access Working</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-sm text-green-700">
                      <div>Email: {userProfile.email}</div>
                      <div>Full Name: {userProfile.full_name}</div>
                      <div>Subscription: {userProfile.subscription_tier}</div>
                      <div>Tokens: {userProfile.tokens_remaining}</div>
                      <div>Onboarding: {userProfile.onboarding_complete ? 'Complete' : 'Pending'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {isTestingProfile ? 'Testing profile access...' : 'Profile test pending authentication'}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dashboard API Status */}
        {userProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Dashboard API Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Dashboard API Working</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-sm text-green-700">
                      Dashboard successfully loaded user profile and data.
                      All authentication-dependent API endpoints are now functional.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {isTestingDashboard ? 'Testing dashboard API...' : 'Dashboard test pending profile access'}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        {testResults.length > 0 && renderTestResults()}

        {/* RLS Fix Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              RLS Policy Fix Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {integrationStatus === 'success' ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ <strong>RLS Fix Successful!</strong> All authentication and database integration is working correctly.
                  The INSERT policy for profiles table has been properly applied.
                </AlertDescription>
              </Alert>
            ) : integrationStatus === 'failed' ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ❌ <strong>Integration Issues Found.</strong> Some components are still not working correctly.
                  Review test results above for specific failure points.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="text-muted-foreground">
                Integration testing in progress...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex gap-4">
          <Button onClick={retryIntegration} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Full Integration Test
          </Button>

          {integrationStatus === 'success' && (
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Proceed to Phase 4
            </Button>
          )}
        </div>

        {/* Phase 4 Readiness */}
        <Card>
          <CardHeader>
            <CardTitle>Phase 4 Readiness Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            {integrationStatus === 'success' ? (
              <div className="space-y-2 text-sm">
                <div>✅ Authentication system fully operational</div>
                <div>✅ Profile database access working with RLS policies</div>
                <div>✅ Dashboard API integration functional</div>
                <div>✅ All authentication-dependent endpoints accessible</div>
                <div className="font-medium text-green-600 mt-4">
                  🚀 READY FOR PHASE 4: Full system integration testing can proceed
                </div>
              </div>
            ) : integrationStatus === 'failed' ? (
              <div className="space-y-2 text-sm">
                <div>❌ Integration issues need resolution before Phase 4</div>
                <div>🔧 Review test results and fix identified issues</div>
                <div>🔄 Re-run integration test after fixes</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Complete integration testing to assess Phase 4 readiness...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}