import { useState, useEffect } from "react";
import { useTaskStore } from "@/lib/storage";
import { format, isBefore, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, ArrowRight } from "lucide-react";
import { Task } from "@shared/schema";

export function ReplanModal() {
  const [open, setOpen] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const { getOverdueTasks, updateTask } = useTaskStore();
  
  const overdueTasks = getOverdueTasks(today);

  useEffect(() => {
    if (overdueTasks.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [overdueTasks.length]);

  if (overdueTasks.length === 0) return null;

  const currentTask = overdueTasks[0];

  const handleComplete = () => {
    updateTask(currentTask.id, { completed: true });
  };

  const handleCancel = () => {
    updateTask(currentTask.id, { cancelled: true });
  };

  const handleMoveToToday = () => {
    const history = currentTask.rescheduleHistory || [];
    updateTask(currentTask.id, { 
      date: today,
      rescheduleHistory: [...history, currentTask.date]
    });
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
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px] font-serif">
        <DialogHeader>
          <DialogTitle className="text-2xl italic">Morning Reflection</DialogTitle>
          <DialogDescription>
            You have {overdueTasks.length} uncompleted tasks from previous days. How shall we proceed?
          </DialogDescription>
        </DialogHeader>
        
        <Card className="my-4 border-dashed bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex justify-center mb-2">
              <div className={cn("px-3 py-1 rounded-full text-xs text-white font-sans font-bold uppercase tracking-wider", getPriorityColor(currentTask.priority))}>
                {currentTask.priority}
              </div>
            </div>
            <p className="text-lg italic text-center">"{currentTask.title}"</p>
            <p className="text-xs text-muted-foreground text-center mt-2">from {currentTask.date}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-2">
          <Button 
            variant="outline" 
            className="justify-start hover:bg-green-50 hover:text-green-700"
            onClick={handleComplete}
            data-testid="button-complete-task"
          >
            <Check className="mr-2 h-4 w-4" /> Mark Completed
          </Button>
          <Button 
            variant="outline" 
            className="justify-start hover:bg-blue-50 hover:text-blue-700"
            onClick={handleMoveToToday}
            data-testid="button-move-task"
          >
            <ArrowRight className="mr-2 h-4 w-4" /> Carry Over to Today
          </Button>
          <Button 
            variant="outline" 
            className="justify-start hover:bg-red-50 hover:text-red-700"
            onClick={handleCancel}
            data-testid="button-cancel-task"
          >
            <X className="mr-2 h-4 w-4" /> Cancel Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
