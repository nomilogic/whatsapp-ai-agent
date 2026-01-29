import { IStorage } from "../storage";
import { getAIService } from "../services/aiService";

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
  private contactPersonalities: Map<number, ContactPersonality> = new Map();
  private contactTasks: Map<number, ContactTask[]> = new Map();
  private contactFollowUps: Map<number, FollowUpItem[]> = new Map();
  private contactSummaries: Map<number, ContactInformationSummary> = new Map();
  // Per-contact notes (appended from periodic summarization of recent messages)
  private contactNotes: Map<number, Array<{ id: string; summary: string; details?: string; createdAt: Date }>> = new Map();
  // Trainer contacts and instructions
  private trainerProfiles: Map<number, TrainerProfile> = new Map();
  // Map targetContactId (or 0 for global) -> TrainerInstruction[]
  private trainerInstructions: Map<number, TrainerInstruction[]> = new Map();
  // Task extraction debounce: contactId -> last extraction timestamp
  private lastTaskExtractionTime: Map<number, number> = new Map();
  // Only extract tasks once every 5 minutes (300000ms) per contact
  private readonly TASK_EXTRACTION_INTERVAL = 5 * 60 * 1000;
  // Personality analysis debounce: contactId -> last analysis timestamp
  private lastPersonalityAnalysisTime: Map<number, number> = new Map();
  // Only analyze personality once every 10 minutes per contact
  private readonly PERSONALITY_ANALYSIS_INTERVAL = 10 * 60 * 1000;
  // Conversation summary debounce: contactId -> last summary timestamp
  private lastConversationSummaryTime: Map<number, number> = new Map();
  // Only generate summary once every 15 minutes per contact
  private readonly CONVERSATION_SUMMARY_INTERVAL = 15 * 60 * 1000;

  constructor(storage: IStorage) {
    this.storage = storage;
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
   * Append notes for a contact and persist them.
   */
  async appendContactNotes(contactId: number, note: { summary: string; details?: string }): Promise<void> {
    const now = new Date();
    const id = `note_${contactId}_${now.getTime()}`;
    const entry = { id, summary: note.summary, details: note.details || "", createdAt: now };

    const arr = this.contactNotes.get(contactId) || [];
    arr.push(entry);
    this.contactNotes.set(contactId, arr);

    try {
      const existing = (await this.storage.getSetting(`admin_bot_notes_${contactId}`))?.value;
      const list = existing ? JSON.parse(existing) : [];
      list.push(entry);
      await this.storage.updateSetting(`admin_bot_notes_${contactId}`, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not persist contact notes:', e);
    }
  }

  /**
   * Retrieve stored notes for a contact.
   */
  async getContactNotes(contactId: number): Promise<Array<{ id: string; summary: string; details?: string; createdAt: Date }>> {
    if (this.contactNotes.has(contactId)) return this.contactNotes.get(contactId)!;
    try {
      const s = await this.storage.getSetting(`admin_bot_notes_${contactId}`);
      if (s?.value) {
        const parsed = JSON.parse(s.value) as Array<any>;
        const mapped = parsed.map(p => ({ id: p.id, summary: p.summary, details: p.details, createdAt: new Date(p.createdAt) }));
        this.contactNotes.set(contactId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Could not load contact notes from storage:', e);
    }
    return [];
  }

  /**
   * Append arbitrary raw data provided by trainer under a key.
   */
  async appendRawData(key: string, data: any): Promise<void> {
    try {
      const settingKey = `admin_bot_raw_${key}`;
      const existing = (await this.storage.getSetting(settingKey))?.value;
      const list = existing ? JSON.parse(existing) : [];
      list.push({ data, createdAt: new Date() });
      await this.storage.updateSetting(settingKey, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not persist raw data for key', key, e);
    }
  }

  /**
   * Retrieve raw data list by key.
   */
  async getRawData(key: string): Promise<any[]> {
    try {
      const settingKey = `admin_bot_raw_${key}`;
      const s = await this.storage.getSetting(settingKey);
      if (s?.value) return JSON.parse(s.value);
    } catch (e) {
      console.warn('Could not load raw data for key', key, e);
    }
    return [];
  }

  /**
   * Update core identity by merging provided updates into stored identity.
   */
  async updateCoreIdentity(updates: Partial<any>): Promise<any> {
    try {
      const current = await this.storage.getIdentity();
      const merged = {
        name: updates.name ?? current?.name ?? 'You',
        personalityTraits: updates.personalityTraits ?? current?.personalityTraits ?? {},
        values: updates.values ?? current?.values ?? [],
        interests: updates.interests ?? current?.interests ?? [],
        knowledgeDomains: updates.knowledgeDomains ?? current?.knowledgeDomains ?? [],
        dailySchedule: updates.dailySchedule ?? current?.dailySchedule ?? {},
        conversationRules: updates.conversationRules ?? current?.conversationRules ?? {},
      };

      await this.storage.updateIdentity(merged);
      return merged;
    } catch (e) {
      console.error('Error updating core identity:', e);
      throw e;
    }
  }

  /**
   * Parse and apply simple trainer identity commands sent as chat text.
   * Supported patterns:
   * - @IDENTITY set key=value
   * - @IDENTITY merge {json}
   * - @IDENTITY add_interest Topic
   * - @IDENTITY remove_interest Topic
   * - @RAW add <key> {json}
   */
  async applyTrainerIdentityCommand(trainerContactId: number, commandText: string): Promise<{ success: boolean; message: string }> {
    const trimmed = commandText.trim();
    try {
      // RAW add: @RAW add key {json}
      const rawMatch = trimmed.match(/^@RAW\s+add\s+(\S+)\s+([\s\S]+)$/i);
      if (rawMatch) {
        const key = rawMatch[1];
        const jsonText = rawMatch[2].trim();
        let parsed;
        try { parsed = JSON.parse(jsonText); } catch (_) { parsed = jsonText; }
        await this.appendRawData(key, parsed);
        return { success: true, message: `Raw data appended under key ${key}` };
      }

      // Merge JSON: @IDENTITY merge { ... }
      const mergeMatch = trimmed.match(/^@IDENTITY\s+merge\s+([\s\S]+)$/i);
      if (mergeMatch) {
        const jsonText = mergeMatch[1].trim();
        const parsed = JSON.parse(jsonText);
        const updated = await this.updateCoreIdentity(parsed);
        return { success: true, message: `Identity merged. Current name: ${updated.name}` };
      }

      // Set key=value: @IDENTITY set key=value
      const setMatch = trimmed.match(/^@IDENTITY\s+set\s+([^=\s]+)=(.+)$/i);
      if (setMatch) {
        const key = setMatch[1].trim();
        let value: any = setMatch[2].trim();
        // Try parse JSON for complex fields
        if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
          try { value = JSON.parse(value); } catch (e) {}
        }

        const current = await this.storage.getIdentity();
        const updates: any = {};
        if (['values', 'interests', 'knowledgeDomains'].includes(key)) {
          // comma separated
          const arr = typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : value;
          updates[key] = Array.isArray(arr) ? arr : [arr];
        } else if (['personalityTraits', 'dailySchedule', 'conversationRules'].includes(key)) {
          updates[key] = typeof value === 'string' ? JSON.parse(value) : value;
        } else if (key === 'name') {
          updates.name = String(value);
        } else {
          // fallback: try to set as top-level field
          updates[key] = value;
        }

        const updated = await this.updateCoreIdentity({ ...(current || {}), ...updates });
        return { success: true, message: `Identity updated. Current name: ${updated.name}` };
      }

      // add_interest: @IDENTITY add_interest Topic
      const addMatch = trimmed.match(/^@IDENTITY\s+add_interest\s+(.+)$/i);
      if (addMatch) {
        const topic = addMatch[1].trim();
        const current = await this.storage.getIdentity();
        const interests = (current?.interests || []).slice();
        if (!interests.includes(topic)) interests.push(topic);
        const updated = await this.updateCoreIdentity({ ...(current || {}), interests });
        return { success: true, message: `Interest added: ${topic}` };
      }

      // remove_interest: @IDENTITY remove_interest Topic
      const remMatch = trimmed.match(/^@IDENTITY\s+remove_interest\s+(.+)$/i);
      if (remMatch) {
        const topic = remMatch[1].trim();
        const current = await this.storage.getIdentity();
        const interests = (current?.interests || []).filter((i: string) => i !== topic);
        const updated = await this.updateCoreIdentity({ ...(current || {}), interests });
        return { success: true, message: `Interest removed: ${topic}` };
      }

      return { success: false, message: 'Unrecognized identity command.' };
    } catch (e) {
      console.error('Error applying trainer identity command:', e);
      return { success: false, message: `Error: ${(e as Error).message}` };
    }
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
    console.log(`[ADMIN_BOT] blockContact called for ${contactId}`);
    await this.storage.updateSetting(`admin_bot_blocked_${contactId}`, "true");
    console.log(`[ADMIN_BOT] blockContact saved for ${contactId}`);
  }

  /**
   * Unblock a contact
   */
  async unblockContact(contactId: number): Promise<void> {
    console.log(`[ADMIN_BOT] unblockContact called for ${contactId}`);
    await this.storage.updateSetting(`admin_bot_blocked_${contactId}`, "");
    console.log(`[ADMIN_BOT] unblockContact saved for ${contactId}`);
  }

  /**
   * Check if a contact is blocked
   */
  async isContactBlocked(contactId: number): Promise<boolean> {
    const setting = await this.storage.getSetting(`admin_bot_blocked_${contactId}`);
    const isBlocked = setting?.value === "true";
    console.log(`[ADMIN_BOT] isContactBlocked(${contactId}): ${isBlocked}`);
    return isBlocked;
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
    // Check in-memory cache first
    if (this.trainerProfiles.has(contactId)) {
      console.log(`[ADMIN_BOT] isContactTrainer(${contactId}): true (from cache)`);
      return true;
    }
    // Check storage (source of truth)
    const setting = await this.storage.getSetting(`admin_bot_trainer_${contactId}`);
    if (setting?.value) {
      try {
        JSON.parse(setting.value);
        console.log(`[ADMIN_BOT] isContactTrainer(${contactId}): true (from storage)`);
        return true;
      } catch (e) {
        console.log(`[ADMIN_BOT] isContactTrainer(${contactId}): false (storage parse failed)`);
        return false;
      }
    }
    console.log(`[ADMIN_BOT] isContactTrainer(${contactId}): false (not found)`);
    return false;
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
    // Check if enough time has passed since last analysis
    const now = Date.now();
    const lastAnalysis = this.lastPersonalityAnalysisTime.get(contactId) || 0;
    const timeSinceLastAnalysis = now - lastAnalysis;

    // Return cached personality if analyzed recently
    if (timeSinceLastAnalysis < this.PERSONALITY_ANALYSIS_INTERVAL) {
      return (
        this.contactPersonalities.get(contactId) ||
        (await this.getContactPersonality(contactId))
      );
    }

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
      // Use centralized AI service
      const aiService = getAIService();
      const response = await aiService.generateContent([
        { role: "user", content: adaptPrompt }
      ]);

      if (response.error) {
        console.error(`AI Service error during personality analysis: ${response.error}`);
        return currentPersonality;
      }

      const adaptationText = response.content;
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
        this.lastPersonalityAnalysisTime.set(contactId, now);
        return updatedPersonality;
      }
    } catch (error) {
      console.error(`Error adapting personality for contact ${contactId}:`, error);
    }

    return currentPersonality;
  }

  /**
   * Extract and track tasks/follow-ups from conversation
   * OPTIMIZED: Debounced to run only once per 5 minutes per contact to avoid excessive API calls
   */
  async extractTasksAndFollowUps(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<{
    tasks: ContactTask[];
    followUps: FollowUpItem[];
  }> {
    // Check if enough time has passed since last extraction
    const now = Date.now();
    const lastExtraction = this.lastTaskExtractionTime.get(contactId) || 0;
    const timeSinceLastExtraction = now - lastExtraction;

    // Return cached tasks/follow-ups if extracted recently
    if (timeSinceLastExtraction < this.TASK_EXTRACTION_INTERVAL) {
      const cachedTasks = this.contactTasks.get(contactId) || [];
      const cachedFollowUps = this.contactFollowUps.get(contactId) || [];
      return {
        tasks: cachedTasks,
        followUps: cachedFollowUps,
      };
    }

    // Only proceed with extraction if enough time has passed
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
      // Use centralized AI service
      const aiService = getAIService();
      const response = await aiService.generateContent([
        { role: "user", content: extractionPrompt }
      ]);

      if (response.error) {
        console.error(`AI Service error during task extraction: ${response.error}`);
        return { tasks: [], followUps: [] };
      }

      const extractionText = response.content;
      const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        const extractedNow = new Date();

        const tasks: ContactTask[] = (extracted.tasks || []).map(
          (task: any, idx: number) => ({
            id: `task_${contactId}_${extractedNow.getTime()}_${idx}`,
            contactId,
            title: task.title,
            description: task.description,
            status: "pending" as const,
            priority: task.priority,
            category: task.category,
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
            relatedTopics: task.relatedTopics || [],
            createdAt: extractedNow,
            updatedAt: extractedNow,
          })
        );

        const followUps: FollowUpItem[] = (extracted.followUps || []).map(
          (fu: any, idx: number) => ({
            id: `followup_${contactId}_${extractedNow.getTime()}_${idx}`,
            contactId,
            subject: fu.subject,
            details: fu.details,
            lastMentionedAt: extractedNow,
            nextFollowUpDate: fu.nextFollowUpDate
              ? new Date(fu.nextFollowUpDate)
              : undefined,
            status: "pending" as const,
            priority: fu.priority,
            createdAt: extractedNow,
            updatedAt: extractedNow,
          })
        );
        
        // Update cache and timestamp
        this.contactTasks.set(contactId, tasks);
        this.contactFollowUps.set(contactId, followUps);
        this.lastTaskExtractionTime.set(contactId, now);

        return { tasks, followUps };
      }
    } catch (error) {
      console.error(`Error extracting tasks/follow-ups for contact ${contactId}:`, error);
    }

    // Return empty arrays on error
    return {
      tasks: [],
      followUps: [],
    };
  }

  /**
   * Generate personalized conversation summary for a contact
   */
  async generateConversationSummary(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<ContactInformationSummary> {
    // Check if enough time has passed since last summary
    const now = Date.now();
    const lastSummary = this.lastConversationSummaryTime.get(contactId) || 0;
    const timeSinceLastSummary = now - lastSummary;

    // Return cached summary if generated recently
    if (timeSinceLastSummary < this.CONVERSATION_SUMMARY_INTERVAL) {
      return (
        this.contactSummaries.get(contactId) ||
        {
          contactId,
          summary: "Conversation summary pending",
          keyTopics: [],
          recentInteractions: [],
          relationshipStatus: "Unknown",
          lastUpdated: new Date(),
        }
      );
    }

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
      // Use centralized AI service
      const aiService = getAIService();
      const response = await aiService.generateContent([
        { role: "user", content: summaryPrompt }
      ]);

      if (response.error) {
        console.error(`AI Service error during summary generation: ${response.error}`);
        return {
          contactId,
          summary: "Summary could not be generated",
          keyTopics: [],
          recentInteractions: [],
          relationshipStatus: "Unknown",
          lastUpdated: new Date(),
        };
      }

      const summaryText = response.content;
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

        this.lastConversationSummaryTime.set(contactId, now);
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
   * Note: messages array should already include the latest user message
   */
  async generatePersonalizedResponse(
    contactId: number,
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
      // Check if any API keys are available
      const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
      const hasGemini = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
      
      if (!hasOpenAI && !hasGemini) {
        console.warn(`No API keys configured for AI responses. Configure AI_INTEGRATIONS_OPENAI_API_KEY or AI_INTEGRATIONS_GEMINI_API_KEY`);
        return "I appreciate your message, but I'm not able to respond right now due to missing API configuration. Please check back later.";
      }

      // Get the centralized AI service
      const aiService = getAIService();

      // Convert messages to AIMessage format
      const aiMessages = [
        { role: "user" as const, content: systemPrompt },
        ...messages.map((h) => ({
          role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: h.content,
        })),
      ];

      // Call AI service with automatic fallback
      const response = await aiService.generateContent(aiMessages);

      if (response.error) {
        console.error(`AI Service error: ${response.error}`);
        return "I'm sorry, I had trouble responding to that.";
      }

      return response.content || "I couldn't process that.";
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

    // incorporate recent contact notes (background knowledge)
    let contactNotesText = "";
    if (typeof contactId === "number") {
      const notes = await this.getContactNotes(contactId);
      if (notes.length > 0) {
        contactNotesText = `\nCONTACT NOTES (most recent first):\n` + notes.slice(-5).reverse().map(n => `- ${n.createdAt.toISOString()}: ${n.summary}${n.details ? ` -- ${n.details}` : ''}`).join('\n') + '\n';
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

    // Append contact notes if present
    if (contactNotesText) {
      prompt += `\n\n${contactNotesText}`;
    }

    return prompt;
  }
}
