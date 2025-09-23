# Infinite Pages System Architecture Diagram

## Frontend-Backend Integration Map

### Core Writing Workflows Data Flow

```mermaid
graph TB
    subgraph "Frontend Components"
        USC[UnifiedStoryCreator]
        SA[Story Analytics]
        CB[Chapter Builder]
        CR[Story Reader]
        CC[Cache Controller]
    end

    subgraph "API Layer"
        API_S[/api/stories]
        API_C[/api/stories/[id]/chapters]
        API_AI[/api/ai/optimized]
        API_CA[/api/cache/analytics]
        API_D[/api/dashboard]
    end

    subgraph "Services Layer"
        CS[Claude Service]
        IPC[Infinite Pages Cache]
        ACO[AI Cost Optimization Hub]
        ABC[Advanced Batch Processor]
    end

    subgraph "External APIs"
        CLAUDE[Claude AI API]
        STRIPE[Stripe API]
    end

    subgraph "Database"
        DB_P[profiles]
        DB_S[stories]
        DB_C[chapters]
        DB_GL[generation_logs]
        DB_CACHE[cache_entries]
    end

    %% Story Creation Flow
    USC -->|1. Create Story| API_S
    API_S -->|2. Generate Foundation| CS
    CS -->|3. Cache Check| IPC
    IPC -->|4. Cache Miss| CLAUDE
    CLAUDE -->|5. AI Response| CS
    CS -->|6. Store Result| DB_S
    DB_S -->|7. Update Tokens| DB_P
    API_S -->|8. Response + Metrics| USC

    %% Chapter Generation Flow
    USC -->|1. Generate Chapter| API_C
    API_C -->|2. Get Context| DB_S
    API_C -->|3. Generate Chapter| CS
    CS -->|4. Optimized Request| ACO
    ACO -->|5. Batch Process| ABC
    ABC -->|6. Claude API| CLAUDE
    CLAUDE -->|7. Chapter Content| CS
    CS -->|8. Store Chapter| DB_C
    DB_C -->|9. Update Stats| DB_S
    API_C -->|10. Chapter + Metrics| USC

    %% Analytics Flow
    SA -->|1. Get Analytics| API_CA
    API_CA -->|2. Cache Metrics| IPC
    IPC -->|3. Performance Data| API_CA
    API_CA -->|4. Analytics Response| SA

    %% Dashboard Flow
    USC -->|1. Load Dashboard| API_D
    API_D -->|2. Get Profile| DB_P
    API_D -->|3. Get Stories| DB_S
    API_D -->|4. Get Activity| DB_GL
    API_D -->|5. Dashboard Data| USC
```

## Component-API Mapping

### 1. Story Creation Workflow

#### Frontend: UnifiedStoryCreator Component
**Location**: `components/UnifiedStoryCreator.tsx`

**Key Functions**:
- `handleCreateStory()` - Main story creation orchestrator
- `generateStoryContent()` - Content generation trigger
- `validateForm()` - Input validation

**Data Flow**:
```
User Input → Form Validation → Supabase Insert → API Call → UI Update
```

**Backend APIs Used**:
- `POST /api/stories` - Create story foundation
- `POST /api/stories/[id]/chapters` - Generate chapters

#### Backend: Story Creation API
**Location**: `app/api/stories/route.ts`

**Process Flow**:
```
1. Authentication Check (requireAuth)
2. Input Validation & Content Moderation
3. Cache Check (InfinitePagesCache.wrapFoundationGeneration)
4. Claude AI Generation (claudeService.generateStoryFoundation)
5. Database Storage (stories table)
6. Token Accounting (profiles table)
7. Activity Logging (generation_logs table)
8. Response with metrics
```

**Request Format**:
```json
{
  "title": "string",
  "genre": "string",
  "premise": "string"
}
```

**Response Format**:
```json
{
  "story": "Story object",
  "tokensUsed": "number",
  "tokensSaved": "number",
  "fromCache": "boolean",
  "cacheType": "string",
  "remainingTokens": "number",
  "message": "string"
}
```

### 2. Chapter Generation Workflow

#### Frontend: Chapter Generation Trigger
**Location**: `components/UnifiedStoryCreator.tsx:generateStoryContent()`

**Data Flow**:
```
Story ID → Context Retrieval → API Call → Progress Updates → UI Refresh
```

#### Backend: Chapter Generation API
**Location**: `app/api/stories/[id]/chapters/route.ts`

**Process Flow**:
```
1. Authentication & Ownership Verification
2. Story Context Retrieval (existing chapters)
3. Cache Check (chapter fingerprint)
4. AI Generation with Context Optimization (70% token reduction)
5. Chapter Storage & Story Stats Update
6. User Profile Token Update
7. Response with chapter + metrics
```

**Request Format**:
```json
{
  "chapter_number": "number",
  "title": "string"
}
```

**Response Format**:
```json
{
  "chapter": "Chapter object",
  "tokensUsed": "number",
  "tokensSaved": "number",
  "fromCache": "boolean",
  "cacheType": "string",
  "remainingTokens": "number",
  "message": "string"
}
```

### 3. Analytics & Monitoring Workflow

