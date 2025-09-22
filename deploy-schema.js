const { createClient } = require('@supabase/supabase-js')
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

async function deploySchema() {
  console.log('🚀 Deploying database schema to Supabase...\n')

  // Create service role client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Read schema file
  const schemaPath = path.join(__dirname, 'supabase/migrations/001_initial_schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')

  console.log('📋 Schema content loaded, executing SQL...')

  try {
    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: schema
    })

    if (error) {
      console.log('❌ Failed to execute schema:', error.message)

      // Try alternative approach - execute statements one by one
      console.log('🔄 Trying to execute statements individually...')

      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'

        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', {
            sql_query: statement
          })

          if (stmtError) {
            console.log(`❌ Statement ${i + 1} failed:`, stmtError.message)
            console.log(`   SQL: ${statement.substring(0, 100)}...`)
            errorCount++
          } else {
            successCount++
            if (statement.includes('CREATE TABLE') || statement.includes('CREATE TRIGGER')) {
              const match = statement.match(/CREATE (?:TABLE|TRIGGER) (\w+)/)
              if (match) {
                console.log(`✅ Created: ${match[1]}`)
              }
            }
          }
        } catch (err) {
          console.log(`❌ Statement ${i + 1} error:`, err.message)
          errorCount++
        }

        // Small delay between statements
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`\n📊 Results: ${successCount} successful, ${errorCount} failed`)

    } else {
      console.log('✅ Schema deployed successfully!')
    }

    // Test if tables were created
    console.log('\n🔍 Verifying table creation...')

    const tables = ['profiles', 'stories', 'chapters', 'generation_logs', 'exports']

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (error) {
          console.log(`❌ Table '${table}' not accessible: ${error.message}`)
        } else {
          console.log(`✅ Table '${table}' created successfully`)
        }
      } catch (err) {
        console.log(`❌ Table '${table}' verification failed: ${err.message}`)
      }
    }

    console.log('\n🎉 Database schema deployment complete!')
    console.log('You can now test login at: http://localhost:3000')

  } catch (error) {
    console.log('❌ Deployment failed:', error.message)
  }
}

deploySchema().catch(console.error)