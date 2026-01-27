# Quick Reference Guide - Enhanced Features

## 🚀 Quick Start

### Testing Memory Endpoints
```bash
# Store a memory
curl -X POST http://localhost:5000/api/memory/1 \
  -H "Content-Type: application/json" \
  -d '{"content":"Loves coffee and hiking","category":"preferences"}'

# Retrieve all memories
curl -X GET http://localhost:5000/api/memory/1

# Search memories
curl -X GET "http://localhost:5000/api/memory/1/search?q=coffee"

# Get memories by category
curl -X GET "http://localhost:5000/api/memory/1/category/preferences"
```

### Testing Task Endpoints
```bash
# Create a task
curl -X POST http://localhost:5000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "description":"Call about project deadline",
    "type":"follow_up",
    "priority":"high",
    "deadline":"2026-01-30T17:00:00Z"
  }'

# Get all tasks with stats
curl -X GET http://localhost:5000/api/tasks/1

# Get upcoming tasks
curl -X GET "http://localhost:5000/api/tasks/upcoming?hours=24"

# Update task status
curl -X PATCH http://localhost:5000/api/tasks/task_123456 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

### Testing Analytics Endpoints
```bash
# Get interaction metrics
curl -X GET http://localhost:5000/api/analytics/metrics/1

# Get relationship insights
curl -X GET http://localhost:5000/api/analytics/insights/1

# Get weekly insights
curl -X GET http://localhost:5000/api/analytics/weekly/1

# Get ranked contacts
curl -X GET http://localhost:5000/api/analytics/ranked
```

### Testing Messaging Endpoints
```bash
# Check if should send proactive message
curl -X GET http://localhost:5000/api/messaging/proactive/1

# Get message suggestion
curl -X GET "http://localhost:5000/api/messaging/suggest/1?type=greeting"

# Get messaging strategy for relationship type
curl -X GET http://localhost:5000/api/messaging/strategy/friend
```

### Testing Conversation Analysis
```bash
# Analyze a conversation
curl -X POST http://localhost:5000/api/conversations/analyze/1 \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"user","content":"I need help with my project"},
      {"role":"assistant","content":"I can help with that!"}
    ]
  }'
```

---

## 📁 Module Structure

```
Memory Management
├── memoryCore          → Storage and indexing
├── memorySummarizer    → Topic/sentiment extraction
├── memoryCategorizer   → Auto-categorization
└── memoryManager       → High-level API

Task Management
└── taskManager         → Full lifecycle management

Conversation Analysis
└── conversationAnalyzer → Categorization & extraction

Messaging
└── proactiveMessager   → Relationship-aware messaging

Analytics
└── analyticsEngine     → Metrics & insights
```

---

## 🔑 Key Classes & Exports

### MemoryManager
```typescript
import { memoryManager } from './server/memory/memoryManager';

// Store memory
await memoryManager.storeUserMemory(contactId, content, category);

// Search memories
const results = await memoryManager.searchMemories(contactId, query);

// Build context for prompts
const context = await memoryManager.buildContextForConversation(contactId);

// Get insights
const insights = await memoryManager.getMemoryInsights(contactId);
```

### TaskManager
```typescript
import { taskManager } from './server/tasks/taskManager';

// Create task
const task = await taskManager.createTask(
  contactId, 
  description, 
  type, 
  priority, 
  deadline
);

// Extract from conversation
const extracted = await taskManager.extractTasksFromConversation(
  contactId, 
  messageText
);

// Get statistics
const stats = await taskManager.getTaskStatistics(contactId);

// Update status
await taskManager.updateTaskStatus(taskId, 'completed');
```

### ConversationAnalyzer
```typescript
import { conversationAnalyzer } from './server/conversations/conversationAnalyzer';

// Analyze conversation
const analysis = await conversationAnalyzer.analyzeConversation(
  contactId,
  messages
);

