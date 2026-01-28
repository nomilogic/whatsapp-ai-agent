# Admin Bot - Per-Contact Personality & Behavior System

## Overview

The Admin Bot system has been significantly enhanced to provide **per-contact personalized behavior**, task management, follow-up tracking, and intelligent conversation summaries. Each contact now has its own unique personality profile that evolves based on interactions.

## Architecture

### Core Components

#### 1. **AdminBotHandler** (`server/features/adminBotHandler.ts`)
The main orchestrator that manages all per-contact admin bot functionality.

**Key Features:**
- Per-contact personality profile management
- Adaptive personality learning from conversations
- Task extraction and tracking per contact
- Follow-up item management
- Conversation summarization
- Personalized response generation

#### 2. **ContactPersonality Interface**
Defines the personality profile for each contact:

```typescript
interface ContactPersonality {
  contactId: number;
  communicationStyle: "formal" | "casual" | "friendly" | "professional" | "humorous";
  tone: string[]; // e.g., ["warm", "supportive", "genuine"]
  responseLength: "concise" | "balanced" | "detailed";
  emojiUsage: "minimal" | "moderate" | "heavy";
  interests: string[];
  conversationTopics: string[];
  knownPreferences: Record<string, any>;
  behaviorPatterns: {
    responseTimePreference?: string; // "quick" or "thoughtful"
    frequencyOfContact?: "daily" | "weekly" | "occasional";
    favoriteGreetings?: string[];
    preferredCallToAction?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3. **Task Management per Contact**
Track tasks extracted from conversations:

```typescript
interface ContactTask {
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
```

#### 4. **Follow-Up Items**
Track follow-ups to bring up in future conversations:

```typescript
interface FollowUpItem {
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
```

#### 5. **Conversation Summary**
Comprehensive summary of interactions with each contact:

```typescript
interface ContactInformationSummary {
  contactId: number;
  summary: string;
  keyTopics: string[];
  recentInteractions: string[];
  importantDates?: { label: string; date: Date }[];
  relationshipStatus: string;
  lastUpdated: Date;
}
```

## How It Works

### 1. Message Reception & Processing

When a message is received from a contact:

```
Message Received
    ↓
Check Auto-Reply Setting
    ↓
Adapt Personality (based on new message)
    ↓
Extract Tasks & Follow-ups
    ↓
Generate Personalized Response
    ↓
Update Conversation Summary
    ↓
Send Reply & Save Message
```

### 2. Personality Adaptation

The system continuously learns from conversations:

```typescript
await adminBotHandler.analyzeAndAdaptPersonality(
  contactId,
  conversationHistory,
  newMessageContent
);
```

**What Gets Adapted:**
- Communication style preferences
- Tone preferences
- Response length preferences
- Emoji usage patterns
- Discovered interests and topics
- Behavioral patterns (quick vs. thoughtful responses)
- Preferred greetings and call-to-action

### 3. Task Extraction

Automatically extracts actionable items from conversations:

```typescript
const { tasks, followUps } = await adminBotHandler.extractTasksAndFollowUps(
  contactId,
  conversationHistory
);
```

**Types of Tasks Detected:**
- Reminders (e.g., "Remember to call John")
- Follow-up actions (e.g., "Follow up on the project")
- Orders/Purchases (e.g., "Buy milk")
- Payments due (e.g., "Pay the electricity bill")
- Research/Investigation needed

### 4. Conversation Summarization

Generates intelligent summaries after each conversation:

```typescript
const summary = await adminBotHandler.generateConversationSummary(
  contactId,
  conversationHistory
);
```

**Summary Includes:**
- Overall situation summary
- Key topics discussed
- Recent interactions
- Important dates mentioned
- Current relationship status

### 5. Personalized Response Generation

Uses the contact's personality profile to generate responses:

```typescript
const response = await adminBotHandler.generatePersonalizedResponse(
  contactId,
  messageContent,
  conversationHistory,
  identity
);
```

The system:
- References the contact's personality profile
- Maintains consistent tone and communication style
- Uses appropriate emoji frequency
- Respects preferred response length
- Incorporates known interests and preferences
- References previous conversations when relevant

## API Endpoints

### Personality Management

#### Get Contact Personality
```http
GET /api/admin-bot/personality/:contactId
```

Returns the current personality profile for a contact.

**Response:**
```json
{
  "contactId": 1,
  "communicationStyle": "friendly",
  "tone": ["warm", "supportive"],
  "responseLength": "balanced",
  "emojiUsage": "moderate",
  "interests": ["travel", "photography", "cooking"],
  "conversationTopics": ["vacation planning", "weekend plans"],
  "knownPreferences": {
    "favoriteFood": "Italian",
    "timezone": "EST"
  },
  "behaviorPatterns": {
    "responseTimePreference": "quick",
    "frequencyOfContact": "daily",
    "favoriteGreetings": ["Hey", "Hi"],
    "preferredCallToAction": "What's up?"
  },
  "createdAt": "2026-01-27T10:00:00Z",
  "updatedAt": "2026-01-28T15:30:00Z"
}
```

#### Update Contact Personality
```http
PATCH /api/admin-bot/personality/:contactId
```

Manually override personality settings.

**Request Body:**
```json
{
  "communicationStyle": "casual",
  "tone": ["fun", "supportive"],
  "interests": ["gaming", "music"],
  "knownPreferences": {
    "favoriteFood": "Japanese",
    "timezone": "PST"
  }
}
```

### Task Management

#### Get Contact Tasks
```http
GET /api/admin-bot/tasks/:contactId?status=pending
```

Retrieve all tasks for a contact, optionally filtered by status.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_1_1234567890_0",
      "contactId": 1,
      "title": "Call about project",
      "description": "Follow up on the Q1 project status",
      "status": "pending",
      "priority": "high",
      "category": "follow_up",
      "dueDate": "2026-01-29T17:00:00Z",
      "relatedTopics": ["project", "work"],
      "createdAt": "2026-01-27T10:15:00Z",
      "updatedAt": "2026-01-27T10:15:00Z"
    }
  ],
  "statistics": {
    "total": 5,
    "pending": 2,
    "inProgress": 1,
    "completed": 2
  }
}
```

#### Update Task Status
```http
PATCH /api/admin-bot/tasks/:contactId/:taskId
```

Update the status of a specific task.

**Request Body:**
```json
{
  "status": "in_progress"
}
```

### Follow-Up Management

#### Get Follow-Up Items
```http
GET /api/admin-bot/follow-ups/:contactId?status=pending
```

Retrieve all follow-up items for a contact.

**Response:**
```json
{
  "followUps": [
    {
      "id": "followup_1_1234567890_0",
      "contactId": 1,
      "subject": "Birthday celebration",
      "details": "John mentioned his birthday is coming up in March",
      "lastMentionedAt": "2026-01-27T10:20:00Z",
      "nextFollowUpDate": "2026-03-15T09:00:00Z",
      "status": "pending",
      "priority": "medium",
      "createdAt": "2026-01-27T10:20:00Z",
      "updatedAt": "2026-01-27T10:20:00Z"
    }
  ],
  "statistics": {
    "total": 3,
    "pending": 2,
    "inProgress": 1,
    "resolved": 0
  }
}
```

### Conversation Summary

#### Get Contact Summary
```http
GET /api/admin-bot/summary/:contactId
```

Retrieve the latest conversation summary for a contact.

**Response:**
```json
{
  "contactId": 1,
  "summary": "John is planning a trip to Japan in March. He's looking for recommendations on places to visit, especially temples and gardens. He's also mentioned some work challenges with his team.",
  "keyTopics": ["travel", "Japan", "team management", "work stress"],
  "recentInteractions": [
    "Asked for Japan trip recommendations",
    "Discussed team conflicts resolution",
    "Shared excitement about upcoming vacation"
  ],
  "importantDates": [
    {
      "label": "Birthday",
      "date": "1990-03-15"
    },
    {
      "label": "Anniversary",
      "date": "2015-06-20"
    }
  ],
  "relationshipStatus": "Close friend - very active engagement",
  "lastUpdated": "2026-01-28T15:45:00Z"
}
```

#### Regenerate Summary
```http
POST /api/admin-bot/summary/:contactId/regenerate
```

Force regeneration of the conversation summary based on current history.

### Complete Profile

#### Get Full Profile
```http
GET /api/admin-bot/profile/:contactId
```

Get comprehensive profile including personality, tasks, follow-ups, and summary.

**Response:**
```json
{
  "contact": {
    "id": 1,
    "name": "John",
    "remoteJid": "1234567890@s.whatsapp.net",
    "relationshipType": "close_friend",
    "relationshipLevel": 8,
    "platform": "whatsapp"
  },
  "personality": { /* ... */ },
  "tasks": [ /* ... */ ],
  "followUps": [ /* ... */ ],
  "summary": { /* ... */ }
}
```

#### Refresh Profile
```http
POST /api/admin-bot/profile/:contactId/refresh
```

Refresh all admin bot data for a contact (adapt personality, extract tasks, regenerate summary).

**Response:**
```json
{
  "personality": { /* ... */ },
  "newTasks": [ /* ... */ ],
  "newFollowUps": [ /* ... */ ],
  "summary": { /* ... */ }
}
```

## Default Personalities

The system creates default personalities based on relationship type:

### Family
- **Communication Style:** Friendly
- **Tone:** Warm, caring, respectful
- **Response Length:** Balanced
- **Emoji Usage:** Moderate
- **Behavior:** Thoughtful responses, weekly frequency

### Close Friend
- **Communication Style:** Casual
- **Tone:** Fun, supportive, genuine
- **Response Length:** Balanced
- **Emoji Usage:** Heavy
- **Behavior:** Quick responses, daily frequency

### Friend
- **Communication Style:** Friendly
- **Tone:** Warm, genuine
- **Response Length:** Balanced
- **Emoji Usage:** Moderate
- **Behavior:** Quick responses, weekly frequency

### Colleague
- **Communication Style:** Professional
- **Tone:** Respectful, clear, helpful
- **Response Length:** Concise
- **Emoji Usage:** Minimal
- **Behavior:** Quick responses, daily frequency

### Client
- **Communication Style:** Professional
- **Tone:** Respectful, solution-focused
- **Response Length:** Detailed
- **Emoji Usage:** Minimal
- **Behavior:** Quick responses, occasional frequency

### Acquaintance
- **Communication Style:** Friendly
- **Tone:** Polite, helpful
- **Response Length:** Concise
- **Emoji Usage:** Minimal
- **Behavior:** Thoughtful responses, occasional frequency

## Integration in Message Flow

The admin bot is automatically integrated into the message handling:

```typescript
// In server/whatsapp.ts
sock.ev.on('messages.upsert', async (m) => {
  // ... message extraction ...
  
  if (autoReplySetting?.value === 'true') {
    // Adapt personality
    await adminBotHandler.analyzeAndAdaptPersonality(
      contact.id,
      history,
      textContent
    );

    // Extract tasks and follow-ups
    const { tasks, followUps } = await adminBotHandler.extractTasksAndFollowUps(
      contact.id,
      history
    );

    // Generate personalized response
    replyContent = await adminBotHandler.generatePersonalizedResponse(
      contact.id,
      textContent,
      history,
      identity
    );

    // Update summary
    await adminBotHandler.generateConversationSummary(
      contact.id,
      history
    );

    // Send reply
    await sock?.sendMessage(remoteJid, { text: replyContent });
  }
});
```

## Storage

All admin bot data is stored using the existing storage system:

- **Personalities:** `admin_bot_personality_${contactId}` setting
- **Summaries:** `admin_bot_summary_${contactId}` setting
- **Tasks:** In-memory cache with backup to storage (can be extended)
- **Follow-ups:** In-memory cache with backup to storage (can be extended)

## Usage Examples

### Example 1: View Personality Profile
```bash
curl http://localhost:3000/api/admin-bot/personality/1
```

### Example 2: Get All Pending Tasks
```bash
curl http://localhost:3000/api/admin-bot/tasks/1?status=pending
```

### Example 3: Mark Task as Completed
```bash
curl -X PATCH http://localhost:3000/api/admin-bot/tasks/1/task_1_1234567890_0 \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

### Example 4: Get Full Contact Profile
```bash
curl http://localhost:3000/api/admin-bot/profile/1
```

### Example 5: Refresh All Contact Data
```bash
curl -X POST http://localhost:3000/api/admin-bot/profile/1/refresh
```

## Key Features Summary

✅ **Per-Contact Personality:** Each contact has unique communication preferences  
✅ **Adaptive Learning:** Personality evolves based on conversation patterns  
✅ **Task Extraction:** Automatically detects and tracks action items  
✅ **Follow-Up Management:** Intelligent follow-up item tracking  
✅ **Conversation Summaries:** AI-generated summaries of interactions  
✅ **Personalized Responses:** Messages tailored to each contact's preferences  
✅ **Comprehensive API:** Full CRUD operations for all admin bot features  
✅ **Default Profiles:** Smart defaults based on relationship type  
✅ **Seamless Integration:** Works automatically with the WhatsApp message handler  

## Future Enhancements

Potential improvements to consider:

1. **Persistent Storage:** Migrate tasks and follow-ups to database
2. **Predictive Reminders:** Auto-generate reminders based on patterns
3. **Sentiment Tracking:** Track mood and adjust responses accordingly
4. **Interest Evolution:** Track how interests change over time
5. **Preference Learning:** Learn communication preferences beyond personality
6. **Multi-language Support:** Adapt communication style per language
7. **Context Awareness:** Consider time, day, season in personality
8. **Analytics Dashboard:** Visual representation of personality metrics
