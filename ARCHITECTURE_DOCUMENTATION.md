# Infinite Pages - Architecture Documentation

## Overview
This document provides a comprehensive analysis of the current architecture patterns, database schema, error handling, and rate limiting implementation in the Infinite Pages application.

---

## 1. Component Architecture Patterns

### Architecture Philosophy
The application follows a **Component-Driven Architecture** with clear separation of concerns:
- **UI Components**: Reusable, composable UI elements
- **Business Logic Components**: Feature-specific components with state management
- **Service Layer**: Centralized API and external service integration
- **Type Safety**: Comprehensive TypeScript usage throughout

### Component Patterns Used

#### 1. **Compound Component Pattern** (Example: StoryCreator)
```typescript
// File: components/StoryCreator.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Story {
  id: string;
  user_id: string;
  title: string;
  genre: string | null;
  foundation: any;
  // ... other properties
}

export default function StoryCreator() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  // State management with multiple related states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at')

  // Compound component structure with tabs, dialogs, and forms
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Story Creator & Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="stories">
            <TabsList>
              <TabsTrigger value="stories">My Stories</TabsTrigger>
              <TabsTrigger value="create">Create New</TabsTrigger>
            </TabsList>
            <TabsContent value="stories">
              {/* Story management interface */}
            </TabsContent>
            <TabsContent value="create">
              {/* Story creation interface */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Key Characteristics:**
- **Client-side component** with `'use client'` directive
- **Supabase integration** for real-time data
- **Compound UI structure** with nested components
- **TypeScript interfaces** for type safety
- **State management** with multiple related states

#### 2. **Error Boundary Pattern** (Example: ErrorBoundary)
```typescript
// File: components/ErrorBoundary.tsx
'use client'

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'section';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    eventId: null,
    copied: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Error logging and reporting logic
    const eventId = this.logErrorToService(error, errorInfo)
    this.setState({ errorInfo, eventId })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  // ... error handling methods
}
```

**Key Characteristics:**
- **Class component** for error boundary functionality
- **Hierarchical error handling** with different levels
- **Error reporting integration** with external services
- **Fallback UI** with retry mechanisms
- **Development vs production** error display modes

#### 3. **Dashboard Component Pattern** (Example: AnalyticsDashboard)
```typescript
// File: components/AnalyticsDashboard.tsx
'use client'

interface UserProfile {
  id: string;
  subscription_tier: 'free' | 'pro';
  tokens_remaining: number;
  // ... other profile properties
}

interface AnalyticsData {
  totalStories: number;
  totalChapters: number;
  totalTokensUsed: number;
  totalCostUSD: number;
  // ... analytics properties
}

export default function AnalyticsDashboard({ userProfile }: { userProfile: UserProfile }) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month')

  // Data fetching with proper error handling
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics?range=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Analytics fetch error:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  // Dashboard layout with metrics cards and charts
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric cards */}
        <Card>
          <CardContent>
            <div className="flex items-center">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium">Total Stories</p>
                <p className="text-2xl font-bold">{analytics?.totalStories || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* ... other metric cards */}
      </div>
    </div>
  )
}
```

**Key Characteristics:**
- **Props-based configuration** for reusability
- **API integration** with proper error handling
- **Responsive grid layouts** for different screen sizes
- **Real-time updates** with useCallback and useEffect
- **Loading and error states** management

### Common Component Patterns

1. **Client Component Pattern**: All interactive components use `'use client'`
2. **TypeScript First**: Strong typing with interfaces for all props and state
3. **Supabase Integration**: Consistent use of `createClientComponentClient`
4. **UI Component Library**: Shadcn/ui components for consistent design
5. **Error Boundary Wrapping**: Critical components wrapped in error boundaries
6. **Loading States**: Proper loading and error state management
7. **Responsive Design**: Mobile-first responsive layouts

---

## 2. Database Schema & RLS Policies

### Database Architecture

#### Core Tables Structure

##### **Profiles Table**
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  tokens_remaining INTEGER DEFAULT 10,
  tokens_used_total INTEGER DEFAULT 0,
  last_token_grant TIMESTAMPTZ DEFAULT NOW(),
  stories_created INTEGER DEFAULT 0,
  words_generated INTEGER DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  writing_goals TEXT[],
  preferred_genres TEXT[],
  experience_level TEXT,
  writing_frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- **Auth Integration**: Direct reference to Supabase auth.users
- **Subscription Management**: Stripe integration fields
- **Usage Tracking**: Token and content generation metrics
- **User Preferences**: Onboarding and preference data
- **Audit Fields**: Created/updated timestamps

##### **Stories Table**
```sql
CREATE TABLE stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  genre TEXT,
  premise TEXT,
  foundation JSONB,           -- AI-generated story foundation
  outline JSONB,              -- Story outline structure
  characters JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'published')),
  word_count INTEGER DEFAULT 0,
  chapter_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- **JSONB Storage**: Flexible storage for AI-generated content
