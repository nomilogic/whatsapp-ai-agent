# Enhanced Features Implementation - API Documentation

## Overview

This document describes the new enhanced features API endpoints added to the WhatsApp AI Agent system. These endpoints provide comprehensive memory management, task tracking, conversation analysis, proactive messaging, and analytics capabilities.

## Base URL
```
/api
```

---

## Memory Management Endpoints

### Get All Memories for Contact
```http
GET /api/memory/:contactId
```

Returns all memory insights for a specific contact.

**Parameters:**
- `contactId` (path): Contact ID

**Response:**
```json
{
  "contactId": 1,
  "memories": [],
  "insights": {
    "topCategories": ["relationships", "personal_info"],
    "recentInsights": []
  }
}
```

---

### Store a Memory
```http
POST /api/memory/:contactId
```

Create and store a new memory entry for a contact.

**Parameters:**
- `contactId` (path): Contact ID

**Request Body:**
```json
{
  "content": "User prefers coffee over tea",
  "category": "preferences"
}
```

**Response:**
```json
{
  "id": "mem_123456",
  "contactId": 1,
  "content": "User prefers coffee over tea",
  "category": "preferences",
  "priority": "medium",
  "keywords": ["coffee", "tea", "prefer"],
  "createdAt": "2026-01-27T18:40:00Z",
  "updatedAt": "2026-01-27T18:40:00Z"
}
```

---

### Search Memories
```http
GET /api/memory/:contactId/search?q=<query>
```

Search memories for a contact using keywords.

**Parameters:**
- `contactId` (path): Contact ID
- `q` (query): Search query

**Response:**
```json
[
  {
    "id": "mem_123456",
    "contactId": 1,
    "content": "User prefers coffee over tea",
    "category": "preferences",
    "priority": "medium",
    "relevanceScore": 0.95
  }
]
```

---

### Get Memories by Category
```http
GET /api/memory/:contactId/category/:category
```

Retrieve all memories in a specific category.

**Parameters:**
- `contactId` (path): Contact ID
- `category` (path): Memory category (personal_info, preferences, past_conversations, relationships, important_dates, tasks_and_goals, notes)

**Response:**
```json
[
  {
    "id": "mem_123456",
    "contactId": 1,
    "content": "Birthday: January 15",
    "category": "important_dates",
    "priority": "critical",
    "createdAt": "2026-01-27T18:40:00Z"
  }
]
```

---

## Task Management Endpoints

### Get Tasks for Contact
```http
GET /api/tasks/:contactId?status=<status>
```

Retrieve all tasks for a contact with optional filtering.

**Parameters:**
- `contactId` (path): Contact ID
- `status` (query, optional): Filter by status (pending, in_progress, completed, blocked, cancelled)

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_123456",
      "contactId": 1,
      "description": "Call about meeting",
      "type": "follow_up",
      "status": "pending",
      "priority": "high",
      "deadline": "2026-01-28T18:00:00Z",
      "createdAt": "2026-01-27T18:40:00Z"
    }
  ],
  "statistics": {
    "total": 5,
    "pending": 2,
    "inProgress": 1,
    "completed": 2,
    "blocked": 0,
    "overdue": 0,
    "byPriority": {
      "urgent": 0,
      "high": 2,
      "medium": 2,
      "low": 1
    }
  }
}
```

---

### Create a New Task
```http
POST /api/tasks/:contactId
```

Create a new task for a contact.

**Parameters:**
- `contactId` (path): Contact ID

**Request Body:**
```json
{
  "description": "Send project proposal",
  "type": "custom",
  "priority": "high",
  "deadline": "2026-01-30T17:00:00Z"
}
```

**Response:**
```json
{
  "id": "task_123456",
  "contactId": 1,
  "description": "Send project proposal",
  "type": "custom",
  "status": "pending",
  "priority": "high",
  "deadline": "2026-01-30T17:00:00Z",
  "reminders": [],
  "tags": [],
  "createdAt": "2026-01-27T18:40:00Z"
}
```

---

### Update Task Status
```http
PATCH /api/tasks/:taskId
```

Update the status of a task.

**Parameters:**
- `taskId` (path): Task ID

**Request Body:**
```json
{
  "status": "completed"
}
```

**Response:**
```json
{
  "id": "task_123456",
  "contactId": 1,
  "description": "Send project proposal",
  "type": "custom",
  "status": "completed",
  "priority": "high",
  "updatedAt": "2026-01-27T19:00:00Z"
}
```

---

### Get Upcoming Tasks
```http
GET /api/tasks/upcoming?hours=24
```

Retrieve tasks due within a specified time period.

**Parameters:**
- `hours` (query, optional): Number of hours to look ahead (default: 24)

**Response:**
```json
[
  {
    "id": "task_123456",
    "contactId": 1,
    "description": "Team meeting",
    "type": "follow_up",
    "status": "pending",
    "priority": "high",
    "deadline": "2026-01-27T20:00:00Z"
  }
]
```

---

## Conversation Analysis Endpoints

### Analyze Conversation
```http
POST /api/conversations/analyze/:contactId
```

Analyze a conversation thread to extract insights and suggestions.

**Parameters:**
- `contactId` (path): Contact ID

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I need help with my project"
    },
    {
      "role": "assistant",
      "content": "I'd be happy to help!"
    }
  ]
}
```

