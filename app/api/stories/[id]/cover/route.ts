import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants'
import type { Database } from '@/lib/supabase/types'

const WEBUI_API_URL = process.env.STABLE_DIFFUSION_WEBUI_URL || 'http://localhost:7860'

const COVER_STYLES = {
  realistic: {
    prompt_suffix: ', photorealistic, detailed, professional book cover, high quality, 8k',
    negative_prompt: 'blurry, low quality, text, watermark, signature',
    model: 'realisticVision'
  },
  artistic: {
    prompt_suffix: ', digital art, stylized, vibrant colors, artistic book cover, detailed illustration',
    negative_prompt: 'photorealistic, blurry, low quality, text',
    model: 'deliberate'
  },
  fantasy: {
    prompt_suffix: ', fantasy art, mystical, magical, epic fantasy book cover, detailed, dramatic lighting',
    negative_prompt: 'modern, realistic, blurry, low quality, text',
    model: 'dreamshaper'
  },
  minimalist: {
    prompt_suffix: ', minimalist design, clean, simple, elegant book cover, typography focus',
    negative_prompt: 'cluttered, busy, complex, blurry, low quality',
    model: 'deliberate'
  },
  vintage: {
    prompt_suffix: ', vintage style, retro, classic book cover, aged paper texture, traditional art',
    negative_prompt: 'modern, digital, neon, blurry, low quality, text',
    model: 'deliberate'
  }
}

const SUBSCRIPTION_LIMITS = {
  free: { monthly_covers: 1, cost_credits: 10, styles: ['minimalist'] },
  basic: { monthly_covers: 3, cost_credits: 8, styles: ['minimalist', 'artistic'] },
  premium: { monthly_covers: 10, cost_credits: 5, styles: ['realistic', 'artistic', 'fantasy', 'minimalist', 'vintage'] }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const { style = 'artistic', custom_prompt = '' } = await request.json()
    const storyId = params.id

    // Get user profile and story
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, credits_balance')
      .eq('id', user.id)
      .single()

    const { data: story } = await supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    // Check ownership or access
    if (story.user_id !== user.id) {
      const { data: purchase } = await supabase
        .from('story_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('story_id', storyId)
        .single()

      if (!purchase) {
        return NextResponse.json({ error: 'Story access required' }, { status: 403 })
      }
    }

    const tier = (profile?.subscription_tier || 'free') as keyof typeof SUBSCRIPTION_LIMITS
    const limits = SUBSCRIPTION_LIMITS[tier]

    // Check style access
    if (!limits.styles.includes(style)) {
      return NextResponse.json({
        error: 'Style not available for your subscription',
        available_styles: limits.styles,
        upgrade_required: profile?.subscription_tier !== 'premium'
      }, { status: 402 })
    }

    // Check credit balance
    if (profile?.credits_balance < limits.cost_credits) {
      return NextResponse.json({
        error: 'Insufficient credits for cover generation',
        required: limits.cost_credits,
        available: profile?.credits_balance || 0
      }, { status: 402 })
    }

    // Check monthly limits
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const { data: monthlyCovers } = await supabase
      .from('story_covers')
      .select('id')
      .eq('story_id', storyId)
      .gte('created_at', currentMonth.toISOString())

    if (monthlyCovers && monthlyCovers.length >= limits.monthly_covers) {
      return NextResponse.json({
        error: 'Monthly cover generation limit reached',
        limit: limits.monthly_covers,
        used: monthlyCovers.length
      }, { status: 429 })
    }

    // Generate cover prompt from story
    const coverPrompt = await generateCoverPrompt(story, style, custom_prompt)

    // Add to generation queue
    const { data: queueItem, error: queueError } = await supabase
      .from('cover_generation_queue')
      .insert({
        story_id: storyId,
        user_id: user.id,
        generation_prompt: coverPrompt,
        cover_style: style,
        status: 'pending',
        priority: profile?.subscription_tier === 'premium' ? 1 :
                 profile?.subscription_tier === 'basic' ? 2 : 3
      })
      .select()
      .single()

    if (queueError) {
      console.error('Queue error:', queueError)
      return NextResponse.json({ error: 'Failed to queue cover generation' }, { status: 500 })
    }

    // Deduct credits
    const newBalance = (profile?.credits_balance || 0) - limits.cost_credits
    await supabase
      .from('profiles')
      .update({ credits_balance: newBalance })
      .eq('id', user.id)

    // Create transaction record
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      transaction_type: 'spend',
      amount: -limits.cost_credits,
      balance_after: newBalance,
      description: `Cover generation: ${story.title} (${style})`,
      reference_id: storyId,
      reference_type: 'cover_generation'
    })

    // Start generation process
    processGenerationQueue(queueItem.id)

    return NextResponse.json({
      success: true,
      queue_id: queueItem.id,
      estimated_time: '30-120 seconds',
      credits_charged: limits.cost_credits,
      new_balance: newBalance,
      message: 'Cover generation started. You will be notified when ready.'
    })

  } catch (error) {
    console.error('Cover generation error:', error)
    return NextResponse.json({ error: 'Cover generation failed' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 })
    }

    const storyId = params.id

    // Get all covers for this story
    const { data: covers } = await supabase
      .from('story_covers')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })

    // Get generation queue status
    const { data: queueItems } = await supabase
      .from('cover_generation_queue')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'generating'])
      .order('created_at', { ascending: false })

    // Get user limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, credits_balance')
      .eq('id', user.id)
      .single()

    const tier = (profile?.subscription_tier || 'free') as keyof typeof SUBSCRIPTION_LIMITS
    const limits = SUBSCRIPTION_LIMITS[tier]

    return NextResponse.json({
      covers: covers || [],
      queue_items: queueItems || [],
      user_limits: limits,
      credits_balance: profile?.credits_balance || 0
    })

  } catch (error) {
    console.error('Cover fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch covers' }, { status: 500 })
  }
}