// Get response suggestion
const suggestion = await conversationAnalyzer.generateResponseSuggestion(
  analysis
);
```

### ProactiveMessager
```typescript
import { proactiveMessager } from './server/messaging/proactiveMessager';

// Check if should send
const should = await proactiveMessager.shouldSendProactiveMessage(contactId);

// Generate message
const message = await proactiveMessager.createContextualMessage(
  contactId,
  'greeting'
);

// Get strategy
const strategy = proactiveMessager.getMessagingStrategy('friend');
```

### AnalyticsEngine
```typescript
import { analyticsEngine } from './server/analytics/analyticsEngine';

// Get metrics
const metrics = await analyticsEngine.getInteractionMetrics(contactId);

// Get insights
const insights = await analyticsEngine.getRelationshipInsights(contactId);

// Get weekly breakdown
const weekly = await analyticsEngine.getWeeklyInsights(contactId);

// Get ranked contacts
const ranked = await analyticsEngine.getRankedContacts();
```

---

## 📊 Data Models

### Memory Entry
```typescript
interface MemoryEntry {
  id: string;
  contactId: number;
  content: string;
  category: MemoryCategory;
  priority: MemoryPriority;
  keywords: string[];
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  lastAccessed: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}
```

### Task
```typescript
interface Task {
  id: string;
  contactId: number;
  type: TaskType;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date;
  reminders: Date[];
  tags: string[];
  relatedMemoryIds: string[];
  notes?: string;
  metadata?: Record<string, any>;
}
```

### ConversationAnalysis
```typescript
interface ConversationAnalysis {
  category: ConversationCategory;
  tasks: Task[];
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  actionRequired: boolean;
  summary: string;
}
```

### InteractionMetrics
```typescript
interface InteractionMetrics {
  totalMessages: number;
  averageResponseTime: number;
  messageFrequency: number;
  lastInteractionDaysAgo: number;
  conversationTopics: string[];
  sentimentTrend: 'positive' | 'negative' | 'neutral' | 'mixed';
}
```

### RelationshipInsights
```typescript
interface RelationshipInsights {
  strengthScore: number;           // 0-100
  connectionType: string;
  communicationStyle: string;
  importanceScore: number;         // 0-100
  engagementLevel: 'high' | 'medium' | 'low';
  recommendations: string[];
}
```

---

## 🎯 Common Use Cases

### Use Case 1: Extract and Track Tasks from Conversation
```typescript
const messages = await storage.getMessages(contactId);
const analysis = await conversationAnalyzer.analyzeConversation(
  contactId,
  messages
);

// Tasks are automatically extracted in analysis.tasks
// Store them:
for (const task of analysis.tasks) {
  await taskManager.createTask(
    contactId,
    task.description,
    task.type,
    task.priority
  );
}
```

### Use Case 2: Build Rich Context for Gemini
```typescript
// Get memories as context
const memoryContext = await memoryManager.buildContextForConversation(
  contactId
);

// Get analytics for personalization
const insights = await analyticsEngine.getRelationshipInsights(contactId);

// Build system prompt
const systemPrompt = `You know this person:
${memoryContext}

Relationship strength: ${insights.strengthScore}/100
Communication style: ${insights.communicationStyle}
Recommended topics: ${insights.recommendations.join(', ')}

Respond accordingly.`;
```

### Use Case 3: Decide When to Send Proactive Messages
```typescript
// Check if should send
const { shouldSend, reason, messageType } = 
  await proactiveMessager.shouldSendProactiveMessage(contactId);

if (shouldSend) {
  // Generate appropriate message
  const message = await proactiveMessager.createContextualMessage(
    contactId,
    messageType
  );
  
  // Send via WhatsApp
  await whatsAppService.sendMessage(remoteJid, message);
}
```

### Use Case 4: Get Contact Importance Ranking
```typescript
// Get all contacts ranked by relationship strength
const ranked = await analyticsEngine.getRankedContacts();

// Most important contacts first
console.log(ranked.slice(0, 10).map(c => c.name));

