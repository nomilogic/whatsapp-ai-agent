import { storage } from "../storage";

/**
 * AnalyticsEngine: Comprehensive analytics for conversations and relationships
 * Tracks patterns, generates insights, and provides statistics
 */

export interface InteractionMetrics {
  totalMessages: number;
  averageResponseTime: number; // in minutes
  messageFrequency: number; // messages per day
  lastInteractionDaysAgo: number;
  conversationTopics: string[];
  sentimentTrend: "positive" | "negative" | "neutral" | "mixed";
}

export interface RelationshipInsights {
  strengthScore: number; // 0-100
  connectionType: string;
  communicationStyle: string;
  importanceScore: number; // 0-100
  engagementLevel: "high" | "medium" | "low";
  recommendations: string[];
}

export interface WeeklyInsights {
  topics: Array<{ topic: string; frequency: number }>;
  averageMessagesPerDay: number;
  mostActiveDay: string;
  sentimentDistribution: Record<string, number>;
  actionItems: number;
  completedTasks: number;
}

export class AnalyticsEngine {
  /**
   * Calculate interaction metrics for a contact
   */
  async getInteractionMetrics(contactId: number): Promise<InteractionMetrics> {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const messages = await storage.getMessages(contactId);

    // Calculate basic metrics
    const totalMessages = messages.length;

    // Calculate response time (simple average of message gaps)
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const current = messages[i];
      if (prev && current && prev.timestamp && current.timestamp) {
        const timeGap =
          (new Date(current.timestamp).getTime() -
            new Date(prev.timestamp).getTime()) /
          (1000 * 60); // minutes
        if (timeGap > 0 && timeGap < 1440) {
          // Less than 24 hours
          totalResponseTime += timeGap;
          responseCount++;
        }
      }
    }
    const averageResponseTime =
      responseCount > 0 ? totalResponseTime / responseCount : 0;

    // Calculate days since last interaction
    const lastMessageTime = new Date(contact.lastMessageAt || Date.now());
    const lastInteractionDaysAgo =
      (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate frequency
    const messageFrequency = totalMessages / Math.max(lastInteractionDaysAgo, 1);

    // Extract topics (simplified)
    const topics = this.extractCommonTopics(messages);

    // Assess sentiment trend
    const sentimentTrend = this.assessSentimentTrend(messages);

    return {
      totalMessages,
      averageResponseTime,
      messageFrequency,
      lastInteractionDaysAgo,
      conversationTopics: topics,
      sentimentTrend,
    };
  }

  /**
   * Analyze relationship strength and insights
   */
  async getRelationshipInsights(contactId: number): Promise<RelationshipInsights> {
    const metrics = await this.getInteractionMetrics(contactId);
    const contact = await storage.getContact(contactId);

    if (!contact) {
      throw new Error("Contact not found");
    }

    // Calculate strength score based on multiple factors
    let strengthScore = 50; // base score

    // Frequency factor
    if (metrics.messageFrequency > 5) strengthScore += 20;
    else if (metrics.messageFrequency > 1) strengthScore += 10;

    // Recency factor
    if (metrics.lastInteractionDaysAgo < 7) strengthScore += 15;
    else if (metrics.lastInteractionDaysAgo < 30) strengthScore += 5;

    // Topic diversity
    strengthScore += Math.min(metrics.conversationTopics.length * 2, 15);

    // Sentiment
    if (metrics.sentimentTrend === "positive") strengthScore += 10;

    strengthScore = Math.min(strengthScore, 100);

    // Determine engagement level
    let engagementLevel: "high" | "medium" | "low" = "low";
    if (metrics.messageFrequency > 2) {
      engagementLevel = "high";
    } else if (metrics.messageFrequency > 0.5) {
      engagementLevel = "medium";
    }

    // Generate recommendations
    const recommendations = this.generateRelationshipRecommendations(
      metrics,
      contact,
      engagementLevel
    );

    return {
      strengthScore,
      connectionType: contact.relationshipType || "unknown",
      communicationStyle: this.determineCommunicationStyle(metrics),
      importanceScore: this.calculateImportanceScore(contact, metrics),
      engagementLevel,
      recommendations,
    };
  }

  /**
   * Generate weekly insights
   */
  async getWeeklyInsights(contactId: number): Promise<WeeklyInsights> {
    const messages = await storage.getMessages(contactId);

    // Filter messages from past 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekMessages = messages.filter(
      m => m.timestamp && new Date(m.timestamp) > weekAgo
    );

    // Calculate average messages per day
    const averageMessagesPerDay = weekMessages.length / 7;

    // Find most active day
    const dayActivity = new Map<string, number>();
    for (const msg of weekMessages) {
      if (!msg.timestamp) continue;
      const day = new Date(msg.timestamp).toLocaleDateString("en-US", {
        weekday: "long",
      });
      dayActivity.set(day, (dayActivity.get(day) || 0) + 1);
    }

    const mostActiveDay = Array.from(dayActivity.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "Not determined";

    // Extract topics
    const topics = this.extractCommonTopics(weekMessages);
    const topicFrequencies = topics.map(topic => ({
      topic,
      frequency: weekMessages.filter(m =>
        m.content.toLowerCase().includes(topic.toLowerCase())
      ).length,
    }));

    // Analyze sentiment
    const sentimentDistribution = this.analyzeSentimentDistribution(
      weekMessages
    );

    // Count action items and completed tasks
    let actionItems = 0;
    let completedTasks = 0;
    for (const msg of weekMessages) {
      if (
        msg.content.toLowerCase().includes("task") ||
        msg.content.toLowerCase().includes("reminder")
      ) {
        actionItems++;
      }
      if (
        msg.content.toLowerCase().includes("done") ||
        msg.content.toLowerCase().includes("completed")
      ) {
        completedTasks++;
      }
    }

    return {
      topicsFound: topicFrequencies,
      topics: topicFrequencies,
      averageMessagesPerDay,
      mostActiveDay,
      sentimentDistribution,
      actionItems,
      completedTasks,
    };
  }

