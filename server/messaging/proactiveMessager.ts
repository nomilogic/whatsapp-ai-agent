import { storage } from "../storage";

/**
 * ProactiveMessager: Handles intelligent, context-aware proactive messaging
 * Schedules messages based on relationships and communication patterns
 */

export interface CommunicationFrequency {
  baseIntervalHours: number;
  variationPercent: number;
  optimalTimes?: string[]; // e.g., ["09:00-12:00", "18:00-21:00"]
}

const frequencyProfiles: Record<string, CommunicationFrequency> = {
  very_high: { baseIntervalHours: 8, variationPercent: 20, optimalTimes: ["09:00-23:00"] },
  high: { baseIntervalHours: 24, variationPercent: 30, optimalTimes: ["09:00-21:00"] },
  medium: { baseIntervalHours: 48, variationPercent: 40 },
  low: { baseIntervalHours: 72, variationPercent: 50 },
  minimal: { baseIntervalHours: 168, variationPercent: 60 }, // weekly
};

export class ProactiveMessager {
  /**
   * Determine if should send proactive message
   */
  async shouldSendProactiveMessage(
    contactId: number
  ): Promise<{
    should: boolean;
    reason?: string;
    suggestedMessage?: string;
  }> {
    const contact = await storage.getContact(contactId);
    if (!contact) {
      return { should: false, reason: "Contact not found" };
    }

    // Check if manual control is active
    const manualControl = await storage.getSetting("manual_control");
    if (manualControl?.value === "true") {
      return { should: false, reason: "Manual control active" };
    }

    // Check communication frequency
    const frequency = contact.relationshipType || "medium";
    const profile = frequencyProfiles[frequency] || frequencyProfiles.medium;

    // Get last interaction
    const lastMessageTime = new Date(contact.lastMessageAt || 0);
    const hoursSinceLastMessage =
      (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage < profile.baseIntervalHours * 0.8) {
      return { should: false, reason: "Too soon after last message" };
    }

    // Check if it's optimal time
    if (profile.optimalTimes) {
      const isOptimalTime = this.isInOptimalTimeWindow(profile.optimalTimes);
      if (!isOptimalTime) {
        return { should: false, reason: "Outside optimal messaging window" };
      }
    }

    // Generate message suggestion
    const suggestedMessage = await this.generateProactiveMessage(contactId);

    return {
      should: true,
      reason: "Ready for proactive engagement",
      suggestedMessage,
    };
  }

  /**
   * Generate a contextual proactive message
   */
  private async generateProactiveMessage(contactId: number): Promise<string> {
    const contact = await storage.getContact(contactId);
    if (!contact) return "Hi! How are you doing?";

    // Get recent memories and tasks
    const memories = await storage.getMessages(contactId);

    const suggestions = [
      `Hey ${contact.name}! How's everything going?`,
      `I was just thinking about you, ${contact.name}. How have you been?`,
      `Hope you're doing well, ${contact.name}! Anything new?`,
      `Just wanted to check in. How are things with you?`,
      `It's been a bit! How have you been, ${contact.name}?`,
    ];

    // Select random suggestion
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /**
   * Check if current time is in optimal window
   */
  private isInOptimalTimeWindow(optimalTimes: string[]): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 100 + currentMinutes; // HHMM format

    for (const window of optimalTimes) {
      const [start, end] = window.split("-").map(t => {
        const [h, m] = t.split(":").map(Number);
        return h * 100 + m;
      });

      if (currentTime >= start && currentTime <= end) {
        return true;
      }
    }

    return false;
  }

  /**
   * Schedule proactive messages for all active contacts
   */
  async scheduleProactiveMessages(): Promise<{
    scheduled: number;
    total: number;
  }> {
    const contacts = await storage.getContacts();
    let scheduledCount = 0;

    for (const contact of contacts) {
      const { should } = await this.shouldSendProactiveMessage(contact.id);
      if (should) {
        // In production, this would actually schedule the message
        // For now, just count it
        scheduledCount++;
      }
    }

    return { scheduled: scheduledCount, total: contacts.length };
  }

