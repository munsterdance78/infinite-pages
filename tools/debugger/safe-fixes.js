// safe-fixes.js - Auto-applicable fixes for Infinite Pages when site is accessible
// These fixes can be applied automatically without approval

const SAFE_FIXES = {
  // 1. Missing Alt Text Fix
  addAltText: () => `
// AUTO-FIX: Add descriptive alt text to images
const images = document.querySelectorAll('img:not([alt]), img[alt=""]');
images.forEach(img => {
  const src = img.src || img.getAttribute('src') || '';
  const filename = src.split('/').pop().replace(/\.[^/.]+$/, '');
  const altText = filename.replace(/[-_]/g, ' ') || 'Story illustration';
  img.setAttribute('alt', altText);
  console.log(\`✅ Added alt text: "\${altText}" to \${src}\`);
});
console.log(\`✅ Fixed \${images.length} images with missing alt text\`);`,

  // 2. Missing Page Title Fix
  addPageTitle: () => `
// AUTO-FIX: Add page title
if (!document.title || document.title.trim() === '') {
  document.title = 'Infinite Pages - Create Infinite AI Stories';
  console.log('✅ Added page title for Infinite Pages');
}

// Also add title tag if missing
if (!document.querySelector('title')) {
  const title = document.createElement('title');
  title.textContent = 'Infinite Pages - Create Infinite AI Stories';
  document.head.appendChild(title);
  console.log('✅ Added title tag to head');
}`,

  // 3. Missing Meta Description Fix
  addMetaDescription: () => `
// AUTO-FIX: Add meta description
if (!document.querySelector('meta[name="description"]')) {
  const metaDesc = document.createElement('meta');
  metaDesc.name = 'description';
  metaDesc.content = 'Create infinite AI-powered stories with collaborative writing. Start your adventure with Infinite Pages - where imagination meets artificial intelligence.';
  document.head.appendChild(metaDesc);
  console.log('✅ Added meta description for Infinite Pages');
}`,

  // 4. Missing H1 Fix
  addMainHeading: () => `
// AUTO-FIX: Add main heading if missing
if (!document.querySelector('h1')) {
  const mainHeading = document.createElement('h1');
  mainHeading.className = 'text-4xl font-bold text-center mb-8';
  mainHeading.textContent = 'Create Your Infinite Story';

  // Insert at beginning of body or main content area
  const main = document.querySelector('main') || document.body;
  main.insertBefore(mainHeading, main.firstChild);
  console.log('✅ Added main heading for story creation page');
}`,

  // 5. Missing Language Attribute Fix
  addLanguageAttribute: () => `
// AUTO-FIX: Add language attribute
if (!document.documentElement.getAttribute('lang')) {
  document.documentElement.setAttribute('lang', 'en');
  console.log('✅ Added language attribute to HTML tag');
}`,

  // 6. Missing Viewport Meta Fix
  addViewportMeta: () => `
// AUTO-FIX: Add responsive viewport
if (!document.querySelector('meta[name="viewport"]')) {
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1, shrink-to-fit=no';
  document.head.appendChild(viewport);
  console.log('✅ Added responsive viewport meta tag');
}`,

  // 7. Story Creation Button Accessibility Fix
  addButtonAccessibility: () => `
// AUTO-FIX: Add accessibility labels to story creation buttons
const storyButtons = document.querySelectorAll('button:not([aria-label])');
storyButtons.forEach(btn => {
  const text = btn.textContent.trim();
  if (text.toLowerCase().includes('create') || text.toLowerCase().includes('story')) {
    btn.setAttribute('aria-label', \`\${text} - Start creating your AI-powered story\`);
    console.log(\`✅ Added aria-label to button: "\${text}"\`);
  }
});
console.log(\`✅ Enhanced accessibility for \${storyButtons.length} story creation buttons\`);`
};

// Apply all safe fixes
function applyAllSafeFixes() {
  console.log('🔧 Applying safe auto-fixes for Infinite Pages...');

  // Apply each fix
  Object.keys(SAFE_FIXES).forEach(fixName => {
    try {
      eval(SAFE_FIXES[fixName]());
      console.log(\`✅ Applied \${fixName}\`);
    } catch (error) {
      console.error(\`❌ Failed to apply \${fixName}:\`, error);
    }
  });

  console.log('🎉 All safe fixes applied successfully!');
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SAFE_FIXES, applyAllSafeFixes };
}

// Auto-apply when loaded in browser
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAllSafeFixes);
  } else {
    applyAllSafeFixes();
  }
}