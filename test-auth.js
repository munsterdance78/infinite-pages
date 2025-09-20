const { createClient } = require('@supabase/supabase-js');

// Manually load environment variables
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Authentication Setup...\n');

  // Check environment variables
  const requiredEnvVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  console.log('📋 Environment Variables Check:');
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (value) {
      console.log(`✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${key}: Not set`);
      return;
    }
  }
  console.log();

  // Test 1: Basic Supabase connection
  console.log('🔗 Test 1: Testing basic Supabase connection...');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`❌ Connection failed: ${error.message}`);
      return;
    }
    console.log('✅ Basic Supabase connection successful');
  } catch (error) {
    console.log(`❌ Connection error: ${error.message}`);
    return;
  }

  // Test 2: Check database connectivity
  console.log('🗃️  Test 2: Testing database connectivity...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.log(`❌ Database query failed: ${error.message}`);
      console.log('   This might indicate RLS policies or table permissions issues');
    } else {
      console.log('✅ Database connectivity successful');
    }
  } catch (error) {
    console.log(`❌ Database error: ${error.message}`);
  }

  // Test 3: Check auth providers
  console.log('🔐 Test 3: Checking authentication providers...');
  try {
    // Try to get the current session (should be null for unauthenticated)
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`❌ Auth session check failed: ${error.message}`);
    } else {
      console.log(`✅ Auth system working - current session: ${session ? 'authenticated' : 'not authenticated'}`);
    }
  } catch (error) {
    console.log(`❌ Auth system error: ${error.message}`);
  }

  // Test 4: Check service role access
  console.log('🔑 Test 4: Testing service role access...');
  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabaseService
      .from('profiles')
      .select('count(*)')
      .single();

    if (error) {
      console.log(`❌ Service role access failed: ${error.message}`);
    } else {
      console.log('✅ Service role access working');
    }
  } catch (error) {
    console.log(`❌ Service role error: ${error.message}`);
  }

  console.log('\n🔍 Authentication Issues Checklist:');
  console.log('1. ✅ Environment variables are set');
  console.log('2. ✅ Supabase connection works');
  console.log('3. Check if Google OAuth is configured in Supabase dashboard');
  console.log('4. Verify redirect URLs are set correctly in Supabase auth settings');
  console.log('5. Check if RLS policies allow profile creation');
  console.log('6. Ensure auth callback route is accessible');

  console.log('\n📝 Common Auth Issues:');
  console.log('- Google OAuth not configured in Supabase > Authentication > Providers');
  console.log('- Redirect URL mismatch (should be: http://localhost:3000/api/auth/callback)');
  console.log('- RLS policies preventing profile creation');
  console.log('- Browser blocking third-party cookies');
  console.log('- Environment variables not loaded correctly');
}

testSupabaseConnection().catch(console.error);