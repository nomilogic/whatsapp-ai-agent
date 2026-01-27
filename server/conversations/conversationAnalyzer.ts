import { taskManager, type Task } from "../tasks/taskManager";
import { memoryManager } from "../memory/memoryManager";

/**
 * ConversationAnalyzer: Analyzes conversations for actionable insights
 * Extracts tasks, categorizes conversations, and builds context
 */

export type ConversationCategory = 
  | "greeting"
  | "question"
  | "information"
  | "planning"
  | "problem"
  | "celebration"
  | "casual"
  | "formal"
  | "urgent";

export interface ConversationAnalysis {
  category: ConversationCategory;
  tasks: Task[];
  keywords: string[];
  sentiment: { emotion: string; score: number };
  actionRequired: boolean;
  summary: string;
}

export class ConversationAnalyzer {
  /**
   * Analyze a conversation thread
   */
  async analyzeConversation(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<ConversationAnalysis> {
    const allText = messages.map(m => m.content).join(" ");

    // Categorize conversation
    const category = this.categorizeConversation(allText);

    // Extract tasks
    const tasks = await taskManager.extractTasksFromConversation(
      contactId,
      messages
    );

    // Extract keywords
    const keywords = this.extractKeywords(allText);

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(allText);

    // Create summary
    const summary = this.summarizeConversation(messages);

    // Determine if action is required
    const actionRequired =
      tasks.length > 0 ||
      sentiment.emotion === "urgent" ||
      category === "problem";

    // Store conversation in memory
    await memoryManager.processConversation(contactId, messages);

    return {
      category,
      tasks,
      keywords,
      sentiment,
      actionRequired,
      summary,
    };
  }

  /**
   * Categorize conversation by type
   */
  private categorizeConversation(text: string): ConversationCategory {
    const patterns = [
      { keywords: ["hi", "hello", "hey", "good morning"], category: "greeting" as const },
      {
        keywords: ["how", "why", "when", "where", "what", "who", "can you"],
        category: "question" as const,
      },
      {
        keywords: ["telling you", "let me tell", "just wanted to share", "fyi"],
        category: "information" as const,
      },
      {
        keywords: ["plan", "schedule", "arrange", "organize", "meeting", "tomorrow", "next week"],
        category: "planning" as const,
      },
      { keywords: ["problem", "issue", "help", "urgent", "asap"], category: "problem" as const },
      {
        keywords: ["congratulations", "happy", "celebration", "birthday", "anniversary"],
        category: "celebration" as const,
      },
      {
        keywords: ["regarding", "formal", "please", "dear", "subject"],
        category: "formal" as const,
      },
      { keywords: ["urgent", "asap", "immediately", "now"], category: "urgent" as const },
    ];

    const textLower = text.toLowerCase();
    const scores: Record<string, number> = {};

    for (const { keywords, category } of patterns) {
      let score = 0;
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          score += textLower.split(keyword).length - 1;
        }
      }
      if (score > 0) {
        scores[category] = score;
      }
    }

    // Return highest scoring category
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return (best?.[0] || "casual") as ConversationCategory;
  }

  /**
   * Extract keywords from conversation
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "is", "was", "are", "be", "been", "have", "has", "had", "do",
      "does", "did", "will", "would", "could", "should", "may", "might",
    ]);

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    // Count word frequencies
    const frequencies: Record<string, number> = {};
    for (const word of words) {
      frequencies[word] = (frequencies[word] || 0) + 1;
    }

    // Get top keywords
    return Object.entries(frequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(text: string): { emotion: string; score: number } {
    const positiveTone = ["good", "great", "excellent", "happy", "love", "awesome"];
    const negativeTone = ["bad", "terrible", "hate", "sad", "awful", "disappointed"];
    const urgentTone = ["urgent", "asap", "immediately", "now", "critical"];

    let positiveScore = 0;
    let negativeScore = 0;
    let urgentScore = 0;

    const textLower = text.toLowerCase();

    for (const word of positiveTone) {
      positiveScore += (textLower.match(new RegExp(word, "g")) || []).length;
    }

    for (const word of negativeTone) {
      negativeScore += (textLower.match(new RegExp(word, "g")) || []).length;
    }

    for (const word of urgentTone) {
      urgentScore += (textLower.match(new RegExp(word, "g")) || []).length;
    }

    let emotion = "neutral";
    let score = 0;

    if (urgentScore > 0) {
      emotion = "urgent";
      score = urgentScore / (positiveScore + negativeScore + urgentScore + 1);
    } else if (negativeScore > positiveScore) {
      emotion = "negative";
      score = negativeScore / (positiveScore + negativeScore);
    } else if (positiveScore > 0) {
      emotion = "positive";
      score = positiveScore / (positiveScore + negativeScore);
    }

    return { emotion, score };
  }

  /**
   * Summarize conversation
   */
  private summarizeConversation(messages: Array<{ role: string; content: string }>): string {
    if (messages.length === 0) return "No messages";

    // Get first and last messages as context
    const firstMessage = messages[0].content;
    const lastMessage = messages[messages.length - 1].content;

    // Create a simple summary
    if (firstMessage.length + lastMessage.length < 200) {
      return `${firstMessage.substring(0, 80)}... → ${lastMessage.substring(0, 80)}...`;
    }

    return `Conversation with ${messages.length} messages about: ${firstMessage.substring(0, 60)}...`;
  }

  /**
   * Generate response suggestions based on analysis
   */
  async generateResponseSuggestion(
    analysis: ConversationAnalysis
  ): Promise<{
    tone: string;
    priority: string;
    suggestions: string[];
  }> {
    const suggestions: string[] = [];

    // Tone suggestion
    let tone = "casual";
    if (analysis.category === "formal" || analysis.category === "problem") {
      tone = "professional";
    } else if (analysis.category === "celebration") {
      tone = "warm";
    } else if (analysis.sentiment.emotion === "negative") {
      tone = "empathetic";
    }

    // Priority
    let priority = "normal";
    if (analysis.category === "urgent" || analysis.actionRequired) {
      priority = "high";
    }

    // Generate suggestions
    if (analysis.tasks.length > 0) {
      suggestions.push(`You have ${analysis.tasks.length} tasks to address`);
    }

    if (analysis.sentiment.emotion === "negative") {
      suggestions.push("This person seems upset - show empathy");
    } else if (analysis.sentiment.emotion === "positive") {
      suggestions.push("They seem happy - respond warmly");
    }

    if (analysis.category === "question") {
      suggestions.push("Provide clear and helpful answers");
    } else if (analysis.category === "planning") {
      suggestions.push("Confirm details and deadlines");
    }

    if (analysis.keywords.includes("help") || analysis.keywords.includes("problem")) {
      suggestions.push("Offer concrete assistance");
    }

    return { tone, priority, suggestions };
  }
}

export const conversationAnalyzer = new ConversationAnalyzer();
