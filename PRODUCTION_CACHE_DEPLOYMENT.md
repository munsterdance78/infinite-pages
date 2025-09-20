# Production Cache System Deployment Guide

## 🚀 Overview

This guide covers the deployment of the production-optimized Infinite Pages cache system designed for high-traffic, multi-tenant environments with advanced performance optimizations.

## 📋 Pre-Deployment Checklist

### Infrastructure Requirements
- [ ] PostgreSQL 14+ with partitioning support
- [ ] Minimum 4GB RAM allocated to database
- [ ] SSD storage for optimal partition performance
- [ ] Connection pooling configured (PgBouncer recommended)
- [ ] Monitoring tools ready (DataDog, New Relic, etc.)

### Environment Variables
```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Connection pooling
DATABASE_URL=postgresql://user:pass@host:port/db?pgbouncer=true
PGBOUNCER_MAX_CLIENT_CONN=100
PGBOUNCER_DEFAULT_POOL_SIZE=20
```

## 🗄️ Database Migration Deployment

### Step 1: Backup Current Database
```bash
# Create full backup before migration
pg_dump -h your_host -U your_user -d your_db -f pre_cache_migration_backup.sql

# Create schema-only backup for rollback
pg_dump -h your_host -U your_user -d your_db -s -f schema_backup.sql
```

### Step 2: Deploy Production Migration
```bash
# Apply the production cache migration
supabase db push

# OR manually apply the migration
psql -h your_host -U your_user -d your_db -f supabase/migrations/006_production_cache_optimization.sql
```

### Step 3: Verify Migration
```bash
# Run verification script
node scripts/verify-production-cache.js
```

## ⚙️ Configuration Optimizations

### PostgreSQL Configuration (postgresql.conf)
```postgresql
# Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB

# Performance tuning
work_mem = 16MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Cache-specific optimizations
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

# Partitioning optimization
constraint_exclusion = partition
enable_partition_pruning = on
enable_partitionwise_join = on
enable_partitionwise_aggregate = on
```

### PgBouncer Configuration (pgbouncer.ini)
```ini
[databases]
infinite_pages = host=localhost port=5432 dbname=your_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5

# Connection limits
max_db_connections = 50
max_user_connections = 50

# Timeouts
server_reset_query = DISCARD ALL
server_check_delay = 30
server_lifetime = 3600
server_idle_timeout = 600
```

## 🔧 Application Code Updates

### Update Cache Client Configuration
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false, // For server-side usage
  },
  global: {
    headers: {
      'x-application-name': 'infinite-pages-cache',
    },
  },
})
```

### Update Cache Service to Use Partitioned Table
```typescript
// lib/claude/infinitePagesCache.ts
// Update all table references from 'infinite_pages_cache' to 'infinite_pages_cache_partitioned'

const CACHE_TABLE = 'infinite_pages_cache_partitioned'

export class InfinitePagesCache {
  // ... existing methods updated to use CACHE_TABLE
}
```

## 📊 Monitoring Setup

### Key Metrics to Monitor

#### Database Performance
- Cache hit ratio (target: >60%)
- Query response time (target: <50ms)
- Connection pool utilization
- Partition sizes and growth
- Index usage statistics

#### Application Performance
- Token cost savings (target: 70% reduction)
- Cache lookup latency
- Error rates and timeouts
- User satisfaction metrics

### Monitoring Queries
```sql
-- Cache performance monitoring
SELECT * FROM cache_performance_metrics;

-- Partition health check
SELECT * FROM partition_health_metrics;

-- Connection monitoring
SELECT * FROM cache_connection_metrics;

-- User analytics
SELECT * FROM user_cache_analytics LIMIT 10;
```

### Alerting Rules

#### Critical Alerts
- Cache hit rate drops below 40%
- Database connection pool >90% utilized
- Query response time >200ms
- Partition size >1GB (may need new partition)

#### Warning Alerts
- Cache hit rate drops below 55%
- Cleanup function failures
- High number of expired entries
- Unusual cache access patterns

## 🛡️ Security Considerations

### Row-Level Security Verification
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'infinite_pages_cache%';

-- Test user isolation
SET role authenticated;
SELECT count(*) FROM infinite_pages_cache_partitioned; -- Should only see user's data
```

### Audit Logging
```sql
-- Enable audit logging for compliance
SELECT * FROM cache_audit_log
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

## 🚀 Deployment Steps

### 1. Pre-Production Testing
```bash
# Run full test suite
npm run test

# Run cache-specific tests
npm run test:cache

