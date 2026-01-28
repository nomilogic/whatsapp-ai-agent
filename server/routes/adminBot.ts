import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { AdminBotHandler } from "../features/adminBotHandler";

/**
 * Admin Bot Routes
 * Manage per-contact personality, tasks, follow-ups, and conversation summaries
 */

const adminBotRouter = Router();

// Initialize Admin Bot Handler
let adminBotHandler: AdminBotHandler | null = null;

export function initializeAdminBotRoutes(handler: AdminBotHandler) {
  adminBotHandler = handler;
}

// ==================== PERSONALITY ENDPOINTS ====================

/**
 * GET /api/admin-bot/personality/:contactId
 * Get personality profile for a contact
 */
adminBotRouter.get("/personality/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const personality = await adminBotHandler.getContactPersonality(contactId);
    res.json(personality);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin-bot/personality/:contactId
 * Update personality profile for a contact
 */
adminBotRouter.patch("/personality/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);
    const updates = req.body;

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const currentPersonality = await adminBotHandler.getContactPersonality(contactId);
    const updatedPersonality = { ...currentPersonality, ...updates, updatedAt: new Date() };

    // Save to storage
    await storage.updateSetting(
      `admin_bot_personality_${contactId}`,
      JSON.stringify(updatedPersonality)
    );

    res.json(updatedPersonality);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TASKS ENDPOINTS ====================

/**
 * GET /api/admin-bot/tasks/:contactId
 * Get all tasks for a contact
 */
adminBotRouter.get("/tasks/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);
    const status = req.query.status as string | undefined;

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const tasks = await adminBotHandler.getContactTasks(contactId);
    const filtered = status
      ? tasks.filter((t) => t.status === status)
      : tasks;

    res.json({
      tasks: filtered,
      statistics: {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === "pending").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        completed: tasks.filter((t) => t.status === "completed").length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin-bot/tasks/:contactId/:taskId
 * Update task status
 */
adminBotRouter.patch("/tasks/:contactId/:taskId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);
    const taskId = req.params.taskId as string;
    const { status } = req.body;

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const updated = await adminBotHandler.updateTaskStatus(
      contactId,
      taskId,
      status
    );

    if (!updated) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FOLLOW-UPS ENDPOINTS ====================

/**
 * GET /api/admin-bot/follow-ups/:contactId
 * Get all follow-up items for a contact
 */
adminBotRouter.get("/follow-ups/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);
    const status = req.query.status as string | undefined;

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const followUps = await adminBotHandler.getContactFollowUps(contactId);
    const filtered = status
      ? followUps.filter((f) => f.status === status)
      : followUps;

    res.json({
      followUps: filtered,
      statistics: {
        total: followUps.length,
        pending: followUps.filter((f) => f.status === "pending").length,
        inProgress: followUps.filter((f) => f.status === "in_progress").length,
        resolved: followUps.filter((f) => f.status === "resolved").length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONVERSATION SUMMARY ENDPOINTS ====================

/**
 * GET /api/admin-bot/summary/:contactId
 * Get conversation summary for a contact
 */
adminBotRouter.get("/summary/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const summary = await adminBotHandler.getContactSummary(contactId);

    if (!summary) {
      return res.status(404).json({ error: "Summary not found" });
    }

    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin-bot/summary/:contactId/regenerate
 * Regenerate conversation summary for a contact
 */
adminBotRouter.post("/summary/:contactId/regenerate", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const messages = await storage.getMessages(contactId);
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const summary = await adminBotHandler.generateConversationSummary(contactId, history);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONTACT PROFILE ENDPOINTS ====================

/**
 * GET /api/admin-bot/profile/:contactId
 * Get complete profile for a contact (personality + tasks + follow-ups + summary)
 */
adminBotRouter.get("/profile/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const contact = await storage.getContact(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const personality = await adminBotHandler.getContactPersonality(contactId);
    const tasks = await adminBotHandler.getContactTasks(contactId);
    const followUps = await adminBotHandler.getContactFollowUps(contactId);
    const summary = await adminBotHandler.getContactSummary(contactId);

    res.json({
      contact,
      personality,
      tasks,
      followUps,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin-bot/profile/:contactId/refresh
 * Refresh all data for a contact (adapt personality, regenerate summary)
 */
adminBotRouter.post("/profile/:contactId/refresh", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId as string);

    if (!adminBotHandler) {
      return res.status(500).json({ error: "Admin Bot Handler not initialized" });
    }

    const contact = await storage.getContact(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const messages = await storage.getMessages(contactId);
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Adapt personality
    const personality = await adminBotHandler.analyzeAndAdaptPersonality(
      contactId,
      history,
      history[history.length - 1]?.content || ""
    );

    // Extract tasks and follow-ups
    const { tasks, followUps } = await adminBotHandler.extractTasksAndFollowUps(
      contactId,
      history
    );

    // Generate summary
    const summary = await adminBotHandler.generateConversationSummary(contactId, history);

    res.json({
      personality,
      newTasks: tasks,
      newFollowUps: followUps,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default adminBotRouter;
