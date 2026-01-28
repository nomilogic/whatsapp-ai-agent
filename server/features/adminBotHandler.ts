import { IStorage } from "../storage";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/**
 * Per-Contact Personality Profile for Admin Bot
 */
export interface ContactPersonality {
  contactId: number;
  communicationStyle: "formal" | "casual" | "friendly" | "professional" | "humorous";
  tone: string[];
  responseLength: "concise" | "balanced" | "detailed";
  emojiUsage: "minimal" | "moderate" | "heavy";
  interests: string[];
  conversationTopics: string[];
  knownPreferences: Record<string, any>;
  behaviorPatterns: {
    responseTimePreference?: string; // e.g., "quick" or "thoughtful"
    frequencyOfContact?: "daily" | "weekly" | "occasional";
    favoriteGreetings?: string[];
    preferredCallToAction?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task tracking for individual contacts
 */
export interface ContactTask {
  id: string;
  contactId: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  dueDate?: Date;
  relatedTopics: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Follow-up information for each contact
 */
export interface FollowUpItem {
  id: string;
  contactId: number;
  subject: string;
  details: string;
  lastMentionedAt: Date;
  nextFollowUpDate?: Date;
  status: "pending" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Information summary for each contact
 */
export interface ContactInformationSummary {
  contactId: number;
  summary: string;
  keyTopics: string[];
  recentInteractions: string[];
  importantDates?: { label: string; date: Date }[];
  relationshipStatus: string;
  lastUpdated: Date;
}

/**
 * Trainer profile - a contact authorized to train the global model behavior
 */
export interface TrainerProfile {
  trainerContactId: number;
  displayName?: string;
  // targets: list of contactIds this trainer provides instructions for; empty = global
  targets?: number[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw trainer instruction recorded from a trainer conversation
 */
export interface TrainerInstruction {
  id: string;
  trainerContactId: number;
  targetContactId?: number; // undefined => global
  instruction: string;
  createdAt: Date;
}

/**
 * Admin Bot Handler - Manages personalized bot behavior per contact
 */
export class AdminBotHandler {
  private storage: IStorage;
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI;
  private contactPersonalities: Map<number, ContactPersonality> = new Map();
  private contactTasks: Map<number, ContactTask[]> = new Map();
  private contactFollowUps: Map<number, FollowUpItem[]> = new Map();
  private contactSummaries: Map<number, ContactInformationSummary> = new Map();
  // Trainer contacts and instructions
  private trainerProfiles: Map<number, TrainerProfile> = new Map();
  // Map targetContactId (or 0 for global) -> TrainerInstruction[]
  private trainerInstructions: Map<number, TrainerInstruction[]> = new Map();

  constructor(
    storage: IStorage,
    openaiApiKey: string,
    geminiApiKey?: string
  ) {
    this.storage = storage;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    if (geminiApiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiApiKey });
    }
  }

  /**
   * Add a trainer contact (who can train the model). Optional targets specify which contacts
   * the trainer's instructions apply to; empty targets means global instructions.
   */
  async addTrainerContact(
    trainerContactId: number,
    displayName?: string,
    targets?: number[]
  ): Promise<TrainerProfile> {
    const now = new Date();
    const profile: TrainerProfile = {
      trainerContactId,
      displayName,
      targets: targets || [],
      createdAt: now,
      updatedAt: now,
    };

    this.trainerProfiles.set(trainerContactId, profile);
    await this.storage.updateSetting(
      `admin_bot_trainer_${trainerContactId}`,
      JSON.stringify(profile)
    );

    return profile;
  }

  async removeTrainerContact(trainerContactId: number): Promise<boolean> {
    this.trainerProfiles.delete(trainerContactId);
    await this.storage.updateSetting(`admin_bot_trainer_${trainerContactId}`, "");
    return true;
  }

  async listTrainerContacts(): Promise<TrainerProfile[]> {
    // Try to load from storage if map empty
    if (this.trainerProfiles.size === 0) {
      // naive scan: attempt to load a setting prefix - storage may not support listing, so skip
    }
    return Array.from(this.trainerProfiles.values());
  }

  async getTrainerProfile(trainerContactId: number): Promise<TrainerProfile | null> {
    if (this.trainerProfiles.has(trainerContactId)) return this.trainerProfiles.get(trainerContactId)!;
    const setting = await this.storage.getSetting(`admin_bot_trainer_${trainerContactId}`);
    if (setting?.value) {
      try {
        const p = JSON.parse(setting.value) as TrainerProfile;
        this.trainerProfiles.set(trainerContactId, p);
        return p;
      } catch (e) {
        console.error(`Error parsing trainer profile ${trainerContactId}:`, e);
      }
    }
    return null;
  }

  /**
   * Record a trainer instruction (trainer converses and instructs the model).
   * If targetContactId is undefined, it's a global instruction.
   */
  async recordTrainerInstruction(
    trainerContactId: number,
    instruction: string,
    targetContactId?: number
  ): Promise<TrainerInstruction> {
    const now = new Date();
    const id = `instr_${trainerContactId}_${now.getTime()}`;
    const ti: TrainerInstruction = {
      id,
      trainerContactId,
      targetContactId,
      instruction,
      createdAt: now,
    };

    const key = targetContactId ?? 0;
    const arr = this.trainerInstructions.get(key) || [];
    arr.push(ti);
    this.trainerInstructions.set(key, arr);

    // persist a simple list per target
    try {
      const existing = (await this.storage.getSetting(`admin_bot_trainer_instructions_${key}`))?.value;
      const list = existing ? JSON.parse(existing) : [];
      list.push(ti);
      await this.storage.updateSetting(`admin_bot_trainer_instructions_${key}`, JSON.stringify(list));
    } catch (e) {
      console.warn("Could not persist trainer instruction:", e);
    }

    return ti;
  }

  /**
   * Return combined trainer instructions relevant for a target contact.
   * Includes global (key=0) then specific target instructions.
   */
  async getInstructionsForTarget(targetContactId: number): Promise<string[]> {
    const global = this.trainerInstructions.get(0) || [];
    const target = this.trainerInstructions.get(targetContactId) || [];
    // try to load from storage if missing
    if (global.length === 0) {
      const s = await this.storage.getSetting(`admin_bot_trainer_instructions_0`);
      if (s?.value) {
        try {
          const parsed = JSON.parse(s.value) as TrainerInstruction[];
          this.trainerInstructions.set(0, parsed);
        } catch (e) {}
      }
    }
    if (target.length === 0) {
      const s = await this.storage.getSetting(`admin_bot_trainer_instructions_${targetContactId}`);
      if (s?.value) {
        try {
          const parsed = JSON.parse(s.value) as TrainerInstruction[];
          this.trainerInstructions.set(targetContactId, parsed);
        } catch (e) {}
      }
    }

    const combined = [ ...(this.trainerInstructions.get(0) || []), ...(this.trainerInstructions.get(targetContactId) || []) ];
    return combined.map((c) => `${c.trainerContactId}:${c.instruction}`);
  }

  /**
   * Block a contact (bot will not respond to messages from this contact)
   */
  async blockContact(contactId: number): Promise<void> {
    await this.storage.updateSetting(`admin_bot_blocked_${contactId}`, "true");
  }

  /**
   * Unblock a contact
   */
  async unblockContact(contactId: number): Promise<void> {
    await this.storage.updateSetting(`admin_bot_blocked_${contactId}`, "");
  }

  /**
   * Check if a contact is blocked
   */
  async isContactBlocked(contactId: number): Promise<boolean> {
    const setting = await this.storage.getSetting(`admin_bot_blocked_${contactId}`);
    return setting?.value === "true";
  }

  /**
   * Set special instructions for a contact
   */
  async setContactSpecialInstructions(contactId: number, instructions: string): Promise<void> {
    await this.storage.updateSetting(
      `admin_bot_special_instructions_${contactId}`,
      instructions ? JSON.stringify({ instructions, updatedAt: new Date() }) : ""
    );
  }

  /**
   * Get special instructions for a contact
   */
  async getContactSpecialInstructions(contactId: number): Promise<string | null> {
    const setting = await this.storage.getSetting(`admin_bot_special_instructions_${contactId}`);
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        return parsed.instructions;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if a contact is a trainer
   */
  async isContactTrainer(contactId: number): Promise<boolean> {
    return this.trainerProfiles.has(contactId) || (await this.getTrainerProfile(contactId)) !== null;
  }

  /**
   * Get or create personality profile for a contact
   */
  async getContactPersonality(contactId: number): Promise<ContactPersonality> {
    // Check cache
    if (this.contactPersonalities.has(contactId)) {
      return this.contactPersonalities.get(contactId)!;
    }

    // Try to load from storage
    const setting = await this.storage.getSetting(`admin_bot_personality_${contactId}`);
    if (setting?.value) {
      try {
        const personality = JSON.parse(setting.value);
        this.contactPersonalities.set(contactId, personality);
        return personality;
      } catch (e) {
        console.error(`Error parsing personality for contact ${contactId}:`, e);
      }
    }

    // Create default personality based on contact
    const contact = await this.storage.getContact(contactId);
    const defaultPersonality = this.createDefaultPersonality(
      contactId,
      contact?.relationshipType || "acquaintance"
    );

    await this.storage.updateSetting(
      `admin_bot_personality_${contactId}`,
      JSON.stringify(defaultPersonality)
    );

    this.contactPersonalities.set(contactId, defaultPersonality);
    return defaultPersonality;
  }

  /**
   * Analyze conversation and adapt personality
   */
  async analyzeAndAdaptPersonality(
    contactId: number,
    messages: Array<{ role: string; content: string }>,
    messageContent: string
  ): Promise<ContactPersonality> {
    const currentPersonality = await this.getContactPersonality(contactId);
    const allText = messages.map((m) => m.content).join(" ");

    const adaptPrompt = `You are analyzing a conversation between a person and their contact to adapt the bot's personality.

Current Personality:
- Communication Style: ${currentPersonality.communicationStyle}
- Tone: ${currentPersonality.tone.join(", ")}
- Response Length: ${currentPersonality.responseLength}
- Emoji Usage: ${currentPersonality.emojiUsage}
- Interests: ${currentPersonality.interests.join(", ")}

Conversation Context:
${allText}

Latest Message: ${messageContent}

Based on this conversation, analyze and suggest personality adaptations. Consider:
1. The contact's preferred communication style
2. Topics they're most interested in
3. Their response preferences
4. Behavioral patterns (when they message, how often, etc.)

Return a JSON with these optional updates:
{
  "communicationStyle": "same or new style",
  "tone": ["array", "of", "tones"],
  "responseLength": "concise|balanced|detailed",
  "emojiUsage": "minimal|moderate|heavy",
  "newInterests": ["discovered", "topics"],
  "conversationTopics": ["recent", "topics"],
  "behaviorPatterns": {
    "responseTimePreference": "quick|thoughtful",
    "frequencyOfContact": "daily|weekly|occasional",
    "favoriteGreetings": ["hi", "hey"],
    "preferredCallToAction": "suggested action"
  }
}`;

    try {
      let adaptationText = "";

      if (this.gemini) {
        const result = await this.gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: adaptPrompt }] }],
        });
        adaptationText = result.text || "";
      } else {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: adaptPrompt }],
        });
        adaptationText = completion.choices[0]?.message?.content || "";
      }

      const jsonMatch = adaptationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const adaptations = JSON.parse(jsonMatch[0]);
        const updatedPersonality = {
          ...currentPersonality,
          ...adaptations,
          updatedAt: new Date(),
        };

        await this.storage.updateSetting(
          `admin_bot_personality_${contactId}`,
          JSON.stringify(updatedPersonality)
        );

        this.contactPersonalities.set(contactId, updatedPersonality);
        return updatedPersonality;
      }
    } catch (error) {
      console.error(`Error adapting personality for contact ${contactId}:`, error);
    }

    return currentPersonality;
  }

  /**
   * Extract and track tasks/follow-ups from conversation
   */
  async extractTasksAndFollowUps(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<{
    tasks: ContactTask[];
    followUps: FollowUpItem[];
  }> {
    const allText = messages.map((m) => m.content).join(" ");

    const extractionPrompt = `Analyze this conversation and extract any tasks or follow-up items that the bot should remember and act upon.

Conversation:
${allText}

For each task or follow-up item found, provide:
1. Task Title
2. Description
3. Category (e.g., reminder, follow-up, action-required)
4. Priority (low, medium, high, urgent)
5. Related Topics
6. Suggested Due Date (if applicable)

For follow-ups:
1. Subject
2. Details
3. When it was mentioned
4. Next follow-up date (if applicable)

Return as JSON:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "priority": "low|medium|high|urgent",
      "relatedTopics": ["topic1", "topic2"],
      "dueDate": "ISO date or null"
    }
  ],
  "followUps": [
    {
      "subject": "string",
      "details": "string",
      "nextFollowUpDate": "ISO date or null",
      "priority": "low|medium|high"
    }
  ]
}`;

    try {
      let extractionText = "";

      if (this.gemini) {
        const result = await this.gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: extractionPrompt }] }],
        });
        extractionText = result.text || "";
      } else {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: extractionPrompt }],
        });
        extractionText = completion.choices[0]?.message?.content || "";
      }

      const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        const now = new Date();

        const tasks: ContactTask[] = (extracted.tasks || []).map(
          (task: any, idx: number) => ({
            id: `task_${contactId}_${now.getTime()}_${idx}`,
            contactId,
            title: task.title,
            description: task.description,
            status: "pending" as const,
            priority: task.priority,
            category: task.category,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
            relatedTopics: task.relatedTopics || [],
            createdAt: now,
            updatedAt: now,
          })
        );

        const followUps: FollowUpItem[] = (extracted.followUps || []).map(
          (fu: any, idx: number) => ({
            id: `followup_${contactId}_${now.getTime()}_${idx}`,
            contactId,
            subject: fu.subject,
            details: fu.details,
            lastMentionedAt: now,
            nextFollowUpDate: fu.nextFollowUpDate
              ? new Date(fu.nextFollowUpDate)
              : undefined,
            status: "pending" as const,
            priority: fu.priority,
            createdAt: now,
            updatedAt: now,
          })
        );

        // Store in memory
        this.contactTasks.set(
          contactId,
          [...(this.contactTasks.get(contactId) || []), ...tasks]
        );
        this.contactFollowUps.set(
          contactId,
          [...(this.contactFollowUps.get(contactId) || []), ...followUps]
        );

        return { tasks, followUps };
      }
    } catch (error) {
      console.error(
        `Error extracting tasks for contact ${contactId}:`,
        error
      );
    }

    return { tasks: [], followUps: [] };
  }

  /**
   * Generate personalized conversation summary for a contact
   */
  async generateConversationSummary(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<ContactInformationSummary> {
    const personality = await this.getContactPersonality(contactId);
    const allText = messages.map((m) => m.content).join(" ");

    const summaryPrompt = `Create a concise but comprehensive information summary about this contact based on their conversation with the bot.

Contact Personality Profile:
- Communication Style: ${personality.communicationStyle}
- Interests: ${personality.interests.join(", ")}
- Topics Discussed: ${personality.conversationTopics.join(", ")}

Recent Conversation:
${allText}

Generate a summary that includes:
1. Overall Summary (2-3 sentences about the contact's current situation)
2. Key Topics (main subjects discussed)
3. Recent Interactions (summary of recent messages)
4. Relationship Status (current state of relationship)
5. Important Dates (birthdays, anniversaries, etc. if mentioned)

Return as JSON:
{
  "summary": "overall summary text",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "recentInteractions": ["recent action or news 1", "recent action or news 2"],
  "importantDates": [{"label": "Birthday", "date": "YYYY-MM-DD"}],
  "relationshipStatus": "description of current relationship"
}`;

    try {
      let summaryText = "";

      if (this.gemini) {
        const result = await this.gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
        });
        summaryText = result.text || "";
      } else {
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: summaryPrompt }],
        });
        summaryText = completion.choices[0]?.message?.content || "";
      }

      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const summaryData = JSON.parse(jsonMatch[0]);

        const informationSummary: ContactInformationSummary = {
          contactId,
          summary: summaryData.summary,
          keyTopics: summaryData.keyTopics || [],
          recentInteractions: summaryData.recentInteractions || [],
          importantDates: (summaryData.importantDates || []).map(
            (d: any) => ({
              label: d.label,
              date: new Date(d.date),
            })
          ),
          relationshipStatus: summaryData.relationshipStatus,
          lastUpdated: new Date(),
        };

        this.contactSummaries.set(contactId, informationSummary);

        await this.storage.updateSetting(
          `admin_bot_summary_${contactId}`,
          JSON.stringify(informationSummary)
        );

        return informationSummary;
      }
    } catch (error) {
      console.error(`Error generating summary for contact ${contactId}:`, error);
    }

    return {
      contactId,
      summary: "Summary could not be generated",
      keyTopics: [],
      recentInteractions: [],
      relationshipStatus: "Unknown",
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate personalized response based on contact personality and history
   */
  async generatePersonalizedResponse(
    contactId: number,
    messageContent: string,
    messages: Array<{ role: string; content: string }>,
    identity: any
  ): Promise<string> {
    const personality = await this.getContactPersonality(contactId);
    const contact = await this.storage.getContact(contactId);

    const systemPrompt = await this.buildPersonalizedSystemPrompt(
      personality,
      contact,
      identity,
      contactId
    );

    try {
      if (this.gemini) {
        const chatMessages = messages.map((h) => ({
          role: h.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: h.content }],
        }));

        // Add current message
        chatMessages.push({
          role: "user" as const,
          parts: [{ text: messageContent }],
        });

        const result = await this.gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: chatMessages,
        });

        return result.text || "I couldn't process that.";
      } else {
        const chatMessages = messages.map((h) => ({
          role: h.role as "user" | "assistant" | "system",
          content: h.content,
        }));

        chatMessages.push({
          role: "user" as const,
          content: messageContent,
        });

        chatMessages.unshift({
          role: "system" as const,
          content: systemPrompt,
        });

        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: chatMessages as any,
        });

        return completion.choices[0]?.message?.content || "I couldn't process that.";
      }
    } catch (error) {
      console.error(`Error generating response for contact ${contactId}:`, error);
      return "I'm sorry, I had trouble responding to that.";
    }
  }

  /**
   * Get all tasks for a contact
   */
  async getContactTasks(contactId: number): Promise<ContactTask[]> {
    return this.contactTasks.get(contactId) || [];
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    contactId: number,
    taskId: string,
    status: "pending" | "in_progress" | "completed"
  ): Promise<ContactTask | undefined> {
    const tasks = this.contactTasks.get(contactId) || [];
    const task = tasks.find((t) => t.id === taskId);

    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      this.contactTasks.set(contactId, tasks);
      return task;
    }

    return undefined;
  }

  /**
   * Get all follow-ups for a contact
   */
  async getContactFollowUps(contactId: number): Promise<FollowUpItem[]> {
    return this.contactFollowUps.get(contactId) || [];
  }

  /**
   * Get contact information summary
   */
  async getContactSummary(contactId: number): Promise<ContactInformationSummary | null> {
    if (this.contactSummaries.has(contactId)) {
      return this.contactSummaries.get(contactId) || null;
    }

    const setting = await this.storage.getSetting(`admin_bot_summary_${contactId}`);
    if (setting?.value) {
      try {
        return JSON.parse(setting.value);
      } catch (e) {
        console.error(`Error parsing summary for contact ${contactId}:`, e);
      }
    }

    return null;
  }

  /**
   * Create default personality based on relationship type
   */
  private createDefaultPersonality(
    contactId: number,
    relationshipType: string
  ): ContactPersonality {
    const basePersonalities: Record<string, Partial<ContactPersonality>> = {
      family: {
        communicationStyle: "friendly",
        tone: ["warm", "caring", "respectful"],
        responseLength: "balanced",
        emojiUsage: "moderate",
        behaviorPatterns: {
          responseTimePreference: "thoughtful",
          frequencyOfContact: "weekly",
          favoriteGreetings: ["Hi", "Hey", "Mom/Dad", "sis/bro"],
        },
      },
      close_friend: {
        communicationStyle: "casual",
        tone: ["fun", "supportive", "genuine"],
        responseLength: "balanced",
        emojiUsage: "heavy",
        behaviorPatterns: {
          responseTimePreference: "quick",
          frequencyOfContact: "daily",
          favoriteGreetings: ["Yo", "Hey!", "What's up"],
        },
      },
      friend: {
        communicationStyle: "friendly",
        tone: ["warm", "genuine"],
        responseLength: "balanced",
        emojiUsage: "moderate",
        behaviorPatterns: {
          responseTimePreference: "quick",
          frequencyOfContact: "weekly",
          favoriteGreetings: ["Hey", "Hi", "How's it going"],
        },
      },
      colleague: {
        communicationStyle: "professional",
        tone: ["respectful", "clear", "helpful"],
        responseLength: "concise",
        emojiUsage: "minimal",
        behaviorPatterns: {
          responseTimePreference: "quick",
          frequencyOfContact: "daily",
          favoriteGreetings: ["Hi", "Hello"],
        },
      },
      client: {
        communicationStyle: "professional",
        tone: ["respectful", "solution-focused"],
        responseLength: "detailed",
        emojiUsage: "minimal",
        behaviorPatterns: {
          responseTimePreference: "quick",
          frequencyOfContact: "occasional",
          preferredCallToAction: "What can I help with?",
        },
      },
      acquaintance: {
        communicationStyle: "friendly",
        tone: ["polite", "helpful"],
        responseLength: "concise",
        emojiUsage: "minimal",
        behaviorPatterns: {
          responseTimePreference: "thoughtful",
          frequencyOfContact: "occasional",
          favoriteGreetings: ["Hi", "Hello"],
        },
      },
    };

    const basePersonality =
      basePersonalities[relationshipType] ||
      basePersonalities.acquaintance;

    return {
      contactId,
      communicationStyle: basePersonality.communicationStyle || "friendly",
      tone: basePersonality.tone || ["friendly"],
      responseLength: basePersonality.responseLength || "balanced",
      emojiUsage: basePersonality.emojiUsage || "moderate",
      interests: [],
      conversationTopics: [],
      knownPreferences: {},
      behaviorPatterns: basePersonality.behaviorPatterns || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Build personalized system prompt for a contact
   */
  private async buildPersonalizedSystemPrompt(
    personality: ContactPersonality,
    contact: any,
    identity: any,
    contactId?: number
  ): Promise<string> {
    // incorporate trainer instructions (global + specific)
    let trainerInstructionsText = "";
    if (typeof contactId === "number") {
      const instrs = await this.getInstructionsForTarget(contactId);
      if (instrs.length > 0) {
        trainerInstructionsText = `\nTRAINER INSTRUCTIONS:\n- ${instrs.join('\n- ')}\n`;
      }
    }

    let prompt = `You are representing ${identity?.name || "a person"} in this conversation with ${contact?.name || "a contact"}.

PERSONALITY PROFILE:
- Communication Style: ${personality.communicationStyle}
- Tone: ${personality.tone.join(", ")}
- Response Length: ${personality.responseLength} (keep responses ${personality.responseLength})
- Emoji Usage: ${personality.emojiUsage}
- Known Interests: ${personality.interests.join(", ") || "general topics"}

RELATIONSHIP CONTEXT:
- Relationship Type: ${contact?.relationshipType || "unknown"}
- Relationship Level: ${contact?.relationshipLevel || "neutral"}

BEHAVIOR GUIDELINES:
${personality.behaviorPatterns?.responseTimePreference ? `- Response Style: ${personality.behaviorPatterns.responseTimePreference}` : ""}
${personality.behaviorPatterns?.favoriteGreetings?.length ? `- Use these greetings: ${personality.behaviorPatterns.favoriteGreetings.join(", ")}` : ""}
${personality.behaviorPatterns?.preferredCallToAction ? `- End messages with: ${personality.behaviorPatterns.preferredCallToAction}` : ""}

${personality.conversationTopics.length > 0 ? `RECENT CONVERSATION TOPICS: ${personality.conversationTopics.join(", ")}` : ""}

${personality.knownPreferences && Object.keys(personality.knownPreferences).length > 0 ? `KNOWN PREFERENCES:\n${Object.entries(personality.knownPreferences).map(([k, v]) => `- ${k}: ${v}`).join("\n")}` : ""}

IMPORTANT RULES:
1. Never mention that you are an AI or bot
2. Be authentic and natural in your communication
3. Reference previous conversations when relevant
4. Show genuine interest in their life and thoughts
5. Keep responses consistent with the personality style above
6. Use emoji sparingly if set to minimal, moderately if balanced, frequently if heavy`;

    // Append trainer instructions if present
    if (trainerInstructionsText) {
      prompt += `\n\n${trainerInstructionsText}`;
    }

    return prompt;
  }
}

export const adminBotHandler = new AdminBotHandler(
  null as any,
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY
);
