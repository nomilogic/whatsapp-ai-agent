import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupWhatsApp } from "./whatsapp";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import enhancedFeaturesRouter from "./routes/enhancedFeatures";
import adminBotRouter, { initializeAdminBotRoutes } from "./routes/adminBot";
import { AdminBotHandler } from "./features/adminBotHandler";
import { initializeDeviceManager } from "./services/deviceManager";
import { registerDeviceRoutes } from "./routes/deviceRoutes";
import Router from "express";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register Replit AI Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Initialize Device Manager for multi-device support
  const deviceManager = initializeDeviceManager(storage);
  const deviceRouter = Router();
  registerDeviceRoutes(deviceRouter, storage);
  app.use(deviceRouter);

  // Initialize Admin Bot Handler
  const adminBotHandler = new AdminBotHandler(
    storage,
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );
  initializeAdminBotRoutes(adminBotHandler);

  // Register Enhanced Features Routes (Memory, Tasks, Analytics, Messaging)
  app.use("/api", enhancedFeaturesRouter);

  // Register Admin Bot Routes (Personality, Tasks, Follow-ups, Summaries)
  app.use("/api/admin-bot", adminBotRouter);

  // Initialize WhatsApp Service
  const whatsAppService = await setupWhatsApp(storage);

  // Status Endpoint
  app.get(api.status.get.path, (req, res) => {
    res.json(whatsAppService.getStatus());
  });

  // Contacts
  app.get(api.contacts.list.path, async (req, res) => {
    const contacts = await storage.getContacts();
    res.json(contacts);
  });

  app.get(api.contacts.get.path, async (req, res) => {
    const contact = await storage.getContact(Number(req.params.id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  });

  // Messages
  app.get(api.messages.list.path, async (req, res) => {
    const messages = await storage.getMessages(Number(req.params.id));
    res.json(messages);
  });

  app.post(api.messages.send.path, async (req, res) => {
    try {
      const { content } = api.messages.send.input.parse(req.body);
      const contactId = Number(req.params.id);
      
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });

      // Send via WhatsApp
      await whatsAppService.sendMessage(contact.remoteJid, content);

      // Store in DB
      const message = await storage.createMessage({
        contactId,
        role: "assistant",
        content,
        status: "sent"
      });

      res.status(201).json(message);
    } catch (err) {
      console.error("Failed to send message:", err);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Settings
  app.get(api.settings.list.path, async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch(api.settings.update.path, async (req, res) => {
    const { key } = req.params;
    const { value } = api.settings.update.input.parse(req.body);
    const setting = await storage.updateSetting(key, value);
    res.json(setting);
  });

  // Initialize defaults
  await storage.initializeDefaultSettings();

  return httpServer;
}
