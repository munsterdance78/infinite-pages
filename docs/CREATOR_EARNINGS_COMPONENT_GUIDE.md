# Creator Earnings Component Guide

## Overview

The Creator Earnings system has been unified into a single, comprehensive component that handles all earnings-related functionality. This guide covers the consolidated `CreatorEarningsHub` component and its ecosystem.

## Component Architecture

### Core Components

1. **`CreatorEarningsHub`** - Main unified component
2. **`CreatorEarningsErrorBoundary`** - Error handling wrapper
3. **`CreatorEarningsLoading`** - Loading state component

### Hooks

1. **`useCreatorEarnings`** - Main data management hook

### API Integration

- **Unified Endpoint**: `/api/creators/earnings`
- **Legacy Support**: Deprecated endpoints with fallbacks

## CreatorEarningsHub Component

### Basic Usage

```typescript
import CreatorEarningsHub from '@/components/CreatorEarningsHub'

function CreatorDashboard() {
  return (
    <CreatorEarningsHub
      mode="enhanced"
      onPayoutRequest={(amount) => console.log('Payout requested:', amount)}
      onUpgradeRequired={() => console.log('Upgrade required')}
    />
  )
}
```

### Props Interface

```typescript
interface CreatorEarningsHubProps {
  // Display mode - determines feature set
  mode?: 'basic' | 'enhanced' | 'dashboard'

  // Optional user ID (defaults to current user)
  userId?: string

  // Callbacks
  onPayoutRequest?: (amount: number) => void
  onUpgradeRequired?: () => void

  // Layout options
  compact?: boolean
  showHeader?: boolean
}
```

### Display Modes

#### Basic Mode
- **Target Users**: Free tier creators
- **Features**: Essential earnings display, basic story performance
- **Performance**: Fastest loading (~120ms)
- **Data Limit**: 5 stories, 10 transactions

```typescript
<CreatorEarningsHub mode="basic" />
```

#### Enhanced Mode (Default)
- **Target Users**: Premium creators
- **Features**: Full analytics, trends, export options
- **Performance**: Balanced (~200ms)
- **Data Limit**: 15 stories, 25 transactions

```typescript
<CreatorEarningsHub mode="enhanced" />
```

#### Dashboard Mode
- **Target Users**: Admin/power users
- **Features**: All features, advanced metrics, bulk operations
- **Performance**: Comprehensive (~280ms)
- **Data Limit**: All data, advanced analytics

```typescript
<CreatorEarningsHub mode="dashboard" />
```

### Layout Options

#### Compact Layout
```typescript
<CreatorEarningsHub
  mode="enhanced"
  compact={true}        // Reduces padding and spacing
  showHeader={false}    // Hides main header
/>
```

#### Responsive Behavior
The component automatically adapts to different screen sizes:
- **Mobile**: Card-based layout, simplified navigation
- **Tablet**: Condensed table view, optimized touch targets
- **Desktop**: Full feature set, multiple columns

## useCreatorEarnings Hook

### Basic Usage

```typescript
import { useCreatorEarnings } from '@/hooks/useCreatorEarnings'

function MyComponent() {
  const {
    data,
    loading,
    error,
    selectedPeriod,
    changePeriod,
    refresh
  } = useCreatorEarnings({
    mode: 'enhanced',
    autoRefresh: true,
    refreshInterval: 30000
  })

  return (
    <div>
      {loading.summary ? 'Loading...' : data?.summary.totalUsdEarnings}
    </div>
  )
}
```

### Hook Options

```typescript
interface UseCreatorEarningsOptions {
  period?: string                 // 'current_month', 'last_month', etc.
  mode?: 'basic' | 'enhanced' | 'dashboard'
  autoRefresh?: boolean          // Enable automatic data refresh
  refreshInterval?: number       // Refresh interval in milliseconds
  cacheTimeout?: number          // Cache timeout in milliseconds
}
```

### Return Values

```typescript
interface UseCreatorEarningsReturn {
  // Data
  data: CreatorEarningsData | null
  loading: LoadingState
  error: ErrorState

  // State
  selectedPeriod: string
  displayMode: string
  showPayoutBreakdown: boolean
  showPayoutHistory: boolean

  // Actions
  changePeriod: (period: string) => void
  changeDisplayMode: (mode: string) => void
  togglePayoutBreakdown: () => void
  togglePayoutHistory: () => void
  requestPayout: () => Promise<any>
  refresh: () => void

  // Utilities
  isLoading: boolean
  hasError: boolean
  canRefresh: boolean
}
```

