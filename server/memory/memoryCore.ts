import { db } from "../db";
import { eq, desc, and, ilike, lt } from "drizzle-orm";

// Memory categories and types
export type MemoryCategory = 
  | "personal_info"
  | "preferences"
  | "past_conversations"
  | "relationships"
  | "important_dates"
  | "tasks_and_goals"
  | "notes";

export type MemoryPriority = "low" | "medium" | "high" | "critical";

export interface MemoryEntry {
  id: string;
  contactId: number;
  category: MemoryCategory;
  priority: MemoryPriority;
  content: string;
  summary?: string;
  keywords?: string[];
  embedding?: number[]; // For vector search
  relatedMemories?: string[]; // IDs of related memories
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  expiresAt?: Date; // For temporary memories
  metadata?: Record<string, any>;
}

/**
 * MemoryCore: Core memory storage and retrieval system
 * Manages all memory entries with semantic search, categorization, and cleanup
 */
export class MemoryCore {
  private memories: Map<string, MemoryEntry> = new Map();
  private index: Map<MemoryCategory, Set<string>> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeIndices();
  }

  private initializeIndices() {
    // Initialize category indices
    const categories: MemoryCategory[] = [
      "personal_info",
      "preferences",
      "past_conversations",
      "relationships",
      "important_dates",
      "tasks_and_goals",
      "notes"
    ];

    for (const category of categories) {
      this.index.set(category, new Set());
    }
  }

  /**
   * Create or update a memory entry
   */
  async storeMemory(
    contactId: number,
    content: string,
    category: MemoryCategory,
    priority: MemoryPriority = "medium",
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const memory: MemoryEntry = {
      id,
      contactId,
      category,
      priority,
      content,
      keywords: this.extractKeywords(content),
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessed: now,
      metadata
    };

    this.memories.set(id, memory);

    // Update category index
    const categorySet = this.index.get(category) || new Set();
    categorySet.add(id);
    this.index.set(category, categorySet);

    // Update keyword index
    for (const keyword of memory.keywords || []) {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, new Set());
      }
      this.keywordIndex.get(keyword)!.add(id);
    }

    return memory;
  }

  /**
   * Retrieve memories by category and contact
   */
  async getMemoriesByCategory(
    contactId: number,
    category: MemoryCategory,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    const categoryIds = this.index.get(category) || new Set();
    const memories = Array.from(categoryIds)
      .map(id => this.memories.get(id))
      .filter(
        m => m && m.contactId === contactId && (!m.expiresAt || m.expiresAt > new Date())
      ) as MemoryEntry[];

    return memories
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return (
          (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0) ||
          (b.accessCount - a.accessCount) ||
          (b.lastAccessed.getTime() - a.lastAccessed.getTime())
        );
      })
      .slice(0, limit);
  }

  /**
   * Search memories by keywords (semantic-like search)
   */
  async searchMemories(
    contactId: number,
    query: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const queryKeywords = this.extractKeywords(query);
    const relevantMemories = new Map<string, number>();

    // Find memories matching keywords
    for (const keyword of queryKeywords) {
      const memoryIds = this.keywordIndex.get(keyword) || new Set();
      for (const id of memoryIds) {
        const memory = this.memories.get(id);
        if (memory && memory.contactId === contactId && (!memory.expiresAt || memory.expiresAt > new Date())) {
          relevantMemories.set(id, (relevantMemories.get(id) || 0) + 1);
        }
      }
    }

    // Also do simple text matching
    for (const [id, memory] of this.memories) {
      if (
        memory.contactId === contactId &&
        (!memory.expiresAt || memory.expiresAt > new Date()) &&
        memory.content.toLowerCase().includes(query.toLowerCase())
      ) {
        relevantMemories.set(id, (relevantMemories.get(id) || 0) + 5); // Boost exact matches
      }
    }

    return Array.from(relevantMemories.entries())
      .map(([id, score]) => ({ memory: this.memories.get(id)!, score }))
      .filter(item => item.memory)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  /**
   * Get recent memories for a contact
   */
  async getRecentMemories(contactId: number, limit: number = 10): Promise<MemoryEntry[]> {
    return Array.from(this.memories.values())
      .filter(
        m => m.contactId === contactId && (!m.expiresAt || m.expiresAt > new Date())
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Update memory access (for frequency tracking)
   */
  async accessMemory(memoryId: string): Promise<MemoryEntry | undefined> {
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = new Date();
      return memory;
    }
    return undefined;
  }

  /**
   * Delete expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && memory.expiresAt <= now) {
        this.memories.delete(id);

        // Remove from indices
        const categorySet = this.index.get(memory.category);
        if (categorySet) {
          categorySet.delete(id);
        }

        for (const keyword of memory.keywords || []) {
          const keywordSet = this.keywordIndex.get(keyword);
          if (keywordSet) {
            keywordSet.delete(id);
          }
        }

        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "is", "was", "are", "be", "been", "being", "have", "has", "had"
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Get all memories for a contact
   */
  async getAllMemories(contactId: number): Promise<MemoryEntry[]> {
    return Array.from(this.memories.values()).filter(
      m => m.contactId === contactId && (!m.expiresAt || m.expiresAt > new Date())
    );
  }

  /**
   * Delete specific memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    this.memories.delete(memoryId);

    // Remove from indices
    const categorySet = this.index.get(memory.category);
    if (categorySet) {
      categorySet.delete(memoryId);
    }

    for (const keyword of memory.keywords || []) {
      const keywordSet = this.keywordIndex.get(keyword);
      if (keywordSet) {
        keywordSet.delete(memoryId);
      }
    }

    return true;
  }
}

export const memoryCore = new MemoryCore();
