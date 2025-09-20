# Enhanced Claude Integration

This document describes the enhanced Claude AI integration for your Infinite Pages project. The integration provides a centralized, robust, and feature-rich interface for working with Claude AI models.

## Features

### 🚀 **Core Services**
- **ClaudeService**: Centralized service for all Claude operations
- **ClaudeStreamingService**: Real-time streaming responses
- **React Hooks**: Easy-to-use hooks for React components
- **Error Handling**: Comprehensive error handling with retry logic
- **Content Moderation**: Built-in safety checks and content filtering

### 🎯 **Supported Operations**
- Story foundation generation
- Chapter generation with context
- Content improvement and editing
- Content analysis and feedback
- Streaming responses for better UX
- Multiple model support (Sonnet, Opus, Haiku)

### 🔒 **Security & Safety**
- Prompt injection detection
- Content moderation patterns
- Rate limiting and abuse prevention
- Input validation and sanitization

## Quick Start

### 1. Basic Usage

```typescript
import { claudeService } from '@/lib/claude'

// Generate content
const response = await claudeService.generateContent({
  prompt: 'Write a short story about space exploration',
  maxTokens: 1000
})

console.log(response.content)
```

### 2. Streaming Content

```typescript
import { useClaudeStreaming } from '@/lib/claude'

function MyComponent() {
  const { streamStoryFoundation, isStreaming, content } = useClaudeStreaming()
  
  const handleGenerate = async () => {
    await streamStoryFoundation({
      title: 'My Story',
      genre: 'Science Fiction',
      premise: 'A story about the future'
    })
  }
  
  return (
    <div>
      <button onClick={handleGenerate} disabled={isStreaming}>
        {isStreaming ? 'Generating...' : 'Generate Story'}
      </button>
      {content && <div>{content}</div>}
    </div>
  )
}
```

### 3. Content Analysis

```typescript
import { useClaude } from '@/lib/claude'

function AnalysisComponent() {
  const { executeClaudeOperation, isLoading } = useClaude()
  
  const analyzeContent = async (content: string) => {
    const result = await executeClaudeOperation(async () => {
      return await claudeService.analyzeContent(content)
    })
    
    if (result) {
      console.log('Quality:', result.overallQuality)
      console.log('Suggestions:', result.suggestions)
    }
  }
}
```

## API Reference

### ClaudeService

#### `generateContent(options)`
Generate content using Claude with comprehensive error handling.

```typescript
const response = await claudeService.generateContent({
  prompt: string
  model?: string // Default: 'claude-3-sonnet-20240229'
  maxTokens?: number // Default: 4000
  temperature?: number // Default: 0.7
  systemPrompt?: string
  retries?: number // Default: 3
})
```

**Returns:**
```typescript
{
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  cost: number
  model: string
  attempt: number
}
```

#### `generateStoryFoundation(options)`
Generate a comprehensive story foundation with characters, plot, and structure.

```typescript
const foundation = await claudeService.generateStoryFoundation({
  title?: string
  genre: string
  premise: string
})
```

#### `generateChapter(options)`
Generate a chapter with context from previous chapters.

```typescript
const chapter = await claudeService.generateChapter({
  storyContext: string
  chapterNumber: number
  previousChapters: Array<{number: number, content: string, summary: string}>
  targetWordCount?: number // Default: 2000
})
```

#### `improveContent(options)`
Improve existing content based on feedback.

```typescript
const improved = await claudeService.improveContent({
  content: string
  feedback: string
  improvementType?: 'general' | 'dialogue' | 'description' | 'pacing' | 'character'
})
```

#### `analyzeContent(content)`
Analyze content for quality, structure, and improvement suggestions.

```typescript
const analysis = await claudeService.analyzeContent(content)
```

### Streaming Service

#### `streamContent(options)`
Stream content generation with real-time updates.

```typescript
const generator = claudeStreamingService.streamContent({
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
})

for await (const response of generator) {
  console.log(response.content)
  if (response.isComplete) {
    console.log('Done!', response.usage)
  }
}
```

### React Hooks

#### `useClaudeStreaming(options)`
Hook for streaming Claude operations in React components.

```typescript
const {
  // State
  isStreaming: boolean
  content: string
  error: string | null
  usage: UsageInfo | null
  cost: number | null
  
  // Actions
  streamStoryFoundation: (params) => Promise<void>
  streamChapter: (params) => Promise<void>
  streamContentImprovement: (params) => Promise<void>
  stopStream: () => void
  reset: () => void
} = useClaudeStreaming({
  onComplete?: (response) => void
  onError?: (error) => void
  onProgress?: (content) => void
})
```

#### `useClaude()`
Hook for non-streaming Claude operations.

```typescript
const {
  isLoading: boolean
  error: string | null
  executeClaudeOperation: <T>(operation: () => Promise<T>) => Promise<T | null>
  clearError: () => void
} = useClaude()
```

