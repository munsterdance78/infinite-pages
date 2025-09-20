# Environment Variables Configuration

## Required Environment Variables

### For Production (Vercel)

Add these environment variables to your Vercel project:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ukadivsgkwfjwzbutquu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_CONNECT_CLIENT_ID=your_stripe_connect_client_id

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

## Critical Dependencies

These features will be disabled if environment variables are missing:

### SUPABASE_SERVICE_ROLE_KEY
- **Required for**: Cache system, webhooks, middleware user lookup
- **Impact if missing**: Cache disabled, payment processing fails, user tier detection defaults to 'free'
- **Error message**: `[InfinitePages Cache] SUPABASE_SERVICE_ROLE_KEY not available - cache disabled`

### ANTHROPIC_API_KEY
- **Required for**: AI story generation
- **Impact if missing**: All story generation will fail
- **Error message**: `ANTHROPIC_API_KEY environment variable is required`

### STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
- **Required for**: Payment processing
- **Impact if missing**: Credit purchases and subscriptions will fail

## Verification

To verify your environment variables are working:

1. Check the homepage console for environment debug info
2. Look for cache initialization message: `[InfinitePages Cache] Successfully initialized with Supabase`
3. Ensure no error messages about missing variables in the logs

## Adding Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with the appropriate value
4. Redeploy your application

## Security Notes

- Never commit real environment variables to the repository
- Use `.env.local` for local development
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access - handle securely
- Store sensitive keys in Vercel's encrypted environment variable system