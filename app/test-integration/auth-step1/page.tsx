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
  Shield
} from 'lucide-react'

// INTEGRATION TEST - Phase 3, Step 1
// Add ONE real dependency: Supabase Auth User Check
// Keep everything else mocked

const MOCK_USER_PROFILE = {
  id: 'will-be-replaced-with-real',
  email: 'will-be-replaced-with-real',
  full_name: 'Mock User Name',
  subscription_tier: 'basic',
  tokens_remaining: 1250,
  stories_created: 5
}

export default function AuthIntegrationStep1() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])

  const supabase = createClient()

  // STEP 1: Add ONE real dependency - Auth User Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true)
        setAuthError(null)

        // REAL API CALL #1: Get authenticated user
        const { data: { user }, error } = await supabase.auth.getUser()

        const testResult = {
          test: 'Supabase Auth User Check',
          timestamp: new Date().toISOString(),
          success: !error && user !== null,
          error: error?.message || null,
          data: user ? { id: user.id, email: user.email } : null
        }

        setTestResults(prev => [...prev, testResult])

        if (error) {
          setAuthError(error.message)
        } else {
          setAuthUser(user)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        setAuthError(errorMsg)
        setTestResults(prev => [...prev, {
          test: 'Supabase Auth User Check',
          timestamp: new Date().toISOString(),
          success: false,
          error: errorMsg,
          data: null
        }])
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [])

  const retryAuth = () => {
    setTestResults([])
    setAuthUser(null)
    setAuthError(null)
    setAuthLoading(true)

    // Re-run the auth check
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  const renderTestResults = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Integration Test Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-medium">{result.test}</div>
                <div className="text-sm text-muted-foreground">
                  {result.timestamp}
                </div>
                {result.success ? (
                  <div className="text-sm text-green-600">
                    ✓ Success: {result.data ? JSON.stringify(result.data, null, 2) : 'No data'}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">
                    ✗ Error: {result.error}
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
      {/* Test Status Banner */}
      <div className="bg-orange-600 text-white text-center py-2 text-sm font-medium">
        🔄 INTEGRATION TEST - Step 1: Auth User Check (1 Real API Call Added)
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Phase 3: Integration Step 1</h1>
          <p className="text-muted-foreground">
            Testing authentication integration with ONE real Supabase API call
          </p>
        </div>

        {/* Current Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Components work in isolation</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {authLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : authUser ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    Real Auth API Call: {authLoading ? 'Testing...' : authUser ? 'Working' : 'Failed'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                  <span className="text-sm text-gray-500">Database Profile Query (Next Step)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                  <span className="text-sm text-gray-500">Full Component Integration (Later)</span>
                </div>
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
            {authLoading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Checking authentication...</span>
              </div>
            ) : authError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Authentication Error: {authError}
                </AlertDescription>
              </Alert>
            ) : authUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">User Authenticated Successfully</span>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <h4 className="font-medium text-green-800">Auth User Data:</h4>
                  <div className="text-sm text-green-700 mt-2">
                    <div>ID: {authUser.id}</div>
                    <div>Email: {authUser.email}</div>
                    <div>Created: {authUser.created_at}</div>
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

        {/* Mock Profile Data (Still Using Mock) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Profile Data (Still Mock - Next Integration Step)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-sm text-blue-700">
                <div className="font-medium mb-2">Mock Profile Data:</div>
                <div>Email: {authUser?.email || MOCK_USER_PROFILE.email}</div>
                <div>Full Name: {MOCK_USER_PROFILE.full_name}</div>
                <div>Subscription: <Badge>{MOCK_USER_PROFILE.subscription_tier}</Badge></div>
                <div>Tokens: {MOCK_USER_PROFILE.tokens_remaining}</div>
                <div>Stories: {MOCK_USER_PROFILE.stories_created}</div>
              </div>
              <div className="text-xs text-blue-600 mt-2">
                Note: Profile data is still mocked. Database integration is the next step.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && renderTestResults()}

        {/* Controls */}
        <div className="flex gap-4">
          <Button onClick={retryAuth} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Auth Test
          </Button>

          {authUser && (
            <Button disabled className="opacity-50">
              Next: Add Database Query (Requires RLS Fix)
            </Button>
          )}
        </div>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Integration Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>1. ✅ Test Auth User API Call (Current Step)</div>
              <div>2. 🔄 Fix RLS INSERT Policy for Profiles</div>
              <div>3. ⏳ Add Profile Database Query</div>
              <div>4. ⏳ Test Profile Creation Flow</div>
              <div>5. ⏳ Connect Dashboard to Real Data</div>
              <div>6. ⏳ Full Component Integration</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}