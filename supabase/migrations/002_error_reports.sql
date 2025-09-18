import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { ERROR_MESSAGES } from '@/lib/constants'

// Error severity levels
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
type ErrorCategory = 
  | 'javascript_error'
  | 'api_error'
  | 'authentication_error'
  | 'payment_error'
  | 'ai_generation_error'
  | 'database_error'
  | 'validation_error'
  | 'rate_limit_error'
  | 'security_violation'
  | 'performance_issue'
  | 'user_reported'
  | 'unhandled_rejection'
  | 'network_error'
  | 'unknown';

// Error source types
type ErrorSource = 'client' | 'server' | 'middleware' | 'external';

interface ErrorReport {
  // Basic error information
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  source: ErrorSource;
  
  // Context information
  timestamp: string;
  url: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  
  // Technical details
  component?: string;
  operation?: string;
  apiEndpoint?: string;
  statusCode?: number;
  
  // User context
  userTier?: 'free' | 'pro';
  deviceInfo?: {
    platform?: string;
    browser?: string;
    version?: string;
    mobile?: boolean;
  };
  
  // Additional metadata
  tags?: string[];
  customData?: Record<string, any>;
  
  // Performance data
  responseTime?: number;
  memoryUsage?: number;
  
  // Error frequency tracking
  fingerprint?: string;
  occurredAt?: string;
}

interface ProcessedError extends ErrorReport {
  id: string;
  processed_at: string;
  reported_by?: 'system' | 'user' | 'monitor';
  duplicate_count?: number;
  related_errors?: string[];
  resolution_status?: 'open' | 'investigating' | 'resolved' | 'ignored';
  priority_score?: number;
}

// Rate limiting for error reports to prevent spam
const ERROR_REPORT_LIMITS = {
  client_errors: { limit: 10, window: 60000 }, // 10 per minute
  server_errors: { limit: 5, window: 60000 },  // 5 per minute  
  security_violations: { limit: 3, window: 300000 } // 3 per 5 minutes
};

// Error fingerprinting for deduplication
function generateErrorFingerprint(error: ErrorReport): string {
  const components = [
    error.message?.replace(/\d+/g, 'N'), // Replace numbers with N
    error.stack?.split('\n')[0]?.replace(/:\d+:\d+/g, ':N:N'), // Normalize line numbers
    error.component,
    error.apiEndpoint,
    error.category
  ].filter(Boolean);
  
  return Buffer.from(components.join('|')).toString('base64').slice(0, 32);
}

// Determine error severity based on various factors
function calculateErrorSeverity(error: ErrorReport): ErrorSeverity {
  // Critical errors that require immediate attention
  if (
    error.category === 'security_violation' ||
    error.category === 'payment_error' ||
    (error.category === 'database_error' && error.statusCode === 500) ||
    error.message.toLowerCase().includes('crash') ||
    error.message.toLowerCase().includes('segfault')
  ) {
    return 'critical';
  }
  
  // High severity errors that impact user experience significantly
  if (
    error.category === 'authentication_error' ||
    error.category === 'ai_generation_error' ||
    error.statusCode === 500 ||
    error.statusCode === 503 ||
    error.responseTime && error.responseTime > 10000
  ) {
    return 'high';
  }
  
  // Medium severity errors that should be addressed but aren't critical
  if (
    error.category === 'api_error' ||
    error.category === 'validation_error' ||
    error.statusCode === 400 ||
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.responseTime && error.responseTime > 5000
  ) {
    return 'medium';
  }
  
  // Low severity errors for monitoring and improvement
  return 'low';
}

// Calculate priority score for error triage
function calculatePriorityScore(error: ErrorReport): number {
  let score = 0;
  
  // Severity multiplier
  const severityMultipliers = { critical: 100, high: 50, medium: 20, low: 5 };
  score += severityMultipliers[error.severity];
  
  // User tier multiplier (pro users get higher priority)
  if (error.userTier === 'pro') score *= 1.5;
  
  // API endpoint criticality
  if (error.apiEndpoint?.includes('/api/stories')) score += 20;
  if (error.apiEndpoint?.includes('/api/auth')) score += 30;
  if (error.apiEndpoint?.includes('/api/billing')) score += 40;
  
  // Error frequency (would be calculated from database)
  // For now, just add base frequency score
  score += 10;
  
  return Math.round(score);
}

