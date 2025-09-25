#!/usr/bin/env node
// cli.js - Infinite Pages Website Debugger CLI
const { chromium } = require('playwright');
const { classifyIssue, getEndpointTests, analyzeEndpointResults } = require('./autofix-rules');

const args = process.argv.slice(2);
const url = args[0] || 'https://www.infinite-pages.com';

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Infinite Pages Website Debugger CLI

Usage: node cli.js [url] [options]

Arguments:
  url                 Website URL to test (default: https://www.infinite-pages.com)

Options:
  --json              Output raw JSON for parsing
  --endpoints         Test API endpoints only
  --story-creation    Test story creation functionality specifically
  --auto-fix-only     Show only issues Claude can auto-fix
  --approval-only     Show only issues needing approval
  --fix-plan          Show detailed fix instructions
  --help, -h          Show this help

Infinite Pages Specific Tests:
  - Story creation endpoints (/api/stories/*, /api/demo/story)
  - Authentication system (login/signup)
  - Admin panel security
  - Claude API integration status
  - Database connectivity

Examples:
  node cli.js https://www.infinite-pages.com
  node cli.js --endpoints --json
  node cli.js --story-creation --fix-plan
  node cli.js http://localhost:3000 --auto-fix-only
  `);
  process.exit(0);
}

async function testInfinitePages(targetUrl) {
  const results = {
    url: targetUrl,
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
    summary: { status: 'unknown', errorCount: 0, warningCount: 0, autofix: {} }
  };

  const startTime = Date.now();
  let browser, page;

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Capture console errors with Infinite Pages context
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

    // Monitor network requests for API endpoints
    page.on('response', response => {
      const responseUrl = response.url();
      const status = response.status();

      // Track API endpoint responses
      if (responseUrl.includes('/api/')) {
        results.infinitePages.endpointTests.push({
          endpoint: new URL(responseUrl).pathname,
          status: status,
          statusText: response.statusText(),
          method: 'GET',
          url: responseUrl
        });
      }

      // Classify failures
      if (status >= 400) {
        const error = {
          type: status === 404 ? 'endpoint_not_found' :
                status === 500 ? 'server_error' :
                status === 503 ? 'service_unavailable' : 'network_error',
          message: `${status} ${response.statusText()} - ${responseUrl}`,
          status: status,
          url: responseUrl
        };
        const classification = classifyIssue(error);
        results.errors.push({ ...error, ...classification });
      }
    });

    // Navigate to page
    try {
      await page.goto(targetUrl, { timeout: 15000, waitUntil: 'networkidle' });
    } catch (e) {
      results.errors.push({
        type: 'navigation_error',
        message: e.message
      });
    }

    // Test specific Infinite Pages endpoints
    if (!args.includes('--no-endpoint-tests')) {
      console.log('🧪 Testing Infinite Pages API endpoints...');
      const endpointConfigs = getEndpointTests();

      for (const config of endpointConfigs) {
        for (const method of config.methods) {
          try {
            const testResult = await page.evaluate(async ({ endpoint, method: testMethod, description }) => {
              try {
                const response = await fetch(endpoint, {
                  method: testMethod,
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  ...(testMethod === 'POST' ? {
                    body: JSON.stringify({
                      genre: 'fantasy',
                      premise: 'A brave adventurer discovers an ancient magic',
                      title: 'Test Adventure'
                    })
                  } : {})
                });

                return {
                  endpoint,
                  method: testMethod,
                  description,
                  status: response.status,
                  statusText: response.statusText,
                  ok: response.ok,
                  headers: {
                    contentType: response.headers.get('content-type'),
                    rateLimitRemaining: response.headers.get('x-ratelimit-remaining')
                  }
                };
              } catch (error) {
                return {
                  endpoint,
                  method: testMethod,
                  description,
                  status: 'fetch_failed',
                  statusText: error.message,
                  ok: false
                };
              }
            }, { endpoint: config.endpoint, method, description: config.description });

            results.infinitePages.endpointTests.push(testResult);

          } catch (error) {
            results.infinitePages.endpointTests.push({
              endpoint: config.endpoint,
              method: method,
              description: config.description,
              status: 'test_failed',
              error: error.message
            });
          }
        }
      }
    }

    // Page analysis for Infinite Pages specific issues
    try {
      const pageAnalysis = await page.evaluate(() => {
        const issues = [];

        // Check for Infinite Pages branding and context
        const title = document.querySelector('title');
        if (!title || !title.textContent.includes('Infinite Pages')) {
          issues.push({
            type: 'missing_infinite_pages_branding',
            message: 'Page title missing "Infinite Pages" branding',
            element: 'title',
            fix_suggestion: 'Update title to include "Infinite Pages"'
          });
        }

        // Check for story creation elements
        const storyElements = document.querySelectorAll('[class*="story"], [class*="create"], button:contains("Create")');
        if (storyElements.length === 0) {
          issues.push({
            type: 'missing_story_creation_ui',
            message: 'No story creation interface elements found',
            element: 'body',
            fix_suggestion: 'Add story creation interface to the page'
          });
        }

        // Check for error displays (indicating API failures)
        const errorDisplays = document.querySelectorAll('.error, [role="alert"], .alert-error, [class*="error"]');
        errorDisplays.forEach(el => {
          const errorText = el.textContent.trim();
          if (errorText && errorText.length > 0) {
            issues.push({
              type: 'page_error_displayed',
              message: `Error shown to user: "${errorText.substring(0, 100)}${errorText.length > 100 ? '...' : ''}"`,
              element: el.className || el.tagName.toLowerCase(),
              fix_suggestion: 'Investigate and resolve the underlying error causing this message'
            });
          }
        });

        // Standard accessibility checks
        const imagesWithoutAlt = document.querySelectorAll('img:not([alt]), img[alt=""]');
        imagesWithoutAlt.forEach(img => {
          const src = img.src || img.getAttribute('src') || '';
          if (src) {
            issues.push({
              type: 'missing_alt_text',
              message: `Image missing alt text: ${src.split('/').pop()}`,
              element: `img[src*="${src.split('/').pop()}"]`,
              fix_suggestion: `Add alt="${src.split('/').pop().replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}"`
            });
          }
        });

        // Missing meta description
        if (!document.querySelector('meta[name="description"]')) {
          issues.push({
            type: 'missing_meta_description',
            message: 'Missing meta description for story creation platform',
            element: 'head',
            fix_suggestion: 'Add <meta name="description" content="Create infinite AI-powered stories - Infinite Pages">'
          });
        }

        // H1 structure
        const h1s = document.querySelectorAll('h1');
        if (h1s.length === 0) {
          issues.push({
            type: 'missing_h1',
            message: 'No main heading (h1) found',
            element: 'body',
            fix_suggestion: 'Add <h1>Create Your Story</h1> or similar main heading'
          });
        } else if (h1s.length > 1) {
          issues.push({
            type: 'multiple_h1',
            message: `${h1s.length} h1 headings found (should be 1)`,
            element: 'h1:nth-of-type(n+2)',
            fix_suggestion: 'Change additional h1 tags to h2, h3, etc.'
          });
        }

        return issues;
      });

      results.accessibility = pageAnalysis.map(issue => {
        const classification = classifyIssue(issue);
        return { ...issue, ...classification };
      });

    } catch (e) {
      results.warnings.push({
        type: 'page_analysis_failed',
        message: 'Could not analyze page content: ' + e.message
      });
    }

  } catch (error) {
    const errorItem = {
      type: 'test_execution_failed',
      message: error.message
    };
    const classification = classifyIssue(errorItem);
    results.errors.push({ ...errorItem, ...classification });
  } finally {
    if (browser) await browser.close();
  }

  // Performance metrics
  const loadTime = Date.now() - startTime;
  results.performance = {
    loadTime: `${loadTime}ms`,
    status: loadTime > 3000 ? 'slow' : loadTime > 1000 ? 'moderate' : 'fast'
  };

  // Analyze endpoint results for Infinite Pages specific issues
  const endpointIssues = analyzeEndpointResults(results.infinitePages.endpointTests);
  endpointIssues.forEach(issue => {
    const classification = classifyIssue(issue);
    results.errors.push({ ...issue, ...classification });
  });

  // Determine Infinite Pages status
  const storyEndpoints = results.infinitePages.endpointTests.filter(t =>
    t.endpoint && t.endpoint.includes('/api/stories')
  );
  const demoEndpoints = results.infinitePages.endpointTests.filter(t =>
    t.endpoint && t.endpoint.includes('/api/demo')
  );
  const adminEndpoints = results.infinitePages.endpointTests.filter(t =>
    t.endpoint && t.endpoint.includes('/api/admin')
  );

  // Classify story creation status
  if (storyEndpoints.some(e => e.status === 500 || e.status === 503)) {
    results.infinitePages.storyCreationStatus = 'failing_server_error';
  } else if (storyEndpoints.some(e => e.status === 404)) {
    results.infinitePages.storyCreationStatus = 'missing_endpoints';
  } else if (storyEndpoints.some(e => e.status === 401)) {
    results.infinitePages.storyCreationStatus = 'auth_required_normal';
  } else if (demoEndpoints.some(e => e.status === 200)) {
    results.infinitePages.storyCreationStatus = 'demo_available';
  } else {
    results.infinitePages.storyCreationStatus = 'unknown';
  }

  results.infinitePages.authStatus = storyEndpoints.some(e => e.status === 401) ? 'working' : 'unknown';
  results.infinitePages.adminStatus = adminEndpoints.some(e => e.status === 401) ? 'secured' : 'unknown';

  // Generate summary with autofix analysis
  const allIssues = [...results.errors, ...results.accessibility];
  const autoFixable = allIssues.filter(issue => issue.can_auto_fix);
  const needsApproval = allIssues.filter(issue => issue.requires_approval);
  const criticalIssues = allIssues.filter(issue => issue.priority === 'critical');
  const infinitePagesSpecific = allIssues.filter(issue => issue.infinite_pages_specific);

  results.summary = {
    errorCount: results.errors.length,
    warningCount: results.warnings.length + results.accessibility.length,
    status: criticalIssues.length > 0 ? 'critical' :
            results.errors.length > 0 ? 'failed' :
            results.warnings.length > 0 ? 'warnings' : 'passed',

    autofix: {
      can_auto_fix: autoFixable.length,
      needs_approval: needsApproval.length,
      critical_issues: criticalIssues.length,
      infinite_pages_issues: infinitePagesSpecific.length,

      auto_fixes: autoFixable.map(issue => ({
        issue: issue.message,
        type: issue.type,
        element: issue.element,
        fix: issue.fix_suggestion || issue.fix_instructions,
        priority: issue.priority || 'low',
        code_fix: issue.rule?.code_fix ? issue.rule.code_fix() : null
      })),

      approval_needed: needsApproval.map(issue => ({
        issue: issue.message,
        type: issue.type,
        reason: issue.rule?.reason || 'Requires human review',
        suggested_fix: issue.fix_instructions,
        risk_level: issue.rule?.risk || 'medium',
        priority: issue.priority,
        infinite_pages_specific: !!issue.infinite_pages_specific,
        code_fix: issue.rule?.code_fix ? issue.rule.code_fix() : null
      })),

      infinite_pages_status: {
        story_creation: results.infinitePages.storyCreationStatus,
        authentication: results.infinitePages.authStatus,
        admin_panel: results.infinitePages.adminStatus,
        endpoints_tested: results.infinitePages.endpointTests.length
      },

      recommendation: criticalIssues.length > 0 ?
        `🚨 CRITICAL: ${criticalIssues.length} critical issues found. Infinite Pages story creation likely broken.` :
        infinitePagesSpecific.length > 0 ?
        `⚠️ INFINITE PAGES: ${infinitePagesSpecific.length} platform-specific issues detected.` :
        autoFixable.length > 0 ?
        `✅ AUTO-FIX: ${autoFixable.length} issues can be fixed automatically. ${needsApproval.length > 0 ? `${needsApproval.length} need approval.` : ''}` :
        needsApproval.length > 0 ?
        `⚠️ APPROVAL: ${needsApproval.length} issues require human review before fixing.` :
        '🎉 ALL GOOD: Infinite Pages is functioning well!'
    }
  };

  return results;
}

// Main execution
(async () => {
  console.log(`🔍 Testing Infinite Pages: ${url}`);
  console.log(`🎯 Focus: Story creation, API endpoints, and platform functionality\n`);

  try {
    const results = await testInfinitePages(url);

    if (args.includes('--json')) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Filter based on options
    const showEndpointsOnly = args.includes('--endpoints');
    const showStoryCreationOnly = args.includes('--story-creation');
    const showAutoFixOnly = args.includes('--auto-fix-only');
    const showApprovalOnly = args.includes('--approval-only');
    const showFixPlan = args.includes('--fix-plan');

    // Header
    console.log(`📊 Infinite Pages Test Results`);
    console.log(`URL: ${url}`);
    console.log(`Status: ${results.summary.status.toUpperCase()}`);
    console.log(`Load Time: ${results.performance.loadTime} (${results.performance.status})`);

    // Infinite Pages Status Overview
    console.log(`\n🎯 INFINITE PAGES STATUS:`);
    console.log(`   📝 Story Creation: ${results.infinitePages.storyCreationStatus}`);
    console.log(`   🔐 Authentication: ${results.infinitePages.authStatus}`);
    console.log(`   👑 Admin Panel: ${results.infinitePages.adminStatus}`);
    console.log(`   🧪 Endpoints Tested: ${results.infinitePages.endpointTests.length}`);

    // Auto-fix summary
    const autofix = results.summary.autofix;
    console.log(`\n🤖 AUTO-FIX ANALYSIS:`);
    console.log(`   ✅ Can auto-fix: ${autofix.can_auto_fix} issues`);
    console.log(`   ⚠️  Need approval: ${autofix.needs_approval} issues`);
    console.log(`   🚨 Critical issues: ${autofix.critical_issues} issues`);
    console.log(`   🎯 Infinite Pages specific: ${autofix.infinite_pages_issues} issues`);
    console.log(`   📋 ${autofix.recommendation}`);

    // Show endpoint test results
    if ((showEndpointsOnly || !showAutoFixOnly) && results.infinitePages.endpointTests.length > 0) {
      console.log(`\n🌐 API ENDPOINT TESTS:`);
      results.infinitePages.endpointTests.forEach(test => {
        const statusIcon = test.status === 200 || test.status === 201 ? '✅' :
                          test.status === 401 ? '🔒' :
                          test.status === 404 ? '❌' :
                          test.status === 500 ? '💥' :
                          test.status === 503 ? '🚫' : '⚠️';
        console.log(`  ${statusIcon} ${test.method} ${test.endpoint}: ${test.status} ${test.statusText}`);
        if (test.description) {
          console.log(`     📝 ${test.description}`);
        }
      });
    }

    // Show auto-fixable issues with actual code
    if (autofix.auto_fixes.length > 0 && !showApprovalOnly) {
      console.log(`\n✅ CLAUDE CAN AUTO-FIX (${autofix.auto_fixes.length}):`);
      autofix.auto_fixes.forEach((fix, i) => {
        console.log(`  ${i + 1}. ${fix.issue}`);
        if (showFixPlan) {
          console.log(`     🔧 Fix: ${fix.fix}`);
          console.log(`     📍 Element: ${fix.element || 'N/A'}`);
          console.log(`     🎯 Priority: ${fix.priority}`);

          // Show actual code fix if available
          if (fix.code_fix) {
            console.log(`\n     💾 ACTUAL CODE TO FIX THIS ISSUE:`);
            console.log(`     ${'='.repeat(50)}`);
            console.log(fix.code_fix.split('\n').map(line => `     ${line}`).join('\n'));
            console.log(`     ${'='.repeat(50)}\n`);
          }
        }
      });
    }

    // Show issues needing approval with actual code
    if (autofix.approval_needed.length > 0 && !showAutoFixOnly) {
      console.log(`\n⚠️  NEEDS APPROVAL (${autofix.approval_needed.length}):`);
      autofix.approval_needed.forEach((issue, i) => {
        const priorityIcon = issue.priority === 'critical' ? '🚨' : issue.priority === 'high' ? '⚠️' : 'ℹ️';
        const ipIcon = issue.infinite_pages_specific ? ' 🎯' : '';
        console.log(`  ${i + 1}. ${priorityIcon}${ipIcon} [${issue.risk_level?.toUpperCase() || 'UNKNOWN'}] ${issue.issue}`);
        console.log(`     🚫 Reason: ${issue.reason}`);
        if (showFixPlan && issue.suggested_fix) {
          console.log(`     💡 Suggested: ${issue.suggested_fix}`);

          // Show actual code fix if available
          if (issue.code_fix) {
            console.log(`\n     💾 ACTUAL CODE TO FIX THIS ISSUE (REQUIRES APPROVAL):`);
            console.log(`     ${'='.repeat(60)}`);
            console.log(issue.code_fix.split('\n').map(line => `     ${line}`).join('\n'));
            console.log(`     ${'='.repeat(60)}\n`);
          }
        }
      });
    }

    // Show detailed fix plan for critical issues
    if (autofix.critical_issues > 0 && showFixPlan) {
      console.log(`\n🚨 CRITICAL ISSUES DETECTED:`);
      const criticalIssues = [...results.errors, ...results.accessibility].filter(i => i.priority === 'critical');
      criticalIssues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue.message}`);
        console.log(`     🔧 Action needed: ${issue.fix_instructions || 'Manual intervention required'}`);
        if (issue.infinite_pages_specific) {
          console.log(`     🎯 Infinite Pages core functionality affected`);
        }
      });
    }

    // Success/summary message
    if (results.summary.status === 'passed') {
      console.log(`\n🎉 All tests passed! Infinite Pages is working well.`);
    } else if (autofix.critical_issues > 0) {
      console.log(`\n🚨 URGENT: Critical issues detected that may break story creation.`);
      console.log(`💡 TIP: Run with --fix-plan to see detailed fix instructions.`);
    } else if (autofix.can_auto_fix > 0) {
      console.log(`\n💡 TIP: Claude can automatically fix ${autofix.can_auto_fix} issues.`);
      console.log(`Run with --fix-plan for detailed instructions.`);
    }

    // Exit code: 0 = all good, 1 = has issues, 2 = critical issues
    process.exit(autofix.critical_issues > 0 ? 2 : autofix.needs_approval > 0 ? 1 : 0);

  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    process.exit(3);
  }
})();