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
  XCircle
} from 'lucide-react'

// INTEGRATION TEST - Phase 3, Step 2
// Add SECOND real dependency: Profile Database Query
// This will demonstrate the exact RLS policy failure

export default function AuthIntegrationStep2() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])

  const supabase = createClient()

  // STEP 1: Auth User Check (From Previous Step)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true)
        setAuthError(null)

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
          // If auth succeeds, try profile query
          if (user) {
            await attemptProfileQuery(user)
          }
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

  // STEP 2: Add Profile Database Query (This Will Fail)
  const attemptProfileQuery = async (user: any) => {
    try {
      setProfileLoading(true)
      setProfileError(null)

      console.log('Attempting profile query for user:', user.id)

      // REAL API CALL #2: Try to fetch user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const testResult = {
        test: 'Profile Database Query',
        timestamp: new Date().toISOString(),
        success: !error && profile !== null,
        error: error?.message || null,
        errorCode: error?.code || null,
        data: profile || null
      }

      setTestResults(prev => [...prev, testResult])

      if (error) {
        console.error('Profile query error:', error)
        setProfileError(`${error.message} (Code: ${error.code})`)

        // If profile doesn't exist, try to create it (this will also fail due to RLS)
        if (error.code === 'PGRST116') {
          await attemptProfileCreation(user)
        }
      } else {
        setUserProfile(profile)
        console.log('Profile found:', profile)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setProfileError(errorMsg)
      setTestResults(prev => [...prev, {
        test: 'Profile Database Query',
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
    } finally {
      setProfileLoading(false)
    }
  }

  // STEP 3: Attempt Profile Creation (This Will Also Fail)
  const attemptProfileCreation = async (user: any) => {
    try {
      console.log('Profile not found, attempting to create for user:', user.id)

      // REAL API CALL #3: Try to create user profile (this will fail due to missing INSERT policy)
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
          onboarding_complete: false
        })
        .select()
        .single()

      const testResult = {
        test: 'Profile Creation Attempt',
        timestamp: new Date().toISOString(),
        success: !error && newProfile !== null,
        error: error?.message || null,
        errorCode: error?.code || null,
        data: newProfile || null
      }

      setTestResults(prev => [...prev, testResult])

      if (error) {
        console.error('Profile creation error:', error)
        // This is the expected failure - missing INSERT policy
      } else {
        setUserProfile(newProfile)
        console.log('Profile created:', newProfile)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setTestResults(prev => [...prev, {
        test: 'Profile Creation Attempt',
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMsg,
        data: null
      }])
    }
  }

  const retryIntegration = () => {
    setTestResults([])
    setAuthUser(null)
    setUserProfile(null)
    setAuthError(null)
    setProfileError(null)
    setAuthLoading(true)
    setProfileLoading(false)

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
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
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
      {/* Test Status Banner */}
      <div className="bg-red-600 text-white text-center py-2 text-sm font-medium">
        🔄 INTEGRATION TEST - Step 2: Profile Database Query (Expected to Fail - Demonstrates RLS Issue)
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Phase 3: Integration Step 2</h1>
          <p className="text-muted-foreground">
            Testing profile database integration - this will demonstrate the exact RLS policy failure
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
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">
                    Auth API Call: {authLoading ? 'Testing...' : authUser ? 'Working' : 'Failed'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {profileLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : userProfile ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : profileError ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                  )}
                  <span className="text-sm">
                    Profile Database Query: {
                      profileLoading ? 'Testing...' :
                      userProfile ? 'Working' :
                      profileError ? 'Failed (Expected)' :
                      'Pending'
                    }
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-gray-300 rounded" />
                  <span className="text-sm text-gray-500">Full Component Integration (After RLS Fix)</span>
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

        {/* Profile Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Profile Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!authUser ? (
              <div className="text-muted-foreground">
                Waiting for authentication to complete...
              </div>
            ) : profileLoading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Querying profile database...</span>
              </div>
            ) : profileError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">Profile Database Error (Expected):</div>
                  <div className="mt-1">{profileError}</div>
                  <div className="mt-2 text-sm">
                    This error confirms the RLS policy issue identified in Phase 1.
                    The INSERT policy for profiles table is missing.
                  </div>
                </AlertDescription>
              </Alert>
            ) : userProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Profile Retrieved Successfully</span>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <h4 className="font-medium text-green-800">Profile Data:</h4>
                  <div className="text-sm text-green-700 mt-2">
                    <div>Email: {userProfile.email}</div>
                    <div>Full Name: {userProfile.full_name}</div>
                    <div>Subscription: {userProfile.subscription_tier}</div>
                    <div>Tokens: {userProfile.tokens_remaining}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">
                Profile query not yet attempted...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && renderTestResults()}

        {/* RLS Policy Fix Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Required Fix: RLS Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  To proceed with integration, the following SQL must be executed in Supabase SQL Editor:
                </AlertDescription>
              </Alert>
              <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm">
                <div className="text-green-400">-- Add missing INSERT policy for profiles table</div>
                <div className="text-white">CREATE POLICY "Users can insert own profile" ON profiles</div>
                <div className="text-white">  FOR INSERT WITH CHECK (auth.uid() = id);</div>
              </div>
              <div className="text-sm text-muted-foreground">
                After executing this SQL, the profile creation will work and all authentication-dependent
                features will function correctly.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex gap-4">
          <Button onClick={retryIntegration} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Integration Test
          </Button>

          <Button disabled className="opacity-50">
            Next: Full Integration (Requires RLS Fix)
          </Button>
        </div>

        {/* Failure Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Failure Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="font-medium">Expected Failure Points:</div>
              <div>1. ✅ Auth API Call - Working correctly</div>
              <div>2. ❌ Profile Query - Will fail due to missing RLS INSERT policy</div>
              <div>3. ❌ Profile Creation - Will fail due to missing RLS INSERT policy</div>
              <div className="font-medium mt-4">Integration Success Path:</div>
              <div>1. Execute the SQL fix above</div>
              <div>2. Profile creation will work for new users</div>
              <div>3. Dashboard and all features will function</div>
              <div>4. Complete system integration possible</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}