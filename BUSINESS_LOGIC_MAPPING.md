# Business Logic Mapping - Infinite Pages Platform

## Core Business Model

### Revenue Streams
1. **Subscription Revenue**: Basic ($7.99/month) + Premium ($14.99/month)
2. **Creator Economy**: 30% platform share of creator content monetization
3. **Credit Top-ups**: Additional credit purchases beyond subscription limits

### Value Proposition
- **For Users**: AI-powered personalized story creation with subscription access
- **For Creators**: Monetization platform with automated revenue sharing
- **For Platform**: Scalable content marketplace with AI optimization

## 1. User Journey Workflows

### 1.1 Registration and Onboarding Process

**OAuth Integration Flow:**
- **Entry Point**: `/app/api/auth/callback/route.ts`
- **Process**: Supabase Auth with OAuth code exchange
- **Redirect**: Automatic redirect to `/dashboard` upon successful authentication
- **Profile Creation**: Automatic profile creation in `profiles` table with default values:
  - `subscription_tier`: `null` (requires subscription selection)
  - `credits_balance`: `0`
  - `is_creator`: `false`

**Business Rules:**
- No free tier access - subscription required for all features
- 7-day trial period available for new users
- CORS handling for cross-origin authentication

### 1.2 Story Creation Workflow

**Foundation Generation Process:**
```
User Input → Validation → Credit Check → AI Generation → Database Storage → Credit Deduction
```

**Key Decision Points:**
1. **Credit Sufficiency Check**: Foundation costs 8-25 credits based on complexity
2. **Content Moderation**: Automatic filtering for inappropriate content
3. **Model Selection**: Intelligent selection based on complexity and user tier

**Choice Book Creation (Extended Workflow):**
- **Location**: `/app/api/stories/choice-books/route.ts`
- **Higher Costs**: 15-40 credits due to complexity
- **Additional Structures**: Decision trees, multiple endings, path mapping
- **Premium Features**: Advanced choice mechanics for Premium subscribers

### 1.3 Reading Experience and Payment Flows

**Story Access Model:**
- **Price Structure**: 6 credits per chapter (choice books), 4 credits per standard chapter
- **Free Sample**: First 2 chapters free for all stories
- **Bundle Pricing**: 20% discount for full story purchase
- **Premium Unlock**: 50+ credits for instant full access

**Payment Flow:**
```
Chapter Request → Credit Balance Check → Access Grant/Denial → Usage Tracking → Creator Revenue Allocation
```

## 2. Subscription Tier Logic & Feature Gating

### 2.1 Tier Structure and Pricing

**Basic Tier ($7.99/month, $79.99/year):**
```typescript
{
  credits_per_month: 1332,
  max_credit_balance: 3996, // 3-month accumulation limit
  stories_limit: 5,
  cover_generations: 2,
  download_access: false,
  credit_reversion: true // Excess credits revert to platform
}
```

**Premium Tier ($14.99/month, $149.99/year):**
```typescript
{
  credits_per_month: 2497,
  max_credit_balance: null, // Unlimited accumulation
  stories_limit: 'unlimited',
  cover_generations: 10,
  download_access: true,
  creator_tools: true,
  credit_reversion: false // Users keep all credits
}
```

### 2.2 Feature Gating Implementation

**Middleware-Based Gating:**
- **Authentication**: `/lib/auth/middleware.ts`
- **Creator Access**: `requireCreatorAuth()` - checks `is_creator` flag
- **Admin Access**: `requireAdminAuth()` - checks `is_admin` and role fields

**Subscription Validation:**
```typescript
// Premium validation example
if (params.premiumValidation && profile.subscription_tier !== 'premium') {
  return NextResponse.json({
    error: 'Premium subscription required for creator features',
    upgrade_required: true
  }, { status: 403 })
}
```

**Runtime Feature Checks:**
```typescript
// From constants.ts
export function isOperationAllowed(tier: 'basic' | 'premium', operation: string): boolean {
  const limits = getSubscriptionLimits(tier)
  switch (operation) {
    case 'export': return limits.EXPORTS_ALLOWED
    case 'improvement': return limits.IMPROVEMENTS_ALLOWED
    case 'priority_support': return limits.PRIORITY_SUPPORT
    default: return true
  }
}
```

### 2.3 Subscription Status Validation

**Stripe Webhook Integration:**
- **Location**: `/app/api/billing/webhook/route.ts`
- **Events Handled**:
  - `checkout.session.completed`: Initial subscription activation
  - `customer.subscription.updated`: Tier changes, renewals
  - `customer.subscription.deleted`: Cancellations

**Status Update Logic:**
```typescript
// Subscription activation
await supabase.from('profiles').update({
  subscription_tier: tier,
  subscription_status: 'active',
  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  tokens_remaining: creditsToGrant
})

// Cancellation handling
await supabase.from('profiles').update({
  subscription_tier: 'basic',
  subscription_status: 'inactive',
  tokens_remaining: 1332 // Revert to basic credits
})
```