  /**
   * Get messaging strategy for relationship type
   */
  getMessagingStrategy(
    relationshipType: string
  ): {
    tone: string;
    frequency: CommunicationFrequency;
    topics: string[];
    avoidTopics: string[];
  } {
    const strategies: Record<
      string,
      {
        tone: string;
        frequency: CommunicationFrequency;
        topics: string[];
        avoidTopics: string[];
      }
    > = {
      family: {
        tone: "warm and personal",
        frequency: frequencyProfiles.high,
        topics: ["family updates", "celebrations", "support", "memories"],
        avoidTopics: ["money", "politics"],
      },
      close_friend: {
        tone: "casual and fun",
        frequency: frequencyProfiles.very_high,
        topics: ["jokes", "gossip", "plans", "recommendations"],
        avoidTopics: ["criticism"],
      },
      friend: {
        tone: "friendly and open",
        frequency: frequencyProfiles.high,
        topics: ["plans", "life updates", "interests", "support"],
        avoidTopics: ["complaints"],
      },
      colleague: {
        tone: "professional but warm",
        frequency: frequencyProfiles.medium,
        topics: ["work", "projects", "professional growth"],
        avoidTopics: ["personal criticism", "gossip"],
      },
      client: {
        tone: "professional and respectful",
        frequency: frequencyProfiles.low,
        topics: ["business", "updates", "offers"],
        avoidTopics: ["personal matters", "complaints"],
      },
      acquaintance: {
        tone: "polite and light",
        frequency: frequencyProfiles.minimal,
        topics: ["brief updates", "common interests"],
        avoidTopics: ["deep personal", "controversial"],
      },
    };

    return strategies[relationshipType] || strategies.acquaintance;
  }

  /**
   * Create contextual message based on relationship
   */
  async createContextualMessage(
    contactId: number,
    messageType: "greeting" | "check_in" | "follow_up" | "reminder"
  ): Promise<string> {
    const contact = await storage.getContact(contactId);
    if (!contact) return "Hi there!";

    const strategy = this.getMessagingStrategy(contact.relationshipType || "");

    const templates: Record<
      string,
      Record<string, (name: string) => string>
    > = {
      greeting: {
        family: (name: string) => `Hey ${name}! Missing you today 💙`,
        close_friend: (name: string) => `Yo ${name}! What's up? 😄`,
        friend: (name: string) => `Hey ${name}! How's it going?`,
        colleague: (name: string) => `Hi ${name}, hope you're well!`,
        client: (name: string) => `Hello ${name}, hope everything is good on your end.`,
        acquaintance: (name: string) => `Hi ${name}, how have you been?`,
      },
      check_in: {
        family: (name: string) => `Just checking in! How are you doing?`,
        close_friend: (name: string) => `Haven't heard from you in a bit! What's new?`,
        friend: (name: string) => `Want to catch up? Been a while!`,
        colleague: (name: string) => `Hope you're having a great week!`,
        client: (name: string) => `Following up to see how things are progressing.`,
        acquaintance: (name: string) => `Hope you're well!`,
      },
      follow_up: {
        family: (name: string) => `Did you get a chance to think about what we talked about?`,
        close_friend: (name: string) => `So about that plan... when are we doing it?`,
        friend: (name: string) => `Just wanted to follow up on what we discussed.`,
        colleague: (
          name: string
        ) => `Following up on our earlier conversation. Let me know your thoughts.`,
        client: (name: string) => `Wanted to check in on the status of the project.`,
        acquaintance: (name: string) => `Just following up!`,
      },
      reminder: {
        family: (name: string) => `Don't forget about this! Let me know when you're free.`,
        close_friend: (name: string) => `Reminder: don't forget! 😄`,
        friend: (name: string) => `Just a friendly reminder about our plans.`,
        colleague: (name: string) => `Quick reminder about the meeting tomorrow.`,
        client: (name: string) => `Reminder: your scheduled deadline is coming up.`,
        acquaintance: (name: string) => `Quick reminder!`,
      },
    };

    const categoryTemplates = templates[messageType] || templates.greeting;
    const relType = contact.relationshipType || "acquaintance";
    const template =
      categoryTemplates[relType] || categoryTemplates.acquaintance;

    return template(contact.name || "there");
  }
}

export const proactiveMessager = new ProactiveMessager();
