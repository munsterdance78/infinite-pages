'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Globe,
  Mountain,
  Castle,
  Sparkles,
  Map,
  BookOpen,
  Wand2,
  TreePine,
  Sword,
  Crown,
  Star
} from 'lucide-react'

interface WorldElement {
  id: string
  name: string
  type: 'location' | 'culture' | 'magic' | 'technology' | 'history' | 'religion'
  description: string
  properties: Record<string, any>
}

interface WorldBuilderButtonsProps {
  storyId?: string
  onWorldElementCreated?: (element: WorldElement) => void
}

export default function WorldBuilderButtons({
  storyId,
  onWorldElementCreated
}: WorldBuilderButtonsProps) {
  const [worldElements, setWorldElements] = useState<WorldElement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Form states
  const [universeType, setUniverseType] = useState('')
  const [magicSystem, setMagicSystem] = useState('')
  const [elementName, setElementName] = useState('')
  const [elementType, setElementType] = useState('')
  const [elementDescription, setElementDescription] = useState('')

  const universeTypes = [
    'fantasy',
    'sci-fi',
    'modern',
    'historical',
    'steampunk',
    'cyberpunk',
    'post-apocalyptic',
    'urban-fantasy'
  ]

  const magicSystems = [
    'elemental',
    'divine',
    'arcane',
    'rune-based',
    'ritual',
    'innate',
    'artifact-based',
    'none'
  ]

  const elementTypes = [
    'location',
    'culture',
    'magic',
    'technology',
    'history',
    'religion'
  ]

  const setupUniverse = async () => {
    if (!universeType) {
      console.error('Universe type required')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch(`/api/stories/${storyId || 'demo'}/universe/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          universeType,
          magicSystem: magicSystem || 'none',
          workflowPhase: 'setup'
        })
      })

      if (!response.ok) {
        throw new Error(`Universe setup failed: ${response.status}`)
      }

      const result = await response.json()

      // Create initial world elements from result
      if (result.locations) {
        result.locations.forEach((location: any) => {
          const element: WorldElement = {
            id: Date.now().toString() + Math.random(),
            name: location.name || 'Generated Location',
            type: 'location',
            description: location.description || 'AI-generated location',
            properties: {
              climate: location.climate,
              population: location.population,
              significance: location.significance
            }
          }
          setWorldElements(prev => [...prev, element])
          onWorldElementCreated?.(element)
        })
      }

      if (result.cultures) {
        result.cultures.forEach((culture: any) => {
          const element: WorldElement = {
            id: Date.now().toString() + Math.random(),
            name: culture.name || 'Generated Culture',
            type: 'culture',
            description: culture.description || 'AI-generated culture',
            properties: {
              values: culture.values,
              traditions: culture.traditions,
              government: culture.government
            }
          }
          setWorldElements(prev => [...prev, element])
          onWorldElementCreated?.(element)
        })
      }

      console.log('✅ Universe setup completed:', result)

    } catch (error) {
      console.error('❌ Universe setup error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const addWorldElement = () => {
    if (!elementName.trim() || !elementType) {
      console.error('Element name and type required')
      return
    }

    const newElement: WorldElement = {
      id: Date.now().toString(),
      name: elementName.trim(),
      type: elementType as WorldElement['type'],
      description: elementDescription.trim() || 'No description provided',
      properties: {}
    }

    setWorldElements(prev => [...prev, newElement])
    onWorldElementCreated?.(newElement)

    // Clear form
    setElementName('')
    setElementType('')
    setElementDescription('')

    console.log('✅ World element added:', newElement)
  }

  const generateWorldElement = async () => {
    if (!elementType) {
      console.error('Element type required for generation')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch(`/api/stories/${storyId || 'demo'}/world/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          elementType,
          elementName: elementName.trim(),
          elementDescription: elementDescription.trim(),
          workflowPhase: 'generate'
        })
      })

      if (!response.ok) {
        throw new Error(`World generation failed: ${response.status}`)
      }

      const result = await response.json()

      const newElement: WorldElement = {
        id: Date.now().toString(),
        name: result.name || elementName.trim() || `Generated ${elementType}`,
        type: elementType as WorldElement['type'],
        description: result.description || elementDescription.trim() || `AI-generated ${elementType} with unique characteristics.`,
        properties: {
          generated: true,
          ...result.properties
        }
      }

      setWorldElements(prev => [...prev, newElement])
      onWorldElementCreated?.(newElement)

      // Clear form
      setElementName('')
      setElementType('')
      setElementDescription('')

      console.log('✅ Generated world element:', newElement)

    } catch (error) {
      console.error('❌ World generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const removeWorldElement = (elementId: string) => {
    setWorldElements(prev => prev.filter(element => element.id !== elementId))
  }

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'location': return <Map className="h-4 w-4" />
      case 'culture': return <Crown className="h-4 w-4" />
      case 'magic': return <Sparkles className="h-4 w-4" />
      case 'technology': return <Sword className="h-4 w-4" />
      case 'history': return <BookOpen className="h-4 w-4" />
      case 'religion': return <Star className="h-4 w-4" />
      default: return <Globe className="h-4 w-4" />
    }
  }

  const getElementColor = (type: string) => {
    switch (type) {
      case 'location': return 'bg-green-100 text-green-800'
      case 'culture': return 'bg-purple-100 text-purple-800'
      case 'magic': return 'bg-blue-100 text-blue-800'
      case 'technology': return 'bg-orange-100 text-orange-800'
      case 'history': return 'bg-yellow-100 text-yellow-800'
      case 'religion': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          World Builder Interface
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Universe Setup */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Castle className="h-4 w-4" />
              Universe Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Universe Type</label>
                <Select value={universeType} onValueChange={setUniverseType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select universe type" />
                  </SelectTrigger>
                  <SelectContent>
                    {universeTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Magic System</label>
                <Select value={magicSystem} onValueChange={setMagicSystem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select magic system" />
                  </SelectTrigger>
                  <SelectContent>
                    {magicSystems.map(system => (
                      <SelectItem key={system} value={system}>
                        {system.charAt(0).toUpperCase() + system.slice(1).replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={setupUniverse}
              disabled={isGenerating || !universeType}
              className="flex items-center gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {isGenerating ? 'Setting up Universe...' : 'Setup Universe'}
            </Button>
          </CardContent>
        </Card>

        {/* World Element Creator */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mountain className="h-4 w-4" />
              Create World Elements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Element Name</label>
                <Input
                  placeholder="Enter element name..."
                  value={elementName}
                  onChange={(e) => setElementName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Element Type</label>
                <Select value={elementType} onValueChange={setElementType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select element type" />
                  </SelectTrigger>
                  <SelectContent>
                    {elementTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {getElementIcon(type)}
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe this world element..."
                value={elementDescription}
                onChange={(e) => setElementDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={generateWorldElement}
                disabled={isGenerating || !elementType}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'AI Generate'}
              </Button>

              <Button
                onClick={addWorldElement}
                variant="outline"
                className="flex items-center gap-2"
              >
                <TreePine className="h-4 w-4" />
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* World Elements List */}
        {worldElements.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">World Elements ({worldElements.length})</h3>

            {/* Element Type Groups */}
            {elementTypes.map(type => {
              const typeElements = worldElements.filter(element => element.type === type)
              if (typeElements.length === 0) return null

              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getElementIcon(type)}
                    <h4 className="font-medium capitalize">{type}s ({typeElements.length})</h4>
                  </div>

                  <div className="grid gap-2 ml-6">
                    {typeElements.map((element) => (
                      <Card key={element.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-medium">{element.name}</h5>
                                <Badge className={getElementColor(element.type)}>
                                  {element.type}
                                </Badge>
                                {element.properties.generated && (
                                  <Badge variant="outline" className="text-xs">
                                    AI Generated
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {element.description}
                              </p>
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeWorldElement(element.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} |
          V2.0 World Builder System |
          Universe: {universeType || 'Not set'} |
          Magic: {magicSystem || 'Not set'} |
          Elements: {worldElements.length}
        </div>
      </CardContent>
    </Card>
  )
}