**Response:**
```json
{
  "analysis": {
    "category": "problem",
    "tasks": [
      {
        "description": "Help with project",
        "type": "custom",
        "priority": "high"
      }
    ],
    "keywords": ["project", "help"],
    "sentiment": "neutral",
    "actionRequired": true,
    "summary": "User is asking for project assistance"
  },
  "suggestions": {
    "tone": "professional",
    "priority": "high",
    "suggestedResponses": []
  }
}
```

---

## Messaging Endpoints

### Check if Should Send Proactive Message
```http
GET /api/messaging/proactive/:contactId
```

Determine if a proactive message should be sent to a contact.

**Parameters:**
- `contactId` (path): Contact ID

**Response:**
```json
{
  "shouldSend": true,
  "reason": "Last interaction was 5 days ago",
  "messageType": "greeting",
  "confidence": 0.85
}
```

---

### Get Message Suggestion
```http
GET /api/messaging/suggest/:contactId?type=greeting
```

Generate a contextual message suggestion for a contact.

**Parameters:**
- `contactId` (path): Contact ID
- `type` (query): Message type (greeting, check_in, follow_up, reminder)

**Response:**
```json
{
  "message": "Hey! How have you been? It's been a while!",
  "tone": "casual",
  "confidence": 0.92
}
```

---

### Get Messaging Strategy
```http
GET /api/messaging/strategy/:relationshipType
```

Retrieve the messaging strategy for a relationship type.

**Parameters:**
- `relationshipType` (path): Relationship type (family, close_friend, friend, colleague, client, acquaintance)

**Response:**
```json
{
  "relationshipType": "friend",
  "tone": "casual",
  "frequency": {
    "baseIntervalHours": 48,
    "variationPercent": 30,
    "optimalTimes": {
      "weekday": {
        "start": 9,
        "end": 21
      }
    }
  },
  "recommendedTopics": ["casual_chat", "interests", "shared_experiences"],
  "tabooTopics": ["politics", "sensitive_personal_info"]
}
```

---

## Analytics Endpoints

### Get Interaction Metrics
```http
GET /api/analytics/metrics/:contactId
```

Retrieve interaction metrics for a contact.

**Parameters:**
- `contactId` (path): Contact ID

**Response:**
```json
{
  "totalMessages": 45,
  "averageResponseTime": 12.5,
  "messageFrequency": 2.1,
  "lastInteractionDaysAgo": 3,
  "conversationTopics": ["work", "family", "personal"],
  "sentimentTrend": "positive"
}
```

---

### Get Relationship Insights
```http
GET /api/analytics/insights/:contactId
```

Analyze relationship strength and generate insights.

**Parameters:**
- `contactId` (path): Contact ID

