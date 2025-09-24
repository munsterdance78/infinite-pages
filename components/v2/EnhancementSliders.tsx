'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Zap,
  Settings,
  TrendingUp,
  Brain,
  Globe,
  Users,
  BookOpen,
  Target,
  Info,
  RotateCcw,
  Save,
  Sparkles
} from 'lucide-react'

interface AnalysisResults {
  characterVoiceAccuracy: number
  worldConsistency: number
  plotProgression: number
  technicalQuality: number
  overallScore: number
  sfslCompressionRatio?: number
  issuesFound?: number
  suggestions?: string[]
}

interface SliderValues {
  characterVoice: number
  worldConsistency: number
  plotProgression: number
  technicalQuality: number
}

interface SliderConfig {
  label: string
  icon: any
  color: 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'indigo'
  description: string
  tips: {
    low: string
    medium: string
    high: string
  }
  examples: {
    low: string
    medium: string
    high: string
  }
}

interface EnhancementSlidersProps {
  analysisResults: AnalysisResults
  onEnhancementChange: (values: SliderValues) => void
  isLoading?: boolean
  disabled?: boolean
  storyGenre?: string
}

export function EnhancementSliders({
  analysisResults,
  onEnhancementChange,
  isLoading = false,
  disabled = false,
  storyGenre = 'fantasy'
}: EnhancementSlidersProps) {
  const [sliderValues, setSliderValues] = useState<SliderValues>({
    characterVoice: Math.max(0, Math.min(100, analysisResults.characterVoiceAccuracy + 5)),
    worldConsistency: Math.max(0, Math.min(100, analysisResults.worldConsistency + 5)),
    plotProgression: Math.max(0, Math.min(100, analysisResults.plotProgression + 5)),
    technicalQuality: Math.max(0, Math.min(100, analysisResults.technicalQuality + 5))
  })

  const [presetMode, setPresetMode] = useState<'custom' | 'conservative' | 'balanced' | 'aggressive'>('custom')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const sliderConfigs: Record<keyof SliderValues, SliderConfig> = {
    characterVoice: {
      label: "Character Voice",
      icon: Users,
      color: "red",
      description: "Speech patterns, dialogue authenticity, voice consistency across characters",
      tips: {
        low: "Minimal voice enhancement - preserves natural dialogue flow and author's original character voices",
        medium: "Moderate enhancement - adds character-specific patterns while maintaining authenticity",
        high: "Strong enhancement - creates distinctive voice patterns (may feel overly stylized)"
      },
      examples: {
        low: "\"I think we should go,\" she said quietly.",
        medium: "\"Reckon we oughta be movin',\" she drawled, eyes darting to the shadows.",
        high: "\"Verily, 'tis most prudent we depart forthwith,\" she intoned with courtly precision."
      }
    },
    worldConsistency: {
      label: "World Building",
      icon: Globe,
      color: "green",
      description: "Magic system rules, geography, world logic consistency, universe fact integration",
      tips: {
        low: "Light world details - maintains mystery and lets readers fill gaps",
        medium: "Balanced world building - clear rules without overwhelming exposition",
        high: "Detailed explanations - comprehensive universe building but may feel like info-dumping"
      },
      examples: {
        low: "Magic sparked at her fingertips.",
        medium: "The familiar warmth of life magic flowed through her hands, limited by her exhaustion.",
        high: "Drawing upon the third tier of vital essence manipulation, she channeled bio-thaumic energy through her meridian pathways, the effort depleting her stamina reserves by approximately fifteen percent."
      }
    },
    plotProgression: {
      label: "Plot Pacing",
      icon: TrendingUp,
      color: "yellow",
      description: "Story tension, pacing control, plot thread advancement, scene transitions",
      tips: {
        low: "Gentle pacing - character-focused scenes with natural progression",
        medium: "Balanced progression - steady advancement with good tension beats",
        high: "Fast pacing - high tension and rapid plot movement but may feel rushed"
      },
      examples: {
        low: "They talked through the evening, sharing stories of their past.",
        medium: "As midnight approached, their conversation turned to the urgent matter at hand - the approaching army.",
        high: "\"They're here!\" The shout shattered the night. Arrows whistled. Steel rang. The battle had begun."
      }
    },
    technicalQuality: {
      label: "Technical Polish",
      icon: Sparkles,
      color: "blue",
      description: "Prose quality, sentence structure, literary technique, grammar refinement",
      tips: {
        low: "Natural prose - maintains author's original voice and style",
        medium: "Polished writing - improved flow, clarity, and readability",
        high: "Literary enhancement - sophisticated language but may sound artificial"
      },
      examples: {
        low: "The sun was setting and it was getting dark.",
        medium: "The sun dipped below the horizon, casting long shadows across the valley.",
        high: "Twilight descended like a velvet curtain, the dying sun painting the firmament in hues of amber and crimson while shadows unfurled their tendrils across the verdant vale."
      }
    }
  }

  // Preset configurations
  const presetConfigs = {
    conservative: {
      name: "Conservative",
      description: "Minimal changes, preserves original style",
      icon: Target,
      values: { characterVoice: 25, worldConsistency: 30, plotProgression: 20, technicalQuality: 35 }
    },
    balanced: {
      name: "Balanced",
      description: "Moderate enhancements across all areas",
      icon: Settings,
      values: { characterVoice: 50, worldConsistency: 55, plotProgression: 50, technicalQuality: 60 }
    },
    aggressive: {
      name: "Aggressive",
      description: "Strong enhancements for maximum improvement",
      icon: Zap,
      values: { characterVoice: 80, worldConsistency: 85, plotProgression: 75, technicalQuality: 85 }
    }
  }

  // Handle slider value changes
  const handleSliderChange = useCallback((key: keyof SliderValues, value: number) => {
    setSliderValues(prev => {
      const newValues = { ...prev, [key]: value }
      setPresetMode('custom')
      setHasUnsavedChanges(true)
      return newValues
    })
  }, [])

  // Apply preset
  const applyPreset = useCallback((preset: keyof typeof presetConfigs) => {
    const config = presetConfigs[preset]
    setSliderValues(config.values)
    setPresetMode(preset)
    setHasUnsavedChanges(true)
  }, [])

  // Reset to original values
  const resetToOriginal = useCallback(() => {
    setSliderValues({
      characterVoice: analysisResults.characterVoiceAccuracy,
      worldConsistency: analysisResults.worldConsistency,
      plotProgression: analysisResults.plotProgression,
      technicalQuality: analysisResults.technicalQuality
    })
    setPresetMode('custom')
    setHasUnsavedChanges(true)
  }, [analysisResults])

  // Save changes
  const saveChanges = useCallback(() => {
    onEnhancementChange(sliderValues)
    setHasUnsavedChanges(false)
  }, [sliderValues, onEnhancementChange])

  // Calculate enhancement impact
  const getEnhancementImpact = useCallback(() => {
    const original = analysisResults.overallScore
    const enhanced = Object.values(sliderValues).reduce((sum, val) => sum + val, 0) / 4
    return Math.round(enhanced - original)
  }, [sliderValues, analysisResults.overallScore])

  // Get compression estimate
  const getCompressionEstimate = useCallback(() => {
    const intensityFactor = Object.values(sliderValues).reduce((sum, val) => sum + val, 0) / 400
    const baseCompression = analysisResults.sfslCompressionRatio || 0.75
    return Math.max(0.1, Math.min(0.9, baseCompression - (intensityFactor * 0.15)))
  }, [sliderValues, analysisResults.sfslCompressionRatio])

  useEffect(() => {
    // Auto-save when changes are made (debounced)
    const timer = setTimeout(() => {
      if (hasUnsavedChanges && !disabled) {
        saveChanges()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [sliderValues, hasUnsavedChanges, disabled, saveChanges])

  return (
    <div className="enhancement-sliders space-y-6">
      {/* Header with Impact Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Enhancement Controls
              </CardTitle>
              <CardDescription>
                Fine-tune your story enhancement with SFSL-powered analysis
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {getEnhancementImpact() > 0 ? '+' : ''}{getEnhancementImpact()}%
              </div>
              <div className="text-sm text-gray-600">Quality Impact</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-800">
                {Math.round(getCompressionEstimate() * 100)}%
              </div>
              <div className="text-sm text-gray-600">SFSL Compression</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-800">
                {analysisResults.issuesFound || 0}
              </div>
              <div className="text-sm text-gray-600">Issues Addressed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-800">
                {storyGenre}
              </div>
              <div className="text-sm text-gray-600">Genre Optimization</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sliders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sliders">Custom Controls</TabsTrigger>
          <TabsTrigger value="presets">Quick Presets</TabsTrigger>
        </TabsList>

        {/* Custom Sliders Tab */}
        <TabsContent value="sliders" className="space-y-4">
          {Object.entries(sliderConfigs).map(([key, config]) => (
            <SliderControl
              key={key}
              config={config}
              value={sliderValues[key as keyof SliderValues]}
              originalScore={analysisResults[key as keyof AnalysisResults] as number}
              onChange={(value) => handleSliderChange(key as keyof SliderValues, value)}
              disabled={disabled || isLoading}
            />
          ))}

          {/* Action Buttons */}
          <div className="slider-actions">
            <div className="action-group">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToOriginal}
                disabled={disabled || isLoading}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Original
              </Button>
            </div>
            <div className="action-group">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-orange-600">
                  Unsaved Changes
                </Badge>
              )}
              <Button
                onClick={saveChanges}
                disabled={disabled || isLoading || !hasUnsavedChanges}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Apply Enhancement
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Presets Tab */}
        <TabsContent value="presets" className="space-y-4">
          <div className="preset-grid">
            {Object.entries(presetConfigs).map(([key, preset]) => (
              <div
                key={key}
                className={`preset-card ${presetMode === key ? 'selected' : ''}`}
                onClick={() => applyPreset(key as keyof typeof presetConfigs)}
              >
                <div className="preset-header">
                  <preset.icon className="preset-icon" />
                  <h3 className="preset-name">{preset.name}</h3>
                </div>
                <p className="preset-description">{preset.description}</p>
                <div className="preset-values">
                  {Object.entries(preset.values).map(([sliderKey, value]) => (
                    <div key={sliderKey} className="preset-value-row">
                      <span className="preset-value-label">
                        {sliderConfigs[sliderKey as keyof SliderValues].label}
                      </span>
                      <span className="preset-value-number">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Enhanced slider component with category-specific styling
interface SliderControlProps {
  config: SliderConfig
  value: number
  originalScore: number
  onChange: (value: number) => void
  disabled?: boolean
}

function SliderControl({ config, value, originalScore, onChange, disabled = false }: SliderControlProps) {
  const getIntensityLevel = (val: number): 'low' | 'medium' | 'high' => {
    if (val < 33) return 'low'
    if (val < 67) return 'medium'
    return 'high'
  }

  const getSliderColor = (color: SliderConfig['color']) => {
    const colors = {
      red: 'from-red-200 via-red-400 to-red-600',
      green: 'from-green-200 via-green-400 to-green-600',
      yellow: 'from-yellow-200 via-yellow-400 to-yellow-600',
      blue: 'from-blue-200 via-blue-400 to-blue-600',
      purple: 'from-purple-200 via-purple-400 to-purple-600',
      indigo: 'from-indigo-200 via-indigo-400 to-indigo-600'
    }
    return colors[color]
  }

  const getBorderColor = (color: SliderConfig['color']) => {
    const colors = {
      red: 'border-red-300',
      green: 'border-green-300',
      yellow: 'border-yellow-300',
      blue: 'border-blue-300',
      purple: 'border-purple-300',
      indigo: 'border-indigo-300'
    }
    return colors[color]
  }

  const intensityLevel = getIntensityLevel(value)
  const change = value - originalScore

  return (
    <div className={`enhancement-category intensity-${intensityLevel} ${disabled ? 'loading' : ''}`}>
      {/* Header */}
      <div className="category-header">
        <div className="category-title">
          <div className="category-icon">
            <config.icon className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">{config.label}</h4>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>
        <div className="category-value">
          <div className="current-value">{value}%</div>
          <div className="original-value">
            was: {originalScore}%
            {change !== 0 && (
              <span className={`value-change ${change > 0 ? 'positive' : 'negative'}`}>
                {change > 0 ? '+' : ''}{change}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-3">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className={`slider ${config.color.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
        />

        {/* Intensity indicators */}
        <div className="intensity-indicators">
          <div className={`intensity-indicator ${intensityLevel === 'low' ? 'active' : ''}`}>
            Minimal (0-33%)
          </div>
          <div className={`intensity-indicator ${intensityLevel === 'medium' ? 'active' : ''}`}>
            Moderate (34-66%)
          </div>
          <div className={`intensity-indicator ${intensityLevel === 'high' ? 'active' : ''}`}>
            Strong (67-100%)
          </div>
        </div>
      </div>

      {/* Tips and Examples */}
      <div className="enhancement-tip">
        <div className="tip-header">
          <Info className="w-4 h-4 text-gray-600" />
          <span>
            {intensityLevel.charAt(0).toUpperCase() + intensityLevel.slice(1)} Enhancement
          </span>
        </div>
        <div className="tip-content">
          {config.tips[intensityLevel]}
        </div>
        <div className="tip-example">
          <div className="example-label">Example:</div>
          <div>"{config.examples[intensityLevel]}"</div>
        </div>
      </div>
    </div>
  )
}

// Export for use in other components
export type { AnalysisResults, SliderValues }