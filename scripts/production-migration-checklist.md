# LIVE PRODUCTION MIGRATION EXECUTION GUIDE

## ⚠️ CRITICAL: READ BEFORE PROCEEDING

This guide will help you safely execute the production cache migration on your live Supabase database.

## 🕐 TIMING: Execute During Low-Traffic Period
- Recommended: 2-4 AM in your users' primary timezone
- Estimated downtime: 5-15 minutes
- Have rollback plan ready

## 📋 PRE-MIGRATION CHECKLIST

### 1. Environment Verification
```bash
# Verify you have the correct environment variables
echo "Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."

# Test connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('profiles').select('count').then(({data, error}) =>
  console.log(error ? 'Connection failed:' + error.message : 'Connection successful')
);
"
```

### 2. Create Backup
```bash
# CRITICAL: Create full database backup first
# Go to your Supabase dashboard > Settings > Database > Backups
# Or use pg_dump if you have direct access:
# pg_dump -h db.your-project.supabase.co -U postgres -d postgres -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Traffic Monitoring
```bash
# Monitor current traffic in Supabase dashboard
# Check: Dashboard > API > Realtime activity
# Proceed only when traffic is minimal
```

## 🚀 MIGRATION EXECUTION STEPS

### Step 1: Apply Migration
```bash
# Navigate to your project
cd /path/to/infinite-pages/extracted-project

# Apply the production migration
supabase db push
# OR if not using Supabase CLI:
# Apply migration manually via Supabase SQL Editor
```

### Step 2: Verify Migration
```bash
# Run verification script immediately after migration
node scripts/verify-production-cache.js
```

### Step 3: Test Application Connectivity
```bash
# Test from your application environment
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Test partitioned table access
  const { data, error } = await supabase
    .from('infinite_pages_cache_partitioned')
    .select('id')
    .limit(1);

  if (error) {
    console.log('❌ Cache table test failed:', error.message);
  } else {
    console.log('✅ Cache table accessible');
  }

  // Test monitoring views
  const { data: metrics, error: metricsError } = await supabase
    .from('cache_performance_metrics')
    .select('*')
    .limit(1);

  if (metricsError) {
    console.log('❌ Monitoring views failed:', metricsError.message);
  } else {
    console.log('✅ Monitoring views working');
  }
}
test();
"
```

## 📊 POST-MIGRATION MONITORING

### Immediate Checks (0-15 minutes)
```sql
-- In Supabase SQL Editor, run these queries:

-- 1. Verify partitions created
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'infinite_pages_cache_%'
AND schemaname = 'public';

-- 2. Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename LIKE 'infinite_pages_cache%';

-- 3. Verify RLS policies
SELECT policyname, tablename
FROM pg_policies
WHERE tablename LIKE 'infinite_pages_cache%';

-- 4. Test monitoring views
SELECT * FROM cache_performance_metrics LIMIT 5;
SELECT * FROM partition_health_metrics LIMIT 5;
```

### Application Health Check
```bash
# Test story generation still works
curl -X POST https://your-app.vercel.app/api/stories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Story","genre":"Fantasy","premise":"Test premise"}'

# Should return normally without cache initially
```

## 🔄 DATA MIGRATION (If Existing Cache Data)

### If you have existing cache data to migrate:
```bash
# Run the migration script
node scripts/migrate-to-production-cache.js

# Follow the prompts to:
# 1. Create backup of existing data
# 2. Migrate data in batches
# 3. Verify migration success
# 4. Optionally drop old table
```

## 📈 MONITORING SETUP

### 1. Supabase Dashboard Monitoring
- Go to Dashboard > Database > Performance
- Set up alerts for:
  - Query performance degradation
  - Connection pool exhaustion
  - High error rates

### 2. Application Monitoring
```javascript
// Add this to your app for monitoring cache performance
export async function logCacheMetrics() {
  try {
    const { data } = await supabase
      .from('cache_performance_metrics')
      .select('*');

    console.log('Cache Metrics:', data);
    // Send to your monitoring service (DataDog, etc.)
  } catch (error) {
    console.error('Cache metrics failed:', error);
  }
}

// Call this periodically or on application start
```

## 🚨 ROLLBACK PLAN

### If Migration Fails:
```sql
-- 1. Drop partitioned table if it was created
DROP TABLE IF EXISTS infinite_pages_cache_partitioned CASCADE;

-- 2. Drop monitoring views
DROP VIEW IF EXISTS cache_performance_metrics CASCADE;
DROP VIEW IF EXISTS partition_health_metrics CASCADE;

-- 3. Restore from backup if needed
-- psql -h your-host -U postgres -d postgres -f your_backup.sql
```

### If Application Issues:
```bash
# 1. Temporarily disable caching in your app
# Set environment variable: DISABLE_CACHE=true

# 2. Redeploy application with cache disabled
vercel deploy --prod

# 3. Investigate and fix issues
# 4. Re-enable caching when ready
```

## ✅ SUCCESS INDICATORS

After migration, you should see:
- ✅ Verification script passes all checks
- ✅ Story generation continues working normally
- ✅ Cache hit rates start improving over time
- ✅ No increase in error rates
- ✅ Database performance remains stable

## 📞 EMERGENCY CONTACTS

- Supabase Support: support@supabase.io
- Your team's database expert
- Have this checklist ready for quick reference

## 🎯 EXPECTED TIMELINE

- **T-0:00** Start migration
- **T+0:05** Migration complete
- **T+0:10** Verification complete
- **T+0:15** Application health confirmed
- **T+0:30** Initial cache data populated
- **T+1:00** Cache hit rates visible
- **T+24:00** Full performance benefits realized

Remember: Take your time, verify each step, and don't hesitate to rollback if anything seems wrong!