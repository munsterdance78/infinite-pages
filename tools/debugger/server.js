// server.js - Infinite Pages Website Debugger Server
const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const { classifyIssue, getEndpointTests, analyzeEndpointResults } = require('./autofix-rules');

const app = express();
app.use(express.json());
app.use(cors());

// Simple URL validation
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

// Main crawl endpoint with Infinite Pages specific testing
app.post('/crawl', async (req, res) => {
  const { url, options = {} } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'Invalid URL format' });

  const results = {
    url,
    timestamp: new Date().toISOString(),
    errors: [],
    warnings: [],
    accessibility: [],
    performance: {},
    infinitePages: {
      endpointTests: [],
      storyCreationStatus: 'unknown',
      authStatus: 'unknown',
      adminStatus: 'unknown'
    },
    summary: { errorCount: 0, warningCount: 0, status: 'unknown' }
  };

  let browser, page;
  const startTime = Date.now();

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Enhanced console error capture with Infinite Pages context
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const error = {
          type: 'console_error',
          message: msg.text(),
          location: msg.location()
        };
        const classification = classifyIssue(error);
        results.errors.push({ ...error, ...classification });
      } else if (msg.type() === 'warning') {
        results.warnings.push({
          type: 'console_warning',
          message: msg.text()
        });
      }
    });

    // Enhanced network monitoring for Infinite Pages APIs
    page.on('response', response => {
      const url = response.url();
      const status = response.status();

      // Log all API responses for analysis
      if (url.includes('/api/')) {
        results.infinitePages.endpointTests.push({
          endpoint: new URL(url).pathname,
          status: status,
          statusText: response.statusText(),
          method: 'GET', // This will be the method from navigation
          url: url
        });
      }

      // Classify failures
      if (status >= 400) {
        const error = {
          type: status === 404 ? 'endpoint_not_found' :
                status === 500 ? 'server_error' :
                status === 503 ? 'service_unavailable' : 'network_error',
          message: `${status} ${response.statusText()} - ${url}`,
          status: status,
          url: url
        };
        const classification = classifyIssue(error);
        results.errors.push({ ...error, ...classification });
      }
    });

    // Navigate to page
    try {
      const response = await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });

      if (!response.ok()) {
        results.errors.push({
          type: 'page_load_error',
          message: `Page returned ${response.status()} ${response.statusText()}`,
          status: response.status()
        });
      }
    } catch (e) {
      results.errors.push({
        type: 'navigation_error',
        message: e.message
      });
    }

    // Test Infinite Pages specific API endpoints
    if (options.testEndpoints !== false) {
      const endpointTests = getEndpointTests();

      for (const endpointConfig of endpointTests) {
        for (const method of endpointConfig.methods) {
          try {
            // Test endpoint with fetch
            const testResult = await page.evaluate(async ({ endpoint, method: testMethod }) => {
              try {
                const response = await fetch(endpoint, {
                  method: testMethod,
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  ...(testMethod === 'POST' ? {
                    body: JSON.stringify({
                      genre: 'fantasy',
                      premise: 'Test story premise',
                      title: 'Test Story'
                    })
                  } : {})
                });

                return {
                  status: response.status,
                  statusText: response.statusText,
                  ok: response.ok
                };
              } catch (error) {
                return {
                  status: 'error',
                  statusText: error.message,
                  ok: false
                };
              }
            }, { endpoint: endpointConfig.endpoint, method });

            results.infinitePages.endpointTests.push({
              endpoint: endpointConfig.endpoint,
              method: method,
              description: endpointConfig.description,
              status: testResult.status,
              statusText: testResult.statusText,
              expected_auth: endpointConfig.expected_auth,
              expected_admin: endpointConfig.expected_admin
            });

          } catch (error) {
            results.infinitePages.endpointTests.push({
              endpoint: endpointConfig.endpoint,
              method: method,
              status: 'test_failed',
              error: error.message
            });
          }
        }
      }
    }

    // Performance metrics
    const loadTime = Date.now() - startTime;
    results.performance = {
      loadTime: `${loadTime}ms`,
      status: loadTime > 3000 ? 'slow' : loadTime > 1000 ? 'moderate' : 'fast'
    };

    // Enhanced page analysis for Infinite Pages
    try {
      const pageAnalysis = await page.evaluate(() => {
        const issues = [];

        // Standard accessibility checks
        const imagesWithoutAlt = document.querySelectorAll('img:not([alt]), img[alt=""]');
        imagesWithoutAlt.forEach((img) => {
          const src = img.src || img.getAttribute('src') || '';
          issues.push({
            type: 'missing_alt_text',
            message: `Image missing alt text: ${src.split('/').pop()}`,
            element: `img[src*="${src.split('/').pop()}"]`,
            fix_suggestion: `Add alt="${src.split('/').pop().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}"`
          });
        });

        // Page title check
        const title = document.querySelector('title');
        if (!title || !title.textContent.trim()) {
          issues.push({
            type: 'missing_page_title',
            message: 'Page missing title',
            element: 'title',
            fix_suggestion: 'Add <title>Infinite Pages - AI Story Creation</title>'
          });
        } else if (!title.textContent.includes('Infinite Pages')) {
          issues.push({
            type: 'title_missing_branding',
            message: 'Page title missing Infinite Pages branding',
            element: 'title',
            fix_suggestion: `Update title to include "Infinite Pages" brand`
          });
        }

        // Meta description check with Infinite Pages context
        const metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          issues.push({
            type: 'missing_meta_description',
            message: 'Missing meta description for story platform',
            element: 'head',
            fix_suggestion: 'Add <meta name="description" content="Create infinite stories with AI collaboration on Infinite Pages">'
          });
        }

        // Heading structure
        const h1s = document.querySelectorAll('h1');
        if (h1s.length === 0) {
          issues.push({
            type: 'missing_h1',
            message: 'No h1 heading found',
            element: 'body',
            fix_suggestion: 'Add <h1>Create Your Story</h1> or similar main heading'
          });
        } else if (h1s.length > 1) {
          issues.push({
            type: 'multiple_h1',
            message: `${h1s.length} h1 headings found (should be 1)`,
            element: 'h1:nth-of-type(n+2)',
            fix_suggestion: 'Change extra h1 tags to h2, h3, etc.'
          });
        }

        // Story creation specific checks
        const createStoryButtons = document.querySelectorAll('button:contains("Create"), [class*="create"], [class*="story"]');
        createStoryButtons.forEach((button) => {
          if (!button.getAttribute('aria-label') && !button.getAttribute('title')) {
            issues.push({
              type: 'story_creation_button_missing_aria',
              message: 'Story creation button missing accessibility attributes',
              element: button.tagName.toLowerCase(),
              fix_suggestion: 'Add aria-label or title to story creation buttons'
            });
          }
        });

        // Check for error messages on page (indicating failed API calls)
        const errorMessages = document.querySelectorAll('[class*="error"], .error-message, [role="alert"]');
        errorMessages.forEach((errorEl) => {
          if (errorEl.textContent.trim()) {
            issues.push({
              type: 'page_error_displayed',
              message: `Error message shown to user: ${errorEl.textContent.trim().substring(0, 100)}`,
              element: errorEl.className || errorEl.tagName.toLowerCase(),
              fix_suggestion: 'Investigate and resolve the underlying error'
            });
          }
        });

        return issues;
      });

      // Classify all accessibility issues
      results.accessibility = pageAnalysis.map(issue => {
        const classification = classifyIssue(issue);
        return { ...issue, ...classification };
      });

    } catch (e) {
      results.warnings.push({
        type: 'page_analysis_failed',
        message: 'Could not run page analysis: ' + e.message
      });
    }

  } catch (error) {
    const errorItem = {
      type: 'crawler_error',
      message: error.message
    };
    const classification = classifyIssue(errorItem);
    results.errors.push({ ...errorItem, ...classification });
  } finally {
    if (browser) await browser.close();
  }

  // Analyze endpoint test results
  const endpointIssues = analyzeEndpointResults(results.infinitePages.endpointTests);
  endpointIssues.forEach(issue => {
    const classification = classifyIssue(issue);
    results.errors.push({ ...issue, ...classification });
  });

  // Determine Infinite Pages specific status
  const storyEndpoints = results.infinitePages.endpointTests.filter(t => t.endpoint.includes('/api/stories'));
  const demoEndpoint = results.infinitePages.endpointTests.find(t => t.endpoint.includes('/api/demo/story'));
  const adminEndpoints = results.infinitePages.endpointTests.filter(t => t.endpoint.includes('/api/admin'));

  results.infinitePages.storyCreationStatus = storyEndpoints.some(e => e.status === 500 || e.status === 503) ? 'failing' :
                                             storyEndpoints.some(e => e.status === 404) ? 'missing_endpoints' :
                                             storyEndpoints.some(e => e.status === 401) ? 'auth_required' : 'unknown';

  results.infinitePages.authStatus = results.infinitePages.endpointTests.some(e => e.status === 401) ? 'working' : 'unknown';
  results.infinitePages.adminStatus = adminEndpoints.some(e => e.status === 401) ? 'secured' : 'unknown';

  // Generate comprehensive summary with auto-fix analysis
  const allIssues = [...results.errors, ...results.accessibility];
  const autoFixable = allIssues.filter(issue => issue.can_auto_fix);
  const needsApproval = allIssues.filter(issue => issue.requires_approval);
  const criticalIssues = allIssues.filter(issue => issue.priority === 'critical');

  results.summary = {
    errorCount: results.errors.length,
    warningCount: results.warnings.length + results.accessibility.length,
    status: criticalIssues.length > 0 ? 'critical' :
            results.errors.length > 0 ? 'failed' :
            results.warnings.length > 0 ? 'warnings' : 'passed',

    // Auto-fix summary for Claude Code
    autofix: {
      can_auto_fix: autoFixable.length,
      needs_approval: needsApproval.length,
      critical_issues: criticalIssues.length,

      auto_fixes: autoFixable.map(issue => ({
        issue: issue.message,
        type: issue.type,
        element: issue.element,
        fix: issue.fix_suggestion || issue.fix_instructions,
        priority: issue.priority || 'low'
      })),

      approval_needed: needsApproval.map(issue => ({
        issue: issue.message,
        type: issue.type,
        reason: issue.rule?.reason || 'Requires human review',
        suggested_fix: issue.fix_instructions,
        risk_level: issue.rule?.risk || 'medium',
        priority: issue.priority
      })),

      // Infinite Pages specific recommendations
      infinite_pages_status: {
        story_creation: results.infinitePages.storyCreationStatus,
        authentication: results.infinitePages.authStatus,
        admin_panel: results.infinitePages.adminStatus,
        critical_endpoints_down: criticalIssues.filter(i => i.infinite_pages_specific).length
      },

      recommendation: criticalIssues.length > 0 ?
        `CRITICAL: ${criticalIssues.length} critical issues detected. Story creation may be broken.` :
        autoFixable.length > 0 ?
        `Claude can automatically fix ${autoFixable.length} issues. ${needsApproval.length > 0 ? `${needsApproval.length} issues need approval first.` : ''}` :
        needsApproval.length > 0 ?
        `${needsApproval.length} issues found - all require approval before fixing.` :
        'Infinite Pages is functioning well - no critical issues detected.'
    }
  };

  res.json(results);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'Infinite Pages Debugger'
  });
});

