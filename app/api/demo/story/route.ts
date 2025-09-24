import { NextResponse, type NextRequest } from 'next/server'
import { claudeService } from '@/lib/claude'

// Demo story creation - completely bypasses all middleware and auth
export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json()
    const { genre = 'fantasy', premise = 'A magical adventure' } = requestBody

    // Simple validation
    if (!genre || !premise) {
      return NextResponse.json({
        error: 'Please provide genre and premise'
      }, { status: 400 })
    }

    // Generate a simple demo story foundation
    const demoStoryResult = await claudeService.generateStoryFoundation({
      title: 'Demo Story',
      genre,
      premise
    })

    const demoStory = {
      id: `demo-${Date.now()}`,
      title: 'Demo Story',
      genre,
      premise,
      content: demoStoryResult.content,
      isDemoMode: true,
      message: 'This is a demo story. Sign up to save and continue your stories!',
      upgradePrompt: 'Create an account to unlock unlimited stories, save your work, and access advanced features.'
    }

    return NextResponse.json({
      success: true,
      story: demoStory,
      demo: true
    })

  } catch (error: any) {
    console.error('Demo story error:', error)
    return NextResponse.json({
      error: 'Demo story generation failed',
      demo: true,
      message: 'Please try again or sign up for reliable access'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Demo story endpoint ready',
    usage: 'POST with genre and premise to create a demo story'
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600'
    }
  })
}