// FIX CLIENT SUPABASE CONFIGURATION
// This fixes the "No API key found" error by ensuring proper client setup
// Replace your current lib/supabase/client.ts with this content

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const createClient = () => {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    global: {
      headers: {
        'X-Client-Info': 'infinite-pages-web'
      }
    }
  })
}

// Create a singleton client for use throughout the app
let supabaseClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient()
  }
  return supabaseClient
}

// Export the client directly for convenience
export const supabase = getSupabaseClient()