import { useState } from "react";
import { useTaskStore } from "@/lib/storage";
import { format, addDays, subDays, isToday } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReplanModal } from "@/components/ReplanModal";
import { TaskDetailsModal } from "@/components/TaskDetailsModal";
import { Task } from "@shared/schema";

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const { getTasksByDate, addTask, updateTask, deleteTask } = useTaskStore();
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const tasks = getTasksByDate(dateStr);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await addTask({
        title: newTaskTitle,
        date: dateStr,
        priority: "Medium",
        completed: false,
        cancelled: false,
      });
      setNewTaskTitle("");
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "Low": return "bg-blue-400";
      case "Medium": return "bg-orange-400";
      case "High": return "bg-red-400";
      case "Urgent": return "bg-purple-400";
      default: return "bg-orange-400";
    }
  };

  return (
    <div className="container max-w-3xl py-12 font-serif">
      <ReplanModal />
      <TaskDetailsModal task={editingTask} onClose={() => setEditingTask(null)} />
      
      <header className="mb-12 flex flex-col items-center">
        <h1 className="text-5xl font-bold italic text-primary mb-6">Daily Log</h1>
        <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-full border border-border/50">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="text-lg font-medium px-6">
                {isToday(selectedDate) ? "Today, " : ""}{format(selectedDate, "MMMM do")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute left-10 top-0 bottom-0 w-px bg-red-200/50" />
        <CardContent className="pt-12 pb-12 pl-16 pr-12 space-y-8">
          <form onSubmit={handleAddTask} className="flex gap-4 border-b border-dashed border-primary/20 pb-4">
            <Input
              placeholder="What needs doing?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="text-xl font-serif italic border-none bg-transparent focus-visible:ring-0 p-0 placeholder:text-muted-foreground/40"
              data-testid="input-new-task"
            />
            <Button type="submit" size="sm" variant="ghost" className="hover:bg-primary/5">
              <Plus className="h-6 w-6" />
            </Button>
          </form>

          <div className="space-y-4">
            {tasks.length === 0 ? (
              <p className="text-muted-foreground italic text-center py-12 text-lg">A blank page awaits.</p>
            ) : (
              tasks.map((task) => (
                <div 
                  key={task.id} 
                  className={cn(
                    "flex items-start gap-4 py-3 group transition-all",
                    task.completed && "opacity-50",
                    task.cancelled && "opacity-30"
                  )}
                  onClick={() => setEditingTask(task)}
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={(checked) => {
                      updateTask(task.id, { completed: !!checked, cancelled: false });
                    }}
                    className="mt-1.5"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-task-${task.id}`}
                  />
                  <div className={cn("w-3 h-3 rounded-full mt-2 shrink-0", getPriorityColor(task.priority))} title={`Priority: ${task.priority}`} />
                  <span className={cn(
                    "flex-1 text-xl leading-relaxed cursor-pointer",
                    task.completed && "line-through decoration-primary/30",
                    task.cancelled && "line-through decoration-red-400"
                  )}>
                    {task.title}
                  </span>
                  
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1" onClick={(e) => e.stopPropagation()}>
                    {!task.completed && !task.cancelled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => updateTask(task.id, { cancelled: true })}
                        title="Cancel Entry"
                        data-testid={`button-cancel-task-${task.id}`}
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteTask(task.id)}
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
