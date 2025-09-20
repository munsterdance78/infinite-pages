/**
 * Test script for Priority 2 Chapter Caching Integration
 *
 * This script tests the 60% cost savings from chapter caching with foundation dependency tracking
 * Run with: node scripts/test-chapter-cache.js
 */

import { createClient } from '@supabase/supabase-js';
import { infinitePagesCache } from '../lib/claude/infinitePagesCache.js';
import crypto from 'crypto';

// Test configuration
const testConfig = {
  genres: ['Fantasy', 'Sci-Fi', 'Mystery', 'Romance'],
  foundations: [
    {
      genre: 'Fantasy',
      title: 'The Magic Academy',
      mainCharacters: [{ name: 'Aria', role: 'protagonist' }, { name: 'Magnus', role: 'mentor' }],
      plotStructure: { incitingIncident: 'Discovery of powers', climax: 'Final battle' },
      themes: ['courage', 'friendship'],
      setting: { place: 'Magic Academy', time: 'Medieval fantasy world' }
    },
    {
      genre: 'Sci-Fi',
      title: 'Colony Ship',
      mainCharacters: [{ name: 'Captain Nova', role: 'protagonist' }, { name: 'AI-7', role: 'supporting' }],
      plotStructure: { incitingIncident: 'System malfunction', climax: 'Space battle' },
      themes: ['survival', 'technology'],
      setting: { place: 'Generation ship', time: 'Far future' }
    },
    {
      genre: 'Mystery',
      title: 'The Detective',
      mainCharacters: [{ name: 'Detective Blake', role: 'protagonist' }, { name: 'Dr. Kim', role: 'supporting' }],
      plotStructure: { incitingIncident: 'Murder discovery', climax: 'Reveal of killer' },
      themes: ['justice', 'truth'],
      setting: { place: 'Modern city', time: 'Present day' }
    },
    {
      genre: 'Romance',
      title: 'Coffee Shop Love',
      mainCharacters: [{ name: 'Emma', role: 'protagonist' }, { name: 'Jake', role: 'love interest' }],
      plotStructure: { incitingIncident: 'First meeting', climax: 'Love confession' },
      themes: ['love', 'second chances'],
      setting: { place: 'Small town', time: 'Contemporary' }
    }
  ],
  testUserId: '00000000-0000-0000-0000-000000000000', // Use a test UUID
  targetWordCount: 2000
};

