import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      )
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)

      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
            onboarding_complete: false
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json(
            { error: 'Failed to create profile', code: 'PROFILE_CREATE_ERROR', details: createError },
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }

        return NextResponse.json(
          { profile: newProfile, created: true },
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch profile', code: 'PROFILE_FETCH_ERROR', details: profileError },
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch token balance data
    const maxBalance = profile.subscription_tier === 'pro' ? 100 : 10
    const monthStart = new Date()
    monthStart.setDate(1)

    const { data: monthlyUsage } = await supabase
      .from('generation_logs')
      .select('tokens_input, tokens_output')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    const usageThisMonth = monthlyUsage?.reduce((sum, log) =>
      sum + (log.tokens_input || 0) + (log.tokens_output || 0), 0) || 0

    const projectedUsage = usageThisMonth * (30 / new Date().getDate())
    const efficiency = profile.words_generated > 0 ? profile.words_generated / profile.tokens_used_total : 0

    const tokenBalance = {
      current: profile.tokens_remaining || 0,
      maxBalance,
      tier: profile.subscription_tier || 'free',
      usageThisMonth,
      projectedUsage: Math.round(projectedUsage),
      efficiency
    }

    // Fetch recent activity
    const { data: stories } = await supabase
      .from('stories')
      .select(`
        id, title, updated_at, word_count,
        chapters (id, chapter_number, created_at)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5)

    return NextResponse.json(
      {
        profile,
        tokenBalance,
        recentActivity: stories || [],
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30'
        }
      }
    )

  } catch (error) {
    console.error('Dashboard API error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}