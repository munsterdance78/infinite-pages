-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table for user data
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'premium')),
  subscription_status TEXT DEFAULT 'inactive',
  stripe_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  tokens_remaining INTEGER DEFAULT 1332,
  tokens_used_total INTEGER DEFAULT 0,
  last_token_grant TIMESTAMPTZ DEFAULT NOW(),
  stories_created INTEGER DEFAULT 0,
  words_generated INTEGER DEFAULT 0,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  writing_goals TEXT[],
  preferred_genres TEXT[],
  experience_level TEXT,
  writing_frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
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
CREATE TABLE chapters (
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
CREATE TABLE generation_logs (
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
CREATE TABLE exports (
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

-- Indexes for performance
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_created_at ON stories(created_at DESC);
CREATE INDEX idx_chapters_story_id ON chapters(story_id);
CREATE INDEX idx_chapters_number ON chapters(story_id, chapter_number);
CREATE INDEX idx_generation_logs_user_id ON generation_logs(user_id);
CREATE INDEX idx_generation_logs_created_at ON generation_logs(created_at DESC);
CREATE INDEX idx_exports_user_id ON exports(user_id);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

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

-- Exports policies
CREATE POLICY "Users can view own exports" ON exports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exports" ON exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to grant monthly tokens
CREATE OR REPLACE FUNCTION grant_monthly_tokens()
RETURNS void AS $
BEGIN
  UPDATE profiles 
  SET 
    tokens_remaining = CASE
      WHEN subscription_tier = 'basic' THEN
        CASE
          WHEN tokens_remaining + 1332 > 3996 THEN 3996
          ELSE tokens_remaining + 1332
        END
      WHEN subscription_tier = 'premium' THEN tokens_remaining + 2497
    END,
    last_token_grant = NOW()
  WHERE 
    last_token_grant < DATE_TRUNC('month', NOW())
    OR last_token_grant IS NULL;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;