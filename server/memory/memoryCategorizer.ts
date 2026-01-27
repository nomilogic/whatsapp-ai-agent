import { memoryCore, MemoryEntry } from "./memoryCore";

/**
 * MemoryCategorizer: Automatically categorizes and manages memories
 */
export class MemoryCategorizer {
  /**
   * Auto-categorize content based on keywords
   */
  async categorizeContent(
    contactId: number,
    content: string,
    baseCategory?: string
  ): Promise<{ category: string; priority: "low" | "medium" | "high" | "critical"; confidence: number }> {
    const patterns = [
      {
        keywords: ["birthday", "anniversary", "anniversary", "born", "date of birth"],
        category: "important_dates",
        priority: "critical" as const,
      },
      {
        keywords: ["like", "love", "enjoy", "prefer", "favorite", "dislike", "hate"],
        category: "preferences",
        priority: "medium" as const,
      },
      {
        keywords: ["family", "mother", "father", "brother", "sister", "wife", "husband", "friend", "colleague"],
        category: "relationships",
        priority: "high" as const,
      },
      {
        keywords: ["goal", "want", "dream", "plan", "aim", "target", "objective"],
        category: "tasks_and_goals",
        priority: "high" as const,
      },
      {
        keywords: ["work", "job", "career", "business", "project", "company"],
        category: "tasks_and_goals",
        priority: "medium" as const,
      },
      {
        keywords: ["personal", "private", "secret", "confidential", "between us"],
        category: "personal_info",
        priority: "critical" as const,
      },
    ];

    const contentLower = content.toLowerCase();
    const matches = patterns.map(p => ({
      ...p,
      matchCount: p.keywords.filter(k => contentLower.includes(k)).length,
    }));

    const bestMatch = matches.sort((a, b) => b.matchCount - a.matchCount)[0];

    if (bestMatch && bestMatch.matchCount > 0) {
      return {
        category: bestMatch.category,
        priority: bestMatch.priority,
        confidence: bestMatch.matchCount / bestMatch.keywords.length,
      };
    }

    return {
      category: baseCategory || "notes",
      priority: "low",
      confidence: 0,
    };
  }

  /**
   * Organize memories by context
   */
  async organizeMemoriesByContext(
    contactId: number
  ): Promise<{
    byCategory: Record<string, MemoryEntry[]>;
    byPriority: Record<string, MemoryEntry[]>;
    recency: MemoryEntry[];
  }> {
    const memories = await memoryCore.getAllMemories(contactId);

    const byCategory: Record<string, MemoryEntry[]> = {};
    const byPriority: Record<string, MemoryEntry[]> = {};

    for (const memory of memories) {
      // Group by category
      if (!byCategory[memory.category]) {
        byCategory[memory.category] = [];
      }
      byCategory[memory.category].push(memory);

      // Group by priority
      if (!byPriority[memory.priority]) {
        byPriority[memory.priority] = [];
      }
      byPriority[memory.priority].push(memory);
    }

    // Sort each group
    for (const category in byCategory) {
      byCategory[category].sort(
        (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
      );
    }

    const recency = memories.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return { byCategory, byPriority, recency };
  }

  /**
   * Get memory suggestions based on context
   */
  async getMemorySuggestions(
    contactId: number,
    currentContext: string
  ): Promise<{ suggested: MemoryEntry[]; reasoning: string }> {
    const allMemories = await memoryCore.getAllMemories(contactId);

    // Search for relevant memories
    const relevant = await memoryCore.searchMemories(contactId, currentContext, 10);

    // Sort by relevance and recency
    const suggested = relevant
      .sort((a, b) => {
        const recencyScore =
          (b.lastAccessed.getTime() - a.lastAccessed.getTime()) / (1000 * 60 * 60);
        const accessScore = b.accessCount - a.accessCount;
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityScore = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);

        return priorityScore + accessScore + recencyScore;
      })
      .slice(0, 5);

    let reasoning = "Based on ";
    if (suggested.length > 0) {
      const topCategories = new Set(suggested.map(m => m.category));
      reasoning += `${Array.from(topCategories).join(", ")} memories`;
    } else {
      reasoning += "conversation context";
    }

    return { suggested, reasoning };
  }

  /**
   * Detect duplicate or redundant memories
   */
  async findDuplicates(
    contactId: number,
    similarity: number = 0.7
  ): Promise<Array<{ memory1: MemoryEntry; memory2: MemoryEntry; score: number }>> {
    const memories = await memoryCore.getAllMemories(contactId);
    const duplicates: Array<{ memory1: MemoryEntry; memory2: MemoryEntry; score: number }> = [];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const score = this.calculateSimilarity(
          memories[i].content,
          memories[j].content
        );
        if (score >= similarity) {
          duplicates.push({
            memory1: memories[i],
            memory2: memories[j],
            score,
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate similarity between two texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const t1 = text1.toLowerCase().split(/\s+/);
    const t2 = text2.toLowerCase().split(/\s+/);

    const commonWords = t1.filter(word => t2.includes(word)).length;
    const totalWords = Math.max(t1.length, t2.length);

    return totalWords > 0 ? commonWords / totalWords : 0;
  }

  /**
   * Archive old memories
   */
  async archiveOldMemories(contactId: number, daysOld: number = 90): Promise<number> {
    const allMemories = await memoryCore.getAllMemories(contactId);
    const now = new Date();
    let archivedCount = 0;

    for (const memory of allMemories) {
      const daysAgo = (now.getTime() - memory.updatedAt.getTime()) / (1000 * 60 * 60 * 24);

      // Archive low-priority, old, rarely accessed memories
      if (
        daysAgo > daysOld &&
        memory.priority === "low" &&
        memory.accessCount < 2
      ) {
        await memoryCore.deleteMemory(memory.id);
        archivedCount++;
      }
    }

    return archivedCount;
  }
}

export const memoryCategorizer = new MemoryCategorizer();
