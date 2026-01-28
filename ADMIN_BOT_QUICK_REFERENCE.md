# Admin Bot - Quick Reference

## 🎯 Core Features

### Per-Contact Personality
Each contact has unique communication preferences that evolve automatically.

**GET** `/api/admin-bot/personality/:contactId` - View personality  
**PATCH** `/api/admin-bot/personality/:contactId` - Update personality

### Task Management
Automatically extracts and tracks action items from conversations.

**GET** `/api/admin-bot/tasks/:contactId` - List tasks  
**PATCH** `/api/admin-bot/tasks/:contactId/:taskId` - Update task status

### Follow-ups
Intelligently identifies topics to follow up on later.

**GET** `/api/admin-bot/follow-ups/:contactId` - List follow-ups

### Conversation Summaries
AI-generated summaries of interactions with each contact.

**GET** `/api/admin-bot/summary/:contactId` - Get summary  
**POST** `/api/admin-bot/summary/:contactId/regenerate` - Regenerate

### Complete Profile
Get everything about a contact in one call.

**GET** `/api/admin-bot/profile/:contactId` - Get profile  
**POST** `/api/admin-bot/profile/:contactId/refresh` - Refresh all data

---

## 📋 Personality Traits

### Communication Style
- `formal` - Professional and proper
- `casual` - Relaxed and informal
- `friendly` - Warm and approachable
- `professional` - Business-focused
- `humorous` - Fun and joking

### Tone (can be multiple)
Examples: warm, caring, fun, supportive, genuine, respectful, clear

### Response Length
- `concise` - Short and to the point
- `balanced` - Medium length
- `detailed` - Comprehensive

### Emoji Usage
- `minimal` - Rarely or never
- `moderate` - Sometimes
- `heavy` - Frequently

### Behavior Patterns
- `responseTimePreference` - "quick" or "thoughtful"
- `frequencyOfContact` - "daily", "weekly", "occasional"
- `favoriteGreetings` - Array of preferred greetings
- `preferredCallToAction` - How to end messages

---

## 🎁 Default Profiles by Relationship

| Relationship | Style | Emoji | Response |
|---|---|---|---|
| Family | Friendly | Moderate | Balanced |
| Close Friend | Casual | Heavy | Balanced |
| Friend | Friendly | Moderate | Balanced |
| Colleague | Professional | Minimal | Concise |
| Client | Professional | Minimal | Detailed |
| Acquaintance | Friendly | Minimal | Concise |

---

## 📊 Task Properties

- **id** - Unique identifier
- **contactId** - Which contact
- **title** - Task name
- **description** - Details
- **status** - pending, in_progress, completed
- **priority** - low, medium, high, urgent
- **category** - Task type (reminder, follow_up, order, payment, etc.)
- **dueDate** - When it's due
- **relatedTopics** - Associated topics

---

## 🔄 Follow-up Properties

- **id** - Unique identifier
- **contactId** - Which contact
- **subject** - What to follow up about
- **details** - Context
- **nextFollowUpDate** - When to bring it up
- **status** - pending, in_progress, resolved
- **priority** - low, medium, high

---

## 📝 Summary Properties

- **summary** - Overall interaction summary
- **keyTopics** - Main subjects discussed
- **recentInteractions** - Latest news/actions
- **importantDates** - Birthdays, anniversaries, etc.
- **relationshipStatus** - Current relationship state
- **lastUpdated** - When summary was generated

---

## 🔍 API Query Examples

### Filter tasks by status
```
GET /api/admin-bot/tasks/1?status=pending
GET /api/admin-bot/tasks/1?status=in_progress
GET /api/admin-bot/tasks/1?status=completed
```

### Filter follow-ups by status
```
GET /api/admin-bot/follow-ups/1?status=pending
GET /api/admin-bot/follow-ups/1?status=in_progress
GET /api/admin-bot/follow-ups/1?status=resolved
```

### Update task status
```bash
curl -X PATCH /api/admin-bot/tasks/1/task_id \
  -d '{"status": "completed"}'
```

### Update personality
```bash
curl -X PATCH /api/admin-bot/personality/1 \
  -d '{
    "communicationStyle": "casual",
    "interests": ["gaming", "music"]
  }'
```

---

## 🚀 Common Tasks

### Monitor a new contact
```bash
# 1. Get their personality
curl /api/admin-bot/personality/1

# 2. Check tasks
curl /api/admin-bot/tasks/1

# 3. Read summary
curl /api/admin-bot/summary/1
```

### Complete a task
```bash
curl -X PATCH /api/admin-bot/tasks/1/task_123 \
  -d '{"status": "completed"}'
```

### Follow up with a contact
```bash
# 1. Get follow-ups
curl /api/admin-bot/follow-ups/1

# 2. Mark as done
# (Update status when completed)
```

### Get full profile
```bash
curl /api/admin-bot/profile/1
```

### Refresh all data
```bash
curl -X POST /api/admin-bot/profile/1/refresh
```

---

## 💡 Tips

1. **Personalities adapt automatically** - No need to manually update unless desired
2. **Tasks are extracted automatically** - Check regularly for action items
3. **Summaries auto-update** - Get fresh summaries anytime
4. **Use status filtering** - Filter tasks/follow-ups by status for better organization
5. **Refresh profiles periodically** - Keep summaries and personality up-to-date
6. **Monitor key topics** - Check keyTopics in summary to understand interests
7. **Set due dates** - Tasks with due dates help with planning
8. **Mark follow-ups resolved** - Keep follow-up list clean and organized

---

## 🔗 Related Files

- **Full Documentation:** `ADMIN_BOT_DOCUMENTATION.md`
- **Implementation Details:** `ADMIN_BOT_IMPLEMENTATION.md`
- **Final Summary:** `ADMIN_BOT_FINAL_SUMMARY.md`

---

## ❓ FAQ

**Q: Will personality change automatically?**
A: Yes! Each message helps the bot understand preferences better.

**Q: Can I override the learned personality?**
A: Yes! Use PATCH to update any personality traits manually.

**Q: Are tasks stored permanently?**
A: Tasks are cached in memory. Consider extending to database for persistence.

**Q: How often should I regenerate summaries?**
A: Automatically updated on each message. Manual regeneration available anytime.

**Q: Can I customize the defaults?**
A: Yes! Update personality via API, or modify defaults in AdminBotHandler.

**Q: What if the AI doesn't extract a task?**
A: Manually create tasks via API if auto-extraction misses something.

**Q: How are follow-ups different from tasks?**
A: Follow-ups are conversational topics to bring up later. Tasks are action items.

---

## 🎯 Status Meanings

### Task Status
- **pending** - Not started yet
- **in_progress** - Currently working on it
- **completed** - Finished

### Follow-up Status
- **pending** - Not yet addressed
- **in_progress** - Currently discussing
- **resolved** - Completed

---

## 🔐 Data Privacy

- All data stored in your database
- API runs on your server
- No external data sharing
- Contact information stays private

---

## 📞 Quick Debugging

**No tasks showing?**
- Check status filter
- Verify conversation has action items
- Try refreshing profile

**Summary seems outdated?**
- Manually regenerate via `/regenerate` endpoint
- Check lastUpdated timestamp
- Review recent messages

**Personality not as expected?**
- Check current personality via GET
- Update manually if needed
- Review messages bot has seen

---

## 🎉 Get Started!

1. Send a message to your contact
2. View their personality: `GET /api/admin-bot/personality/1`
3. Check tasks: `GET /api/admin-bot/tasks/1`
4. Read summary: `GET /api/admin-bot/summary/1`
5. Manage with API endpoints

That's it! The system works automatically in the background. 🚀
