import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,

  // Capture 100% of transactions for replays.
  // This sets the sample rate to be 10%. You may want this to be 100% while in development.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // ...

  integrations: [
    // Note: Replay integration requires additional setup for session recordings
    // Uncomment and configure when ready:
    // new Sentry.Replay({
    //   maskAllText: false,
    //   blockAllMedia: false,
    // }),
  ],
})