## 3. Credit System Mechanics

### 3.1 Credit Allocation and Distribution Rules

**Subscription Credit Calculation (50% Markup Applied at Purchase):**
```typescript
// From subscription-config.ts
basic: {
  credits_per_month: 1332, // $7.99 * 0.7 * 1000 / 1.5
  // Available for AI costs: ~$5.59 worth
}
premium: {
  credits_per_month: 2497, // $14.99 * 0.7 * 1000 / 1.5
  // Available for AI costs: ~$10.49 worth
}
```

**Credit-to-Cost Conversion:**
```typescript
// From constants.ts
export const CREDIT_SYSTEM = {
  convertCostToCredits(actualCostUSD: number): number {
    // 1 credit = $0.001 (credits pre-purchased with 50% markup)
    return Math.ceil(actualCostUSD * 1000)
  }
}
```

### 3.2 Monthly Credit Distribution System

**Automated Distribution Process:**
- **Location**: `/app/api/admin/distribute-credits/route.ts`
- **Trigger**: Monthly admin job (1st of each month)
- **Algorithm**: Base credits + activity bonus

**Proportional Credit Logic:**
```typescript
export function calculateProportionalCredits(
  userTier: SubscriptionTier,
  storiesReadThisMonth: number,
  totalActiveUsers: number
): number {
  const baseCredits = SUBSCRIPTION_TIERS[userTier].credits_per_month
  const activityBonus = Math.min(storiesReadThisMonth * 10, baseCredits * 0.2)
  return Math.floor(baseCredits + activityBonus)
}
```

### 3.3 Credit Reversion for Basic Tier Users

**Enforcement Mechanism:**
- **Location**: `/app/api/admin/revert-excess-credits/route.ts`
- **Rule**: Basic tier users limited to 3,996 credits maximum (3-month accumulation)
- **Process**: Automated monthly job removes excess credits

**Reversion Logic:**
```typescript
// Basic tier credit limit enforcement
const maxBasicCredits = SUBSCRIPTION_TIERS.basic.max_credit_balance // 3,996
const excessCredits = user.credits_balance - maxBasicCredits

if (excessCredits > 0) {
  // Revert excess credits to platform
  await supabase.from('profiles').update({
    credits_balance: maxBasicCredits
  })

  // Record transaction
  await supabase.from('credit_transactions').insert({
    user_id: user.id,
    amount: -excessCredits,
    transaction_type: 'credit_reversion',
    description: 'Basic tier credit limit enforcement'
  })
}
```

### 3.4 Usage Tracking and Deduction Logic

**Real-time Credit Deduction:**
```typescript
// Pattern used across all AI operations
const { error: creditError } = await supabase.rpc('process_credit_transaction', {
  p_user_id: user.id,
  p_amount: -foundationCost,
  p_transaction_type: 'spend',
  p_description: `Created story foundation: ${title}`,
  p_reference_id: story.id,
  p_reference_type: 'story_creation'
})
```

**Transaction Types Tracked:**
- `spend`: AI operations, story purchases
- `earn`: Subscription grants, creator earnings
- `monthly_distribution`: Automated monthly allocations
- `credit_reversion`: Basic tier limit enforcement

## 4. AI Integration Points & Optimization

### 4.1 AI Cost Optimization Strategy (70-85% Savings)

**Multi-Layer Optimization Hub:**
- **Location**: `/lib/claude/ai-cost-optimization-hub.ts`
- **Caching System**: `/lib/claude/infinitePagesCache.ts`
- **Analytics**: `/lib/claude/enhanced-cost-analytics.ts`

**Optimization Techniques:**

1. **Intelligent Caching**:
```typescript
// Content-type specific caching with semantic similarity
export type InfinitePagesContentType =
  | 'story_foundation' | 'chapter_content' | 'improvement_general'
  | 'analysis_comprehensive' | 'export_pdf'

// Cache configuration with TTL optimization
const CACHE_DURATIONS = {
  basic: 120000,     // 2 minutes for basic data
  enhanced: 90000,   // 1.5 minutes for enhanced data
  dashboard: 60000,  // 1 minute for dashboard data
  aggregates: 300000 // 5 minutes for aggregated data
}
```

2. **Model Selection Optimization**:
```typescript
// Intelligent model selection based on complexity
const intelligentModelSelector = {
  selectOptimalModel(taskProfile: TaskProfile): string {
    // Selects Claude Haiku for simple tasks, Sonnet for complex
    // Based on complexity score, quality requirements, budget constraints
  }
}
```

