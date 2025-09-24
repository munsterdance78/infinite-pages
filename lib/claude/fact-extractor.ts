import { claudeService } from './service'
import { claudeCache } from './cache'

export interface SFSLFact {
  id: string
  type: 'character' | 'plot' | 'world' | 'setting' | 'conflict' | 'theme'
  content: string
  hierarchicalLevel: 'story' | 'chapter' | 'scene' | 'detail'
  sourceChapter?: number
  sourceText?: string
  importance: 'low' | 'medium' | 'high' | 'critical'
  relationships: string[]
  metadata: {
    extractedAt: string
    confidence: number
    tags: string[]
  }
}

export interface SFSLFactContext {
  storyFacts: SFSLFact[]
  chapterFacts: SFSLFact[]
  sceneFacts: SFSLFact[]
  detailFacts: SFSLFact[]
}

export interface FactExtractionOptions {
  factType?: SFSLFact['type']
  hierarchicalLevel?: SFSLFact['hierarchicalLevel']
  includeRelationships?: boolean
  maxFacts?: number
  confidenceThreshold?: number
}

export class SFSLFactExtractor {
  private cache = claudeCache

  /**
   * Extract SFSL facts from text content using hierarchical analysis
   */
  async extractFacts(
    content: string,
    options: FactExtractionOptions = {}
  ): Promise<SFSLFact[]> {
    const {
      factType,
      hierarchicalLevel = 'chapter',
      includeRelationships = true,
      maxFacts = 50,
      confidenceThreshold = 0.7
    } = options

    const extractionPrompt = this.buildExtractionPrompt(
      content,
      factType,
      hierarchicalLevel,
      includeRelationships,
      maxFacts
    )

    try {
      const response = await claudeService.generateContent({
        prompt: extractionPrompt,
        systemPrompt: this.getFactExtractionSystemPrompt(),
        maxTokens: 4000,
        temperature: 0.3,
        cacheOptions: {
          operation: 'fact_extraction',
          ttl: 3600
        }
      })

      const extractedFacts = this.parseSFSLFactsFromResponse(response.content)

      // Filter by confidence threshold
      return extractedFacts.filter(fact =>
        fact.metadata.confidence >= confidenceThreshold
      )

    } catch (error) {
      console.error('SFSL fact extraction failed:', error)
      throw new Error(`Failed to extract SFSL facts: ${error}`)
    }
  }

  /**
   * Extract hierarchical facts for a complete story
   */
  async extractHierarchicalFacts(
    storyContent: string,
    chapterContents: string[],
    storyId: string
  ): Promise<SFSLFactContext> {
    try {
      // Extract story-level facts
      const storyFacts = await this.extractFacts(storyContent, {
        hierarchicalLevel: 'story',
        maxFacts: 20,
        includeRelationships: true
      })

      // Extract chapter-level facts
      const chapterFactPromises = chapterContents.map(async (content, index) => {
        return this.extractFacts(content, {
          hierarchicalLevel: 'chapter',
          maxFacts: 30
        })
      })

      const chapterFactArrays = await Promise.all(chapterFactPromises)
      const chapterFacts = chapterFactArrays.flat()

      // Extract scene-level facts from key chapters
      const sceneFacts = await this.extractSceneLevelFacts(chapterContents.slice(0, 3))

      // Extract detail-level facts for enhanced coherence
      const detailFacts = await this.extractDetailLevelFacts(storyContent)

      // Cache the hierarchical facts
      await this.cache.cacheHierarchicalFacts(storyId, {
        story: storyFacts,
        chapter: chapterFacts,
        scene: sceneFacts,
        detail: detailFacts
      }, 'story')

      return {
        storyFacts,
        chapterFacts,
        sceneFacts,
        detailFacts
      }

    } catch (error) {
      console.error('Hierarchical fact extraction failed:', error)
      throw new Error(`Failed to extract hierarchical facts: ${error}`)
    }
  }

  /**
   * Get optimized fact context for content generation
   */
  async getOptimizedFactContext(
    storyId: string,
    contextType: 'story' | 'chapter' | 'scene' | 'detail' = 'chapter'
  ): Promise<SFSLFact[]> {
    try {
      // Try to get from cache first
      const cachedFacts = await this.cache.getOptimizedFactContext(storyId, contextType)
      if (cachedFacts) {
        return cachedFacts
      }

      // If not in cache, extract fresh facts (placeholder implementation)
      console.warn(`No cached facts found for ${storyId}:${contextType}, returning empty array`)
      return []

    } catch (error) {
      console.error('Failed to get optimized fact context:', error)
      return []
    }
  }

