# Infinite Pages Website Debugger

A specialized debugging tool for testing and analyzing the Infinite Pages story creation platform at https://www.infinite-pages.com.

## Features

### 🎯 Infinite Pages Specific Testing
- **Story Creation Endpoints**: Tests all story creation APIs (`/api/stories/*`, `/api/demo/story`)
- **Authentication System**: Verifies login/signup functionality
- **Admin Panel Security**: Checks admin endpoint security
- **Claude API Integration**: Detects Claude service issues and failures

### 🤖 Auto-Fix Capabilities
- **Safe Auto-Fixes**: Issues Claude can fix automatically (accessibility, meta tags, etc.)
- **Approval Required**: Critical issues needing human review (API failures, server errors)
- **Infinite Pages Context**: Platform-specific issue classification and solutions

### 🔍 Comprehensive Analysis
- Page accessibility and SEO
- Performance monitoring
- Console error detection
- Network failure tracking
- API endpoint status verification

## Installation

```bash
cd tools/debugger
npm install
npm run setup  # Installs Playwright browser
```

## Usage

### Basic Testing
```bash
# Test infinite-pages.com
npm test

# Test with detailed fix plan
npm run test:fix-plan

# Get JSON output for automation
npm run test:json
```

### Advanced Options
```bash
# Test specific functionality
node cli.js https://www.infinite-pages.com --endpoints
node cli.js https://www.infinite-pages.com --story-creation

# Show only auto-fixable issues
node cli.js --auto-fix-only

# Show only critical issues needing approval
node cli.js --approval-only

# Test local development
npm run test:local
```

### Server Mode
```bash
# Start debugging server
npm start

# Test via HTTP API
curl -X POST http://localhost:3001/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.infinite-pages.com"}'
```

## Example Output

```
🔍 Testing Infinite Pages: https://www.infinite-pages.com
🎯 Focus: Story creation, API endpoints, and platform functionality

📊 Infinite Pages Test Results
URL: https://www.infinite-pages.com
Status: CRITICAL
Load Time: 2341ms (moderate)

🎯 INFINITE PAGES STATUS:
   📝 Story Creation: failing_server_error
   🔐 Authentication: working
   👑 Admin Panel: secured
   🧪 Endpoints Tested: 12

🤖 AUTO-FIX ANALYSIS:
   ✅ Can auto-fix: 3 issues
   ⚠️  Need approval: 2 issues
   🚨 Critical issues: 1 issues
   🎯 Infinite Pages specific: 1 issues
   📋 🚨 CRITICAL: 1 critical issues found. Infinite Pages story creation likely broken.

⚠️  NEEDS APPROVAL (2):
  1. 🚨 🎯 [CRITICAL] Demo story creation failing with 500 error
     🚫 Reason: Story creation depends on Claude API - affects core functionality
  2. ⚠️ [HIGH] Missing meta description for story platform
     🚫 Reason: SEO impact for story discovery
```

## Auto-Fix Categories

### ✅ Claude Can Auto-Fix (Safe)
- Missing alt text on images
- Missing page titles and meta descriptions
- Heading structure issues (h1, h2 hierarchy)
- Basic accessibility improvements
- Missing language attributes

### ⚠️ Needs Approval (Requires Review)
- **Claude API Errors**: Story generation failures (500/503 errors)
- **Missing Endpoints**: Novel/AI-assisted story creation (404 errors)
- **Authentication Issues**: Login/signup problems
- **Performance Issues**: Slow loading times

### 🚫 Manual Only (Critical Infrastructure)
- Environment variable configuration (Vercel)
- Database migration requirements
- Stripe payment integration
- Deployment configuration issues

## Infinite Pages Specific Checks

### Story Creation System
- `/api/stories` - Main story creation
- `/api/stories/novel` - Enhanced novel creation
- `/api/stories/ai-assisted` - AI collaborative writing
- `/api/stories/guest` - Guest story creation
- `/api/demo/story` - Demo with rate limiting

### Authentication & Admin
- `/api/admin/request-flow/health` - System health
- User authentication middleware
- Admin panel security verification
- Rate limiting functionality

### Integration Status
- **Claude API**: Anthropic integration for story generation
- **Supabase**: Database and authentication backend
- **Vercel**: Serverless deployment status
- **Rate Limiting**: Prevents API abuse

## Exit Codes

- `0` - All tests passed, no issues
- `1` - Non-critical issues found (warnings, needs approval)
- `2` - Critical issues detected (story creation broken)
- `3` - Test execution failed (tool error)

## Integration with Claude Code

This tool is designed to work seamlessly with Claude Code in Cursor:

1. **Automated Testing**: Run tests and get structured results
2. **Auto-Fix Suggestions**: Claude receives specific fix instructions
3. **Context-Aware**: Understands Infinite Pages architecture
4. **JSON Output**: Machine-readable results for automation

### For Claude Code Developers

```bash
# Get auto-fix instructions in JSON
node cli.js --auto-fix-only --json

# Get approval-needed issues with fix suggestions
node cli.js --approval-only --fix-plan

# Quick endpoint health check
curl http://localhost:3001/test-endpoints/www.infinite-pages.com
```

## Troubleshooting

### Common Issues

**Playwright Installation**
```bash
npm run setup
# or manually: npx playwright install chromium
```

**Permission Errors**
```bash
chmod +x cli.js  # Make CLI executable
```

**Rate Limiting**
The tool respects infinite-pages.com rate limits. If you get 429 errors, wait a moment between tests.

**Network Timeouts**
Increase timeout for slow connections:
```bash
node cli.js https://www.infinite-pages.com --timeout 30000
```

## Development

### Adding New Tests
1. Add rules to `autofix-rules.js`
2. Update endpoint configuration
3. Implement detection logic in `cli.js`
4. Test with `npm test`

### Server API
- `POST /crawl` - Full website analysis
- `GET /health` - Service health check
- `GET /test-endpoints/:domain` - Quick endpoint test

---

Built specifically for Infinite Pages story creation platform testing and debugging. Integrates with Claude Code for automated issue detection and resolution.