// Use for priority inbox or daily digest
```

### Use Case 5: Analyze Weekly Activity
```typescript
const weekly = await analyticsEngine.getWeeklyInsights(contactId);

console.log(`${weekly.averageMessagesPerDay.toFixed(1)} messages/day`);
console.log(`Most active: ${weekly.mostActiveDay}`);
console.log(`Topics: ${weekly.topics.map(t => t.topic).join(', ')}`);
console.log(`Sentiment: ${JSON.stringify(weekly.sentimentDistribution)}`);
```

---

## 🔗 Integration Points

### With WhatsApp Handler (server/whatsapp.ts)
```typescript
// On incoming message:
const { message, contact } = event;

// Analyze conversation
const analysis = await conversationAnalyzer.analyzeConversation(
  contact.id,
  [message]
);

// Store memory
await memoryManager.processConversation(contact.id, message.content);

// Extract and create tasks
for (const task of analysis.tasks) {
  await taskManager.createTask(contact.id, task.description, task.type);
}

// Update analytics
await analyticsEngine.getInteractionMetrics(contact.id);

// Consider proactive response
if (analysis.actionRequired) {
  // Build context
  const context = await memoryManager.buildContextForConversation(contact.id);
  
  // Generate response with Gemini
  const response = await generateResponse(message.content, context);
  
  // Send response
  await whatsAppService.sendMessage(contact.remoteJid, response);
}
```

### With Dashboard (client/)
```typescript
// React component fetching analytics
async function ContactCard({ contactId }) {
  const metrics = await fetch(`/api/analytics/metrics/${contactId}`);
  const insights = await fetch(`/api/analytics/insights/${contactId}`);
  const memories = await fetch(`/api/memory/${contactId}`);
  const tasks = await fetch(`/api/tasks/${contactId}`);
  
  return (
    <div>
      <h3>Strength: {insights.strengthScore}/100</h3>
      <p>Last message: {metrics.lastInteractionDaysAgo} days ago</p>
      <p>Topics: {metrics.conversationTopics.join(', ')}</p>
      <p>Pending tasks: {tasks.tasks.filter(t => t.status === 'pending').length}</p>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Issue: Memory search returns no results
**Solution**: Check that keywords are being extracted properly
```typescript
const analysis = await memorySummarizer.summarizeConversation(messages);
console.log(analysis.keywords); // Verify keywords extracted
```

### Issue: Tasks not being extracted from messages
**Solution**: Check if message contains detection patterns
- Patterns: "need to", "should", "must", "reminder:", "follow up on:", "order:", "pay:"
```typescript
const extracted = await taskManager.extractTasksFromConversation(
  contactId,
  "I need to call John tomorrow about the project"
);
console.log(extracted); // Should return task
```

### Issue: Proactive message timing is off
**Solution**: Verify communication frequency profile
```typescript
const strategy = proactiveMessager.getMessagingStrategy('friend');
console.log(strategy.frequency); // Check baseIntervalHours
```

### Issue: Analytics strength score seems incorrect
**Solution**: Check interaction history
```typescript
const metrics = await analyticsEngine.getInteractionMetrics(contactId);
console.log(metrics);
// Verify: frequency, recency, sentiment
```

---

## 📚 Additional Resources

- **API Documentation**: See `API_DOCUMENTATION.md`
- **Implementation Summary**: See `ENHANCED_FEATURES_SUMMARY.md`
- **Module Code**: All modules in `server/` with JSDoc comments
- **Routes**: See `server/routes/enhancedFeatures.ts` for endpoint implementations

---

## 🎓 Learning Path

1. **Start**: Read `API_DOCUMENTATION.md` for API overview
2. **Understand**: Review module JSDoc comments for implementation
3. **Integrate**: Use code samples from "Common Use Cases"
4. **Test**: Use cURL commands from "Quick Start"
5. **Extend**: Modify modules for custom behavior

---

**Last Updated**: January 27, 2026
**Version**: 1.0 (Initial Implementation)
