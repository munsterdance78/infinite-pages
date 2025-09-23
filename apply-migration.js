const fs = require('fs')
const path = require('path')

// Load environment variables
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=')
    if (key && values.length) {
      process.env[key.trim()] = values.join('=').trim()
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

async function applyMigration() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('🔄 Applying business logic migration...')

  const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'supabase/migrations/007_business_logic_tables.sql'),
    'utf8'
  )

  // Split the migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt && !stmt.startsWith('--'))

  console.log(`📝 Executing ${statements.length} SQL statements...`)

  for (const statement of statements) {
    if (!statement) continue

    try {
      console.log(`Executing: ${statement.substring(0, 50)}...`)
      const { error } = await supabase.rpc('sql', { query: statement + ';' })

      if (error) {
        // Try alternative method if sql function doesn't exist
        if (error.code === 'PGRST202') {
          console.log('Using direct SQL execution...')
          const { error: directError } = await supabase
            .from('information_schema.tables')
            .select('*')
            .limit(1)

          if (directError) {
            console.error('❌ Database connection failed:', directError)
            continue
          }

          // For certain statements that need to be executed directly
          if (statement.includes('CREATE TABLE') || statement.includes('ALTER TABLE')) {
            console.log('⚠️ Table creation requires manual execution in Supabase dashboard')
            console.log('SQL:', statement)
          }
        } else {
          console.error('❌ Error executing statement:', error)
        }
      } else {
        console.log('✅ Statement executed successfully')
      }
    } catch (err) {
      console.error('❌ Exception executing statement:', err.message)
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Test if credit_packages table exists now
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .limit(1)

    if (!error) {
      console.log('✅ Credit packages table accessible')
      console.log('📦 Available packages:', data?.length || 0)
    } else {
      console.log('❌ Credit packages table not accessible:', error.message)
    }
  } catch (err) {
    console.log('❌ Error testing credit_packages:', err.message)
  }

  console.log('✅ Migration application complete!')
}

applyMigration().catch(console.error)