// Validate and sanitize error report
function validateErrorReport(data: any): { isValid: boolean; errors: string[]; sanitized?: ErrorReport } {
  const errors: string[] = [];
  
  // Required fields validation
  if (!data.message || typeof data.message !== 'string') {
    errors.push('Message is required and must be a string');
  }
  
  if (!data.category || !isValidCategory(data.category)) {
    errors.push('Valid category is required');
  }
  
  if (!data.source || !['client', 'server', 'middleware', 'external'].includes(data.source)) {
    errors.push('Valid source is required');
  }
  
  if (!data.url || typeof data.url !== 'string') {
    errors.push('URL is required');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Sanitize and structure the error report
  const sanitized: ErrorReport = {
    message: sanitizeString(data.message),
    stack: data.stack ? sanitizeString(data.stack) : undefined,
    category: data.category,
    severity: data.severity || calculateErrorSeverity(data),
    source: data.source,
    timestamp: data.timestamp || new Date().toISOString(),
    url: sanitizeString(data.url),
    userAgent: data.userAgent ? sanitizeString(data.userAgent) : undefined,
    userId: data.userId ? sanitizeString(data.userId) : undefined,
    sessionId: data.sessionId ? sanitizeString(data.sessionId) : undefined,
    requestId: data.requestId ? sanitizeString(data.requestId) : undefined,
    component: data.component ? sanitizeString(data.component) : undefined,
    operation: data.operation ? sanitizeString(data.operation) : undefined,
    apiEndpoint: data.apiEndpoint ? sanitizeString(data.apiEndpoint) : undefined,
    statusCode: typeof data.statusCode === 'number' ? data.statusCode : undefined,
    userTier: data.userTier === 'pro' ? 'pro' : 'free',
    deviceInfo: data.deviceInfo && typeof data.deviceInfo === 'object' ? {
      platform: data.deviceInfo.platform ? sanitizeString(data.deviceInfo.platform) : undefined,
      browser: data.deviceInfo.browser ? sanitizeString(data.deviceInfo.browser) : undefined,
      version: data.deviceInfo.version ? sanitizeString(data.deviceInfo.version) : undefined,
      mobile: typeof data.deviceInfo.mobile === 'boolean' ? data.deviceInfo.mobile : undefined
    } : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(tag => sanitizeString(tag)).slice(0, 10) : undefined,
    customData: data.customData && typeof data.customData === 'object' ? 
      Object.fromEntries(
        Object.entries(data.customData)
          .slice(0, 20) // Limit number of custom fields
          .map(([key, value]) => [sanitizeString(key), sanitizeValue(value)])
      ) : undefined,
    responseTime: typeof data.responseTime === 'number' ? Math.max(0, data.responseTime) : undefined,
    memoryUsage: typeof data.memoryUsage === 'number' ? Math.max(0, data.memoryUsage) : undefined
  };
  
  // Generate fingerprint for deduplication
  sanitized.fingerprint = generateErrorFingerprint(sanitized);
  
  return { isValid: true, errors: [], sanitized };
}

function isValidCategory(category: string): category is ErrorCategory {
  const validCategories: ErrorCategory[] = [
    'javascript_error', 'api_error', 'authentication_error', 'payment_error',
    'ai_generation_error', 'database_error', 'validation_error', 'rate_limit_error',
    'security_violation', 'performance_issue', 'user_reported', 'unhandled_rejection',
    'network_error', 'unknown'
  ];
  return validCategories.includes(category as ErrorCategory);
}

function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, 10000) // Limit length
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}

function sanitizeValue(value: any): any {
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return null;
  return String(value).slice(0, 1000); // Convert complex types to string and limit
}

