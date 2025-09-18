'use client';

import React, { useState } from 'react';
import { Database } from '@/lib/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Edit,
  Trash2,
  Eye,
  Clock,
  BookOpen,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  Download,
  AlertTriangle,
  MoreVertical
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { STORY_STATUS, type StoryStatus } from '@/lib/constants';

type Chapter = Database['public']['Tables']['chapters']['Row'];

interface Story {
  id: string;
  user_id: string;
  title: string;
  genre: string | null;
  premise: string | null;
  foundation: any;
  outline: any;
  characters: any;
  status: StoryStatus;
  word_count: number;
  chapter_count: number;
  total_tokens_used: number;
  total_cost_usd: number;
  created_at: string;
  updated_at: string;
  chapters?: Chapter[];
}

interface StoryCardProps {
  story: Story;
  onEdit: (story: Story) => void;
  onDelete: (storyId: string) => void;
  onExport?: (storyId: string, format: string) => void;
  showExportOption?: boolean;
  isLoading?: boolean;
  className?: string;
}

const STATUS_COLORS = {
  [STORY_STATUS.DRAFT]: 'bg-gray-100 text-gray-800',
  [STORY_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [STORY_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [STORY_STATUS.PUBLISHED]: 'bg-purple-100 text-purple-800'
} as const;

const STATUS_LABELS = {
  [STORY_STATUS.DRAFT]: 'Draft',
  [STORY_STATUS.IN_PROGRESS]: 'In Progress',
  [STORY_STATUS.COMPLETED]: 'Completed',
  [STORY_STATUS.PUBLISHED]: 'Published'
} as const;

export default function StoryCard({ 
  story, 
  onEdit, 
  onDelete, 
  onExport,
  showExportOption = false,
  isLoading = false,
  className = ''
}: StoryCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(story.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete story:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: StoryStatus) => {
    switch (status) {
      case STORY_STATUS.DRAFT:
        return <FileText className="w-3 h-3" />;
      case STORY_STATUS.IN_PROGRESS:
        return <Edit className="w-3 h-3" />;
      case STORY_STATUS.COMPLETED:
        return <BookOpen className="w-3 h-3" />;
      case STORY_STATUS.PUBLISHED:
        return <TrendingUp className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getProgressPercentage = () => {
    if (!story.chapters || story.chapters.length === 0) return 0;
    
    // Estimate progress based on word count and typical chapter structure
    const averageChapterWords = 2000; // Typical chapter length
    const estimatedTotalChapters = Math.max(10, story.chapters.length * 1.5); // Estimate total chapters
    const currentProgress = (story.chapters.length / estimatedTotalChapters) * 100;
    
    return Math.min(100, Math.max(0, currentProgress));
  };

  const getWordCountColor = (wordCount: number) => {
    if (wordCount >= 50000) return 'text-green-600'; // Novel length
    if (wordCount >= 20000) return 'text-blue-600';  // Novella length
    if (wordCount >= 5000) return 'text-yellow-600'; // Short story
    return 'text-gray-600'; // Very short
  };

  const getEfficiencyRating = () => {
    if (story.total_cost_usd === 0) return 'N/A';
    const costPer1000Words = (story.total_cost_usd / story.word_count) * 1000;
    if (costPer1000Words < 0.05) return 'Excellent';
    if (costPer1000Words < 0.10) return 'Good';
    if (costPer1000Words < 0.20) return 'Fair';
    return 'Poor';
  };

  const getMostRecentChapter = () => {
    if (!story.chapters || story.chapters.length === 0) return null;
    return story.chapters.reduce((latest, current) => 
      new Date(current.created_at) > new Date(latest.created_at) ? current : latest
    );
  };

  const recentChapter = getMostRecentChapter();

  return (
    <>
      <Card 
        className={`hover:shadow-lg transition-all duration-200 group relative ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        } ${className}`}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2 group-hover:text-blue-600 transition-colors cursor-pointer">
                <button
                  onClick={() => onEdit(story)}
                  className="text-left w-full hover:underline focus:outline-none focus:underline"
                >
                  {story.title}
                </button>
              </CardTitle>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {story.genre && (
                  <Badge variant="outline" className="text-xs">
                    {story.genre}
                  </Badge>
                )}
                <Badge 
                  variant="outline" 
                  className={`text-xs ${STATUS_COLORS[story.status]}`}
                >
                  {getStatusIcon(story.status)}
                  <span className="ml-1">{STATUS_LABELS[story.status]}</span>
                </Badge>
                
                {/* Progress indicator for in-progress stories */}
                {story.status === STORY_STATUS.IN_PROGRESS && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {Math.round(getProgressPercentage())}% complete
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Action menu */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailsDialog(true)}
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(story)}
                title="Edit story"
              >
                <Edit className="w-4 h-4" />
              </Button>
              {showExportOption && onExport && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExport(story.id, 'pdf')}
                  title="Export story"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete story"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Story metrics */}
          <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4">
            <div>
              <div className={`font-semibold text-lg ${getWordCountColor(story.word_count)}`}>
                {story.word_count.toLocaleString()}
              </div>
              <div className="text-gray-500 text-xs">Words</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-green-600">
                {story.chapter_count}
              </div>
              <div className="text-gray-500 text-xs">Chapters</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-purple-600">
                {formatCurrency(story.total_cost_usd)}
              </div>
              <div className="text-gray-500 text-xs">Cost</div>
            </div>
          </div>

          {/* Recent activity */}
          {recentChapter && (
            <div className="p-2 bg-gray-50 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="w-3 h-3" />
                <span>Last updated: Chapter {recentChapter.chapter_number}</span>
                <span>•</span>
                <span>{formatDate(recentChapter.created_at)}</span>
              </div>
            </div>
          )}

          {/* Bottom info */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Created {formatDate(story.created_at)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(story)}
              className="h-7 px-2 text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              Open
            </Button>
          </div>

          {/* Warning for stories with issues */}
          {story.word_count === 0 && story.chapter_count === 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-yellow-800">
                <AlertTriangle className="w-3 h-3" />
                <span>Story foundation only - no chapters generated yet</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Story
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete "<strong>{story.title}</strong>"? 
              This action cannot be undone and will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>The story foundation and all content</li>
              <li>All {story.chapter_count} chapters</li>
              <li>Generation history and analytics</li>
            </ul>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                This will permanently delete {story.word_count.toLocaleString()} words 
                and cannot be recovered.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Story'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story details dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{story.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Story Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Genre:</span>
                    <span>{story.genre || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[story.status]}`}>
                      {STATUS_LABELS[story.status]}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{formatDate(story.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last updated:</span>
                    <span>{formatDate(story.updated_at)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Analytics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Word count:</span>
                    <span className={getWordCountColor(story.word_count)}>
                      {story.word_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chapters:</span>
                    <span>{story.chapter_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total cost:</span>
                    <span>{formatCurrency(story.total_cost_usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efficiency:</span>
                    <span>{getEfficiencyRating()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Premise */}
            {story.premise && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Premise</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {story.premise}
                </p>
              </div>
            )}

            {/* Chapters list */}
            {story.chapters && story.chapters.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Chapters ({story.chapters.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {story.chapters
                    .sort((a, b) => a.chapter_number - b.chapter_number)
                    .map(chapter => (
                      <div key={chapter.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">
                            Chapter {chapter.chapter_number}: {chapter.title || 'Untitled'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {chapter.word_count.toLocaleString()} words • {formatCurrency(chapter.generation_cost_usd)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(chapter.created_at)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setShowDetailsDialog(false);
                onEdit(story);
              }}>
                Edit Story
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}