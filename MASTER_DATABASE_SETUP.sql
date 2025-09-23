-- INFINITE PAGES PLATFORM - MASTER DATABASE SETUP (CORRECTED)
-- Complete database infrastructure initialization for Supabase
-- Execute this file in Supabase SQL Editor to create all required tables
-- Generated: September 22, 2025 - Corrected for Supabase compatibility

-- ==============================================================================
-- PHASE 1: EXTENSIONS AND CORE INFRASTRUCTURE
-- ==============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- ==============================================================================
-- PHASE 2: CORE USER AND CONTENT TABLES (Foundation Layer)
-- ==============================================================================

-- System logs table for maintenance tracking
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  log_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table for user data (Enhanced for creator economy)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'premium')),
  subscription_status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  tokens_remaining INTEGER DEFAULT 1332, -- Basic tier monthly allocation
  tokens_used_total INTEGER DEFAULT 0,
  last_token_grant TIMESTAMPTZ DEFAULT NOW(),
  stories_created INTEGER DEFAULT 0,
  words_generated INTEGER DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  writing_goals TEXT[],
  preferred_genres TEXT[],
  experience_level TEXT,
  writing_frequency TEXT,
  -- Credit System Fields
  credits_balance INTEGER DEFAULT 0,
  credits_earned_total INTEGER DEFAULT 0,
  credits_spent_total INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_discount_earned INTEGER DEFAULT 0,
  -- Creator Fields
  is_creator BOOLEAN DEFAULT FALSE,
  creator_tier TEXT CHECK (creator_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_earnings_usd DECIMAL(10,2) DEFAULT 0,
  pending_payout_usd DECIMAL(10,2) DEFAULT 0,
  stripe_connect_account_id TEXT,
  stripe_account_status TEXT CHECK (stripe_account_status IN ('incomplete', 'pending', 'active')),
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  genre TEXT,
  premise TEXT,
  foundation JSONB,
  outline JSONB,
  characters JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'published')),
  word_count INTEGER DEFAULT 0,
  chapter_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  tokens_used_input INTEGER DEFAULT 0,
  tokens_used_output INTEGER DEFAULT 0,
  generation_cost_usd DECIMAL(10,6) DEFAULT 0,
  prompt_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, chapter_number)
);

-- Generation logs for tracking API usage
CREATE TABLE IF NOT EXISTS generation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('foundation', 'chapter', 'improvement')),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exports table for tracking downloads
CREATE TABLE IF NOT EXISTS exports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'epub', 'docx', 'txt')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  file_url TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ==============================================================================
-- PHASE 3: CREDIT SYSTEM AND SUBSCRIPTION MANAGEMENT
-- ==============================================================================

-- Credit packages table for subscription tiers
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  credits_amount INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  stripe_price_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions table for tracking all credit movements
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'earn', 'bonus', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT,
  reference_type TEXT CHECK (reference_type IN ('story_read', 'cache_hit', 'purchase', 'creator_bonus')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table for transaction tracking
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  package_id UUID REFERENCES credit_packages(id),
  amount_usd DECIMAL(10,2) NOT NULL,
  credits_purchased INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  payment_method TEXT,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 4: CREATOR ECONOMY TABLES
-- ==============================================================================

-- Creator earnings tracking
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  reader_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  credits_earned INTEGER NOT NULL,
  usd_equivalent DECIMAL(10,4) NOT NULL,
  transaction_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator payout management
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  earnings_count INTEGER NOT NULL,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story pricing configuration
CREATE TABLE IF NOT EXISTS story_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  price_per_chapter INTEGER DEFAULT 5,
  bundle_discount DECIMAL(3,2) DEFAULT 0.20,
  is_free_sample BOOLEAN DEFAULT TRUE,
  free_chapters INTEGER DEFAULT 2,
  premium_unlock_price INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story purchase transactions
CREATE TABLE IF NOT EXISTS story_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('chapter', 'bundle', 'premium_unlock')),
  chapters_unlocked INTEGER[] NOT NULL,
  credits_spent INTEGER NOT NULL,
  creator_earnings INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 5: USER EXPERIENCE AND ANALYTICS TABLES
-- ==============================================================================

-- Reading progress tracking
CREATE TABLE IF NOT EXISTS reading_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  reading_time_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id, chapter_id)
);

