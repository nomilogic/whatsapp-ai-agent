import { GoogleGenAI } from "@google/genai";
import { IStorage } from "../storage";

export interface PersonalityTraits {
  name: string;
  communicationStyle: string;
  tone: string[];
  values: string[];
  interests: string[];
  languages: string[];
  emoji_usage: "minimal" | "moderate" | "heavy";
  response_length: "concise" | "balanced" | "detailed";
}

/**
 * Personality training system using Gemini AI
 * Analyzes user patterns and creates adaptive personality profiles
 */
export class PersonalityTrainer {
  private gemini: GoogleGenAI;
  private storage: IStorage;

  constructor(storage: IStorage, apiKey: string) {
    this.storage = storage;
    this.gemini = new GoogleGenAI({ apiKey });
  }

  /**
   * Train personality from conversation history
   * Analyzes patterns and generates personality insights
   */
  async trainFromHistory(contactId: number): Promise<PersonalityTraits> {
    const contact = await this.storage.getContact(contactId);
    const messages = await this.storage.getMessages(contactId);

    if (!contact || messages.length === 0) {
      return this.getDefaultPersonality();
    }

    // Get recent messages for analysis
    const recentMessages = messages.slice(-50).map(m => ({
      role: m.role,
      content: m.content
    }));

    const analysisPrompt = `Analyze these conversation messages and identify the personality traits of the person who wrote them:

Messages:
${recentMessages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')}

Provide a JSON response with these exact fields:
{
  "tone": ["string1", "string2", "string3"],
  "communication_style": "brief description",
  "detected_values": ["value1", "value2"],
  "detected_interests": ["interest1", "interest2"],
  "emoji_preference": "minimal|moderate|heavy",
  "preferred_length": "concise|balanced|detailed"
}`;

    try {
      const result = await this.gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
      });

      const analysisText = result.text;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        const identity = await this.storage.getIdentity();

        const personality: PersonalityTraits = {
          name: identity?.name || contact.name || "Assistant",
          communicationStyle: analysis.communication_style || "friendly",
          tone: analysis.tone || ["neutral"],
          values: analysis.detected_values || [],
          interests: analysis.detected_interests || [],
          languages: ["english"],
          emoji_usage: analysis.emoji_preference || "moderate",
          response_length: analysis.preferred_length || "balanced"
        };

        // Save personality to settings
        await this.storage.updateSetting(
          `personality_${contactId}`,
          JSON.stringify(personality)
        );

        return personality;
      }
    } catch (error) {
      console.error("Error training personality:", error);
    }

    return this.getDefaultPersonality();
  }

  /**
   * Get cached personality or default
   */
  async getPersonality(contactId: number): Promise<PersonalityTraits> {
    const cached = await this.storage.getSetting(`personality_${contactId}`);
    
    if (cached?.value) {
      try {
        return JSON.parse(cached.value);
      } catch (e) {
        console.error("Error parsing cached personality:", e);
      }
    }

    return this.getDefaultPersonality();
  }

  /**
   * Update personality traits
   */
  async updatePersonality(
    contactId: number,
    traits: Partial<PersonalityTraits>
  ): Promise<PersonalityTraits> {
    const current = await this.getPersonality(contactId);
    const updated = { ...current, ...traits };

    await this.storage.updateSetting(
      `personality_${contactId}`,
      JSON.stringify(updated)
    );

    return updated;
  }

  private getDefaultPersonality(): PersonalityTraits {
    return {
      name: "Assistant",
      communicationStyle: "friendly and helpful",
      tone: ["neutral", "professional"],
      values: [],
      interests: [],
      languages: ["english"],
      emoji_usage: "moderate",
      response_length: "balanced"
    };
  }
}
