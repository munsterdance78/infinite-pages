'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Brain,
  BookOpen,
  FileText,
  Plus,
  Edit3,
  Save,
  Download,
  Eye,
  RefreshCw,
  Zap,
  Clock,
  BarChart3,
  Target,
  Layers
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'basic' | 'premium'
  credits_balance: number
  is_creator?: boolean
}

interface NovelCreationProps {
  userProfile: UserProfile
}

interface Novel {
  id: string
  title: string
  description: string
  genre: string
  target_length: number
  status: 'planning' | 'writing' | 'completed' | 'published'
  created_at: string
  updated_at: string
  total_chapters: number
  completed_chapters: number
  total_words: number
}

interface Chapter {
  id: string
  novel_id: string
  chapter_number: number
  title: string
  content: string
  word_count: number
  status: 'draft' | 'completed' | 'published'
  created_at: string
  updated_at: string
}

interface ChapterRequest {
  title: string
  outline: string
  previous_context: string
  target_words: number
}

export default function NovelCreation({ userProfile }: NovelCreationProps) {
  const [novels, setNovels] = useState<Novel[]>([])
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null)
  const [showNewNovelForm, setShowNewNovelForm] = useState(false)
  const [showChapterForm, setShowChapterForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [newNovel, setNewNovel] = useState({
    title: '',
    description: '',
    genre: 'fantasy',
    target_length: 50000
  })

  const [chapterRequest, setChapterRequest] = useState<ChapterRequest>({
    title: '',
    outline: '',
    previous_context: '',
    target_words: 2500
  })

  const supabase = createClient()

  const genres = [
    'fantasy', 'sci-fi', 'romance', 'mystery', 'thriller',
    'horror', 'adventure', 'drama', 'historical', 'contemporary'
  ]

  const targetLengths = [
    { value: 30000, label: 'Novella (30k words)' },
    { value: 50000, label: 'Short Novel (50k words)' },
    { value: 80000, label: 'Standard Novel (80k words)' },
    { value: 120000, label: 'Long Novel (120k words)' }
  ]

  useEffect(() => {
    loadNovels()
  }, [])

  useEffect(() => {
    if (selectedNovel) {
      loadChapters(selectedNovel.id)
    }
  }, [selectedNovel])

  const loadNovels = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('creator_id', userProfile.id)
        .eq('story_type', 'novel')
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error loading novels:', error)
        return
      }

      // Map stories to novel structure
      const mappedNovels = data?.map(story => ({
        id: story.id,
        title: story.title,
        description: story.description || '',
        genre: story.genre,
        target_length: story.target_word_count || 50000,
        status: story.status as 'planning' | 'writing' | 'completed' | 'published',
        created_at: story.created_at,
        updated_at: story.updated_at,
        total_chapters: story.chapter_count || 0,
        completed_chapters: story.completed_chapters || 0,
        total_words: story.word_count || 0
      })) || []

      setNovels(mappedNovels)
      if (mappedNovels && mappedNovels.length > 0 && !selectedNovel) {
        setSelectedNovel(mappedNovels[0])
      }
    } catch (error) {
      console.error('Error loading novels:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChapters = async (novelId: string) => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('story_id', novelId)
        .order('chapter_number', { ascending: true })

      if (error) {
        console.error('Error loading chapters:', error)
        return
      }

      // Map chapters to match our interface
      const mappedChapters = data?.map(chapter => ({
        id: chapter.id,
        novel_id: chapter.story_id,
        chapter_number: chapter.chapter_number,
        title: chapter.title || `Chapter ${chapter.chapter_number}`,
        content: chapter.content || '',
        word_count: chapter.word_count || 0,
        status: chapter.status as 'draft' | 'completed' | 'published',
        created_at: chapter.created_at,
        updated_at: chapter.updated_at
      })) || []

      setChapters(mappedChapters)
    } catch (error) {
      console.error('Error loading chapters:', error)
    }
  }

  const handleCreateNovel = async () => {
    if (!newNovel.title.trim()) {
      alert('Please provide a novel title')
      return
    }

    try {
      const { data, error } = await supabase
        .from('stories')
        .insert({
          title: newNovel.title,
          description: newNovel.description,
          genre: newNovel.genre,
          target_word_count: newNovel.target_length,
          creator_id: userProfile.id,
          status: 'draft',
          story_type: 'novel',
          chapter_count: 0,
          completed_chapters: 0,
          word_count: 0
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating novel:', error)
        alert('Failed to create novel')
        return
      }

      // Map the created story to novel structure
      const novelData = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        genre: data.genre,
        target_length: data.target_word_count || 50000,
        status: data.status as 'planning' | 'writing' | 'completed' | 'published',
        created_at: data.created_at,
        updated_at: data.updated_at,
        total_chapters: data.chapter_count || 0,
        completed_chapters: data.completed_chapters || 0,
        total_words: data.word_count || 0
      }

      setNovels(prev => [novelData, ...prev])
      setSelectedNovel(novelData)
      setShowNewNovelForm(false)
      setNewNovel({ title: '', description: '', genre: 'fantasy', target_length: 50000 })
    } catch (error) {
      console.error('Error creating novel:', error)
      alert('Failed to create novel')
    }
  }

  const handleGenerateChapter = async () => {
    if (!selectedNovel || !chapterRequest.title.trim() || !chapterRequest.outline.trim()) {
      alert('Please provide chapter title and outline')
      return
    }

    const estimatedCost = Math.ceil(chapterRequest.target_words / 500) * 2
    if (userProfile.credits_balance < estimatedCost) {
      alert(`Insufficient credits. You need ${estimatedCost} credits to generate this chapter.`)
      return
    }

    setGenerating(true)

    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: chapterRequest.title,
          prompt: `Chapter ${chapters.length + 1}: ${chapterRequest.outline}\n\nPrevious context: ${chapterRequest.previous_context}\n\nNovel context - Title: ${selectedNovel.title}, Genre: ${selectedNovel.genre}, Description: ${selectedNovel.description}`,
          genre: selectedNovel.genre,
          length: chapterRequest.target_words > 3000 ? 'long' : chapterRequest.target_words > 1500 ? 'medium' : 'short',
          user_id: userProfile.id,
          story_type: 'chapter',
          parent_story_id: selectedNovel.id,
          chapter_number: chapters.length + 1
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate chapter')
      }

      const result = await response.json()

      await loadChapters(selectedNovel.id)
      await loadNovels() // Refresh novel stats

      setSelectedChapter(result)
      setShowChapterForm(false)
      setChapterRequest({
        title: '',
        outline: '',
        previous_context: '',
        target_words: 2500
      })

    } catch (error) {
      console.error('Error generating chapter:', error)
      alert('Failed to generate chapter. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveChapter = async (chapter: Chapter) => {
    try {
      const { error } = await supabase
        .from('chapters')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', chapter.id)

      if (error) {
        console.error('Error saving chapter:', error)
        alert('Failed to save chapter')
        return
      }

      await loadChapters(selectedNovel!.id)
      alert('Chapter saved successfully!')
    } catch (error) {
      console.error('Error saving chapter:', error)
      alert('Failed to save chapter')
    }
  }

  const handleExportNovel = (novel: Novel) => {
    const allContent = chapters
      .sort((a, b) => a.chapter_number - b.chapter_number)
      .map(chapter => `Chapter ${chapter.chapter_number}: ${chapter.title}\n\n${chapter.content}`)
      .join('\n\n---\n\n')

    const fullContent = `${novel.title}\n\nBy: ${userProfile.email}\n\nGenre: ${novel.genre}\n\nDescription:\n${novel.description}\n\n${'='.repeat(50)}\n\n${allContent}`

    const element = document.createElement('a')
    const file = new Blob([fullContent], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${novel.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Novel Creation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Novel Creation</h1>
          <p className="text-gray-600 mt-1">Professional chapter generation system</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">{userProfile.credits_balance} credits</span>
          </div>
          <Button onClick={() => setShowNewNovelForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Novel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Novels Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5" />
                <span>Your Novels</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {novels.length > 0 ? (
                <div className="space-y-2">
                  {novels.map((novel) => (
                    <div
                      key={novel.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedNovel?.id === novel.id
                          ? 'bg-blue-100 border border-blue-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedNovel(novel)}
                    >
                      <h4 className="font-medium text-gray-900 truncate">
                        {novel.title}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {novel.status}
                        </Badge>
                        <span>{novel.completed_chapters}/{novel.total_chapters || '?'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {novel.total_words.toLocaleString()} words
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No novels yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setShowNewNovelForm(true)}
                  >
                    Create First Novel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedNovel ? (
            <>
              {/* Novel Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedNovel.title}</CardTitle>
                      <p className="text-gray-600 mt-1">{selectedNovel.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportNovel(selectedNovel)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowChapterForm(true)}
                        disabled={generating}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Chapter
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedNovel.completed_chapters}
                      </div>
                      <div className="text-sm text-gray-600">Chapters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedNovel.total_words.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Words</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round((selectedNovel.total_words / selectedNovel.target_length) * 100)}%
                      </div>
                      <div className="text-sm text-gray-600">Complete</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedNovel.genre}
                      </div>
                      <div className="text-sm text-gray-600">Genre</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Progress to {selectedNovel.target_length.toLocaleString()} words</span>
                      <span>{Math.round((selectedNovel.total_words / selectedNovel.target_length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (selectedNovel.total_words / selectedNovel.target_length) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chapters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Layers className="w-5 h-5" />
                    <span>Chapters</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chapters.length > 0 ? (
                    <div className="space-y-3">
                      {chapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedChapter?.id === chapter.id
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedChapter(chapter)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                Chapter {chapter.chapter_number}: {chapter.title}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                <span>{chapter.word_count} words</span>
                                <Badge
                                  variant={chapter.status === 'completed' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {chapter.status}
                                </Badge>
                                <span>{new Date(chapter.updated_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedChapter(chapter)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveChapter(chapter)
                                }}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No chapters yet</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setShowChapterForm(true)}
                      >
                        Write First Chapter
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chapter Content */}
              {selectedChapter && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Chapter {selectedChapter.chapter_number}: {selectedChapter.title}
                    </CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{selectedChapter.word_count} words</span>
                      <span>•</span>
                      <span>Last updated: {new Date(selectedChapter.updated_at).toLocaleDateString()}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <div className="bg-gray-50 rounded-lg p-6 max-h-96 overflow-y-auto">
                        {selectedChapter.content.split('\n').map((paragraph, index) => (
                          <p key={index} className="mb-4 last:mb-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your Novel Journey</h3>
                <p className="text-gray-600 mb-4">Create your first novel to begin writing with AI assistance</p>
                <Button onClick={() => setShowNewNovelForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Novel
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New Novel Modal */}
      {showNewNovelForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Create New Novel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Novel Title *
                </label>
                <Input
                  placeholder="Enter your novel title..."
                  value={newNovel.title}
                  onChange={(e) => setNewNovel(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="Brief description of your novel..."
                  value={newNovel.description}
                  onChange={(e) => setNewNovel(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre
                  </label>
                  <select
                    value={newNovel.genre}
                    onChange={(e) => setNewNovel(prev => ({ ...prev, genre: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {genres.map(genre => (
                      <option key={genre} value={genre}>
                        {genre.charAt(0).toUpperCase() + genre.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Length
                  </label>
                  <select
                    value={newNovel.target_length}
                    onChange={(e) => setNewNovel(prev => ({ ...prev, target_length: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {targetLengths.map(length => (
                      <option key={length.value} value={length.value}>
                        {length.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowNewNovelForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateNovel}>
                  Create Novel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chapter Generation Modal */}
      {showChapterForm && selectedNovel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Generate Chapter {chapters.length + 1}</CardTitle>
              <p className="text-gray-600">Create a new chapter for "{selectedNovel.title}"</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chapter Title *
                </label>
                <Input
                  placeholder="Enter chapter title..."
                  value={chapterRequest.title}
                  onChange={(e) => setChapterRequest(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chapter Outline *
                </label>
                <Textarea
                  placeholder="Describe what happens in this chapter, key plot points, character development..."
                  value={chapterRequest.outline}
                  onChange={(e) => setChapterRequest(prev => ({ ...prev, outline: e.target.value }))}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Previous Context (Optional)
                </label>
                <Textarea
                  placeholder="Summary of previous events or context from earlier chapters..."
                  value={chapterRequest.previous_context}
                  onChange={(e) => setChapterRequest(prev => ({ ...prev, previous_context: e.target.value }))}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Word Count
                </label>
                <select
                  value={chapterRequest.target_words}
                  onChange={(e) => setChapterRequest(prev => ({ ...prev, target_words: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1500}>Short Chapter (1,500 words)</option>
                  <option value={2500}>Standard Chapter (2,500 words)</option>
                  <option value={4000}>Long Chapter (4,000 words)</option>
                  <option value={6000}>Extended Chapter (6,000 words)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Estimated cost: {Math.ceil(chapterRequest.target_words / 500) * 2} credits
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowChapterForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateChapter}
                  disabled={generating || !chapterRequest.title.trim() || !chapterRequest.outline.trim()}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate Chapter
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}