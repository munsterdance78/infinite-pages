# 🔍 Always-On Request Tracking Setup

This guide ensures your request tracking system runs continuously to capture and help fix errors.

## ✅ Automatic Setup (Already Done)

The request tracking system now automatically starts when your app loads:

1. **Auto-initialization** - Starts tracking all requests on app load
2. **Global fetch wrapper** - Intercepts ALL API calls automatically
3. **User detection** - Auto-detects authenticated users
4. **Health monitoring** - Runs continuous health checks every 30 seconds
5. **Error alerting** - Monitors for high error rates, slow responses
6. **Status widget** - Always visible in development mode

## 🚀 Instant Activation

The system is now **live and running**! Here's what happens automatically:

### 1. All API Calls Tracked
```javascript
// ANY fetch call is now automatically tracked:
fetch('/api/stories/create') // ✅ Automatically tracked
fetch('/api/chapters/generate') // ✅ Automatically tracked
fetch('https://external-api.com/data') // ✅ Automatically tracked
```

### 2. Real-Time Error Detection
- **High error rates** (>10 errors/minute) → Alert
- **Slow responses** (>5 seconds) → Alert
- **High failure rates** (>25% failures) → Alert
- **System health issues** → Alert

### 3. Continuous Monitoring
- Health checks every **30 seconds**
- Error threshold checks every **60 seconds**
- Session tracking for all users
- Performance monitoring built-in

## 📊 How to Access Your Data

### Dashboard (Always Available)
```
https://www.infinite-pages.com/admin/request-flow
```
- Real-time request flow mapping
- Error rates and response times
- Integration health status
- Active user monitoring

### Test System
```
https://www.infinite-pages.com/request-tracking-test
```
- Validate all tracking features
- Test error scenarios
- Verify database integration

### Status Widget
- **Bottom-right corner** in development
- Shows: Active requests, alerts, health status
- Quick access to dashboard and tests
- Manual health/alert checks

## 🛠️ Environment Configuration

### Required Environment Variables
```bash
# In your .env.local file:

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Show monitoring in production
NEXT_PUBLIC_SHOW_MONITORING=true

# Optional: Alert webhook for external notifications
NEXT_PUBLIC_ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
```

### Database Setup (Automatic)
The system automatically creates these tables:
- `request_logs` - All request data
- `request_flow_analytics` - Aggregated analytics
- `request_dashboard_stats` - Real-time stats (materialized view)

## 🚨 Error Alert System

### Alert Types You'll See
1. **High Error Rate** - Too many failed requests
2. **Slow Response Time** - APIs responding slowly
3. **High Failure Rate** - Success rate dropping
4. **Integration Issues** - Specific API endpoints failing
5. **Health Check Failed** - System monitoring issues

### Where Alerts Appear
- **Console logs** with 🚨 prefix
- **Status widget** with alert counts
- **Dashboard** with alert indicators
- **Optional webhooks** for external systems

## 🔧 Manual Controls

### Programmatic Access
```javascript
import { requestTrackingManager } from '@/lib/request-tracking-init'

// Get current status
const status = requestTrackingManager.getStatus()

// Force health check
await requestTrackingManager.forceHealthCheck()

// Update alert thresholds
requestTrackingManager.updateConfig({
  alertThresholds: {
    errorRate: 5,     // Lower threshold for more sensitive alerting
    responseTime: 3000, // 3 second threshold
    failureRate: 15   // 15% failure rate triggers alert
  }
})
```

### React Hook (In Components)
```javascript
import { useRequestMonitoring } from '@/hooks/useRequestMonitoring'

function MyComponent() {
  const {
    status,
    recentAlerts,
    isHealthy,
    forceHealthCheck
  } = useRequestMonitoring()

  return (
    <div>
      Status: {status.initialized ? '✅ Active' : '❌ Inactive'}
      Active Requests: {status.activeRequests}
      Recent Alerts: {recentAlerts.length}
      Health: {isHealthy ? '✅' : '🚨'}
    </div>
  )
}
```

## 🎯 What Gets Tracked

### Every Request Captures:
- **Frontend context** - Which button/component triggered it
- **API details** - Endpoint, method, status, timing
- **User context** - ID, tier, session, device info
- **Integration point** - Claude API, Supabase, Stripe, etc.
- **Success/failure** - With detailed error messages
- **Performance data** - Response times, queue times

### Request Flow Example:
```
User clicks "Generate Story" button
  ↓
StoryCreator component
  ↓
POST /api/stories/generate
  ↓
Claude API integration
  ↓
Response: 200 OK (2.3s)
  ↓
UI updates with new story
  ↓
Complete flow tracked ✅
```

## 🏃‍♂️ It's Running Now!

The system is **already active** and tracking requests. You should see:

1. **Status widget** in bottom-right corner (development mode)
2. **Console logs** showing initialization
3. **Database entries** in `request_logs` table
4. **Dashboard data** at `/admin/request-flow`

## 📈 Monitoring Best Practices

### Daily Monitoring
1. Check **dashboard** for error patterns
2. Review **slow endpoints** for optimization
3. Monitor **integration health** for third-party APIs
4. Check **user behavior** patterns

### Weekly Reviews
1. Analyze **most common errors**
2. Identify **performance bottlenecks**
3. Review **user journey patterns**
4. Update **alert thresholds** based on patterns

### Incident Response
1. **High severity alerts** → Investigate immediately
2. **Medium alerts** → Review within hours
3. **Pattern alerts** → Weekly review and optimization
4. **System alerts** → Check monitoring system health

## 🚀 Ready to Fix Errors!

Your request tracking system is now **always running** and will help you:

✅ **Catch errors immediately** as they happen
✅ **Identify problematic endpoints** before users complain
✅ **Monitor third-party integrations** (Claude, Stripe, etc.)
✅ **Track user journey issues** from click to completion
✅ **Get alerted** when error rates spike
✅ **Optimize performance** based on real data

Visit the dashboard now to see it in action:
**https://www.infinite-pages.com/admin/request-flow** 🎯