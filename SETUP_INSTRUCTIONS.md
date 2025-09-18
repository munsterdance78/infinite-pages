# Infinite-Pages Setup Instructions

## Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key
- Stripe account

## Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env.local
   ```

3. **Fill in your environment variables in .env.local:**
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ANTHROPIC_API_KEY
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - STRIPE_PRO_PRICE_ID
   - NEXT_PUBLIC_SITE_URL

4. **Set up Supabase:**
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations/`
   - Set up authentication providers

5. **Set up Stripe:**
   - Create products and prices
   - Set up webhook endpoints
   - Configure your price IDs

6. **Start development server:**
   ```bash
   npm run dev
   ```

## Important Notes

- Make sure to set up RLS policies in Supabase
- Configure Stripe webhooks for subscription management
- Test the authentication flow before deploying
- Review and update the rate limiting configuration

## Deployment

1. Deploy to Vercel or your preferred platform
2. Set environment variables in production
3. Update Stripe webhook endpoints
4. Test all functionality in production environment
