import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIdentifier, logRateLimitViolation } from '@/lib/rateLimit'
import { ERROR_MESSAGES } from '@/lib/constants'

// Security headers configuration
const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()'
  ].join(', '),
  // Strict Transport Security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  // Cross-Origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
}

// Rate limit configurations for different route patterns
const ROUTE_RATE_LIMITS = {
  '/api/stories': { operation: 'STORY_CREATION' as const, requiresAuth: true },
  '/api/stories/[id]/chapters': { operation: 'CHAPTER_GENERATION' as const, requiresAuth: true },
  '/api/stories/[id]/export': { operation: 'EXPORT' as const, requiresAuth: true },
  '/api/auth': { operation: 'AUTH_ATTEMPT' as const, requiresAuth: false },
  '/api': { operation: 'API_GENERAL' as const, requiresAuth: false }
}

// Suspicious patterns that warrant additional monitoring
const SUSPICIOUS_PATTERNS = {
  // SQL injection attempts
  SQL_INJECTION: [
    /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
    /(\bdrop\b.*\btable\b)|(\btable\b.*\bdrop\b)/i,
    /'\s*(or|and)\s*'?\d+/i,
    /;\s*(drop|delete|update|insert)\b/i
  ],
  // XSS attempts
  XSS: [
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i
  ],
  // Path traversal
  PATH_TRAVERSAL: [
    /\.\.\/\.\.\//,
    /\.\.\\\.\.\\/, 
    /%2e%2e%2f/i,
    /%2e%2e%5c/i
  ],
  // Command injection
  COMMAND_INJECTION: [
    /[;&|`$(){}[\]]/,
    /\b(cat|ls|pwd|whoami|id|uname)\b/i
  ]
}

// Bot detection patterns
const BOT_PATTERNS = [
  /bot|crawler|spider|scraper/i,
  /curl|wget|postman/i,
  /python-requests|golang|java/i
]

interface SecurityThreat {
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  shouldBlock: boolean;
}

function detectSecurityThreats(request: NextRequest): SecurityThreat[] {
  const threats: SecurityThreat[] = []
  const url = request.nextUrl.pathname + request.nextUrl.search
  const userAgent = request.headers.get('user-agent') || ''
  const contentType = request.headers.get('content-type') || ''

  // Check for SQL injection in URL
  for (const pattern of SUSPICIOUS_PATTERNS.SQL_INJECTION) {
    if (pattern.test(url)) {
      threats.push({
        type: 'sql_injection',
        severity: 'high',
        details: 'SQL injection pattern detected in URL',
        shouldBlock: true
      })
    }
  }

  // Check for XSS in URL
  for (const pattern of SUSPICIOUS_PATTERNS.XSS) {
    if (pattern.test(url)) {
      threats.push({
        type: 'xss_attempt',
        severity: 'high',
        details: 'XSS pattern detected in URL',
        shouldBlock: true
      })
    }
  }

  // Check for path traversal
  for (const pattern of SUSPICIOUS_PATTERNS.PATH_TRAVERSAL) {
    if (pattern.test(url)) {
      threats.push({
        type: 'path_traversal',
        severity: 'medium',
        details: 'Path traversal pattern detected',
        shouldBlock: true
      })
    }
  }

  // Check for suspicious user agents
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      threats.push({
        type: 'suspicious_bot',
        severity: 'low',
        details: `Suspicious user agent: ${userAgent}`,
        shouldBlock: false
      })
    }
  }

  // Check for unusual content types on API routes
  if (url.startsWith('/api/') && request.method === 'POST') {
    if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
      threats.push({
        type: 'unusual_content_type',
        severity: 'medium',
        details: `Unusual content type: ${contentType}`,
        shouldBlock: false
      })
    }
  }

  // Check for excessively long URLs (potential buffer overflow)
  if (url.length > 2048) {
    threats.push({
      type: 'excessive_url_length',
      severity: 'medium',
      details: `URL length: ${url.length} characters`,
      shouldBlock: true
    })
  }

  // Check for too many parameters (potential DoS)
  const searchParams = request.nextUrl.searchParams
  if (Array.from(searchParams.keys()).length > 50) {
    threats.push({
      type: 'excessive_parameters',
      severity: 'medium',
      details: `Too many URL parameters: ${Array.from(searchParams.keys()).length}`,
      shouldBlock: true
    })
  }

  return threats
}

function getRouteRateLimit(pathname: string): { operation: string; requiresAuth: boolean } | null {
  // Check for exact matches first
  if (ROUTE_RATE_LIMITS[pathname as keyof typeof ROUTE_RATE_LIMITS]) {
    return ROUTE_RATE_LIMITS[pathname as keyof typeof ROUTE_RATE_LIMITS]
  }

  // Check for pattern matches
  if (pathname.match(/^\/api\/stories\/[^\/]+\/chapters$/)) {
    return ROUTE_RATE_LIMITS['/api/stories/[id]/chapters']
  }
  
  if (pathname.match(/^\/api\/stories\/[^\/]+\/export$/)) {
    return ROUTE_RATE_LIMITS['/api/stories/[id]/export']
  }
  
  if (pathname.startsWith('/api/stories') && pathname !== '/api/stories') {
    return ROUTE_RATE_LIMITS['/api/stories']
  }
  
  if (pathname.startsWith('/api/auth/')) {
    return ROUTE_RATE_LIMITS['/api/auth']
  }
  
  if (pathname.startsWith('/api/')) {
    return ROUTE_RATE_LIMITS['/api']
  }

  return null
}

function createSecurityResponse(threat: SecurityThreat, request: NextRequest): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Security violation detected',
      type: threat.type,
      message: 'Your request has been blocked due to security concerns.'
    },
    { status: 403 }
  )

  // Add security headers to blocked response
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Log security violation
  logSecurityViolation(threat, request)

  return response
}

function logSecurityViolation(threat: SecurityThreat, request: NextRequest): void {
  const logData = {
    timestamp: new Date().toISOString(),
    type: threat.type,
    severity: threat.severity,
    details: threat.details,
    ip: getClientIdentifier(request).replace('ip:', ''),
    userAgent: request.headers.get('user-agent'),
    url: request.nextUrl.pathname + request.nextUrl.search,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries())
  }

  console.warn('Security violation detected:', logData)

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to security service
    // fetch('/api/security/violations', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(logData)
    // }).catch(console.error)
  }
}

async function getUserSubscriptionTier(userId: string): Promise<'free' | 'pro'> {
  try {
    // Check if required environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Middleware] Supabase environment variables not available, defaulting to free tier')
      return 'free'
    }

    // This would typically be cached in Redis/memory for performance
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier`, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return data[0]?.subscription_tier || 'free'
    }
  } catch (error) {
    console.error('Failed to fetch subscription tier:', error)
  }
  
  return 'free' // Default to free tier on error
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.headers.set(key, value)
  })

  // Add performance and monitoring headers
  res.headers.set('X-Request-ID', crypto.randomUUID())
  res.headers.set('X-Timestamp', Date.now().toString())

  // Skip middleware for static files and internal Next.js routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return res
  }

  // Security threat detection
  const threats = detectSecurityThreats(req)
  const blockingThreats = threats.filter(t => t.shouldBlock)
  
  if (blockingThreats.length > 0) {
    return createSecurityResponse(blockingThreats[0], req)
  }

  // Log non-blocking threats for monitoring
  threats.filter(t => !t.shouldBlock).forEach(threat => {
    logSecurityViolation(threat, req)
  })

  // Handle authentication for protected routes
  if (pathname.startsWith('/dashboard')) {
    const supabase = createMiddlewareClient({ req, res })
    
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Add user context to response headers for downstream use
    res.headers.set('X-User-ID', user.id)
  }

  // API route protection and rate limiting
  if (pathname.startsWith('/api/')) {
    const routeConfig = getRouteRateLimit(pathname)

    // Check authentication for protected API routes
    if (routeConfig?.requiresAuth && !pathname.startsWith('/api/auth/') && !pathname.includes('/webhook')) {
      const supabase = createMiddlewareClient({ req, res })
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
      }

      // Apply subscription-aware rate limiting for authenticated routes
      if (routeConfig) {
        const subscriptionTier = await getUserSubscriptionTier(user.id)
        
        // Apply rate limiting with subscription awareness
        const rateLimitResult = await rateLimit(req, routeConfig.operation as any, user.id)
        
        if (!rateLimitResult.success) {
          logRateLimitViolation(`user:${user.id}`, routeConfig.operation as any, req)
          return rateLimitResult.response!
        }

        // Add rate limit headers to successful requests
        Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
          res.headers.set(key, value)
        })
      }

      // Add user context for downstream API routes
      res.headers.set('X-User-ID', user.id)
      res.headers.set('X-User-Tier', await getUserSubscriptionTier(user.id))
    } else if (routeConfig && !routeConfig.requiresAuth) {
      // Apply general rate limiting for non-authenticated routes
      const rateLimitResult = await rateLimit(req, routeConfig.operation as any)
      
      if (!rateLimitResult.success) {
        logRateLimitViolation(getClientIdentifier(req), routeConfig.operation as any, req)
        return rateLimitResult.response!
      }

      // Add rate limit headers
      Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
        res.headers.set(key, value)
      })
    }
  }

  // Add request timing for performance monitoring
  const startTime = Date.now()
  res.headers.set('X-Request-Start', startTime.toString())

  // Add CORS headers for API routes if needed
  if (pathname.startsWith('/api/')) {
    // Only allow specific origins in production
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_SITE_URL || ''] 
      : ['http://localhost:3000']
    
    const origin = req.headers.get('origin')
    if (origin && allowedOrigins.includes(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin)
    }
    
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.headers.set('Access-Control-Max-Age', '86400')
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: res.headers })
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}