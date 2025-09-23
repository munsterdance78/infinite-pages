# Database Schema Requirements Analysis

## Current State Analysis

### Schema Files Located
1. **Primary Schema**: `database-schema.sql` - Complete base schema
2. **Migration 001**: `supabase/migrations/001_initial_schema.sql` - Core tables
3. **Migration 007**: `supabase/migrations/007_business_logic_tables.sql` - Business logic tables
4. **TypeScript Types**: `lib/supabase/types.ts` - Comprehensive type definitions

### Critical Schema Mismatch Identified

**MAJOR ISSUE**: TypeScript types in `lib/supabase/types.ts` include extensive creator economy tables that are **NOT** present in the actual database schema files:

#### Missing Tables in Database Schema
1. **credit_packages** - Credit system packages (only in types.ts)
2. **payments** - Payment tracking
3. **creator_earnings** - Creator revenue tracking
4. **payouts** - Creator payout management
5. **story_pricing** - Content monetization
6. **story_purchases** - Purchase transactions
7. **reading_progress** - User reading analytics
8. **user_library** - Personal story collections
9. **subscription_usage** - Usage analytics
10. **story_covers** - Cover art management
11. **cover_generation_queue** - Cover generation pipeline
12. **ai_usage_logs** - AI transparency tracking
13. **cache_rewards** - Cache performance incentives
14. **creator_earnings_accumulation** - Creator earnings tracking
15. **monthly_payout_batches** - Batch payout processing
16. **individual_payouts** - Individual payout records

### Complete Database Schema Requirements

## Core User Management Tables

### profiles (EXISTS - needs updates)
```sql
Primary Key: id UUID (references auth.users)
Core Fields:
- email, full_name, subscription_tier, subscription_status
- stripe_customer_id, current_period_end
- tokens_remaining (1332 default), tokens_used_total
- stories_created, words_generated
- onboarding_complete, writing_goals[], preferred_genres[]
- experience_level, writing_frequency
MISSING FIELDS (in types.ts):
- credits_balance, credits_earned_total, credits_spent_total
- cache_hits, cache_discount_earned
- is_creator, creator_tier, total_earnings_usd, pending_payout_usd
- stripe_connect_account_id, stripe_account_status
- stripe_charges_enabled, stripe_payouts_enabled
- display_name
```

### stories (EXISTS - complete)
```sql
Primary Key: id UUID
Foreign Keys: user_id -> profiles.id
Fields: title, genre, premise, foundation (JSONB), outline (JSONB)
Status: 'draft' | 'in_progress' | 'completed' | 'published'
Metrics: word_count, chapter_count, total_tokens_used, total_cost_usd
```

### chapters (EXISTS - complete)
```sql
Primary Key: id UUID
Foreign Keys: story_id -> stories.id
Fields: chapter_number, title, content, summary
Metrics: word_count, tokens_used_input, tokens_used_output
Cost tracking: generation_cost_usd, prompt_type
```

## Credit & Payment System Tables

### credit_packages (MISSING - critical)
```sql
Primary Key: id UUID
Fields:
- name, description, credits_amount, price_usd, bonus_credits
- stripe_price_id, is_active, sort_order
Purpose: Subscription tier definitions and pricing
```

### credit_transactions (EXISTS in migration 007)
```sql
Primary Key: id UUID
Foreign Keys: user_id -> profiles.id
Fields:
- transaction_type: 'purchase' | 'spend' | 'earn' | 'bonus' | 'refund'
- amount, balance_after, description
- reference_id, reference_type, metadata (JSONB)
Purpose: Complete credit movement audit trail
```

### payments (MISSING - critical)
```sql
Primary Key: id UUID
Foreign Keys: user_id, package_id
Stripe Integration:
- stripe_payment_intent_id, stripe_customer_id
- amount_usd, credits_purchased, bonus_credits
- status: 'pending' | 'succeeded' | 'failed' | 'canceled'
- payment_method, failure_reason, processed_at
```

## Creator Economy Tables (ALL MISSING)

### creator_earnings
```sql
Primary Key: id UUID
Foreign Keys: creator_id, story_id, reader_id
Fields:
- credits_earned, usd_equivalent
- transaction_id
Purpose: Track individual earning events
```

### payouts
```sql
Primary Key: id UUID
Foreign Keys: creator_id
Fields:
- amount_usd, stripe_transfer_id
- status: 'pending' | 'processing' | 'paid' | 'failed'
- period_start, period_end, earnings_count
- failure_reason, processed_at
```

### story_pricing
```sql
Primary Key: id UUID
Foreign Keys: story_id, creator_id
Fields:
- price_per_chapter, bundle_discount
- is_free_sample, free_chapters
- premium_unlock_price
```