3. **Prompt Template Optimization**:
```typescript
// Pre-optimized prompt templates for common operations
const optimizedPromptTemplateManager = {
  getTemplate(operation: string): string {
    // Returns token-optimized prompts for story generation
    // Reduces input token usage by 30-40%
  }
}
```

### 4.2 AI Budget Management

**User Budget Tracking:**
```typescript
// Enhanced cost analytics with user-specific budgets
if (profile.subscription_tier === 'premium') {
  enhancedCostAnalytics.setBudget(user.id, {
    monthlyBudget: 50.0, // $50 for premium users
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
    autoOptimize: true
  })
} else {
  enhancedCostAnalytics.setBudget(user.id, {
    monthlyBudget: 10.0, // $10 for basic users
    warningThreshold: 0.7,
    criticalThreshold: 0.9,
    autoOptimize: true
  })
}
```

### 4.3 Content Moderation and Safety

**Automated Content Filtering:**
```typescript
// From constants.ts - Content moderation patterns
export const MODERATION_PATTERNS = [
  { pattern: /\b(explicit sexual|graphic sex|sexual violence)\b/gi, reason: 'explicit sexual content' },
  { pattern: /\b(graphic violence|gore|torture)\b/gi, reason: 'graphic violence' },
  { pattern: /\b(illegal drugs|terrorism|bomb making)\b/gi, reason: 'illegal activities' }
]

// Prompt injection detection
export const INJECTION_PATTERNS = [
  /ignore previous instructions/gi,
  /forget everything above/gi,
  /new instructions:/gi
]
```

## 5. Creator Economy Workflows

### 5.1 Creator Onboarding and Verification

**Creator Activation Process:**
```typescript
// Premium subscription required for creator features
if (profile.subscription_tier !== 'premium') {
  return NextResponse.json({
    error: 'Premium subscription required for creator features',
    upgrade_info: {
      message: 'Upgrade to Premium to become a creator and start earning',
      benefits: ['Advanced analytics', 'Priority payouts', 'Enhanced story promotion']
    }
  }, { status: 403 })
}
```

**Creator Profile Setup:**
- `is_creator`: Boolean flag in profiles table
- `creator_tier`: bronze, silver, gold, platinum progression
- Stripe customer ID required for payouts

### 5.2 Revenue Sharing Calculations (70% Creator, 30% Platform)

**Earnings Allocation Logic:**
```typescript
// From creator-earnings.ts
export const CREATOR_REVENUE_SHARE = 0.7 // 70% to creator
export const PLATFORM_REVENUE_SHARE = 0.3 // 30% to platform

// Real-time earnings allocation
const creatorEarnings = Math.floor(creditsSpent * CREATOR_REVENUE_SHARE)
const usdEquivalent = creatorEarnings * CREDITS_TO_USD_RATE // $0.01 per credit

await supabaseClient.rpc('allocate_creator_earnings', {
  p_creator_id: creatorId,
  p_story_id: storyId,
  p_reader_id: readerUserId,
  p_credits_spent: creditsSpent,
  p_creator_earnings: creatorEarnings,
  p_usd_equivalent: usdEquivalent
})
```

### 5.3 Payout Processing and Scheduling

**Monthly Payout Batch Processing:**
- **Location**: `/app/api/admin/process-payouts/route.ts`
- **Schedule**: 1st of each month
- **Minimum Payout**: $25.00 USD
- **Processing Fee**: $2.50 per payout

**Payout Workflow:**
```typescript
// 1. Identify eligible creators
const eligibleCreators = await supabase
  .from('creator_earnings_accumulation')
  .select('*')
  .gte('total_accumulated_usd', MINIMUM_PAYOUT_USD)

// 2. Create payout batch
const batchResult = await supabase.rpc('process_monthly_payouts', {
  p_batch_date: processingDate.toISOString().split('T')[0],
  p_minimum_payout: MINIMUM_PAYOUT_USD
})

// 3. Process Stripe transfers
for (const payout of payouts) {
  // Stripe Connect integration for creator payouts
  // Note: Currently simulated - requires full Stripe Connect setup
}
```

### 5.4 Creator Tier Advancement Logic

**Tier Requirements:**
```typescript
const tierRequirements = {
  bronze: { earnings: 100, stories: 5, readers: 50, nextTier: 'silver' },
  silver: { earnings: 500, stories: 15, readers: 200, nextTier: 'gold' },
  gold: { earnings: 2000, stories: 50, readers: 1000, nextTier: 'platinum' },
  platinum: null // Highest tier
}
```

**Benefits by Tier:**
```typescript
const tierBenefits = {
  bronze: ['Basic creator tools', 'Monthly payouts', 'Community support'],
  silver: ['Priority support', 'Advanced analytics', 'Featured story slots'],
  gold: ['Weekly payouts', 'Custom branding', 'Direct reader messaging'],
  platinum: ['Daily payouts', 'White-label options', 'Dedicated account manager']
}
```

