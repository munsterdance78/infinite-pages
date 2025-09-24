/**
 * V2.0 Feature Flags System
 * Enables controlled rollout and configuration of new V2.0 features
 */

export interface V2FeatureConfig {
  FACT_EXTRACTION: boolean
  HIERARCHICAL_CACHE: boolean
  THREE_PHASE_WORKFLOW: boolean
  CHARACTER_GENERATION: boolean
  WORLD_BUILDER: boolean
  TIMELINE_VISUALIZATION: boolean
  SERIES_MANAGEMENT: boolean
  ANALYTICS_V2: boolean
  PERFORMANCE_MONITORING: boolean
  ADVANCED_CACHING: boolean
}

export interface V2FeatureLimits {
  MAX_FACTS_PER_EXTRACTION: number
  MAX_CACHE_ENTRIES: number
  MAX_WORKFLOW_DURATION_MS: number
  MAX_CHARACTERS_PER_STORY: number
  MAX_TIMELINE_EVENTS: number
}

export const V2_FEATURE_FLAGS: V2FeatureConfig = {
  // Core SFSL Features
  FACT_EXTRACTION: process.env.ENABLE_FACT_EXTRACTION === 'true',
  HIERARCHICAL_CACHE: process.env.ENABLE_HIERARCHICAL_CACHE === 'true',

  // Workflow Features
  THREE_PHASE_WORKFLOW: process.env.ENABLE_THREE_PHASE_WORKFLOW === 'true',

  // Content Generation Features
  CHARACTER_GENERATION: process.env.ENABLE_CHARACTER_GENERATION === 'true',
  WORLD_BUILDER: process.env.ENABLE_WORLD_BUILDER === 'true',

  // Advanced Features
  TIMELINE_VISUALIZATION: process.env.ENABLE_TIMELINE_VISUALIZATION === 'true',
  SERIES_MANAGEMENT: process.env.ENABLE_SERIES_MANAGEMENT === 'true',

  // Analytics & Monitoring
  ANALYTICS_V2: process.env.ENABLE_ANALYTICS_V2 === 'true',
  PERFORMANCE_MONITORING: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',

  // Performance Features
  ADVANCED_CACHING: process.env.ENABLE_ADVANCED_CACHING === 'true'
}

export const V2_FEATURE_LIMITS: V2FeatureLimits = {
  MAX_FACTS_PER_EXTRACTION: parseInt(process.env.MAX_FACTS_PER_EXTRACTION || '50'),
  MAX_CACHE_ENTRIES: parseInt(process.env.MAX_CACHE_ENTRIES || '1000'),
  MAX_WORKFLOW_DURATION_MS: parseInt(process.env.MAX_WORKFLOW_DURATION_MS || '300000'), // 5 minutes
  MAX_CHARACTERS_PER_STORY: parseInt(process.env.MAX_CHARACTERS_PER_STORY || '25'),
  MAX_TIMELINE_EVENTS: parseInt(process.env.MAX_TIMELINE_EVENTS || '100')
}

/**
 * Feature flag checking utilities
 */
export class V2FeatureManager {
  private static instance: V2FeatureManager
  private featureUsage = new Map<string, { count: number; lastUsed: number }>()

  static getInstance(): V2FeatureManager {
    if (!V2FeatureManager.instance) {
      V2FeatureManager.instance = new V2FeatureManager()
    }
    return V2FeatureManager.instance
  }

  /**
   * Check if a V2.0 feature is enabled
   */
  isEnabled(feature: keyof V2FeatureConfig): boolean {
    const enabled = V2_FEATURE_FLAGS[feature]

    if (enabled) {
      this.trackFeatureUsage(feature)
    }

    return enabled
  }

  /**
   * Check if a feature is enabled with fallback
   */
  isEnabledWithFallback(feature: keyof V2FeatureConfig, fallback: boolean = false): boolean {
    try {
      return this.isEnabled(feature)
    } catch (error) {
      console.warn(`Feature flag check failed for ${feature}, using fallback: ${fallback}`)
      return fallback
    }
  }

  /**
   * Get feature limit value
   */
  getLimit(limit: keyof V2FeatureLimits): number {
    return V2_FEATURE_LIMITS[limit]
  }

