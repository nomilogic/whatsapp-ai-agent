import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  remoteJid: text("remote_jid").notNull().unique(), // WhatsApp ID (e.g., 1234567890@s.whatsapp.net)
  name: text("name"),
  pushName: text("push_name"),
  platform: text("platform").default("whatsapp"),
  type: text("type").default("individual"), // individual or group
  relationshipType: text("relationship_type"), // close_friend|business|casual|family|client
  relationshipLevel: integer("relationship_level").default(1),
  metadata: jsonb("metadata"), // For any extra WhatsApp info
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  role: text("role").notNull(), // 'user' (received) or 'assistant' (sent) or 'system'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  whatsappId: text("whatsapp_id"), // Message ID from Baileys
  status: text("status").default("sent"), // sent, delivered, read, failed
  sentiment: text("sentiment"),
  intent: text("intent"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g., 'openai_api_key', 'system_prompt', 'auto_reply'
  value: text("value").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const coreIdentity = pgTable("core_identity", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  personalityTraits: jsonb("personality_traits").notNull(),
  values: text("values").array(),
  interests: text("interests").array(),
  knowledgeDomains: text("knowledge_domains").array(),
  dailySchedule: jsonb("daily_schedule"),
  conversationRules: jsonb("conversation_rules"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // reminder|follow_up|order|payment|investigation
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  description: text("description").notNull(),
  status: text("status").default("pending").notNull(),
  priority: text("priority").default("medium").notNull(),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const contactsRelations = relations(contacts, ({ many }) => ({
  messages: many(messages),
  tasks: many(tasks),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  contact: one(contacts, {
    fields: [messages.contactId],
    references: [contacts.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertContactSchema = createInsertSchema(contacts).omit({ 
  id: true, 
  lastMessageAt: true, 
  createdAt: true 
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true, 
  timestamp: true 
});

export const insertSettingSchema = createInsertSchema(settings).omit({ 
  id: true, 
  updatedAt: true 
});

export const insertCoreIdentitySchema = createInsertSchema(coreIdentity).omit({
  id: true
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true
});

// === EXPLICIT API CONTRACT TYPES ===

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type CoreIdentity = typeof coreIdentity.$inferSelect;
export type InsertCoreIdentity = z.infer<typeof insertCoreIdentitySchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// API Request/Response Types

export type AgentStatus = {
  connected: boolean;
  qrCode?: string; // Base64 QR code or terminal string
  connecting: boolean;
  lastError?: string;
};

export type SendMessageRequest = {
  content: string;
};

export type UpdateSettingRequest = {
  value: string;
};
