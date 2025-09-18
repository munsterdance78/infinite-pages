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
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">
                        {formatCurrency(analytics.usageHistory.reduce((sum, day) => sum + day.costUSD, 0))}
                      </div>
                      <div className="text-sm text-purple-700">Total Cost</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No usage data available for this time period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Writing Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Productivity Trend</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      You've been active for {analytics.userStats.daysActive} days and created an average of{' '}
                      {(analytics.userStats.totalStories / Math.max(1, Math.ceil(analytics.userStats.daysActive / 7))).toFixed(1)} stories per week.
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-900">Quality Focus</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Your average story length is {Math.round(analytics.userStats.averageWordsPerStory).toLocaleString()} words,{' '}
                      {analytics.userStats.averageWordsPerStory > 10000 
                        ? 'showing great depth in your storytelling.' 
                        : 'consider developing longer, more detailed narratives.'}
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-purple-900">Cost Efficiency</span>
                    </div>
                    <p className="text-sm text-purple-700">
                      You're generating content at{' '}
                      {formatCurrency(analytics.userStats.totalCostUSD / analytics.userStats.totalWords * 1000)} per 1K words,{' '}
                      {analytics.userStats.efficiency >= 300 
                        ? 'which is excellent value!' 
                        : 'consider optimizing your prompts for better efficiency.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Achievements & Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.userStats.totalStories >= 1 && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                      <div className="p-2 bg-blue-200 rounded-full">
                        <BookOpen className="w-4 h-4 text-blue-700" />
                      </div>
                      <div>
                        <div className="font-medium text-blue-900">First Story</div>
                        <div className="text-sm text-blue-700">Started your writing journey!</div>
                      </div>
                    </div>
                  )}

                  {analytics.userStats.totalWords >= 10000 && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                      <div className="p-2 bg-green-200 rounded-full">
                        <Target className="w-4 h-4 text-green-700" />
                      </div>
                      <div>
                        <div className="font-medium text-green-900">Word Master</div>
                        <div className="text-sm text-green-700">Generated over 10K words!</div>
                      </div>
                    </div>
                  )}

                  {analytics.userStats.efficiency >= 400 && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                      <div className="p-2 bg-purple-200 rounded-full">
                        <Zap className="w-4 h-4 text-purple-700" />
                      </div>
                      <div>
                        <div className="font-medium text-purple-900">Efficiency Expert</div>
                        <div className="text-sm text-purple-700">Excellent words-per-token ratio!</div>
                      </div>
                    </div>
                  )}

                  {analytics.userStats.daysActive >= 7 && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                      <div className="p-2 bg-orange-200 rounded-full">
                        <Calendar className="w-4 h-4 text-orange-700" />
                      </div>
                      <div>
                        <div className="font-medium text-orange-900">Consistent Writer</div>
                        <div className="text-sm text-orange-700">Active for over a week!</div>
                      </div>
                    </div>
                  )}

                  {analytics.userStats.totalStories === 0 && analytics.userStats.totalWords === 0 && (
                    <div className="text-center py-8">
                      <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Start writing to unlock achievements!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}