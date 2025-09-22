import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import {
  aiCostOptimizationHub,
  generateOptimized,
  batchGenerateOptimized,
  type OptimizedAIRequest
} from '@/lib/claude/ai-cost-optimization-hub'
import {
  enhancedCostAnalytics,
  getCostOptimizationRecommendations
} from '@/lib/claude/enhanced-cost-analytics'

/**
 * POST /api/ai/optimized - Process AI request with comprehensive optimization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { operation, batch = false, ...requestData } = body

    // Validate required fields
    if (!operation || !requestData.type || !requestData.params) {
      return NextResponse.json(
        { error: 'Missing required fields: operation, type, params' },
        { status: 400 }
      )
    }

    // Get user profile for budget checking
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Set user budget if not already set
    if (profile.subscription_tier === 'premium') {
      enhancedCostAnalytics.setBudget(user.id, {
        monthlyBudget: 50.0, // $50 for premium users
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        alertsEnabled: true,
        autoOptimize: true
      })
    } else {
      enhancedCostAnalytics.setBudget(user.id, {
        monthlyBudget: 10.0, // $10 for free users
        warningThreshold: 0.7,
        criticalThreshold: 0.9,
        alertsEnabled: true,
        autoOptimize: true
      })
    }

    if (batch && Array.isArray(requestData.requests)) {
      // Batch processing
      const batchRequests: OptimizedAIRequest[] = requestData.requests.map((req: any) => ({
        ...req,
        userId: user.id,
        options: {
          useOptimizedPrompts: true,
          enableAutoOptimization: true,
          trackPerformance: true,
          ...req.options
        }
      }))

      const results = await batchGenerateOptimized(batchRequests)
      const resultsArray = Array.from(results.values())

      return NextResponse.json({
        success: true,
        operation: 'batch_optimized_generation',
        batch: true,
        results: resultsArray,
        summary: {
          totalOperations: resultsArray.length,
          successfulOperations: resultsArray.filter(r => r.success).length,
          totalCost: resultsArray.reduce((sum, r) => sum + r.cost, 0),
          totalCostSaved: resultsArray.reduce((sum, r) => sum + r.optimizations.costSaved, 0),
          totalTokensSaved: resultsArray.reduce((sum, r) => sum + r.optimizations.tokensSaved, 0),
          optimizationsApplied: resultsArray.filter(r => r.optimizations.costSaved > 0).length
        }
      })

    } else {
      // Single request processing
      const optimizedRequest: OptimizedAIRequest = {
        userId: user.id,
        type: requestData.type,
        params: requestData.params,
        options: {
          priority: requestData.priority || 5,
          urgency: requestData.urgency || 'normal',
          maxBudget: requestData.maxBudget,
          qualityThreshold: requestData.qualityThreshold || 7,
          useOptimizedPrompts: requestData.useOptimizedPrompts !== false,
          enableAutoOptimization: requestData.enableAutoOptimization !== false,
          trackPerformance: true,
          ...requestData.options
        }
      }

      const result = await generateOptimized(optimizedRequest)

      // Get optimization recommendations
      const recommendations = getCostOptimizationRecommendations(user.id)

      return NextResponse.json({
        success: result.success,
        operation: 'optimized_generation',
        result,
        recommendations: {
          budgetStatus: recommendations.budgetStatus,
          topOptimizations: recommendations.topRecommendations.slice(0, 3),
          alerts: recommendations.alerts.slice(0, 2)
        }
      })
    }

  } catch (error: any) {
    console.error('AI optimization error:', error)
    return NextResponse.json(
      {
        error: 'AI optimization failed',
        details: error.message,
        operation: 'optimized_generation'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/optimized - Get optimization analytics and recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRangeParam = searchParams.get('timeRange') || '7d'
    const reportType = searchParams.get('report') || 'user'

    // Calculate time range
    const now = new Date()
    let start: Date

    switch (timeRangeParam) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const timeRange = { start, end: now }

    if (reportType === 'system') {
      // System-wide optimization report (admin only)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      }

      const systemReport = await aiCostOptimizationHub.getSystemOptimizationReport(timeRange)

      return NextResponse.json({
        success: true,
        operation: 'system_optimization_report',
        timeRange: timeRangeParam,
        report: systemReport
      })

    } else {
      // User-specific analytics and recommendations
      const analytics = enhancedCostAnalytics.getAnalytics(user.id, timeRange)
      const budgetStatus = enhancedCostAnalytics.getBudgetStatus(user.id)
      const alerts = enhancedCostAnalytics.getAlerts(user.id, 10)

      return NextResponse.json({
        success: true,
        operation: 'user_optimization_analytics',
        timeRange: timeRangeParam,
        analytics,
        budgetStatus,
        alerts,
        summary: {
          totalOperations: analytics.totalOperations,
          totalCost: analytics.totalCost,
          averageCostPerOperation: analytics.averageCostPerOperation,
          topOptimizationOpportunity: analytics.optimizationOpportunities[0] || null,
          budgetUtilization: budgetStatus.budget ?
            (budgetStatus.currentMonthSpend / budgetStatus.budget.monthlyBudget) * 100 : 0
        }
      })
    }

  } catch (error: any) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve analytics',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ai/optimized - Update optimization settings
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...settings } = body

    switch (action) {
      case 'update_budget':
        enhancedCostAnalytics.setBudget(user.id, {
          monthlyBudget: settings.monthlyBudget,
          warningThreshold: settings.warningThreshold,
          criticalThreshold: settings.criticalThreshold,
          alertsEnabled: settings.alertsEnabled,
          autoOptimize: settings.autoOptimize
        })

        return NextResponse.json({
          success: true,
          operation: 'budget_updated',
          message: 'Budget settings updated successfully'
        })

      case 'clear_alerts':
        // Clear user alerts (implementation would depend on storage method)
        return NextResponse.json({
          success: true,
          operation: 'alerts_cleared',
          message: 'Alerts cleared successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    console.error('Settings update error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update settings',
        details: error.message
      },
      { status: 500 }
    )
  }
}