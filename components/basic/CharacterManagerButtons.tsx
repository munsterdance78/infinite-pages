'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Sparkles,
  Search,
  Crown,
  Sword,
  Heart,
  Brain
} from 'lucide-react'

interface Character {
  id: string
  name: string
  role: string
  traits: string[]
  description: string
  relationships: string[]
}

interface CharacterManagerButtonsProps {
  storyId?: string
  onCharacterCreated?: (character: Character) => void
  onCharacterUpdated?: (character: Character) => void
}

export default function CharacterManagerButtons({
  storyId,
  onCharacterCreated,
  onCharacterUpdated
}: CharacterManagerButtonsProps) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form states
  const [characterName, setCharacterName] = useState('')
  const [characterRole, setCharacterRole] = useState('')
  const [characterTraits, setCharacterTraits] = useState('')
  const [characterDescription, setCharacterDescription] = useState('')

  const characterRoles = [
    'protagonist',
    'antagonist',
    'supporting',
    'mentor',
    'ally',
    'neutral',
    'mysterious'
  ]

  const commonTraits = [
    'brave', 'intelligent', 'cunning', 'loyal', 'ambitious',
    'compassionate', 'mysterious', 'charismatic', 'stubborn', 'wise'
  ]

  const generateCharacter = async () => {
    setIsGenerating(true)

    try {
      // Use guest API for unauthenticated character generation
      const isGuestMode = !storyId || storyId === 'demo'
      const guestStoryId = isGuestMode ? 'guest-demo-story' : storyId
      const endpoint = isGuestMode
        ? `/api/stories/guest/${guestStoryId}/characters/generate`
        : `/api/stories/${storyId}/characters/generate`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: characterRole || 'protagonist',
          traits: characterTraits.split(',').map(t => t.trim()).filter(Boolean),
          workflowPhase: 'generate'
        })
      })

      if (!response.ok) {
        throw new Error(`Character generation failed: ${response.status}`)
      }

      const result = await response.json()

      // Create character from result
      const newCharacter: Character = {
        id: Date.now().toString(),
        name: result.name || characterName || 'Generated Character',
        role: result.role || characterRole || 'protagonist',
        traits: result.traits || characterTraits.split(',').map(t => t.trim()).filter(Boolean),
        description: result.description || result.bio || 'AI-generated character',
        relationships: result.relationships || []
      }

      setCharacters(prev => [...prev, newCharacter])
      onCharacterCreated?.(newCharacter)

      // Clear form
      setCharacterName('')
      setCharacterRole('')
      setCharacterTraits('')
      setCharacterDescription('')

      console.log('✅ Character generated:', newCharacter)

    } catch (error) {
      console.error('❌ Character generation error:', error)
      alert('Failed to generate character. Check console for details.')
    } finally {
      setIsGenerating(false)
    }
  }

  const createManualCharacter = () => {
    if (!characterName.trim()) {
      alert('Please enter a character name')
      return
    }

    const newCharacter: Character = {
      id: Date.now().toString(),
      name: characterName.trim(),
      role: characterRole || 'supporting',
      traits: characterTraits.split(',').map(t => t.trim()).filter(Boolean),
      description: characterDescription.trim() || 'No description provided',
      relationships: []
    }

    setCharacters(prev => [...prev, newCharacter])
    onCharacterCreated?.(newCharacter)

    // Clear form
    setCharacterName('')
    setCharacterRole('')
    setCharacterTraits('')
    setCharacterDescription('')

    console.log('✅ Manual character created:', newCharacter)
  }

  const editCharacter = (character: Character) => {
    setSelectedCharacter(character)
    setCharacterName(character.name)
    setCharacterRole(character.role)
    setCharacterTraits(character.traits.join(', '))
    setCharacterDescription(character.description)
    setIsEditing(true)
  }

  const saveCharacter = () => {
    if (!selectedCharacter) return

    const updatedCharacter: Character = {
      ...selectedCharacter,
      name: characterName.trim(),
      role: characterRole,
      traits: characterTraits.split(',').map(t => t.trim()).filter(Boolean),
      description: characterDescription.trim()
    }

    setCharacters(prev =>
      prev.map(char => char.id === selectedCharacter.id ? updatedCharacter : char)
    )

    onCharacterUpdated?.(updatedCharacter)
    cancelEdit()

    console.log('✅ Character updated:', updatedCharacter)
  }

  const deleteCharacter = (characterId: string) => {
    if (confirm('Are you sure you want to delete this character?')) {
      setCharacters(prev => prev.filter(char => char.id !== characterId))
      if (selectedCharacter?.id === characterId) {
        cancelEdit()
      }
    }
  }

  const cancelEdit = () => {
    setSelectedCharacter(null)
    setIsEditing(false)
    setCharacterName('')
    setCharacterRole('')
    setCharacterTraits('')
    setCharacterDescription('')
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'protagonist': return <Crown className="h-4 w-4" />
      case 'antagonist': return <Sword className="h-4 w-4" />
      case 'mentor': return <Brain className="h-4 w-4" />
      case 'ally': return <Heart className="h-4 w-4" />
      default: return <Users className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'protagonist': return 'bg-blue-100 text-blue-800'
      case 'antagonist': return 'bg-red-100 text-red-800'
      case 'mentor': return 'bg-purple-100 text-purple-800'
      case 'ally': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Character Manager Interface
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Character Form */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {isEditing ? (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Character
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create New Character
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Character Name</label>
                <Input
                  placeholder="Enter character name..."
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={characterRole} onValueChange={setCharacterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select character role" />
                  </SelectTrigger>
                  <SelectContent>
                    {characterRoles.map(role => (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role)}
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Traits (comma-separated)</label>
              <Input
                placeholder="brave, intelligent, mysterious..."
                value={characterTraits}
                onChange={(e) => setCharacterTraits(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {commonTraits.map(trait => (
                  <Badge
                    key={trait}
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const currentTraits = characterTraits.split(',').map(t => t.trim()).filter(Boolean)
                      if (!currentTraits.includes(trait)) {
                        setCharacterTraits(prev => prev ? `${prev}, ${trait}` : trait)
                      }
                    }}
                  >
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Character background, personality, goals..."
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button onClick={saveCharacter}>
                    Save Changes
                  </Button>
                  <Button onClick={cancelEdit} variant="outline">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={generateCharacter}
                    disabled={isGenerating}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? 'Generating...' : 'AI Generate'}
                  </Button>

                  <Button
                    onClick={createManualCharacter}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create Manually
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Character List */}
        {characters.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium">Characters ({characters.length})</h3>
            <div className="grid gap-3">
              {characters.map((character) => (
                <Card key={character.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(character.role)}
                            <h4 className="font-medium">{character.name}</h4>
                          </div>
                          <Badge className={getRoleColor(character.role)}>
                            {character.role}
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          {character.description}
                        </p>

                        {character.traits.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {character.traits.map((trait, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {trait}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editCharacter(character)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCharacter(character.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          Story ID: {storyId || 'demo'} |
          V2.0 Character Generation System |
          Characters: {characters.length} |
          Status: {isGenerating ? 'Generating...' : 'Ready'}
        </div>
      </CardContent>
    </Card>
  )
}