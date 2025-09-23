-- Business Logic Tables for Credit System and Maintenance
-- This migration adds the missing tables needed for the standardized pricing system

-- System logs table for maintenance tracking
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  log_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions table for tracking all credit movements
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL, -- Positive for credits added, negative for credits deducted
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('monthly_distribution', 'credit_reversion', 'subscription_grant', 'usage_deduction', 'admin_adjustment')),
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit packages table for subscription tiers
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'premium')),
  credits_amount INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing credits_balance column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credits_balance') THEN
    ALTER TABLE profiles ADD COLUMN credits_balance INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add missing credits_earned_total column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'credits_earned_total') THEN
    ALTER TABLE profiles ADD COLUMN credits_earned_total INTEGER DEFAULT 0;
  END IF;
END $$;

-- Update profiles table to use new tier system defaults
ALTER TABLE profiles ALTER COLUMN subscription_tier SET DEFAULT 'basic';
UPDATE profiles SET subscription_tier = 'basic' WHERE subscription_tier = 'free';
UPDATE profiles SET subscription_tier = 'premium' WHERE subscription_tier = 'pro';

-- Update tokens_remaining default to match basic tier allocation
ALTER TABLE profiles ALTER COLUMN tokens_remaining SET DEFAULT 1332;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_packages_tier ON credit_packages(tier);
CREATE INDEX IF NOT EXISTS idx_credit_packages_active ON credit_packages(active);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

-- System logs policies (admin only)
CREATE POLICY IF NOT EXISTS "Admin can view system logs" ON system_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

CREATE POLICY IF NOT EXISTS "Admin can insert system logs" ON system_logs
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

-- Credit transactions policies
CREATE POLICY IF NOT EXISTS "Users can view own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admin can view all credit transactions" ON credit_transactions
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

CREATE POLICY IF NOT EXISTS "Admin can insert credit transactions" ON credit_transactions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

-- Credit packages policies (public read, admin write)
CREATE POLICY IF NOT EXISTS "Everyone can view active credit packages" ON credit_packages
  FOR SELECT USING (active = true);

CREATE POLICY IF NOT EXISTS "Admin can manage credit packages" ON credit_packages
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email LIKE '%@admin.%'));

-- Insert default credit packages for the standardized pricing system
INSERT INTO credit_packages (name, tier, credits_amount, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features)
VALUES
  (
    'Basic Subscription',
    'basic',
    1332,
    7.99,
    79.99,
    'price_basic_monthly',
    'price_basic_yearly',
    '{
      "stories_limit": 5,
      "cover_generations": 2,
      "download_access": false,
      "ai_operations": ["foundation", "character", "chapter"],
      "cover_styles": ["minimalist", "artistic"],
      "priority_support": false,
      "early_access": false,
      "creator_tools": false,
      "credit_reversion": true,
      "max_credit_balance": 3996
    }'::jsonb
  ),
  (
    'Premium Subscription',
    'premium',
    2497,
    14.99,
    149.99,
    'price_premium_monthly',
    'price_premium_yearly',
    '{
      "stories_limit": "unlimited",
      "cover_generations": 10,
      "download_access": true,
      "download_limit": 5,
      "download_cost_credits": 100,
      "ai_operations": ["foundation", "character", "chapter", "improvement", "advanced"],
      "cover_styles": ["realistic", "artistic", "fantasy", "minimalist", "vintage"],
      "priority_support": true,
      "early_access": true,
      "creator_tools": true,
      "analytics_dashboard": true,
      "credit_reversion": false,
      "max_credit_balance": null
    }'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Function to handle credit reversion for basic tier users
CREATE OR REPLACE FUNCTION revert_excess_credits()
RETURNS void AS $$
BEGIN
  -- Revert excess credits for basic tier users only
  UPDATE profiles
  SET
    credits_balance = CASE
      WHEN subscription_tier = 'basic' AND credits_balance > 3996 THEN 3996
      ELSE credits_balance
    END
  WHERE
    subscription_tier = 'basic' AND credits_balance > 3996;

  -- Log credit reversions for transparency
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, metadata)
  SELECT
    id,
    -(credits_balance - 3996),
    'credit_reversion',
    'Basic tier credit limit exceeded - excess reverted to platform',
    jsonb_build_object(
      'previous_balance', credits_balance,
      'new_balance', 3996,
      'excess_credits', credits_balance - 3996,
      'reason', 'basic_tier_limit_exceeded'
    )
  FROM profiles
  WHERE subscription_tier = 'basic' AND credits_balance > 3996;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for monthly credit distribution
CREATE OR REPLACE FUNCTION distribute_monthly_credits()
RETURNS void AS $$
DECLARE
  basic_credits INTEGER := 1332;
  premium_credits INTEGER := 2497;
BEGIN
  -- Grant credits to basic tier users
  UPDATE profiles
  SET
    credits_balance = credits_balance + basic_credits,
    credits_earned_total = credits_earned_total + basic_credits
  WHERE subscription_tier = 'basic' AND subscription_status = 'active';

  -- Grant credits to premium tier users
  UPDATE profiles
  SET
    credits_balance = credits_balance + premium_credits,
    credits_earned_total = credits_earned_total + premium_credits
  WHERE subscription_tier = 'premium' AND subscription_status = 'active';

  -- Log the distribution
  INSERT INTO system_logs (log_type, message, metadata)
  VALUES (
    'monthly_credit_distribution',
    'Monthly credits distributed to active subscribers',
    jsonb_build_object(
      'basic_credits', basic_credits,
      'premium_credits', premium_credits,
      'distribution_date', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;