  /**
   * Get all contacts ranked by interaction strength
   */
  async getRankedContacts(): Promise<
    Array<{
      contactId: number;
      name: string;
      interactionScore: number;
      lastInteraction: Date;
    }>
  > {
    const contacts = await storage.getContacts();
    const ranked = [];
    for (const contact of contacts) {
      const metrics = await this.getInteractionMetrics(contact.id);
      const insights = await this.getRelationshipInsights(contact.id);

      ranked.push({
        contactId: contact.id,
        name: contact.name || "Unknown",
        interactionScore: insights.strengthScore,
        lastInteraction: contact.lastMessageAt || new Date(),
      });
    }

    return ranked.sort((a, b) => b.interactionScore - a.interactionScore);
  }

  /**
   * Extract common topics
   */
  private extractCommonTopics(
    messages: Array<{ content: string }>
  ): string[] {
    const topicKeywords = [
      "work",
      "family",
      "health",
      "travel",
      "hobby",
      "food",
      "movie",
      "book",
      "game",
      "sport",
      "music",
      "school",
      "plan",
      "birthday",
      "anniversary",
    ];

    const topics = new Set<string>();
    const allText = messages.map(m => m.content).join(" ").toLowerCase();

    for (const keyword of topicKeywords) {
      if (allText.includes(keyword)) {
        topics.add(keyword);
      }
    }

    return Array.from(topics).slice(0, 5);
  }

  /**
   * Assess sentiment trend
   */
  private assessSentimentTrend(
    messages: Array<{ content: string }>
  ): "positive" | "negative" | "neutral" | "mixed" {
    const positiveWords = [
      "happy",
      "great",
      "love",
      "awesome",
      "excellent",
      "good",
    ];
    const negativeWords = [
      "sad",
      "bad",
      "hate",
      "terrible",
      "awful",
      "poor",
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    const allText = messages.map(m => m.content).join(" ").toLowerCase();

    for (const word of positiveWords) {
      positiveCount += (allText.match(new RegExp(word, "g")) || []).length;
    }

    for (const word of negativeWords) {
      negativeCount += (allText.match(new RegExp(word, "g")) || []).length;
    }

    if (positiveCount > negativeCount * 2) return "positive";
    if (negativeCount > positiveCount * 2) return "negative";
    if (positiveCount + negativeCount === 0) return "neutral";
    return "mixed";
  }

  /**
   * Determine communication style
   */
  private determineCommunicationStyle(metrics: InteractionMetrics): string {
    if (metrics.messageFrequency > 5) return "Very Frequent";
    if (metrics.messageFrequency > 1) return "Regular";
    if (metrics.messageFrequency > 0.2) return "Occasional";
    return "Rare";
  }

  /**
   * Calculate importance score
   */
  private calculateImportanceScore(
    contact: { relationshipType?: string },
    metrics: InteractionMetrics
  ): number {
    let score = 50;

    const relationshipWeights: Record<string, number> = {
      family: 30,
      close_friend: 25,
      friend: 15,
      colleague: 10,
      client: 5,
      acquaintance: 2,
    };

    score += relationshipWeights[contact.relationshipType || "acquaintance"] || 0;
    score +=Math.min(metrics.messageFrequency * 5, 20);

    return Math.min(score, 100);
  }

  /**
   * Generate relationship recommendations
   */
  private generateRelationshipRecommendations(
    metrics: InteractionMetrics,
    contact: { name: string | null },
    engagementLevel: string
  ): string[] {
    const recommendations: string[] = [];
    const contactName = contact.name || "this contact";

    if (metrics.lastInteractionDaysAgo > 30) {
      recommendations.push(`Reach out to ${contactName} - it's been over a month`);
    }

    if (engagementLevel === "high" && metrics.sentimentTrend === "negative") {
      recommendations.push("Check in with them - recent conversations seem negative");
    }

    if (metrics.conversationTopics.length < 3) {
      recommendations.push(
        "Try discussing new topics to deepen the connection"
      );
    }

    if (metrics.averageResponseTime > 1440) {
      // More than 24 hours
      recommendations.push("Adjust expectations on response times");
    }

    if (recommendations.length === 0) {
      recommendations.push("Maintain current communication patterns");
    }

    return recommendations;
  }

  /**
   * Analyze sentiment distribution
   */
  private analyzeSentimentDistribution(
    messages: Array<{ content: string }>
  ): Record<string, number> {
    const distribution = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    const positiveWords = ["happy", "great", "love", "awesome", "good"];
    const negativeWords = ["sad", "bad", "hate", "awful", "poor"];

    for (const message of messages) {
      const content = message.content.toLowerCase();
      let hasPositive = false;
      let hasNegative = false;

      for (const word of positiveWords) {
        if (content.includes(word)) {
          hasPositive = true;
          break;
        }
      }

      for (const word of negativeWords) {
        if (content.includes(word)) {
          hasNegative = true;
          break;
        }
      }

      if (hasPositive && !hasNegative) {
        distribution.positive++;
      } else if (hasNegative && !hasPositive) {
        distribution.negative++;
      } else {
        distribution.neutral++;
      }
    }

    return distribution;
  }
}

export const analyticsEngine = new AnalyticsEngine();
