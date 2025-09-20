import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    // Get all active credit packages
    const { data: packages, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      console.error('Credit packages fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch credit packages' }, { status: 500 })
    }

    // Calculate value metrics for each package
    const packagesWithMetrics = packages?.map(pkg => {
      const totalCredits = pkg.credits_amount + pkg.bonus_credits
      const pricePerCredit = pkg.price_usd / totalCredits
      const bonusPercentage = Math.round((pkg.bonus_credits / pkg.credits_amount) * 100)

      return {
        ...pkg,
        total_credits: totalCredits,
        price_per_credit: parseFloat(pricePerCredit.toFixed(4)),
        bonus_percentage: bonusPercentage,
        is_best_value: bonusPercentage >= 20, // Mark packages with 20%+ bonus as best value
        display_savings: bonusPercentage > 0 ? `${bonusPercentage}% bonus credits` : null
      }
    }) || []

    return NextResponse.json({
      packages: packagesWithMetrics,
      meta: {
        count: packagesWithMetrics.length,
        currency: 'USD'
      }
    })

  } catch (error) {
    console.error('Credit packages endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch credit packages' }, { status: 500 })
  }
}