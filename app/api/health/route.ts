import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString()

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'operational',
        authentication: 'operational',
        api: 'operational'
      }
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  )
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '3600'
    }
  })
}