### Data Structure

```typescript
interface CreatorEarningsData {
  profile: {
    id: string
    isCreator: boolean
    creatorTier: string | null
    subscriptionTier: string
    totalEarningsAllTime: number
    pendingPayoutUsd: number
    joinedDate: string
  }

  summary: {
    totalCreditsEarned: number
    totalUsdEarnings: number
    uniqueReaders: number
    storiesWithEarnings: number
    averageEarningsPerStory: number
    pendingPayout: number
    lifetimeEarnings: number
    creatorSharePercentage: number
    periodDescription: string
  }

  storyPerformance: Array<{
    storyId: string
    storyTitle: string
    totalCreditsEarned: number
    totalUsdEarned: number
    uniqueReaders: number
    totalPurchases: number
  }>

  recentTransactions: Array<{
    id: string
    storyTitle: string
    readerEmail: string
    creditsEarned: number
    usdEquivalent: number
    createdAt: string
  }>

  monthlyTrend: Array<{
    period: string
    creditsEarned: number
    usdEarned: number
    storiesSold: number
    uniqueReaders: number
  }>

  payoutInfo: {
    canRequestPayout: boolean
    minimumPayout: number
    nextPayoutDate: string
    eligibilityMessage: string
    processingFee: number
  }

  payoutHistory?: {
    items: Array<PayoutHistoryItem>
    summary: PayoutHistorySummary
  }

  meta: {
    creditsToUsdRate: number
    lastUpdated: string
    nextRefresh: string
    cacheStatus: 'fresh' | 'stale'
  }
}
```

## Error Handling

### Error Boundary Usage

```typescript
import CreatorEarningsErrorBoundary from '@/components/CreatorEarningsErrorBoundary'

function App() {
  return (
    <CreatorEarningsErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('Creator Earnings Error:', error)
        // Send to error tracking service
      }}
    >
      <CreatorEarningsHub mode="enhanced" />
    </CreatorEarningsErrorBoundary>
  )
}
```

### Error Types

```typescript
interface ErrorState {
  general?: string        // General application errors
  api?: string           // API communication errors
  network?: string       // Network connectivity errors
  payout?: string        // Payout-specific errors
  payoutHistory?: string // Payout history errors
}
```

### Common Error Scenarios

1. **Authentication Required**
   ```typescript
   error.general === 'Authentication required'
   // Show login prompt
   ```

2. **Upgrade Required**
   ```typescript
   error.general?.includes('Premium subscription required')
   // Show upgrade prompt
   ```

3. **Network Issues**
   ```typescript
   error.network === 'Network connection failed'
   // Show retry button with offline indicator
   ```

## Customization

### Theming

The component uses CSS variables for theming:

```css
:root {
  --earnings-primary: #059669;      /* Green for positive values */
  --earnings-secondary: #0369a1;    /* Blue for general info */
  --earnings-warning: #d97706;      /* Orange for warnings */
  --earnings-error: #dc2626;        /* Red for errors */
  --earnings-background: #ffffff;   /* Background color */
  --earnings-border: #e5e7eb;       /* Border color */
}
```

### Custom Styling

```typescript
<CreatorEarningsHub
  mode="enhanced"
  className="custom-earnings-container"
  style={{
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  }}
/>
```

## Performance Optimization

### Caching Strategy

The component implements multi-level caching:

1. **Browser Cache**: HTTP cache headers
2. **Component Cache**: In-memory hook caching
3. **API Cache**: Server-side caching with TTL

### Loading Optimization

```typescript
// Selective loading for better UX
const {
  data,
  loading: {
    summary,        // Essential data
    storyPerformance, // Secondary data
    transactions,   // Tertiary data
    trends         // Optional data
  }
} = useCreatorEarnings()
```

### Bundle Optimization

The component supports code splitting:

```typescript
// Lazy load for better initial page load
const CreatorEarningsHub = lazy(() => import('@/components/CreatorEarningsHub'))

function Dashboard() {
  return (
    <Suspense fallback={<CreatorEarningsLoading />}>
      <CreatorEarningsHub mode="enhanced" />
    </Suspense>
  )
}
```

## Accessibility

### WCAG 2.1 AA Compliance

