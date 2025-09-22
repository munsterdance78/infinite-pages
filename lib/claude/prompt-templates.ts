import { type OptimizedContext } from './context-optimizer'

// Optimized prompt templates for different generation types
export const OPTIMIZED_CHAPTER_PROMPT = `
STORY CORE:
Genre: {genre} | Setting: {location} ({atmosphere}) | Era: {era}
Protagonist: {protagonist_name} | Central Conflict: {central_conflict}
Current: {current_condition} | Features: {key_features}

CHAPTER {chapter_number} - {chapter_purpose}:
Key Event: {key_event}
Character Focus: {character_focus}

ACTIVE CHARACTERS:
{characters}

RECENT EVENTS:
{recent_events}

GOALS:
1. {primary_goal}
2. {secondary_goal}
3. Advance: {plot_advancement}

Write {target_word_count} words. Focus on ACTION and DIALOGUE. Show don't tell.

Return as JSON:
{
  "title": "Chapter {chapter_number} title",
  "content": "The full chapter content",
  "summary": "Brief summary of what happens in this chapter",
  "wordCount": number_of_words,
  "keyEvents": ["Important events that occur in this chapter"],
  "characterDevelopment": "How characters grow or change in this chapter",
  "foreshadowing": "Any hints or foreshadowing for future events"
}
`

export const OPTIMIZED_FOUNDATION_PROMPT = `
Create a ${'{genre}'} story foundation for: "${'{premise}'}"

TARGET STRUCTURE:
- 3-5 main characters with specific goals/motivations
- Clear 3-act structure with defined conflicts
- Rich but focused setting details
- 8-12 chapter outline with specific purposes

Return structured JSON:
{
  "title": "${'{title}' || 'Untitled Story'}",
  "genre": "${'{genre}'}",
  "premise": "${'{premise}'}",
  "mainCharacters": [
    {
      "name": "Character Name",
      "role": "protagonist/antagonist/supporting",
      "description": "Key traits and background",
      "motivation": "Primary driving force",
      "arc": "Character journey/development"
    }
  ],
  "setting": {
    "time": "Specific time period",
    "place": "Primary locations",
    "atmosphere": "Mood and tone",
    "worldbuilding": "Unique world aspects"
  },
  "plotStructure": {
    "incitingIncident": "Story catalyst",
    "risingAction": "Main conflicts",
    "climax": "Story peak/turning point",
    "resolution": "Conflict resolution"
  },
  "themes": ["Primary story themes"],
  "chapterOutline": [
    {
      "number": 1,
      "title": "Chapter title",
      "summary": "Chapter summary",
      "purpose": "Story function",
      "keyEvents": ["Important events"],
      "characterDevelopment": "Character growth"
    }
  ]
}

Make this comprehensive but focused - quality over quantity.
`

export const OPTIMIZED_IMPROVEMENT_PROMPT = `
CONTENT TO IMPROVE:
{content}

FEEDBACK TYPE: {improvement_type}
SPECIFIC FEEDBACK: {feedback}

FOCUS AREAS:
- {improvement_type === 'dialogue' ? 'Natural speech, character voice, subtext' : ''}
- {improvement_type === 'description' ? 'Vivid imagery, sensory details, pacing' : ''}
- {improvement_type === 'pacing' ? 'Scene rhythm, tension building, flow' : ''}
- {improvement_type === 'character' ? 'Motivation, consistency, development' : ''}

Return improved version as JSON:
{
  "improvedContent": "Enhanced content preserving author voice",
  "changes": ["Specific improvements made"],
  "reasoning": "Why these changes improve quality",
  "wordCount": number_of_words,
  "improvementAreas": ["Areas specifically addressed"]
}

Focus on meaningful enhancements that elevate the writing quality.
`

export const OPTIMIZED_ANALYSIS_PROMPT = `
ANALYZE THIS CONTENT:
{content}

ASSESSMENT FRAMEWORK:
- Writing craft (dialogue, description, pacing, structure)
- Story elements (character, plot, theme, setting)
- Reader engagement (clarity, interest, emotional impact)
- Technical quality (grammar, flow, consistency)

Return comprehensive analysis as JSON:
{
  "overallQuality": "excellent|good|fair|needs_work",
  "wordCount": number_of_words,
  "readabilityScore": score_out_of_100,
  "strengths": ["What works well"],
  "areasForImprovement": ["Specific improvement opportunities"],
  "writingStyle": {
    "tone": "Detected tone",
    "pacing": "Pacing assessment",
    "dialogue": "Dialogue quality",
    "description": "Description quality"
  },
  "suggestions": ["Actionable improvement suggestions"],
  "targetAudience": "Intended readership",
  "genreAlignment": "Genre convention fit"
}

Provide honest, constructive feedback for improvement.
`

interface PromptTemplate {
  id: string
  name: string
  category: 'chapter' | 'foundation' | 'improvement' | 'analysis'
  template: string
  variables: string[]
  tokenTarget: number
  description: string
}