// Quick endpoint test
app.get('/test-endpoints/:domain?', async (req, res) => {
  const domain = req.params.domain || 'www.infinite-pages.com';
  const testUrl = domain.startsWith('http') ? domain : `https://${domain}`;

  try {
    const testRes = await fetch(`http://localhost:${process.env.PORT || 3001}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: testUrl,
        options: { testEndpoints: true }
      })
    });
    const data = await testRes.json();
    res.json({
      url: testUrl,
      summary: data.summary,
      infinitePages: data.infinitePages,
      criticalIssues: data.errors.filter(e => e.priority === 'critical')
    });
  } catch (error) {
    res.status(500).json({ error: `Could not test ${testUrl}: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Infinite Pages Debugger Server ready on port ${PORT}`);
  console.log(`\n📋 Usage for Claude Code:`);
  console.log(`   curl -X POST http://localhost:${PORT}/crawl -H "Content-Type: application/json" -d '{"url":"https://www.infinite-pages.com"}'`);
  console.log(`   curl http://localhost:${PORT}/test-endpoints/www.infinite-pages.com`);
  console.log(`\n🎯 Infinite Pages specific testing enabled`);
  console.log(`   - Story creation endpoint testing`);
  console.log(`   - Authentication flow verification`);
  console.log(`   - Admin panel security checks`);
  console.log(`   - Claude API integration status`);
  console.log(`\n✅ Ready to debug infinite-pages.com!\n`);
});