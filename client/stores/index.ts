/**
 * Zustand Store for Chat UI State
 * Manages client-side state for chat messages, loading, etc.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  contactId?: number;
}

export interface ChatStore {
  // Messages
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Current contact
  selectedContactId: number | null;
  selectContact: (contactId: number | null) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    messages: [],
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),
    clearMessages: () => set({ messages: [] }),

    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),

    selectedContactId: null,
    selectContact: (contactId) => set({ selectedContactId: contactId }),

    error: null,
    setError: (error) => set({ error }),
  }))
);

/**
 * Zustand Store for AI Provider State
 * Manages which AI provider is active, model selection, etc.
 */

export interface AIProviderStore {
  // Provider selection
  primaryProvider: "gemini" | "openai";
  setPrimaryProvider: (provider: "gemini" | "openai") => void;
  
  // Available providers
  availableProviders: ("gemini" | "openai")[];
  setAvailableProviders: (providers: ("gemini" | "openai")[]) => void;
  
  // Model selection
  selectedModel: "gemini-2.5-flash" | "gpt-4o";
  setSelectedModel: (model: "gemini-2.5-flash" | "gpt-4o") => void;
  
  // Usage stats
  totalRequests: number;
  failedRequests: number;
  incrementRequests: () => void;
  incrementFailedRequests: () => void;
  
  // Error tracking
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

export const useAIProviderStore = create<AIProviderStore>()(
  subscribeWithSelector((set) => ({
    primaryProvider: "gemini",
    setPrimaryProvider: (provider) => set({ primaryProvider: provider }),

    availableProviders: [],
    setAvailableProviders: (providers) =>
      set({ availableProviders: providers }),

    selectedModel: "gemini-2.5-flash",
    setSelectedModel: (model) => set({ selectedModel: model }),

    totalRequests: 0,
    failedRequests: 0,
    incrementRequests: () =>
      set((state) => ({ totalRequests: state.totalRequests + 1 })),
    incrementFailedRequests: () =>
      set((state) => ({ failedRequests: state.failedRequests + 1 })),

    lastError: null,
    setLastError: (error) => set({ lastError: error }),
  }))
);

/**
 * Zustand Store for Contact Management
 * Manages selected contact, list, settings, etc.
 */

export interface Contact {
  id: number;
  name: string;
  platform: "whatsapp" | "telegram" | "email";
  isBlocked: boolean;
  isTrainer: boolean;
  lastMessageAt: Date | null;
}

export interface ContactStore {
  // Contact list
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  
  // Selected contact
  selectedContact: Contact | null;
  selectContact: (contact: Contact | null) => void;
  
  // Contact settings
  updateContactSetting: (
    contactId: number,
    updates: Partial<Contact>
  ) => void;
  
  // Block/Unblock
  toggleBlockContact: (contactId: number) => void;
  toggleTrainerStatus: (contactId: number) => void;
  
  // Loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useContactStore = create<ContactStore>()(
  subscribeWithSelector((set) => ({
    contacts: [],
    setContacts: (contacts) => set({ contacts }),

    selectedContact: null,
    selectContact: (contact) => set({ selectedContact: contact }),

    updateContactSetting: (contactId, updates) =>
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === contactId ? { ...c, ...updates } : c
        ),
        selectedContact:
          state.selectedContact?.id === contactId
            ? { ...state.selectedContact, ...updates }
            : state.selectedContact,
      })),

    toggleBlockContact: (contactId) =>
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === contactId ? { ...c, isBlocked: !c.isBlocked } : c
        ),
      })),

    toggleTrainerStatus: (contactId) =>
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === contactId ? { ...c, isTrainer: !c.isTrainer } : c
        ),
      })),

    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),
  }))
);

/**
 * Zustand Store for UI Preferences
 * Manages theme, sidebar state, etc.
 */

export interface UIStore {
  // Theme
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  
  // Notifications
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  
  // Toast messages
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    theme: "dark",
    setTheme: (theme) => set({ theme }),

    sidebarCollapsed: false,
    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    showNotifications: true,
    setShowNotifications: (show) => set({ showNotifications: show }),

    toasts: [],
    addToast: (message, type = "info") =>
      set((state) => ({
        toasts: [
          ...state.toasts,
          { id: Date.now().toString(), message, type },
        ],
      })),
    removeToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
  }))
);