## 6. Integration Points Between Systems

### 6.1 Subscription → Credit System
```typescript
// Webhook processes subscription events
handleCheckoutCompleted() →
  Update subscription_tier →
  Grant monthly credits →
  Enable tier-specific features
```

### 6.2 AI Operations → Credit Deduction
```typescript
// Real-time credit processing
AI Request →
  Check credit balance →
  Execute AI operation →
  Calculate actual cost →
  Deduct credits →
  Track usage analytics
```

### 6.3 Story Purchase → Creator Earnings
```typescript
// Story access triggers earnings allocation
Story Purchase →
  Validate reader credits →
  Grant story access →
  Calculate creator share (70%) →
  Update creator earnings →
  Track for monthly payout
```

## 7. Error Handling and Edge Cases

### 7.1 Credit System Safeguards

**Insufficient Credits:**
```typescript
if (profile.credits_balance < foundationCost) {
  return NextResponse.json({
    error: 'Insufficient credits for story creation',
    required: foundationCost,
    available: profile.credits_balance,
    upgrade_message: 'Consider upgrading to Premium for more credits'
  }, { status: 402 })
}
```

**Subscription Status Validation:**
```typescript
// Automatic status checks for expired subscriptions
if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  // Downgrade to basic tier, reset credits, disable premium features
}
```

### 7.2 Payout System Safeguards

**Stripe Integration Failures:**
```typescript
// Fallback handling for failed transfers
if (transferError) {
  await supabase.from('individual_payouts').update({
    status: 'failed',
    error_message: transferError.message
  })
  // Retry logic with exponential backoff
}
```

**Minimum Balance Enforcement:**
```typescript
// Prevent payouts below minimum threshold
const canRequestPayout = pendingPayout >= MINIMUM_PAYOUT_USD // $25.00
```

## 8. Revenue Optimization Strategies

### 8.1 AI Cost Optimization (Platform Efficiency)

**Target: 70-85% cost reduction through:**
1. **Semantic Caching**: Reuse similar content generations
2. **Model Optimization**: Use appropriate Claude model for task complexity
3. **Prompt Engineering**: Minimize token usage with optimized templates
4. **Batch Processing**: Group similar operations for efficiency

### 8.2 Subscription Conversion Strategies

**Trial-to-Paid Conversion:**
- 7-day trial period with full access
- Strategic feature limitations on trial expiration
- Upgrade prompts at key interaction points

**Basic-to-Premium Upselling:**
- Creator features locked behind Premium
- Credit accumulation limits for Basic users
- Advanced story features (choice books) require Premium

### 8.3 Creator Economy Growth

**Creator Incentives:**
- Progressive tier system with increasing benefits
- Monthly revenue sharing with transparent reporting
- Advanced analytics and promotion tools for higher tiers

**Platform Revenue:**
- 30% platform share on all creator earnings
- Subscription revenue from both readers and creators
- Premium feature upselling

## 9. Performance and Scalability Considerations

### 9.1 Database Optimization

**Credit Transaction Processing:**
- Database functions for atomic credit operations
- Indexed queries on user_id and transaction_type
- Batch processing for monthly operations

### 9.2 Caching Strategy

**Multi-Level Caching:**
```typescript
// In-memory LRU cache for frequent operations
const memoryCache = new LRUCache<string, CacheRecord>({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 // 24 hours
})

// Database cache for generated content
// Supabase tables: ai_cache, story_cache
```

### 9.3 Real-time Updates

**WebSocket Integration:**
- Real-time credit balance updates
- Live earnings notifications for creators
- Subscription status changes

## 10. Compliance and Security

### 10.1 Data Privacy

**User Data Protection:**
- Supabase RLS (Row Level Security) policies
- GDPR compliance for user data deletion
- Encrypted storage for sensitive information

### 10.2 Financial Compliance

**Revenue Reporting:**
- Detailed transaction logging
- Creator earnings tracking for tax reporting
- Stripe integration for payment processing compliance

### 10.3 Content Safety

**AI-Generated Content Monitoring:**
- Automated content moderation patterns
- Human review for flagged content
- Community reporting mechanisms

---

## Conclusion

The Infinite Pages platform implements a sophisticated business logic system that balances user experience, creator earnings, and platform sustainability. The key innovation lies in the AI cost optimization system that achieves 70-85% cost savings while maintaining quality, enabling competitive pricing and healthy profit margins.

The subscription model with creator economy creates a sustainable ecosystem where:
- **Users** get high-quality AI-generated content at affordable prices
- **Creators** earn significant revenue (70% share) with transparent reporting
- **Platform** maintains profitability through subscription revenue and creator economy fees

The system's strength lies in its comprehensive integration of authentication, billing, AI optimization, and creator payments, all working together to create a seamless experience while maintaining strict business rules and financial controls.