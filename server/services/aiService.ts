/**
 * Centralized AI Service Controller
 * Handles all AI provider abstraction (Gemini, OpenAI, etc.)
 * Single source of truth for all AI operations across the application
 */

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export type AIProvider = "gemini" | "openai";
export type AIModel = "gemini-2.5-flash" | "gpt-4o";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: AIModel;
  error?: string;
}

/**
 * Central AI Service - All AI calls go through here
 */
export class AIService {
  private openai: OpenAI;
  private gemini: GoogleGenAI | null = null;
  private primaryProvider: AIProvider = "gemini";
  private fallbackProvider: AIProvider = "openai";

  constructor(
    openaiApiKey: string,
    geminiApiKey?: string
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    if (geminiApiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiApiKey });
    }

    // Determine which provider to use primarily
    this.primaryProvider = geminiApiKey ? "gemini" : "openai";
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    if (provider === "gemini") {
      return this.gemini !== null;
    }
    return !!this.openai;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const available: AIProvider[] = [];
    if (this.gemini) available.push("gemini");
    if (this.openai) available.push("openai");
    return available;
  }

  /**
   * Generate content with automatic fallback
   * Accepts either an array of `AIMessage` or an object `{ messages, systemPrompt?, stream? }`.
   * Tries primary provider first, falls back to secondary if available.
   */
  async generateContent(
    input: AIMessage[] | { messages: AIMessage[]; systemPrompt?: string; stream?: boolean },
    options?: {
      provider?: AIProvider;
      model?: AIModel;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    // Normalize input into messages array and optionally inject system prompt
    let messages: AIMessage[] = [];
    if (Array.isArray(input)) {
      messages = input;
    } else {
      messages = input.messages || [];
      if (input.systemPrompt && input.systemPrompt.trim()) {
        messages = [{ role: 'system', content: input.systemPrompt.trim() }, ...messages];
      }
    }

    const provider = options?.provider || this.primaryProvider;
    const model = options?.model || this.getDefaultModel(provider);

    try {
      if (provider === 'gemini') {
        return await this.generateWithGemini(messages, model as 'gemini-2.5-flash');
      }
      return await this.generateWithOpenAI(messages, model as 'gpt-4o');
    } catch (error) {
      console.warn(`${provider} failed: ${(error as Error).message}, attempting fallback...`);

      const fallback = provider === 'gemini' ? 'openai' : 'gemini';
      const fallbackModel = this.getDefaultModel(fallback);

      if (this.isProviderAvailable(fallback)) {
        try {
          if (fallback === 'gemini') {
            return await this.generateWithGemini(messages, fallbackModel as 'gemini-2.5-flash');
          }
          return await this.generateWithOpenAI(messages, fallbackModel as 'gpt-4o');
        } catch (fallbackError) {
          console.error(`Fallback to ${fallback} also failed: ${(fallbackError as Error).message}`);
          return {
            content: '',
            provider: fallback,
            model: fallbackModel,
            error: `Both ${provider} and ${fallback} failed: ${(fallbackError as Error).message}`,
          };
        }
      }

      return {
        content: '',
        provider,
        model,
        error: `${provider} failed and no fallback available: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Generate with Gemini API
   */
  private async generateWithGemini(
    messages: AIMessage[],
    model: "gemini-2.5-flash"
  ): Promise<AIResponse> {
    if (!this.gemini) {
      throw new Error("Gemini API not configured");
    }

    // Convert messages to Gemini format
    // Separate system messages from conversation messages
    let systemPrompt = "";
    const geminiMessages: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += msg.content + "\n";
      } else {
        const role = msg.role === "assistant" ? "model" : "user";
        geminiMessages.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    // Build request with system instruction if present
    const requestConfig: any = {
      model,
      contents: geminiMessages,
      config: { temperature: 0.7, tools:  [{ googleSearch: {} }] },
    };

    // Gemini 2.5 supports systemInstruction parameter
    if (systemPrompt.trim()) {
      requestConfig.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }],
      };
    }

    const result = await this.gemini.models.generateContent(requestConfig);

    return {
      content: result.text || "",
      provider: "gemini",
      model,
    };
  }

  /**
   * Generate with OpenAI API
   */
  private async generateWithOpenAI(
    messages: AIMessage[],
    model: "gpt-4o"
  ): Promise<AIResponse> {
    // Convert messages to OpenAI format
    const openaiMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));

    const completion = await this.openai.chat.completions.create({
      model,
      messages: openaiMessages as any,
    });

    return {
      content: completion.choices[0]?.message?.content || "",
      provider: "openai",
      model,
    };
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: AIProvider): AIModel {
    if (provider === "gemini") {
      return "gemini-2.5-flash";
    }
    return "gpt-4o";
  }

  /**
   * Text extraction and JSON parsing helper
   */
  static extractJSON<T>(text: string, fallback?: T): T | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return fallback || null;
    } catch (e) {
      console.error("JSON extraction failed:", e);
      return fallback || null;
    }
  }

  /**
   * Batch generate content for multiple prompts
   * Useful for parallel processing
   */
  async generateBatch(
    prompts: string[],
    options?: {
      provider?: AIProvider;
      model?: AIModel;
    }
  ): Promise<AIResponse[]> {
    return Promise.all(
      prompts.map((prompt) =>
        this.generateContent(
          [{ role: "user", content: prompt }],
          options
        )
      )
    );
  }
}

/**
 * Global AI Service instance
 * Initialize once at app startup
 */
let aiService: AIService | null = null;

export function initializeAIService(
  openaiKey: string,
  geminiKey?: string
): AIService {
  aiService = new AIService(openaiKey, geminiKey);
  console.log(
    `✓ AI Service initialized with providers: ${aiService
      .getAvailableProviders()
      .join(", ")}`
  );
  return aiService;
}

export function getAIService(): AIService {
  if (!aiService) {
    throw new Error(
      "AI Service not initialized. Call initializeAIService() first."
    );
  }
  return aiService;
}

export default AIService;
