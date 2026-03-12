import { useState, useEffect, useCallback } from "react";
import { Task, InsertTask } from "@shared/schema";
import { isBefore, parseISO } from "date-fns";
import { apiRequest } from "./queryClient";

// Simple global state to share between hooks
let globalTasks: Task[] = [];
const listeners: Set<(tasks: Task[]) => void> = new Set();

const updateGlobalTasks = (tasks: Task[]) => {
  globalTasks = tasks;
  listeners.forEach(l => l(tasks));
};

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(globalTasks);

  useEffect(() => {
    const listener = (newTasks: Task[]) => setTasks(newTasks);
    listeners.add(listener);
    
    // Fetch tasks from database only on initial load
    if (globalTasks.length === 0) {
      const fetchTasks = async () => {
        try {
          const res = await fetch("/api/tasks");
          if (!res.ok) throw new Error("Failed to fetch tasks");
          const data = await res.json();
          updateGlobalTasks(data);
        } catch (e) {
          console.error("Failed to fetch tasks from database:", e);
          updateGlobalTasks([]);
        }
      };
      fetchTasks();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addTask = useCallback(async (insertTask: InsertTask) => {
    try {
      const res = await apiRequest("POST", "/api/tasks", insertTask);
      const newTask = await res.json();
      updateGlobalTasks([...globalTasks, newTask]);
      return newTask;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to add task - Storage layer:", errorMsg);
      throw e;
    }
  }, []);

  const updateTask = useCallback(async (id: number, updates: Partial<InsertTask>) => {
    try {
      const res = await apiRequest("PUT", `/api/tasks/${id}`, updates);
      const updated = await res.json();
      updateGlobalTasks(globalTasks.map(t => t.id === id ? updated : t));
      return updated;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to update task - Storage layer:", errorMsg);
      throw e;
    }
  }, []);

  const deleteTask = useCallback(async (id: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/tasks/${id}`);
      updateGlobalTasks(globalTasks.filter(t => t.id !== id));
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to delete task - Storage layer:", errorMsg);
      throw e;
    }
  }, []);

  const getTasksByDate = (date: string) => {
    return tasks.filter((t) => t.date === date);
  };

  const getOverdueTasks = (today: string) => {
    return tasks.filter((t) => 
      !t.completed && 
      !t.cancelled && 
      isBefore(parseISO(t.date), parseISO(today))
    );
  };

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    getTasksByDate,
    getOverdueTasks,
    getAllTasks: () => tasks,
  };
}
