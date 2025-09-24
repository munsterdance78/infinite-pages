'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TestTube, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface V2TestingLinkProps {
  variant?: 'button' | 'card' | 'banner'
  className?: string
}

export default function V2TestingLink({
  variant = 'button',
  className = ''
}: V2TestingLinkProps) {

  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TestTube className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">V2.0 Feature Testing</h3>
              <p className="text-sm text-gray-600">Test all V2.0 components and APIs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">6 Components</Badge>
            <Link href="/v2-testing">
              <Button size="sm" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Open Testing Dashboard
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <TestTube className="h-6 w-6 text-blue-600" />
          </div>
          <Badge variant="outline" className="text-xs">New</Badge>
        </div>
        <h3 className="font-semibold mb-2">V2.0 Testing Dashboard</h3>
        <p className="text-sm text-gray-600 mb-4">
          Comprehensive testing interface for all infinite-pages V2.0 features including
          fact extraction, workflows, character management, and more.
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Fact Extraction & SFSL
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Three-Phase Workflow
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Character & World Builder
          </div>
        </div>
        <Link href="/v2-testing">
          <Button className="w-full flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Launch Testing Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  // Default button variant
  return (
    <Link href="/v2-testing">
      <Button variant="outline" size="sm" className={`flex items-center gap-2 ${className}`}>
        <TestTube className="h-4 w-4" />
        V2.0 Testing
        <Badge variant="secondary" className="text-xs ml-1">6 Features</Badge>
      </Button>
    </Link>
  )
}