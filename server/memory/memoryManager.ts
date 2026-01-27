import { memoryCore } from "./memoryCore";
import { memorySummarizer } from "./memorySummarizer";
import { memoryCategorizer } from "./memoryCategorizer";

/**
 * MemoryManager: High-level memory management orchestration
 * Integrates memory core, summarizer, and categorizer
 */
export class MemoryManager {
  private cacheSize: number = 100;
  private recentAccessCache: Map<string, number> = new Map();

  /**
   * Process and store a conversation
   */
  async processConversation(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ) {
    // Summarize the conversation
    await memorySummarizer.summarizeConversation(contactId, messages);

    // Clean up expired memories periodically
    if (Math.random() < 0.1) {
      // 10% chance on each call
      await memoryCore.cleanupExpiredMemories();
    }
  }

  /**
   * Build context from memories for conversation
   */
  async buildContextForConversation(
    contactId: number,
    currentMessage: string
  ): Promise<{
    relevantMemories: string;
    recentMemories: string;
    summary: string;
  }> {
    // Search for relevant memories
    const relevant = await memoryCore.searchMemories(contactId, currentMessage, 3);
    const relevantText =
      relevant.length > 0
        ? "Recent relevant memories:\n" +
          relevant
            .map(
              (m, i) =>
                `${i + 1}. [${m.category}] ${m.content}`
            )
            .join("\n")
        : "";

    // Get recent memories
    const recent = await memoryCore.getRecentMemories(contactId, 3);
    const recentText =
      recent.length > 0
        ? "Recent context:\n" +
          recent
            .map(
              (m, i) =>
                `${i + 1}. ${m.content}`
            )
            .join("\n")
        : "";

    // Get summary of all memories
    const summary = await memorySummarizer.createMemorySummary(contactId, 200);

    return {
      relevantMemories: relevantText,
      recentMemories: recentText,
      summary,
    };
  }

  /**
   * Get memory insights for a contact
   */
  async getMemoryInsights(contactId: number) {
    const organized = await memoryCategorizer.organizeMemoriesByContext(
      contactId
    );

    const categoryCount: Record<string, number> = {};
    for (const category in organized.byCategory) {
      categoryCount[category] = organized.byCategory[category].length;
    }

    const totalMemories = Object.values(categoryCount).reduce((a, b) => a + b, 0);

    const duplicates = await memoryCategorizer.findDuplicates(contactId, 0.8);

    return {
      totalMemories,
      byCategory: categoryCount,
      duplicateMemories: duplicates.length,
      oldestMemory: organized.recency[organized.recency.length - 1],
      newestMemory: organized.recency[0],
      mostAccessedMemories: organized.recency
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 3),
    };
  }

  /**
   * Store memory from user input
   */
  async storeUserMemory(
    contactId: number,
    content: string,
    explicitCategory?: string
  ) {
    // Auto-categorize the content
    const categorization = await memoryCategorizer.categorizeContent(
      contactId,
      content,
      explicitCategory
    );

    // Store the memory
    const memory = await memoryCore.storeMemory(
      contactId,
      content,
      categorization.category as any,
      categorization.priority,
      { autoCategorizationConfidence: categorization.confidence }
    );

    return memory;
  }

  /**
   * Get memory for a specific category
   */
  async getMemoryByCategory(contactId: number, category: string) {
    return await memoryCore.getMemoriesByCategory(
      contactId,
      category as any,
      10
    );
  }

  /**
   * Search memories
   */
  async searchMemories(contactId: number, query: string) {
    // Update access cache
    const cacheKey = `${contactId}:${query}`;
    this.recentAccessCache.set(
      cacheKey,
      (this.recentAccessCache.get(cacheKey) || 0) + 1
    );

    // Keep cache size manageable
    if (this.recentAccessCache.size > this.cacheSize) {
      const oldestKey = Array.from(this.recentAccessCache.entries()).sort(
        (a, b) => a[1] - b[1]
      )[0][0];
      this.recentAccessCache.delete(oldestKey);
    }

    return await memoryCore.searchMemories(contactId, query, 5);
  }

  /**
   * Clean up and optimize memories
   */
  async optimizeMemories(contactId: number) {
    const stats = {
      cleaned: 0,
      archived: 0,
      optimized: false,
    };

    // Remove expired memories
    stats.cleaned = await memoryCore.cleanupExpiredMemories();

    // Archive old memories
    stats.archived = await memoryCategorizer.archiveOldMemories(contactId, 90);

    stats.optimized = true;
    return stats;
  }
}

export const memoryManager = new MemoryManager();
