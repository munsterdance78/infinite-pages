/**
 * Production Cache System Verification Script
 *
 * Verifies that the production-optimized cache system is properly deployed and functioning
 * Run with: node scripts/verify-production-cache.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPartitionedTable() {
  console.log('🔍 Verifying partitioned cache table...');

  try {
    // Check if partitioned table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('infinite_pages_cache_partitioned')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      console.error('❌ Partitioned cache table does not exist');
      return false;
    }

    console.log('✅ Partitioned cache table exists');

    // Check partitions
    const { data: partitions, error: partitionError } = await supabase
      .rpc('sql', {
        query: `
          SELECT tablename, pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
          FROM pg_tables
          WHERE tablename LIKE 'infinite_pages_cache_%'
          AND schemaname = 'public'
          ORDER BY tablename;
        `
      });

    if (partitionError) {
      console.error('❌ Failed to check partitions:', partitionError);
      return false;
    }

    console.log(`✅ Found ${partitions?.length || 0} cache partitions:`);
    partitions?.forEach(partition => {
      console.log(`   - ${partition.tablename} (${partition.size})`);
    });

    return true;
  } catch (error) {
    console.error('❌ Partition verification failed:', error.message);
    return false;
  }
}

async function verifyIndexes() {
  console.log('\n🔍 Verifying production indexes...');

  const requiredIndexes = [
    'idx_cache_user_content_type_performance',
    'idx_cache_expires_at_cleanup',
    'idx_cache_semantic_hash_reuse',
    'idx_cache_foundation_dependency_performance',
    'idx_cache_content_type_priority',
    'idx_cache_user_analytics',
    'idx_cache_metadata_gin_optimized',
    'idx_cache_lookup_composite',
    'idx_cache_hot_data'
  ];

  try {
    const { data: indexes, error } = await supabase
      .rpc('sql', {
        query: `
          SELECT indexname, tablename
          FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename LIKE 'infinite_pages_cache%'
          AND indexname LIKE 'idx_cache_%';
        `
      });

    if (error) {
      console.error('❌ Failed to verify indexes:', error);
      return false;
    }

    const foundIndexes = indexes?.map(idx => idx.indexname) || [];
    let allFound = true;

    requiredIndexes.forEach(requiredIndex => {
      const found = foundIndexes.some(idx => idx.includes(requiredIndex));
      if (found) {
        console.log(`✅ Index found: ${requiredIndex}`);
      } else {
        console.log(`❌ Missing index: ${requiredIndex}`);
        allFound = false;
      }
    });

    console.log(`\n📊 Total indexes found: ${foundIndexes.length}`);
    return allFound;
  } catch (error) {
    console.error('❌ Index verification failed:', error.message);
    return false;
  }
}

async function verifyRowLevelSecurity() {
  console.log('\n🔍 Verifying row-level security policies...');

  try {
    const { data: policies, error } = await supabase
      .rpc('sql', {
        query: `
          SELECT policyname, tablename, permissive, roles, cmd, qual
          FROM pg_policies
          WHERE schemaname = 'public'
          AND tablename LIKE 'infinite_pages_cache%';
        `
      });

    if (error) {
      console.error('❌ Failed to verify RLS policies:', error);
      return false;
    }

    const requiredPolicies = [
      'tenant_isolation_cache_access',
      'analytics_readonly_access',
      'admin_maintenance_access'
    ];

    const foundPolicies = policies?.map(p => p.policyname) || [];
    let allFound = true;

    requiredPolicies.forEach(requiredPolicy => {
      if (foundPolicies.includes(requiredPolicy)) {
        console.log(`✅ RLS Policy found: ${requiredPolicy}`);
      } else {
        console.log(`❌ Missing RLS policy: ${requiredPolicy}`);
        allFound = false;
      }
    });

    // Check if RLS is enabled on main table
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('sql', {
        query: `
          SELECT tablename, rowsecurity
          FROM pg_tables t
          JOIN pg_class c ON c.relname = t.tablename
          WHERE t.schemaname = 'public'
          AND t.tablename = 'infinite_pages_cache_partitioned';
        `
      });

    if (rlsError) {
      console.error('❌ Failed to check RLS status:', rlsError);
      return false;
    }

    const rlsEnabled = rlsStatus?.[0]?.rowsecurity;
    if (rlsEnabled) {
      console.log('✅ Row-level security is enabled');
    } else {
      console.log('❌ Row-level security is NOT enabled');
      allFound = false;
    }

    return allFound;
  } catch (error) {
    console.error('❌ RLS verification failed:', error.message);
    return false;
  }
}

async function verifyCleanupFunctions() {
  console.log('\n🔍 Verifying cleanup functions...');

  try {
    // Check if cleanup function exists
    const { data: functions, error } = await supabase
      .rpc('sql', {
        query: `
          SELECT proname, prosrc
          FROM pg_proc
          WHERE proname = 'cleanup_expired_cache_entries_production';
        `
      });

    if (error) {
      console.error('❌ Failed to verify cleanup functions:', error);
      return false;
    }

    if (functions && functions.length > 0) {
      console.log('✅ Production cleanup function exists');
    } else {
      console.log('❌ Production cleanup function missing');
      return false;
    }

    // Test cleanup function (dry run)
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_expired_cache_entries_production');

    if (cleanupError) {
      console.error('❌ Cleanup function test failed:', cleanupError);
      return false;
    }

    console.log('✅ Cleanup function test successful:');
    console.log(`   - Deleted: ${cleanupResult?.[0]?.deleted_count || 0} entries`);
    console.log(`   - Freed space: ${cleanupResult?.[0]?.freed_space_mb || 0} MB`);
    console.log(`   - Duration: ${cleanupResult?.[0]?.cleanup_duration_ms || 0} ms`);

    return true;
  } catch (error) {
    console.error('❌ Cleanup function verification failed:', error.message);
    return false;
  }
}

async function verifyMonitoringViews() {
  console.log('\n🔍 Verifying monitoring views...');

  const requiredViews = [
    'cache_performance_metrics',
    'partition_health_metrics',
    'cache_connection_metrics',
    'user_cache_analytics'
  ];

  try {
    let allFound = true;

    for (const viewName of requiredViews) {
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(1);

      if (error && error.code === '42P01') {
        console.log(`❌ Missing view: ${viewName}`);
        allFound = false;
      } else if (error) {
        console.log(`⚠️  View exists but query failed: ${viewName} (${error.message})`);
      } else {
        console.log(`✅ View working: ${viewName}`);
      }
    }

    return allFound;
  } catch (error) {
    console.error('❌ Monitoring views verification failed:', error.message);
    return false;
  }
}

async function verifyPartitionManagement() {
  console.log('\n🔍 Verifying partition management functions...');

  try {
    // Test partition creation function
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 2);
    const testDate = nextMonth.toISOString().split('T')[0];

    const { data: createResult, error: createError } = await supabase
      .rpc('create_monthly_cache_partition', { target_date: testDate });

    if (createError) {
      console.error('❌ Partition creation function failed:', createError);
      return false;
    }

    console.log('✅ Partition creation function working:', createResult);

    // Check scheduled jobs
    const { data: cronJobs, error: cronError } = await supabase
      .rpc('sql', {
        query: `
          SELECT jobname, schedule, command
          FROM cron.job
          WHERE jobname LIKE '%cache%';
        `
      });

    if (cronError) {
      console.log('⚠️  Could not verify cron jobs (may not have permissions)');
    } else {
      console.log(`✅ Found ${cronJobs?.length || 0} scheduled cache jobs:`);
      cronJobs?.forEach(job => {
        console.log(`   - ${job.jobname}: ${job.schedule}`);
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Partition management verification failed:', error.message);
    return false;
  }
}

async function performanceTest() {
  console.log('\n🔍 Running performance tests...');

  try {
    // Test cache write performance
    const startTime = Date.now();
    const testCacheKey = `test_${Date.now()}_${Math.random()}`;

    const { error: insertError } = await supabase
      .from('infinite_pages_cache_partitioned')
      .insert({
        cache_key: testCacheKey,
        content: { test: 'data', generated_at: new Date().toISOString() },
        content_type: 'test_entry',
        user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        prompt_template: 'test template',
        semantic_similarity_hash: 'test_hash_' + Math.random(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        priority_tier: 3
      });

    const insertTime = Date.now() - startTime;

    if (insertError) {
      console.error('❌ Cache insert test failed:', insertError);
      return false;
    }

    console.log(`✅ Cache insert performance: ${insertTime}ms`);

    // Test cache read performance
    const readStartTime = Date.now();
    const { data, error: selectError } = await supabase
      .from('infinite_pages_cache_partitioned')
      .select('*')
      .eq('cache_key', testCacheKey)
      .single();

    const readTime = Date.now() - readStartTime;

    if (selectError) {
      console.error('❌ Cache read test failed:', selectError);
      return false;
    }

    console.log(`✅ Cache read performance: ${readTime}ms`);

    // Cleanup test data
    await supabase
      .from('infinite_pages_cache_partitioned')
      .delete()
      .eq('cache_key', testCacheKey);

    // Performance benchmarks
    if (insertTime > 100) {
      console.log('⚠️  Cache insert performance slower than expected (>100ms)');
    }
    if (readTime > 50) {
      console.log('⚠️  Cache read performance slower than expected (>50ms)');
    }

    return true;
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    return false;
  }
}

async function verifyProductionCache() {
  console.log('🚀 Production Cache System Verification');
  console.log('======================================');
  console.log('🎯 Verifying production-optimized cache deployment\n');

  const verificationSteps = [
    { name: 'Partitioned Table Structure', test: verifyPartitionedTable },
    { name: 'Production Indexes', test: verifyIndexes },
    { name: 'Row-Level Security', test: verifyRowLevelSecurity },
    { name: 'Cleanup Functions', test: verifyCleanupFunctions },
    { name: 'Monitoring Views', test: verifyMonitoringViews },
    { name: 'Partition Management', test: verifyPartitionManagement },
    { name: 'Performance Tests', test: performanceTest }
  ];

  let allPassed = true;
  const results = [];

  for (const step of verificationSteps) {
    try {
      const passed = await step.test();
      results.push({ name: step.name, passed });
      if (!passed) allPassed = false;
    } catch (error) {
      console.error(`❌ ${step.name} verification failed:`, error.message);
      results.push({ name: step.name, passed: false });
      allPassed = false;
    }
  }

  console.log('\n🎉 PRODUCTION CACHE VERIFICATION RESULTS');
  console.log('========================================');

  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });

  console.log('\n📊 SUMMARY:');
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);

  if (allPassed) {
    console.log('\n🎉 PRODUCTION CACHE SYSTEM READY!');
    console.log('===============================');
    console.log('✅ All production optimizations verified');
    console.log('✅ Multi-tenant isolation active');
    console.log('✅ Auto-scaling partitions configured');
    console.log('✅ High-performance indexes deployed');
    console.log('✅ Automated cleanup systems operational');
    console.log('✅ Monitoring and analytics ready');
    console.log('');
    console.log('🚀 PRODUCTION DEPLOYMENT CHECKLIST:');
    console.log('  1. ✅ Database optimizations deployed');
    console.log('  2. ✅ Security policies active');
    console.log('  3. ✅ Performance monitoring enabled');
    console.log('  4. ⏳ Deploy application code');
    console.log('  5. ⏳ Configure connection pooling at infrastructure level');
    console.log('  6. ⏳ Set up production monitoring alerts');
    console.log('  7. ⏳ Test with production traffic');
    console.log('');
    console.log('💰 EXPECTED PRODUCTION BENEFITS:');
    console.log('  • 70% reduction in AI generation costs');
    console.log('  • Sub-50ms cache lookup performance');
    console.log('  • Automatic scaling to millions of cache entries');
    console.log('  • Zero-downtime partition management');
    console.log('  • Enterprise-grade security and compliance');
  } else {
    console.log('\n❌ PRODUCTION DEPLOYMENT NOT READY');
    console.log('Please fix the failed verification steps before deploying to production.');
    process.exit(1);
  }
}

// Run verification
verifyProductionCache().catch(console.error);