'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  TrendingUp,
  Target,
  Clock,
  Coins,
  BookOpen,
  FileText,
  Award,
  Calendar,
  Zap,
  Eye,
  DollarSign,
  Activity
} from 'lucide-react';

interface AnalyticsDashboardProps {
  userProfile: {
    id: string;
    subscription_tier: string;
    tokens_remaining: number;
    tokens_used_total: number;
    stories_created: number;
    words_generated: number;
    created_at: string;
  };
}

interface AnalyticsData {
  userStats: {
    totalStories: number;
    totalChapters: number;
    totalWords: number;
    totalTokensUsed: number;
    totalCostUSD: number;
    averageWordsPerStory: number;
    efficiency: number;
    daysActive: number;
  };
  usageHistory: Array<{
    date: string;
    tokensUsed: number;
    storiesCreated: number;
    chaptersCreated: number;
    costUSD: number;
  }>;
  operationBreakdown: Array<{
    type: string;
    count: number;
    totalTokens: number;
    totalCost: number;
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
    category: string;
  }>;
}

const OPERATION_LABELS = {
  'foundation': 'Story Foundations',
  'chapter': 'Chapter Generation',
  'improvement': 'Chapter Improvements'
};

export default function AnalyticsDashboard({ userProfile }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch user statistics
      const { data: stories } = await supabase
        .from('stories')
        .select('id, word_count, total_cost_usd, created_at, chapters(id)')
        .eq('user_id', userProfile.id);

      const { data: generationLogs } = await supabase
        .from('generation_logs')
        .select('*')
        .eq('user_id', userProfile.id)
        .gte('created_at', new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString());

      // Calculate analytics
      const totalStories = stories?.length || 0;
      const totalChapters = stories?.reduce((sum, story) => sum + (story.chapters?.length || 0), 0) || 0;
      const totalWords = stories?.reduce((sum, story) => sum + story.word_count, 0) || 0;
      const totalCostUSD = stories?.reduce((sum, story) => sum + story.total_cost_usd, 0) || 0;
      const efficiency = userProfile.tokens_used_total > 0 ? totalWords / userProfile.tokens_used_total : 0;
      const daysActive = Math.ceil((Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60 * 24));

      // Group usage by day
      const usageByDay = generationLogs?.reduce((acc, log) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { tokensUsed: 0, operations: 0, costUSD: 0 };
        }
        acc[date].tokensUsed += log.tokens_input + log.tokens_output;
        acc[date].operations += 1;
        acc[date].costUSD += log.cost_usd;
        return acc;
      }, {} as Record<string, any>) || {};

      // Group operations by type
      const operationBreakdown = generationLogs?.reduce((acc, log) => {
        const type = log.operation_type;
        if (!acc[type]) {
          acc[type] = { count: 0, totalTokens: 0, totalCost: 0 };
        }
        acc[type].count += 1;
        acc[type].totalTokens += log.tokens_input + log.tokens_output;
        acc[type].totalCost += log.cost_usd;
        return acc;
      }, {} as Record<string, any>) || {};

      setAnalytics({
        userStats: {
          totalStories,
          totalChapters,
          totalWords,
          totalTokensUsed: userProfile.tokens_used_total,
          totalCostUSD,
          averageWordsPerStory: totalStories > 0 ? totalWords / totalStories : 0,
          efficiency,
          daysActive
        },
        usageHistory: Object.entries(usageByDay).map(([date, data]) => ({
          date,
          tokensUsed: data.tokensUsed,
          storiesCreated: 0, // Could be calculated from stories created on that day
          chaptersCreated: 0, // Could be calculated from chapters created on that day
          costUSD: data.costUSD
        })),
        operationBreakdown: Object.entries(operationBreakdown).map(([type, data]) => ({
          type,
          count: data.count,
          totalTokens: data.totalTokens,
          totalCost: data.totalCost
        })),
        achievements: [] // Placeholder for achievements system
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(amount);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 400) return 'text-green-600 bg-green-100';
    if (efficiency >= 250) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getEfficiencyLabel = (efficiency: number) => {
    if (efficiency >= 400) return 'Excellent';
    if (efficiency >= 250) return 'Good';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-600">Unable to load analytics data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Writing Analytics
          </h2>
          <p className="text-gray-600 mt-1">Track your creative progress and optimize your workflow</p>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 3 months</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Stories Created</p>
                    <p className="text-3xl font-bold text-blue-900">{analytics.userStats.totalStories}</p>
                  </div>
                  <div className="p-3 bg-blue-200 rounded-full">
                    <BookOpen className="w-6 h-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Chapters Written</p>
                    <p className="text-3xl font-bold text-green-900">{analytics.userStats.totalChapters}</p>
                  </div>
                  <div className="p-3 bg-green-200 rounded-full">
                    <FileText className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Words Generated</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {formatNumber(analytics.userStats.totalWords)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-200 rounded-full">
                    <Target className="w-6 h-6 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700">Total Cost</p>
                    <p className="text-3xl font-bold text-orange-900">
                      {formatCurrency(analytics.userStats.totalCostUSD)}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-200 rounded-full">
                    <DollarSign className="w-6 h-6 text-orange-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Writing Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Writing Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Average Words per Story</span>
                      <span className="font-medium">
                        {Math.round(analytics.userStats.averageWordsPerStory).toLocaleString()}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (analytics.userStats.averageWordsPerStory / 50000) * 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Target: 50,000 words (novel length)</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Writing Efficiency</span>
                      <Badge className={getEfficiencyColor(analytics.userStats.efficiency)}>
                        {getEfficiencyLabel(analytics.userStats.efficiency)}
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.min(100, (analytics.userStats.efficiency / 500) * 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(analytics.userStats.efficiency)} words per token
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.userStats.totalTokensUsed}
                        </div>
                        <div className="text-xs text-gray-500">Tokens Used</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {analytics.userStats.daysActive}
                        </div>
                        <div className="text-xs text-gray-500">Days Active</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="w-5 h-5" />
                  Operation Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.operationBreakdown.map((operation, index) => (
                    <div key={operation.type} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {OPERATION_LABELS[operation.type as keyof typeof OPERATION_LABELS] || operation.type}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">{operation.count} times</div>
                          <div className="text-xs text-gray-500">
                            {operation.totalTokens} tokens
                          </div>
                        </div>
                      </div>
                      <Progress 
                        value={analytics.operationBreakdown.length > 0 
                          ? (operation.count / Math.max(...analytics.operationBreakdown.map(op => op.count))) * 100
                          : 0
                        } 
                        className="h-2"
                      />
                    </div>
                  ))}
                  
                  {analytics.operationBreakdown.length === 0 && (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No operations in this time period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Writing Efficiency Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {Math.round(analytics.userStats.efficiency)}
                  </div>
                  <div className="text-sm text-blue-700 mb-2">Words per Token</div>
                  <Badge className={getEfficiencyColor(analytics.userStats.efficiency)}>
                    {getEfficiencyLabel(analytics.userStats.efficiency)}
                  </Badge>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {formatCurrency(analytics.userStats.totalCostUSD / analytics.userStats.totalWords * 1000)}
                  </div>
                  <div className="text-sm text-green-700">Cost per 1K Words</div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analytics.userStats.totalStories > 0 
                      ? formatCurrency(analytics.userStats.totalCostUSD / analytics.userStats.totalStories)
                      : '$0.000'
                    }
                  </div>
                  <div className="text-sm text-purple-700">Average Cost per Story</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Efficiency Tips</h4>
                <div className="space-y-2 text-sm">
                  {analytics.userStats.efficiency < 250 && (
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-orange-500 mt-0.5" />
                      <span>Try being more specific in your prompts to get longer, more detailed content.</span>
                    </div>
                  )}
                  {analytics.userStats.efficiency >= 400 && (
                    <div className="flex items-start gap-2">
                      <Award className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>Excellent efficiency! You're generating high-quality content cost-effectively.</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span>Use the improvement feature to refine content instead of regenerating from scratch.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.usageHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-64 flex items-end justify-between gap-2">
                    {analytics.usageHistory.slice(-14).map((day, index) => {
                      const maxTokens = Math.max(...analytics.usageHistory.map(d => d.tokensUsed), 1);
                      const height = (day.tokensUsed / maxTokens) * 200;
                      
                      return (
                        <div key={day.date} className="flex flex-col items-center">
                          <div
                            className="w-8 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-600 hover:to-blue-500"
                            style={{ height: `${height}px` }}
                            title={`${day.date}: ${day.tokensUsed} tokens, ${formatCurrency(day.costUSD)}`}
                          />
                          <div className="text-xs text-gray-500 mt-2 transform rotate-45 origin-bottom-left">
                            {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-xl font-bold text-blue-600">
                        {analytics.usageHistory.reduce((sum, day) => sum + day.tokensUsed, 0)}
                      </div>
                      <div className="text-sm text-blue-700">Total Tokens Used</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {Math.round(analytics.usageHistory.reduce((sum, day) => sum + day.tokensUsed, 0) / analytics.usageHistory.length)}
                      </div>
                      <div className="text-sm text-green-700">Daily Average</div>
                    </div>
                    <div className="text-center