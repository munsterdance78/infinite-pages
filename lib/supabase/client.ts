import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './types'

export const createClient = () => {
  // Debug environment variables in browser BEFORE creating client
  if (typeof window !== 'undefined') {
    console.log('🔍 SUPABASE CLIENT DEBUG - BEFORE CLIENT CREATION:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0);
    console.log('All NEXT_PUBLIC vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')));
    console.log('Full process.env keys count:', Object.keys(process.env).length);

    // Check what Supabase is actually looking for
    console.log('Process.env dump:', process.env);
  }

  try {
    console.log('🚀 Creating Supabase client...');
    const client = createClientComponentClient<Database>();
    console.log('✅ Supabase client created successfully');
    return client;
  } catch (error) {
    console.error('❌ Supabase client creation failed:', error);
    throw error;
  }
}