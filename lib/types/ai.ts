/**
 * AI service types for story generation and processing
 */

// AI Model configurations and types
export interface AIModel {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'google' | 'mistral'
  maxTokens: number
  costPerInputToken: number
  costPerOutputToken: number
  supportsStreaming: boolean
  supportsToolUse: boolean
  contextWindow: number
}

export interface AIModelUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
}

// Story generation request types
export interface StoryGenerationRequest {
  type: 'foundation' | 'chapter' | 'character' | 'cover' | 'choice' | 'improvement'
  model: string
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
  streaming?: boolean
  userId: string
  storyId?: string
  chapterId?: string
}

export interface StoryGenerationResponse {
  id: string
  content: string
  usage: AIModelUsage
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use'
  model: string
  generationTime: number
  cached?: boolean
  cacheKey?: string
  metadata?: Record<string, unknown>
}

// Streaming response types
export interface StreamingChunk {
  id: string
  content: string
  isComplete: boolean
  usage?: AIModelUsage
  error?: string
}

export interface StreamingResponse {
  id: string
  stream: ReadableStream<StreamingChunk>
  controller: ReadableStreamDefaultController<StreamingChunk>
}

// Foundation generation types
export interface FoundationRequest {
  title: string
  genre: string
  premise: string
  style?: 'descriptive' | 'action-packed' | 'character-driven' | 'dialogue-heavy'
  tone?: 'serious' | 'lighthearted' | 'dark' | 'mysterious' | 'romantic'
  targetAudience?: 'children' | 'teen' | 'adult' | 'all-ages'
  worldBuilding?: 'minimal' | 'moderate' | 'extensive'
  characterDepth?: 'basic' | 'detailed' | 'complex'
}

export interface FoundationResponse {
  plotStructure: {
    setup: string
    incitingIncident: string
    risingAction: string[]
    climax: string
    fallingAction: string
    resolution: string
  }
  characters: Character[]
  worldBuilding: WorldBuilding
  themes: string[]
  conflicts: Conflict[]
  pacing: PacingGuide
  styleGuide: StyleGuide
}

// Character generation types
export interface Character {
  id: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  description: string
  personality: {
    traits: string[]
    motivations: string[]
    fears: string[]
    goals: string[]
  }
  background: {
    age?: number
    occupation?: string
    origin?: string
    relationships?: Array<{
      characterId: string
      relationship: string
      description: string
    }>
  }
  arc: {
    startingPoint: string
    development: string[]
    endingPoint: string
  }
  voiceAndDialogue: {
    speechPatterns: string[]
    vocabulary: string
    mannerisms: string[]
  }
}

export interface CharacterGenerationRequest extends StoryGenerationRequest {
  existingCharacters?: Character[]
  characterRole: Character['role']
  relationshipToExisting?: string
  specificTraits?: string[]
}

// World building types
export interface WorldBuilding {
  setting: {
    timeperiod: string
    location: string
    society: string
    technology: string
    magic?: string
  }
  rules: {
    physical: string[]
    social: string[]
    magical?: string[]
    technological?: string[]
  }
  history: {
    keyEvents: Array<{
      event: string
      timeframe: string
      impact: string
    }>
    cultures: Array<{
      name: string
      characteristics: string[]
      values: string[]
    }>
  }
  geography: {
    regions: Array<{
      name: string
      description: string
      significance: string
    }>
    climate: string
    resources: string[]
  }
}

// Chapter generation types
export interface ChapterGenerationRequest extends StoryGenerationRequest {
  chapterNumber: number
  previousChapters?: Array<{
    number: number
    title: string
    summary: string
    wordCount: number
  }>
  plotOutline: string
  charactersInScene: string[]
  settingDescription: string
  chapterGoals: string[]
  targetWordCount?: number
  pov?: string
  tense?: 'first' | 'third'
  mood?: string
}

export interface ChapterResponse {
  title: string
  content: string
  summary: string
  wordCount: number
  charactersIntroduced: string[]
  plotAdvancement: string[]
  hooks: {
    opening: string
    closing: string
    cliffhanger?: string
  }
  pacing: 'slow' | 'moderate' | 'fast'
  emotionalTone: string[]
}

// Choice book generation types
export interface ChoiceGenerationRequest extends StoryGenerationRequest {
  complexity: 'simple' | 'moderate' | 'complex'
  currentPath: ChoiceNode[]
  availableChoices: number
  targetEndings: number
  branchingFactor: number
}

export interface ChoiceNode {
  id: string
  content: string
  choices: Choice[]
  isEnding: boolean
  endingType?: 'good' | 'bad' | 'neutral' | 'secret'
  consequences?: string[]
}

export interface Choice {
  id: string
  text: string
  description?: string
  consequences: string[]
  leadsTo: string // ID of next ChoiceNode
  requirements?: Array<{
    type: 'item' | 'stat' | 'choice' | 'path'
    value: string
    comparison: 'equals' | 'greater' | 'less'
    required: boolean
  }>
}

// Cover and marketing generation types
export interface CoverGenerationRequest extends StoryGenerationRequest {
  title: string
  genre: string
  targetAudience: string
  moodKeywords: string[]
  visualStyle?: 'realistic' | 'illustrated' | 'abstract' | 'photographic'
  colorScheme?: 'dark' | 'light' | 'colorful' | 'monochrome'
  includeCharacters?: boolean
}