### story_purchases
```sql
Primary Key: id UUID
Foreign Keys: user_id, story_id, creator_id
Fields:
- purchase_type: 'chapter' | 'bundle' | 'premium_unlock'
- chapters_unlocked (array), credits_spent
- creator_earnings
```

## Content Management Tables (MISSING)

### reading_progress
```sql
Primary Key: id UUID
Foreign Keys: user_id, story_id, chapter_id
Fields:
- progress_percentage, last_read_at
- reading_time_minutes
Purpose: Cross-device reading sync
```

### user_library
```sql
Primary Key: id UUID
Foreign Keys: user_id, story_id
Fields:
- added_at, is_favorite
- reading_status: 'want_to_read' | 'reading' | 'completed' | 'dropped'
- personal_rating, personal_notes
```

### subscription_usage
```sql
Primary Key: id UUID
Foreign Keys: user_id
Fields:
- subscription_tier, credits_used_this_month
- stories_read_this_month, downloads_this_month
- period_start, period_end
Purpose: Usage analytics and limit enforcement
```

## Cover Generation System (MISSING)

### story_covers
```sql
Primary Key: id UUID
Foreign Keys: story_id
Fields:
- cover_url, cover_style: 'realistic' | 'artistic' | 'fantasy' | 'minimalist' | 'vintage'
- generation_prompt, is_primary
- generation_cost, sd_model_used
```

### cover_generation_queue
```sql
Primary Key: id UUID
Foreign Keys: story_id, user_id
Fields:
- generation_prompt, cover_style
- status: 'pending' | 'generating' | 'completed' | 'failed'
- priority, retry_count, error_message
- webui_task_id, estimated_completion
```

## Analytics & Transparency Tables (MISSING)

### ai_usage_logs
```sql
Primary Key: id UUID
Foreign Keys: user_id, story_id, chapter_id
Fields:
- operation_type: 'foundation' | 'character' | 'cover' | 'chapter' | 'improvement'
- tokens_input, tokens_output, actual_cost_usd, charged_amount_usd
- markup_percentage, ai_model_used
- generation_time_seconds
Purpose: Complete AI cost transparency
```

### cache_rewards
```sql
Primary Key: id UUID
Foreign Keys: user_id, story_id, chapter_id
Fields:
- cache_key, credits_saved
- original_cost, discounted_cost, hit_count
Purpose: Cache performance incentives
```

## Creator Payout System (MISSING)

### creator_earnings_accumulation
```sql
Primary Key: id UUID
Foreign Keys: creator_id
Fields:
- total_accumulated_usd
- last_payout_date, last_payout_amount
Purpose: Running total for payout processing
```

### monthly_payout_batches
```sql
Primary Key: id UUID
Fields:
- batch_date, total_creators_paid, total_amount_usd
- stripe_batch_id
- processing_status: 'pending' | 'processing' | 'completed' | 'failed'
```

### individual_payouts
```sql
Primary Key: id UUID
Foreign Keys: batch_id, creator_id
Fields:
- amount_usd, stripe_transfer_id
- status: 'pending' | 'processing' | 'completed' | 'failed'
- error_message
```

## Required Actions

### 1. Database Schema Completion
- Create migration for missing creator economy tables
- Add missing fields to profiles table
- Implement complete credit_packages table

### 2. Type Alignment
- Ensure TypeScript types match actual database schema
- Add any missing type definitions
- Remove orphaned type definitions

### 3. Index Creation
- Add performance indexes for creator earnings queries
- Index foreign key relationships
- Optimize for payout batch processing

### 4. RLS Policy Implementation
- Creator economy access controls
- Payment data protection
- Analytics data privacy

### 5. Function Creation
- Creator earnings calculation functions
- Automated payout processing
- Cache reward calculation

## Priority Implementation Order

### Phase 1: Critical Tables (Immediate)
1. credit_packages - Required for subscription system
2. payments - Required for billing integration
3. Missing profile fields - Required for creator features

### Phase 2: Creator Economy (High Priority)
1. creator_earnings & payouts tables
2. story_pricing & story_purchases
3. Creator payout processing functions

### Phase 3: User Experience (Medium Priority)
1. reading_progress & user_library
2. subscription_usage analytics
3. Cover generation system

### Phase 4: Analytics & Optimization (Lower Priority)
1. ai_usage_logs transparency
2. cache_rewards system
3. Advanced analytics tables

This schema analysis reveals a significant disconnect between the implemented TypeScript types and the actual database schema, requiring immediate attention to align the system architecture.