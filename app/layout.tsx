import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'Infinite-Pages - AI Story Generation Platform',
  description: 'Create unlimited stories with AI assistance. Generate foundations, write chapters, and bring your imagination to life.',
  keywords: ['AI', 'story generation', 'writing', 'creative writing', 'artificial intelligence'],
  authors: [{ name: 'Infinite-Pages Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Infinite-Pages - AI Story Generation Platform',
    description: 'Create unlimited stories with AI assistance. Generate foundations, write chapters, and bring your imagination to life.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Infinite-Pages - AI Story Generation Platform',
    description: 'Create unlimited stories with AI assistance. Generate foundations, write chapters, and bring your imagination to life.',
  }
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        {/* Preload critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Security headers via meta tags (should also be set at server level) */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        
        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        
        {/* Favicon and app icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* Root-level error boundary catches any errors in the entire app */}
        <ErrorBoundary
          level="page"
          showDetails={process.env.NODE_ENV === 'development'}
          fallback={
            // Custom fallback for critical errors
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg 
                    className="w-8 h-8 text-red-600" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Application Error
                </h1>
                <p className="text-gray-600 mb-6 max-w-md">
                  We're experiencing technical difficulties. Please refresh the page or try again later.
                </p>
                <div className="space-x-4">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Refresh Page
                  </button>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          }
        >
          {/* Main application content */}
          <main className="min-h-screen">
            {children}
          </main>
          
          {/* Global error reporting script for unhandled promise rejections */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Catch unhandled promise rejections
                window.addEventListener('unhandledrejection', function(event) {
                  console.error('Unhandled promise rejection:', event.reason);
                  
                  // Report to error service in production
                  if (window.location.hostname !== 'localhost') {
                    fetch('/api/errors', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'unhandled_rejection',
                        message: event.reason?.message || 'Unhandled promise rejection',
                        stack: event.reason?.stack,
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        userAgent: navigator.userAgent
                      })
                    }).catch(console.error);
                  }
                });
                
                // Catch global JavaScript errors that escape React error boundaries
                window.addEventListener('error', function(event) {
                  console.error('Global error:', event.error);
                  
                  // Report to error service in production
                  if (window.location.hostname !== 'localhost') {
                    fetch('/api/errors', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'global_error',
                        message: event.error?.message || event.message,
                        stack: event.error?.stack,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        userAgent: navigator.userAgent
                      })
                    }).catch(console.error);
                  }
                });
                
                // Monitor performance and report slow operations
                if ('PerformanceObserver' in window) {
                  try {
                    const observer = new PerformanceObserver((list) => {
                      list.getEntries().forEach((entry) => {
                        // Report long tasks (over 50ms) that might cause UI freezing
                        if (entry.entryType === 'longtask' && entry.duration > 50) {
                          console.warn('Long task detected:', entry.duration + 'ms');
                          
                          if (window.location.hostname !== 'localhost') {
                            fetch('/api/performance', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                type: 'longtask',
                                duration: entry.duration,
                                timestamp: new Date().toISOString(),
                                url: window.location.href
                              })
                            }).catch(console.error);
                          }
                        }
                      });
                    });
                    
                    observer.observe({ entryTypes: ['longtask'] });
                  } catch (e) {
                    // PerformanceObserver not supported or failed to initialize
                    console.warn('Performance monitoring not available:', e);
                  }
                }
              `
            }}
          />
        </ErrorBoundary>
      </body>
    </html>
  )
}