async function generateCoverPrompt(story: any, style: string, customPrompt: string): Promise<string> {
  const basePrompt = customPrompt ||
    `Book cover for "${story.title}", a ${story.genre} story. ${story.premise.substring(0, 200)}`

  const styleConfig = COVER_STYLES[style as keyof typeof COVER_STYLES] || COVER_STYLES.artistic
  return `${basePrompt}${styleConfig.prompt_suffix}`
}

async function processGenerationQueue(queueId: string) {
  // This runs asynchronously - don't await
  setTimeout(async () => {
    try {
      const supabase = createRouteHandlerClient<Database>({
        cookies: () => cookies()
      })

      // Get queue item
      const { data: queueItem } = await supabase
        .from('cover_generation_queue')
        .select('*')
        .eq('id', queueId)
        .single()

      if (!queueItem) return

      // Update status to generating
      await supabase
        .from('cover_generation_queue')
        .update({ status: 'generating' })
        .eq('id', queueId)

      // Call Stable Diffusion WebUI API
      const styleConfig = COVER_STYLES[queueItem.cover_style as keyof typeof COVER_STYLES] || COVER_STYLES.artistic

      const response = await fetch(`${WEBUI_API_URL}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queueItem.generation_prompt,
          negative_prompt: styleConfig.negative_prompt,
          width: 512,
          height: 768, // Book cover aspect ratio
          steps: 25,
          cfg_scale: 7,
          sampler_name: 'DPM++ 2M Karras',
          batch_size: 1
        })
      })

      if (!response.ok) {
        throw new Error(`WebUI API error: ${response.status}`)
      }

      const result = await response.json()
      const imageBase64 = result.images[0]

      // Upload to Supabase Storage
      const imageBuffer = Buffer.from(imageBase64, 'base64')
      const fileName = `cover-${queueItem.story_id}-${Date.now()}.png`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('story-covers')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png'
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: urlData } = supabase.storage
        .from('story-covers')
        .getPublicUrl(fileName)

      // Save cover record
      await supabase.from('story_covers').insert({
        story_id: queueItem.story_id,
        cover_url: urlData.publicUrl,
        cover_style: queueItem.cover_style,
        generation_prompt: queueItem.generation_prompt,
        is_primary: true,
        generation_cost: 5,
        sd_model_used: styleConfig.model
      })

      // Update queue status
      await supabase
        .from('cover_generation_queue')
        .update({ status: 'completed' })
        .eq('id', queueId)

    } catch (error) {
      console.error('Generation process error:', error)

      // Mark as failed
      const supabase = createRouteHandlerClient<Database>({
        cookies: () => cookies()
      })

      await supabase
        .from('cover_generation_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          retry_count: 0
        })
        .eq('id', queueId)
    }
  }, 1000) // Start after 1 second
}