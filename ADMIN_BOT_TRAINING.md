# Admin Bot Training Guide

This document explains how to train and extend the WhatsApp AI Agent using conversational trainer commands. The trainer is a WhatsApp contact marked as a trainer (via Admin UI or API). Trainers can instruct the agent to update core identity, add persistent notes, add raw data, and create target-specific instructions.

**Location:** [ADMIN_BOT_TRAINING.md](ADMIN_BOT_TRAINING.md)

---

## Overview
- The bot is designed to represent you (the user) and act with your voice, personality, tasks and relationship management.
- Trainers are authorized contacts who can teach the bot via chat messages using simple commands and multi-message blocks.
- Notes and trainer instructions are persisted and used as background knowledge for future replies.

## Command Prefixes
Supported prefixes for commands (classic WhatsApp bot style):
- `@COMMAND` (e.g. `@IDENTITY`) — original style
- `/COMMAND` (e.g. `/identity`) — slash-style
- `!COMMAND`, `#COMMAND` — alternative prefixes

Commands are case-insensitive for keyword matching (e.g., `@identity`, `/IDENTITY`).

---

## Trainer Command Types
1. Identity management (`IDENTITY`) — update or merge core identity
2. Raw data management (`RAW`) — append arbitrary structured data under a key
3. Trainer instructions (`@INSTRUCT`, multi-message blocks) — record instructions globally or targeting a contact
4. Auto-notes — periodic summarization of recent messages into notes (configurable)

### 1) `IDENTITY` Commands
Use these to teach the agent about your identity, tone, preferences, and values.

- `/identity set name=Your Name`
  - Sets top-level `name` in core identity.

- `/identity set interests=Photography,Travel,Food`
  - Sets comma-separated interests.

- `/identity merge {"personalityTraits":{"communicationStyle":"casual","tone":["witty","warm"]}}`
  - Merges provided JSON into the existing core identity.

- `/identity add_interest Photography`
  - Adds `Photography` to the `interests` array.

- `/identity remove_interest Photography`
  - Removes `Photography` from interests.

Notes:
- `merge` expects valid JSON object.
- `set` will parse JSON for values that look like arrays or objects.

### 2) `RAW` Commands
Store arbitrary structured data trainers want the bot to remember (e.g., client lists, product SKUs).

- `/raw add customers [{"id":1,"name":"Acme"}]`
  - Appends the provided JSON or raw payload under the key `customers`.

- `/raw add prefs {"timezone":"PKT","workHours":"9-18"}`
  - Trainers can append multiple records; stored items are kept as an array.

Access raw data via the Admin API or `AdminBotHandler.getRawData(key)` in code.

### 3) Inline Trainer Instruction (Legacy)
- `@INSTRUCT <instruction>`
  - Example: `@INSTRUCT Always prioritize polite timely follow-ups.`
  - Optionally include a numeric contact id to target: `@INSTRUCT @123: <instruction>`

### 4) Multi-Message Trainer Blocks (Recommended)
Use blocks when your instruction spans multiple messages.

- Start a block:

  `@<targetKey>:start instructions -`

  - `<targetKey>` may be phone digits, numeric contact id, `id:123`, or contact name.
  - Example: `@923009285423:start instructions -` or `@15:start instructions -`

- Send multiple messages (the trainer can send any number of messages).
- End the block:

  `@<targetKey>:end instructions -`

Behavior:
- The server collects messages between `start` and `end` and summarizes them via the AI.
- The summary is stored as a trainer instruction (`recordTrainerInstruction`).
- If the target resolves to a contact, special instructions for that contact are also set (`setContactSpecialInstructions`).
- Trainer receives acknowledgement with stored summary.

---

## Auto-Notes (Periodic Summaries)
- The server keeps an in-memory per-contact message counter.
- After `notes_every_n_messages` (default `10`), the last N messages are summarized into JSON notes by the AI.
- Notes are appended via `appendContactNotes(contactId, { summary, details })` and persisted under `admin_bot_notes_<contactId>`.
- The most recent notes are included in the system prompt for future AI responses so the bot remembers key context without resending full conversation history.

