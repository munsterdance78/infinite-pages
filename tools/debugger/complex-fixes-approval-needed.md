# Complex Fixes Requiring Approval - Infinite Pages

## Current Status
- **Site Status**: DOWN (SSL/TLS connection failed)
- **Primary Issue**: Website completely unreachable
- **API Endpoints**: All returning chrome-error URLs

---

## 🚨 CRITICAL FIXES (Require Immediate Approval)

### 1. Claude API Integration Failure
**Risk**: Critical | **Type**: claude_api_error
**Impact**: Story creation completely broken

**Fix Required**:
```javascript
// 1. Check environment variable in .env.local:
ANTHROPIC_API_KEY=sk-ant-api03-...your-key...

// 2. Add error handling to Claude service:
try {
  const response = await claudeService.generateStoryFoundation(params);
  return response;
} catch (error) {
  console.error('Claude API Error:', error);

  if (error.status === 503) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await claudeService.generateStoryFoundation(params);
  }

  throw new Error(`Story generation failed: ${error.message}`);
}

// 3. Update API route error responses:
return NextResponse.json({
  error: 'Story generation temporarily unavailable',
  details: 'Please try again in a moment',
  fallback: 'Use story templates while AI is recovering'
}, { status: 503 });
```

### 2. Missing Story Endpoints
**Risk**: Critical | **Type**: story_endpoint_404
**Impact**: Novel and AI-assisted story creation broken

**Missing Endpoints**:
- `/api/stories/novel` (GET, POST)
- `/api/stories/ai-assisted` (GET, POST)

**Fix Required**:
```javascript
// Create app/api/stories/novel/route.ts:
import { NextResponse, NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.success) return authResult;

  const body = await request.json();
  const { title, genre, premise, chapterCount = 10 } = body;

  const novel = await createNovelWithChapters({
    title, genre, premise, chapterCount
  });

  return NextResponse.json({ novel }, { status: 201 });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ novels: [] });
}

// Create app/api/stories/ai-assisted/route.ts:
export async function POST(request: NextRequest) {
  const collaboration = await startAICollaboration(body);
  return NextResponse.json({ collaboration }, { status: 201 });
}

// Deploy: git add . && git commit -m "Add missing story endpoints" && git push
```

---

## 🔥 HIGH PRIORITY FIXES

### 3. Demo Story 500 Errors
**Risk**: High | **Type**: demo_story_500_error
**Impact**: Users can't try the platform

**Fix Required**:
```javascript
// Update app/api/demo/story/route.ts:
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.genre || !body.premise) {
      return NextResponse.json({
        error: 'Missing required fields: genre and premise'
      }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const canProceed = await checkDemoRateLimit(ip);
    if (!canProceed) {
      return NextResponse.json({
        error: 'Demo rate limit exceeded. Try again in 5 minutes.'
      }, { status: 429 });
    }

    let story;
    try {
      story = await generateDemoStory(body);
    } catch (aiError) {
      story = getDemoStoryTemplate(body.genre);
      console.warn('Demo AI failed, using template:', aiError);
    }

    return NextResponse.json({ story }, { status: 201 });

  } catch (error) {
    console.error('Demo story error:', error);
    return NextResponse.json({
      error: 'Demo story creation failed',
      message: 'Please try a simpler premise or try again later'
    }, { status: 500 });
  }
}
```

### 4. Supabase Authentication Errors
**Risk**: High | **Type**: supabase_auth_error
**Impact**: User login/signup broken

**Fix Required**:
```javascript
// Verify environment variables in .env.local:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

// Fix auth middleware in lib/auth/middleware.ts:
export async function requireAuth(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Auth session error:', error);
      return NextResponse.json({
        error: 'Authentication failed',
        details: 'Please log in again'
      }, { status: 401 });
    }

    if (!session?.user) {
      return NextResponse.json({
        error: 'Authentication required',
        loginUrl: '/auth/login'
      }, { status: 401 });
    }

    return { success: true, user: session.user, supabase };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json({
      error: 'Authentication system error'
    }, { status: 500 });
  }
}
```

---

## ⚠️ MEDIUM PRIORITY FIXES

### 5. Admin Endpoint Authorization
**Risk**: Medium | **Type**: admin_endpoint_unauthorized
**Impact**: Admin functionality inaccessible

**Fix Required**:
```javascript
// Add admin check middleware:
export async function requireAdmin(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.success) return authResult;

  const { user, supabase } = authResult;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (error || !profile?.is_admin) {
    return NextResponse.json({
      error: 'Admin access required',
      message: 'This endpoint requires administrator privileges'
    }, { status: 403 });
  }

  return { success: true, user, supabase, isAdmin: true };
}
```

### 6. Rate Limiting Too Aggressive
**Risk**: Medium | **Type**: rate_limiting_too_aggressive
**Impact**: Legitimate users blocked

**Fix Required**:
```javascript
// Update middleware.ts rate limits:
const ROUTE_RATE_LIMITS = {
  '/api/stories': {
    requests: 10, // Increased from 5
    window: 60000, // 1 minute
    subscription_multiplier: { pro: 3, premium: 5 }
  },
  '/api/stories/guest': {
    requests: 3, // For unauthenticated users
    window: 300000 // 5 minutes
  },
  '/api/demo/story': {
    requests: 5, // More lenient for demos
    window: 600000 // 10 minutes
  }
};

// Add monitoring bypass:
const monitoringPaths = [
  '/api/admin/request-flow/health',
  '/api/health',
  '/api/admin/request-flow/stats'
];

if (monitoringPaths.includes(pathname)) {
  return res; // Skip rate limiting
}
```

### 7. CORS Configuration Issues
**Risk**: Medium | **Type**: cors_error
**Impact**: API requests from automation tools failing

**Fix Required**:
```javascript
// Update CORS configuration in middleware.ts:
const corsOptions = {
  origin: [
    'https://www.infinite-pages.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'null' // For headless browsers
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

// Apply to all API routes:
res.headers.set('Access-Control-Allow-Origin', origin || '*');
res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.headers.set('Access-Control-Allow-Credentials', 'false');
```

---

## 🛠️ MANUAL INTERVENTION REQUIRED

### Critical Infrastructure Issues
1. **Environment Variables Missing** - Requires Vercel dashboard access
2. **Database Migration Needed** - Requires database admin access
3. **Vercel Deployment Config** - Requires deployment settings access
4. **Stripe Payment Integration** - Requires Stripe dashboard access

---

## Deployment Checklist

- [ ] Fix SSL/TLS certificate issues
- [ ] Verify Vercel deployment status
- [ ] Check environment variables in Vercel dashboard
- [ ] Run database migrations if needed
- [ ] Deploy missing API endpoints
- [ ] Test Claude API integration
- [ ] Verify Supabase configuration
- [ ] Update CORS settings
- [ ] Adjust rate limiting rules
- [ ] Apply safe accessibility fixes

## Next Steps
1. **Immediate**: Fix SSL/TLS and get site accessible
2. **Critical**: Deploy missing story endpoints
3. **High**: Fix Claude API and authentication
4. **Medium**: Update rate limiting and CORS
5. **Safety**: Apply accessibility fixes from safe-fixes.js