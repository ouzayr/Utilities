import { db } from "./db";
import {
  tasks,
  type CreateTaskRequest,
  type UpdateTaskRequest,
  type TaskResponse,
} from "@shared/schema";
import { eq, inArray, and, lt } from "drizzle-orm";

export interface IStorage {
  getTasks(date?: string): Promise<TaskResponse[]>;
  getUncompletedPastTasks(today: string): Promise<TaskResponse[]>;
  getTask(id: number): Promise<TaskResponse | undefined>;
  createTask(task: CreateTaskRequest): Promise<TaskResponse>;
  updateTask(id: number, updates: UpdateTaskRequest): Promise<TaskResponse>;
  deleteTask(id: number): Promise<void>;
  bulkUpdateTasks(ids: number[], updates: UpdateTaskRequest): Promise<TaskResponse[]>;
}

export class DatabaseStorage implements IStorage {
  async getTasks(date?: string): Promise<TaskResponse[]> {
    if (date) {
      return await db.select().from(tasks).where(eq(tasks.date, date));
    }
    return await db.select().from(tasks);
  }

  async getUncompletedPastTasks(today: string): Promise<TaskResponse[]> {
    return await db.select().from(tasks).where(
      and(
        lt(tasks.date, today),
        eq(tasks.completed, false),
        eq(tasks.cancelled, false)
      )
    );
  }

  async getTask(id: number): Promise<TaskResponse | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: CreateTaskRequest): Promise<TaskResponse> {
    // Cast needed due to drizzle-zod jsonb field type inference mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [newTask] = await db.insert(tasks).values(task as any).returning();
    return newTask;
  }

  async updateTask(id: number, updates: UpdateTaskRequest): Promise<TaskResponse> {
    const [updated] = await db.update(tasks)
      // Cast needed due to drizzle-zod jsonb field type inference mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updates as any)
      .where(eq(tasks.id, id))
      .returning();
    if (!updated) throw new Error("Task not found");
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async bulkUpdateTasks(ids: number[], updates: UpdateTaskRequest): Promise<TaskResponse[]> {
    if (ids.length === 0) return [];
    return await db.update(tasks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updates as any)
      .where(inArray(tasks.id, ids))
      .returning();
  }
}

export const storage = new DatabaseStorage();