// Store error in database
async function storeError(error: ErrorReport, supabase: any): Promise<string> {
  const processedError: ProcessedError = {
    ...error,
    id: crypto.randomUUID(),
    processed_at: new Date().toISOString(),
    reported_by: 'system',
    priority_score: calculatePriorityScore(error)
  };
  
  try {
    // Check for recent duplicates based on fingerprint
    const { data: existingErrors } = await supabase
      .from('error_reports')
      .select('id, duplicate_count')
      .eq('fingerprint', error.fingerprint)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .limit(1);
    
    if (existingErrors && existingErrors.length > 0) {
      // Update duplicate count instead of creating new record
      const existingError = existingErrors[0];
      await supabase
        .from('error_reports')
        .update({ 
          duplicate_count: (existingError.duplicate_count || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingError.id);
      
      return existingError.id;
    }
    
    // Create new error record
    const { data, error: insertError } = await supabase
      .from('error_reports')
      .insert(processedError)
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Failed to store error report:', insertError);
      throw insertError;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error storing error report:', error);
    throw error;
  }
}

// Send alerts for critical errors
async function sendErrorAlert(error: ErrorReport): Promise<void> {
  if (error.severity !== 'critical') return;
  
  try {
    // In production, this would integrate with alerting services like:
    // - PagerDuty, Slack, Discord
    // - Email notifications
    // - SMS alerts for critical issues
    
    const alertData = {
      title: `Critical Error: ${error.category}`,
      message: error.message,
      severity: error.severity,
      url: error.url,
      timestamp: error.timestamp,
      component: error.component,
      userId: error.userId,
      fingerprint: error.fingerprint
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 CRITICAL ERROR ALERT:', alertData);
    }
    
    // Example webhook call (uncomment and configure in production)
    // if (process.env.SLACK_WEBHOOK_URL) {
    //   await fetch(process.env.SLACK_WEBHOOK_URL, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       text: `🚨 Critical Error: ${error.message}`,
    //       blocks: [
    //         {
    //           type: 'section',
    //           text: { type: 'mrkdwn', text: `*Error:* ${error.message}` }
    //         },
    //         {
    //           type: 'section',
    //           fields: [
    //             { type: 'mrkdwn', text: `*Category:* ${error.category}` },
    //             { type: 'mrkdwn', text: `*URL:* ${error.url}` },
    //             { type: 'mrkdwn', text: `*Component:* ${error.component || 'Unknown'}` },
    //             { type: 'mrkdwn', text: `*User:* ${error.userId || 'Anonymous'}` }
    //           ]
    //         }
    //       ]
    //     })
    //   });
    // }
    
  } catch (alertError) {
    console.error('Failed to send error alert:', alertError);
  }
}

// Main POST handler for error reports
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting to prevent spam
    const rateLimitResult = await rateLimit(request, 'API_GENERAL');
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        details: ['Request body must be valid JSON']
      }, { status: 400 });
    }
    
    // Validate error report
    const validation = validateErrorReport(requestBody);
    if (!validation.isValid) {
      return NextResponse.json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        details: validation.errors
      }, { status: 400 });
    }
    
    const errorReport = validation.sanitized!;
    
    // Add request context
    errorReport.userAgent = request.headers.get('user-agent') || undefined;
    errorReport.requestId = request.headers.get('x-request-id') || undefined;
    
    // Get user context if available
    if (request.headers.get('authorization')) {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          errorReport.userId = user.id;
          
          // Get subscription tier
          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();
          
          errorReport.userTier = profile?.subscription_tier || 'free';
        }
      } catch (authError) {
        // Continue without user context if auth fails
        console.warn('Failed to get user context for error report:', authError);
      }
    }
    
    // Store error in database
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    let errorId: string;
    try {
      errorId = await storeError(errorReport, supabase);
    } catch (storeError) {
      console.error('Failed to store error, logging to console:', storeError);
      console.error('Original error report:', errorReport);
      
      // Return success even if storage fails to prevent infinite loops
      return NextResponse.json({
        success: true,
        message: 'Error report received (storage failed)',
        id: 'console-' + Date.now()
      });
    }
    
    // Send alerts for critical errors
    if (errorReport.severity === 'critical') {
      await sendErrorAlert(errorReport);
    }
    
    // Log structured error for monitoring
    console.error('Error report processed:', {
      id: errorId,
      category: errorReport.category,
      severity: errorReport.severity,
      fingerprint: errorReport.fingerprint,
      message: errorReport.message,
      url: errorReport.url,
      userId: errorReport.userId
    });
    
    // Add rate limit headers to response
    const response = NextResponse.json({
      success: true,
      message: 'Error report processed successfully',
      id: errorId
    });
    
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (handlerError) {
    console.error('Error in error reporting handler:', handlerError);
    
    // Return minimal error response to prevent recursive error reporting
    return NextResponse.json({
      error: 'Failed to process error report',
      message: 'Internal server error in error handler'
    }, { status: 500 });
  }
}

// GET handler for retrieving error statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('range') || '24h';
    const category = url.searchParams.get('category');
    const severity = url.searchParams.get('severity');
    
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, 'API_GENERAL');
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }
    
    // Get user context and check admin permissions
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 });
    }
    
    // Check if user is admin (you'd implement your own admin check)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();
    
    // Simple admin check - in production, use proper role-based access
    const isAdmin = profile?.email?.endsWith('@yourcompany.com') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    // Calculate time range
    const timeRanges = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const rangeMs = timeRanges[timeRange as keyof typeof timeRanges] || timeRanges['24h'];
    const since = new Date(Date.now() - rangeMs).toISOString();
    
    // Build query
    let query = supabase
      .from('error_reports')
      .select('*')
      .gte('created_at', since);
    
    if (category) query = query.eq('category', category);
    if (severity) query = query.eq('severity', severity);
    
    const { data: errors, error: fetchError } = await query.order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Failed to fetch error reports:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch error reports' }, { status: 500 });
    }
    
    // Generate statistics
    const stats = {
      total: errors?.length || 0,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recentErrors: errors?.slice(0, 10) || [],
      topFingerprints: {} as Record<string, number>
    };
    
    errors?.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.topFingerprints[error.fingerprint] = (stats.topFingerprints[error.fingerprint] || 0) + 1;
    });
    
    const response = NextResponse.json({
      success: true,
      timeRange,
      statistics: stats
    });
    
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (error) {
    console.error('Error in GET /api/errors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}