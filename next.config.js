/** @type {import('next').NextConfig} */
const nextConfig = {
  // appDir is now stable in Next.js 13.4+, no longer experimental
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
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

module.exports = nextConfig