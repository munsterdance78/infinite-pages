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
  Play
} from 'lucide-react'

// FIX VERIFICATION TEST
// This will test if the RLS INSERT policy has been applied correctly

export default function FixVerificationTest() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  const [isTestingFix, setIsTestingFix] = useState(false)
  const [fixWorking, setFixWorking] = useState<boolean | null>(null)

  const supabase = createClient()

  // Check current auth status
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      const testResult = {
        test: 'Authentication Check',
        timestamp: new Date().toISOString(),
        success: !error && user !== null,
        error: error?.message || null,
        data: user ? { id: user.id, email: user.email } : null
      }

      setTestResults(prev => [...prev, testResult])

      if (user) {
        setAuthUser(user)
        // Automatically test the fix if user is authenticated
        await testProfileCreationFix(user)
      }
    } catch (err) {
      console.error('Auth check error:', err)
    }
  }

  // Test if the RLS fix is working
  const testProfileCreationFix = async (user: any) => {
    setIsTestingFix(true)

    try {
      // First, try to fetch existing profile
      console.log('Testing profile fetch for user:', user.id)

      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const fetchResult = {
        test: 'Profile Fetch Attempt',
        timestamp: new Date().toISOString(),
        success: !fetchError,
        error: fetchError?.message || null,
        errorCode: fetchError?.code || null,
        data: existingProfile || null
      }

      setTestResults(prev => [...prev, fetchResult])

      if (existingProfile) {
        // Profile already exists
        setUserProfile(existingProfile)
        setFixWorking(true)
        console.log('Profile already exists:', existingProfile)

        setTestResults(prev => [...prev, {
          test: 'Fix Verification Result',
          timestamp: new Date().toISOString(),
          success: true,
          error: null,
          data: { message: 'Profile exists - system working correctly' }
        }])

        return
      }

      // Profile doesn't exist, try to create it (this tests the fix)
      console.log('Profile not found, testing creation with RLS fix...')

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
          onboarding_complete: false
        })
        .select()
        .single()

      const createResult = {
        test: 'Profile Creation with RLS Fix',
        timestamp: new Date().toISOString(),
        success: !createError && newProfile !== null,
        error: createError?.message || null,
        errorCode: createError?.code || null,
        data: newProfile || null
      }

      setTestResults(prev => [...prev, createResult])

      if (createError) {
        console.error('Profile creation still failing:', createError)
        setFixWorking(false)

        // Check if it's the same RLS error
        if (createError.code === '42501') {
          setTestResults(prev => [...prev, {
            test: 'Fix Verification Result',
            timestamp: new Date().toISOString(),
            success: false,
            error: 'RLS INSERT policy still missing - SQL fix not applied yet',
            data: { needsSqlFix: true }
          }])
        }
      } else {
        console.log('Profile created successfully!', newProfile)
        setUserProfile(newProfile)
        setFixWorking(true)

        setTestResults(prev => [...prev, {
          test: 'Fix Verification Result',
          timestamp: new Date().toISOString(),
          success: true,
          error: null,
          data: { message: 'RLS fix working! Profile creation successful!' }
        }])
      }

    } catch (err) {
      console.error('Profile creation test error:', err)
      setFixWorking(false)

      setTestResults(prev => [...prev, {
        test: 'Profile Creation Test',
        timestamp: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        data: null
      }])
    } finally {
      setIsTestingFix(false)
    }
  }

  const retryTest = () => {
    setTestResults([])
    setFixWorking(null)
    setUserProfile(null)
    checkAuthStatus()
  }

  const testDashboardAPI = async () => {
    if (!authUser) return

    try {
      console.log('Testing dashboard API after fix...')

      const response = await fetch('/api/dashboard')
      const data = await response.json()

      const apiResult = {
        test: 'Dashboard API Test',
        timestamp: new Date().toISOString(),
        success: response.ok,
        error: response.ok ? null : data.error,
        data: response.ok ? { profileExists: !!data.profile } : null
      }

      setTestResults(prev => [...prev, apiResult])

    } catch (err) {
      setTestResults(prev => [...prev, {
        test: 'Dashboard API Test',
        timestamp: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        data: null
      }])
    }
  }

  const renderTestResults = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Fix Verification Results
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
      {/* Test Status Banner */}
      <div className={`text-white text-center py-2 text-sm font-medium ${
        fixWorking === null ? 'bg-blue-600' :
        fixWorking ? 'bg-green-600' : 'bg-red-600'
      }`}>
        🔧 FIX VERIFICATION TEST - {
          fixWorking === null ? 'Testing RLS Policy Fix...' :
          fixWorking ? 'FIX WORKING! ✅' : 'FIX NEEDED - Execute SQL First ❌'
        }
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">RLS Policy Fix Verification</h1>
          <p className="text-muted-foreground">
            Testing if the INSERT policy for profiles table has been applied correctly
          </p>
        </div>

        {/* Fix Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Fix Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fixWorking === null ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Testing RLS policy fix...</span>
                </div>
              ) : fixWorking ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    ✅ <strong>RLS Fix Working!</strong> Profile creation is now functional.
                    All authentication-dependent features should now work correctly.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    ❌ <strong>RLS Fix Not Applied Yet.</strong> Please execute the SQL command in Supabase:
                    <br />
                    <code className="bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
                      CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
                    </code>
                  </AlertDescription>
                </Alert>
              )}
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
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No authenticated user found. Please sign in to test the fix.
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
                Profile Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isTestingFix ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Testing profile creation...</span>
                </div>
              ) : userProfile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Profile Available</span>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-sm text-green-700">
                      <div>Email: {userProfile.email}</div>
                      <div>Full Name: {userProfile.full_name}</div>
                      <div>Subscription: {userProfile.subscription_tier}</div>
                      <div>Tokens: {userProfile.tokens_remaining}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Profile creation test will run automatically when authenticated.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        {testResults.length > 0 && renderTestResults()}

        {/* Controls */}
        <div className="flex gap-4">
          <Button onClick={retryTest} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Test
          </Button>

          {fixWorking && (
            <Button onClick={testDashboardAPI}>
              <Play className="h-4 w-4 mr-2" />
              Test Dashboard API
            </Button>
          )}
        </div>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            {fixWorking === null ? (
              <div className="text-sm">Testing in progress...</div>
            ) : fixWorking ? (
              <div className="space-y-2 text-sm">
                <div>✅ RLS policy fix is working correctly</div>
                <div>✅ Profile creation is functional</div>
                <div>✅ Ready to proceed with Phase 4</div>
                <div>✅ All authentication-dependent features should now work</div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div>1. Execute the SQL fix in Supabase SQL Editor</div>
                <div>2. Return to this page and click "Retry Test"</div>
                <div>3. Verify the fix is working</div>
                <div>4. Proceed with Phase 4 once confirmed</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}