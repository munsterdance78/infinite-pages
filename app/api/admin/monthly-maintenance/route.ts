import { NextResponse, type NextRequest } from 'next/server'
import { requireAdminAuth } from '@/lib/auth/middleware'
import { isAuthSuccess } from '@/lib/auth/utils'

// Monthly maintenance endpoint to handle automated tasks
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    const body = await request.json()
    const { tasks = ['distribute_credits', 'revert_excess_credits'], dryRun = false } = body

    console.log('Starting monthly maintenance tasks:', tasks)

    const results: {
      creditDistribution: any
      creditReversion: any
      errors: string[]
    } = {
      creditDistribution: null,
      creditReversion: null,
      errors: []
    }

    // Execute credit distribution if requested
    if (tasks.includes('distribute_credits')) {
      try {
        const distributionResponse = await fetch(`${request.nextUrl.origin}/api/admin/distribute-credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({ dryRun })
        })

        if (distributionResponse.ok) {
          results.creditDistribution = await distributionResponse.json()
        } else {
          const error = await distributionResponse.text()
          results.errors.push(`Credit distribution failed: ${error}`)
        }
      } catch (error) {
        results.errors.push(`Credit distribution error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Execute credit reversion if requested
    if (tasks.includes('revert_excess_credits')) {
      try {
        const reversionResponse = await fetch(`${request.nextUrl.origin}/api/admin/revert-excess-credits`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({ dryRun })
        })

        if (reversionResponse.ok) {
          results.creditReversion = await reversionResponse.json()
        } else {
          const error = await reversionResponse.text()
          results.errors.push(`Credit reversion failed: ${error}`)
        }
      } catch (error) {
        results.errors.push(`Credit reversion error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Log maintenance execution
    const maintenanceLog = {
      executed_at: new Date().toISOString(),
      tasks_requested: tasks,
      dry_run: dryRun,
      results: {
        success: results.errors.length === 0,
        error_count: results.errors.length,
        credit_distribution_users: results.creditDistribution?.summary?.totalUsersProcessed || 0,
        credit_reversion_users: results.creditReversion?.summary?.totalUsersProcessed || 0,
        total_credits_distributed: results.creditDistribution?.summary?.totalCreditsDistributed || 0,
        total_credits_reverted: results.creditReversion?.summary?.totalCreditsReverted || 0
      },
      errors: results.errors
    }

    // Record maintenance execution in database
    if (!dryRun) {
      const { error: logError } = await supabase
        .from('system_logs')
        .insert({
          log_type: 'monthly_maintenance',
          message: `Monthly maintenance executed with ${results.errors.length} errors`,
          metadata: maintenanceLog,
          created_at: new Date().toISOString()
        })

      if (logError) {
        console.error('Failed to log maintenance execution:', logError)
        results.errors.push('Failed to log maintenance execution')
      }
    }

    console.log('Monthly maintenance complete:', maintenanceLog)

    return NextResponse.json({
      success: results.errors.length === 0,
      message: dryRun
        ? 'Monthly maintenance dry run completed'
        : `Monthly maintenance completed with ${results.errors.length} errors`,
      results,
      maintenanceLog
    })

  } catch (error) {
    console.error('Monthly maintenance endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to execute monthly maintenance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get maintenance history
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request)
    if (!isAuthSuccess(authResult)) return authResult
    const { user, supabase } = authResult

    // Get recent maintenance logs
    const { data: maintenanceLogs } = await supabase
      .from('system_logs')
      .select('*')
      .eq('log_type', 'monthly_maintenance')
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      maintenanceHistory: maintenanceLogs || [],
      summary: {
        totalExecutions: maintenanceLogs?.length || 0,
        lastExecution: maintenanceLogs?.[0]?.created_at || null,
        successfulExecutions: maintenanceLogs?.filter(log =>
          log.metadata?.results?.success === true
        ).length || 0
      }
    })

  } catch (error) {
    console.error('Maintenance history endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance history' }, { status: 500 })
  }
}