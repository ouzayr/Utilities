import { useState, useMemo } from "react";
import { useTaskStore } from "@/lib/storage";
import { format, startOfWeek, addDays, subDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfYear, endOfYear, isSameMonth, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TaskDetailsModal } from "@/components/TaskDetailsModal";
import { Plus, ChevronLeft, ChevronRight, Trash2, Calendar as CalendarIcon, LayoutGrid, List } from "lucide-react";
import { Task } from "@shared/schema";

type ViewMode = "week" | "month" | "year";

export default function WeeklyPlanner() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore();
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handleAddTask = async (dateStr: string) => {
    const title = newTaskTitles[dateStr];
    if (!title?.trim()) return;
    try {
      await addTask({
        title,
        date: dateStr,
        priority: "Medium",
        completed: false,
        cancelled: false,
      });
      setNewTaskTitles(prev => ({ ...prev, [dateStr]: "" }));
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

  const navigate = (direction: number) => {
    if (viewMode === "week") setCurrentDate(addDays(currentDate, direction * 7));
    else if (viewMode === "month") setCurrentDate(addDays(currentDate, direction * 30));
    else setCurrentDate(addDays(currentDate, direction * 365));
  };

  return (
    <div className="container max-w-7xl py-12 font-serif">
      <TaskDetailsModal task={editingTask} onClose={() => setEditingTask(null)} />
      
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-xl font-medium min-w-[200px] text-center">
            {viewMode === "week" && `${format(weekStart, "MMM d")} - ${format(addDays(weekStart, 6), "MMM d, yyyy")}`}
            {viewMode === "month" && format(currentDate, "MMMM yyyy")}
            {viewMode === "year" && format(currentDate, "yyyy")}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
        
        <h1 className="text-5xl font-bold italic text-primary absolute left-1/2 -translate-x-1/2 hidden lg:block">Planner</h1>

        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg">
          <Button 
            variant={viewMode === "week" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
          <Button 
            variant={viewMode === "month" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button 
            variant={viewMode === "year" ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setViewMode("year")}
          >
            Year
          </Button>
        </div>
      </div>
      
      {viewMode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-12">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasks.filter(t => t.date === dateStr);
            return <DayCard key={dateStr} day={day} tasks={dayTasks} onAdd={() => handleAddTask(dateStr)} newTaskTitle={newTaskTitles[dateStr] || ""} setNewTaskTitle={(v: string) => setNewTaskTitles(prev => ({ ...prev, [dateStr]: v }))} onEdit={setEditingTask} onToggle={(id: number, c: boolean) => updateTask(id, { completed: c })} onDelete={deleteTask} getPriorityColor={getPriorityColor} />;
          })}
        </div>
      )}

      {viewMode === "month" && (
        <div className="grid grid-cols-7 gap-2 mb-12">
          {monthDays.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayTasks = tasks.filter(t => t.date === dateStr);
            return (
              <div key={dateStr} className={cn("min-h-[100px] p-2 border rounded-md bg-white/50 relative group cursor-pointer", !isSameMonth(day, currentDate) && "opacity-30")} onClick={() => { setCurrentDate(day); setViewMode("week"); }}>
                <span className="text-xs font-bold">{format(day, "d")}</span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 3).map(t => (
                    <div key={t.id} className={cn("text-[10px] truncate", t.completed && "line-through opacity-50")}>• {t.title}</div>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "year" && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-6 mb-12">
          {Array.from({ length: 12 }).map((_, i) => {
            const month = new Date(currentDate.getFullYear(), i, 1);
            const monthTasks = tasks.filter(t => isSameMonth(parseISO(t.date), month));
            return (
              <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentDate(month); setViewMode("month"); }}>
                <CardHeader className="p-3 text-center border-b">
                  <CardTitle className="text-lg italic">{format(month, "MMMM")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{monthTasks.length}</div>
                  <div className="text-xs text-muted-foreground uppercase">Entries</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-white/50 backdrop-blur-sm border-none shadow-xl relative overflow-hidden">
        <div className="absolute left-10 top-0 bottom-0 w-px bg-red-200/50" />
        <CardHeader className="pl-16">
          <CardTitle className="text-3xl font-bold italic text-primary">Pending Tasks</CardTitle>
        </CardHeader>
        <CardContent className="pl-16 pr-12 pb-12 space-y-4">
          {tasks.filter(t => !t.completed && !t.cancelled).length === 0 ? (
            <p className="text-muted-foreground italic text-lg py-8">All clear for now.</p>
          ) : (
            tasks.filter(t => !t.completed && !t.cancelled).map(task => (
              <div key={task.id} className="flex items-center gap-4 py-2 group cursor-pointer border-b border-dashed border-primary/10" onClick={() => setEditingTask(task)}>
                <Checkbox checked={task.completed} onCheckedChange={(checked) => updateTask(task.id, { completed: !!checked, cancelled: false })} onClick={(e) => e.stopPropagation()} />
                <div className={cn("w-3 h-3 rounded-full shrink-0", getPriorityColor(task.priority))} />
                <span className="flex-1 text-xl">{task.title}</span>
                <span className="text-xs text-muted-foreground font-sans uppercase tracking-widest">{format(parseISO(task.date), "MMM do")}</span>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DayCard({ day, tasks, onAdd, newTaskTitle, setNewTaskTitle, onEdit, onToggle, onDelete, getPriorityColor }: any) {
  return (
    <Card className="bg-white/50 backdrop-blur-sm border-none shadow-lg flex flex-col h-full">
      <CardHeader className="pb-2 text-center border-b border-dashed border-primary/10 p-4">
        <CardTitle className="text-lg font-bold italic text-primary">{format(day, "EEEE")}</CardTitle>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{format(day, "MMM do")}</p>
      </CardHeader>
      <CardContent className="pt-4 px-3 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
        <div className="flex gap-1 mb-2">
          <Input placeholder="Add..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="h-7 text-xs font-serif italic" onKeyDown={(e) => e.key === "Enter" && onAdd()} />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
        </div>
        {tasks.map((task: any) => (
          <div key={task.id} className={cn("flex items-start gap-2 text-xs group cursor-pointer", task.completed && "opacity-50")} onClick={() => onEdit(task)}>
            <Checkbox checked={task.completed} onCheckedChange={(c) => onToggle(task.id, !!c)} className="mt-0.5 h-3 w-3" onClick={(e) => e.stopPropagation()} />
            <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", getPriorityColor(task.priority))} />
            <span className={cn("flex-1 leading-tight", task.completed && "line-through")}>{task.title}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
