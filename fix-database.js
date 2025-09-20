const fs = require('fs');
const path = require('path');

// Load environment variables
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

async function executeSQL(sql) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response;
}

async function createTablesDirectly() {
  console.log('🔧 Creating database tables directly...\n');

  const statements = [
    {
      name: 'uuid extension',
      sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
    },
    {
      name: 'profiles table',
      sql: `CREATE TABLE IF NOT EXISTS profiles (
        id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT,
        subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
        subscription_status TEXT DEFAULT 'inactive',
        stripe_customer_id TEXT,
        current_period_end TIMESTAMPTZ,
        tokens_remaining INTEGER DEFAULT 10,
        tokens_used_total INTEGER DEFAULT 0,
        last_token_grant TIMESTAMPTZ DEFAULT NOW(),
        stories_created INTEGER DEFAULT 0,
        words_generated INTEGER DEFAULT 0,
        onboarding_complete BOOLEAN DEFAULT FALSE,
        writing_goals TEXT[],
        preferred_genres TEXT[],
        experience_level TEXT,
        writing_frequency TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'stories table',
      sql: `CREATE TABLE IF NOT EXISTS stories (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
        title TEXT NOT NULL,
        genre TEXT,
        premise TEXT,
        foundation JSONB,
        outline JSONB,
        characters JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'published')),
        word_count INTEGER DEFAULT 0,
        chapter_count INTEGER DEFAULT 0,
        total_tokens_used INTEGER DEFAULT 0,
        total_cost_usd DECIMAL(10,6) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'chapters table',
      sql: `CREATE TABLE IF NOT EXISTS chapters (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
        chapter_number INTEGER NOT NULL,
        title TEXT,
        content TEXT,
        summary TEXT,
        word_count INTEGER DEFAULT 0,
        tokens_used_input INTEGER DEFAULT 0,
        tokens_used_output INTEGER DEFAULT 0,
        generation_cost_usd DECIMAL(10,6) DEFAULT 0,
        prompt_type TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(story_id, chapter_number)
      );`
    },
    {
      name: 'generation_logs table',
      sql: `CREATE TABLE IF NOT EXISTS generation_logs (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
        story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
        chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
        operation_type TEXT NOT NULL CHECK (operation_type IN ('foundation', 'chapter', 'improvement')),
        tokens_input INTEGER NOT NULL,
        tokens_output INTEGER NOT NULL,
        cost_usd DECIMAL(10,6) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`
    },
    {
      name: 'exports table',
      sql: `CREATE TABLE IF NOT EXISTS exports (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
        story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('pdf', 'epub', 'docx', 'txt')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
        file_url TEXT,
        file_size_bytes INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
      );`
    }
  ];

  // Execute each statement
  for (const { name, sql } of statements) {
    try {
      console.log(`📝 Creating ${name}...`);

      // Use direct HTTP request to Supabase
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });

      if (response.ok) {
        console.log(`✅ ${name} created successfully`);
      } else {
        const error = await response.text();
        console.log(`❌ Failed to create ${name}: ${error}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${name}: ${error.message}`);
    }

    // Small delay between operations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n🔑 Setting up basic RLS policies...');

  const policies = [
    'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;',
    'CREATE POLICY IF NOT EXISTS "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);',
    'CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);'
  ];

  for (const policy of policies) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: policy })
      });

      if (response.ok) {
        console.log('✅ Policy applied');
      } else {
        console.log('⚠️  Policy may already exist');
      }
    } catch (error) {
      console.log('⚠️  Policy error (may be normal)');
    }
  }

  console.log('\n🎯 Creating user trigger function...');

  const triggerFunction = `
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  `;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: triggerFunction })
    });

    if (response.ok) {
      console.log('✅ User trigger created');
    } else {
      const error = await response.text();
      console.log('❌ Trigger creation failed:', error);
    }
  } catch (error) {
    console.log('❌ Trigger error:', error.message);
  }

  console.log('\n✅ Basic database setup complete!');
  console.log('🚀 You can now test login at: http://localhost:3000');
}

createTablesDirectly().catch(console.error);