export class OptimizedPromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map()

  constructor() {
    this.initializeTemplates()
  }

  private initializeTemplates() {
    const templates: PromptTemplate[] = [
      {
        id: 'optimized_chapter',
        name: 'Optimized Chapter Generation',
        category: 'chapter',
        template: OPTIMIZED_CHAPTER_PROMPT,
        variables: [
          'genre', 'location', 'atmosphere', 'era', 'protagonist_name',
          'central_conflict', 'current_condition', 'key_features',
          'chapter_number', 'chapter_purpose', 'key_event', 'character_focus',
          'characters', 'recent_events', 'primary_goal', 'secondary_goal',
          'plot_advancement', 'target_word_count'
        ],
        tokenTarget: 300,
        description: 'Fact-based chapter generation with 70% token reduction'
      },
      {
        id: 'optimized_foundation',
        name: 'Optimized Story Foundation',
        category: 'foundation',
        template: OPTIMIZED_FOUNDATION_PROMPT,
        variables: ['genre', 'premise', 'title'],
        tokenTarget: 200,
        description: 'Focused story foundation creation'
      },
      {
        id: 'optimized_improvement',
        name: 'Optimized Content Improvement',
        category: 'improvement',
        template: OPTIMIZED_IMPROVEMENT_PROMPT,
        variables: ['content', 'improvement_type', 'feedback'],
        tokenTarget: 150,
        description: 'Targeted content enhancement'
      },
      {
        id: 'optimized_analysis',
        name: 'Optimized Content Analysis',
        category: 'analysis',
        template: OPTIMIZED_ANALYSIS_PROMPT,
        variables: ['content'],
        tokenTarget: 100,
        description: 'Comprehensive content assessment'
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  getTemplate(id: string): PromptTemplate | null {
    return this.templates.get(id) || null
  }

  renderTemplate(id: string, variables: Array<{ name: string; value: any }>): string {
    const template = this.getTemplate(id)
    if (!template) {
      throw new Error(`Template ${id} not found`)
    }

    let rendered = template.template
    variables.forEach(({ name, value }) => {
      const placeholder = `{${name}}`
      rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value))
    })

    return rendered
  }

  buildOptimizedPrompt(context: OptimizedContext, chapterNumber: number, targetWordCount: number): string {
    const { core_facts, active_characters, recent_events, chapter_goals } = context

    const variables = [
      { name: 'genre', value: core_facts.genre },
      { name: 'location', value: core_facts.setting.location },
      { name: 'atmosphere', value: core_facts.setting.atmosphere },
      { name: 'era', value: 'modern' }, // Default or extract from setting
      { name: 'protagonist_name', value: core_facts.protagonist },
      { name: 'central_conflict', value: core_facts.central_conflict },
      { name: 'current_condition', value: core_facts.setting.current_condition },
      { name: 'key_features', value: core_facts.setting.key_features.join(', ') },
      { name: 'chapter_number', value: chapterNumber },
      { name: 'chapter_purpose', value: chapter_goals.primary_goal },
      { name: 'key_event', value: chapter_goals.secondary_goal },
      { name: 'character_focus', value: active_characters[0]?.name || 'protagonist' },
      {
        name: 'characters',
        value: active_characters.map(c =>
          `${c.name}: wants ${c.current_goal}, ${c.key_trait}, feeling ${c.current_emotion}`
        ).join('\n')
      },
      {
        name: 'recent_events',
        value: recent_events.map(e => `Ch${e.number}: ${e.key_event} → ${e.consequences}`).join(' | ')
      },
      { name: 'primary_goal', value: chapter_goals.primary_goal },
      { name: 'secondary_goal', value: chapter_goals.secondary_goal },
      { name: 'plot_advancement', value: chapter_goals.plot_advancement },
      { name: 'target_word_count', value: targetWordCount }
    ]

    return this.renderTemplate('optimized_chapter', variables)
  }

  buildFoundationPrompt(title: string, genre: string, premise: string): string {
    const variables = [
      { name: 'title', value: title },
      { name: 'genre', value: genre },
      { name: 'premise', value: premise }
    ]

    return this.renderTemplate('optimized_foundation', variables)
  }

  buildImprovementPrompt(content: string, feedback: string, improvementType: string): string {
    const variables = [
      { name: 'content', value: content },
      { name: 'feedback', value: feedback },
      { name: 'improvement_type', value: improvementType }
    ]

    return this.renderTemplate('optimized_improvement', variables)
  }

  buildAnalysisPrompt(content: string): string {
    const variables = [
      { name: 'content', value: content }
    ]

    return this.renderTemplate('optimized_analysis', variables)
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category)
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  searchTemplates(query: string): PromptTemplate[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.templates.values()).filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.category.toLowerCase().includes(lowerQuery)
    )
  }

  getTokenEstimate(templateId: string): number {
    const template = this.getTemplate(templateId)
    return template?.tokenTarget || 500
  }

  // Calculate actual token usage vs target for optimization tracking
  calculateCompressionRatio(templateId: string, actualTokens: number): number {
    const template = this.getTemplate(templateId)
    if (!template) return 1

    return actualTokens / template.tokenTarget
  }
}

export const optimizedPromptTemplateManager = new OptimizedPromptTemplateManager()