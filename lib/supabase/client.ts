import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './types'

export const createClient = () => {
  // Validate environment variables are available
  if (typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      console.error('🚨 Supabase Environment Variables Missing!')
      console.error('Missing variables:', {
        NEXT_PUBLIC_SUPABASE_URL: url ? '✅ Set' : '❌ Missing',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key ? '✅ Set' : '❌ Missing'
      })
      console.error('🔧 Fix: Configure environment variables in Vercel Dashboard')

      throw new Error(
        'Supabase configuration missing. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.'
      )
    }
  }

  return createClientComponentClient<Database>()
}