## Available Models

The integration supports multiple Claude models:

- **Claude 3 Sonnet** (`claude-3-sonnet-20240229`): Balanced performance and cost (default)
- **Claude 3 Opus** (`claude-3-opus-20240229`): Most capable, highest cost
- **Claude 3 Haiku** (`claude-3-haiku-20240307`): Fastest, most cost-effective

## Error Handling

The integration includes comprehensive error handling:

### Automatic Retries
- Exponential backoff for transient errors
- Configurable retry attempts (default: 3)
- Non-retryable error detection (4xx status codes)

### Error Types
- Rate limiting (429)
- Authentication failures (401)
- Invalid requests (400)
- Server errors (5xx)
- Content moderation violations
- Prompt injection attempts

### Error Responses
```typescript
try {
  const response = await claudeService.generateContent({ prompt })
} catch (error) {
  // Error messages are user-friendly
  console.log(error.message) // "Rate limit exceeded. Please wait a moment..."
}
```

## Content Safety

### Moderation Patterns
Built-in patterns to detect and block:
- Explicit sexual content
- Graphic violence
- Illegal activities
- Self-harm content
- Hate speech
- Script injection attempts

### Prompt Injection Detection
Automatic detection of prompt injection attempts:
- "Ignore previous instructions"
- "Forget everything above"
- "New instructions:"
- "System prompt"
- "Jailbreak"

## Streaming API Routes

### Story Generation Stream
```
POST /api/stories/stream
```

Streams story foundation generation with real-time updates.

**Request Body:**
```json
{
  "title": "Optional title",
  "genre": "Science Fiction",
  "premise": "Story premise..."
}
```

**Response:** Server-Sent Events stream with:
- `start`: Initial status
- `content`: Incremental content updates
- `complete`: Final response with usage stats
- `error`: Error messages

### Chapter Generation Stream
```
POST /api/stories/[id]/chapters/stream
```

Streams chapter generation with story context.

**Request Body:**
```json
{
  "chapter_number": 1,
  "target_word_count": 2000
}
```

## Configuration

### Environment Variables
```bash
ANTHROPIC_API_KEY=your_api_key_here
```

### Constants
Update `lib/constants.ts` to customize:
- Token costs
- Rate limits
- Content limits
- Model preferences
- Moderation patterns

## Best Practices

### 1. **Use Streaming for Long Content**
```typescript
// ✅ Good: Use streaming for chapters and story foundations
const { streamChapter } = useClaudeStreaming()
await streamChapter({ storyContext, chapterNumber, previousChapters })

// ❌ Avoid: Regular generation for long content
const response = await claudeService.generateContent({ prompt: veryLongPrompt })
```

### 2. **Handle Errors Gracefully**
```typescript
// ✅ Good: Provide user-friendly error handling
try {
  await streamStoryFoundation(params)
} catch (error) {
  showUserFriendlyMessage(error.message)
}
```

### 3. **Use Appropriate Models**
```typescript
// ✅ Good: Choose model based on task
await claudeService.generateContent({
  prompt: simplePrompt,
  model: 'claude-3-haiku-20240307' // Faster, cheaper
})

await claudeService.generateContent({
  prompt: complexCreativePrompt,
  model: 'claude-3-opus-20240229' // More capable
})
```

### 4. **Implement Progress Feedback**
```typescript
// ✅ Good: Show progress to users
const { isStreaming, content } = useClaudeStreaming({
  onProgress: (content) => setProgress(content.length / expectedLength)
})
```

## Migration from Old Integration

If you're migrating from the old Anthropic SDK integration:

### Before (Old)
```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const message = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }]
})
```

### After (New)
```typescript
import { claudeService } from '@/lib/claude'

const response = await claudeService.generateContent({
  prompt,
  maxTokens: 4000
})
```

## Troubleshooting

### Common Issues

1. **"API authentication failed"**
   - Check `ANTHROPIC_API_KEY` environment variable
   - Verify API key is valid and has sufficient credits

2. **"Rate limit exceeded"**
   - The service automatically retries with exponential backoff
   - Consider upgrading your Anthropic plan for higher limits

3. **"Content moderation failed"**
   - Review generated content for policy violations
   - Adjust prompts to avoid triggering moderation patterns

4. **Streaming stops unexpectedly**
   - Check network connectivity
   - Verify API key permissions
   - Monitor browser console for errors

### Debug Mode
Enable detailed logging by setting:
```bash
NODE_ENV=development
```

This will provide detailed error information and API call logs.

## Support

For issues with the Claude integration:
1. Check the error messages (they're designed to be user-friendly)
2. Review the console logs for detailed error information
3. Verify your API key and account status
4. Check Anthropic's status page for service issues

## Examples

See `components/ClaudeExamples.tsx` for comprehensive usage examples and `components/StreamingStoryCreator.tsx` for a complete streaming implementation.