  /**
   * Build the extraction prompt for SFSL facts
   */
  private buildExtractionPrompt(
    content: string,
    factType?: SFSLFact['type'],
    hierarchicalLevel?: SFSLFact['hierarchicalLevel'],
    includeRelationships?: boolean,
    maxFacts?: number
  ): string {
    const typeFilter = factType ? `Focus specifically on ${factType} facts.` : 'Extract all relevant fact types.'
    const levelContext = this.getHierarchicalLevelContext(hierarchicalLevel || 'chapter')
    const relationshipInstructions = includeRelationships
      ? 'Include relationships between facts where relevant.'
      : 'Focus on individual facts without relationships.'

    return `
Extract SFSL (Structured Fact Storage Layer) facts from the following content:

${content}

EXTRACTION REQUIREMENTS:
- Hierarchical Level: ${hierarchicalLevel}
- ${typeFilter}
- Maximum Facts: ${maxFacts || 50}
- ${relationshipInstructions}

${levelContext}

Return facts in this JSON format:
{
  "facts": [
    {
      "id": "unique_fact_id",
      "type": "character|plot|world|setting|conflict|theme",
      "content": "fact description",
      "hierarchicalLevel": "${hierarchicalLevel}",
      "importance": "low|medium|high|critical",
      "relationships": ["related_fact_ids"],
      "metadata": {
        "extractedAt": "ISO_timestamp",
        "confidence": 0.0-1.0,
        "tags": ["relevant", "tags"]
      }
    }
  ]
}

Ensure facts are coherent, non-redundant, and follow SFSL hierarchical principles.
`
  }

  /**
   * Get system prompt for fact extraction
   */
  private getFactExtractionSystemPrompt(): string {
    return `
You are an expert SFSL (Structured Fact Storage Layer) fact extractor for narrative content.

Your role is to:
1. Extract structured facts from narrative content
2. Maintain hierarchical coherence across story levels
3. Identify important relationships between facts
4. Assign appropriate confidence scores and importance levels
5. Ensure facts are actionable for content generation

SFSL Hierarchy:
- Story: Overarching narrative elements, themes, world rules
- Chapter: Major plot points, character developments, settings
- Scene: Specific events, dialogue patterns, immediate conflicts
- Detail: Fine-grained elements, descriptions, micro-interactions

Always return valid JSON and ensure extracted facts are coherent and useful for maintaining narrative consistency.
`
  }

  /**
   * Get context for hierarchical level
   */
  private getHierarchicalLevelContext(level: SFSLFact['hierarchicalLevel']): string {
    switch (level) {
      case 'story':
        return 'Focus on overarching narrative elements, main themes, world-building rules, and core character arcs.'
      case 'chapter':
        return 'Focus on significant plot developments, character growth, new settings, and chapter-specific conflicts.'
      case 'scene':
        return 'Focus on specific events, dialogue patterns, immediate character interactions, and scene-specific details.'
      case 'detail':
        return 'Focus on fine-grained elements, specific descriptions, micro-expressions, and atmospheric details.'
      default:
        return 'Extract facts appropriate to the content scope and narrative level.'
    }
  }

  /**
   * Parse SFSL facts from Claude response
   */
  private parseSFSLFactsFromResponse(response: string): SFSLFact[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.facts || !Array.isArray(parsed.facts)) {
        throw new Error('Invalid facts structure in response')
      }

      return parsed.facts.map((fact: any) => ({
        id: fact.id || `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: fact.type || 'plot',
        content: fact.content || '',
        hierarchicalLevel: fact.hierarchicalLevel || 'chapter',
        sourceChapter: fact.sourceChapter,
        sourceText: fact.sourceText,
        importance: fact.importance || 'medium',
        relationships: fact.relationships || [],
        metadata: {
          extractedAt: fact.metadata?.extractedAt || new Date().toISOString(),
          confidence: fact.metadata?.confidence || 0.8,
          tags: fact.metadata?.tags || []
        }
      }))

    } catch (error) {
      console.error('Failed to parse SFSL facts from response:', error)
      return []
    }
  }

  /**
   * Extract scene-level facts from chapter contents
   */
  private async extractSceneLevelFacts(chapterContents: string[]): Promise<SFSLFact[]> {
    const sceneFactPromises = chapterContents.map(async (content) => {
      return this.extractFacts(content, {
        hierarchicalLevel: 'scene',
        maxFacts: 15,
        includeRelationships: false
      })
    })

    const sceneFactArrays = await Promise.all(sceneFactPromises)
    return sceneFactArrays.flat()
  }

  /**
   * Extract detail-level facts for enhanced coherence
   */
  private async extractDetailLevelFacts(storyContent: string): Promise<SFSLFact[]> {
    return this.extractFacts(storyContent, {
      hierarchicalLevel: 'detail',
      maxFacts: 25,
      factType: 'character',
      includeRelationships: true
    })
  }
}

// Export singleton instance
export const sfslFactExtractor = new SFSLFactExtractor()