import { contacts, messages, settings, coreIdentity, tasks, type InsertContact, type InsertMessage, type InsertSetting, type InsertCoreIdentity, type InsertTask, type Contact, type Message, type Setting, type CoreIdentity, type Task } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByRemoteJid(remoteJid: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact>;

  // Messages
  getMessages(contactId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  updateSetting(key: string, value: string): Promise<Setting>;
  initializeDefaultSettings(): Promise<void>;

  // Identity
  getIdentity(): Promise<CoreIdentity | undefined>;
  updateIdentity(identity: InsertCoreIdentity): Promise<CoreIdentity>;

  // Tasks
  getTasks(contactId?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
}

export class DatabaseStorage implements IStorage {
  async getContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(desc(contacts.lastMessageAt));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async getContactByRemoteJid(remoteJid: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.remoteJid, remoteJid));
    return contact;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: number, update: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts)
      .set(update)
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  async getMessages(contactId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.contactId, contactId))
      .orderBy(messages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    
    // Update contact last message timestamp
    await db.update(contacts)
      .set({ lastMessageAt: new Date() })
      .where(eq(contacts.id, insertMessage.contactId));

    return message;
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));
    
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  async initializeDefaultSettings(): Promise<void> {
    const defaults = [
      { key: "system_prompt", value: "You are a helpful assistant on WhatsApp. Keep your responses concise and friendly." },
      { key: "ai_provider", value: "gemini" },
      { key: "gemini_model", value: "gemini-2.5-flash" },
      { key: "openai_model", value: "gpt-4o" },
      { key: "auto_reply", value: "true" },
    ];

    for (const setting of defaults) {
      const existing = await this.getSetting(setting.key);
      if (!existing) {
        await this.updateSetting(setting.key, setting.value);
      }
    }
  }

  async getIdentity(): Promise<CoreIdentity | undefined> {
    const [identity] = await db.select().from(coreIdentity);
    return identity;
  }

  async updateIdentity(insertIdentity: InsertCoreIdentity): Promise<CoreIdentity> {
    const existing = await this.getIdentity();
    if (existing) {
      const [updated] = await db.update(coreIdentity)
        .set(insertIdentity)
        .where(eq(coreIdentity.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(coreIdentity)
        .values(insertIdentity)
        .returning();
      return created;
    }
  }

  async getTasks(contactId?: number): Promise<Task[]> {
    const query = db.select().from(tasks);
    if (contactId) {
      return await query.where(eq(tasks.contactId, contactId)).orderBy(desc(tasks.createdAt));
    }
    return await query.orderBy(desc(tasks.createdAt));
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: number, update: Partial<InsertTask>): Promise<Task> {
    const [task] = await db.update(tasks)
      .set(update)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }
}

export const storage = new DatabaseStorage();