# Load testing (if applicable)
npm run test:load
```

### 2. Production Deployment

#### Database Migration
```bash
# 1. Create backup
pg_dump -h prod_host -U prod_user -d prod_db -f prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration during maintenance window
supabase db push --linked

# 3. Verify deployment
node scripts/verify-production-cache.js
```

#### Application Deployment
```bash
# 1. Update environment variables
# 2. Deploy application code
vercel deploy --prod

# 3. Test cache functionality
curl -X POST https://your-app.com/api/test-cache
```

### 3. Post-Deployment Verification

#### Immediate Checks (0-1 hour)
- [ ] All monitoring views accessible
- [ ] Cache writes/reads working
- [ ] Partitions created correctly
- [ ] RLS policies active
- [ ] No error spikes in logs

#### Short-term Checks (1-24 hours)
- [ ] Cache hit rates improving
- [ ] Performance within expected ranges
- [ ] Cleanup functions running
- [ ] User analytics populating

#### Long-term Checks (1-7 days)
- [ ] Token cost savings achieved
- [ ] Partition management working
- [ ] User satisfaction maintained
- [ ] System stability confirmed

## 🔄 Maintenance Procedures

### Daily Maintenance
```bash
# Check cache performance
psql -c "SELECT * FROM cache_performance_metrics;"

# Monitor partition sizes
psql -c "SELECT * FROM partition_health_metrics;"

# Review cleanup logs
psql -c "SELECT * FROM cleanup_expired_cache_entries_production();"
```

### Weekly Maintenance
```bash
# Analyze query performance
psql -c "ANALYZE infinite_pages_cache_partitioned;"

# Check index usage
psql -c "SELECT * FROM pg_stat_user_indexes WHERE relname LIKE 'infinite_pages_cache%';"

# Review partition strategy
node scripts/check-partition-health.js
```

### Monthly Maintenance
```bash
# Create next month's partition
psql -c "SELECT create_monthly_cache_partition(CURRENT_DATE + INTERVAL '1 month');"

# Review and optimize indexes
psql -c "REINDEX SCHEMA public;"

# Archive old audit logs
node scripts/archive-audit-logs.js
```

## 🚨 Troubleshooting

### Common Issues

#### High Cache Miss Rate
```sql
-- Check cache configuration
SELECT content_type, count(*), avg(hit_count)
FROM infinite_pages_cache_partitioned
GROUP BY content_type;

-- Review semantic similarity thresholds
-- May need to adjust similarity matching in application code
```

#### Slow Query Performance
```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE relname LIKE 'infinite_pages_cache%'
AND idx_scan = 0;

-- Review query plans
EXPLAIN ANALYZE SELECT * FROM infinite_pages_cache_partitioned
WHERE user_id = 'some-uuid' AND content_type = 'story_foundation';
```

#### Partition Management Issues
```sql
-- Check partition constraints
SELECT schemaname, tablename, pg_get_expr(relpartbound, oid)
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE tablename LIKE 'infinite_pages_cache_%';

-- Manual partition creation if automated fails
SELECT create_monthly_cache_partition('2024-02-01'::DATE);
```

### Emergency Procedures

#### Cache System Failure
1. Check application logs for errors
2. Verify database connectivity
3. Temporarily disable cache (failover to direct API calls)
4. Investigate root cause
5. Restore from backup if necessary

#### Performance Degradation
1. Check connection pool status
2. Review slow query logs
3. Analyze partition pruning efficiency
4. Consider emergency cache cleanup
5. Scale database resources if needed

## 📈 Performance Optimization

### Continuous Optimization
- Monitor cache hit rates by content type
- Adjust semantic similarity thresholds based on usage
- Optimize partition pruning strategies
- Review and update index strategies
- Fine-tune cleanup schedules

### Scaling Considerations
- Horizontal read replicas for analytics
- Partition pruning optimization
- Connection pooling tuning
- Cache warming strategies
- Archive old partitions to separate storage

## 🎯 Success Metrics

### Primary KPIs
- **Cost Reduction:** 70% reduction in AI generation costs
- **Performance:** <50ms average cache lookup time
- **Reliability:** 99.9% cache system uptime
- **Scalability:** Support for 1M+ cache entries

### Secondary KPIs
- Cache hit rate by content type (target: 60%+)
- User satisfaction with generation speed
- Reduction in API timeout errors
- Database resource utilization efficiency

---

## 📞 Support and Escalation

For production issues:
1. Check monitoring dashboards
2. Review application logs
3. Run diagnostic scripts
4. Escalate to database team if needed
5. Document issues and resolutions

Remember to always test changes in staging before applying to production!