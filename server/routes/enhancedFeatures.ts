import { Router, Request, Response } from "express";
import { memoryManager } from "../memory/memoryManager";
import { taskManager } from "../tasks/taskManager";
import { conversationAnalyzer } from "../conversations/conversationAnalyzer";
import { proactiveMessager } from "../messaging/proactiveMessager";
import { analyticsEngine } from "../analytics/analyticsEngine";
import { storage } from "../storage";

/**
 * API Routes for Enhanced Features
 * Memory, Tasks, Analytics, and Messaging
 */

export const enhancedFeaturesRouter = Router();

// ==================== MEMORY ENDPOINTS ====================

/**
 * GET /api/memory/:contactId
 * Get all memories for a contact
 */
enhancedFeaturesRouter.get("/memory/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const insights = await memoryManager.getMemoryInsights(contactId);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/memory/:contactId
 * Store a memory for a contact
 */
enhancedFeaturesRouter.post("/memory/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const { content, category } = req.body;

    const memory = await memoryManager.storeUserMemory(contactId, content, category);
    res.json(memory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/memory/:contactId/search
 * Search memories for a contact
 */
enhancedFeaturesRouter.get("/memory/:contactId/search", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const memories = await memoryManager.searchMemories(contactId, query);
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/memory/:contactId/category/:category
 * Get memories by category
 */
enhancedFeaturesRouter.get(
  "/memory/:contactId/category/:category",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const category = req.params.category;

      const memories = await memoryManager.getMemoryByCategory(
        contactId,
        category
      );
      res.json(memories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== TASK ENDPOINTS ====================

/**
 * GET /api/tasks/:contactId
 * Get all tasks for a contact
 */
enhancedFeaturesRouter.get("/tasks/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const status = req.query.status as string | undefined;

    const tasks = await taskManager.getTasksForContact(contactId, status as any);
    const stats = await taskManager.getTaskStatistics(contactId);

    res.json({ tasks, statistics: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tasks/:contactId
 * Create a new task
 */
enhancedFeaturesRouter.post("/tasks/:contactId", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const { description, type, priority, deadline } = req.body;

    const task = await taskManager.createTask(
      contactId,
      description,
      type || "custom",
      priority || "medium",
      deadline ? new Date(deadline) : undefined
    );

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/tasks/:taskId
 * Update task status
 */
enhancedFeaturesRouter.patch("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId;
    const { status } = req.body;

    const task = await taskManager.updateTaskStatus(taskId, status);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tasks/upcoming
 * Get upcoming tasks (within specified hours)
 */
enhancedFeaturesRouter.get("/tasks/upcoming", async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const tasks = await taskManager.getUpcomingTasks(hours);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONVERSATION ANALYSIS ENDPOINTS ====================

/**
 * POST /api/conversations/analyze/:contactId
 * Analyze a conversation thread
 */
enhancedFeaturesRouter.post(
  "/conversations/analyze/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res
          .status(400)
          .json({ error: "Messages array is required" });
      }

      const analysis = await conversationAnalyzer.analyzeConversation(
        contactId,
        messages
      );
      const suggestions = await conversationAnalyzer.generateResponseSuggestion(
        analysis
      );

      res.json({ analysis, suggestions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== MESSAGING ENDPOINTS ====================

/**
 * GET /api/messaging/proactive/:contactId
 * Check if should send proactive message
 */
enhancedFeaturesRouter.get(
  "/messaging/proactive/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const result = await proactiveMessager.shouldSendProactiveMessage(
        contactId
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/messaging/suggest/:contactId
 * Get message suggestion based on type
 */
enhancedFeaturesRouter.get(
  "/messaging/suggest/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const type = req.query.type as string || "greeting";

      const message = await proactiveMessager.createContextualMessage(
        contactId,
        type as any
      );
      res.json({ message });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/messaging/strategy/:relationshipType
 * Get messaging strategy for relationship type
 */
enhancedFeaturesRouter.get(
  "/messaging/strategy/:relationshipType",
  (req: Request, res: Response) => {
    try {
      const relationshipType = req.params.relationshipType;
      const strategy = proactiveMessager.getMessagingStrategy(relationshipType);
      res.json(strategy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== ANALYTICS ENDPOINTS ====================

/**
 * GET /api/analytics/metrics/:contactId
 * Get interaction metrics for a contact
 */
enhancedFeaturesRouter.get(
  "/analytics/metrics/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const metrics = await analyticsEngine.getInteractionMetrics(contactId);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/analytics/insights/:contactId
 * Get relationship insights for a contact
 */
enhancedFeaturesRouter.get(
  "/analytics/insights/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const insights = await analyticsEngine.getRelationshipInsights(contactId);
      res.json(insights);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/analytics/weekly/:contactId
 * Get weekly insights for a contact
 */
enhancedFeaturesRouter.get(
  "/analytics/weekly/:contactId",
  async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const insights = await analyticsEngine.getWeeklyInsights(contactId);
      res.json(insights);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/analytics/ranked
 * Get all contacts ranked by interaction strength
 */
enhancedFeaturesRouter.get("/analytics/ranked", async (req: Request, res: Response) => {
  try {
    const ranked = await analyticsEngine.getRankedContacts();
    res.json(ranked);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default enhancedFeaturesRouter;
