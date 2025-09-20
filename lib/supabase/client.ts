import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './types'

// Debug environment variables at module load time
console.log('🔍 MODULE LOAD DEBUG:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('All NEXT_PUBLIC vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')));

export const createClient = () => {
  console.log('🚀 createClient() called');

  // Check if environment variables are missing and provide fallback
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Environment variables missing in production!');
    console.log('Available env vars:', Object.keys(process.env));

    // For now, throw a more helpful error
    throw new Error('Supabase environment variables are not available in production. Check Vercel configuration.');
  }

  try {
    console.log('🚀 Creating Supabase client with available env vars...');
    const client = createClientComponentClient<Database>();
    console.log('✅ Supabase client created successfully');
    return client;
  } catch (error) {
    console.error('❌ Supabase client creation failed:', error);
    throw error;
  }
}