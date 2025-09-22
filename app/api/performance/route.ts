import { NextResponse } from 'next/server'
import { queryOptimizer, getQueryPerformanceReport } from '@/lib/database/query-optimizer'
import { requireAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'

export async function GET() {
  try {
    const authResult = await requireAuth()
    if (!isAuthSuccess(authResult)) {
      return authResult // Return the auth error response
    }

    // Get performance metrics
    const performanceReport = await getQueryPerformanceReport()

    // Add database performance metrics
    const dbMetrics = await getDatabaseMetrics()

    return NextResponse.json({
      success: true,
      data: {
        ...performanceReport,
        database: dbMetrics,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Performance monitoring error:', error)
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    )
  }
}

async function getDatabaseMetrics() {
  // This would typically connect to your database monitoring system
  // For now, return simulated metrics
  return {
    activeConnections: Math.floor(Math.random() * 50) + 10,
    avgQueryTime: Math.floor(Math.random() * 100) + 50,
    slowQueries: Math.floor(Math.random() * 5),
    cacheHitRate: Math.floor(Math.random() * 20) + 75,
    indexUsage: Math.floor(Math.random() * 10) + 85
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth()
    if (!isAuthSuccess(authResult)) {
      return authResult
    }

    const { action } = await request.json()

    switch (action) {
      case 'clear_cache':
        queryOptimizer.clearCache()
        return NextResponse.json({
          success: true,
          message: 'Query cache cleared'
        })

      case 'get_cache_stats':
        const cacheStats = queryOptimizer.getCacheStats()
        return NextResponse.json({
          success: true,
          data: cacheStats
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Performance action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}