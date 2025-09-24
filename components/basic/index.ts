// V2.0 Basic UI Scaffolding - Comprehensive Button Interfaces
// Generated for all major V2.0 features with functionality-first approach

export { default as FactExtractionButtons } from './FactExtractionButtons'
export { default as ThreePhaseWorkflowButtons } from './ThreePhaseWorkflowButtons'
export { default as CharacterManagerButtons } from './CharacterManagerButtons'
export { default as WorldBuilderButtons } from './WorldBuilderButtons'
export { default as TimelineButtons } from './TimelineButtons'
export { default as AnalyticsButtons } from './AnalyticsButtons'

// Component manifest for easy integration
export const V2BasicComponents = {
  'fact-extraction': 'FactExtractionButtons',
  'three-phase-workflow': 'ThreePhaseWorkflowButtons',
  'character-manager': 'CharacterManagerButtons',
  'world-builder': 'WorldBuilderButtons',
  'timeline': 'TimelineButtons',
  'analytics': 'AnalyticsButtons'
} as const

// Integration helper for rapid deployment
export const getComponentByFeature = (feature: keyof typeof V2BasicComponents) => {
  return V2BasicComponents[feature]
}