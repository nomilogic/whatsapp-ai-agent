# AI Service Refactoring Guide

## Architecture Improvements

### Problem with Old Approach
- Gemini and OpenAI were being instantiated in multiple places throughout the codebase
- Different components called these APIs differently
- Hard to maintain consistency and implement fallbacks
- Difficult to track usage, add new providers, or switch models globally

### New Centralized Architecture

```
Old Structure:
┌─ adminBotHandler.ts (has OpenAI + Gemini)
├─ whatsapp.ts (uses handlers)
├─ routes/ (multiple files, some use AI directly)
└─ chat/ (also has its own AI logic)

New Structure:
┌─ services/aiService.ts (SINGLE SOURCE OF TRUTH)
├─ adminBotHandler.ts (calls aiService)
├─ whatsapp.ts (calls adminBotHandler)
├─ routes/ (calls aiService or handlers)
└─ chat/ (calls aiService)
```

## Implementation Steps

### Step 1: Migrate AdminBotHandler to Use AIService

Replace direct OpenAI/Gemini calls with:

```typescript
import { getAIService, AIMessage } from "../services/aiService";

// OLD WAY:
if (this.gemini) {
  const result = await this.gemini.models.generateContent({...});
}

// NEW WAY:
const aiService = getAIService();
const response = await aiService.generateContent(messages);
```

### Step 2: Migrate Routes

Any route that calls AI should use:

```typescript
import { getAIService } from "../services/aiService";

app.post("/api/analyze", async (req, res) => {
  const aiService = getAIService();
  const response = await aiService.generateContent([
    { role: "user", content: req.body.prompt }
  ]);
  res.json(response);
});
```

### Step 3: Use Zustand Stores in Frontend

```typescript
// client/components/ChatComponent.tsx
import { useChatStore, useAIProviderStore } from "../stores";

export function ChatComponent() {
  const { messages, addMessage, isLoading, setLoading } = useChatStore();
  const { primaryProvider, selectedModel } = useAIProviderStore();

  async function sendMessage(content: string) {
    setLoading(true);
    addMessage({ id: Date.now().toString(), role: "user", content, timestamp: new Date() });
    // Send to AI...
    setLoading(false);
  }
}
```

## Files Structure

### Server Side
```
server/
├─ services/
│  └─ aiService.ts          ← NEW: Central AI controller
├─ features/
│  └─ adminBotHandler.ts    ← REFACTOR: Use aiService
├─ routes/
│  ├─ index.ts              ← REFACTOR: Use aiService
│  └─ [other routes].ts     ← REFACTOR: Use aiService
├─ whatsapp.ts              ← Already uses adminBotHandler (no change needed)
└─ index.ts                 ← REFACTOR: Initialize aiService on startup
```

### Client Side
```
client/
├─ stores/
│  └─ index.ts              ← NEW: Zustand stores
├─ components/
│  └─ ChatComponent.tsx     ← REFACTOR: Use stores
└─ pages/
   └─ [pages].tsx           ← REFACTOR: Use stores
```

## Configuration

### In server/index.ts:

```typescript
import { initializeAIService } from "./services/aiService";

// After dotenv config
const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

initializeAIService(openaiKey, geminiKey);
console.log("✓ AI Service initialized");

// Then setup routes
registerRoutes(app);
```

## Benefits

1. **Single Responsibility**: All AI logic in one place
2. **Easy to Switch Providers**: Change primary provider in one spot
3. **Better Error Handling**: Fallback logic centralized
4. **Usage Tracking**: Monitor API calls across all features
5. **Consistency**: All components use same interface
6. **Testability**: Easy to mock AIService for tests
7. **Scalability**: Add new providers without touching existing code

## Example: Adding a New Provider

To add Claude3 or another provider:

```typescript
// In aiService.ts
export type AIProvider = "gemini" | "openai" | "claude";

private async generateWithClaude(...) {
  // Claude-specific logic
}

async generateContent(messages, options) {
  if (provider === "claude") {
    return this.generateWithClaude(...);
  }
  // ... existing code
}
```

Done! All components automatically support Claude without changes.

## Migration Checklist

- [ ] Create aiService.ts
- [ ] Create Zustand stores
- [ ] Update adminBotHandler to use aiService
- [ ] Update all routes to use aiService
- [ ] Initialize aiService in server/index.ts
- [ ] Update AdminBotHandler initialization to remove redundant OpenAI/Gemini
- [ ] Refactor frontend components to use Zustand stores
- [ ] Test all AI operations work correctly
- [ ] Verify fallback mechanism still works
- [ ] Test multi-provider scenarios

## State Management with Zustand

### Chat Store
Manages: messages, loading state, selected contact, errors

### AI Provider Store
Manages: active provider, available providers, model selection, usage stats

### Contact Store
Manages: contact list, selected contact, block status, trainer status

### UI Store
Manages: theme, sidebar state, notifications, toasts

### Usage Example

```typescript
// In a React component
import { useChatStore, useAIProviderStore } from "../stores";

export function ChatUI() {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const provider = useAIProviderStore((s) => s.primaryProvider);

  // Component logic
}
```

## Notes

- AIService is initialized globally, access via `getAIService()`
- Zustand stores are React-based, use hooks in components
- Both can coexist in the application
- Server can use aiService, client can use Zustand
- For hybrid: server provides initial state via API, Zustand manages UI state