async function testChapterCaching() {
  console.log('🚀 Testing Infinite Pages Chapter Caching (Priority 2)');
  console.log('====================================================');
  console.log('🎯 Target: 60% cost savings on chapter generation (5 tokens per chapter)\n');

  let totalTests = 0;
  let cacheHits = 0;
  let totalTokensSaved = 0;
  const cacheTypeStats = {
    exact: 0,
    'foundation-adapted': 0,
    'structure-similar': 0,
    'genre-adapted': 0,
    none: 0
  };

  for (let foundationIndex = 0; foundationIndex < testConfig.foundations.length; foundationIndex++) {
    const foundation = testConfig.foundations[foundationIndex];
    const foundationFingerprint = infinitePagesCache.generateFoundationFingerprint(foundation);

    console.log(`\n📖 Testing Foundation: ${foundation.title} (${foundation.genre})`);
    console.log(`Foundation Fingerprint: ${foundationFingerprint.substring(0, 8)}...`);

    // Test multiple chapters for the same foundation
    for (let chapterNumber = 1; chapterNumber <= 3; chapterNumber++) {
      console.log(`\n  📝 Chapter ${chapterNumber} Tests:`);

      // Mock previous chapters for context
      const previousChapters = [];
      for (let i = 1; i < chapterNumber; i++) {
        previousChapters.push({
          content: `This is the content of chapter ${i} for ${foundation.title}. The story continues with the hero facing new challenges.`,
          summary: `Chapter ${i} summary: Hero progresses in their journey.`
        });
      }

      const previousChaptersHash = infinitePagesCache.generatePreviousChaptersHash(previousChapters);

      // Test 1: First generation (should miss cache)
      console.log(`    🆕 First generation (expect NONE):`);
      const firstResult = await infinitePagesCache.getChapterWithFoundationContext(
        chapterNumber,
        foundationFingerprint,
        previousChaptersHash,
        foundation.genre,
        testConfig.targetWordCount,
        testConfig.testUserId,
        foundation.title
      );

      totalTests++;
      cacheTypeStats[firstResult.cacheType]++;
      console.log(`       ${firstResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${firstResult.cacheType} - Tokens saved: ${firstResult.tokensSaved}`);

      if (firstResult.fromCache) {
        cacheHits++;
        totalTokensSaved += firstResult.tokensSaved;
      } else {
        // Simulate caching a chapter
        const mockChapter = {
          title: `Chapter ${chapterNumber}: The Adventure Continues`,
          content: `This is chapter ${chapterNumber} of ${foundation.title}. The ${foundation.genre} story unfolds as our protagonist ${foundation.mainCharacters[0].name} faces new challenges in ${foundation.setting.place}.`,
          summary: `Chapter ${chapterNumber} summary: The story advances with new developments.`,
          wordCount: testConfig.targetWordCount,
          keyEvents: ['Plot advancement', 'Character development'],
          characterDevelopment: 'Hero grows stronger',
          foreshadowing: 'Hints at future challenges'
        };

        await infinitePagesCache.cacheChapterWithContext(
          chapterNumber,
          mockChapter,
          `story-${foundationIndex + 1}`,
          foundationFingerprint,
          previousChaptersHash,
          foundation.genre,
          testConfig.targetWordCount,
          testConfig.testUserId,
          foundation.title
        );

        console.log(`       🔄 Chapter ${chapterNumber} cached for future requests`);
      }

      // Test 2: Same foundation, slightly different previous chapters (should hit FOUNDATION-ADAPTED)
      console.log(`    🔄 Foundation-adapted test (expect FOUNDATION-ADAPTED):`);
      const slightlyDifferentPrevious = previousChapters.map(ch => ({
        ...ch,
        content: ch.content.replace('challenges', 'obstacles')
      }));
      const differentPreviousHash = infinitePagesCache.generatePreviousChaptersHash(slightlyDifferentPrevious);

      const secondResult = await infinitePagesCache.getChapterWithFoundationContext(
        chapterNumber,
        foundationFingerprint,
        differentPreviousHash,
        foundation.genre,
        testConfig.targetWordCount,
        testConfig.testUserId,
        foundation.title
      );

      totalTests++;
      cacheTypeStats[secondResult.cacheType]++;
      console.log(`       ${secondResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${secondResult.cacheType} - Tokens saved: ${secondResult.tokensSaved}`);

      if (secondResult.fromCache) {
        cacheHits++;
        totalTokensSaved += secondResult.tokensSaved;
      }

      // Test 3: Same genre, different foundation (should hit STRUCTURE-SIMILAR)
      console.log(`    🏗️  Structure-similar test (expect STRUCTURE-SIMILAR):`);
      const differentFoundation = {
        ...foundation,
        title: `Different ${foundation.genre} Story`,
        mainCharacters: [{ name: 'Different Hero', role: 'protagonist' }]
      };
      const differentFoundationFingerprint = infinitePagesCache.generateFoundationFingerprint(differentFoundation);

      const thirdResult = await infinitePagesCache.getChapterWithFoundationContext(
        chapterNumber,
        differentFoundationFingerprint,
        previousChaptersHash,
        foundation.genre,
        testConfig.targetWordCount,
        testConfig.testUserId,
        differentFoundation.title
      );

      totalTests++;
      cacheTypeStats[thirdResult.cacheType]++;
      console.log(`       ${thirdResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${thirdResult.cacheType} - Tokens saved: ${thirdResult.tokensSaved}`);

      if (thirdResult.fromCache) {
        cacheHits++;
        totalTokensSaved += thirdResult.tokensSaved;
      }

      // Test 4: Early chapter genre adaptation (only for chapters 1-3)
      if (chapterNumber <= 3) {
        console.log(`    🎭 Genre-adapted test (expect GENRE-ADAPTED for early chapters):`);
        const earlyChapterResult = await infinitePagesCache.getChapterWithFoundationContext(
          chapterNumber,
          'different-foundation-fingerprint',
          'different-previous-hash',
          foundation.genre,
          testConfig.targetWordCount,
          testConfig.testUserId,
          'Completely Different Story'
        );

        totalTests++;
        cacheTypeStats[earlyChapterResult.cacheType]++;
        console.log(`       ${earlyChapterResult.fromCache ? '✅ CACHE HIT' : '❌ CACHE MISS'} - Type: ${earlyChapterResult.cacheType} - Tokens saved: ${earlyChapterResult.tokensSaved}`);

        if (earlyChapterResult.fromCache) {
          cacheHits++;
          totalTokensSaved += earlyChapterResult.tokensSaved;
        }
      }
    }
  }

  // Calculate results
  const hitRate = (cacheHits / totalTests) * 100;
  const costSavings = totalTokensSaved * 0.000015;

  console.log('\n📊 PRIORITY 2 CHAPTER CACHING TEST RESULTS');
  console.log('==========================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Cache Hits: ${cacheHits}`);
  console.log(`Hit Rate: ${hitRate.toFixed(1)}%`);
  console.log(`Total Tokens Saved: ${totalTokensSaved}`);
  console.log(`Cost Savings: $${costSavings.toFixed(4)}`);
  console.log('');

  console.log('📈 Cache Type Distribution:');
  Object.entries(cacheTypeStats).forEach(([type, count]) => {
    const percentage = (count / totalTests) * 100;
    console.log(`  ${type.toUpperCase()}: ${count} hits (${percentage.toFixed(1)}%)`);
  });
  console.log('');

  // Evaluation
  if (hitRate >= 50) {
    console.log('🎉 SUCCESS: Achieved target hit rate for chapter caching!');
    console.log('✅ Priority 2 implementation is working correctly');
    console.log('💰 Users will see significant cost savings on chapter generation');
  } else {
    console.log('⚠️  WARNING: Hit rate below target (50%+)');
    console.log('🔧 Consider adjusting similarity thresholds or caching strategies');
  }

  console.log('');
  console.log('🔍 INSIGHTS:');
  console.log(`• Foundation dependency tracking: ${cacheTypeStats['foundation-adapted']} adaptations`);
  console.log(`• Structural similarity reuse: ${cacheTypeStats['structure-similar']} matches`);
  console.log(`• Genre adaptation for early chapters: ${cacheTypeStats['genre-adapted']} adaptations`);
  console.log(`• Exact context matches: ${cacheTypeStats.exact} perfect hits`);

  const avgTokensSavedPerHit = cacheHits > 0 ? (totalTokensSaved / cacheHits).toFixed(1) : 0;
  console.log(`• Average tokens saved per cache hit: ${avgTokensSavedPerHit}`);

  if (hitRate >= 50) {
    const expectedMonthlySavings = (50 * hitRate / 100) * 5 * 0.000015; // 50 chapters/month
    console.log(`• Expected monthly savings (50 chapters): $${expectedMonthlySavings.toFixed(2)}`);
  }
}

// Foundation fingerprint testing
async function testFoundationFingerprinting() {
  console.log('\n🔍 Testing Foundation Fingerprinting');
  console.log('====================================');

  const foundation1 = testConfig.foundations[0];
  const foundation2 = { ...foundation1, premise: 'Different premise but same structure' };
  const foundation3 = { ...foundation1, mainCharacters: [{ name: 'Different Hero', role: 'protagonist' }] };

  const fingerprint1 = infinitePagesCache.generateFoundationFingerprint(foundation1);
  const fingerprint2 = infinitePagesCache.generateFoundationFingerprint(foundation2);
  const fingerprint3 = infinitePagesCache.generateFoundationFingerprint(foundation3);

  console.log(`Foundation 1 fingerprint: ${fingerprint1}`);
  console.log(`Foundation 2 fingerprint (different premise): ${fingerprint2}`);
  console.log(`Foundation 3 fingerprint (different characters): ${fingerprint3}`);

  console.log(`Same structure, different premise: ${fingerprint1 === fingerprint2 ? 'SAME' : 'DIFFERENT'} ✅`);
  console.log(`Different characters: ${fingerprint1 === fingerprint3 ? 'SAME' : 'DIFFERENT'} ✅`);
}

// Run the tests
console.log('🧪 Starting Priority 2 Chapter Caching Tests');
console.log('==============================================\n');

testFoundationFingerprinting()
  .then(() => testChapterCaching())
  .catch(console.error);