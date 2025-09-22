# Creator Earnings API Migration Guide

## Overview

The Creator Earnings API has been unified into a single endpoint to improve performance, maintainability, and developer experience. This guide helps you migrate from the deprecated endpoints to the new unified API.

## Migration Timeline

- **Deprecation Date**: January 1, 2024
- **Removal Date**: February 1, 2024
- **Migration Window**: 30 days

## Deprecated Endpoints

The following endpoints are deprecated and will be removed:

1. `/api/creator/earnings` (singular creator)
2. `/api/creators/earnings/enhanced`

## New Unified Endpoint

**Primary Endpoint**: `/api/creators/earnings`

### Key Advantages

- ✅ Single source of truth for all earnings data
- ✅ Configurable response detail levels (basic, enhanced, dashboard)
- ✅ Enhanced caching with view-specific TTLs
- ✅ Export functionality (CSV, XLSX)
- ✅ Real-time updates and optimizations
- ✅ Comprehensive error handling
- ✅ Backward compatibility during transition

## Migration Examples

### 1. Basic Earnings Migration

**Old Endpoint**: `/api/creator/earnings`
```javascript
// OLD - Don't use
const response = await fetch('/api/creator/earnings?include_history=false&history_limit=10')
```

**New Endpoint**: `/api/creators/earnings?view=basic`
```javascript
// NEW - Recommended
const response = await fetch('/api/creators/earnings?view=basic&limit=10')
```

### 2. Enhanced Earnings Migration

**Old Endpoint**: `/api/creators/earnings/enhanced`
```javascript
// OLD - Don't use
const response = await fetch('/api/creators/earnings/enhanced?period=current_month')
```

**New Endpoint**: `/api/creators/earnings?view=enhanced`
```javascript
// NEW - Recommended
const response = await fetch('/api/creators/earnings?view=enhanced&period=current_month')
```

### 3. Detailed History Migration

**Old Endpoint**: `/api/creator/earnings?include_history=true`
```javascript
// OLD - Don't use
const response = await fetch('/api/creator/earnings?include_history=true&history_limit=50')
```

**New Endpoint**: `/api/creators/earnings?view=dashboard`
```javascript
// NEW - Recommended
const response = await fetch('/api/creators/earnings?view=dashboard&limit=50')
```

## Parameter Mapping

### From `/api/creator/earnings`

| Old Parameter | New Parameter | Notes |
|---------------|---------------|-------|
| `include_history=true` | `view=enhanced` | Gets basic + history |
| `include_history=false` | `view=basic` | Basic data only |
| `history_limit=N` | `limit=N` | Transaction limit |
| `period_days=30` | `period=30` | Day-based periods |

### From `/api/creators/earnings/enhanced`

| Old Parameter | New Parameter | Notes |
|---------------|---------------|-------|
| `period=current_month` | `period=current_month` | No change |
| `period=last_month` | `period=last_month` | No change |
| `period=last_3_months` | `period=last_3_months` | No change |
| `period=all_time` | `period=all_time` | No change |

## Response Format Changes

### Basic View Response (New)
```json
{
  "summary": {
    "total_earnings_usd": 250.75,
    "pending_payout_usd": 125.50,
    "total_credits_earned": 2507,
    "unique_readers": 45,
    "stories_with_earnings": 8
  },
  "story_performance": [...],
  "recent_transactions": [...],
  "meta": {
    "view": "basic",
    "responseTime": 45,
    "cacheStats": {...}
  }
}
```

### Enhanced View Response (Migration from Enhanced)
```json
{
  "summary": {...},
  "story_performance": [...],
  "recent_transactions": [...],
  "monthly_trends": [...],
  "payout_history": [...],
  "tier_information": {...},
  "meta": {
    "view": "enhanced",
    "responseTime": 67,
    "cacheStats": {...}
  }
}
```

## New Features Available

### 1. Export Functionality
```javascript
// Export to CSV
const csvData = await fetch('/api/creators/earnings?format=csv&view=enhanced')

// Export to Excel (XLSX)
const xlsxData = await fetch('/api/creators/earnings?format=xlsx&view=dashboard')
```

### 2. Advanced Filtering
```javascript
// Get specific time period with details
const response = await fetch('/api/creators/earnings?view=dashboard&period=custom&start_date=2024-01-01&end_date=2024-01-31')
```

### 3. Optimized Caching
The new endpoint uses intelligent caching with different TTLs:
- Basic view: 2 minutes
- Enhanced view: 1.5 minutes
- Dashboard view: 1 minute
- Aggregated data: 5 minutes

## Breaking Changes

### 1. Response Structure
- The response structure has been standardized across all views
- All responses now include a `meta` object with API information
- Error responses follow a consistent format

### 2. Parameter Names
- `include_history` → Use `view=enhanced` instead
- `history_limit` → `limit` (applies to all data types)

### 3. Authentication
- No changes to authentication requirements
- Premium subscription still required for creator features

## Error Handling

### New Error Response Format
```json
{
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "meta": {
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req_123456",
    "deprecation": {
      "endpoint": "/api/creator/earnings",
      "replacement": "/api/creators/earnings",
      "removalDate": "2024-02-01"
    }
  }
}
```

## Deprecation Headers

During the transition period, deprecated endpoints will return these headers:

```http
X-API-Deprecated: true
X-API-Deprecation-Date: 2024-01-01
X-API-Removal-Date: 2024-02-01
X-API-Migration-Guide: /api/creators/earnings
Warning: 299 - "This API endpoint is deprecated. Please migrate to /api/creators/earnings"
```

## Testing Your Migration

### 1. Verify Endpoint Responses
```javascript
// Test basic migration
const basicTest = await fetch('/api/creators/earnings?view=basic')
console.log('Basic view:', await basicTest.json())

// Test enhanced migration
const enhancedTest = await fetch('/api/creators/earnings?view=enhanced')
console.log('Enhanced view:', await enhancedTest.json())
```

### 2. Check for Deprecation Warnings
```javascript
const response = await fetch('/api/creator/earnings') // Old endpoint
console.log('Deprecated:', response.headers.get('X-API-Deprecated'))
console.log('Remove by:', response.headers.get('X-API-Removal-Date'))
```

### 3. Performance Comparison
```javascript
const start = Date.now()
const response = await fetch('/api/creators/earnings?view=enhanced')
const data = await response.json()
console.log('Response time:', data.meta.responseTime + 'ms')
console.log('Cache hit:', data.meta.cached)
```

## Support

### Questions or Issues?
- Check the [API Documentation](/docs/api/creators/earnings)
- Review the [Changelog](/docs/CHANGELOG.md) for detailed changes
- Contact support with your migration questions

### Need Help?
1. **Migration Support**: Available until removal date
2. **Technical Issues**: Report via standard support channels
3. **Feature Requests**: Submit through the developer portal

## Checklist

- [ ] Identify all usage of deprecated endpoints in your codebase
- [ ] Update API calls to use the new unified endpoint
- [ ] Test the new parameter mappings
- [ ] Verify response handling works with new structure
- [ ] Update error handling for new error format
- [ ] Monitor deprecation headers during transition
- [ ] Remove old endpoint references before removal date

---

**Need immediate assistance?** The old endpoints will continue to work until the removal date, but we strongly recommend migrating as soon as possible to take advantage of the performance improvements and new features.