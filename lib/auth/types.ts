import type { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

export type SupabaseClient = ReturnType<typeof createRouteHandlerClient<Database>>

export interface AuthenticatedUser {
  id: string
  email?: string
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser
  supabase: SupabaseClient
}

export interface AuthError {
  error: string
  status: number
}

export type AuthResult = AuthenticatedRequest | NextResponse