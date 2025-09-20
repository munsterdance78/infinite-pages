# Stripe Connect Implementation Guide

## Overview

This implementation provides a complete Stripe Connect integration for INFINITE-PAGES creator payouts, enabling the platform's 70/30 revenue share model.

## 🔧 Setup Requirements

### 1. Stripe Dashboard Configuration

1. **Enable Stripe Connect**
   - Go to Stripe Dashboard > Connect
   - Click "Get started with Connect"
   - Choose "Platform or marketplace"

2. **Configure Connect Settings**
   - Business type: Platform/Marketplace
   - Revenue model: "Take a percentage of each transaction"
   - Platform fee: 30% (to implement 70/30 split)

3. **Get Connect Application ID**
   - In Connect settings, copy your `STRIPE_CONNECT_CLIENT_ID`
   - Add to your environment variables

### 2. Environment Variables

Add to your `.env.local`:

```bash
# Existing Stripe variables
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New Connect variables
STRIPE_CONNECT_CLIENT_ID=ca_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Webhook Configuration

Add these webhook endpoints in Stripe Dashboard:

**Endpoint URL**: `https://your-domain.com/api/webhooks/stripe`

**Events to listen for**:
```
account.updated
account.application.deauthorized
transfer.created
transfer.updated
transfer.failed
payout.created
payout.failed
payment_intent.succeeded
payment_intent.payment_failed
```

## 📁 Files Created

### API Endpoints

- **`/api/creators/stripe/onboard`** - Start Connect onboarding
- **`/api/creators/stripe/callback`** - Handle onboarding completion
- **`/api/creators/stripe/refresh`** - Refresh onboarding links
- **`/api/creators/stripe/status`** - Check account status

### Components

- **`/components/StripeConnectOnboarding.tsx`** - React onboarding UI

## 🚀 Implementation Details

### Creator Onboarding Flow

1. **Check Eligibility**
   ```typescript
   // User must be:
   // - Creator (is_creator: true)
   // - Premium subscriber (subscription_tier: 'premium')
   ```

2. **Create Connect Account**
   ```typescript
   const account = await stripe.accounts.create({
     type: 'express',
     country: 'US',
     capabilities: {
       card_payments: { requested: true },
       transfers: { requested: true }
     },
     business_profile: {
       mcc: '5815', // Digital Goods
       product_description: 'AI-generated story content'
     }
   })
   ```

3. **Generate Onboarding Link**
   ```typescript
   const accountLink = await stripe.accountLinks.create({
     account: account.id,
     refresh_url: `${SITE_URL}/creator/stripe/refresh`,
     return_url: `${SITE_URL}/creator/stripe/success`,
     type: 'account_onboarding'
   })
   ```

### Revenue Share Implementation

The 70/30 split is implemented through your existing creator earnings system:

```typescript
// In lib/creator-earnings.ts
const creatorEarnings = Math.floor(creditsSpent * CREATOR_REVENUE_SHARE) // 0.7
const platformShare = creditsSpent - creatorEarnings // 0.3
```

### Payout Processing

Real payouts are now enabled by updating the existing payout functions:

```typescript
// Replace simulated transfers with real ones
const transfer = await stripe.transfers.create({
  amount: Math.round(netAmount * 100),
  currency: 'usd',
  destination: stripe_connect_account_id,
  metadata: {
    creator_id: user.id,
    payout_batch_id: 'batch_id'
  }
})
```

## 🔄 Usage Flow

### For Creators

1. **Start Onboarding**
   ```javascript
   // POST /api/creators/stripe/onboard
   const response = await fetch('/api/creators/stripe/onboard', {
     method: 'POST',
     body: JSON.stringify({ country: 'US', business_type: 'individual' })
   })

   // Redirect to onboarding_url
   window.location.href = data.onboarding_url
   ```

2. **Check Status**
   ```javascript
   // GET /api/creators/stripe/onboard
   const status = await fetch('/api/creators/stripe/onboard')
   // Returns: not_started, incomplete, complete, etc.
   ```

3. **Complete Onboarding**
   - User completes Stripe onboarding
   - Stripe redirects to `/creator/stripe/success`
   - Callback handler verifies completion

### For Admin

Existing admin payout processing (`/api/admin/process-payouts`) now uses real Stripe transfers instead of simulations.

