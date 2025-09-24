import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { rateLimit } from '@/lib/rateLimit'

// Rate limiting for request tracking logs
const REQUEST_LOG_RATE_LIMIT = {
  limit: 100, // 100 logs per minute per user
  window: 60000
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 'API_GENERAL')
    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Parse request body
    let requestLog
    try {
      requestLog = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    const requiredFields = [
      'requestId',
      'sessionId',
      'frontendAction',
      'frontendComponent',
      'apiEndpoint',
      'httpMethod',
      'responseStatus',
      'successFlag',
      'integrationPoint'
    ]

    const missingFields = requiredFields.filter(field => !requestLog[field] && requestLog[field] !== 0 && requestLog[field] !== false)
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missingFields },
        { status: 400 }
      )
    }

    // Insert request log into database
    const { error: insertError } = await supabase
      .from('request_logs')
      .insert({
        request_id: requestLog.requestId,
        session_id: requestLog.sessionId,
        user_id: requestLog.userId,
        frontend_action: requestLog.frontendAction,
        frontend_component: requestLog.frontendComponent,
        frontend_page: requestLog.frontendPage,
        api_endpoint: requestLog.apiEndpoint,
        expected_endpoint: requestLog.expectedEndpoint,
        http_method: requestLog.httpMethod,
        request_headers: requestLog.requestHeaders,
        request_body_size: requestLog.requestBodySize,
        response_status: requestLog.responseStatus,
        response_headers: requestLog.responseHeaders,
        response_body_size: requestLog.responseBodySize,
        response_time_ms: requestLog.responseTimeMs,
        success_flag: requestLog.successFlag,
        error_message: requestLog.errorMessage,
        error_category: requestLog.errorCategory,
        integration_point: requestLog.integrationPoint,
        expected_integration: requestLog.expectedIntegration,
        integration_success: requestLog.integrationSuccess,
        user_tier: requestLog.userTier,
        device_info: requestLog.deviceInfo,
        queue_time_ms: requestLog.queueTimeMs,
        processing_time_ms: requestLog.processingTimeMs,
        total_time_ms: requestLog.totalTimeMs,
        custom_data: requestLog.customData,
        created_at: requestLog.createdAt
      })

    if (insertError) {
      console.error('Error inserting request log:', insertError)
      return NextResponse.json(
        { error: 'Failed to store request log' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Request log stored successfully'
    })

  } catch (error) {
    console.error('Request tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, 'API_GENERAL')
    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Parse request body
    let updateData
    try {
      updateData = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { requestId, updates } = updateData

    if (!requestId) {
      return NextResponse.json(
        { error: 'Missing requestId' },
        { status: 400 }
      )
    }

    // Update request log
    const { error: updateError } = await supabase
      .from('request_logs')
      .update({
        integration_success: updates.integrationSuccess,
        custom_data: updates.customData,
        // Add other updatable fields as needed
      })
      .eq('request_id', requestId)

    if (updateError) {
      console.error('Error updating request log:', updateError)
      return NextResponse.json(
        { error: 'Failed to update request log' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Request log updated successfully'
    })

  } catch (error) {
    console.error('Request tracking update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}