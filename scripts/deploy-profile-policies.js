#!/usr/bin/env node

/**
 * Deploy Profile Creation Policies
 *
 * This script helps apply the profile creation policies and triggers
 * to your Supabase database. Run this if you're having issues with
 * profile creation in your application.
 *
 * Usage:
 * 1. Run this script: node scripts/deploy-profile-policies.js
 * 2. Copy the generated SQL and run it in your Supabase SQL editor
 * 3. Or use the Supabase CLI to apply the migration
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Profile Creation Policy Deployment Helper');
console.log('==========================================\n');

// Read the migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/002_profile_creation_trigger.sql');
const fixFilePath = path.join(__dirname, '../fix-profile-policy.sql');

console.log('📁 Available policy files:');
console.log(`1. Migration file: ${migrationPath}`);
console.log(`2. Fix file: ${fixFilePath}\n`);

if (fs.existsSync(migrationPath)) {
  console.log('✅ Migration file exists');
} else {
  console.log('❌ Migration file not found');
}

if (fs.existsSync(fixFilePath)) {
  console.log('✅ Fix file exists');
} else {
  console.log('❌ Fix file not found');
}

console.log('\n📋 Next steps:');
console.log('1. Apply the migration using Supabase CLI:');
console.log('   supabase db push');
console.log('');
console.log('2. Or manually run the SQL in your Supabase dashboard:');
console.log('   - Go to SQL Editor in your Supabase dashboard');
console.log('   - Copy and paste the contents of fix-profile-policy.sql');
console.log('   - Execute the SQL');
console.log('');
console.log('3. Verify the policies are working:');
console.log('   - Test user signup in your application');
console.log('   - Check that profiles are created automatically');
console.log('');

console.log('🔍 Policy verification query:');
console.log('Run this in your SQL editor to check policies:');
console.log('');
console.log(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';`);
console.log('');

console.log('✨ Profile creation should now work automatically!');