#### Frontend: UnifiedAnalyticsDashboard
**Location**: `components/UnifiedAnalyticsDashboard.tsx`

**Data Flow**:
```
Component Mount → Parallel API Calls → Data Aggregation → Chart Rendering
```

**API Calls**:
```javascript
Promise.allSettled([
  fetch(`/api/cache/analytics?period=${timeRange}`),
  fetch(`/api/dashboard?period=${timeRange}`),
  fetch(`/api/ai-usage/track?period=${timeRange}`)
])
```

#### Backend: Analytics APIs
**Cache Analytics**: `app/api/cache/analytics/route.ts`
**Dashboard Data**: `app/api/dashboard/route.ts`
**AI Usage Tracking**: `app/api/ai-usage/track/route.ts`

### 4. Caching System Architecture

#### Multi-Layer Caching Strategy

**Layer 1: Foundation Caching (80% cost reduction)**
- Genre-based matching
- Premise similarity analysis
- Template reuse
- Cache hit rates tracked

**Layer 2: Chapter Caching (60% cost reduction)**
- Context fingerprinting
- Dependency tracking
- Cache invalidation rules
- Performance metrics

**Layer 3: Response Caching**
- HTTP-level caching
- Dashboard data (30-second cache)
- User-specific cache keys

#### Cache Service Integration
**Location**: `lib/claude/infinitePagesCache.ts`

**Key Functions**:
- `wrapFoundationGeneration()` - Foundation caching wrapper
- `wrapChapterGeneration()` - Chapter caching wrapper
- `getCacheAnalytics()` - Performance metrics

### 5. Cost Optimization System

#### AI Cost Optimization Hub
**Location**: `lib/claude/ai-cost-optimization-hub.ts`

**Features**:
- Batch processing for efficiency
- Quality threshold management
- Budget monitoring & alerts
- Automatic optimization recommendations

**Integration Points**:
- Chapter generation optimization
- Batch request processing
- Cost tracking & reporting
- Budget enforcement

## Database Schema Integration

### Core Tables & Relationships

```sql
-- User Profiles & Authentication
profiles {
  id: uuid (PK)
  email: text
  subscription_tier: enum
  tokens_remaining: integer
  tokens_used_total: integer
  tokens_saved_cache: integer
  stories_created: integer
  words_generated: integer
}

-- Story Management
stories {
  id: uuid (PK)
  user_id: uuid (FK -> profiles.id)
  title: text
  genre: text
  premise: text
  type: enum (story|novel|choice-book|ai-builder)
  status: enum (draft|creating|completed|published)
  foundation: jsonb
  total_tokens_used: integer
  total_cost_usd: decimal
  word_count: integer
  chapter_count: integer
  created_at: timestamp
  updated_at: timestamp
}

-- Chapter Content
chapters {
  id: uuid (PK)
  story_id: uuid (FK -> stories.id)
  chapter_number: integer
  title: text
  content: text
  word_count: integer
  generation_cost_usd: decimal
  created_at: timestamp
}

-- Activity Tracking
generation_logs {
  id: uuid (PK)
  user_id: uuid (FK -> profiles.id)
  story_id: uuid (FK -> stories.id)
  operation_type: enum
  tokens_used: integer
  cost_usd: decimal
  from_cache: boolean
  cache_type: text
  created_at: timestamp
}

-- Cache Management
cache_entries {
  id: uuid (PK)
  cache_key: text
  content_hash: text
  cached_data: jsonb
  hit_count: integer
  last_accessed: timestamp
  created_at: timestamp
}
```

## Error Handling & Security

### Authentication Flow
```
1. Supabase Authentication Check
2. Session Validation
3. User Profile Verification
4. Permission Checking
5. Rate Limiting Application
```

### Error Handling Patterns
- Input validation with custom schemas
- Content moderation & pattern detection
- AI generation failure recovery
- Database transaction rollback
- Comprehensive error logging

### Security Measures
- Content moderation for all user inputs
- Prompt injection protection
- Rate limiting by subscription tier
- CORS handling across endpoints
- Secure token management

## Performance Optimizations

### Caching Strategies
- **Foundation Caching**: 80% cost reduction via genre/premise matching
- **Chapter Caching**: 60% cost reduction via context fingerprinting
- **Response Caching**: HTTP-level caching for dashboard data
- **Token Optimization**: Context reduction techniques

### Database Optimizations
- Indexed queries for story retrieval
- Batch operations for analytics
- Connection pooling
- Query optimization for large datasets

### AI Request Optimization
- Batch processing for multiple requests
- Context window optimization
- Quality vs. cost threshold management
- Automatic retry mechanisms

## Monitoring & Analytics

### Key Metrics Tracked
- Token usage per operation
- Cache hit rates by content type
- Cost savings from optimization
- User engagement patterns
- System performance metrics

### Real-time Monitoring
- Budget alerts and thresholds
- System health dashboards
- Error rate monitoring
- Performance bottleneck detection

This architecture demonstrates a sophisticated AI-powered writing platform with advanced cost optimization, comprehensive caching, and robust security measures, designed for scalability with clear separation of concerns and strong data consistency patterns.