To change frequency, update setting `notes_every_n_messages` via Admin UI or settings API (value must be numeric).

---

## How Trainer Commands Are Protected
- Only contacts marked as trainers (Admin UI toggle or `addTrainerContact`) can run these commands. The server checks trainer status before applying commands.

---

## Example Workflows and Sample Conversations

### Example 1 — Quick identity change
Trainer toggled as trainer and sends:

Trainer: `/identity set name=Ahmed Noman`

Bot (ack): `Command applied: Identity updated. Current name: Ahmed Noman`

Now the agent will use `Ahmed Noman` as the name when crafting replies.

### Example 2 — Merge personality JSON
Trainer:
```
/identity merge {"personalityTraits":{"communicationStyle":"casual","tone":["friendly","direct"]}}
```
Bot (ack): `Command applied: Identity merged. Current name: Ahmed Noman`

The agent now uses the merged personality traits in its system prompt.

### Example 3 — Add raw customer data
Trainer:
```
/raw add customers [{"id":101,"name":"Acme Ltd","phone":"923001112233"}]
```
Bot: `Raw data appended under key customers`

Now the raw customer list can be retrieved by the bot or Admin UI for targeted behavior.

### Example 4 — Multi-message instruction for a contact
Trainer:
```
@923009285423:start instructions -
Treat this contact as a high-value client.
Always ask for project budgets before suggesting vendors.
Prioritize meeting scheduling within 48 hours.
@923009285423:end instructions -
```
Bot: `Instruction block summarized and saved for contact 923009285423` (and the summary text)

The summary will be used to set `admin_bot_special_instructions_<contactId>` so future replies follow these rules.

### Example 5 — Periodic notes creation
After 10 messages between the bot and a contact, the bot will run an internal summarization and store notes:
- Bot sends: `Saved 2 note(s) for contact John Doe.`

You can view notes via Admin API or the database setting `admin_bot_notes_<contactId>`.

---

## Recommended Trainer Command Cheat Sheet
- `/identity set key=value` — set simple fields (name, values, interests)
- `/identity merge {json}` — merge JSON into core identity
- `/identity add_interest Topic` — add interest
- `/identity remove_interest Topic` — remove interest
- `/raw add key <json>` — append raw data to key
- `@INSTRUCT <instruction>` — quick instruction
- `@<target>:start instructions -` … messages … `@<target>:end instructions -` — multi-message instruction block

---

## Developer Notes (APIs and storage keys)
- Trainer instructions stored under `admin_bot_trainer_instructions_<targetId>` (targetId = 0 for global)
- Contact special instructions: `admin_bot_special_instructions_<contactId>`
- Contact notes: `admin_bot_notes_<contactId>`
- Raw persistent data: `admin_bot_raw_<key>`
- Core identity stored in `core_identity` table (use `storage.getIdentity()` / `storage.updateIdentity()`)

Programmatic helpers (see `server/features/adminBotHandler.ts`):
- `recordTrainerInstruction(trainerContactId, instruction, targetContactId?)`
- `appendContactNotes(contactId, {summary, details})`
- `getContactNotes(contactId)`
- `appendRawData(key, data)`
- `getRawData(key)`
- `applyTrainerIdentityCommand(trainerContactId, commandText)`

---

## Troubleshooting
- If a command returns `Unrecognized identity command.`, check syntax and ensure the sending contact is marked as a trainer.
- If `merge` JSON fails to parse, verify JSON is valid; prefer compact one-line JSON for single-message commands.
- If notes are not generated, check `notes_every_n_messages` setting and ensure AI API keys are configured.

---

## Next Steps / Enhancements
- Add Admin UI pages to view and manage `admin_bot_notes_<contactId>` and `admin_bot_raw_<key>` entries.
- Allow trainer commands via REST API (authenticated trainer tokens) for bulk uploads.
- Add tests for command parsing and E2E trainer flows.

---

If you want, I can also:
- Create a sample `core_identity` JSON tuned to your style.
- Start the dev server and simulate trainer commands to demonstrate the flow.

