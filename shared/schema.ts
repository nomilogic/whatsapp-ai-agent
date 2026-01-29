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

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceName: text("device_name").notNull().unique(), // e.g., 'main', 'secondary', 'business'
  phoneNumber: text("phone_number"), // WhatsApp phone number
  isActive: boolean("is_active").default(true), // Enable/disable without deletion
  connectionStatus: text("connection_status").default("disconnected"), // disconnected|connecting|connected
  qrCode: text("qr_code"), // Current QR code (base64 PNG data)
  lastConnected: timestamp("last_connected"),
  lastError: text("last_error"), // Error messages
  authPath: text("auth_path").default("auth_info_baileys"), // Path for auth credentials
  metadata: jsonb("metadata"), // Device-specific metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const devicesRelations = relations(devices, ({ many }) => ({
  contacts: many(contacts), // Contacts connected through this device
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

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export * from "./models/chat";

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