**Response:**
```json
{
  "strengthScore": 78,
  "connectionType": "friend",
  "communicationStyle": "Regular",
  "importanceScore": 65,
  "engagementLevel": "high",
  "recommendations": [
    "Maintain current communication patterns",
    "Consider a deeper conversation about goals"
  ]
}
```

---

### Get Weekly Insights
```http
GET /api/analytics/weekly/:contactId
```

Retrieve weekly conversation insights for a contact.

**Parameters:**
- `contactId` (path): Contact ID

**Response:**
```json
{
  "topics": [
    {
      "topic": "work",
      "frequency": 8
    },
    {
      "topic": "family",
      "frequency": 5
    }
  ],
  "averageMessagesPerDay": 3.2,
  "mostActiveDay": "Wednesday",
  "sentimentDistribution": {
    "positive": 60,
    "negative": 10,
    "neutral": 30
  },
  "actionItems": 3,
  "completedTasks": 2
}
```

---

### Get Ranked Contacts
```http
GET /api/analytics/ranked
```

Get all contacts ranked by interaction strength.

**Response:**
```json
[
  {
    "contactId": 1,
    "name": "Alice",
    "interactionScore": 92,
    "lastInteraction": "2026-01-27T10:30:00Z"
  },
  {
    "contactId": 2,
    "name": "Bob",
    "interactionScore": 78,
    "lastInteraction": "2026-01-25T14:20:00Z"
  }
]
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Query parameter 'q' is required"
}
```

### 404 Not Found
```json
{
  "error": "Contact not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

---

## Memory Categories

- `personal_info`: Personal information about the contact
- `preferences`: Likes, dislikes, and preferences
- `past_conversations`: Important conversation history
- `relationships`: Family and relationship information
- `important_dates`: Birthdays, anniversaries, and significant dates
- `tasks_and_goals`: Goals, tasks, and objectives
- `notes`: General notes and observations

## Task Types

- `reminder`: Simple reminder
- `follow_up`: Follow-up action required
- `order`: Order or purchase
- `payment`: Payment due
- `investigation`: Investigation or research needed
- `custom`: Custom task type

## Task Status

- `pending`: Not yet started
- `in_progress`: Currently being worked on
- `completed`: Finished
- `blocked`: Blocked/cannot proceed
- `cancelled`: Cancelled

## Task Priority

- `low`: Low priority
- `medium`: Medium priority
- `high`: High priority
- `urgent`: Urgent/critical

---

## Implementation Notes

### Memory System
The memory management system uses an in-memory storage with keyword-based indexing for semantic-like search capabilities. Memories can be auto-categorized and tracked with expiration dates.

### Task Management
Tasks are automatically extracted from conversation text using pattern matching. The system detects natural language patterns like "need to", "should", "reminder:", "follow up on:", etc.

### Conversation Analysis
Conversations are categorized into 8 types: greeting, question, information, planning, problem, celebration, casual, formal, and urgent. Each analysis includes automatic task extraction and sentiment analysis.

### Proactive Messaging
The messaging system provides relationship-aware communication recommendations based on communication frequency profiles and relationship type. Different strategies are used for family, close friends, friends, colleagues, clients, and acquaintances.

### Analytics Engine
The analytics system tracks interaction metrics, relationship strength, communication patterns, and provides recommendations for improving relationships based on multi-factor scoring algorithms.

---

## Integration Points

These endpoints integrate with:
- **WhatsApp Message Handler** (`server/whatsapp.ts`): Processes incoming messages
- **Database Storage** (`server/storage.ts`): Persists contacts, messages, and settings
- **Gemini API**: Used for enhanced conversation analysis and response generation

---

## Future Enhancements

- [ ] Vector database integration for semantic search (replacing keyword-based search)
- [ ] Persistent task scheduling (replacing in-memory timers)
- [ ] Database persistence for memory entries
- [ ] Advanced NLP for better task and sentiment extraction
- [ ] Machine learning-based relationship strength prediction
- [ ] Real-time notification system for task reminders
- [ ] Dashboard UI for analytics visualization

