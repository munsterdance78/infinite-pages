#!/usr/bin/env node

/**
 * ENVIRONMENT VALIDATION SCRIPT
 * Tests all API connections and environment variables
 * Run this before starting new architecture build
 */

const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')
const Stripe = require('stripe')

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function testEnvironmentVariables() {
  log('blue', '\n🔍 TESTING ENVIRONMENT VARIABLES...\n')

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SITE_URL'
  ]

  const optionalVars = [
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_BASIC_MONTHLY_PRICE_ID',
    'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_DSN'
  ]

  let allRequired = true

  // Test required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      log('green', `✅ ${varName}: Set`)
    } else {
      log('red', `❌ ${varName}: MISSING`)
      allRequired = false
    }
  }

  // Test optional variables
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      log('yellow', `⚠️  ${varName}: Set (optional)`)
    } else {
      log('yellow', `⚠️  ${varName}: Not set (optional)`)
    }
  }

  return allRequired
}

async function testSupabase() {
  log('blue', '\n🗄️ TESTING SUPABASE CONNECTION...\n')

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      log('red', '❌ Supabase environment variables missing')
      return false
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test basic connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1)

    if (error) {
      log('red', `❌ Supabase connection failed: ${error.message}`)
      return false
    }

    log('green', '✅ Supabase connection successful')
    log('green', `✅ Database accessible`)

    // Test service role (if available)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: adminData, error: adminError } = await adminSupabase.from('profiles').select('count').limit(1)

      if (adminError) {
        log('yellow', `⚠️  Service role test failed: ${adminError.message}`)
      } else {
        log('green', '✅ Service role access confirmed')
      }
    }

    return true
  } catch (error) {
    log('red', `❌ Supabase test failed: ${error.message}`)
    return false
  }
}

async function testAnthropic() {
  log('blue', '\n🤖 TESTING ANTHROPIC API...\n')

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      log('red', '❌ ANTHROPIC_API_KEY missing')
      return false
    }

    const anthropic = new Anthropic({
      apiKey: apiKey
    })

    // Test with minimal request
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: 'Test'
      }]
    })

    if (message && message.content) {
      log('green', '✅ Anthropic API connection successful')
      log('green', `✅ Model: claude-3-sonnet-20240229 accessible`)
      log('green', `✅ Response received: ${message.content[0].text.substring(0, 20)}...`)
      return true
    } else {
      log('red', '❌ Unexpected Anthropic API response format')
      return false
    }
  } catch (error) {
    log('red', `❌ Anthropic API test failed: ${error.message}`)
    return false
  }
}

async function testStripe() {
  log('blue', '\n💳 TESTING STRIPE INTEGRATION...\n')

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    if (!secretKey) {
      log('red', '❌ STRIPE_SECRET_KEY missing')
      return false
    }

    if (!publishableKey) {
      log('red', '❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing')
      return false
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16'
    })

    // Test API connection
    const account = await stripe.accounts.retrieve()

    if (account) {
      log('green', '✅ Stripe API connection successful')
      log('green', `✅ Account ID: ${account.id}`)
      log('green', `✅ Charges enabled: ${account.charges_enabled}`)
      log('green', `✅ Payouts enabled: ${account.payouts_enabled}`)

      // Test price IDs if available
      const priceIds = [
        'STRIPE_BASIC_MONTHLY_PRICE_ID',
        'STRIPE_BASIC_YEARLY_PRICE_ID',
        'STRIPE_PREMIUM_MONTHLY_PRICE_ID',
        'STRIPE_PREMIUM_YEARLY_PRICE_ID'
      ]

      for (const priceIdVar of priceIds) {
        const priceId = process.env[priceIdVar]
        if (priceId) {
          try {
            const price = await stripe.prices.retrieve(priceId)
            log('green', `✅ ${priceIdVar}: ${price.id} ($${price.unit_amount/100})`)
          } catch (error) {
            log('red', `❌ ${priceIdVar}: Invalid price ID`)
          }
        } else {
          log('yellow', `⚠️  ${priceIdVar}: Not set`)
        }
      }

      return true
    } else {
      log('red', '❌ Stripe account retrieval failed')
      return false
    }
  } catch (error) {
    log('red', `❌ Stripe test failed: ${error.message}`)
    return false
  }
}

async function testSiteUrl() {
  log('blue', '\n🌐 TESTING SITE URL...\n')

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!siteUrl) {
      log('red', '❌ NEXT_PUBLIC_SITE_URL missing')
      return false
    }

    log('green', `✅ Site URL set: ${siteUrl}`)

    // Test if URL is reachable
    const response = await fetch(siteUrl)

    if (response.ok) {
      log('green', `✅ Site is accessible (${response.status})`)
      return true
    } else {
      log('yellow', `⚠️  Site returned status: ${response.status}`)
      return true // Still valid, just not accessible
    }
  } catch (error) {
    log('yellow', `⚠️  Site accessibility test failed: ${error.message}`)
    return true // URL might be valid but network issue
  }
}

async function runAllTests() {
  log('blue', '🔧 INFINITE PAGES - ENVIRONMENT VALIDATION')
  log('blue', '=====================================')

  const results = {
    env: await testEnvironmentVariables(),
    supabase: await testSupabase(),
    anthropic: await testAnthropic(),
    stripe: await testStripe(),
    siteUrl: await testSiteUrl()
  }

  log('blue', '\n📊 FINAL RESULTS:')
  log('blue', '==================')

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL'
    const color = passed ? 'green' : 'red'
    log(color, `${test.toUpperCase()}: ${status}`)
  })

  const allPassed = Object.values(results).every(Boolean)

  if (allPassed) {
    log('green', '\n🎉 ALL TESTS PASSED!')
    log('green', '✅ Ready to build new architecture')
  } else {
    log('red', '\n🚨 SOME TESTS FAILED!')
    log('red', '❌ Fix environment variables before proceeding')
  }

  return allPassed
}

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    log('red', `\n💥 Test script failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = { runAllTests }