## 🎨 Frontend Integration

### Basic Usage

```tsx
import StripeConnectOnboarding from '@/components/StripeConnectOnboarding'

export default function CreatorDashboard() {
  return (
    <div>
      <h1>Creator Dashboard</h1>
      <StripeConnectOnboarding />
    </div>
  )
}
```

### Custom Implementation

```tsx
const [connectStatus, setConnectStatus] = useState(null)

// Check status
const checkStatus = async () => {
  const response = await fetch('/api/creators/stripe/onboard')
  const status = await response.json()
  setConnectStatus(status)
}

// Start onboarding
const startOnboarding = async () => {
  const response = await fetch('/api/creators/stripe/onboard', {
    method: 'POST'
  })
  const data = await response.json()

  if (data.onboarding_url) {
    window.location.href = data.onboarding_url
  }
}
```

## ✅ Testing

### 1. Test Mode Setup

- Use Stripe test keys (`sk_test_...`)
- Test Connect accounts are automatically created
- No real money transfers

### 2. Test Account Creation

```bash
# Create test creator account
curl -X POST http://localhost:3000/api/creators/stripe/onboard \\
  -H "Content-Type: application/json" \\
  -d '{"country": "US", "business_type": "individual"}'
```

### 3. Verify Onboarding

```bash
# Check onboarding status
curl http://localhost:3000/api/creators/stripe/onboard
```

## 🔒 Security Features

### Authentication
- All endpoints require user authentication
- Creator and subscription tier verification
- Account ownership validation

### Data Protection
- Stripe account IDs stored securely in database
- No sensitive payment data stored locally
- Webhook signature verification

### Error Handling
- Comprehensive Stripe error handling
- Graceful fallbacks for API failures
- User-friendly error messages

## 📊 Monitoring

### Account Status Tracking
```sql
-- Check Connect account distribution
SELECT
  COUNT(*) as total_creators,
  COUNT(stripe_connect_account_id) as connected_accounts,
  COUNT(CASE WHEN pending_payout_usd >= 25 THEN 1 END) as payout_eligible
FROM profiles
WHERE is_creator = true;
```

### Payout Success Rates
```sql
-- Monitor payout success rates
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_payouts,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
  AVG(amount_usd) as avg_amount
FROM individual_payouts
GROUP BY month
ORDER BY month DESC;
```

## 🚨 Troubleshooting

### Common Issues

1. **"Connect account required" error**
   - User hasn't completed onboarding
   - Run onboarding flow again

2. **"Invalid Stripe Connect account" error**
   - Account may be deleted or suspended
   - Check account status in Stripe Dashboard

3. **Webhook failures**
   - Verify webhook endpoint URL
   - Check webhook signature validation

### Debug Mode

Enable detailed error logging in development:

```typescript
// In route handlers
if (process.env.NODE_ENV === 'development') {
  console.log('Detailed error:', error)
}
```

## 🔄 Migration from Simulated Payouts

The existing payout system is automatically upgraded:

1. **Existing simulated payouts** continue to work
2. **New payouts** use real Stripe transfers
3. **Database schema** remains unchanged
4. **Creator earnings** calculations unchanged

## 📈 Production Checklist

### Pre-Launch
- [ ] Stripe Connect application approved
- [ ] Live API keys configured
- [ ] Webhook endpoints verified
- [ ] Legal terms updated for marketplace
- [ ] Creator agreement includes Connect terms

### Launch
- [ ] Creator communication about new payout system
- [ ] Monitor Connect account creation rates
- [ ] Track payout success rates
- [ ] Customer support training on Connect issues

### Post-Launch
- [ ] Regular payout batch monitoring
- [ ] Account verification assistance
- [ ] Performance metrics tracking
- [ ] Creator feedback collection

## 📞 Support

### For Creators
- Setup assistance available through creator dashboard
- Status checking via `/api/creators/stripe/status`
- Automatic retry logic for failed operations

### For Platform
- Comprehensive error logging
- Admin oversight via existing admin panels
- Stripe Dashboard for detailed Connect metrics

## 🔗 Related Documentation

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Express Accounts Guide](https://stripe.com/docs/connect/express-accounts)
- [Transfer API Reference](https://stripe.com/docs/api/transfers)
- [Connect Webhooks](https://stripe.com/docs/connect/webhooks)