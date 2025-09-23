'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Search,
  BookOpen,
  Clock,
  Star,
  Eye,
  Filter,
  SortAsc,
  Download,
  Share2,
  Heart
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'basic' | 'premium'
  credits_balance: number
  is_creator?: boolean
}

interface Story {
  id: string
  title: string
  description: string
  genre: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
  creator_id: string
  content: string
  word_count: number
  rating: number
  views: number
  likes: number
  creator_name?: string
  cover_image?: string
}

interface StoryLibraryProps {
  userProfile: UserProfile
}

export default function StoryLibrary({ userProfile }: StoryLibraryProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [currentPage, setCurrentPage] = useState(1)
  const storiesPerPage = 12
  const supabase = createClient()

  const genres = [
    'all', 'fantasy', 'sci-fi', 'romance', 'mystery', 'thriller',
    'horror', 'adventure', 'comedy', 'drama', 'historical', 'contemporary'
  ]

  useEffect(() => {
    loadStories()
  }, [selectedGenre, sortBy])

  const loadStories = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('stories')
        .select(`
          *,
          profiles:creator_id (
            full_name,
            display_name
          )
        `)
        .eq('status', 'published')

      if (selectedGenre !== 'all') {
        query = query.eq('genre', selectedGenre)
      }

      const { data, error } = await query
        .order(sortBy, { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error loading stories:', error)
        return
      }

      const formattedStories = data.map(story => {
        const storyTyped = story as any
        return {
          ...storyTyped,
          creator_name: storyTyped.profiles?.display_name || storyTyped.profiles?.full_name || 'Anonymous'
        }
      })

      setStories(formattedStories)
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const paginatedStories = filteredStories.slice(
    (currentPage - 1) * storiesPerPage,
    currentPage * storiesPerPage
  )

  const totalPages = Math.ceil(filteredStories.length / storiesPerPage)

  const handleLikeStory = async (storyId: string) => {
    // Implementation for liking stories
    console.log('Like story:', storyId)
  }

  const handleShareStory = async (storyId: string) => {
    // Implementation for sharing stories
    console.log('Share story:', storyId)
  }

  const handleDownloadStory = async (storyId: string) => {
    // Implementation for downloading stories
    console.log('Download story:', storyId)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading story library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Story Library</h1>
          <p className="text-gray-600 mt-1">Explore 10,000+ AI-generated stories</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            {filteredStories.length} stories
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search stories, authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Genre Filter */}
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {genres.map(genre => (
                <option key={genre} value={genre}>
                  {genre === 'all' ? 'All Genres' : genre.charAt(0).toUpperCase() + genre.slice(1)}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="created_at">Newest First</option>
              <option value="updated_at">Recently Updated</option>
              <option value="views">Most Popular</option>
              <option value="likes">Most Liked</option>
              <option value="word_count">Longest Stories</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Toggle filters panel visibility
                  console.log('Filters button clicked - filters panel functionality to be implemented');
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {paginatedStories.map((story) => (
          <Card key={story.id} className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="p-0">
              <div className="aspect-[3/4] bg-gradient-to-br from-blue-100 to-purple-100 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                {story.cover_image ? (
                  <img
                    src={story.cover_image}
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="w-16 h-16 text-blue-600/50" />
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    {story.genre}
                  </Badge>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center space-x-2 text-white">
                  <div className="flex items-center space-x-1 bg-black/50 rounded px-2 py-1">
                    <Eye className="w-3 h-3" />
                    <span className="text-xs">{story.views || 0}</span>
                  </div>
                  <div className="flex items-center space-x-1 bg-black/50 rounded px-2 py-1">
                    <Heart className="w-3 h-3" />
                    <span className="text-xs">{story.likes || 0}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {story.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {story.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>by {story.creator_name}</span>
                  <span>{Math.round((story.word_count || 0) / 1000)}k words</span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(story.created_at).toLocaleDateString()}</span>
                  </div>
                  {story.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{story.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLikeStory(story.id)
                    }}
                    className="text-xs"
                  >
                    <Heart className="w-3 h-3 mr-1" />
                    Like
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleShareStory(story.id)
                    }}
                    className="text-xs"
                  >
                    <Share2 className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadStory(story.id)
                    }}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredStories.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stories found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedGenre !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No published stories available yet'
            }
          </p>
          {(searchTerm || selectedGenre !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('')
                setSelectedGenre('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            Previous
          </Button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Stats Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{filteredStories.length}</div>
              <div className="text-sm text-gray-600">Available Stories</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{genres.length - 1}</div>
              <div className="text-sm text-gray-600">Genres</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(filteredStories.reduce((acc, story) => acc + (story.word_count || 0), 0) / 1000)}k
              </div>
              <div className="text-sm text-gray-600">Total Words</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredStories.reduce((acc, story) => acc + (story.views || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Views</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}