# 🚀 Quick Start: Using the Centralized AI Service

## For Backend Developers

### Get the AI Service in Your Code

```typescript
import { getAIService } from "../services/aiService";

// In any async function:
const aiService = getAIService();
```

### Basic Usage - Generate Content

```typescript
// Simple message
const response = await aiService.generateContent([
  { role: "user", content: "What is 2+2?" }
]);

console.log(response.content);      // "4"
console.log(response.provider);     // "gemini" or "openai"
console.log(response.model);        // "gemini-2.5-flash" or "gpt-4o"
```

### With Multiple Messages (Conversation)

```typescript
const response = await aiService.generateContent([
  { role: "user", content: "What's your name?" },
  { role: "assistant", content: "I'm Claude" },
  { role: "user", content: "Tell me about yourself" }
]);
```

### Specify Provider Preference

```typescript
// Force OpenAI instead of Gemini
const response = await aiService.generateContent(messages, {
  provider: "openai",
  model: "gpt-4o"
});
```

### Handle Errors

```typescript
const response = await aiService.generateContent(messages);

if (response.error) {
  console.error(`AI failed: ${response.error}`);
  // Error already includes which provider failed
} else {
  console.log(`Used ${response.provider} - Response: ${response.content}`);
}
```

## For React Component Developers

### Using Zustand Stores

```typescript
import { 
  useChatStore, 
  useAIProviderStore, 
  useContactStore,
  useUIStore 
} from "../stores";

export function ChatComponent() {
  // Get messages and loading state
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);

  // Get AI provider info
  const provider = useAIProviderStore((s) => s.primaryProvider);
  const availableProviders = useAIProviderStore((s) => s.availableProviders);

  // Get contact info
  const contact = useContactStore((s) => s.selectedContact);

  // Get UI state
  const theme = useUIStore((s) => s.theme);

  return (
    <div>
      <p>Current Provider: {provider}</p>
      <p>Messages: {messages.length}</p>
      {isLoading && <p>Loading...</p>}
    </div>
  );
}
```

### Update State from Stores

```typescript
export function MessageInput() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);

  async function handleSend(content: string) {
    // Add user message
    addMessage({
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date()
    });

    setLoading(true);
    
    // Send to API...
    
    setLoading(false);

    // Add AI response
    addMessage({
      id: Date.now().toString(),
      role: "assistant",
      content: response,
      timestamp: new Date()
    });
  }

  return (
    <input 
      onKeyPress={(e) => {
        if (e.key === 'Enter') {
          handleSend(e.currentTarget.value);
          e.currentTarget.value = '';
        }
      }}
    />
  );
}
```

## Architecture Overview

```
┌─────────────────────────────┐
│   Application Entry Point   │
│     (server/index.ts)       │
└──────────────┬──────────────┘
               │
        ┌──────▼──────┐
        │ Initialize  │
        │  AIService  │
        │             │
        │ API Keys:   │
        │ GEMINI_KEY  │
        │ OPENAI_KEY  │
        └──────┬──────┘
               │
    ┌──────────┴────────────┐
    │                       │
┌───▼────────────┐  ┌──────▼──────────┐
│   Gemini API   │  │   OpenAI API    │
│  (Primary)     │  │  (Fallback)     │
└────────────────┘  └─────────────────┘

AIService (getAIService())
├─ generateContent(messages, options)
│  ├─ Try primary provider (Gemini)
│  ├─ On error: Try fallback (OpenAI)
│  └─ Return: { content, provider, model, error? }
│
├─ getAvailableProviders()
│  └─ Returns: ["gemini", "openai"]
│
└─ isProviderAvailable(provider)
   └─ Check if API key is configured
```

## Configuration

### Set API Keys (in .env)

```env
AI_INTEGRATIONS_GEMINI_API_KEY=your-gemini-api-key
AI_INTEGRATIONS_OPENAI_API_KEY=your-openai-api-key
```

### Which Provider Gets Used?

1. **Primary**: Gemini (if API key provided)
2. **Fallback**: OpenAI (if API key provided)
3. **If Gemini fails**: Automatically tries OpenAI
4. **If both fail**: Returns error in AIResponse

## Common Patterns

### Pattern 1: Simple AI Task

```typescript
const aiService = getAIService();
const response = await aiService.generateContent([
  { role: "user", content: "Extract JSON from this..." }
]);

if (!response.error) {
  const json = JSON.parse(response.content);
}
```

### Pattern 2: Conversation with System Prompt

```typescript
const systemPrompt = "You are a helpful assistant that...";
const aiService = getAIService();

const response = await aiService.generateContent([
  { role: "user", content: systemPrompt },  // System prompt as first message
  { role: "user", content: "Hello!" },
  { role: "assistant", content: "Hi there!" },
  { role: "user", content: "How are you?" }
]);
```

### Pattern 3: Force Specific Provider

```typescript
// Force OpenAI (e.g., because Gemini doesn't support a feature)
const response = await aiService.generateContent(messages, {
  provider: "openai"
});

// Or let it auto-select
const response = await aiService.generateContent(messages);
// Uses Gemini if available, falls back to OpenAI
```

### Pattern 4: Check What's Available

```typescript
const aiService = getAIService();
const available = aiService.getAvailableProviders();

if (available.includes("openai")) {
  console.log("OpenAI is available");
}

if (aiService.isProviderAvailable("gemini")) {
  console.log("Gemini is ready to use");
}
```

## Types Reference

### AIMessage
```typescript
interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
```

### AIResponse
```typescript
interface AIResponse {
  content: string;           // The AI's response text
  provider: AIProvider;      // Which service was used
  model: AIModel;           // Which model was used
  error?: string;           // Error message if failed
}
```

### AIProvider
```typescript
type AIProvider = "gemini" | "openai";
```

### AIModel
```typescript
type AIModel = "gemini-2.5-flash" | "gpt-4o";
```

## Important Notes

⚠️ **System Prompts**: For Gemini, system prompts must be sent as the first user message (Gemini doesn't support system role)

⚠️ **API Keys**: Both keys are optional, but at least one must be provided for any AI functionality

⚠️ **Initialization**: AIService must be initialized in server/index.ts before any code tries to use it

⚠️ **Singleton**: Always use `getAIService()`, never create new AIService instances

## Migration Checklist for Existing Code

- [ ] Find all `new OpenAI()` instances
- [ ] Find all `new GoogleGenAI()` instances
- [ ] Replace with `getAIService().generateContent()`
- [ ] Update error handling to check for `response.error`
- [ ] Remove try/catch pairs for provider fallback
- [ ] Remove OpenAI and GoogleGenAI imports
- [ ] Test response content extraction (no more direct `.message.content`)

## Troubleshooting

### "AIService is not initialized"
**Solution**: Ensure server/index.ts calls `initializeAIService()` before registering routes

### "Provider not available"
**Solution**: Check that API keys are set in .env and `getAIService()` returns valid instance

### "No content in response"
**Solution**: Check `response.error` field, it might contain the error message

### "Wrong provider being used"
**Solution**: Use `response.provider` to verify which service responded, or force provider with options parameter

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for production