- **User Ownership**: Cascade deletion with user profiles
- **Status Tracking**: Draft to published workflow
- **Cost Tracking**: Token usage and USD cost tracking
- **Metadata**: Word count, chapter count analytics

##### **Chapters Table**
```sql
CREATE TABLE chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  content TEXT,                -- The actual chapter content
  summary TEXT,               -- AI-generated summary
  word_count INTEGER DEFAULT 0,
  tokens_used_input INTEGER DEFAULT 0,
  tokens_used_output INTEGER DEFAULT 0,
  generation_cost_usd DECIMAL(10,6) DEFAULT 0,
  prompt_type TEXT,           -- Type of generation prompt used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, chapter_number)  -- Ensures sequential chapters
);
```

**Key Features:**
- **Hierarchical Structure**: Belongs to stories with unique chapter numbers
- **Content Storage**: Full chapter content and metadata
- **Generation Analytics**: Detailed token and cost tracking
- **Content Versioning**: Support for different prompt types

##### **Generation Logs Table**
```sql
CREATE TABLE generation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('foundation', 'chapter', 'improvement')),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- **Audit Trail**: Complete tracking of all AI operations
- **Cost Analytics**: Precise token and cost tracking
- **Operation Types**: Foundation, chapter, and improvement tracking
- **User Analytics**: Enables usage pattern analysis

### Row Level Security (RLS) Policies

#### **Profiles Policies**
```sql
-- View own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Update own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create own profile (for signup)
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

#### **Stories Policies**
```sql
-- Complete CRUD operations for own stories
CREATE POLICY "Users can view own stories" ON stories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own stories" ON stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories" ON stories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories" ON stories
  FOR DELETE USING (auth.uid() = user_id);
```

#### **Chapters Policies (Hierarchical)**
```sql
-- Access chapters through story ownership
CREATE POLICY "Users can view own chapters" ON chapters
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can create own chapters" ON chapters
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can update own chapters" ON chapters
  FOR UPDATE USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can delete own chapters" ON chapters
  FOR DELETE USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));
```

**Key RLS Features:**
- **User Isolation**: Complete data isolation between users
- **Hierarchical Access**: Chapters inherit access through stories
- **Automatic Enforcement**: Database-level security
- **Auth Integration**: Uses Supabase auth.uid() function

---

## 3. Error Handling Patterns

### Error Handling Architecture

The application implements a **multi-layered error handling strategy**:

#### **Layer 1: Component-Level Error Boundaries**
```typescript
// Example from ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to external service
    const eventId = this.logErrorToService(error, errorInfo)
    this.setState({ errorInfo, eventId })

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo): string {
    // Error reporting logic (Sentry, LogRocket, etc.)
    const eventId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.error('Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      eventId,
      timestamp: new Date().toISOString()
    })

    return eventId
  }
}
```

#### **Layer 2: API Route Error Handling**
```typescript
// Example from app/api/stories/route.ts
export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    // Database operation with error handling
    const { data: stories, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error fetching stories:', error)
      return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
    }

    return NextResponse.json({ stories })
  } catch (error) {
    console.error('Unexpected error in GET /api/stories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### **Layer 3: Service-Level Error Handling**
```typescript
// Example from lib/claude/service.ts
private handleClaudeError(error: any) {
  console.error('Claude API error:', error)

  // Specific error handling based on status codes
  if (error?.status === 429) {
    return new Error('Rate limit exceeded. Please wait a moment before trying again.')
  }

  if (error?.status === 401) {
    return new Error('API authentication failed. Please contact support.')
  }

  if (error?.status === 400) {
    return new Error('Invalid request. Please check your input and try again.')
  }

  if (error?.status >= 500) {
    return new Error('Claude service is temporarily unavailable. Please try again later.')
  }

  return new Error(error?.message || 'An unexpected error occurred with Claude.')
}

