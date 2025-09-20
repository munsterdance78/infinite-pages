'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ChartDataPoint {
  date: string;
  requests: number;
  hits: number;
  hitRate: number;
  tokensSaved: number;
}

interface CacheChartProps {
  data: ChartDataPoint[];
  title: string;
  type: 'hitRate' | 'tokensSaved' | 'requests';
}

export default function CacheChart({ data, title, type }: CacheChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-gray-500">
          <p>No data available</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate trends and max values for scaling
  const values = data.map(d => {
    switch (type) {
      case 'hitRate': return d.hitRate;
      case 'tokensSaved': return d.tokensSaved;
      case 'requests': return d.requests;
      default: return d.hitRate;
    }
  });

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const latestValue = values[values.length - 1];
  const previousValue = values.length > 1 ? values[values.length - 2] : latestValue;
  const trend = latestValue - previousValue;
  const trendPercentage = previousValue !== 0 ? ((trend / previousValue) * 100) : 0;

  // Format value based on type
  const formatValue = (value: number) => {
    switch (type) {
      case 'hitRate': return `${value.toFixed(1)}%`;
      case 'tokensSaved': return value.toLocaleString();
      case 'requests': return value.toLocaleString();
      default: return value.toString();
    }
  };

  // Generate SVG path for line chart
  const generatePath = () => {
    if (values.length < 2) return '';

    const width = 300;
    const height = 100;
    const padding = 20;

    const xStep = (width - 2 * padding) / (values.length - 1);
    const yRange = maxValue - minValue || 1; // Avoid division by zero

    const points = values.map((value, index) => {
      const x = padding + index * xStep;
      const y = height - padding - ((value - minValue) / yRange) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const getTrendIcon = () => {
    if (Math.abs(trendPercentage) < 1) return <Minus className="w-3 h-3" />;
    return trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (Math.abs(trendPercentage) < 1) return 'text-gray-500';

    // For hit rate and tokens saved, up is good
    if (type === 'hitRate' || type === 'tokensSaved') {
      return trend > 0 ? 'text-green-500' : 'text-red-500';
    }

    // For requests, up might be neutral (more usage)
    return trend > 0 ? 'text-blue-500' : 'text-gray-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline" className={`${getTrendColor()} border-current`}>
            <span className="mr-1">{getTrendIcon()}</span>
            {Math.abs(trendPercentage).toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Value */}
          <div>
            <div className="text-2xl font-bold">
              {formatValue(latestValue)}
            </div>
            <p className="text-sm text-gray-600">
              Current {type === 'hitRate' ? 'hit rate' : type === 'tokensSaved' ? 'tokens saved' : 'requests'}
            </p>
          </div>

          {/* Mini Chart */}
          <div className="relative">
            <svg width="100%" height="100" viewBox="0 0 300 100" className="border rounded">
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="30" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 10" fill="none" stroke="#f0f0f0" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Area under curve */}
              {values.length > 1 && (
                <path
                  d={`${generatePath()} L 280,80 L 20,80 Z`}
                  fill="rgba(59, 130, 246, 0.1)"
                />
              )}

              {/* Line chart */}
              {values.length > 1 && (
                <path
                  d={generatePath()}
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {values.map((value, index) => {
                const width = 300;
                const height = 100;
                const padding = 20;
                const xStep = (width - 2 * padding) / Math.max(values.length - 1, 1);
                const yRange = maxValue - minValue || 1;

                const x = padding + index * xStep;
                const y = height - padding - ((value - minValue) / yRange) * (height - 2 * padding);

                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="rgb(59, 130, 246)"
                    className="drop-shadow-sm"
                  />
                );
              })}
            </svg>
          </div>

          {/* Data Summary */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium">{formatValue(minValue)}</div>
              <div className="text-gray-500">Min</div>
            </div>
            <div>
              <div className="font-medium">{formatValue(maxValue)}</div>
              <div className="text-gray-500">Max</div>
            </div>
            <div>
              <div className="font-medium">{formatValue(values.reduce((a, b) => a + b, 0) / values.length)}</div>
              <div className="text-gray-500">Avg</div>
            </div>
          </div>

          {/* Recent Performance */}
          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2">Recent Performance</div>
            <div className="space-y-1">
              {data.slice(-3).reverse().map((point, index) => (
                <div key={point.date} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {new Date(point.date).toLocaleDateString()}
                  </span>
                  <span className="font-medium">
                    {type === 'hitRate' ? `${point.hitRate.toFixed(1)}%` :
                     type === 'tokensSaved' ? point.tokensSaved.toLocaleString() :
                     point.requests.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}