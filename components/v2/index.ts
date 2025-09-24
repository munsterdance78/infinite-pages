// Infinite Pages V2.0 Components
// Phase 4: Frontend Integration - Complete Component Export System

export { StoryLibrary } from './StoryLibrary'
export { ThreePhaseWorkflow } from './ThreePhaseWorkflow'
export { WorkflowInterface } from './WorkflowInterface'
export { EnhancementSliders } from './EnhancementSliders'

// Phase 5 Advanced Components
export { TimelineVisualization } from './TimelineVisualization'

// Types
export type { AnalysisResults, SliderValues } from './EnhancementSliders'

// Phase 4.3: Enhanced Dashboard Integration
export { EnhancedAnalyticsDashboard } from '../dashboard/AnalyticsDashboard'

// Component Interface Definitions
export interface WorkflowPhaseInterface {
  id: string
  name: string
  component: React.ComponentType<any>
  isActive: boolean
  isComplete: boolean
}

export interface ComponentExportConfig {
  version: '2.0'
  components: {
    workflow: string[]
    analytics: string[]
    visualization: string[]
    enhancement: string[]
  }
  dependencies: {
    required: string[]
    optional: string[]
  }
}

// Component registry for dynamic loading
export const V2_COMPONENT_REGISTRY: ComponentExportConfig = {
  version: '2.0',
  components: {
    workflow: ['WorkflowInterface', 'ThreePhaseWorkflow'],
    analytics: ['EnhancedAnalyticsDashboard'],
    visualization: ['TimelineVisualization'],
    enhancement: ['EnhancementSliders']
  },
  dependencies: {
    required: [
      '@anthropic-ai/sdk',
      '@supabase/supabase-js',
      'next',
      'react',
      'typescript'
    ],
    optional: [
      '@tanstack/react-query',
      'lucide-react',
      'react-window'
    ]
  }
}

// Component validation utilities
export function validateComponentInterface(component: any): boolean {
  return !!(
    component &&
    typeof component === 'object' &&
    'interface' in component &&
    'useState' in component.toString()
  )
}

export function getComponentMetadata(componentName: string) {
  const registry = V2_COMPONENT_REGISTRY
  for (const [category, components] of Object.entries(registry.components)) {
    if (components.includes(componentName)) {
      return {
        category,
        version: registry.version,
        dependencies: registry.dependencies.required
      }
    }
  }
  return null
}

// Phase integration utilities
export function isPhase4ComponentReady(): boolean {
  const requiredComponents = [
    'WorkflowInterface',
    'EnhancementSliders',
    'EnhancedAnalyticsDashboard'
  ]

  return requiredComponents.every(componentName => {
    try {
      const metadata = getComponentMetadata(componentName)
      return metadata !== null
    } catch {
      return false
    }
  })
}

// Export configuration for Next.js optimization
export const V2_EXPORT_CONFIG = {
  sideEffects: false,
  esModule: true,
  preferConst: true
} as const