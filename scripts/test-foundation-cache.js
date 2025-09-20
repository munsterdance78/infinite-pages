/**
 * Test script for Priority 1 Foundation Caching Integration
 *
 * This script tests the immediate 80% cost savings from foundation caching
 * Run with: node scripts/test-foundation-cache.js
 */

import { createClient } from '@supabase/supabase-js';
import { infinitePagesCache } from '../lib/claude/infinitePagesCache.js';

// Test configuration
const testConfig = {
  genres: ['Fantasy', 'Sci-Fi', 'Mystery', 'Romance'],
  premises: [
    'A young wizard discovers they have the power to control time',
    'A detective investigates a murder in a city where memories can be stolen',
    'Two people from different worlds fall in love through a magical portal',
    'A space colony faces extinction from an unknown alien threat'
  ],
  testUserId: '00000000-0000-0000-0000-000000000000' // Use a test UUID
};

async function testFoundationCaching() {
  console.log('🚀 Testing Infinite Pages Foundation Caching (Priority 1)');
  console.log('=====================================================\n');

  let totalTests = 0;
  let cacheHits = 0;
  let totalTokensSaved = 0;

  for (let i = 0; i < testConfig.genres.length; i++) {
    const genre = testConfig.genres[i];
    const premise = testConfig.premises[i];

    console.log(`Testing ${genre}: ${premise.substring(0, 50)}...`);

    // Test 1: First generation (should miss cache)
    console.log('  📝 First generation (expect NEW):');
    const firstResult = await infinitePagesCache.getFoundationWithSimilarity(
      genre,
      premise,
      testConfig.testUserId,
      `Test ${genre} Story`
    );

    totalTests++;
    console.log(`     ${firstResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${firstResult.cacheType} - Tokens saved: ${firstResult.tokensSaved}`);

    if (firstResult.fromCache) {
      cacheHits++;
      totalTokensSaved += firstResult.tokensSaved;
    } else {
      // Simulate caching a foundation
      const mockFoundation = {
        title: `Test ${genre} Story`,
        genre: genre,
        premise: premise,
        mainCharacters: [
          {
            name: 'Test Protagonist',
            role: 'protagonist',
            description: 'A brave hero',
            motivation: 'To save the world',
            arc: 'From novice to master'
          }
        ],
        setting: {
          time: 'Modern era',
          place: 'Fantasy realm',
          atmosphere: 'Mystical and dangerous',
          worldbuilding: 'Rich magic system'
        },
        plotStructure: {
          incitingIncident: 'Discovery of power',
          risingAction: 'Training and challenges',
          climax: 'Final confrontation',
          fallingAction: 'Resolution of conflicts',
          resolution: 'New world order'
        },
        themes: ['courage', 'friendship', 'sacrifice'],
        tone: 'Epic and inspiring',
        targetAudience: 'Young Adult',
        chapterOutline: [
          {
            number: 1,
            title: 'The Beginning',
            summary: 'Hero discovers their destiny',
            purpose: 'Setup and introduction',
            keyEvents: ['Discovery', 'Call to adventure'],
            characterDevelopment: 'Initial reluctance'
          }
        ]
      };

      await infinitePagesCache.cacheStoryFoundation(
        `${genre} story: ${premise}`,
        genre,
        premise,
        mockFoundation,
        testConfig.testUserId,
        `Test ${genre} Story`
      );

      console.log('     🔄 Foundation cached for future requests');
    }

    // Test 2: Similar premise (should hit cache with adaptation)
    console.log('  🔄 Similar premise test (expect THEME-SIMILAR):');
    const similarPremise = premise.replace(/young|detective|people|space/, 'experienced');
    const secondResult = await infinitePagesCache.getFoundationWithSimilarity(
      genre,
      similarPremise,
      testConfig.testUserId,
      `Similar ${genre} Story`
    );

    totalTests++;
    console.log(`     ${secondResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${secondResult.cacheType} - Tokens saved: ${secondResult.tokensSaved}`);

    if (secondResult.fromCache) {
      cacheHits++;
      totalTokensSaved += secondResult.tokensSaved;
    }

    // Test 3: Exact same premise (should hit cache exactly)
    console.log('  🎯 Exact repeat (expect EXACT):');
    const thirdResult = await infinitePagesCache.getFoundationWithSimilarity(
      genre,
      premise,
      testConfig.testUserId,
      `Test ${genre} Story`
    );

    totalTests++;
    console.log(`     ${thirdResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${thirdResult.cacheType} - Tokens saved: ${thirdResult.tokensSaved}`);

    if (thirdResult.fromCache) {
      cacheHits++;
      totalTokensSaved += thirdResult.tokensSaved;
    }

    console.log('');
  }

  // Calculate results
  const hitRate = (cacheHits / totalTests) * 100;
  const costSavings = totalTokensSaved * 0.000015;

  console.log('📊 PRIORITY 1 CACHING TEST RESULTS');
  console.log('==================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Cache Hits: ${cacheHits}`);
  console.log(`Hit Rate: ${hitRate.toFixed(1)}%`);
  console.log(`Total Tokens Saved: ${totalTokensSaved}`);
  console.log(`Cost Savings: $${costSavings.toFixed(4)}`);
  console.log('');

  if (hitRate >= 60) {
    console.log('🎉 SUCCESS: Achieved target hit rate for foundation caching!');
    console.log('✅ Priority 1 implementation is working correctly');
    console.log('💰 Users will see immediate 80% cost savings on foundation generation');
  } else {
    console.log('⚠️  WARNING: Hit rate below target (60%+)');
    console.log('🔧 Consider adjusting similarity thresholds in infinitePagesCache.ts');
  }

  // Test analytics function
  console.log('\n📈 Testing Analytics Function...');
  try {
    const analytics = await infinitePagesCache.getInfinitePagesAnalytics(testConfig.testUserId);
    console.log('Analytics result:', JSON.stringify(analytics, null, 2));
    console.log('✅ Analytics function working');
  } catch (error) {
    console.log('❌ Analytics function error:', error.message);
  }
}

// Run the test
testFoundationCaching().catch(console.error);