# Infinite-Pages MVP

An AI-powered story generation platform built with Next.js, Supabase, and Claude AI.

## Features

- 🤖 AI-powered story generation with Claude
- 📚 Chapter-by-chapter story development
- 💰 Token-based usage system
- 📊 Advanced analytics dashboard
- 💳 Stripe subscription management
- 📄 Multi-format exports (PDF, EPUB, DOCX, TXT)
- 🔐 Secure authentication with Supabase
- 📱 Responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **AI**: Claude AI (Anthropic)
- **Payments**: Stripe
- **UI Components**: Radix UI, shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Anthropic API key
- Stripe account

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your environment variables
4. Run the Supabase migration: `supabase db reset`
5. Start the development server: `npm run dev`

### Environment Variables

See `.env.example` for required environment variables.

### Deployment

1. Deploy to Vercel: `vercel`
2. Set up Stripe webhook endpoint
3. Configure Supabase production settings
4. Update environment variables in Vercel dashboard

## License

MIT License - see LICENSE file for details.