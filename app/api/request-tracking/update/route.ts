import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { rateLimit } from '@/lib/rateLimit'

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