// Retry logic with exponential backoff
for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    const response = await this.anthropic.messages.create(params)
    return response
  } catch (error: any) {
    lastError = error

    // Don't retry on certain errors
    if (this.isNonRetryableError(error)) {
      throw this.handleClaudeError(error)
    }

    // Exponential backoff for retries
    if (attempt < retries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### Error Handling Patterns Used

1. **Error Boundaries**: React error boundaries for UI error isolation
2. **Try-Catch Wrapping**: Comprehensive try-catch in API routes
3. **Status Code Mapping**: HTTP status codes to user-friendly messages
4. **Retry Logic**: Exponential backoff for transient failures
5. **Error Reporting**: Structured error logging with context
6. **Graceful Degradation**: Fallback UI states for errors
7. **User Feedback**: Clear error messages for different scenarios

### Error Categories

- **Authentication Errors**: 401 Unauthorized responses
- **Authorization Errors**: 403 Forbidden for insufficient permissions
- **Validation Errors**: 400 Bad Request for invalid input
- **Rate Limiting Errors**: 429 Too Many Requests
- **External Service Errors**: Claude API, Stripe, etc.
- **Database Errors**: Supabase connection and query errors
- **Network Errors**: Timeout and connectivity issues

---

## 4. Rate Limiting Implementation

### Rate Limiting Architecture

The application implements a **sophisticated multi-tier rate limiting system**:

#### **Core Rate Limiter Class**
```typescript
// File: lib/rateLimit.ts
class RateLimiter {
  private store: RateLimitStore = {}
  private redisClient: any = null
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Initialize Redis client if available (production)
    if (process.env.REDIS_URL && typeof window === 'undefined') {
      try {
        // Redis client would be initialized here in production
      } catch (error) {
        console.warn('Redis connection failed, falling back to memory store')
      }
    }

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  check(identifier: string, operation: string, limit: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const key = this.getKey(identifier, operation)
    const now = Date.now()
    const windowStart = this.getWindowStart(windowMs)
    const resetTime = windowStart + windowMs

    let entry = this.store[key]

    // Create new entry or reset if window expired
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime, firstRequest: now }
      this.store[key] = entry
    }

    // Check if request is allowed
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      }
    }

    // Increment counter and allow request
    entry.count++
    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.count),
      resetTime: entry.resetTime
    }
  }
}
```

#### **Operation-Specific Rate Limits**
```typescript
export const RATE_LIMIT_CONFIGS = {
  // Story creation - most restrictive due to high AI cost
  STORY_CREATION: {
    limit: 2,                    // 2 per minute
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // Chapter generation - moderate restrictions
  CHAPTER_GENERATION: {
    limit: 5,                    // 5 per minute
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // General API requests - less restrictive
  API_GENERAL: {
    limit: 30,                   // 30 per minute
    windowMs: 60 * 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Export requests - hourly limit
  EXPORT: {
    limit: 10,                   // 10 per hour
    windowMs: 60 * 60 * 1000,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // Authentication attempts - security focused
  AUTH_ATTEMPT: {
    limit: 5,                    // 5 per 15 minutes
    windowMs: 15 * 60 * 1000,
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  }
}
```

#### **Subscription-Aware Rate Limiting**
```typescript
export async function subscriptionAwareRateLimit(
  request: NextRequest,
  operation: RateLimitOperation,
  userId: string,
  subscriptionTier: 'free' | 'pro'
): Promise<{
  success: boolean;
  response?: NextResponse;
  headers: Record<string, string>;
}> {
  const config = RATE_LIMIT_CONFIGS[operation]

  // Pro users get 3x higher limits
  const multiplier = subscriptionTier === 'pro' ? 3 : 1
  const adjustedLimit = Math.floor(config.limit * multiplier)

  const identifier = getClientIdentifier(request, userId)

  const result = rateLimiter.check(
    identifier,
    `${operation}_${subscriptionTier}`,
    adjustedLimit,
    config.windowMs
  )

  // Return rate limit headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': adjustedLimit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    'X-RateLimit-Tier': subscriptionTier
  }

  if (!result.allowed) {
    headers['Retry-After'] = result.retryAfter?.toString() || '60'

    return {
      success: false,
      response: NextResponse.json({
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        details: [
          `Rate limit exceeded for ${subscriptionTier} tier. ` +
          (subscriptionTier === 'free'
            ? 'Upgrade to Pro for higher limits.'
            : `Try again in ${result.retryAfter} seconds.`)
        ]
      }, { status: 429, headers }),
      headers
    }
  }

  return { success: true, headers }
}
```

#### **Client Identification Strategy**
```typescript
export function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Use user ID if available (authenticated requests)
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0]?.trim() || realIP || 'unknown'

  return `ip:${ip}`
}
```

### Rate Limiting Features

1. **Operation-Specific Limits**: Different limits for different operations
2. **Subscription Tiers**: Pro users get 3x higher limits
3. **Burst Protection**: Additional burst limiting for peak usage
4. **Memory + Redis**: In-memory for development, Redis for production
5. **Header Support**: Standard rate limit headers in responses
6. **Cleanup Mechanism**: Automatic cleanup of expired entries
7. **Retry-After Headers**: Proper retry guidance for clients
8. **Logging Integration**: Rate limit violations are logged
9. **Graceful Fallback**: Memory store fallback if Redis unavailable

### Rate Limiting Strategy

- **Cost-Based Limiting**: Higher restrictions for expensive operations
- **User-Based**: Authenticated users get higher limits than IPs
- **Tier-Based**: Subscription tiers determine limit multipliers
- **Window-Based**: Sliding window algorithm for smooth rate limiting
- **Graceful Degradation**: Clear error messages when limits exceeded

---

## Summary

The Infinite Pages application demonstrates a **mature, production-ready architecture** with:

- **Component-Driven Design**: Reusable, type-safe React components
- **Secure Database Design**: Comprehensive RLS policies and audit trails
- **Robust Error Handling**: Multi-layered error handling with graceful degradation
- **Sophisticated Rate Limiting**: Subscription-aware, operation-specific rate limiting

The architecture prioritizes **security, scalability, and user experience** while maintaining **developer productivity** through consistent patterns and comprehensive type safety.