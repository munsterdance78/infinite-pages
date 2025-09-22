const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 13.4+, no longer experimental
  eslint: {
    // Temporarily disable ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Code splitting optimization for icons
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            icons: {
              name: 'icons',
              test: /[\\/]node_modules[\\/]lucide-react/,
              chunks: 'all',
              priority: 10,
            },
          },
        },
      }
    }

    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ]
      }
    ]
  }
}

module.exports = withBundleAnalyzer(nextConfig)