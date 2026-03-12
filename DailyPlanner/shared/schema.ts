import { pgTable, text, serial, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  cancelled: boolean("cancelled").default(false).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  priority: text("priority").default("Medium").notNull(), // Low, Medium, High, Urgent
  category: text("category"),
  client: text("client"),
  tags: text("tags").array(),
  notes: text("notes"),
  handwrittenNotes: text("handwritten_notes"), // SVG or Base64 data
  attachments: jsonb("attachments").$type<{url: string, name: string}[]>().default([]),
  rescheduleHistory: jsonb("reschedule_history").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  completed: true,
  cancelled: true,
  date: true,
  priority: true,
  category: true,
  client: true,
  tags: true,
  notes: true,
  handwrittenNotes: true,
  attachments: true,
  rescheduleHistory: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type CreateTaskRequest = InsertTask;
export type UpdateTaskRequest = Partial<InsertTask>;
export type TaskResponse = Task;
