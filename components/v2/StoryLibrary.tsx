'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Zap,
  Brain,
  Globe
} from 'lucide-react'

interface Story {
  id: string
  title: string
  genre: string
  status: 'draft' | 'in-progress' | 'completed' | 'published'
  foundation: string
  created_at: string
  updated_at: string
  chapters?: Chapter[]
  universe_facts?: any
  character_count?: number
  word_count?: number
  sfsl_compression_ratio?: number
  last_analysis_score?: number
}

interface Chapter {
  id: string
  title: string
  content: string
  status: string
  created_at: string
  word_count?: number
}

interface LibraryStats {
  totalStories: number
  totalWordCount: number
  averageCompressionRatio: number
  completedStories: number
  universeStories: number
}

export function StoryLibrary() {
  const [stories, setStories] = useState<Story[]>([])
  const [libraryView, setLibraryView] = useState<'browse' | 'grid' | 'list' | 'universe'>('browse')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGenre, setFilterGenre] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title' | 'word_count'>('updated')
  const [libraryStats, setLibraryStats] = useState<LibraryStats | null>(null)

  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
  }, [])

  // Fetch stories with enhanced metadata
  const fetchStories = async () => {
    try {
      setLoading(true)

      // Get stories with chapter count and universe data
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select(`
          *,
          chapters(id, title, word_count, status),
          story_facts!inner(
            fact_type,
            compression_ratio,
            metadata
          )
        `)
        .eq('user_id', session?.user?.id)
        .order('updated_at', { ascending: false })

      if (storiesError) throw storiesError

      // Enhance stories with computed metadata
      const enhancedStories = storiesData?.map(story => ({
        ...story,
        chapter_count: story.chapters?.length || 0,
        word_count: story.chapters?.reduce((total: number, chapter: any) =>
          total + (chapter.word_count || 0), 0) || 0,
        sfsl_compression_ratio: story.story_facts?.find((f: any) =>
          f.fact_type === 'universe')?.compression_ratio || null,
        universe_facts: story.story_facts?.filter((f: any) =>
          f.fact_type === 'universe').length > 0,
        last_analysis_score: story.story_facts?.find((f: any) =>
          f.metadata?.overallScore)?.metadata?.overallScore || null
      })) || []

      setStories(enhancedStories)

      // Calculate library statistics
      const stats: LibraryStats = {
        totalStories: enhancedStories.length,
        totalWordCount: enhancedStories.reduce((total, story) => total + (story.word_count || 0), 0),
        averageCompressionRatio: enhancedStories
          .filter(s => s.sfsl_compression_ratio)
          .reduce((sum, s) => sum + (s.sfsl_compression_ratio || 0), 0) /
          enhancedStories.filter(s => s.sfsl_compression_ratio).length || 0,
        completedStories: enhancedStories.filter(s => s.status === 'completed').length,
        universeStories: enhancedStories.filter(s => s.universe_facts).length
      }

      setLibraryStats(stats)

    } catch (error) {
      console.error('Error fetching stories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchStories()
    }
  }, [session?.user?.id])

  // Filter and sort stories
  const filteredStories = stories
    .filter(story => {
      const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           story.genre.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesGenre = filterGenre === 'all' || story.genre === filterGenre
      const matchesStatus = filterStatus === 'all' || story.status === filterStatus
      return matchesSearch && matchesGenre && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'word_count':
          return (b.word_count || 0) - (a.word_count || 0)
        case 'updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

  // Get unique genres for filter
  const genres = Array.from(new Set(stories.map(s => s.genre))).filter(Boolean)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'published': return 'bg-blue-100 text-blue-800'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCompressionBadge = (ratio: number | null) => {
    if (!ratio) return null
    const percentage = Math.round((1 - ratio) * 100)
    const color = percentage > 50 ? 'bg-green-100 text-green-800' :
                  percentage > 25 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    return (
      <Badge variant="outline" className={color}>
        <Zap className="w-3 h-3 mr-1" />
        {percentage}% compressed
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your story library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="story-library p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Story Library</h1>
            <p className="text-gray-600">Manage your stories with enhanced SFSL analytics</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Story
          </Button>
        </div>

        {/* Library Statistics */}
        {libraryStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Stories</p>
                    <p className="text-2xl font-bold">{libraryStats.totalStories}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Words</p>
                    <p className="text-2xl font-bold">{libraryStats.totalWordCount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Zap className="w-5 h-5 text-yellow-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Compression</p>
                    <p className="text-2xl font-bold">
                      {libraryStats.averageCompressionRatio ?
                        `${Math.round((1 - libraryStats.averageCompressionRatio) * 100)}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold">{libraryStats.completedStories}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Globe className="w-5 h-5 text-indigo-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Universes</p>
                    <p className="text-2xl font-bold">{libraryStats.universeStories}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search stories by title or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterGenre} onValueChange={setFilterGenre}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last Updated</SelectItem>
                <SelectItem value="created">Date Created</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="word_count">Word Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Toggle */}
        <Tabs value={libraryView} onValueChange={(value: any) => setLibraryView(value)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="universe">Universe</TabsTrigger>
          </TabsList>

          {/* Browse View - Enhanced Cards */}
          <TabsContent value="browse" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStories.map(story => (
                <Card key={story.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-2">{story.title}</CardTitle>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardDescription className="line-clamp-3">{story.foundation}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{story.genre}</Badge>
                        <Badge className={getStatusColor(story.status)}>{story.status}</Badge>
                        {getCompressionBadge(story.sfsl_compression_ratio)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          {story.chapter_count || 0} chapters
                        </div>
                        <div className="flex items-center">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {(story.word_count || 0).toLocaleString()} words
                        </div>
                        {story.universe_facts && (
                          <div className="flex items-center">
                            <Globe className="w-4 h-4 mr-1" />
                            Universe built
                          </div>
                        )}
                        {story.last_analysis_score && (
                          <div className="flex items-center">
                            <Brain className="w-4 h-4 mr-1" />
                            {story.last_analysis_score}% quality
                          </div>
                        )}
                      </div>

                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        Updated {new Date(story.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Grid View - Compact */}
          <TabsContent value="grid" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredStories.map(story => (
                <Card key={story.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">{story.title}</h3>
                    <div className="space-y-2">
                      <Badge className={getStatusColor(story.status)} variant="secondary">
                        {story.status}
                      </Badge>
                      <p className="text-xs text-gray-600">{story.genre}</p>
                      <p className="text-xs text-gray-500">
                        {(story.word_count || 0).toLocaleString()} words
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* List View - Detailed */}
          <TabsContent value="list" className="mt-6">
            <div className="space-y-3">
              {filteredStories.map(story => (
                <Card key={story.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <h3 className="font-semibold text-lg">{story.title}</h3>
                          <Badge className={getStatusColor(story.status)}>{story.status}</Badge>
                          <Badge variant="outline">{story.genre}</Badge>
                          {getCompressionBadge(story.sfsl_compression_ratio)}
                        </div>
                        <p className="text-gray-600 mt-1 line-clamp-1">{story.foundation}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>{story.chapter_count || 0} chapters</span>
                          <span>{(story.word_count || 0).toLocaleString()} words</span>
                          <span>Updated {new Date(story.updated_at).toLocaleDateString()}</span>
                          {story.universe_facts && <span>🌍 Universe</span>}
                          {story.last_analysis_score && <span>🧠 {story.last_analysis_score}%</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Universe View - Stories with universe building */}
          <TabsContent value="universe" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredStories
                .filter(story => story.universe_facts)
                .map(story => (
                <Card key={story.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-indigo-600" />
                      <CardTitle className="text-lg">{story.title}</CardTitle>
                    </div>
                    <CardDescription>{story.foundation}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{story.genre}</Badge>
                        <Badge className={getStatusColor(story.status)}>{story.status}</Badge>
                        {getCompressionBadge(story.sfsl_compression_ratio)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          {story.chapter_count || 0} chapters
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {story.character_count || 0} characters
                        </div>
                        <div className="flex items-center">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {(story.word_count || 0).toLocaleString()} words
                        </div>
                        {story.last_analysis_score && (
                          <div className="flex items-center">
                            <Brain className="w-4 h-4 mr-1" />
                            {story.last_analysis_score}% quality
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">Universe Features</h4>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">Magic System</Badge>
                          <Badge variant="outline" className="text-xs">World Geography</Badge>
                          <Badge variant="outline" className="text-xs">Cultures</Badge>
                          <Badge variant="outline" className="text-xs">Timeline</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredStories.filter(story => story.universe_facts).length === 0 && (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Universe-Built Stories</h3>
                <p className="text-gray-600 mb-4">Start building rich, detailed universes for your stories</p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Universe
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Empty State */}
      {filteredStories.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No stories found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      )}

      {stories.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your library is empty</h3>
          <p className="text-gray-600 mb-4">Start your writing journey by creating your first story</p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Story
          </Button>
        </div>
      )}
    </div>
  )
}