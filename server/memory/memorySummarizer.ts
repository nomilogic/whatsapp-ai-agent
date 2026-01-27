import { memoryCore, MemoryCategory, MemoryPriority, MemoryEntry } from "./memoryCore";

/**
 * MemorySummarizer: Automatically summarizes conversations and memories
 */
export class MemorySummarizer {
  /**
   * Summarize a conversation into key memories
   */
  async summarizeConversation(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<MemoryEntry[]> {
    const createdMemories: MemoryEntry[] = [];

    if (messages.length === 0) return createdMemories;

    // Extract key topics
    const topics = this.extractTopics(messages);
    const sentiment = this.analyzeSentiment(messages);
    const keyPoints = this.extractKeyPoints(messages);

    // Create memory for key points
    if (keyPoints.length > 0) {
      const memory = await memoryCore.storeMemory(
        contactId,
        `Key discussion points: ${keyPoints.join(", ")}`,
        "past_conversations",
        "medium",
        { topics, sentiment, messageCount: messages.length }
      );
      createdMemories.push(memory);
    }

    // Create memories for specific actions mentioned
    const actionItems = this.extractActionItems(messages);
    for (const action of actionItems) {
      const memory = await memoryCore.storeMemory(
        contactId,
        action,
        "tasks_and_goals",
        "high"
      );
      createdMemories.push(memory);
    }

    // Store emotional context if significant
    if (sentiment.emotion === "negative" || sentiment.emotion === "excited") {
      const memory = await memoryCore.storeMemory(
        contactId,
        `Conversation sentiment: ${sentiment.emotion} (${sentiment.score})`,
        "notes",
        "medium",
        { topics }
      );
      createdMemories.push(memory);
    }

    return createdMemories;
  }

  /**
   * Create a concise summary of memories for context
   */
  async createMemorySummary(contactId: number, maxLength: number = 500): Promise<string> {
    const memories = await memoryCore.getAllMemories(contactId);
    if (memories.length === 0) return "No memories recorded.";

    const prioritized = memories.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0) ||
        (b.accessCount - a.accessCount)
      );
    });

    let summary = "";
    for (const memory of prioritized.slice(0, 10)) {
      const line = `[${memory.category}] ${memory.content}\n`;
      if (summary.length + line.length > maxLength) break;
      summary += line;
    }

    return summary || "No important memories to summarize.";
  }

  /**
   * Extract main topics from messages
   */
  private extractTopics(messages: Array<{ role: string; content: string }>): string[] {
    const topicKeywords = [
      { keyword: "birthday|anniversary|celebration", topic: "Important Dates" },
      { keyword: "love|care|miss|appreciate", topic: "Feelings" },
      { keyword: "family|friend|relative|parent|sibling", topic: "Relationships" },
      { keyword: "work|job|career|business|project", topic: "Work" },
      { keyword: "travel|trip|visit|went|going", topic: "Travel" },
      { keyword: "food|eat|recipe|restaurant", topic: "Food Preferences" },
      { keyword: "health|sick|doctor|exercise|fit", topic: "Health" },
    ];

    const allText = messages.map(m => m.content).join(" ").toLowerCase();
    const topics: string[] = [];

    for (const { keyword, topic } of topicKeywords) {
      if (new RegExp(keyword).test(allText)) {
        topics.push(topic);
      }
    }

    return [...new Set(topics)];
  }

  /**
   * Analyze sentiment of conversation
   */
  private analyzeSentiment(
    messages: Array<{ role: string; content: string }>
  ): { emotion: string; score: number } {
    const positiveWords = [
      "love", "happy", "great", "awesome", "wonderful", "amazing", "excellent",
      "fantastic", "brilliant", "perfect", "good", "nice", "lovely", "appreciate"
    ];
    const negativeWords = [
      "hate", "sad", "bad", "terrible", "awful", "horrible", "poor", "angry",
      "upset", "disappointed", "frustrated", "worried", "scared", "anxious"
    ];
    const excitedWords = [
      "excited", "thrilled", "awesome", "can't wait", "amazing", "fantastic",
      "wonderful", "incredible", "unbelievable"
    ];

    let positiveCount = 0;
    let negativeCount = 0;
    let excitedCount = 0;

    const allText = messages.map(m => m.content).join(" ").toLowerCase();

    for (const word of positiveWords) {
      const matches = allText.match(new RegExp(word, "g"));
      positiveCount += matches?.length || 0;
    }

    for (const word of negativeWords) {
      const matches = allText.match(new RegExp(word, "g"));
      negativeCount += matches?.length || 0;
    }

    for (const word of excitedWords) {
      const matches = allText.match(new RegExp(word, "g"));
      excitedCount += matches?.length || 0;
    }

    let emotion = "neutral";
    let score = 0;

    if (excitedCount > 0) {
      emotion = "excited";
      score = excitedCount / (positiveCount + negativeCount + excitedCount);
    } else if (negativeCount > positiveCount) {
      emotion = "negative";
      score = negativeCount / (positiveCount + negativeCount);
    } else if (positiveCount > negativeCount) {
      emotion = "positive";
      score = positiveCount / (positiveCount + negativeCount);
    }

    return { emotion, score };
  }

  /**
   * Extract key points from conversation
   */
  private extractKeyPoints(messages: Array<{ role: string; content: string }>): string[] {
    const keyPoints: string[] = [];
    const sentences = messages
      .map(m => m.content)
      .join(" ")
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 20)
      .slice(0, 5);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 200) {
        keyPoints.push(trimmed);
      }
    }

    return keyPoints;
  }

  /**
   * Extract action items mentioned in conversation
   */
  private extractActionItems(messages: Array<{ role: string; content: string }>): string[] {
    const actionPatterns = [
      { pattern: /(?:need to|should|must|will|gonna|going to|plan to)\s+([^.!?]*)/gi, prefix: "Action: " },
      { pattern: /(?:reminder:?|remember:?|don't forget:?)\s+([^.!?]*)/gi, prefix: "Reminder: " },
      { pattern: /(?:todo:?|task:?|do:?)\s+([^.!?]*)/gi, prefix: "Task: " },
    ];

    const actions: string[] = [];
    const allText = messages.map(m => m.content).join(" ");

    for (const { pattern, prefix } of actionPatterns) {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const action = match[1]?.trim();
        if (action && action.length > 5 && action.length < 100) {
          actions.push(prefix + action);
        }
      }
    }

    return [...new Set(actions)].slice(0, 5);
  }
}

export const memorySummarizer = new MemorySummarizer();
