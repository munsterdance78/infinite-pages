import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { claudeService } from '@/lib/claude/service'
import { claudeCache } from '@/lib/claude/cache'
import { analyticsService } from '@/lib/claude/analytics'
import { rateLimiter } from '@/lib/rateLimit'
import { CREDIT_SYSTEM, ESTIMATED_CREDIT_COSTS } from '@/lib/constants'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  // Validate Accept header to prevent 406 errors
  const acceptHeader = request.headers.get('accept')
  if (acceptHeader && !acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
    return NextResponse.json(
      { error: 'Not Acceptable - This endpoint only supports application/json' },
      {
        status: 406,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const requestBody = await request.json()
    const {
      universeType = 'fantasy',
      magicSystem,
      geography,
      cultures,
      timeline,
      cosmology,
      naturalLaws,
      primaryRaces,
      governmentSystems,
      workflowPhase = 'setup',
      technologyLevel,
      socialStructure,
      religions,
      economies
    } = requestBody

    // Verify story ownership and get story data
    const { data: story } = await supabase
      .from('stories')
      .select('*, chapters(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get user profile for subscription tier and credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens_remaining, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Rate limiting for universe setup
    const rateLimit = await rateLimiter.checkRateLimit(
      user.id,
      'UNIVERSE_GENERATION',
      profile.subscription_tier
    )

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 1000)} seconds.`
      }, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
        }
      })
    }

    // Check credits for universe setup
    const estimatedCost = ESTIMATED_CREDIT_COSTS.UNIVERSE_GENERATION || 20
    if (profile.tokens_remaining < estimatedCost) {
      return NextResponse.json({
        error: `Insufficient credits (${estimatedCost} credits required for universe setup)`
      }, {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generate detailed universe setup content
    const universeSetupContent = `
UNIVERSE SETUP SPECIFICATIONS:

Story Context:
- Title: ${story.title}
- Foundation: ${story.foundation}
- Genre: ${story.genre || 'Not specified'}

Universe Type: ${universeType}

Magic System:
${magicSystem ? JSON.stringify(magicSystem, null, 2) : 'Not specified'}

Geography and World Layout:
${geography ? JSON.stringify(geography, null, 2) : 'Not specified'}

Cultures and Civilizations:
${cultures ? JSON.stringify(cultures, null, 2) : 'Not specified'}

Timeline and History:
${timeline ? JSON.stringify(timeline, null, 2) : 'Not specified'}

Cosmology and Universal Laws:
${cosmology ? JSON.stringify(cosmology, null, 2) : 'Not specified'}

Natural Laws and Physics:
${naturalLaws ? JSON.stringify(naturalLaws, null, 2) : 'Not specified'}

Primary Races and Species:
${primaryRaces ? JSON.stringify(primaryRaces, null, 2) : 'Not specified'}

Government Systems:
${governmentSystems ? JSON.stringify(governmentSystems, null, 2) : 'Not specified'}

Technology Level:
${technologyLevel ? JSON.stringify(technologyLevel, null, 2) : 'Not specified'}

Social Structure:
${socialStructure ? JSON.stringify(socialStructure, null, 2) : 'Not specified'}

Religions and Belief Systems:
${religions ? JSON.stringify(religions, null, 2) : 'Not specified'}

Economic Systems:
${economies ? JSON.stringify(economies, null, 2) : 'Not specified'}
    `

    // Generate universe facts using existing service with enhanced context
    const universeResult = await claudeService.extractAndCompressFacts({
      content: universeSetupContent,
      storyContext: {
        storyId: params.id,
        userId: user.id,
        title: story.title,
        foundation: story.foundation,
        type: 'universe_setup'
      },
      factType: 'universe'
    })

    // Generate expanded universe bible
    const universeBibleResult = await claudeService.generateContent({
      prompt: `Based on the universe setup specifications, create a comprehensive universe bible that will serve as the canonical reference for this story world.

Universe Setup Data:
${universeSetupContent}

Please generate a detailed universe bible including:

1. COSMOLOGICAL STRUCTURE
   - Universal laws and physics
   - Dimensional structure
   - Time and space mechanics
   - Fundamental forces

2. WORLD GEOGRAPHY
   - Major continents and regions
   - Climate and terrain details
   - Notable landmarks and locations
   - Resource distribution

3. MAGIC/TECHNOLOGY SYSTEMS
   - Core mechanics and limitations
   - User requirements and training
   - Societal impact and integration
   - Historical development

4. RACES AND SPECIES
   - Physical characteristics
   - Cultural tendencies
   - Abilities and limitations
   - Inter-species relationships

5. HISTORICAL TIMELINE
   - Major eras and periods
   - Significant events and turning points
   - Cultural developments
   - Technological/magical advances

6. POLITICAL SYSTEMS
   - Government structures
   - Power dynamics
   - International relations
   - Conflict sources

7. CULTURAL FRAMEWORKS
   - Social structures and hierarchies
   - Customs and traditions
   - Languages and communication
   - Art and entertainment

8. ECONOMIC SYSTEMS
   - Currency and trade
   - Resource management
   - Economic drivers
   - Class structures

9. RELIGIOUS/BELIEF SYSTEMS
   - Deities and pantheons
   - Creation myths and cosmology
   - Moral frameworks
   - Religious institutions

10. CONSISTENCY RULES
    - Internal logic constraints
    - Cause and effect patterns
    - Character behavior guidelines
    - World-building boundaries

Format as a comprehensive, organized document that can serve as a reference for story consistency.`,
      systemPrompt: `You are an expert world-builder and fantasy/sci-fi consultant. Create comprehensive, internally consistent universe documentation that maintains logical coherence while supporting rich storytelling possibilities.

Focus on:
- Internal consistency and logical connections
- Rich detail that supports story development
- Clear rules and limitations that create interesting conflicts
- Cultural depth that feels authentic
- Geographic and political realism within the universe type
- Integration between all systems (magic, technology, society, geography)

Provide detailed, usable reference material that writers can consistently draw from.`,
      operation: 'universe_bible_generation',
      useCache: true
    })

    // Update user credits
    const totalCreditsUsed = Math.ceil((universeResult.cost + universeBibleResult.cost) * 1000)
    await supabase
      .from('profiles')
      .update({
        tokens_remaining: Math.max(0, profile.tokens_remaining - totalCreditsUsed),
        tokens_used_total: supabase.sql`tokens_used_total + ${totalCreditsUsed}`
      })
      .eq('id', user.id)

    // Cache universe facts with long TTL (30 days)
    await claudeCache.cacheHierarchicalFacts(
      params.id,
      {
        ...universeResult.facts,
        universeBible: universeBibleResult.content,
        setupData: requestBody,
        generatedAt: new Date().toISOString(),
        cost: universeResult.cost + universeBibleResult.cost
      },
      'universe'
    )

    // Store universe setup in database for persistence
    const { data: universeData } = await supabase
      .from('story_facts')
      .insert({
        story_id: params.id,
        fact_type: 'universe',
        fact_level: 'universe',
        sfsl_data: universeResult.compressed,
        original_content: universeSetupContent,
        compression_ratio: universeResult.compressionRatio,
        created_at: new Date().toISOString(),
        metadata: {
          universeType,
          setupParameters: Object.keys(requestBody),
          bibleGenerated: true,
          cost: universeResult.cost + universeBibleResult.cost
        }
      })
      .select()
      .single()

    // Track analytics for universe setup
    await analyticsService.trackFactExtraction({
      userId: user.id,
      storyId: params.id,
      factType: 'universe',
      compressionRatio: universeResult.compressionRatio,
      extractionTime: Date.now() - startTime,
      cost: universeResult.cost + universeBibleResult.cost,
      creditsUsed: totalCreditsUsed,
      originalLength: universeSetupContent.length,
      compressedLength: universeResult.compressed.length
    })

    return NextResponse.json({
      success: true,
      universeSetup: {
        facts: universeResult,
        bible: universeBibleResult.content,
        setupData: requestBody,
        databaseId: universeData?.id
      },
      metadata: {
        creditsUsed: totalCreditsUsed,
        processingTime: Date.now() - startTime,
        compressionRatio: universeResult.compressionRatio,
        universeType,
        componentsGenerated: {
          facts: true,
          bible: true,
          cached: true,
          persisted: true
        },
        optimizations: {
          sfslCompression: true,
          hierarchicalCaching: true,
          longTermStorage: true
        }
      }
    })

  } catch (error: any) {
    console.error('Universe setup error:', error)

    // Track failed operation
    await analyticsService.trackOperation({
      userId: user.id,
      operation: 'universe_setup',
      model: 'claude_enhanced',
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      responseTime: Date.now() - startTime,
      success: false,
      cached: false,
      error: error.message
    })

    return NextResponse.json(
      {
        error: 'Universe setup failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// GET method to retrieve universe setup status and existing universe data
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    // Verify story ownership
    const { data: story } = await supabase
      .from('stories')
      .select('id, user_id, title, genre, foundation')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get existing universe facts
    const { data: universeFacts } = await supabase
      .from('story_facts')
      .select('*')
      .eq('story_id', params.id)
      .eq('fact_type', 'universe')
      .order('created_at', { ascending: false })
      .limit(1)

    // Get cached universe data
    const universeCache = await claudeCache.getFactsByLevel(params.id, 'universe')

    // Get cache statistics
    const cacheStats = claudeCache.getFactCacheStats()

    return NextResponse.json({
      storyId: params.id,
      storyInfo: {
        title: story.title,
        genre: story.genre,
        foundation: story.foundation
      },
      universeSetup: {
        exists: universeFacts && universeFacts.length > 0,
        lastUpdated: universeFacts?.[0]?.created_at,
        compressionRatio: universeFacts?.[0]?.compression_ratio,
        universeType: universeFacts?.[0]?.metadata?.universeType,
        setupParameters: universeFacts?.[0]?.metadata?.setupParameters || []
      },
      cachedData: {
        available: universeCache !== null,
        cacheLevel: 'universe',
        ttl: '30 days',
        lastAccessed: universeCache?.lastAccessed
      },
      capabilities: {
        canSetupUniverse: true,
        canUpdateUniverse: universeFacts && universeFacts.length > 0,
        canGenerateBible: true,
        supportsHierarchicalFacts: true
      },
      cacheStats: {
        universeFactEntries: cacheStats.factEntriesByLevel?.universe || 0,
        totalFactEntries: cacheStats.totalFactEntries
      }
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error retrieving universe setup status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve universe setup status' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// PATCH method to update existing universe setup
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const requestBody = await request.json()
    const { updateType = 'partial', updates } = requestBody

    // Verify story ownership
    const { data: story } = await supabase
      .from('stories')
      .select('id, user_id, title, foundation')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get existing universe facts
    const { data: existingFacts } = await supabase
      .from('story_facts')
      .select('*')
      .eq('story_id', params.id)
      .eq('fact_type', 'universe')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!existingFacts || existingFacts.length === 0) {
      return NextResponse.json({
        error: 'No existing universe setup found. Use POST to create initial setup.'
      }, {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Process universe updates
    const updateContent = `
UNIVERSE UPDATE REQUEST:

Update Type: ${updateType}
Story: ${story.title}

Updates to Apply:
${JSON.stringify(updates, null, 2)}

Previous Universe Context:
${existingFacts[0].original_content}
    `

    // Generate updated universe facts
    const updateResult = await claudeService.extractAndCompressFacts({
      content: updateContent,
      storyContext: {
        storyId: params.id,
        userId: user.id,
        title: story.title,
        foundation: story.foundation,
        type: 'universe_update'
      },
      factType: 'universe'
    })

    // Update cached universe data
    await claudeCache.cacheHierarchicalFacts(
      params.id,
      {
        ...updateResult.facts,
        updateType,
        updates,
        updatedAt: new Date().toISOString(),
        cost: updateResult.cost,
        previousVersion: existingFacts[0].id
      },
      'universe'
    )

    // Create new version in database
    const { data: newVersionData } = await supabase
      .from('story_facts')
      .insert({
        story_id: params.id,
        fact_type: 'universe',
        fact_level: 'universe',
        sfsl_data: updateResult.compressed,
        original_content: updateContent,
        compression_ratio: updateResult.compressionRatio,
        created_at: new Date().toISOString(),
        metadata: {
          updateType,
          updatedFields: Object.keys(updates),
          previousVersionId: existingFacts[0].id,
          cost: updateResult.cost
        }
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      universeUpdate: {
        updateType,
        updatedFields: Object.keys(updates),
        facts: updateResult,
        databaseId: newVersionData?.id,
        previousVersion: existingFacts[0].id
      },
      metadata: {
        processingTime: Date.now() - startTime,
        compressionRatio: updateResult.compressionRatio,
        cost: updateResult.cost,
        optimizations: {
          sfslCompression: true,
          hierarchicalCaching: true,
          versionTracking: true
        }
      }
    })

  } catch (error: any) {
    console.error('Universe update error:', error)
    return NextResponse.json(
      {
        error: 'Universe update failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}