export interface CoverResponse {
  imagePrompt: string
  designElements: {
    typography: string
    layout: string
    colorPalette: string[]
    visualElements: string[]
  }
  marketingCopy: {
    tagline: string
    backCover: string
    shortDescription: string
    keywords: string[]
  }
  variations: Array<{
    style: string
    description: string
    prompt: string
  }>
}

// Content improvement types
export interface ImprovementRequest extends StoryGenerationRequest {
  contentType: 'chapter' | 'dialogue' | 'description' | 'pacing' | 'character'
  originalContent: string
  improvementGoals: Array<'clarity' | 'engagement' | 'pacing' | 'dialogue' | 'description' | 'consistency'>
  targetAudience?: string
  feedback?: string
}

export interface ImprovementResponse {
  improvedContent: string
  changes: Array<{
    type: 'addition' | 'removal' | 'modification'
    location: string
    original: string
    improved: string
    reason: string
  }>
  suggestions: Array<{
    category: string
    suggestion: string
    priority: 'low' | 'medium' | 'high'
  }>
  metrics: {
    readabilityScore: number
    engagementScore: number
    paceScore: number
    wordCountChange: number
  }
}

// AI Processing pipeline types
export interface ProcessingPipeline {
  id: string
  name: string
  stages: ProcessingStage[]
  parallelizable: boolean
  retryPolicy: RetryPolicy
}

export interface ProcessingStage {
  id: string
  name: string
  type: 'generation' | 'validation' | 'enhancement' | 'formatting'
  inputs: string[]
  outputs: string[]
  model?: string
  prompt?: string
  validation?: ValidationRule[]
  dependencies?: string[]
}

export interface RetryPolicy {
  maxRetries: number
  backoffStrategy: 'linear' | 'exponential'
  retryableErrors: string[]
  fallbackModel?: string
}

// Validation and quality control
export interface ValidationRule {
  name: string
  type: 'length' | 'content' | 'consistency' | 'quality' | 'safety'
  parameters: Record<string, unknown>
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface ContentValidation {
  isValid: boolean
  errors: ValidationResult[]
  warnings: ValidationResult[]
  suggestions: ValidationResult[]
  overallScore: number
}

export interface ValidationResult {
  rule: string
  severity: 'error' | 'warning' | 'info'
  message: string
  location?: {
    start: number
    end: number
    context: string
  }
  suggestion?: string
}

// Caching types
export interface CacheEntry {
  key: string
  content: string
  metadata: {
    model: string
    promptHash: string
    generatedAt: string
    usage: AIModelUsage
    tags: string[]
  }
  expiresAt: string
  hitCount: number
  lastAccessed: string
}

export interface CacheConfig {
  maxEntries: number
  ttlMs: number
  updateAgeOnGet: boolean
  enableMetrics: boolean
}

export interface CacheMetrics {
  hitRate: number
  missRate: number
  totalRequests: number
  totalHits: number
  totalMisses: number
  averageResponseTime: number
  cacheSize: number
  evictionCount: number
}

// Pacing and style guides
export interface PacingGuide {
  overallPace: 'slow' | 'moderate' | 'fast' | 'variable'
  chapterPacing: Array<{
    chapterNumber: number
    pace: 'slow' | 'moderate' | 'fast'
    purpose: string
    techniques: string[]
  }>
  tensionCurve: Array<{
    point: number
    tension: number
    description: string
  }>
}

export interface StyleGuide {
  narrativeVoice: 'first-person' | 'third-person-limited' | 'third-person-omniscient'
  tense: 'past' | 'present' | 'mixed'
  tone: string[]
  vocabularyLevel: 'simple' | 'moderate' | 'advanced' | 'mixed'
  sentenceStructure: 'short' | 'varied' | 'complex'
  dialogueStyle: string[]
  descriptiveStyle: 'minimal' | 'moderate' | 'rich'
}

export interface Conflict {
  id: string
  type: 'internal' | 'interpersonal' | 'societal' | 'environmental' | 'supernatural'
  description: string
  charactersInvolved: string[]
  introduction: string
  development: string[]
  resolution: string
  impact: string[]
}

// Error types
export interface AIServiceError {
  code: string
  message: string
  details?: Record<string, unknown>
  retryable: boolean
  model?: string
  requestId?: string
}

// Type guards for AI responses
export function isStoryGenerationResponse(obj: unknown): obj is StoryGenerationResponse {
  return typeof obj === 'object' && obj !== null &&
         'content' in obj && 'usage' in obj && 'model' in obj
}

export function isStreamingChunk(obj: unknown): obj is StreamingChunk {
  return typeof obj === 'object' && obj !== null &&
         'id' in obj && 'content' in obj && 'isComplete' in obj
}

export function isAIServiceError(obj: unknown): obj is AIServiceError {
  return typeof obj === 'object' && obj !== null &&
         'code' in obj && 'message' in obj && 'retryable' in obj
}

// Utility types
export type ModelProvider = AIModel['provider']
export type GenerationType = StoryGenerationRequest['type']
export type FinishReason = StoryGenerationResponse['finishReason']

// Configuration types
export interface AIServiceConfig {
  defaultModel: string
  fallbackModel: string
  maxRetries: number
  timeoutMs: number
  rateLimiting: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
  caching: CacheConfig
  validation: {
    enableContentValidation: boolean
    enableSafetyCheck: boolean
    maxContentLength: number
  }
}