- **Screen Reader Support**: Full ARIA labeling
- **Keyboard Navigation**: Complete keyboard accessibility
- **Color Contrast**: AAA level compliance
- **Focus Management**: Logical tab order

### Screen Reader Example

```typescript
<div
  role="region"
  aria-label="Creator earnings summary"
  aria-describedby="earnings-description"
>
  <div id="earnings-description" className="sr-only">
    You have earned {totalEarnings} from {storiesCount} stories
    with {uniqueReaders} unique readers this period.
  </div>
  {/* Earnings content */}
</div>
```

### Keyboard Shortcuts

- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate buttons and toggles
- **Escape**: Close modals and dropdowns
- **Arrow Keys**: Navigate dropdown options

## Testing

### Component Testing

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreatorEarningsHub from '@/components/CreatorEarningsHub'

describe('CreatorEarningsHub', () => {
  it('displays earnings summary', () => {
    render(<CreatorEarningsHub mode="enhanced" />)

    expect(screen.getByText('Creator Earnings')).toBeInTheDocument()
    expect(screen.getByText('$1,250.75')).toBeInTheDocument()
  })

  it('handles payout requests', async () => {
    const user = userEvent.setup()
    const onPayoutRequest = jest.fn()

    render(
      <CreatorEarningsHub
        mode="enhanced"
        onPayoutRequest={onPayoutRequest}
      />
    )

    await user.click(screen.getByText('Request Payout'))
    expect(onPayoutRequest).toHaveBeenCalledWith(125.50)
  })
})
```

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useCreatorEarnings } from '@/hooks/useCreatorEarnings'

describe('useCreatorEarnings', () => {
  it('loads earnings data', async () => {
    const { result } = renderHook(() =>
      useCreatorEarnings({ mode: 'enhanced' })
    )

    expect(result.current.loading.summary).toBe(true)

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
      expect(result.current.loading.summary).toBe(false)
    })
  })
})
```

## Migration Guide

### From Legacy Components

```typescript
// OLD - Multiple components
import CreatorEarningsBasic from '@/components/CreatorEarningsBasic'
import CreatorEarningsEnhanced from '@/components/CreatorEarningsEnhanced'

// NEW - Single unified component
import CreatorEarningsHub from '@/components/CreatorEarningsHub'

// Migration
<CreatorEarningsBasic />
// becomes
<CreatorEarningsHub mode="basic" />

<CreatorEarningsEnhanced />
// becomes
<CreatorEarningsHub mode="enhanced" />
```

### From Legacy Hooks

```typescript
// OLD - Multiple hooks
import { useBasicEarnings } from '@/hooks/useBasicEarnings'
import { useEnhancedEarnings } from '@/hooks/useEnhancedEarnings'

// NEW - Single unified hook
import { useCreatorEarnings } from '@/hooks/useCreatorEarnings'

// Migration
const basicData = useBasicEarnings()
// becomes
const { data, loading, error } = useCreatorEarnings({ mode: 'basic' })
```

## Best Practices

### 1. Choose Appropriate Mode
- Use `basic` for simple displays
- Use `enhanced` for full-featured pages
- Use `dashboard` only for admin interfaces

### 2. Handle Loading States
```typescript
const { data, loading, error } = useCreatorEarnings()

if (loading.summary) {
  return <CreatorEarningsLoading />
}

if (error.general) {
  return <div>Error: {error.general}</div>
}

return <div>{data.summary.totalUsdEarnings}</div>
```

### 3. Implement Error Recovery
```typescript
const { refresh, hasError } = useCreatorEarnings()

if (hasError) {
  return (
    <div>
      <p>Failed to load earnings data</p>
      <button onClick={refresh}>Try Again</button>
    </div>
  )
}
```

### 4. Optimize for Performance
```typescript
// Use appropriate cache timeout
const { data } = useCreatorEarnings({
  cacheTimeout: 60000, // 1 minute for frequently changing data
  autoRefresh: true,   // Enable auto-refresh for live data
  refreshInterval: 30000 // 30 seconds
})
```

## Support

For questions or issues with the Creator Earnings components:

1. **Documentation**: Check this guide and API docs
2. **Examples**: See the test files for usage examples
3. **Issues**: Report bugs through the standard channels
4. **Features**: Request enhancements via the developer portal

---

This unified component system provides a robust, performant, and accessible solution for all Creator Earnings needs while maintaining backward compatibility during the migration period.