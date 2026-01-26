import { contacts, messages, settings, type InsertContact, type InsertMessage, type InsertSetting, type Contact, type Message, type Setting } from "@shared/schema";
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
}

export const storage = new DatabaseStorage();
