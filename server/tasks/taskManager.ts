/**
 * TaskManager: Comprehensive task management system
 * Handles task creation, tracking, scheduling, and automation
 */

export type TaskType = "reminder" | "follow_up" | "order" | "payment" | "investigation" | "custom";
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ReminderConfig {
  time: Date;
  sent: boolean;
  notificationType?: "message" | "notification" | "both";
}

export interface Task {
  id: string;
  contactId: number;
  type: TaskType;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date;
  reminders: ReminderConfig[];
  tags: string[];
  relatedMemoryIds?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private contactTasks: Map<number, Set<string>> = new Map();
  private pendingReminders: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new task
   */
  async createTask(
    contactId: number,
    description: string,
    type: TaskType = "custom",
    priority: TaskPriority = "medium",
    deadline?: Date
  ): Promise<Task> {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const task: Task = {
      id,
      contactId,
      type,
      description,
      status: "pending",
      priority,
      deadline,
      reminders: deadline
        ? [
            {
              time: new Date(deadline.getTime() - 24 * 60 * 60 * 1000), // 24 hours before
              sent: false,
            },
            {
              time: new Date(deadline.getTime() - 60 * 60 * 1000), // 1 hour before
              sent: false,
            },
          ]
        : [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);

    // Add to contact index
    if (!this.contactTasks.has(contactId)) {
      this.contactTasks.set(contactId, new Set());
    }
    this.contactTasks.get(contactId)!.add(id);

    // Schedule reminders
    if (task.reminders.length > 0) {
      this.scheduleReminders(id);
    }

    return task;
  }

  /**
   * Get all tasks for a contact
   */
  async getTasksForContact(
    contactId: number,
    status?: TaskStatus
  ): Promise<Task[]> {
    const taskIds = this.contactTasks.get(contactId) || new Set();
    const tasks = Array.from(taskIds)
      .map(id => this.tasks.get(id))
      .filter(t => t && (!status || t.status === status)) as Task[];

    return tasks.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0) ||
        (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0)
      );
    });
  }

  /**
   * Get pending tasks (not completed)
   */
  async getPendingTasks(contactId: number): Promise<Task[]> {
    return this.getTasksForContact(contactId, "pending");
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    task.status = newStatus;
    task.updatedAt = new Date();

    if (newStatus === "completed") {
      task.completedAt = new Date();
    }

    return task;
  }

  /**
   * Extract tasks from conversation
   */
  async extractTasksFromConversation(
    contactId: number,
    messages: Array<{ role: string; content: string }>
  ): Promise<Task[]> {
    const extractedTasks: Task[] = [];
    const allText = messages.map(m => m.content).join(" ");

    // Patterns for task extraction
    const patterns = [
      {
        pattern: /(?:need to|should|must|will|gonna|going to)\s+([^.!?]*)/gi,
        type: "custom" as TaskType,
        priority: "medium" as TaskPriority,
      },
      {
        pattern: /(?:reminder:?|remember:?|don't forget:?)\s+([^.!?]*)/gi,
        type: "reminder" as TaskType,
        priority: "high" as TaskPriority,
      },
      {
        pattern: /(?:follow[\s-]?up:?|follow up on:?)\s+([^.!?]*)/gi,
        type: "follow_up" as TaskType,
        priority: "high" as TaskPriority,
      },
      {
        pattern: /(?:order:?|buy:?|purchase:?)\s+([^.!?]*)/gi,
        type: "order" as TaskType,
        priority: "medium" as TaskPriority,
      },
      {
        pattern: /(?:pay:?|payment:?|charge:?)\s+([^.!?]*)/gi,
        type: "payment" as TaskType,
        priority: "high" as TaskPriority,
      },
    ];

    for (const { pattern, type, priority } of patterns) {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const description = match[1]?.trim();
        if (description && description.length > 5 && description.length < 100) {
          const task = await this.createTask(
            contactId,
            description,
            type,
            priority
          );
          extractedTasks.push(task);
        }
      }
    }

    return extractedTasks;
  }

  /**
   * Schedule reminders for a task
   */
  private scheduleReminders(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task || task.reminders.length === 0) return;

    for (const reminder of task.reminders) {
      if (reminder.sent) continue;

      const now = new Date();
      const timeUntilReminder = reminder.time.getTime() - now.getTime();

      if (timeUntilReminder > 0) {
        const reminderId = `${taskId}_${reminder.time.getTime()}`;

        const timeout = setTimeout(() => {
          this.markReminderSent(taskId, reminder.time);
          this.pendingReminders.delete(reminderId);
        }, timeUntilReminder);

        this.pendingReminders.set(reminderId, timeout);
      }
    }
  }

  /**
   * Mark reminder as sent
   */
  private async markReminderSent(taskId: string, reminderTime: Date) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const reminder = task.reminders.find(
      r => r.time.getTime() === reminderTime.getTime()
    );
    if (reminder) {
      reminder.sent = true;
      task.updatedAt = new Date();
    }
  }

  /**
   * Get tasks due soon
   */
  async getUpcomingTasks(hoursAhead: number = 24): Promise<Task[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const upcoming: Task[] = [];

    for (const task of this.tasks.values()) {
      if (
        task.status !== "completed" &&
        task.deadline &&
        task.deadline >= now &&
        task.deadline <= future
      ) {
        upcoming.push(task);
      }
    }

    return upcoming.sort((a, b) =>
      (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0)
    );
  }

  /**
   * Add tags to task
   */
  async addTagsToTask(taskId: string, tags: string[]): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    task.tags = [...new Set([...task.tags, ...tags])];
    task.updatedAt = new Date();

    return task;
  }

  /**
   * Find tasks by tag
   */
  async getTasksByTag(contactId: number, tag: string): Promise<Task[]> {
    const taskIds = this.contactTasks.get(contactId) || new Set();
    return Array.from(taskIds)
      .map(id => this.tasks.get(id))
      .filter(t => t && t.tags.includes(tag)) as Task[];
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(contactId: number) {
    const allTasks = await this.getTasksForContact(contactId);

    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === "pending").length,
      inProgress: allTasks.filter(t => t.status === "in_progress").length,
      completed: allTasks.filter(t => t.status === "completed").length,
      blocked: allTasks.filter(t => t.status === "blocked").length,
      overdue: allTasks.filter(
        t =>
          t.deadline &&
          t.deadline < new Date() &&
          t.status !== "completed"
      ).length,
      byPriority: {
        urgent: allTasks.filter(t => t.priority === "urgent").length,
        high: allTasks.filter(t => t.priority === "high").length,
        medium: allTasks.filter(t => t.priority === "medium").length,
        low: allTasks.filter(t => t.priority === "low").length,
      },
    };
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Clear scheduled reminders
    const reminderId = `${taskId}_*`;
    for (const [id, timeout] of this.pendingReminders) {
      if (id.startsWith(`${taskId}_`)) {
        clearTimeout(timeout);
        this.pendingReminders.delete(id);
      }
    }

    // Remove from contact index
    const contactTasks = this.contactTasks.get(task.contactId);
    if (contactTasks) {
      contactTasks.delete(taskId);
    }

    this.tasks.delete(taskId);
    return true;
  }

  /**
   * Clean up completed tasks older than specified days
   */
  async cleanupOldTasks(daysOld: number = 30): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [taskId, task] of this.tasks) {
      if (
        task.status === "completed" &&
        task.completedAt &&
        (now.getTime() - task.completedAt.getTime()) / (1000 * 60 * 60 * 24) >
          daysOld
      ) {
        await this.deleteTask(taskId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const taskManager = new TaskManager();