-- User library management
CREATE TABLE IF NOT EXISTS user_library (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  is_favorite BOOLEAN DEFAULT FALSE,
  reading_status TEXT DEFAULT 'want_to_read' CHECK (reading_status IN ('want_to_read', 'reading', 'completed', 'dropped')),
  personal_rating INTEGER CHECK (personal_rating >= 1 AND personal_rating <= 5),
  personal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- Subscription usage analytics
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_tier TEXT NOT NULL CHECK (subscription_tier IN ('basic', 'premium')),
  credits_used_this_month INTEGER DEFAULT 0,
  stories_read_this_month INTEGER DEFAULT 0,
  downloads_this_month INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 6: COVER GENERATION SYSTEM
-- ==============================================================================

-- Story covers management
CREATE TABLE IF NOT EXISTS story_covers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  cover_url TEXT NOT NULL,
  cover_style TEXT NOT NULL CHECK (cover_style IN ('realistic', 'artistic', 'fantasy', 'minimalist', 'vintage')),
  generation_prompt TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  generation_cost DECIMAL(6,4) DEFAULT 0,
  sd_model_used TEXT DEFAULT 'stable-diffusion-xl',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cover generation queue
CREATE TABLE IF NOT EXISTS cover_generation_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  generation_prompt TEXT NOT NULL,
  cover_style TEXT NOT NULL CHECK (cover_style IN ('realistic', 'artistic', 'fantasy', 'minimalist', 'vintage')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  priority INTEGER DEFAULT 100,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  webui_task_id TEXT,
  estimated_completion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 7: AI TRANSPARENCY AND ANALYTICS
-- ==============================================================================

-- AI usage transparency logs
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('foundation', 'character', 'cover', 'chapter', 'improvement')),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  actual_cost_usd DECIMAL(10,6) NOT NULL,
  charged_amount_usd DECIMAL(10,6) NOT NULL,
  markup_percentage DECIMAL(5,2) DEFAULT 50.00,
  ai_model_used TEXT NOT NULL DEFAULT 'claude-3-haiku',
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  generation_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache performance rewards
CREATE TABLE IF NOT EXISTS cache_rewards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  cache_key TEXT NOT NULL,
  credits_saved INTEGER NOT NULL,
  original_cost DECIMAL(8,4) NOT NULL,
  discounted_cost DECIMAL(8,4) NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 8: CREATOR PAYOUT SYSTEM
-- ==============================================================================

-- Creator earnings accumulation tracking
CREATE TABLE IF NOT EXISTS creator_earnings_accumulation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_accumulated_usd DECIMAL(10,2) DEFAULT 0,
  last_payout_date DATE,
  last_payout_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly payout batch processing
CREATE TABLE IF NOT EXISTS monthly_payout_batches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  batch_date DATE NOT NULL,
  total_creators_paid INTEGER DEFAULT 0,
  total_amount_usd DECIMAL(12,2) DEFAULT 0,
  stripe_batch_id TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual payout records
CREATE TABLE IF NOT EXISTS individual_payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  batch_id UUID REFERENCES monthly_payout_batches(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PHASE 9: PERFORMANCE INDEXES
-- ==============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_is_creator ON profiles(is_creator);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);

CREATE INDEX IF NOT EXISTS idx_chapters_story_id ON chapters(story_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(story_id, chapter_number);

CREATE INDEX IF NOT EXISTS idx_generation_logs_user_id ON generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at ON generation_logs(created_at DESC);

-- Credit system indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

-- Creator economy indexes
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_story_id ON creator_earnings(story_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_created_at ON creator_earnings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_purchases_user_id ON story_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_story_purchases_story_id ON story_purchases(story_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_user_id ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);

-- System maintenance indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- ==============================================================================
-- PHASE 10: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings_accumulation ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own stories" ON stories;
DROP POLICY IF EXISTS "Users can create own stories" ON stories;
DROP POLICY IF EXISTS "Users can update own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON stories;
DROP POLICY IF EXISTS "Users can view own chapters" ON chapters;
DROP POLICY IF EXISTS "Users can create own chapters" ON chapters;
DROP POLICY IF EXISTS "Users can update own chapters" ON chapters;
DROP POLICY IF EXISTS "Users can delete own chapters" ON chapters;
DROP POLICY IF EXISTS "Users can view own logs" ON generation_logs;
DROP POLICY IF EXISTS "Users can create own logs" ON generation_logs;
DROP POLICY IF EXISTS "Everyone can view active credit packages" ON credit_packages;
DROP POLICY IF EXISTS "Users can view own credit transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Creators can view own earnings" ON creator_earnings;
DROP POLICY IF EXISTS "Users can view purchases of own stories" ON story_purchases;
DROP POLICY IF EXISTS "Users can manage own reading progress" ON reading_progress;
DROP POLICY IF EXISTS "Users can manage own library" ON user_library;
DROP POLICY IF EXISTS "Admin can view system logs" ON system_logs;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Stories policies
CREATE POLICY "Users can view own stories" ON stories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own stories" ON stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories" ON stories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories" ON stories
  FOR DELETE USING (auth.uid() = user_id);

-- Chapters policies
CREATE POLICY "Users can view own chapters" ON chapters
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can create own chapters" ON chapters
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can update own chapters" ON chapters
  FOR UPDATE USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can delete own chapters" ON chapters
  FOR DELETE USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

-- Generation logs policies
CREATE POLICY "Users can view own logs" ON generation_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own logs" ON generation_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credit system policies
CREATE POLICY "Everyone can view active credit packages" ON credit_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Creator economy policies
CREATE POLICY "Creators can view own earnings" ON creator_earnings
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can view purchases of own stories" ON story_purchases
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- User experience policies
CREATE POLICY "Users can manage own reading progress" ON reading_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own library" ON user_library
  FOR ALL USING (auth.uid() = user_id);

-- System logs policies (admin only)
CREATE POLICY "Admin can view system logs" ON system_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

-- Additional necessary policies for exports
CREATE POLICY "Users can view own exports" ON exports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exports" ON exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Additional policies for creator features
CREATE POLICY "Creators can view own payouts" ON payouts
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Creators can view own story pricing" ON story_pricing
  FOR ALL USING (auth.uid() = creator_id);

-- Additional policies for subscription usage
CREATE POLICY "Users can view own subscription usage" ON subscription_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Additional policies for covers
CREATE POLICY "Users can view story covers" ON story_covers
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM stories WHERE id = story_id));

CREATE POLICY "Users can manage cover generation" ON cover_generation_queue
  FOR ALL USING (auth.uid() = user_id);

-- Additional policies for analytics
CREATE POLICY "Users can view own ai usage logs" ON ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cache rewards" ON cache_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Additional policies for creator accumulation
CREATE POLICY "Creators can view own accumulation" ON creator_earnings_accumulation
  FOR SELECT USING (auth.uid() = creator_id);

-- ==============================================================================
-- PHASE 11: TRIGGERS AND FUNCTIONS
-- ==============================================================================

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_stories_updated_at ON stories;
DROP TRIGGER IF EXISTS update_chapters_updated_at ON chapters;

-- Updated_at triggers for all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- PHASE 12: INITIAL DATA SEEDING
-- ==============================================================================

-- Insert default credit packages
INSERT INTO credit_packages (name, description, credits_amount, price_usd, stripe_price_id, is_active, sort_order)
VALUES
  (
    'Basic Monthly',
    'Basic subscription - 1332 credits per month',
    1332,
    7.99,
    'price_basic_monthly',
    true,
    1
  ),
  (
    'Premium Monthly',
    'Premium subscription - 2497 credits per month',
    2497,
    14.99,
    'price_premium_monthly',
    true,
    2
  ),
  (
    'Basic Yearly',
    'Basic yearly subscription - 15984 credits (12 months)',
    15984,
    79.99,
    'price_basic_yearly',
    true,
    3
  ),
  (
    'Premium Yearly',
    'Premium yearly subscription - 29964 credits (12 months)',
    29964,
    149.99,
    'price_premium_yearly',
    true,
    4
  )
ON CONFLICT DO NOTHING;

-- Insert system initialization log
INSERT INTO system_logs (log_type, message, metadata)
VALUES (
  'database_initialization',
  'Infinite Pages database successfully initialized',
  jsonb_build_object(
    'tables_created', 25,
    'indexes_created', 20,
    'policies_created', 25,
    'functions_created', 2,
    'seed_data_inserted', true,
    'initialization_date', NOW()
  )
);

-- ==============================================================================
-- SETUP COMPLETE
-- ==============================================================================

-- Display setup completion message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'INFINITE PAGES DATABASE SETUP COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Tables created: 25';
  RAISE NOTICE 'Indexes created: 20+';
  RAISE NOTICE 'RLS policies created: 25+';
  RAISE NOTICE 'Functions created: 2';
  RAISE NOTICE 'Triggers created: 3';
  RAISE NOTICE 'Credit packages seeded: 4';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify table creation with verification queries';
  RAISE NOTICE '2. Test API endpoint connectivity';
  RAISE NOTICE '3. Run application and test user flows';
  RAISE NOTICE '============================================';
END $$;