  /**
   * Check if multiple features are enabled
   */
  areAllEnabled(features: (keyof V2FeatureConfig)[]): boolean {
    return features.every(feature => this.isEnabled(feature))
  }

  /**
   * Check if any of the features are enabled
   */
  isAnyEnabled(features: (keyof V2FeatureConfig)[]): boolean {
    return features.some(feature => this.isEnabled(feature))
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): (keyof V2FeatureConfig)[] {
    return Object.entries(V2_FEATURE_FLAGS)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature as keyof V2FeatureConfig)
  }

  /**
   * Get feature configuration summary
   */
  getFeatureSummary(): {
    enabled: (keyof V2FeatureConfig)[]
    disabled: (keyof V2FeatureConfig)[]
    limits: V2FeatureLimits
    usage: Array<{ feature: string; count: number; lastUsed: number }>
  } {
    const allFeatures = Object.keys(V2_FEATURE_FLAGS) as (keyof V2FeatureConfig)[]
    const enabled = allFeatures.filter(feature => V2_FEATURE_FLAGS[feature])
    const disabled = allFeatures.filter(feature => !V2_FEATURE_FLAGS[feature])

    const usage = Array.from(this.featureUsage.entries()).map(([feature, data]) => ({
      feature,
      count: data.count,
      lastUsed: data.lastUsed
    }))

    return {
      enabled,
      disabled,
      limits: V2_FEATURE_LIMITS,
      usage
    }
  }

  /**
   * Validate feature dependencies
   */
  validateFeatureDependencies(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // HIERARCHICAL_CACHE depends on FACT_EXTRACTION
    if (V2_FEATURE_FLAGS.HIERARCHICAL_CACHE && !V2_FEATURE_FLAGS.FACT_EXTRACTION) {
      issues.push('HIERARCHICAL_CACHE requires FACT_EXTRACTION to be enabled')
    }

    // THREE_PHASE_WORKFLOW depends on FACT_EXTRACTION
    if (V2_FEATURE_FLAGS.THREE_PHASE_WORKFLOW && !V2_FEATURE_FLAGS.FACT_EXTRACTION) {
      issues.push('THREE_PHASE_WORKFLOW requires FACT_EXTRACTION to be enabled')
    }

    // CHARACTER_GENERATION depends on FACT_EXTRACTION
    if (V2_FEATURE_FLAGS.CHARACTER_GENERATION && !V2_FEATURE_FLAGS.FACT_EXTRACTION) {
      issues.push('CHARACTER_GENERATION requires FACT_EXTRACTION to be enabled')
    }

    // TIMELINE_VISUALIZATION depends on FACT_EXTRACTION
    if (V2_FEATURE_FLAGS.TIMELINE_VISUALIZATION && !V2_FEATURE_FLAGS.FACT_EXTRACTION) {
      issues.push('TIMELINE_VISUALIZATION requires FACT_EXTRACTION to be enabled')
    }

    // SERIES_MANAGEMENT depends on FACT_EXTRACTION and HIERARCHICAL_CACHE
    if (V2_FEATURE_FLAGS.SERIES_MANAGEMENT &&
        (!V2_FEATURE_FLAGS.FACT_EXTRACTION || !V2_FEATURE_FLAGS.HIERARCHICAL_CACHE)) {
      issues.push('SERIES_MANAGEMENT requires both FACT_EXTRACTION and HIERARCHICAL_CACHE to be enabled')
    }

    // PERFORMANCE_MONITORING depends on ANALYTICS_V2
    if (V2_FEATURE_FLAGS.PERFORMANCE_MONITORING && !V2_FEATURE_FLAGS.ANALYTICS_V2) {
      issues.push('PERFORMANCE_MONITORING requires ANALYTICS_V2 to be enabled')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Check if feature should be available based on environment
   */
  isFeatureAvailableInEnvironment(feature: keyof V2FeatureConfig): boolean {
    const env = process.env.NODE_ENV || 'development'

    // Some features might be restricted in certain environments
    const restrictedInProduction = ['PERFORMANCE_MONITORING'] // Example: might impact performance

    if (env === 'production' && restrictedInProduction.includes(feature)) {
      return false
    }

    return true
  }

  /**
   * Get feature rollout percentage (for gradual rollouts)
   */
  getFeatureRolloutPercentage(feature: keyof V2FeatureConfig): number {
    const envVar = `${feature}_ROLLOUT_PERCENTAGE`
    const percentage = parseInt(process.env[envVar] || '100')
    return Math.min(100, Math.max(0, percentage))
  }

  /**
   * Check if user should see feature based on rollout percentage
   */
  shouldUserSeeFeature(feature: keyof V2FeatureConfig, userId: string): boolean {
    if (!this.isEnabled(feature)) {
      return false
    }

    const rolloutPercentage = this.getFeatureRolloutPercentage(feature)
    if (rolloutPercentage >= 100) {
      return true
    }

    // Use deterministic hashing for consistent user experience
    const hash = this.hashUserId(userId)
    const userPercentile = hash % 100

    return userPercentile < rolloutPercentage
  }

  /**
   * Track feature usage for analytics
   */
  private trackFeatureUsage(feature: keyof V2FeatureConfig): void {
    const key = feature.toString()
    const now = Date.now()

    if (!this.featureUsage.has(key)) {
      this.featureUsage.set(key, { count: 0, lastUsed: now })
    }

    const usage = this.featureUsage.get(key)!
    usage.count++
    usage.lastUsed = now
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Reset feature usage tracking
   */
  resetUsageTracking(): void {
    this.featureUsage.clear()
  }
}

/**
 * Feature-specific utilities
 */
export const V2FeatureUtils = {
  /**
   * Check if SFSL features are ready
   */
  isSFSLReady(): boolean {
    const manager = V2FeatureManager.getInstance()
    return manager.areAllEnabled(['FACT_EXTRACTION', 'HIERARCHICAL_CACHE'])
  },

  /**
   * Check if content generation features are ready
   */
  isContentGenerationReady(): boolean {
    const manager = V2FeatureManager.getInstance()
    return manager.areAllEnabled(['FACT_EXTRACTION', 'CHARACTER_GENERATION', 'THREE_PHASE_WORKFLOW'])
  },

  /**
   * Check if advanced features are ready
   */
  isAdvancedFeaturesReady(): boolean {
    const manager = V2FeatureManager.getInstance()
    return manager.areAllEnabled([
      'FACT_EXTRACTION',
      'HIERARCHICAL_CACHE',
      'TIMELINE_VISUALIZATION',
      'SERIES_MANAGEMENT'
    ])
  },

  /**
   * Check if analytics features are ready
   */
  isAnalyticsReady(): boolean {
    const manager = V2FeatureManager.getInstance()
    return manager.areAllEnabled(['ANALYTICS_V2', 'PERFORMANCE_MONITORING'])
  },

  /**
   * Get feature readiness summary
   */
  getReadinessSummary(): {
    sfsl: boolean
    contentGeneration: boolean
    advancedFeatures: boolean
    analytics: boolean
    overall: boolean
  } {
    return {
      sfsl: this.isSFSLReady(),
      contentGeneration: this.isContentGenerationReady(),
      advancedFeatures: this.isAdvancedFeaturesReady(),
      analytics: this.isAnalyticsReady(),
      overall: this.isSFSLReady() && this.isContentGenerationReady() && this.isAdvancedFeaturesReady()
    }
  }
}

// Export singleton instance
export const v2FeatureManager = V2FeatureManager.getInstance()

// Environment validation on module load
if (typeof window === 'undefined') { // Server-side only
  const validation = v2FeatureManager.validateFeatureDependencies()
  if (!validation.valid) {
    console.warn('⚠️ V2.0 Feature Flag Configuration Issues:')
    validation.issues.forEach(issue => console.warn(`  - ${issue}`))
  } else {
    console.log('✅ V2.0 Feature flags configuration is valid')
  }

  const summary = v2FeatureManager.getFeatureSummary()
  console.log(`🚀 V2.0 Features enabled: ${summary.enabled.length}/${summary.enabled.length + summary.disabled.length}`)

  if (summary.enabled.length > 0) {
    console.log(`   Enabled: ${summary.enabled.join(', ')}`)
  }

  if (summary.disabled.length > 0) {
    console.log(`   Disabled: ${summary.disabled.join(', ')}`)
  }
}