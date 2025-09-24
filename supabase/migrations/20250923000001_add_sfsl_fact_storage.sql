-- Migration: Add SFSL (Story Fact Structured Language) support
-- This adds hierarchical fact storage, character voice patterns, and story bible compliance
-- Part of infinite-pages v2.0 fact-based context optimization

-- NEW TABLE: Hierarchical fact storage
CREATE TABLE story_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL CHECK (fact_type IN ('universe', 'series', 'book', 'chapter')),
  sfsl_data TEXT NOT NULL,
  extraction_cost_usd NUMERIC DEFAULT 0,
  compression_ratio NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW TABLE: Character voice patterns
CREATE TABLE character_voice_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  voice_pattern_sfsl TEXT NOT NULL,
  consistency_score NUMERIC DEFAULT 0,
  last_validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW TABLE: Story bible conflicts
CREATE TABLE story_bible_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize for hierarchical queries
CREATE INDEX idx_story_facts_hierarchy ON story_facts(story_id, fact_type, updated_at DESC);
CREATE INDEX idx_character_voice_story ON character_voice_patterns(story_id, character_name);
CREATE INDEX idx_conflicts_status ON story_bible_conflicts(story_id, status);

-- Add RLS using existing patterns
ALTER TABLE story_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_voice_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_bible_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own story facts" ON story_facts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own voice patterns" ON character_voice_patterns
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM stories WHERE id = story_id));
CREATE POLICY "Users can manage their own conflicts" ON story_bible_conflicts
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM stories WHERE id = story_id));

-- EXTEND: Add fact extraction metrics to existing analytics
ALTER TABLE ai_usage_logs ADD COLUMN fact_extraction_metrics JSONB;

-- Add helpful comments
COMMENT ON TABLE story_facts IS 'Hierarchical storage of compressed story facts using SFSL format';
COMMENT ON TABLE character_voice_patterns IS 'Character-specific voice patterns for consistency checking';
COMMENT ON TABLE story_bible_conflicts IS 'Tracks story consistency issues and their resolution status';
COMMENT ON COLUMN story_facts.sfsl_data IS 'Compressed story facts in SFSL (Story Fact Structured Language) format';
COMMENT ON COLUMN story_facts.compression_ratio IS 'Ratio of original content length to compressed SFSL length';
COMMENT ON COLUMN character_voice_patterns.consistency_score IS 'Score (0-100) indicating voice pattern consistency';
COMMENT ON COLUMN ai_usage_logs.fact_extraction_metrics IS 'JSONB storing extraction performance data: compression ratios, token savings, etc.';