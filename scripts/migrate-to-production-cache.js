/**
 * Migration Script: Existing Cache → Production Partitioned Cache
 *
 * Safely migrates data from the existing infinite_pages_cache table
 * to the new production-optimized partitioned table structure.
 *
 * Run with: node scripts/migrate-to-production-cache.js
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function checkExistingTable() {
  console.log('🔍 Checking existing cache table...');

  try {
    const { data: existingData, error } = await supabase
      .from('infinite_pages_cache')
      .select('id, created_at, user_id, content_type')
      .limit(5);

    if (error && error.code === '42P01') {
      console.log('ℹ️  No existing cache table found - this is a fresh deployment');
      return { exists: false, count: 0 };
    }

    if (error) {
      console.error('❌ Error checking existing table:', error);
      return { exists: false, count: 0 };
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('infinite_pages_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError);
      return { exists: true, count: 0 };
    }

    console.log(`✅ Found existing cache table with ${count} entries`);

    if (existingData && existingData.length > 0) {
      console.log('📊 Sample entries:');
      existingData.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.content_type} (User: ${entry.user_id?.substring(0, 8)}...) - ${entry.created_at}`);
      });
    }

    return { exists: true, count };
  } catch (error) {
    console.error('❌ Failed to check existing table:', error.message);
    return { exists: false, count: 0 };
  }
}

async function checkPartitionedTable() {
  console.log('\n🔍 Checking partitioned cache table...');

  try {
    const { data, error } = await supabase
      .from('infinite_pages_cache_partitioned')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      console.error('❌ Partitioned cache table does not exist!');
      console.log('Please run the production migration first:');
      console.log('supabase db push');
      return false;
    }

    if (error) {
      console.error('❌ Error checking partitioned table:', error);
      return false;
    }

    console.log('✅ Partitioned cache table is ready');
    return true;
  } catch (error) {
    console.error('❌ Failed to check partitioned table:', error.message);
    return false;
  }
}

async function migrateData(batchSize = 1000) {
  console.log(`\n🚀 Starting data migration (batch size: ${batchSize})...`);

  let totalMigrated = 0;
  let offset = 0;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      // Fetch batch from existing table
      const { data: batch, error: fetchError } = await supabase
        .from('infinite_pages_cache')
        .select('*')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error(`❌ Error fetching batch at offset ${offset}:`, fetchError);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMoreData = false;
        break;
      }

      // Transform data for partitioned table (add new fields with defaults)
      const transformedBatch = batch.map(entry => ({
        ...entry,
        access_frequency: entry.hit_count || 1,
        priority_tier: entry.hit_count > 5 ? 1 : entry.hit_count > 2 ? 2 : 3,
        compression_applied: false
      }));

      // Insert batch into partitioned table
      const { error: insertError } = await supabase
        .from('infinite_pages_cache_partitioned')
        .insert(transformedBatch);

      if (insertError) {
        console.error(`❌ Error inserting batch at offset ${offset}:`, insertError);

        // Try inserting one by one to identify problematic records
        for (const entry of transformedBatch) {
          const { error: singleError } = await supabase
            .from('infinite_pages_cache_partitioned')
            .insert([entry]);

          if (singleError) {
            console.error(`❌ Failed to insert entry ${entry.id}:`, singleError.message);
          } else {
            totalMigrated++;
          }
        }
      } else {
        totalMigrated += batch.length;
        console.log(`✅ Migrated batch: ${totalMigrated} entries total`);
      }

      offset += batchSize;

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Unexpected error during migration:`, error.message);
      break;
    }
  }

  console.log(`\n🎉 Migration completed! Total entries migrated: ${totalMigrated}`);
  return totalMigrated;
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  try {
    // Count entries in both tables
    const { count: originalCount, error: originalError } = await supabase
      .from('infinite_pages_cache')
      .select('*', { count: 'exact', head: true });

    const { count: partitionedCount, error: partitionedError } = await supabase
      .from('infinite_pages_cache_partitioned')
      .select('*', { count: 'exact', head: true });

    if (originalError || partitionedError) {
      console.error('❌ Error during verification:', originalError || partitionedError);
      return false;
    }

    console.log(`📊 Original table: ${originalCount} entries`);
    console.log(`📊 Partitioned table: ${partitionedCount} entries`);

    if (originalCount === partitionedCount) {
      console.log('✅ Migration verification successful - counts match!');
      return true;
    } else {
      console.log('⚠️  Migration verification warning - counts do not match');
      console.log('This might be due to duplicate keys or constraint violations');
      return false;
    }
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

async function createBackupTable() {
  console.log('\n💾 Creating backup of original table...');

  try {
    // Create backup table with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const backupTableName = `infinite_pages_cache_backup_${timestamp}`;

    const { error } = await supabase.rpc('sql', {
      query: `
        CREATE TABLE ${backupTableName} AS
        SELECT * FROM infinite_pages_cache;
      `
    });

    if (error) {
      console.error('❌ Failed to create backup:', error);
      return false;
    }

    console.log(`✅ Backup created: ${backupTableName}`);
    return backupTableName;
  } catch (error) {
    console.error('❌ Backup creation failed:', error.message);
    return false;
  }
}

async function updateApplicationConfig() {
  console.log('\n⚙️  Application Configuration Update Required');
  console.log('===========================================');
  console.log('After migration, update your application code:');
  console.log('');
  console.log('1. Update lib/claude/infinitePagesCache.ts:');
  console.log('   - Change table name from "infinite_pages_cache" to "infinite_pages_cache_partitioned"');
  console.log('');
  console.log('2. Update any direct SQL queries to use the new table name');
  console.log('');
  console.log('3. Test cache functionality thoroughly before deploying');
  console.log('');
  console.log('4. Consider running the verification script:');
  console.log('   node scripts/verify-production-cache.js');
}

async function main() {
  console.log('🚀 Infinite Pages Cache Migration to Production');
  console.log('===============================================');
  console.log('This script migrates from infinite_pages_cache to infinite_pages_cache_partitioned\n');

  // Check existing table
  const { exists, count } = await checkExistingTable();

  if (!exists) {
    console.log('✅ No migration needed - deploying fresh production cache system');
    rl.close();
    return;
  }

  // Check partitioned table
  const partitionedReady = await checkPartitionedTable();
  if (!partitionedReady) {
    rl.close();
    return;
  }

  // Confirm migration
  const confirm = await askQuestion(`\n⚠️  About to migrate ${count} cache entries. Continue? (y/N): `);
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    rl.close();
    return;
  }

  // Create backup
  const backupName = await createBackupTable();
  if (!backupName) {
    console.log('❌ Cannot proceed without backup. Migration cancelled.');
    rl.close();
    return;
  }

  // Perform migration
  const migratedCount = await migrateData();

  // Verify migration
  const verified = await verifyMigration();

  if (verified && migratedCount > 0) {
    console.log('\n🎉 MIGRATION SUCCESSFUL!');
    console.log('========================');
    console.log(`✅ ${migratedCount} entries migrated to partitioned table`);
    console.log(`✅ Backup created: ${backupName}`);
    console.log('✅ Migration verified');

    await updateApplicationConfig();

    const dropOriginal = await askQuestion('\n🗑️  Drop original table? (y/N): ');
    if (dropOriginal.toLowerCase() === 'y' || dropOriginal.toLowerCase() === 'yes') {
      try {
        await supabase.rpc('sql', {
          query: 'DROP TABLE infinite_pages_cache CASCADE;'
        });
        console.log('✅ Original table dropped');
      } catch (error) {
        console.error('❌ Failed to drop original table:', error.message);
        console.log('You can manually drop it later: DROP TABLE infinite_pages_cache CASCADE;');
      }
    }

  } else {
    console.log('\n❌ MIGRATION ISSUES DETECTED');
    console.log('============================');
    console.log('Please review the errors above and fix any issues');
    console.log(`Backup table available: ${backupName}`);
    console.log('Original table preserved for safety');
  }

  rl.close();
}

// Run migration
main().catch(console.error);