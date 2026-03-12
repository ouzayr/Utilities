import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTaskSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/tasks", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const tasks = await storage.getTasks(date);
      res.json(tasks);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("GET /api/tasks error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  app.get("/api/tasks/past-uncompleted", async (req, res) => {
    try {
      const today = req.query.today as string;
      if (!today) return res.status(400).json({ message: "today date required" });
      const tasks = await storage.getUncompletedPastTasks(today);
      res.json(tasks);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("GET /api/tasks/past-uncompleted error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(Number(req.params.id));
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.json(task);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("GET /api/tasks/:id error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const input = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      const error = err instanceof Error ? err.message : String(err);
      console.error("POST /api/tasks error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const input = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      if (err instanceof Error && err.message === "Task not found") {
         return res.status(404).json({ message: "Task not found" });
      }
      const error = err instanceof Error ? err.message : String(err);
      console.error("PUT /api/tasks/:id error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("DELETE /api/tasks/:id error:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

  return httpServer;
}
